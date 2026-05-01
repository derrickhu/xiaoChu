---
name: gemini-image-gen
description: 使用 Google Gemini 文生图；API Key 存于本目录 api_key.local（已 gitignore），通过环境变量传给脚本。
---

# Gemini 文生图（项目内配置）

本目录 **`api_key.local`** 存一行 Gemini API Key（**勿提交**，已在仓库 `.gitignore`）。

## 本地代理（生图）

与用户级 `~/.cursor/skills/gemini-image-gen/scripts/generate_images.py` 默认一致：`http://127.0.0.1:7897`（与 macOS 系统代理及 Clash Verge / Mihomo 混合端口对齐）。可用环境变量 `HTTPS_PROXY` / `https_proxy` 覆盖；代理异常时 `GEMINI_IMAGE_NO_PROXY=1` 直连。

## 用法

```bash
# 从本目录读取 Key 到环境变量（zsh/bash）
export GEMINI_API_KEY="$(cat "$(dirname "$0")/api_key.local")"
# 或从项目根目录：
export GEMINI_API_KEY="$(cat .cursor/skills/gemini-image-gen/api_key.local)"

GEMINI_IMAGE_REST_ONLY=1 python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
  "你的英文 prompt" \
  --output assets/ui/xxx.png \
  --aspect-ratio 1:1 \
  --model gemini-3.1-flash-image-preview
```

脚本参数见 `~/.cursor/skills/gemini-image-gen/SKILL.md`（代理、NO_PROXY、REST_ONLY、参考图 `--image` 等）。

## 参考图生图规范

用户提供 UI 原型、截图、风格参考图、角色参考图时，默认必须使用参考图生图：

```bash
GEMINI_IMAGE_REST_ONLY=1 python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
  --prompt-file docs/prompt/xxx_prompt.txt \
  --image /path/to/reference.png \
  --output /Users/huyi/dk_proj/game_assets/xiaochu/assets/backgrounds/sources/xxx_source.png \
  --aspect-ratio 16:9 \
  --model gemini-3.1-flash-image-preview
```

- 高质量 UI / 宣传图优先用 `gemini-3-pro-image-preview` 试一次，不稳定再退回 `gemini-3.1-flash-image-preview`。
- UI 底图、卡面、背景图默认写入：`NO TEXT, no labels, no captions, no writing anywhere in the image`。
- 多张参考图先做 contact sheet，再作为单张 `--image` 输入，避免模型只看其中一张。

## 每日任务图标

1. **原稿**（只写此文件，勿把切图覆盖原稿）  
   `GEMINI_IMAGE_REST_ONLY=1` + `generate_images.py` → `assets/ui/daily_task_icon_source.png`

2. **切图**（读原稿 → 写游戏用图，**不修改原稿**）  
   `python3 scripts/process_daily_task_icon_transparent.py`  
   - 输入默认：`daily_task_icon_source.png`  
   - 输出默认：`daily_task_icon.png`（`constants` / 预加载仍指向此文件）  
   - 抠图与 `~/.cursor/skills/remove-background/SKILL.md` 一致：**`birefnet-general`** + `CPUExecutionProvider`（勿用 CoreML）
