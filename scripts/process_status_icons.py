"""
战斗状态图标后处理工具

工作流：
  1. 从外部资产仓 game_assets/xiaochu/assets/ui/battle/status/sources/
     读取 AI 生成的原稿（带白/色底的 RGB，1024x1024）
  2. 调用 rembg（birefnet-general-lite）去背景得到 RGBA
  3. trim 裁掉四周透明边，贴 6px padding
  4. resize 最大边到 target（默认 128）
  5. PNG optimize 压缩后写入 assets/ui/battle/status/status_<key>.png

约定（.cursor/rules/image-assets.mdc）：
  - 原稿只放 game_assets，不进小程序包体
  - 交付图进入 xiao_chu/assets/ui/battle/status/

用法：
  python3 scripts/process_status_icons.py              # 全量处理 8 个 key
  python3 scripts/process_status_icons.py poison stun  # 只处理指定 key
"""

import os
import sys
import subprocess
import tempfile
import shutil
from PIL import Image


SOURCES_DIR = "/Users/huyi/dk_proj/game_assets/xiaochu/assets/ui/battle/status/sources"
DELIVER_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets", "ui", "battle", "status",
)
REMBG_SCRIPT = os.path.expanduser(
    "~/.cursor/skills/remove-background/scripts/rembg_single.py"
)

ALL_KEYS = ["poison", "defDown", "healBlock", "seal", "stun", "atkBuff", "shield", "buff"]
TARGET_SIZE = 128
PAD = 6


def _rembg(src: str, dst: str) -> None:
    subprocess.run(
        ["python3", REMBG_SCRIPT, src, "-o", dst, "-m", "birefnet-general-lite"],
        check=True,
    )


def _trim_and_resize(src_rgba: str, dst_png: str, target: int, pad: int) -> None:
    img = Image.open(src_rgba).convert("RGBA")
    bbox = img.getbbox()
    if not bbox:
        raise SystemExit(f"空图：{src_rgba}")
    img = img.crop(bbox)
    w, h = img.size
    max_side = max(w, h)
    canvas = Image.new("RGBA", (max_side + pad * 2, max_side + pad * 2), (0, 0, 0, 0))
    canvas.paste(img, ((max_side + pad * 2 - w) // 2, (max_side + pad * 2 - h) // 2), img)
    scale = target / canvas.size[0]
    if scale < 1:
        canvas = canvas.resize(
            (int(round(canvas.size[0] * scale)), int(round(canvas.size[1] * scale))),
            Image.LANCZOS,
        )
    os.makedirs(os.path.dirname(os.path.abspath(dst_png)), exist_ok=True)
    canvas.save(dst_png, format="PNG", optimize=True)


def process_one(key: str, tmp_dir: str) -> None:
    src = os.path.join(SOURCES_DIR, f"status_{key}_source.png")
    if not os.path.exists(src):
        print(f"[skip] 找不到原稿: {src}")
        return
    nobg = os.path.join(tmp_dir, f"status_{key}_nobg.png")
    _rembg(src, nobg)
    dst = os.path.join(DELIVER_DIR, f"status_{key}.png")
    _trim_and_resize(nobg, dst, TARGET_SIZE, PAD)
    before = os.path.getsize(src) / 1024
    after = os.path.getsize(dst) / 1024
    print(f"{key}: {before:.0f}K -> {after:.0f}K ({dst})")


def main() -> None:
    keys = sys.argv[1:] or ALL_KEYS
    tmp_dir = tempfile.mkdtemp(prefix="status_nobg_")
    try:
        for k in keys:
            process_one(k, tmp_dir)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
