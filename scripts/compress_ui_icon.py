"""
UI 图标/贴图压缩工具

工作流：
  - 读取原稿（默认从外部资产仓 game_assets/xiaochu/assets/ui/sources/）
  - 按目标分辨率 + PNG optimize 写入小程序仓的交付路径（assets/ui/）
  - 保留 alpha 通道；不做量化（避免色带），仅依赖 PIL 的 optimize 无损重压 + resize

约定（详见 .cursor/rules/image-assets.mdc）：
  - 原稿只放 /Users/huyi/dk_proj/game_assets/xiaochu/assets/ui/sources/，不进小程序包体
  - 交付图放本仓 assets/ui/，文件名去掉 _source 后缀

用法：
  python3 scripts/compress_ui_icon.py <src> <dst> <target_size> [--quantize]

  # 简化用法：只给名字，自动拼外部源路径 + 本仓交付路径
  python3 scripts/compress_ui_icon.py --name icon_universal_frag 256

示例：
  # 全路径写法（兼容历史）
  python3 scripts/compress_ui_icon.py \
      /Users/huyi/dk_proj/game_assets/xiaochu/assets/ui/sources/icon_universal_frag_source.png \
      assets/ui/icon_universal_frag.png \
      256

  # 推荐：简化用法
  python3 scripts/compress_ui_icon.py --name icon_universal_frag 256
  python3 scripts/compress_ui_icon.py --name newbie_gift_icon 512
"""
import os
import argparse
from PIL import Image


# 外部资产仓约定路径
GAME_ASSETS_UI_SOURCES = "/Users/huyi/dk_proj/game_assets/xiaochu/assets/ui/sources"
REPO_UI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "ui")


def compress(src_path: str, dst_path: str, target: int, quantize: bool = False) -> None:
    if not os.path.exists(src_path):
        raise SystemExit(f"源文件不存在: {src_path}")

    img = Image.open(src_path).convert("RGBA")
    w, h = img.size
    scale = target / max(w, h)
    if scale < 1:
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        img = img.resize((new_w, new_h), Image.LANCZOS)

    os.makedirs(os.path.dirname(os.path.abspath(dst_path)), exist_ok=True)

    if quantize:
        pal = img.convert("P", palette=Image.ADAPTIVE, colors=256)
        pal.info["transparency"] = 255
        pal.save(dst_path, format="PNG", optimize=True)
    else:
        img.save(dst_path, format="PNG", optimize=True)

    before = os.path.getsize(src_path) / 1024
    after = os.path.getsize(dst_path) / 1024
    saved = (1 - after / before) * 100 if before > 0 else 0
    print(f"{src_path} ({before:.0f}K)")
    print(f"  → {dst_path} ({after:.0f}K, -{saved:.0f}%, {img.size[0]}x{img.size[1]})")


def main() -> None:
    parser = argparse.ArgumentParser(description="UI 图标压缩（外部 sources → 仓内交付图）")
    parser.add_argument("args", nargs="*", help="[src dst target] 或 [target]（与 --name 搭配）")
    parser.add_argument(
        "--name",
        help="按约定路径自动拼接：源=game_assets/.../sources/<name>_source.png，目标=assets/ui/<name>.png",
    )
    parser.add_argument("--quantize", action="store_true", help="转 8bit 调色板（极限压缩，可能有色带）")
    ns = parser.parse_args()

    if ns.name:
        if len(ns.args) != 1:
            raise SystemExit("使用 --name 时需传 1 个参数：target 最大边（px）")
        target = int(ns.args[0])
        src = os.path.join(GAME_ASSETS_UI_SOURCES, f"{ns.name}_source.png")
        dst = os.path.join(REPO_UI_DIR, f"{ns.name}.png")
    else:
        if len(ns.args) != 3:
            raise SystemExit("参数不正确。见 -h")
        src, dst, target_str = ns.args
        target = int(target_str)

    compress(src, dst, target, ns.quantize)


if __name__ == "__main__":
    main()
