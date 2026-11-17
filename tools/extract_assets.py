#!/usr/bin/env python3
"""
Derive game-ready assets from the two hand-drawn SVG sheets in the repo root.

The source sheets are each a single base64 PNG wrapped in <svg><image>. This
script:

  1. extracts the embedded PNGs,
  2. slices the player contact sheet into one uniform animation atlas,
  3. cuts the environment kit into individual sprites, removing the baked
     checkerboard by flood-filling only background connected to the outside,
  4. packs those sprites into a single kit atlas (one HTTP request in game),
  5. writes review copies into docs/asset-preview/ with a contact sheet.

Run:  python3 tools/extract_assets.py
Ship: public/assets/{player-atlas,kit-atlas,stone-tile}.png + manifest.json
"""

from __future__ import annotations

import base64
import io
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SHIP = ROOT / "public" / "assets"
REVIEW = ROOT / "docs" / "asset-preview"

PLAYER_SVG = ROOT / "trap_game_player_sprite_sheet.svg"
ENV_SVG = ROOT / "trap_adventure_environment.svg"


def embedded_png(svg_path: Path) -> Image.Image:
    """Pull the base64 PNG out of <image xlink:href="data:image/png;base64,...">."""
    text = svg_path.read_text(encoding="utf-8")
    match = re.search(r"base64,([A-Za-z0-9+/=\s]+)", text)
    if not match:
        raise SystemExit(f"no embedded PNG in {svg_path.name}")
    raw = base64.b64decode(re.sub(r"\s", "", match.group(1)))
    return Image.open(io.BytesIO(raw)).convert("RGBA")


# ---------------------------------------------------------------- player atlas

def player_frames(img: Image.Image) -> dict[str, list[Image.Image]]:
    """The contact sheet is hand-placed art: find frames via alpha components."""
    alpha = np.array(img)[..., 3]
    lab, _ = ndimage.label(alpha > 40)
    boxes = []
    for sl in ndimage.find_objects(lab):
        if sl is None:
            continue
        y0, y1 = sl[0].start, sl[0].stop
        x0, x1 = sl[1].start, sl[1].stop
        if (x1 - x0) < 24 or (y1 - y0) < 60:
            continue  # label pills and dust
        boxes.append((x0, y0, x1, y1))

    row_a = sorted([b for b in boxes if b[3] <= 350], key=lambda b: b[0])
    row_b = sorted([b for b in boxes if 350 < b[3] <= 660], key=lambda b: b[0])
    row_c = sorted([b for b in boxes if b[3] > 660], key=lambda b: b[0])
    split = len(row_c) // 2
    return {
        "run": [img.crop(b) for b in row_a],
        "jump": [img.crop(b) for b in row_b],
        "idle": [img.crop(b) for b in row_c[:split]],
        "land": [img.crop(b) for b in row_c[split:]],
    }


def build_player_atlas(frames: dict[str, list[Image.Image]]) -> dict:
    order = ["idle", "run", "jump", "land"]
    flat: list[tuple[str, Image.Image]] = []
    for name in order:
        for frame in frames[name]:
            flat.append((name, frame))

    cw = max(f.width for _, f in flat) + 8
    ch = max(f.height for _, f in flat) + 8
    cols = 8
    rows = (len(flat) + cols - 1) // cols
    atlas = Image.new("RGBA", (cw * cols, ch * rows), (0, 0, 0, 0))

    animations: dict[str, list[list[int]]] = {}
    for n, (name, frame) in enumerate(flat):
        cx = (n % cols) * cw
        cy = (n // cols) * ch
        px = cx + (cw - frame.width) // 2
        py = cy + (ch - frame.height) - 4  # common feet baseline
        atlas.paste(frame, (px, py), frame)
        animations.setdefault(name, []).append([n % cols, n // cols])

    # Frames are drawn at ~110px tall in game, so a modest downscale keeps them
    # crisp while cutting most of the atlas weight.
    scale = 0.6
    atlas = atlas.resize((round(atlas.width * scale), round(atlas.height * scale)), Image.LANCZOS)
    atlas.save(SHIP / "player-atlas.png", optimize=True)
    return {
        "image": "player-atlas.png",
        "cellWidth": round(cw * scale),
        "cellHeight": round(ch * scale),
        "columns": cols,
        "rows": rows,
        "animations": animations,
    }


# ------------------------------------------------------------- environment kit

def strip_checker(img: Image.Image) -> Image.Image:
    """Make the baked checkerboard transparent without eating art highlights."""
    rgba = np.array(img.convert("RGBA"))
    rgb = rgba[..., :3].astype(int)
    mx, mn = rgb.max(2), rgb.min(2)
    light = (mn >= 198) & ((mx - mn) <= 18)

    lab, n = ndimage.label(light)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    border.discard(0)
    bg = np.isin(lab, list(border))

    # Checkerboard pockets enclosed by art (inside canopies, crate slats) are
    # missed by the border flood. They contain both checker tones, or are one
    # tone in a clean axis-aligned square; a painted highlight is neither.
    if n:
        white = mn >= 246
        grey = (mn >= 198) & (mn <= 240)
        for i, sl in enumerate(ndimage.find_objects(lab), 1):
            if i in border or sl is None:
                continue
            comp = lab[sl] == i
            if comp.sum() > 4000:
                continue
            both = (white[sl] & comp).any() and (grey[sl] & comp).any()
            h = sl[0].stop - sl[0].start
            w = sl[1].stop - sl[1].start
            square = h >= 10 and w >= 10 and comp.sum() / (h * w) > 0.82
            if both or square:
                bg[sl][comp] = True

    out = rgba.copy()
    out[bg, 3] = 0
    out[bg, :3] = 0
    edge = ndimage.binary_dilation(bg, np.ones((2, 2))) & ~bg
    semi = edge & (rgb.min(2) >= 190) & ((rgb.max(2) - rgb.min(2)) <= 26)
    out[semi, 3] = (out[semi, 3] * 0.35).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def clean_islands(img: Image.Image, grow: int = 8, min_ratio: float = 0.02) -> Image.Image:
    """Drop detached fragments (neighbouring rocks, label specks) from a cut."""
    a = np.array(img)
    solid = a[..., 3] > 24
    if not solid.any():
        return img
    lab, n = ndimage.label(solid, np.ones((3, 3)))
    if n <= 1:
        return img
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    main = int(np.argmax(sizes)) + 1
    ys, xs = np.where(lab == main)
    y0, y1 = ys.min() - grow, ys.max() + grow
    x0, x1 = xs.min() - grow, xs.max() + grow
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        touches = not (sl[0].stop < y0 or sl[0].start > y1 or sl[1].stop < x0 or sl[1].start > x1)
        if i == main or (touches and sizes[i - 1] >= sizes[main - 1] * min_ratio):
            keep[i] = True
    out = a.copy()
    out[~keep[lab], 3] = 0
    out[~keep[lab], :3] = 0
    return Image.fromarray(out, "RGBA")


def trim(img: Image.Image, pad: int = 1) -> Image.Image:
    a = np.array(img)[..., 3]
    ys, xs = np.where(a > 8)
    if len(ys) == 0:
        return img
    x0 = max(int(xs.min()) - pad, 0)
    x1 = min(int(xs.max()) + pad + 1, img.width)
    y0 = max(int(ys.min()) - pad, 0)
    y1 = min(int(ys.max()) + pad + 1, img.height)
    return img.crop((x0, y0, x1, y1))


# Rects measured on the full-resolution environment sheet (1672x941).
CROPS: dict[str, tuple[int, int, int, int]] = {
    # stone
    "stone-block": (2, 437, 134, 124),
    "stone-square": (300, 563, 67, 75),
    "stone-block-dark": (210, 566, 79, 72),
    "stone-pillar": (1030, 425, 74, 210),
    "spike-column": (1100, 425, 130, 210),
    "stone-arch": (860, 510, 150, 110),
    "stone-arch-broken": (973, 650, 136, 105),
    # grass-topped ledges, used as interlocking pieces
    "grass-platform-wide": (224, 436, 246, 64),
    "grass-platform-mid": (480, 436, 160, 64),
    "grass-platform-small": (655, 436, 145, 64),
    "grass-strip-long": (224, 501, 389, 61),
    "grass-strip-mid": (629, 502, 118, 63),
    "grass-strip-short": (370, 570, 259, 61),
    "grass-slope": (645, 566, 137, 68),
    # props and hazards
    "door": (1266, 449, 251, 189),
    "flag-red": (1525, 455, 81, 178),
    "spikes-wide": (181, 728, 173, 41),
    "spikes-long": (701, 743, 193, 75),
    "saw": (1386, 738, 133, 50),
    "crate": (435, 675, 53, 64),
    "crate-open": (498, 670, 52, 66),
    "barrel": (561, 660, 51, 76),
    "ladder": (621, 647, 55, 146),
    "bridge": (708, 650, 177, 63),
    "sign-arrow": (1539, 729, 132, 60),
    "coin": (1259, 651, 42, 44),
    "potion": (1433, 646, 51, 48),
    "key": (1520, 647, 53, 59),
    "gem": (1603, 651, 59, 51),
    "tree-large": (493, 783, 162, 145),
    "tree-round": (196, 772, 176, 164),
    "tree-broad": (602, 758, 172, 178),
    "bush": (722, 850, 109, 77),
    "plant": (829, 835, 120, 92),
    "rock": (627, 871, 91, 69),
}


def grass_run(img: Image.Image, band: int = 20) -> Image.Image:
    """Crop to the longest stretch that actually has grass on top.

    The kit's ledge sprites contain bare stone sections and transparent gutters
    between them; tiling a whole sprite would copy those holes into the floor.
    """
    a = np.array(img)
    alpha = a[..., 3]
    band_alpha = alpha[: min(band, alpha.shape[0])]
    has_grass = (band_alpha > 40).mean(0) > 0.5

    best = (0, 0)
    start = None
    for x in range(len(has_grass) + 1):
        on = x < len(has_grass) and has_grass[x]
        if on and start is None:
            start = x
        elif not on and start is not None:
            if x - start > best[1] - best[0]:
                best = (start, x)
            start = None
    if best[1] - best[0] < 60:
        return img
    return img.crop((best[0], 0, best[1], img.height))


def wrap_blend(img: Image.Image, blend: int) -> Image.Image:
    """Cross-fade the right edge into the left edge so the tile repeats cleanly."""
    a = np.array(img).astype(np.float32)
    h, w = a.shape[:2]
    blend = min(blend, w // 4)
    left = a[:, :blend].copy()
    for i in range(blend):
        t = i / max(1, blend - 1)  # 0 at the start of the blend, 1 at the edge
        a[:, w - blend + i] = a[:, w - blend + i] * (1 - t) + left[:, i] * t
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def pack_atlas(sprites: dict[str, Image.Image], max_width: int = 1408, pad: int = 2):
    """Shelf-pack the sprites into one RGBA atlas; return it plus sprite rects."""
    order = sorted(sprites, key=lambda k: (-sprites[k].height, k))
    x = y = row_h = 0
    placed: dict[str, tuple[int, int]] = {}
    for name in order:
        img = sprites[name]
        if x + img.width > max_width:
            x = 0
            y += row_h + pad
            row_h = 0
        placed[name] = (x, y)
        x += img.width + pad
        row_h = max(row_h, img.height)

    atlas = Image.new("RGBA", (max_width, y + row_h), (0, 0, 0, 0))
    for name in order:
        atlas.paste(sprites[name], placed[name])
    return atlas, placed


def main() -> None:
    SHIP.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    cut_dir = REVIEW / "sprites"
    cut_dir.mkdir(exist_ok=True)
    for stale in cut_dir.glob("*.png"):
        stale.unlink()

    player_img = embedded_png(PLAYER_SVG)
    env_img = strip_checker(embedded_png(ENV_SVG))

    frames = player_frames(player_img)
    print("player frames:", {k: len(v) for k, v in frames.items()})
    manifest: dict = {"player": build_player_atlas(frames), "sprites": {}}

    cuts: dict[str, Image.Image] = {}
    for name, (x, y, w, h) in CROPS.items():
        sprite = trim(clean_islands(strip_checker(env_img.crop((x, y, x + w, y + h)))))
        cuts[name] = sprite
        sprite.save(cut_dir / f"{name}.png")

    # A seam-free interior tile for platform bodies: the block's own bevelled
    # edge must never repeat, or every tile shows as a bright seam.
    block = Image.open(cut_dir / "stone-block.png")
    inset = 7
    tile = block.crop((inset, inset, block.width - inset, block.height - inset))
    tile.save(SHIP / "stone-tile.png", optimize=True)
    manifest["tile"] = {"image": "stone-tile.png", "w": tile.width, "h": tile.height}

    # Platform surfaces repeat a strip stitched from several whole grass pieces
    # (each trimmed to its content, so there are no transparent gutters), then
    # wrap-blended end to end so the repeat is invisible.
    parts = [
        grass_run(Image.open(cut_dir / f"{n}.png"))
        for n in ("grass-platform-wide", "grass-strip-short", "grass-strip-long")
    ]
    stitched_h = max(p.height for p in parts)
    stitched = Image.new("RGBA", (sum(p.width for p in parts), stitched_h), (0, 0, 0, 0))
    sx = 0
    for part in parts:
        stitched.alpha_composite(part, (sx, stitched_h - part.height))
        sx += part.width
    ledge = wrap_blend(stitched, 30)
    ledge.save(SHIP / "ledge-tile.png", optimize=True)
    manifest["ledge"] = {"image": "ledge-tile.png", "w": ledge.width, "h": ledge.height}

    atlas, placed = pack_atlas(cuts)
    atlas.save(SHIP / "kit-atlas.png", optimize=True)
    manifest["kit"] = {"image": "kit-atlas.png", "w": atlas.width, "h": atlas.height}
    for name, img in cuts.items():
        px, py = placed[name]
        manifest["sprites"][name] = {"x": px, "y": py, "w": img.width, "h": img.height}

    (SHIP / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    # ---- review contact sheet
    names = list(CROPS)
    cell = 200
    cols = 6
    rows = (len(names) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 18)), (30, 32, 38))
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        sprite = cuts[name]
        scale = min((cell - 12) / sprite.width, (cell - 12) / sprite.height, 1.0)
        if scale < 1.0:
            sprite = sprite.resize(
                (max(1, int(sprite.width * scale)), max(1, int(sprite.height * scale))),
                Image.LANCZOS,
            )
        cx = (i % cols) * cell
        cy = (i // cols) * (cell + 18)
        sheet.paste(sprite, (cx + 6, cy + 6), sprite)
        draw.text((cx + 6, cy + cell + 2), name, fill=(220, 224, 230))
    sheet.save(REVIEW / "contact-sheet.png")

    total = sum(f.stat().st_size for f in SHIP.iterdir() if f.is_file())
    print(f"packed {len(cuts)} sprites into {atlas.width}x{atlas.height} atlas")
    print(f"shipping {total / 1024:.0f} KB in {SHIP}")


if __name__ == "__main__":
    main()
