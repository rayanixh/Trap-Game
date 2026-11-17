import "./style.css";
import { Game } from "./game/game";

const LOGICAL_W = 1280;
const LOGICAL_H = 720;
const STEP = 1 / 60;

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("#game canvas missing");

const ctx = canvas.getContext("2d", { alpha: false });
if (!ctx) throw new Error("2D canvas context unavailable");

let scale = 1;

/** Keep the backing store matched to the displayed size for crisp art. */
function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas!.clientWidth || LOGICAL_W;
  // Cap the backing store: past ~1920px the extra pixels cost more than they show.
  const width = Math.min(1920, Math.max(640, Math.round(cssWidth * dpr)));
  canvas!.width = width;
  canvas!.height = Math.round((width * LOGICAL_H) / LOGICAL_W);
  scale = canvas!.width / LOGICAL_W;
}

resize();
window.addEventListener("resize", resize);

const game = new Game(ctx, canvas);

let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  accumulator += elapsed;

  let guard = 0;
  while (accumulator >= STEP && guard < 8) {
    game.tick(STEP);
    accumulator -= STEP;
    guard++;
  }
  if (guard === 8) accumulator = 0;

  ctx!.setTransform(scale, 0, 0, scale, 0, 0);
  game.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
