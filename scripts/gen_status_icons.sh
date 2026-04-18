#!/bin/bash
# 批量生成 8 张战斗状态图标（国风 + 金线 + 主色对应色板）
# 每张 1024x1024（生成后另行下采样到 128x128 交付）

set -e
cd /Users/huyi/dk_proj/xiao_chu
export GEMINI_API_KEY="$(cat .cursor/skills/gemini-image-gen/api_key.local)"

OUTDIR="/Users/huyi/dk_proj/game_assets/xiaochu/assets/ui/battle/status/sources"
mkdir -p "$OUTDIR"

BASE_STYLE="Chinese xianxia battle status icon, game UI, transparent background, centered symbol filling 75% of the frame, thick gold line outline, clean silhouette, flat illustration with subtle gradient, mystical aura, high contrast for in-game readability at 128px, vertically and horizontally centered, no text, no frame, no border decoration"

generate() {
  local name="$1"; shift
  local prompt="$1"; shift
  local outfile="$OUTDIR/status_${name}_source.png"
  if [ -f "$outfile" ]; then
    echo "[skip] $outfile already exists"
    return 0
  fi
  echo "[gen ] $name"
  GEMINI_IMAGE_REST_ONLY=1 python3 ~/.cursor/skills/gemini-image-gen/scripts/generate_images.py \
    "$prompt, $BASE_STYLE" \
    --output "$outfile" \
    --aspect-ratio 1:1 \
    --model gemini-3.1-flash-image-preview || echo "[fail] $name (will retry later)"
}

generate poison "A sinister purple-black poison bottle with a skull silhouette behind, purple smoke rising, dark violet and inky purple color scheme, evil curse aura"
generate defDown "A cracked bronze-grey armor plate with claw marks slashing through, broken defense symbol, grey and dark iron color scheme, shattered shield feeling"
generate healBlock "A dark purple cracked heart with a purple lightning bolt piercing through, healing blocked symbol, deep purple and black color scheme, siphon feel"
generate seal "A blue spiritual rune chain lock, Taoist talisman seal, glowing blue and indigo color scheme, bound symbol with chain rings"
generate stun "Golden rotating stars ring above a dizzy swirl vortex, yellow and gold stun symbol, bright warm color scheme, disoriented feeling"
generate atkBuff "A red flame aura with an upward pointing arrow emerging from it, berserk rage symbol, crimson and orange-red color scheme, powerful offensive feel"
generate shield "A golden six-sided hexagonal barrier with glowing runes, protective shield symbol, gold and bronze color scheme, radiant defensive aura"
generate buff "Two golden upward arrows inside a glowing aura ring, general enhancement symbol, gold and bright yellow color scheme, uplifting feel"

echo "Done."
ls -la "$OUTDIR"