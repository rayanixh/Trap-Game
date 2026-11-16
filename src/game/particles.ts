type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  drag: number;
  glow: boolean;
};

const MAX_PARTICLES = 420;

/** Lightweight pooled particle system; everything is drawn in world space. */
export class Particles {
  private items: Particle[] = [];

  private push(p: Particle): void {
    if (this.items.length >= MAX_PARTICLES) this.items.shift();
    this.items.push(p);
  }

  clear(): void {
    this.items.length = 0;
  }

  dust(x: number, y: number, count = 6, spread = 90): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * spread;
      this.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.5 - 20,
        life: 0.32 + Math.random() * 0.3,
        max: 0.62,
        size: 3 + Math.random() * 4,
        color: "rgba(226,233,240,0.75)",
        gravity: 120,
        drag: 2.4,
        glow: false,
      });
    }
  }

  burst(x: number, y: number, color: string, count = 12, speed = 210): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.35,
        max: 0.75,
        size: 2.5 + Math.random() * 3.5,
        color,
        gravity: 320,
        drag: 1.4,
        glow: true,
      });
    }
  }

  sparkle(x: number, y: number, color = "#ffdc6b"): void {
    for (let i = 0; i < 3; i++) {
      this.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y + (Math.random() - 0.5) * 16,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 60,
        life: 0.35,
        max: 0.35,
        size: 2 + Math.random() * 2,
        color,
        gravity: -20,
        drag: 1,
        glow: true,
      });
    }
  }

  trail(x: number, y: number, color: string): void {
    this.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -10 - Math.random() * 20,
      life: 0.3,
      max: 0.3,
      size: 2 + Math.random() * 2,
      color,
      gravity: 0,
      drag: 1.5,
      glow: true,
    });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.items) {
      const t = Math.max(0, p.life / p.max);
      ctx.globalAlpha = t;
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
      } else {
        ctx.shadowBlur = 0;
      }
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + t * 0.9);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();
  }
}
