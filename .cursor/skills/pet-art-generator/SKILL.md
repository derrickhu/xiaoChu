---
name: pet-art-generator
description: Generate and process game pet/character art assets using AI image generation (Gemini) with automatic splitting, background removal, and avatar cropping. Use when generating pet art, enemy sprites, character images with avatar+full-body variants, or processing 2:1 combined images for the game.
---

# Pet Art Generator

Generate and process game pet/character art: AI generation → split 2:1 image → remove background → auto-crop → 1:1 avatar.

## Quick Start — Full Pipeline

```bash
python3 {SKILL_DIR}/scripts/generate_pet.py \
    PROMPT_FILE PROJECT_ROOT PET_ID [normal|awakened]
```

**Example:** (run from project root)
```bash
python3 .cursor/skills/pet-art-generator/scripts/generate_pet.py \
    /tmp/rock_badger_prompt.txt \
    . \
    rock_badger \
    normal
```

**Output paths** (per `docs/灵兽秘境敌人美术提示词.md` §六):

| 类型 | 路径 |
|------|------|
| 全身（战斗） | `assets/enemies/stage/{pet_id}.png` 或 `{pet_id}_awakened.png` |
| 头像 | `assets/pets/{pet_id}_avatar.png` 或 `{pet_id}_awakened_avatar.png` |
| 中间产物（2:1 原图） | `tmp/pet_art/{pet_id}_{variant}_combined.png`（不打包） |

## Processing Only (Existing Image)

```bash
python3 {SKILL_DIR}/scripts/process_pet_image.py \
    COMBINED_IMAGE AVATAR_OUTPUT FULL_OUTPUT
```

Processing steps: split → rembg (`birefnet-general`) → trim alpha → avatar 1:1 (top-aligned).

## Prompt Templates

Complete prompt templates for 33 game pets (normal + awakened) are in the project doc:

📄 **`docs/灵兽秘境敌人美术提示词.md`**

**Workflow to generate a pet:**

1. Read the doc to find the pet's character description
2. Combine the universal template (Section 三) + pet description (Section 四) into a prompt file
3. Run `generate_pet.py` with that prompt file

```bash
# 1. Create prompt file (template + character description)
cat > /tmp/rock_badger_prompt.txt << 'EOF'
A single 2:1 landscape image split into two equal halves on one canvas, solid plain single-color background light gray #E0E0E0 across the entire image. Both halves depict the EXACT SAME character with identical design, colors, markings, and accessories — only the framing differs.

LEFT HALF — AVATAR: chibi 2D Chinese ink wash painting style, super deformed cute, big head small body ratio 2:1, close-up of oversized head and upper shoulders filling the left half, expressive ink-painted eyes with reflective highlights.

RIGHT HALF — FULL BODY: the exact same character shown in full body view, front-facing, in a battle-ready combat stance (crouching, pouncing, roaring, or charging), the character fills 70-80% of the right half height. The full body retains ALL decorations, accessories, and design details from the avatar — nothing is removed, only battle posture is added.

UNIFIED STYLE FOR BOTH HALVES: Chinese calligraphy brush-style black ink outlines with varying thickness and expressive brush stroke feel, ink wash coloring with subtle tonal gradation and soft layered shading creating gentle volume and depth, light and shadow through ink density variation — lighter wash on highlights and denser ink in recessed areas, rich color palette mixing traditional Chinese mineral pigments with natural animal tones, Chinese Xianxia mythology aesthetic, NOT Western fantasy, NOT realistic, NOT 3D rendered, clean sharp ink-line edges for easy cutout.

STRICTLY FORBIDDEN: any text, letters, words, writing, watermark, runes, symbols, glyphs, seals, calligraphy marks. STRICTLY FORBIDDEN: white outline outside black ink outlines, white border, white edge glow, white halo, any fringe between outline and background. Also forbidden: glow effects, blur, soft edges, lighting effects. STRICTLY FORBIDDEN: humanoid form, human face, human body. This creature MUST be an ANIMAL or BEAST.

This is the NORMAL base form (not evolved). A young badger spirit with dark brown and sandy-cream fur with rocky plate-like patterns on the back and shoulders, a broad flat head with strong jaw, small sturdy legs with thick claws, large round amber-gold eyes with a stubborn grumpy expression, stone-textured stripe running from nose to tail, short bristly tail, a tiny amber bead on a thin cord around the neck, ink wash brush texture showing volume through tonal shading. FULL BODY BATTLE POSE: low crouching defensive stance with claws dug into the ground, head lowered showing the rocky back plates, fierce determined expression.
EOF

# 2. Generate + process (from project root)
python3 .cursor/skills/pet-art-generator/scripts/generate_pet.py \
    /tmp/rock_badger_prompt.txt \
    . \
    rock_badger \
    normal
```

## Technical Details

| Component | Details |
|-----------|---------|
| Background removal | `rembg` with `birefnet-general` model (~928MB, ~9.5s on Apple Silicon) |
| Execution | CPU-only (`CPUExecutionProvider`), `OMP_NUM_THREADS=8` |
| Avatar cropping | Top-aligned square crop (preserves head/upper body) |
| Image generation | Gemini API via `~/.cursor/skills/gemini-image-gen` |
| Default model | `gemini-3.1-flash-image-preview` (aspect ratio `16:9`) |

## Dependencies

- Python 3.7+, `rembg` >= 2.0, `onnxruntime` >= 1.19, `Pillow`
- User-level skill: `~/.cursor/skills/gemini-image-gen` must be available
