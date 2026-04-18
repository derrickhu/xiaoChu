"""
炫耀卡底图批处理工具

职责：
  - 把 AI 生成的 6 张分享卡底图（外部 sources 仓）压缩 + 裁切 + 居中为统一尺寸
  - 统一尺寸：750x600（与 shareCard.js CARD_W/CARD_H 一致）
  - 输出 JPG（q=85），无透明通道，单张目标 ≤ 150K

约定（见 .cursor/rules/image-assets.mdc）：
  - 原稿：/Users/huyi/dk_proj/game_assets/xiaochu/assets/share/sources/<scene>_source.png
  - 交付：xiao_chu/assets/share/card_base/<scene>.jpg

用法：
  python3 scripts/process_share_cards.py            # 一键处理全部 6 张
  python3 scripts/process_share_cards.py first_pet  # 只处理指定 scene
"""
import os
import sys
from PIL import Image

SOURCES_DIR = "/Users/huyi/dk_proj/game_assets/xiaochu/assets/share/sources"
REPO_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "assets", "share", "card_base"
)
TARGET_W = 750
TARGET_H = 600
JPG_QUALITY = 85

SCENES = [
    "first_pet",
    "stage_first_clear",
    "first_s",
    "pet_starup",
    "chapter_complete",
    "tower_new_best",
]

# 各场景预处理（在 cover 填充前，对原稿做的一次"初剪"）。
#   crop_bottom_ratio: 丢弃原稿下方 N%（0~1）。主要给 first_s 这类下方本就是灰色
#                      / 文字留白的老原稿用，避免灰色被 cover 方式保留下来。
#   crop_top_ratio   : 同上，丢弃原稿顶部 N%。
# 不填则不做预处理，直接 cover 到 750×600。
SCENE_PRECROPS = {
    "first_s": {"crop_bottom_ratio": 0.42},
}


def process(scene: str) -> None:
    src = os.path.join(SOURCES_DIR, f"{scene}_source.png")
    dst = os.path.join(REPO_DIR, f"{scene}.jpg")
    if not os.path.exists(src):
        print(f"[SKIP] 源文件不存在: {src}")
        return

    img = Image.open(src).convert("RGB")
    w, h = img.size

    precrop = SCENE_PRECROPS.get(scene)
    if precrop:
        top_ratio = float(precrop.get("crop_top_ratio", 0))
        bot_ratio = float(precrop.get("crop_bottom_ratio", 0))
        top_px = int(round(h * top_ratio))
        bot_px = int(round(h * (1 - bot_ratio)))
        if bot_px > top_px:
            img = img.crop((0, top_px, w, bot_px))
            w, h = img.size
            print(f"  [{scene}] pre-crop → {w}x{h} (top={top_px} bot={bot_px})")

    # 按 cover 方式填充 750x600：先等比放大到最小覆盖，再居中裁剪
    target_ratio = TARGET_W / TARGET_H
    src_ratio = w / h
    if src_ratio > target_ratio:
        # 源更宽：按高度拟合，左右裁剪
        new_h = TARGET_H
        new_w = int(round(w * new_h / h))
    else:
        # 源更窄：按宽度拟合，上下裁剪
        new_w = TARGET_W
        new_h = int(round(h * new_w / w))
    img = img.resize((new_w, new_h), Image.LANCZOS)

    # 居中裁剪
    left = (new_w - TARGET_W) // 2
    top = (new_h - TARGET_H) // 2
    img = img.crop((left, top, left + TARGET_W, top + TARGET_H))

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    img.save(dst, format="JPEG", quality=JPG_QUALITY, optimize=True)

    before = os.path.getsize(src) / 1024
    after = os.path.getsize(dst) / 1024
    print(f"  [{scene}] {before:.0f}K → {after:.0f}K ({TARGET_W}x{TARGET_H})")


def main() -> None:
    if len(sys.argv) > 1:
        scenes = sys.argv[1:]
    else:
        scenes = SCENES
    print(f"处理 {len(scenes)} 张炫耀卡底图 → {REPO_DIR}")
    for s in scenes:
        process(s)
    print("[DONE]")


if __name__ == "__main__":
    main()
