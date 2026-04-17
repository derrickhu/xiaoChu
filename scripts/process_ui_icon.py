"""
UI 图标完整后处理管线：
  1. 从外部资产仓读取原稿：game_assets/xiaochu/assets/ui/sources/<name>_source.png
  2. rembg + birefnet-general 去底（若原稿已透明则跳过）
  3. 按 alpha 裁剪最小外接框，去掉四周空白
  4. 居中到正方形画布（主体占比与灵石/体力/觉醒石一致）
  5. resize 到目标分辨率（默认 256）
  6. PNG optimize 写入小程序仓 assets/ui/<name>.png

用法：
  python3 scripts/process_ui_icon.py --name icon_universal_frag
  python3 scripts/process_ui_icon.py --name icon_universal_frag --target 256 --pad 0.08

  # 原稿已是透明背景，只需裁剪+居中：
  python3 scripts/process_ui_icon.py --name xxx --no-rembg

与 compress_ui_icon.py 的区别：
  - compress_ui_icon.py 只做「压缩 + resize」，假设原稿已处理好
  - process_ui_icon.py 是完整管线，从 AI 原稿一步到位

依赖：
  pip3 install rembg onnxruntime Pillow
"""
import os
import argparse
from PIL import Image


GAME_ASSETS_UI_SOURCES = "/Users/huyi/dk_proj/game_assets/xiaochu/assets/ui/sources"
REPO_UI_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "ui")


def _has_alpha_variation(img: Image.Image) -> bool:
    """原稿是否已经是带透明的抠图（alpha 通道有变化而非全不透明）"""
    if img.mode != "RGBA":
        return False
    alpha = img.split()[-1]
    mn, mx = alpha.getextrema()
    return mn < 250  # 存在半透明像素或全透明像素，说明已抠过


def _remove_bg(img: Image.Image, model: str = "birefnet-general") -> Image.Image:
    from rembg import remove, new_session
    session = new_session(model, providers=["CPUExecutionProvider"])
    return remove(img, session=session)


def _trim_alpha(img: Image.Image, pad_ratio: float = 0.06) -> Image.Image:
    """按 alpha 裁掉四周空白，并按 pad_ratio 留一点余量"""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    bbox = img.split()[-1].getbbox()
    if not bbox:
        return img
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    side = max(cw, ch)
    pad = int(side * pad_ratio)
    canvas_size = side + pad * 2
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - cw) // 2
    y = (canvas_size - ch) // 2
    canvas.paste(cropped, (x, y), cropped)
    return canvas


def process(src_path: str, dst_path: str, target: int, pad_ratio: float, use_rembg: bool, model: str) -> None:
    if not os.path.exists(src_path):
        raise SystemExit(f"源文件不存在: {src_path}")

    img = Image.open(src_path).convert("RGBA")
    print(f"[读] {src_path}  {img.size}  ({os.path.getsize(src_path)/1024:.0f}K)", flush=True)

    if use_rembg and not _has_alpha_variation(img):
        print(f"[去底] rembg + {model} ...", flush=True)
        img = _remove_bg(img, model=model)
    elif use_rembg:
        print("[去底] 原稿已是透明，跳过 rembg", flush=True)

    print(f"[裁剪] 按 alpha 边界 + pad {pad_ratio*100:.0f}%", flush=True)
    img = _trim_alpha(img, pad_ratio=pad_ratio)

    if img.size[0] > target:
        img = img.resize((target, target), Image.LANCZOS)

    os.makedirs(os.path.dirname(os.path.abspath(dst_path)), exist_ok=True)
    img.save(dst_path, format="PNG", optimize=True)
    print(f"[写] {dst_path}  {img.size}  ({os.path.getsize(dst_path)/1024:.0f}K)", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True, help="图标名（不含 _source 后缀）")
    ap.add_argument("--target", type=int, default=256, help="最终最大边（px），默认 256")
    ap.add_argument(
        "--pad",
        type=float,
        default=0.06,
        help="裁剪后四周留白比例（0.06 表示主体周围留 6% 空间），默认 0.06",
    )
    ap.add_argument("--no-rembg", action="store_true", help="跳过去底（原稿已是透明）")
    ap.add_argument("--model", default="birefnet-general", help="rembg 模型名")
    ap.add_argument("--src", help="自定义源路径，默认 game_assets/.../sources/<name>_source.png")
    ap.add_argument("--dst", help="自定义目标路径，默认 assets/ui/<name>.png")
    ns = ap.parse_args()

    src = ns.src or os.path.join(GAME_ASSETS_UI_SOURCES, f"{ns.name}_source.png")
    dst = ns.dst or os.path.join(REPO_UI_DIR, f"{ns.name}.png")
    process(src, dst, ns.target, ns.pad, not ns.no_rembg, ns.model)


if __name__ == "__main__":
    main()
