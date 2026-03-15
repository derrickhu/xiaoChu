#!/usr/bin/env python3
"""
Generate pet art using Gemini image generation, then process it.

Modes:
  single: generate one variant (normal or awakened) from a 2:1 combined image
  grid:   generate both variants at once from a 1:1 2x2 grid image

Output paths:
  - 全身: assets/stage_enemies/{pet_id}.png / {pet_id}_awakened.png
  - 头像: assets/stage_avatars/{pet_id}_avatar.png / {pet_id}_awakened_avatar.png
  - 中间产物: tmp/pet_art/ (不打包)
"""
import sys
import subprocess
from pathlib import Path

GEMINI_SKILL = Path.home() / ".cursor/skills/gemini-image-gen/scripts/generate_images.py"
PROCESS_SCRIPT = Path(__file__).parent / "process_pet_image.py"


def _run(cmd: list, label: str) -> None:
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"{label} failed:\n{result.stderr}", file=sys.stderr)
        raise SystemExit(1)
    print(result.stdout)


def generate_single(
    prompt_file: Path,
    project_root: Path,
    pet_id: str,
    variant: str = "normal",
    aspect_ratio: str = "16:9",
    model: str = "gemini-3.1-flash-image-preview",
) -> None:
    """Legacy mode: generate one 2:1 image for a single variant."""
    project_root = Path(project_root).resolve()
    temp_dir = project_root / "tmp" / "pet_art"
    full_dir = project_root / "assets" / "stage_enemies"
    avatar_dir = project_root / "assets" / "stage_avatars"

    for d in (temp_dir, full_dir, avatar_dir):
        d.mkdir(parents=True, exist_ok=True)

    combined_name = f"{pet_id}_{variant}_combined.png"
    combined_path = temp_dir / combined_name

    print(f"Generating {combined_name}...")
    _run([
        "python3", str(GEMINI_SKILL),
        "--prompt-file", str(prompt_file),
        "--output", str(combined_path),
        "--model", model,
        "--aspect-ratio", aspect_ratio,
    ], "Generation")

    avatar_name = f"{pet_id}_avatar.png" if variant == "normal" else f"{pet_id}_{variant}_avatar.png"
    full_name = f"{pet_id}.png" if variant == "normal" else f"{pet_id}_{variant}.png"

    avatar_out = avatar_dir / avatar_name
    full_out = full_dir / full_name

    print(f"\nProcessing {combined_name}...")
    _run([
        "python3", str(PROCESS_SCRIPT),
        str(combined_path), str(avatar_out), str(full_out),
    ], "Processing")

    print(f"\nComplete! Output:")
    print(f"   - full:   {full_out}")
    print(f"   - avatar: {avatar_out}")
    print(f"   - temp:   {combined_path}")


def generate_grid(
    prompt_file: Path,
    project_root: Path,
    pet_id: str,
    model: str = "gemini-3.1-flash-image-preview",
) -> None:
    """Grid mode: generate one 1:1 image with both normal+awakened in 2x2 grid."""
    project_root = Path(project_root).resolve()
    temp_dir = project_root / "tmp" / "pet_art"
    full_dir = project_root / "assets" / "stage_enemies"
    avatar_dir = project_root / "assets" / "stage_avatars"

    for d in (temp_dir, full_dir, avatar_dir):
        d.mkdir(parents=True, exist_ok=True)

    grid_name = f"{pet_id}_grid.png"
    grid_path = temp_dir / grid_name

    print(f"Generating {grid_name} (2x2 grid: normal + awakened)...")
    _run([
        "python3", str(GEMINI_SKILL),
        "--prompt-file", str(prompt_file),
        "--output", str(grid_path),
        "--model", model,
        "--aspect-ratio", "1:1",
    ], "Generation")

    n_avatar = avatar_dir / f"{pet_id}_avatar.png"
    n_full = full_dir / f"{pet_id}.png"
    a_avatar = avatar_dir / f"{pet_id}_awakened_avatar.png"
    a_full = full_dir / f"{pet_id}_awakened.png"

    print(f"\nProcessing {grid_name} into 4 assets...")
    _run([
        "python3", str(PROCESS_SCRIPT),
        "--grid", str(grid_path),
        str(n_avatar), str(n_full),
        str(a_avatar), str(a_full),
    ], "Processing")

    print(f"\nComplete! Output:")
    print(f"   - normal avatar:   {n_avatar}")
    print(f"   - normal full:     {n_full}")
    print(f"   - awakened avatar: {a_avatar}")
    print(f"   - awakened full:   {a_full}")
    print(f"   - temp grid:       {grid_path}")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(
            "Usage:\n"
            "  Single: python generate_pet.py PROMPT_FILE PROJECT_ROOT PET_ID [normal|awakened]\n"
            "  Grid:   python generate_pet.py --grid PROMPT_FILE PROJECT_ROOT PET_ID",
            file=sys.stderr,
        )
        raise SystemExit(1)

    if sys.argv[1] == "--grid":
        prompt_file = Path(sys.argv[2])
        project_root = Path(sys.argv[3])
        pet_id = sys.argv[4]
        if not prompt_file.exists():
            print(f"Prompt file not found: {prompt_file}", file=sys.stderr)
            raise SystemExit(1)
        generate_grid(prompt_file, project_root, pet_id)
    else:
        prompt_file = Path(sys.argv[1])
        project_root = Path(sys.argv[2])
        pet_id = sys.argv[3]
        variant = sys.argv[4] if len(sys.argv) > 4 else "normal"
        if not prompt_file.exists():
            print(f"Prompt file not found: {prompt_file}", file=sys.stderr)
            raise SystemExit(1)
        generate_single(prompt_file, project_root, pet_id, variant)
