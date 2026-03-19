#!/usr/bin/env python3
"""
Process pet images:
  - combined mode (2:1): split left/right → remove bg → trim → avatar 1:1
  - grid mode (2x2): split 4 quadrants → remove bg → trim → avatars 1:1
"""
import os, sys
from pathlib import Path
from typing import Tuple

os.environ["OMP_NUM_THREADS"] = "8"

from rembg import remove, new_session  # type: ignore
from PIL import Image  # type: ignore

MODEL = "birefnet-general"
PROVIDERS = ["CPUExecutionProvider"]


def split_avatar_full(src: Path) -> Tuple[Image.Image, Image.Image]:
    """Split 2:1 landscape image into left (avatar) and right (full body)."""
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    mid = w // 2
    left = img.crop((0, 0, mid, h))
    right = img.crop((mid, 0, w, h))
    return left, right


def split_grid_2x2(src: Path) -> Tuple[Image.Image, Image.Image, Image.Image, Image.Image]:
    """
    Split 1:1 square image into 4 quadrants.
    Returns: (top_left, top_right, bottom_left, bottom_right)
      = (normal_avatar, normal_full, awakened_avatar, awakened_full)
    """
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    mid_x = w // 2
    mid_y = h // 2
    tl = img.crop((0, 0, mid_x, mid_y))
    tr = img.crop((mid_x, 0, w, mid_y))
    bl = img.crop((0, mid_y, mid_x, h))
    br = img.crop((mid_x, mid_y, w, h))
    return tl, tr, bl, br


def trim_alpha(im: Image.Image) -> Image.Image:
    """Crop image to the bounding box of non-transparent pixels."""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    alpha = im.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        return im
    return im.crop(bbox)


def make_square(im: Image.Image, top_margin_pct: float = 0) -> Image.Image:
    """
    Fit avatar into 1:1 frame. Bottom of content flush with bottom of frame, no gap.
    - Bottom-aligned: figure base touches bottom edge, no empty space below
    - Horizontally centered
    """
    w, h = im.size
    side = max(w, h)
    top_margin = int(side * top_margin_pct)
    canvas = side + top_margin if top_margin else side
    result = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    paste_x = (canvas - w) // 2
    paste_y = canvas - h  # bottom-aligned, flush with bottom
    result.paste(im, (paste_x, paste_y))
    return result


def _remove_bg_and_finish(raw: Image.Image, session, is_avatar: bool) -> Image.Image:
    """Remove background, trim alpha, and optionally make square for avatars."""
    result = remove(raw, session=session)
    result = trim_alpha(result)
    if is_avatar:
        result = make_square(result)
    return result


def process_pet(
    combined_path: Path,
    avatar_out: Path,
    full_out: Path,
    model: str = MODEL,
) -> None:
    """Process a 2:1 combined image (legacy mode)."""
    if not combined_path.exists():
        raise FileNotFoundError(f"Source image not found: {combined_path}")

    print(f"Processing: {combined_path}")
    print(f"  Loading model: {model}...")
    session = new_session(model, providers=PROVIDERS)

    avatar_img, full_img = split_avatar_full(combined_path)
    print(f"  Split into avatar ({avatar_img.size}) and full ({full_img.size})")

    print(f"  Removing backgrounds...")
    avatar_rgba = _remove_bg_and_finish(avatar_img, session, is_avatar=True)
    full_rgba = _remove_bg_and_finish(full_img, session, is_avatar=False)

    avatar_out.parent.mkdir(parents=True, exist_ok=True)
    full_out.parent.mkdir(parents=True, exist_ok=True)

    avatar_rgba.save(avatar_out)
    full_rgba.save(full_out)
    print(f"Saved avatar: {avatar_out} ({avatar_rgba.size})")
    print(f"Saved full:   {full_out} ({full_rgba.size})")


def process_pet_grid(
    grid_path: Path,
    normal_avatar_out: Path,
    normal_full_out: Path,
    awakened_avatar_out: Path,
    awakened_full_out: Path,
    model: str = MODEL,
) -> None:
    """Process a 1:1 2x2 grid image into 4 separate assets."""
    if not grid_path.exists():
        raise FileNotFoundError(f"Source image not found: {grid_path}")

    print(f"Processing grid: {grid_path}")
    print(f"  Loading model: {model}...")
    session = new_session(model, providers=PROVIDERS)

    tl, tr, bl, br = split_grid_2x2(grid_path)
    print(f"  Split into 4 quadrants: TL={tl.size} TR={tr.size} BL={bl.size} BR={br.size}")

    panels = [
        ("normal avatar", tl, True, normal_avatar_out),
        ("normal full", tr, False, normal_full_out),
        ("awakened avatar", bl, True, awakened_avatar_out),
        ("awakened full", br, False, awakened_full_out),
    ]

    for label, raw, is_avatar, out_path in panels:
        print(f"  Processing {label}...")
        result = _remove_bg_and_finish(raw, session, is_avatar)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        result.save(out_path)
        print(f"  Saved {label}: {out_path} ({result.size})")


if __name__ == "__main__":
    if len(sys.argv) >= 6 and sys.argv[1] == "--grid":
        grid = Path(sys.argv[2])
        n_avatar = Path(sys.argv[3])
        n_full = Path(sys.argv[4])
        a_avatar = Path(sys.argv[5])
        a_full = Path(sys.argv[6])
        process_pet_grid(grid, n_avatar, n_full, a_avatar, a_full)
    elif len(sys.argv) >= 4:
        combined = Path(sys.argv[1])
        avatar = Path(sys.argv[2])
        full = Path(sys.argv[3])
        process_pet(combined, avatar, full)
    else:
        print(
            "Usage:\n"
            "  Legacy:  python process_pet_image.py COMBINED AVATAR_OUT FULL_OUT\n"
            "  Grid:    python process_pet_image.py --grid GRID_IMAGE N_AVATAR N_FULL A_AVATAR A_FULL",
            file=sys.stderr,
        )
        raise SystemExit(1)
