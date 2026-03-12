# Phase 2-3 美术资源生成提示词

> 本文件记录灵宠池与固定关卡模块所需美术资源及其 AI 生成提示词
> 游戏整体风格：**中国水墨淡彩风**，暖米色/宣纸质感为底，淡紫粉云雾、金色点缀
> **必须与首页 `home_bg.jpg` 风格保持一致**，明亮温馨，绝不偏暗黑

### 所有提示词共用风格锚定前缀

```
Chinese traditional ink wash watercolor game UI asset, light and warm color palette,
soft cream/warm beige tones like rice paper texture, pastel pink and lavender cloud
accents, ornamental gold filigree borders with auspicious cloud (祥云) motifs,
ethereal dreamy atmosphere, high quality game art, clean rendering, 2D illustration,
bright and inviting mood NOT dark
```

> 核心原则：整体色调必须与 `home_bg.jpg`（浅暖水墨风）一致，**绝不能偏暗黑**。
> 可在末尾追加风格参考：`style reference: light Chinese ink wash watercolor, warm beige and gold tones, similar to home_bg.jpg`

---

## 一、灵宠池界面

### 1. 灵宠池背景图
- **文件路径**：`assets/backgrounds/petpool_bg.jpg`
- **尺寸建议**：750×1334 px（竖屏），JPG 质量 90%
- **设计要点**：
  1. **与首页/修炼页做冷暖区分**：主基调为淡碧青色/浅翠蓝色（灵池水系意象），不再用暖米色
  2. 场景为灵兽栖息的仙境花园/灵池，有 Q 版圆润可爱的小亭子和灵石
  3. 画面中央和上部大面积留白（浅碧色区域），因 UI 卡片会覆盖
  4. 底部可有淡湖蓝/薄荷绿祥云雾气和一片碧色灵池水面
  5. 2-3 个小光点/灵球散落空中（青金色调），增加灵动感
  6. **不要暗色**、不要太多复杂元素（不要瀑布/浮岛等重元素）
  7. 边框保持金色祥云纹（与全局统一），但整体冷色调要明显区别于首页

- **提示词**：
```
Chinese ink wash watercolor scene background, 750x1334 pixels, vertical portrait
orientation, a bright serene spirit beast sanctuary garden, cute Q-version style
with rounded soft proportions, COOL-TONED color palette dominated by pale teal
and jade-green tones — distinct from the warm beige home page,

the upper area has a luminous sky in soft pale cyan-blue with gentle white and
pastel mint-green auspicious clouds (祥云) in ink wash style, cool silvery-white
moonlight glow streaming from above (not warm golden sunlight),

the middle area is mostly clear and light-colored (留白) with soft pale teal-ivory
base like jade-tinted rice paper texture — this area must stay clean because game
UI cards will overlay here,

the lower area features a gentle shallow spirit pool (灵池) with vivid teal-jade
reflections and gentle ripples, a small cute Q-version stone pavilion on one side,
smooth round spirit stones with faint teal-gold glow, a few tiny adorable spirit
beast silhouettes peeking from behind rocks (very small and subtle), soft pastel
aqua-blue and mint-green cloud wisps at the bottom edges,

2-3 tiny glowing spirit orbs in teal-gold and soft cyan floating gently in the
air, scattered silvery-teal sparkle particles,

color palette: pale jade-teal as base, accents of teal-gold, soft cyan-blue,
pastel mint-green and aqua, ink wash brush texture throughout, bright cool and
refreshing atmosphere DISTINCTLY DIFFERENT from the warm beige home page, NOT dark
NOT moody NOT cluttered NOT realistic, 2D flat watercolor illustration, no
characters no text no UI elements, game background,

style reference: light Chinese ink wash watercolor, cool jade-teal and silver-blue
tones, same art quality as home_bg.jpg but with clearly different cooler palette
```

### 2. 宠物卡片底图
- **文件路径**：`assets/ui/pet_card_bg.png`
- **尺寸建议**：200×270 px（单张卡片尺寸，透明底 PNG）
- **设计要点**：卡片内部用半透明暖米色（非暗色），边框金色祥云纹，与首页按钮风格一致
- **提示词**：
```
Chinese traditional ink wash watercolor game card frame template, 200x270 pixels,
rectangular card with rounded corners, semi-transparent warm ivory-cream interior
like rice paper texture (NOT dark interior), ornamental gold filigree border with
subtle auspicious cloud (祥云) motifs on edges, warm gold and soft beige tones,
the interior should be bright enough for dark text readability, spirit beast card
design, cute rounded proportions, flat 2D game UI asset, bright and warm NOT dark,
on a solid pure bright green (#00FF00) background for easy chroma key removal
```

### 3. 五行属性宠物头像框（5 张，按属性分色）
- **文件路径**：
  - `assets/ui/frame_pet_metal.png`（金 — 金黄色）
  - `assets/ui/frame_pet_wood.png`（木 — 翠绿色）
  - `assets/ui/frame_pet_water.png`（水 — 湖蓝色）
  - `assets/ui/frame_pet_fire.png`（火 — 赤红色）
  - `assets/ui/frame_pet_earth.png`（土 — 赭黄色）
- **尺寸建议**：128×128 px（正方形，透明底 PNG）
- **提示词（以金属性为例，其他替换颜色关键词）**：
```
Chinese ink wash watercolor style square game avatar frame, 128x128 pixels, cute
rounded ornamental border with auspicious cloud (祥云) motifs, warm golden color
with subtle ink wash brush texture, the center is fully transparent for character
portrait overlay, soft golden glow on the border edges, 2D flat game UI icon frame,
bright and warm style matching rice paper beige aesthetic, single asset, no text,
on a solid pure bright green (#00FF00) background for easy chroma key removal
```
- 木属性替换：`jade green color, vine and leaf motifs, soft emerald green glow`
- 水属性替换：`ice blue color, flowing water and wave motifs, soft lake blue glow`
- 火属性替换：`warm crimson red color, flame and phoenix motifs, soft red-orange glow`
- 土属性替换：`amber brown color, mountain and earth motifs, soft warm ochre glow`

### 4. 经验池图标（简洁版）
- **文件路径**：`assets/ui/icon_exp_pool.png`
- **尺寸建议**：64×64 px（透明底 PNG）
- **设计要点**：
  1. **简洁图案**：单个发光的能量水滴/灵珠，不要复杂的漩涡或云雾
  2. **醒目配色**：主色用**金黄色+橙色渐变**，与碧色背景形成强对比
  3. **清晰轮廓**：边缘带白色或金色光晕，从背景中突出
  4. **扁平风格**：2D 图标，不要过多细节和纹理
- **提示词**：
```
Chinese ink wash watercolor style simple game icon, 64x64 pixels, a single glowing
spirit energy droplet or teardrop shape, bright gradient from golden yellow (#FFD700)
at top to warm orange (#FF8C00) at bottom, clean smooth edges with soft white-gold
outer glow for contrast against teal background,

minimal detail with just 2-3 small sparkles around it, no complex patterns or clouds,
flat 2D game UI icon style, bright and eye-catching, high contrast colors distinctly
different from teal-jade background,

on a solid pure bright green (#00FF00) background for easy chroma key removal, no text
```

---

### 11. 返回按钮图标（水墨箭头）
- **文件路径**：`assets/ui/btn_back.png`
- **尺寸建议**：64×64 px（正方形，透明底 PNG）
- **用途**：各页面左上角返回按钮，替换当前纯文字"‹ 返回"
- **设计要点**：
  1. **造型为向左的箭头**，水墨笔刷质感，笔锋自然，不是几何硬边
  2. 主色**深暖棕 / 墨色**（`#4A3020` 或接近墨棕），与暖色背景高对比
  3. 箭头笔画有轻微墨迹晕染感，头部较粗、尾部略细，像毛笔一划而过
  4. 整体简洁：只有箭头，不加文字、不加圆形按钮底框
  5. 缩到 28×28 仍清晰可辨——箭头须粗壮，不能太细
  6. 透明背景，不带任何矩形底色

- **提示词**：
```
A single simple game UI back-button icon, 64x64 pixels, transparent background:

Shape — a bold left-pointing arrow (←) drawn in Chinese ink-brush calligraphy
style: a wide chevron/arrowhead pointing left, with a short horizontal tail stroke
extending to the right. The brushstroke is confident and swift — thicker at the
arrowhead tip, tapering slightly toward the tail, with natural ink-brush edge
variation (slight fibrous texture on the edges, NOT perfectly smooth vector).

Color — deep warm ink-brown (#3D2010) with very subtle warm sepia inner tone,
slight ink-bleed softness at edges. The stroke has gentle ink-wash shading: darker
at the center spine, softly lighter at the stroke edges — like a single confident
brush stroke on paper.

The arrow must be BOLD and thick enough to be clearly visible at 28×28 pixels.
Proportions: the chevron arrowhead occupies roughly 55% of the width, the tail
stroke the remaining 45%, total arrow height about 40% of the canvas.

Style — Chinese ink wash calligraphy brushstroke, warm and refined, NOT geometric,
NOT sharp vector, NOT 3D. The texture is that of a firm ink-loaded brush on rice
paper. Minimal detail — just the arrow stroke, nothing else.

Completely transparent background (PNG alpha), no rounded rectangle frame, no
shadow, no glow, no decorative border. The icon must work placed directly over
any light warm-toned background.

Style reference: warm Chinese ink wash, similar aesthetic to the game's
home_bg.jpg — refined, traditional, bright NOT dark.
```

---

## 使用说明

1. 生成后将图片放入对应路径
2. **场景背景**使用 JPG 格式（质量 90%，压缩体积），**UI 元素**使用 PNG 格式（透明底）
3. **UI 元素抠图流程**：生成时使用**纯亮绿色 (#00FF00) 背景**，生成后去除绿底导出透明 PNG
4. 头像框需要中心透明，用于叠加在宠物头像上方
5. 卡片底图内部区域用暖米色半透明（非暗色），文字/图标绘制在其上
5. 所有素材风格必须与 `home_bg.jpg`（浅暖水墨风）保持一致，**不要偏暗黑**
6. 生成提示词中去掉了 Midjourney 专用参数（`--ar`/`--s`），适配更多生成工具；如用 MJ 可自行追加 `--ar 9:16 --s 750` 等
