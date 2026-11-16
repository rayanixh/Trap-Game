export type Action = "left" | "right" | "jump" | "up" | "down" | "pause" | "restart" | "mute" | "confirm";

const KEY_MAP: Record<string, Action[]> = {
  ArrowLeft: ["left"],
  KeyA: ["left"],
  ArrowRight: ["right"],
  KeyD: ["right"],
  ArrowUp: ["up", "jump"],
  KeyW: ["up", "jump"],
  Space: ["jump"],
  KeyZ: ["jump"],
  ArrowDown: ["down"],
  KeyS: ["down"],
  Escape: ["pause"],
  KeyP: ["pause"],
  KeyR: ["restart"],
  KeyM: ["mute"],
  Enter: ["confirm"],
  NumpadEnter: ["confirm"],
};

type TouchKey = "left" | "right" | "jump";
type TouchButton = { key: TouchKey; x: number; y: number; r: number };

const TOUCH_LAYOUT: TouchButton[] = [
  { key: "left", x: 108, y: 636, r: 58 },
  { key: "right", x: 246, y: 636, r: 58 },
  { key: "jump", x: 1172, y: 628, r: 74 },
];

export class Input {
  private heldCodes = new Set<string>();
  private pressedCodes = new Set<string>();
  private touchHeld = new Set<TouchKey>();
  private touchPressed = new Set<TouchKey>();

  /** True once a touch/pen pointer has been seen, so we can show thumb controls. */
  touchMode = false;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener("keydown", (e) => {
      if (e.repeat) {
        if (KEY_MAP[e.code]?.includes("jump")) e.preventDefault();
        return;
      }
      if (KEY_MAP[e.code]) {
        this.heldCodes.add(e.code);
        this.pressedCodes.add(e.code);
        if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
      }
    });

    window.addEventListener("keyup", (e) => {
      this.heldCodes.delete(e.code);
    });

    window.addEventListener("blur", () => {
      this.heldCodes.clear();
      this.touchHeld.clear();
    });

    const active = new Map<number, TouchKey>();
    const resolve = (ev: PointerEvent): TouchKey | null => {
      const p = this.toLogical(ev);
      for (const btn of TOUCH_LAYOUT) {
        const dx = p.x - btn.x;
        const dy = p.y - btn.y;
        if (dx * dx + dy * dy <= btn.r * btn.r * 1.35) return btn.key;
      }
      return null;
    };

    canvas.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") this.touchMode = true;
      const key = resolve(e);
      if (!key) return;
      e.preventDefault();
      active.set(e.pointerId, key);
      if (!this.touchHeld.has(key)) this.touchPressed.add(key);
      this.touchHeld.add(key);
      canvas.setPointerCapture?.(e.pointerId);
    });

    const release = (e: PointerEvent) => {
      const key = active.get(e.pointerId);
      if (!key) return;
      active.delete(e.pointerId);
      // another finger may still be holding the same button
      if (![...active.values()].includes(key)) this.touchHeld.delete(key);
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("pointerleave", release);
  }

  /** Convert a DOM pointer event into the canvas' logical (1280x720) space. */
  toLogical(ev: PointerEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((ev.clientX - rect.left) / rect.width) * 1280,
      y: ((ev.clientY - rect.top) / rect.height) * 720,
    };
  }

  /** Pointer position in logical space, for menus. */
  pointer(ev: PointerEvent): { x: number; y: number } {
    return this.toLogical(ev);
  }

  touchButtonPositions(): TouchButton[] {
    return TOUCH_LAYOUT;
  }

  private codesFor(action: Action): string[] {
    return Object.keys(KEY_MAP).filter((code) => KEY_MAP[code]!.includes(action));
  }

  held(action: Action): boolean {
    for (const code of this.codesFor(action)) if (this.heldCodes.has(code)) return true;
    if (action === "left") return this.touchHeld.has("left");
    if (action === "right") return this.touchHeld.has("right");
    if (action === "jump" || action === "up") return this.touchHeld.has("jump");
    return false;
  }

  justPressed(action: Action): boolean {
    for (const code of this.codesFor(action)) if (this.pressedCodes.has(code)) return true;
    if (action === "left") return this.touchPressed.has("left");
    if (action === "right") return this.touchPressed.has("right");
    if (action === "jump" || action === "up") return this.touchPressed.has("jump");
    return false;
  }

  /** Call at the end of every simulation tick. */
  endTick(): void {
    this.pressedCodes.clear();
    this.touchPressed.clear();
  }

  /** Horizontal intent in -1..1. */
  axis(): number {
    return (this.held("right") ? 1 : 0) - (this.held("left") ? 1 : 0);
  }
}
