import type { Assets } from "../core/assets";
import type { Rect } from "../core/types";
import { FLOOR_Y, type TrapDef } from "./rooms";

type Phase = "idle" | "arming" | "fire" | "hold" | "retract" | "done";

const SPIKE_H = 52;
const CRUSHER_H = 92;
const SAW_W = 132;
const SAW_H = 46;

/** One hidden hazard, with its own little state machine. */
export class TrapRun {
  phase: Phase = "idle";
  /** Vertical offset (falling traps) or x position (saw). */
  pos = 0;
  /** True only on the frame the trap springs, so the room can react. */
  justFired = false;

  private timer = 0;
  private vel = 0;

  constructor(
    readonly def: TrapDef,
    readonly index: number,
  ) {
    this.reset();
  }

  reset(): void {
    this.phase = "idle";
    this.timer = 0;
    this.vel = 0;
    this.justFired = false;
    this.pos = this.def.kind === "saw" ? this.def.x : 0;
  }

  /** Height of the fallen wall block, used once it has landed. */
  get wallHeight(): number {
    return FLOOR_Y - (this.def.to ?? FLOOR_Y);
  }

  update(dt: number, playerX: number): void {
    this.justFired = false;
    const d = this.def;

    switch (this.phase) {
      case "idle":
        if (playerX > d.triggerX) {
          this.phase = "arming";
          this.timer = d.delay ?? 0.08;
        }
        break;

      case "arming":
        this.timer -= dt;
        if (this.timer <= 0) {
          this.phase = "fire";
          this.vel = 0;
          this.justFired = true;
          if (d.kind === "floorFall" || d.kind === "doorShift" || d.kind === "fakeDoor") {
            this.phase = "done";
          }
        }
        break;

      case "fire": {
        if (d.kind === "spikesDrop") {
          this.vel += 3200 * dt;
          this.pos += this.vel * dt;
          const limit = FLOOR_Y - SPIKE_H;
          if (this.pos >= limit) {
            this.pos = limit;
            this.phase = "hold";
            this.timer = d.hold ?? 1.2;
          }
        } else if (d.kind === "spikesPop") {
          this.pos += 1100 * dt;
          if (this.pos >= SPIKE_H) {
            this.pos = SPIKE_H;
            this.phase = "hold";
            this.timer = d.hold ?? 0.9;
          }
        } else if (d.kind === "crusher") {
          this.pos += 1000 * dt;
          const limit = FLOOR_Y - CRUSHER_H;
          if (this.pos >= limit) {
            this.pos = limit;
            this.phase = "hold";
            this.timer = d.hold ?? 0.8;
          }
        } else if (d.kind === "saw") {
          const target = d.to ?? d.x - 900;
          const dir = target < this.pos ? -1 : 1;
          this.pos += (d.speed ?? 480) * dir * dt;
          if (dir === -1 ? this.pos <= target : this.pos >= target) this.phase = "done";
        } else if (d.kind === "wall") {
          const target = d.to ?? 420;
          this.pos += 1200 * dt;
          if (this.pos >= target) {
            this.pos = target;
            this.phase = "done";
          }
        }
        break;
      }

      case "hold":
        this.timer -= dt;
        if (this.timer <= 0) this.phase = "retract";
        break;

      case "retract": {
        const speed = d.kind === "crusher" ? 460 : 560;
        this.pos -= speed * dt;
        if (this.pos <= 0) {
          this.pos = 0;
          this.phase = "done";
        }
        break;
      }

      case "done":
        break;
    }
  }

  /** Volume that kills the player this frame, if any. */
  hazard(): Rect | null {
    const d = this.def;
    if (this.phase === "idle" || this.phase === "arming" || this.phase === "done") return null;

    if (d.kind === "spikesDrop" && this.pos > 4) {
      return { x: d.x + 4, y: this.pos + 6, w: d.w - 8, h: SPIKE_H - 10 };
    }
    if (d.kind === "spikesPop" && this.pos > 10) {
      return { x: d.x + 6, y: FLOOR_Y - this.pos, w: d.w - 12, h: this.pos - 4 };
    }
    if (d.kind === "crusher") {
      return { x: d.x + 6, y: this.pos + 6, w: d.w - 12, h: CRUSHER_H - 10 };
    }
    if (d.kind === "saw") {
      return { x: this.pos + 8, y: FLOOR_Y - SAW_H + 4, w: SAW_W - 16, h: SAW_H - 8 };
    }
    if (d.kind === "wall" && this.phase === "fire") {
      return { x: d.x, y: this.pos, w: d.w, h: this.wallHeight };
    }
    return null;
  }

  /** A landed wall becomes part of the level, so you can stand on it. */
  solid(): Rect | null {
    if (this.def.kind !== "wall") return null;
    if (this.phase !== "done") return null;
    return { x: this.def.x, y: this.def.to ?? 420, w: this.def.w, h: this.wallHeight };
  }

  /** The floor tile this trap removes, if it is a collapsing floor. */
  loftedFloor(): Rect | null {
    if (this.def.kind !== "floorFall" || this.phase !== "done") return null;
    return { x: this.def.x, y: FLOOR_Y, w: this.def.w, h: 40 };
  }

  draw(ctx: CanvasRenderingContext2D, assets: Assets, time: number): void {
    const d = this.def;

    if (d.kind === "spikesDrop") {
      const y = this.phase === "idle" || this.phase === "arming" ? -SPIKE_H + 8 : this.pos;
      ctx.save();
      ctx.translate(d.x, y + SPIKE_H);
      ctx.scale(1, -1);
      assets.draw(ctx, "spikes-long", 0, 0, d.w, SPIKE_H);
      ctx.restore();
      // ceiling mount
      ctx.fillStyle = "rgba(32,38,48,0.85)";
      ctx.fillRect(d.x, 0, d.w, 10);
    } else if (d.kind === "spikesPop") {
      if (this.pos > 0) {
        assets.draw(ctx, "spikes-long", d.x, FLOOR_Y - this.pos, d.w, this.pos);
      }
    } else if (d.kind === "crusher") {
      // The slab waits just out of frame, hanging from a short chain.
      const idle = this.phase === "idle" || this.phase === "arming";
      const y = idle ? -CRUSHER_H + 14 : this.pos;
      const cx = d.x + d.w / 2;
      ctx.save();
      ctx.fillStyle = "rgba(58,66,80,0.55)";
      ctx.fillRect(cx - 2, 0, 4, Math.max(0, y) + 4);
      ctx.fillStyle = "rgba(32,38,48,0.85)";
      ctx.fillRect(cx - 18, 0, 36, 12);
      ctx.restore();
      assets.draw(ctx, "stone-block", d.x, y, d.w, CRUSHER_H);
    } else if (d.kind === "saw") {
      const bob = Math.sin(time * 10) * 1.2;
      ctx.save();
      ctx.shadowColor = "rgba(200,230,255,0.4)";
      ctx.shadowBlur = 10;
      assets.draw(ctx, "saw", this.pos, FLOOR_Y - SAW_H + bob, SAW_W, SAW_H);
      ctx.restore();
    } else if (d.kind === "wall") {
      const y = this.phase === "idle" || this.phase === "arming" ? -this.wallHeight + 6 : this.pos;
      assets.draw(ctx, "stone-block", d.x, y, d.w, this.wallHeight);
    }
  }
}
