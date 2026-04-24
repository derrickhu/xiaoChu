"""
背景图压缩工具：外部原稿 PNG → 仓内 JPEG 交付图

工作流：
  - 读取外部资产仓 game_assets/xiaochu/assets/backgrounds/sources/<name>_source.png
  - 按最大边重采样（默认 1080，手机端足够）
  - 合并 alpha 到背景色（默认黑）后转 RGB JPEG
  - 输出到小程序仓 assets/backgrounds/<name>.jpg

约定（见 .cursor/rules/image-assets.mdc）：
  - 原稿只放外部资产仓，不进小程序包体
  - 交付图 ≤ 200K（手机背景建议），单张移动端足够

用法：
  python3 scripts/compress_background.py --name task_panel_bg
  python3 scripts/compress_background.py --name task_panel_bg --max-edge 1280 --quality 82
  python3 scripts/compress_background.py --src <path> --dst <path> --max-edge 1080 --quality 80
"""
import os
import argparse
from PIL import Image


GAME_ASSETS_BG_SOURCES = (
    "/Users/huyi/dk_proj/game_assets/xiaochu/assets/backgrounds/sources"
)
REPO_BG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets",
    "backgrounds",
)


def compress_background(
    src: str, dst: str, max_edge: int = 1080, quality: int = 80
) -> None:
    if not os.path.exists(src):
        raise SystemExit(f"源文件不存在: {src}")

    img = Image.open(src)
    # 若有 alpha，合并到黑底（背景图全屏铺开，透明像素无意义）
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        bg = Image.new("RGB", img.size, (0, 0, 0))
        rgba = img.convert("RGBA")
        bg.paste(rgba, mask=rgba.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")

    w, h = img.size
    scale = max_edge / max(w, h)
    if scale < 1:
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        img = img.resize((new_w, new_h), Image.LANCZOS)

    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    img.save(
        dst,
        format="JPEG",
        quality=quality,
        optimize=True,
        progressive=True,
    )

    before = os.path.getsize(src) / 1024
    after = os.path.getsize(dst) / 1024
    saved = (1 - after / before) * 100 if before > 0 else 0
    print(f"{src} ({before:.0f}K)")
    print(
        f"  → {dst} ({after:.0f}K, -{saved:.0f}%, {img.size[0]}x{img.size[1]}, q={quality})"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="背景图压缩（外部 sources/*.png → 仓内 assets/backgrounds/*.jpg）"
    )
    parser.add_argument(
        "--name",
        help="按约定路径自动拼接：源=game_assets/.../sources/<name>_source.png，目标=assets/backgrounds/<name>.jpg",
    )
    parser.add_argument("--src", help="自定义源路径（与 --name 二选一）")
    parser.add_argument("--dst", help="自定义目标路径（与 --src 搭配）")
    parser.add_argument(
        "--max-edge",
        type=int,
        default=1080,
        help="最大边像素（默认 1080，够手机全屏背景）",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=80,
        help="JPEG 质量（默认 80，可压到 70 进一步瘦身）",
    )
    ns = parser.parse_args()

    if ns.name:
        src = os.path.join(GAME_ASSETS_BG_SOURCES, f"{ns.name}_source.png")
        dst = os.path.join(REPO_BG_DIR, f"{ns.name}.jpg")
    elif ns.src and ns.dst:
        src, dst = ns.src, ns.dst
    else:
        raise SystemExit("必须指定 --name 或 (--src + --dst)")

    compress_background(src, dst, ns.max_edge, ns.quality)


if __name__ == "__main__":
    main()
