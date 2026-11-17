type SpriteRect = { x: number; y: number; w: number; h: number };

type AtlasInfo = {
  image: string;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  animations: Record<string, [number, number][]>;
};

type TileInfo = { image: string; w: number; h: number };

type Manifest = {
  player: AtlasInfo;
  kit: TileInfo;
  tile: TileInfo;
  ledge: TileInfo;
  sprites: Record<string, SpriteRect>;
};

export type AnimName = "idle" | "run" | "jump" | "land";

/**
 * Every visual comes from the two hand-drawn sheets, sliced and packed by
 * tools/extract_assets.py. Two images cover the whole kit, so the game boots
 * from three requests total.
 */
export class Assets {
  private manifest!: Manifest;
  private kit!: HTMLImageElement;
  private tile!: HTMLImageElement;
  private ledge!: HTMLImageElement;
  private playerImage!: HTMLImageElement;

  async load(onProgress: (fraction: number) => void): Promise<void> {
    const res = await fetch("/assets/manifest.json");
    if (!res.ok) throw new Error(`manifest.json returned ${res.status}`);
    this.manifest = (await res.json()) as Manifest;

    const files = [
      `/assets/${this.manifest.kit.image}`,
      `/assets/${this.manifest.tile.image}`,
      `/assets/${this.manifest.ledge.image}`,
      `/assets/${this.manifest.player.image}`,
    ];
    let done = 0;
    const images = await Promise.all(
      files.map(async (src) => {
        const img = await loadImage(src);
        done += 1;
        onProgress(done / files.length);
        return img;
      }),
    );
    this.kit = images[0]!;
    this.tile = images[1]!;
    this.ledge = images[2]!;
    this.playerImage = images[3]!;
  }

  /** Natural size of a kit sprite. */
  size(name: string): { w: number; h: number } {
    const rect = this.manifest.sprites[name];
    if (!rect) throw new Error(`unknown sprite "${name}"`);
    return { w: rect.w, h: rect.h };
  }

  /** The repeating stone tile, used to build a fill pattern. */
  tileImage(): HTMLImageElement {
    return this.tile;
  }

  /** Continuous grass-and-brick surface used along the top of every platform. */
  ledgeImage(): { img: HTMLImageElement; w: number; h: number } {
    return { img: this.ledge, w: this.manifest.ledge.w, h: this.manifest.ledge.h };
  }

  get player(): AtlasInfo {
    return this.manifest.player;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    name: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    alpha = 1,
  ): void {
    const s = this.manifest.sprites[name];
    if (!s) throw new Error(`unknown sprite "${name}"`);
    const dw = w ?? s.w;
    const dh = h ?? s.h;
    const prev = ctx.globalAlpha;
    if (alpha !== 1) ctx.globalAlpha = prev * alpha;
    ctx.drawImage(this.kit, s.x, s.y, s.w, s.h, x, y, dw, dh);
    ctx.globalAlpha = prev;
  }

  /** Draw a sprite with its bottom-centre at (cx, bottomY). */
  drawAnchored(
    ctx: CanvasRenderingContext2D,
    name: string,
    cx: number,
    bottomY: number,
    height: number,
    flip = false,
    alpha = 1,
  ): void {
    const s = this.manifest.sprites[name];
    if (!s) throw new Error(`unknown sprite "${name}"`);
    const scale = height / s.h;
    const w = s.w * scale;
    const prev = ctx.globalAlpha;
    if (alpha !== 1) ctx.globalAlpha = prev * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.kit, s.x, s.y, s.w, s.h, -w / 2, bottomY - height, w, height);
      ctx.restore();
    } else {
      ctx.drawImage(this.kit, s.x, s.y, s.w, s.h, cx - w / 2, bottomY - height, w, height);
    }
    ctx.globalAlpha = prev;
  }

  drawPlayerFrame(
    ctx: CanvasRenderingContext2D,
    anim: AnimName,
    frame: number,
    cx: number,
    feetY: number,
    heightPx: number,
    flip: boolean,
  ): void {
    const frames = this.player.animations[anim];
    if (!frames || frames.length === 0) throw new Error(`no animation "${anim}"`);
    const [col, row] = frames[Math.abs(frame) % frames.length]!;
    const sx = col * this.player.cellWidth;
    const sy = row * this.player.cellHeight;
    const sw = this.player.cellWidth;
    const sh = this.player.cellHeight;
    const scale = heightPx / sh;
    const w = sw * scale;
    if (flip) {
      ctx.save();
      ctx.translate(cx, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(this.playerImage, sx, sy, sw, sh, -w / 2, feetY - heightPx, w, heightPx);
      ctx.restore();
    } else {
      ctx.drawImage(this.playerImage, sx, sy, sw, sh, cx - w / 2, feetY - heightPx, w, heightPx);
    }
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}
