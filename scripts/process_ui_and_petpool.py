import os
import time
import shutil

os.environ["OMP_NUM_THREADS"] = "8"

from rembg import remove, new_session
from PIL import Image


def main() -> None:
    model = "birefnet-general"
    providers = ["CPUExecutionProvider"]

    print(f"Loading {model}...", flush=True)
    t0 = time.time()
    session = new_session(model, providers=providers)
    print(f"Loaded in {time.time() - t0:.1f}s", flush=True)

    # 1. UI 抠图：去掉绿色背景，保留原尺寸，并备份 *_orig.png
    ui_files = [
        "assets/ui/icon_exp_pool.png",
        "assets/ui/pet_card_bg.png",
    ]

    for idx, rel_path in enumerate(ui_files, 1):
        in_path = os.path.abspath(rel_path)
        out_path = in_path  # overwrite after backup
        backup_path = in_path.replace(".png", "_orig.png")

        print(f"[{idx}/{len(ui_files)}] {rel_path}...", end=" ", flush=True)
        if not os.path.exists(in_path):
            print("SKIP (not found)", flush=True)
            continue

        if not os.path.exists(backup_path):
            shutil.copy2(in_path, backup_path)

        t = time.time()
        inp = Image.open(in_path).convert("RGBA")
        out = remove(inp, session=session)
        out.save(out_path)
        print(
            f"done {time.time() - t:.1f}s (backup: {os.path.basename(backup_path)})",
            flush=True,
        )

    # 2. 宠物池背景 PNG -> JPG（质量 90）
    bg_png = os.path.abspath("assets/backgrounds/petpool_bg.png")
    bg_jpg = os.path.abspath("assets/backgrounds/petpool_bg.jpg")

    if os.path.exists(bg_png):
        print(
            "Converting assets/backgrounds/petpool_bg.png -> petpool_bg.jpg (q=90)...",
            flush=True,
        )
        img = Image.open(bg_png)
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")

        img.save(bg_jpg, format="JPEG", quality=90, optimize=True)
        print(f"Saved {os.path.basename(bg_jpg)}", flush=True)
    else:
        print("assets/backgrounds/petpool_bg.png not found, skip format conversion", flush=True)


if __name__ == "__main__":
    main()
