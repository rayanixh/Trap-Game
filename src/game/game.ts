import { Assets } from "../core/assets";
import { Sfx } from "../core/audio";
import { Input } from "../core/input";
import { loadSave, persist, type SaveData } from "../core/save";
import { clamp, overlaps } from "../core/types";
import type { Rect } from "../core/types";
import { Backdrop, PlatformPainter } from "../render/scene";
import { drawHud, drawPanel, drawVignette, type HudModel } from "./hud";
import { Particles } from "./particles";
import { Player } from "./player";
import { FLOOR_Y, ROOM_H, ROOM_LIST, ROOM_W, type Room } from "./rooms";
import { TrapRun } from "./traps";

const VIEW_W = ROOM_W;
const VIEW_H = ROOM_H;
const PLAYER_DRAW_HEIGHT = 118;
const PAUSE_CHIP = { x: 1176, y: 24, w: 64, h: 40 };
const DEATH_PAUSE = 0.75;

type State = "loading" | "title" | "play" | "paused" | "dead" | "clear" | "victory";

export class Game {
  private assets = new Assets();
  private input: Input;
  private sfx = new Sfx();
  private particles = new Particles();
  private painter: PlatformPainter;
  private backdrop = new Backdrop();
  private player = new Player();
  private save: SaveData = loadSave();

  private state: State = "loading";
  private room!: Room;
  private roomIndex = 0;
  private titlePick = 0;

  private traps: TrapRun[] = [];
  private platforms: Rect[] = [];
  private doorX = 0;
  private doorHidden = false;
  private decoyX: number | null = null;

  private deaths = 0;
  private hintTimer = 0;
  private taunt = "";
  private tauntTimer = 0;
  private deathTimer = 0;
  private elapsed = 0;

  private loadProgress = 0;
  private loadError = "";

  constructor(
    private ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
  ) {
    this.input = new Input(canvas);
    this.painter = new PlatformPainter(this.assets);
    this.sfx.muted = this.save.muted;

    canvas.addEventListener("pointerdown", (e) => {
      this.sfx.unlock();
      const p = this.input.pointer(e);
      const onChip =
        p.x >= PAUSE_CHIP.x &&
        p.x <= PAUSE_CHIP.x + PAUSE_CHIP.w &&
        p.y >= PAUSE_CHIP.y &&
        p.y <= PAUSE_CHIP.y + PAUSE_CHIP.h;

      if (this.input.touchMode && onChip && (this.state === "play" || this.state === "paused")) {
        this.togglePause();
        return;
      }
      if (this.state === "title") this.startRoom(this.titlePick);
      else if (this.state === "clear") this.nextRoom();
      else if (this.state === "victory") this.toTitle();
    });

    window.addEventListener("keydown", () => this.sfx.unlock(), { once: true });
    void this.boot();
  }

  private async boot(): Promise<void> {
    try {
      await this.assets.load((f) => {
        this.loadProgress = f;
      });
      this.painter.prepare(this.ctx);
      this.titlePick = clamp(this.save.unlocked, 0, ROOM_LIST.length - 1);
      this.prepareRoom(this.titlePick);
      this.state = "title";
    } catch (err) {
      this.loadError = err instanceof Error ? err.message : String(err);
    }
  }

  /* --------------------------------------------------------------- lifecycle */

  private prepareRoom(index: number): void {
    this.roomIndex = index;
    this.room = ROOM_LIST[index]!;
    this.traps = this.room.traps.map((def, i) => new TrapRun(def, i));
    this.platforms = this.room.platforms.map((p) => ({ ...p }));
    this.doorX = this.room.door.x;
    this.doorHidden = Boolean(this.room.door.hidden);
    this.decoyX = this.room.traps.find((t) => t.kind === "fakeDoor")?.x ?? null;
    this.deaths = 0;
    this.hintTimer = 3.4;
    this.taunt = "";
    this.tauntTimer = 0;
    this.player.reviveFull();
    this.player.respawn(this.room.spawnX, FLOOR_Y);
    this.particles.clear();
  }

  private startRoom(index: number): void {
    this.prepareRoom(index);
    this.state = "play";
    this.sfx.ui();
  }

  /** Retry the same room: geometry and traps go back to their opening pose. */
  private retryRoom(): void {
    this.traps = this.room.traps.map((def, i) => new TrapRun(def, i));
    this.platforms = this.room.platforms.map((p) => ({ ...p }));
    this.doorX = this.room.door.x;
    this.doorHidden = Boolean(this.room.door.hidden);
    this.decoyX = this.room.traps.find((t) => t.kind === "fakeDoor")?.x ?? null;
    this.taunt = "";
    this.tauntTimer = 0;
    this.player.reviveFull();
    this.player.respawn(this.room.spawnX, FLOOR_Y);
    this.particles.clear();
    this.state = "play";
  }

  private nextRoom(): void {
    if (this.roomIndex + 1 >= ROOM_LIST.length) {
      this.state = "victory";
      return;
    }
    this.titlePick = this.roomIndex + 1;
    this.startRoom(this.roomIndex + 1);
  }

  private toTitle(): void {
    this.prepareRoom(this.titlePick);
    this.state = "title";
  }

  private togglePause(): void {
    if (this.state === "play") this.state = "paused";
    else if (this.state === "paused") this.state = "play";
    this.sfx.ui();
  }

  private solids(): Rect[] {
    const list = this.platforms.slice();
    for (const t of this.traps) {
      const solid = t.solid();
      if (solid) list.push(solid);
    }
    return list;
  }

  private doorRect(): Rect {
    return { x: this.doorX - 58, y: FLOOR_Y - 165, w: 116, h: 165 };
  }

  /* -------------------------------------------------------------------- tick */

  tick(dt: number): void {
    this.elapsed += dt;
    if (this.state === "loading") return;

    if (this.input.justPressed("mute")) {
      this.save.muted = this.sfx.toggleMute();
      persist(this.save);
    }

    switch (this.state) {
      case "title":
        if (this.input.justPressed("left")) this.titlePick = Math.max(0, this.titlePick - 1);
        if (this.input.justPressed("right")) {
          this.titlePick = Math.min(this.save.unlocked, this.titlePick + 1);
        }
        if (this.input.justPressed("confirm") || this.input.justPressed("jump")) {
          this.sfx.unlock();
          this.startRoom(this.titlePick);
        }
        this.player.tickAnimation(dt);
        this.particles.update(dt);
        break;

      case "play":
        this.updatePlay(dt);
        break;

      case "paused":
        if (this.input.justPressed("pause") || this.input.justPressed("confirm")) this.togglePause();
        if (this.input.justPressed("restart")) this.retryRoom();
        break;

      case "dead":
        this.deathTimer -= dt;
        this.player.tickAnimation(dt);
        this.particles.update(dt);
        if (this.deathTimer <= 0) this.retryRoom();
        break;

      case "clear":
        this.particles.update(dt);
        if (this.input.justPressed("confirm") || this.input.justPressed("jump")) this.nextRoom();
        break;

      case "victory":
        this.particles.update(dt);
        if (this.input.justPressed("confirm") || this.input.justPressed("jump")) this.toTitle();
        break;
    }

    this.input.endTick();
  }

  private updatePlay(dt: number): void {
    if (this.input.justPressed("pause")) {
      this.togglePause();
      return;
    }
    if (this.input.justPressed("restart")) {
      this.retryRoom();
      return;
    }

    this.hintTimer = Math.max(0, this.hintTimer - dt);
    this.tauntTimer = Math.max(0, this.tauntTimer - dt);

    this.player.tickAnimation(dt);
    this.player.update(dt, this.input, {
      solids: this.solids(),
      onJump: () => {
        this.sfx.jump();
        this.particles.dust(this.player.centerX(), this.player.bottom(), 4, 70);
      },
      onDied: () => undefined,
    });

    const impact = this.player.consumeLandImpact();
    if (impact > 0) {
      this.sfx.land();
      this.particles.dust(this.player.centerX(), this.player.bottom(), 4 + Math.round(impact * 5), 100);
    }

    const px = this.player.centerX();
    for (const trap of this.traps) {
      trap.update(dt, px);
      if (trap.justFired) this.fire(trap);
    }

    const pr = this.player.rect();
    for (const trap of this.traps) {
      const hazard = trap.hazard();
      if (hazard && overlaps(pr, hazard)) {
        this.die();
        return;
      }
    }
    if (this.player.y > VIEW_H + 40) {
      this.die();
      return;
    }

    if (!this.doorHidden && overlaps(pr, this.doorRect())) {
      this.clearRoom();
      return;
    }

    this.particles.update(dt);
  }

  /** React to a trap springing: sounds, dust, floor removal, door tricks. */
  private fire(trap: TrapRun): void {
    const def = trap.def;

    if (def.taunt) {
      this.taunt = def.taunt;
      this.tauntTimer = 2.4;
    }

    if (def.kind === "floorFall") {
      this.carveFloor(def.x, def.w);
      // dust kicks up across the whole width that just dropped away
      for (let x = def.x + 20; x < def.x + def.w; x += 46) {
        this.particles.dust(x, FLOOR_Y + 6, 3, 80);
      }
      this.sfx.land();
      return;
    }

    if (def.kind === "doorShift") {
      const from = this.doorX;
      this.doorX = def.to ?? def.x;
      this.particles.burst(from, FLOOR_Y - 90, "#ffe07a", 16, 200);
      this.particles.burst(this.doorX, FLOOR_Y - 90, "#ffe07a", 16, 200);
      this.sfx.door();
      return;
    }

    if (def.kind === "fakeDoor") {
      this.decoyX = null;
      this.doorHidden = false;
      this.doorX = def.to ?? this.room.door.x;
      this.particles.burst(def.x + def.w / 2, FLOOR_Y - 90, "#ffb4a4", 20, 240);
      // the decoy bites back
      this.traps.push(
        new TrapRun(
          { kind: "spikesPop", x: def.x, w: def.w, triggerX: -1, delay: 0.02, hold: 1.4 },
          this.traps.length,
        ),
      );
      this.sfx.deny();
      return;
    }

    if (def.kind === "saw") {
      this.particles.dust(this.doorX, FLOOR_Y, 2, 10);
      this.sfx.deny();
      return;
    }

    this.particles.dust(def.x + def.w / 2, def.kind === "spikesDrop" ? 20 : FLOOR_Y, 8, 110);
    this.sfx.deny();
  }

  /** Cut a hole out of the floor, splitting any slab it overlaps. */
  private carveFloor(x: number, w: number): void {
    const out: Rect[] = [];
    for (const p of this.platforms) {
      const overlapsX = x < p.x + p.w && x + w > p.x;
      const sameRow = Math.abs(p.y - FLOOR_Y) < 2;
      if (!overlapsX || !sameRow) {
        out.push(p);
        continue;
      }
      if (x > p.x) out.push({ ...p, w: x - p.x });
      if (x + w < p.x + p.w) out.push({ ...p, x: x + w, w: p.x + p.w - (x + w) });
    }
    this.platforms = out;
  }

  private die(): void {
    if (this.state !== "play") return;
    this.player.kill();
    this.sfx.die();
    this.particles.burst(this.player.centerX(), this.player.y + this.player.h / 2, "#ff9a86", 18, 250);
    this.deaths += 1;
    this.state = "dead";
    this.deathTimer = DEATH_PAUSE;
  }

  private clearRoom(): void {
    this.state = "clear";
    this.sfx.complete();
    this.particles.burst(this.doorX, FLOOR_Y - 90, "#ffe07a", 26, 300);

    const previous = this.save.best[this.room.id];
    if (previous === undefined || this.deaths < previous.deaths) {
      this.save.best[this.room.id] = { deaths: this.deaths };
    }
    this.save.unlocked = Math.min(ROOM_LIST.length - 1, Math.max(this.save.unlocked, this.roomIndex + 1));
    persist(this.save);
  }

  /* ------------------------------------------------------------------ render */

  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (this.state === "loading") {
      this.drawLoading();
      return;
    }
    if (this.loadError) {
      this.drawError();
      return;
    }

    this.backdrop.draw(ctx, 0, 0, this.elapsed, VIEW_H);

    // the void under the floor: gaps must read as depth, not sky
    const abyss = ctx.createLinearGradient(0, 588, 0, 760);
    abyss.addColorStop(0, "rgba(26,38,52,0.15)");
    abyss.addColorStop(0.14, "rgba(20,30,42,0.95)");
    abyss.addColorStop(1, "#060a10");
    ctx.fillStyle = abyss;
    ctx.fillRect(0, 588, VIEW_W, VIEW_H - 588);

    for (const d of this.room.decor) {
      const height = d.h ?? this.assets.size(d.kind).h;
      this.assets.drawAnchored(ctx, d.kind, d.x, d.y, height);
    }

    for (const p of this.platforms) this.painter.draw(ctx, p);

    this.drawDoor(ctx);
    for (const trap of this.traps) trap.draw(ctx, this.assets, this.elapsed);
    this.drawPlayer(ctx);
    this.particles.draw(ctx);

    drawVignette(ctx);

    if (this.state !== "title" && this.state !== "victory") {
      drawHud(ctx, this.hudModel());
    }

    if (this.state === "title") this.drawTitle();
    if (this.state === "paused") this.drawPause();
    if (this.state === "clear") this.drawClear();
    if (this.state === "victory") this.drawVictory();
    if (this.state === "dead") this.drawDeathFlash();
  }

  private drawDoor(ctx: CanvasRenderingContext2D): void {
    if (!this.doorHidden) {
      ctx.save();
      ctx.shadowColor = "rgba(255,214,120,0.7)";
      ctx.shadowBlur = 22 + Math.sin(this.elapsed * 3) * 6;
      this.assets.drawAnchored(ctx, "door", this.doorX, FLOOR_Y + 4, 190);
      ctx.restore();
    }
    if (this.decoyX !== null) {
      ctx.save();
      ctx.globalAlpha = 0.96;
      this.assets.drawAnchored(ctx, "door", this.decoyX, FLOOR_Y + 4, 190);
      ctx.restore();
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D): void {
    const p = this.player;
    const anim = p.animation();
    const cx = p.centerX();
    const feet = p.bottom() + 4;

    if (!p.dead) {
      ctx.save();
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = "#0b1018";
      ctx.beginPath();
      ctx.ellipse(cx, p.bottom() + 2, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    if (p.dead) {
      const k = clamp((1.15 - p.deathTimer) * 2.2, 0, 1.4);
      ctx.translate(cx, feet);
      ctx.rotate(k * (p.facing > 0 ? 1 : -1));
      ctx.translate(-cx, -feet);
      ctx.globalAlpha = clamp(p.deathTimer / 1.15, 0, 1);
    }
    this.assets.drawPlayerFrame(ctx, anim.state, anim.frame, cx, feet, PLAYER_DRAW_HEIGHT, p.facing < 0);
    ctx.restore();
  }

  private hudModel(): HudModel {
    return {
      roomName: this.room.name,
      roomIndex: this.roomIndex,
      roomCount: ROOM_LIST.length,
      deaths: this.deaths,
      hint: this.room.hint,
      hintTimer: this.hintTimer,
      taunt: this.taunt,
      tauntTimer: this.tauntTimer,
      touchMode: this.input.touchMode,
      paused: this.state === "paused",
    };
  }

  /* ------------------------------------------------------------------ screens */

  private drawTitle(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = "rgba(6,10,16,0.44)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const halo = ctx.createRadialGradient(640, 300, 60, 640, 300, 540);
    halo.addColorStop(0, "rgba(6,10,16,0.78)");
    halo.addColorStop(1, "rgba(6,10,16,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 20;
    ctx.font = '800 92px system-ui, sans-serif';
    ctx.fillStyle = "#f7fbff";
    ctx.fillText("TRAP GAME", 640, 186);

    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillStyle = "rgba(255,222,150,0.95)";
    ctx.fillText("EVERY DOOR LIES", 640, 242);

    ctx.font = '500 17px system-ui, sans-serif';
    ctx.fillStyle = "rgba(226,238,252,0.82)";
    ctx.fillText("Ten rooms. One door each. The ruins cheat — expect it.", 640, 284);

    const startX = 640 - ((ROOM_LIST.length - 1) * 40) / 2;
    for (let i = 0; i < ROOM_LIST.length; i++) {
      const x = startX + i * 40;
      const unlocked = i <= this.save.unlocked;
      const selected = i === this.titlePick;
      ctx.beginPath();
      ctx.arc(x, 340, selected ? 13 : 9, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#ffe07a" : unlocked ? "rgba(160,215,255,0.85)" : "rgba(255,255,255,0.16)";
      ctx.fill();
      if (selected) {
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    const best = this.save.best[ROOM_LIST[this.titlePick]!.id];
    ctx.font = '600 15px system-ui, sans-serif';
    ctx.fillStyle = "rgba(210,228,246,0.8)";
    ctx.fillText(
      `Room ${this.titlePick + 1} — ${ROOM_LIST[this.titlePick]!.name}` +
        (best ? `   ·   best ${best.deaths} death${best.deaths === 1 ? "" : "s"}` : ""),
      640,
      374,
    );

    ctx.globalAlpha = 0.65 + Math.sin(this.elapsed * 2.6) * 0.35;
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillStyle = "#ffe9a8";
    ctx.fillText(this.input.touchMode ? "TAP TO PLAY" : "PRESS ENTER TO PLAY", 640, 432);
    ctx.globalAlpha = 1;

    ctx.font = '500 15px system-ui, sans-serif';
    ctx.fillStyle = "rgba(190,208,228,0.72)";
    ctx.fillText("← → move   ·   SPACE jump   ·   R restart   ·   P pause   ·   M sound", 640, 480);
    ctx.restore();
  }

  private drawPause(): void {
    drawPanel(this.ctx, {
      title: "Paused",
      subtitle: this.room.name,
      lines: [`Deaths this room: ${this.deaths}`],
      footer: this.input.touchMode ? "Tap the pause button to resume" : "P / ENTER resume   ·   R restart room",
    });
  }

  private drawClear(): void {
    const best = this.save.best[this.room.id];
    drawPanel(this.ctx, {
      title: "Room Cleared",
      subtitle: this.room.name,
      accent: "rgba(255,214,120,0.5)",
      lines: [`Deaths ${this.deaths}`, best ? `Best ${best.deaths}` : ""].filter(Boolean),
      footer: this.input.touchMode ? "Tap to continue" : "Press ENTER for the next room",
    });
  }

  private drawVictory(): void {
    drawPanel(this.ctx, {
      title: "You Beat The Ruins",
      subtitle: "Every trap, every lie, every door.",
      accent: "rgba(160,255,200,0.45)",
      lines: [`Rooms ${ROOM_LIST.length}`, "The ruins will remember you. Probably not fondly."],
      footer: this.input.touchMode ? "Tap to return to the title" : "Press ENTER to return to the title",
    });
  }

  private drawDeathFlash(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = `rgba(120,20,26,${0.22 * (this.deathTimer / DEATH_PAUSE)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.globalAlpha = clamp(this.deathTimer / DEATH_PAUSE, 0, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillStyle = "rgba(255,210,200,0.95)";
    ctx.fillText("TRY AGAIN", 640, 330);
    ctx.restore();
  }

  private drawLoading(): void {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, "#0f1621");
    g.addColorStop(1, "#0a0e15");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillStyle = "#e9f2fc";
    ctx.fillText("TRAP GAME", 640, 320);

    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(490, 372, 300, 8);
    ctx.fillStyle = "#7fd0ff";
    ctx.fillRect(490, 372, 300 * this.loadProgress, 8);

    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillStyle = "rgba(170,195,220,0.8)";
    ctx.fillText(`Setting the traps… ${Math.round(this.loadProgress * 100)}%`, 640, 402);
  }

  private drawError(): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#160d10";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillStyle = "#ffb4a8";
    ctx.fillText("Could not load the game assets", 640, 330);
    ctx.font = '500 15px system-ui, sans-serif';
    ctx.fillStyle = "rgba(255,220,215,0.8)";
    ctx.fillText(this.loadError, 640, 366);
    ctx.fillText("Run: python3 tools/extract_assets.py", 640, 396);
  }
}
