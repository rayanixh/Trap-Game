const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export type HudModel = {
  roomName: string;
  roomIndex: number;
  roomCount: number;
  deaths: number;
  hint: string;
  hintTimer: number;
  taunt: string;
  tauntTimer: number;
  touchMode: boolean;
  paused: boolean;
};

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 700,
  align: CanvasTextAlign = "left",
): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(value, x, y);
}

export function drawHud(ctx: CanvasRenderingContext2D, m: HudModel): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;

  // room label
  text(ctx, `ROOM ${m.roomIndex + 1} / ${m.roomCount}`, 34, 38, 13, "rgba(190,215,240,0.8)");
  text(ctx, m.roomName.toUpperCase(), 34, 64, 22, "#f2f8ff", 800);
  if (m.deaths > 0) {
    text(ctx, `deaths ${m.deaths}`, 34, 92, 13, "rgba(255,180,168,0.85)",
      600);
  }

  // controls reminder, right
  text(ctx, "R restart   ·   P pause   ·   M sound", 1246, 40, 12, "rgba(255,255,255,0.55)", 600, "right");
  ctx.restore();

  if (m.hintTimer > 0) {
    const alpha = Math.min(1, m.hintTimer / 0.7);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `600 17px ${FONT}`;
    ctx.textAlign = "center";
    const w = ctx.measureText(m.hint).width + 48;
    roundRect(ctx, 640 - w / 2, 646, w, 42, 12);
    ctx.fillStyle = "rgba(9,14,22,0.75)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.stroke();
    ctx.fillStyle = "rgba(238,246,255,0.95)";
    ctx.textBaseline = "middle";
    ctx.fillText(m.hint, 640, 668);
    ctx.restore();
  }

  if (m.tauntTimer > 0) {
    ctx.save();
    const t = Math.min(1, m.tauntTimer / 0.4);
    ctx.globalAlpha = t;
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = "center";
    const w = ctx.measureText(m.taunt).width + 60;
    roundRect(ctx, 640 - w / 2, 132, w, 54, 14);
    ctx.fillStyle = "rgba(126,28,36,0.9)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,190,180,0.45)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#ffe9e3";
    ctx.textBaseline = "middle";
    ctx.fillText(m.taunt, 640, 160);
    ctx.restore();
  }

  if (m.touchMode && !m.paused) {
    ctx.save();
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const buttons: [number, number, number, string][] = [
      [108, 636, 58, "◀"],
      [246, 636, 58, "▶"],
      [1172, 628, 74, "▲"],
    ];
    for (const [x, y, r, glyph] of buttons) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(10,16,24,0.34)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.fillText(glyph, x, y + 1);
    }
    roundRect(ctx, 1176, 24, 64, 40, 10);
    ctx.fillStyle = "rgba(10,16,24,0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("II", 1208, 45);
    ctx.restore();
  }
}

export type PanelModel = {
  title: string;
  subtitle?: string;
  lines?: string[];
  footer?: string;
  accent?: string;
};

export function drawPanel(ctx: CanvasRenderingContext2D, p: PanelModel): void {
  ctx.save();
  ctx.fillStyle = "rgba(6,9,15,0.66)";
  ctx.fillRect(0, 0, 1280, 720);

  const lineCount = p.lines?.length ?? 0;
  const w = 660;
  const h = 236 + lineCount * 30 + (p.subtitle ? 34 : 0);
  const x = 640 - w / 2;
  const y = 360 - h / 2;
  roundRect(ctx, x, y, w, h, 22);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, "rgba(26,34,46,0.98)");
  g.addColorStop(1, "rgba(12,17,25,0.98)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = p.accent ?? "rgba(120,200,255,0.3)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 44px ${FONT}`;
  ctx.fillStyle = "#f2f7ff";
  ctx.fillText(p.title, 640, y + 74);

  let cursor = y + 118;
  if (p.subtitle) {
    ctx.font = `500 18px ${FONT}`;
    ctx.fillStyle = "rgba(190,208,228,0.85)";
    ctx.fillText(p.subtitle, 640, cursor);
    cursor += 34;
  }
  if (p.lines) {
    ctx.font = `600 17px ${FONT}`;
    for (const line of p.lines) {
      ctx.fillStyle = "rgba(220,233,247,0.92)";
      ctx.fillText(line, 640, cursor);
      cursor += 30;
    }
  }
  if (p.footer) {
    ctx.font = `700 15px ${FONT}`;
    ctx.fillStyle = "rgba(150,200,255,0.92)";
    ctx.fillText(p.footer, 640, y + h - 34);
  }
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(640, 360, 320, 640, 360, 800);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(4,8,14,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1280, 720);
}
