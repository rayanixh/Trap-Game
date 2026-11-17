import type { Assets } from "../core/assets";
import { hash01 } from "../core/types";
import type { Rect } from "../core/types";

/** Sky, distant ruins and cloud banks, drawn with parallax in screen space. */
export class Backdrop {
  private clouds: { x: number; y: number; s: number; speed: number }[] = [];
  private ruins: { x: number; w: number; h: number; inner: number[] }[] = [];
  private hills: { x: number; h: number; w: number }[] = [];

  constructor() {
    for (let i = 0; i < 26; i++) {
      this.clouds.push({
        x: hash01(i * 3.7) * 4200,
        y: 40 + hash01(i * 9.1) * 190,
        s: 0.55 + hash01(i * 5.3) * 0.9,
        speed: 3 + hash01(i * 2.1) * 7,
      });
    }
    for (let i = 0; i < 22; i++) {
      const w = 90 + hash01(i * 11.3) * 150;
      this.ruins.push({
        x: i * 260 + hash01(i * 4.9) * 90,
        w,
        h: 120 + hash01(i * 7.7) * 220,
        inner: [hash01(i * 13.1), hash01(i * 17.3), hash01(i * 19.7)],
      });
    }
    for (let i = 0; i < 18; i++) {
      this.hills.push({ x: i * 420 + hash01(i * 2.3) * 120, h: 90 + hash01(i * 6.1) * 120, w: 520 });
    }
  }

  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number, viewH: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, viewH);
    sky.addColorStop(0, "#8fd0ee");
    sky.addColorStop(0.45, "#bfe6f7");
    sky.addColorStop(1, "#e9f6fb");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, viewH);

    // sun bloom
    const glow = ctx.createRadialGradient(1050, 120, 10, 1050, 120, 380);
    glow.addColorStop(0, "rgba(255,247,214,0.75)");
    glow.addColorStop(1, "rgba(255,247,214,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1280, viewH);

    // clouds
    for (const c of this.clouds) {
      const x = ((c.x - camX * 0.1 + time * c.speed) % 4400 + 4400) % 4400 - 300;
      this.cloud(ctx, x, c.y - camY * 0.05, 92 * c.s);
    }

    // far ruins, clipped to above the horizon so they read as distant towers
    const horizon = 520 - camY * 0.12;
    const ruinOffset = camX * 0.18;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 1280, horizon);
    ctx.clip();
    for (const r of this.ruins) {
      const x = r.x - ruinOffset;
      if (x + r.w < -80 || x > 1360) continue;
      const baseY = horizon + 12;
      ctx.fillStyle = "rgba(163,193,208,0.5)";
      ctx.fillRect(x, baseY - r.h, r.w, r.h);
      // roof cap, parapet blocks and a couple of window slots
      ctx.fillStyle = "rgba(140,172,190,0.55)";
      ctx.fillRect(x - 6, baseY - r.h - 10, r.w + 12, 12);
      for (let m = 0; m < 3; m++) {
        const mw = r.w * 0.14;
        ctx.fillRect(x + r.w * (0.1 + m * 0.3), baseY - r.h - 22, mw, 12);
      }
      ctx.fillStyle = "rgba(255,255,255,0.20)";
      ctx.fillRect(x + r.w * 0.68, baseY - r.h * 0.86, r.w * 0.14, r.h * 0.3);
      ctx.fillRect(x + r.w * 0.2, baseY - r.h * 0.58, r.w * 0.12, r.h * 0.24);
      ctx.fillStyle = "rgba(150,183,199,0.28)";
      ctx.fillRect(x, baseY - r.h * 0.2, r.w, r.h * 0.2);
    }
    // near hills, also above the horizon
    const hillOffset = camX * 0.34;
    for (const h of this.hills) {
      const x = h.x - hillOffset;
      if (x + h.w < -120 || x > 1400) continue;
      const baseY = horizon + 6;
      ctx.fillStyle = "rgba(126,171,142,0.42)";
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.quadraticCurveTo(x + h.w * 0.5, baseY - h.h, x + h.w, baseY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // horizon haze line
    const line = ctx.createLinearGradient(0, horizon - 40, 0, horizon + 20);
    line.addColorStop(0, "rgba(233,246,251,0)");
    line.addColorStop(1, "rgba(233,246,251,0.55)");
    ctx.fillStyle = line;
    ctx.fillRect(0, horizon - 40, 1280, 60);

    // haze so the play field reads clearly
    const haze = ctx.createLinearGradient(0, 360, 0, viewH);
    haze.addColorStop(0, "rgba(233,246,251,0)");
    haze.addColorStop(1, "rgba(233,246,251,0.35)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, 1280, viewH);
  }

  private cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "#ffffff";
    const puffs: [number, number, number][] = [
      [0, 0, 34],
      [30, -12, 42],
      [66, 2, 30],
      [-28, 6, 24],
      [40, 14, 26],
    ];
    for (const [dx, dy, r] of puffs) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Paints solid platforms out of the stone body and a continuous grass surface. */
export class PlatformPainter {
  private stonePattern: CanvasPattern | null = null;
  private ledgePattern: CanvasPattern | null = null;
  private ledgeH = 56;

  constructor(private assets: Assets) {}

  prepare(ctx: CanvasRenderingContext2D): void {
    this.stonePattern = ctx.createPattern(this.assets.tileImage(), "repeat");
    const ledge = this.assets.ledgeImage();
    this.ledgePattern = ctx.createPattern(ledge.img, "repeat");
    this.ledgeH = ledge.h;
  }

  draw(ctx: CanvasRenderingContext2D, rect: Rect): void {
    const overshoot = 46;
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y - overshoot, rect.w, rect.h + overshoot);
    ctx.clip();

    ctx.fillStyle = "#22262f";
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    if (this.stonePattern) {
      ctx.save();
      ctx.translate(rect.x, rect.y);
      ctx.fillStyle = this.stonePattern;
      ctx.fillRect(0, 0, rect.w, rect.h);
      ctx.restore();
    }

    // continuous grass surface, its top edge flush with the collision line so
    // the player stands on the grass instead of sinking into it
    if (this.ledgePattern) {
      ctx.save();
      ctx.translate(rect.x, rect.y);
      ctx.fillStyle = this.ledgePattern;
      ctx.fillRect(0, 0, rect.w, this.ledgeH);
      ctx.restore();
    }

    // depth: shade towards the bottom of the block
    const shade = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(6,10,16,0.42)");
    ctx.fillStyle = shade;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // crisp floor line where the player stands
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(rect.x, rect.y, rect.w, 2);
    ctx.restore();
  }
}
