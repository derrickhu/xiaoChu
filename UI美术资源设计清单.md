# 《灵宠消消塔》UI美术资源设计清单

> 整体美术方向：**水彩仙侠风** — 柔和淡雅的中国风水彩/水墨平涂风格  
> 主色调：淡金 / 浅粉 / 薰衣草紫 / 奶白  
> UI主题色：深底 `#0b0b15`，金色强调 `#ffd700`，蓝色信息 `#4dabff`

---

## 一、Loading 页面图

**用途**：游戏启动时的加载页面全屏背景图  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/loading_bg.jpg`

```
A vertical 9:16 mobile game loading screen illustration, Chinese xianxia fantasy watercolor ink style, warm and joyful atmosphere:

Central composition — a young male xianxia cultivator (black hair, blue-grey Taoist robe) seen from behind, flying upward joyfully on a glowing golden cloud trail toward a magnificent towering pagoda in the upper center. The pagoda is a tall nine-story celestial tower with each tier subtly tinted in five element colors (gold, green, blue, red, brown from top to bottom), glowing softly with mystical light, partially veiled in swirling clouds.

Surrounding the flying protagonist — 5 to 7 adorable chibi / SD-style spirit pets (灵宠) flying alongside him in a cheerful scattered formation: a tiny golden qilin, a jade-green baby dragon, a blue water-spirit fox, a red phoenix chick, and a brown stone tortoise cub. All pets are cute, round, big-headed with small bodies, 2D cartoon flat-color style with clean outlines, expressing excitement and joy.

Background — dreamy ethereal sky with layered pastel clouds in soft peach, lavender, and pale gold. Distant floating celestial islands with waterfalls. Gentle god-rays streaming down from above. Faint ink-wash mountain silhouettes in the far distance. Scattered cherry blossom petals and golden sparkle particles drifting in the air.

Overall mood: adventurous, lighthearted, magical, inviting. Soft watercolor paper texture. No text, no UI elements. The lower 40% of the image should be relatively simple (cloud/sky gradient) to accommodate a loading bar overlay.

Style references: Chinese mobile game splash art, watercolor fantasy illustration, Studio Ghibli-inspired warmth, pastel color palette with gold accents.
```

---

## 二、主页背景图

**用途**：进入游戏后的首页背景（上方放标题，中下方放按钮）  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/home_bg.jpg`  

**布局约束**：
- 顶部 0~22% 高度：标题文字区域，背景应留白/简洁
- 中部 48%~75% 高度：功能按钮区域，背景应柔和不抢眼
- 底部 75%~100%：空白渐变区域

```
A vertical 9:16 mobile game home screen background, Chinese xianxia watercolor ink painting style, serene and elegant, soft pastel color palette:

Upper area (top 20%) — open airy sky with very soft pale golden and lavender gradient wash, wispy ink-wash clouds in cream white, leaving clean space for title text overlay. A few faint golden auspicious cloud (祥云) line patterns as subtle decoration.

Middle area — a dreamy distant landscape: a majestic celestial pagoda tower silhouette in soft focus, standing on a floating island among layers of pastel clouds (soft peach, pale lavender, light gold). Gentle ink-wash style. Faint waterfall cascading from the island. A pair of elegant white cranes (仙鹤) flying gracefully in the middle distance. Soft bamboo silhouettes on the sides framing the view, rendered in light sage-green ink wash.

Lower area (bottom 50%) — gradually simplifying into a soft warm gradient: pale cream to light lavender to soft peach, with very subtle watercolor texture. Occasional faint golden sparkle dots. This area must be clean and subdued enough for UI buttons to be placed on top without visual clutter.

Overall: dreamy, ethereal, inviting, peaceful. Soft watercolor paper texture throughout. Warm lighting with gentle god-rays from upper area. Color palette: off-white, pale gold (#F5E6C8), soft peach (#FADCD9), light lavender (#E8D5F5), sage green accents. NO characters, NO pets, NO text, NO UI elements. The image should feel like a beautiful scroll painting backdrop.
```

---

## 三、标题文字美术

**用途**：首页顶部游戏名称 "灵宠消消塔"  
**尺寸**：宽高比约 5:1（如 1200×240）  
**文件**：`assets/ui/title_logo.png`（生成后抠图去背景）  
**背景**：纯黑色背景（方便抠图）

```
Chinese calligraphy game title logo "灵宠消消塔" (five Chinese characters), horizontal layout on a SOLID PURE BLACK background (#000000), flat black with absolutely no texture no gradient no noise:

Style — elegant Chinese brush calligraphy (行书/行楷 semi-cursive style). Each character rendered with confident, SOLID ink brush strokes. The strokes must be OPAQUE and SOLID-FILLED with NO soft gradients, NO feathered edges, NO glow, NO blur. Base color: bright champagne gold (#F5E6C8), completely flat and solid, with HARD CRISP edges against the pure black background. Maximum contrast between text and background — no anti-aliasing haze, no semi-transparent pixels around stroke edges.

Color accents — each character has a SOLID flat color fill (not gradient, not shimmer): 灵(champagne gold #D4AF37), 宠(jade green #5BAD6F), 消(sapphire blue #4A8BC2), 消(coral red #E85D4A), 塔(warm amber #C8956C). The color is applied as a FLAT SOLID FILL across each character's strokes. No blending between colors, no glow, no soft transitions.

Decorative details — ONLY hard-edged, opaque elements: a thin solid gold inline stroke (1-2px) on each character for a carved/engraved feel. Small solid gold diamond/dot accents at stroke intersections. NO outer glow, NO soft shadows, NO particles, NO wisps, NO smoke, NO ink splatter, NO watercolor bleeding, NO semi-transparent effects of any kind.

Overall: majestic yet clean. The text must have perfectly HARD, SHARP, CLEAN edges with zero feathering — like a vector logo or gold-foil stamp, not like a watercolor painting. Background must be perfectly SOLID PURE BLACK (#000000) with absolutely no variation, no texture, no noise. The boundary between text and background must be pixel-sharp for easy and clean chroma-key removal. High resolution, crisp vector-like quality.
```

---

## 四、首页功能按钮（4个）

**用途**：首页主要功能入口按钮  
**尺寸**：宽高比约 3.5:1（如 700×200），圆角矩形  
**整体风格**：水彩仙侠风，与主页背景统一，半透明质感，金色描边  
**背景**：纯黑色背景（方便抠图）

### 4.1 开始挑战按钮

**文件**：`assets/ui/btn_start.png`

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style:

Button shape — elegant rounded rectangle with soft golden border (thin ink-brush style gold line, not metallic). Fill: semi-transparent warm gradient from soft peach-gold (#F5D5A0) on left to pale champagne (#FFF5E1) on right, with subtle watercolor paper texture visible through.

Text — Chinese characters "开始挑战" centered, rendered in elegant dark ink brush calligraphy (semi-cursive 行楷), color deep warm brown (#3D2B1F) with very subtle gold shimmer on stroke edges.

Decorative elements — a small stylized golden pagoda tower icon on the left side of the text. Faint golden 祥云 (auspicious cloud) wisps along the bottom edge. Very subtle golden sparkle particles scattered.

Overall: warm, inviting, the primary/most prominent button. Clean, elegant, clearly readable. Watercolor texture, no heavy 3D bevel, no drop shadow, flat painterly style with gentle glow. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

### 4.2 继续挑战按钮

**文件**：`assets/ui/btn_continue.png`

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style:

Button shape — elegant rounded rectangle with soft golden border (thin ink-brush style gold line). Fill: semi-transparent warm gradient from soft lavender-cream (#EDE3F5) on left to pale ivory (#FFF9F0) on right, with subtle watercolor paper texture.

Text — Chinese characters "继续挑战" centered, elegant dark ink brush calligraphy (semi-cursive 行楷), color deep indigo-brown (#2D2640) with very subtle gold shimmer on stroke edges.

Decorative elements — a small stylized golden sword/剑 icon on the left side of the text, suggesting continuation of adventure. Faint lavender ink-wash accent along the bottom edge. Very subtle golden sparkle particles.

Overall: refined, slightly softer than the start button, secondary action feel. Clean, elegant, clearly readable. Watercolor texture, flat painterly style. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

### 4.3 历史统计按钮

**文件**：`assets/ui/btn_history.png`

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style:

Button shape — elegant rounded rectangle with soft golden border (thin ink-brush style gold line). Fill: semi-transparent cool gradient from pale sage green (#E8F0E4) on left to soft cream (#FFF9F0) on right, with subtle watercolor paper texture.

Text — Chinese characters "历史统计" centered, elegant dark ink brush calligraphy (semi-cursive 行楷), color deep forest green-brown (#2D3B2A) with very subtle gold shimmer on stroke edges.

Decorative elements — a small stylized ancient scroll (卷轴) icon on the left side of the text. Faint sage-green ink-wash accent along the bottom edge. Very subtle golden sparkle particles.

Overall: calm, scholarly feel appropriate for statistics/history. Clean, elegant, clearly readable. Watercolor texture, flat painterly style. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

### 4.4 排行榜按钮

**文件**：`assets/ui/btn_rank.png`

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style:

Button shape — elegant rounded rectangle with soft golden border (thin ink-brush style gold line). Fill: semi-transparent cool gradient from pale sky blue (#E0EBF5) on left to soft cream (#FFF9F0) on right, with subtle watercolor paper texture.

Text — Chinese characters "排行榜" centered, elegant dark ink brush calligraphy (semi-cursive 行楷), color deep navy-brown (#1F2A3D) with very subtle gold shimmer on stroke edges.

Decorative elements — a small stylized golden trophy or jade pendant (玉佩) icon on the left side of the text. Faint sky-blue ink-wash accent along the bottom edge. Very subtle golden sparkle particles.

Overall: prestigious, competitive feel appropriate for leaderboard. Clean, elegant, clearly readable. Watercolor texture, flat painterly style. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

---

## 五、商店背景图

**用途**：神秘商店页面的全屏背景（顶部标题、中间商品卡片、底部按钮）  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/shop_bg.jpg`

**风格参考**：与 loading_bg.jpg 统一——明亮温暖、色彩丰富、Q版灵宠出镜、粉金暖色天空、柔和卡通线条

```
A vertical 9:16 mobile game background for a magical shop scene, bright cheerful Chinese xianxia cartoon style matching the loading screen aesthetic — warm, colorful, inviting, NOT dark:

Upper area (top 20%) — a bright warm sky with soft pastel gradient from pale gold (#F5E6C8) to gentle peach-pink (#FADCD9). Fluffy stylized golden and cream-white clouds (祥云 style, rounded cartoon shapes with clean outlines) drifting across. Warm golden sunlight filtering from above with soft god-rays. A decorative ancient Chinese wooden signboard hangs from golden chains at the top center, painted in warm red-brown with gold trim — reading-area placeholder (no text). Two small red-and-gold paper lanterns (灯笼) flanking the signboard, glowing warmly.

Middle area — a cheerful celestial marketplace scene viewed from inside a cozy immortal's shop pavilion: the left and right edges show warm wooden shelf frames (light honey-brown wood with golden decorative carvings) holding colorful glowing magical items — jade-green potion bottles, golden scrolls, luminous blue orbs, pink crystal gems, amber elixir vials. The shelves are rendered in clean cartoon style with bold outlines, colorful but slightly blurred/soft-focus to not compete with UI overlays. Between the shelves, a warm open space with a soft peach-cream floor glow. A tiny adorable chibi spirit fox (Q版灵狐) merchant sits on a cushion in the background center-right, wearing a tiny golden merchant hat, looking cute and welcoming. Scattered floating golden sparkle particles and tiny glowing fireflies (warm gold). The overall palette is WARM and BRIGHT: honey-amber wood, soft peach, cream-gold light, with colorful magical item accents.

Lower area (bottom 30%) — warm cream-gold gradient fading to soft peach (#FADCD9 to #F5E6C8). Faint watercolor cloud wisps along the bottom. A few colorful sparkle particles (gold, pink, blue) scattered near the bottom. Simple and clean enough for UI buttons to be placed on top. The floor area suggests warm ancient stone tiles with a soft golden glow.

Overall: bright, warm, cheerful, inviting — like visiting a magical candy shop in the clouds. The atmosphere should match the loading screen's joyful, colorful energy. Color palette: warm honey-gold, soft peach-pink, cream white, with colorful magical item accents (jade green, sapphire blue, ruby red). Clean cartoon line-art style with bold outlines, soft watercolor color fills, bright pastel tones. NOT dark, NOT gloomy — this is a happy place to shop. No text, no UI elements. The image has a 35% dark semi-transparent overlay applied in-game for UI readability, so the source image should be BRIGHT and VIBRANT.

Style references: match the loading_bg.jpg aesthetic — bright sky, golden clouds, warm pastel palette, cute chibi characters, clean cartoon outlines, cheerful magical atmosphere.
```

---

## 五·二、休息之地背景图

**用途**：休息之地页面的全屏背景（顶部标题、中间休息选项卡片、底部按钮）  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/rest_bg.jpg`

**风格参考**：与 loading_bg.jpg 统一——明亮温暖、色彩丰富、Q版灵宠出镜、柔和卡通线条，偏宁静温馨

```
A vertical 9:16 mobile game background for a peaceful rest area scene, bright warm Chinese xianxia cartoon style matching the loading screen aesthetic — serene, cozy, heartwarming, NOT dark:

Upper area (top 20%) — a gentle sunset/golden-hour sky with warm gradient from soft lavender-pink (#E8D5F5) at the top to pale peach-gold (#F5DFC8) below. Fluffy stylized clouds in soft pink, cream, and pale gold tones (rounded cartoon shapes with clean outlines), backlit by warm golden light. A few distant birds (仙鹤 silhouettes) flying gracefully across the sky. Tiny golden sparkle particles drifting in the warm air.

Middle area — a dreamy celestial resting garden scene: a beautiful floating island platform with lush green grass, dotted with small pink and white wildflowers (桃花 peach blossoms scattered). In the center-background, a graceful ancient pavilion (凉亭) with curved traditional Chinese rooftops in warm red-brown and gold trim, partially veiled by soft pastel clouds. Warm paper lanterns (soft peach and gold) hanging from the pavilion eaves, glowing gently. On the left side, a small ancient stone well or spring pool with luminous blue-green healing water glowing softly, with tiny sparkle particles rising from the water. On the right side, a cozy arrangement: a bamboo mat with silk cushions in soft lavender and peach, and a tiny adorable chibi spirit tortoise (Q版灵龟) napping peacefully on a cloud-cushion, with a tiny "zzz" sleep bubble — cute and relaxing. A few cherry blossom petals (花瓣) float gently in the air. Soft green bamboo stalks frame both sides. The overall palette is WARM and SERENE: soft greens, peach-pink, lavender, warm gold, cream.

Lower area (bottom 30%) — soft warm gradient from pale sage-green (#E8F0E4) to cream-peach (#FFF5E8). Gentle watercolor cloud wisps and scattered pink flower petals drifting downward. A few golden sparkle particles. Clean and simple for UI overlay.

Overall: peaceful, warm, nurturing, restful — like finding a hidden fairy garden to heal and recover. The atmosphere should evoke comfort and safety while maintaining the loading screen's cheerful, colorful energy. Color palette: soft sage green, warm peach-pink, gentle lavender, cream gold, with healing blue-green water accents. Clean cartoon line-art style with bold outlines, soft watercolor fills, bright pastel tones. NOT dark — this is a place of warmth and healing. No text, no UI elements. A 35% dark overlay will be applied in-game for readability, so the source should be BRIGHT and WARM.

Style references: match the loading_bg.jpg aesthetic — warm pastel sky, golden light, cute chibi spirit pets, clean cartoon outlines, gentle magical atmosphere. Think of it as a celestial hot-spring garden or fairy rest stop.
```

---

## 六、奇遇事件背景图

**用途**：奇遇事件页面的全屏背景（顶部标题、中间事件描述文字、底部按钮）  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/adventure_bg.jpg`

**风格参考**：与 loading_bg.jpg 统一——色彩丰富、Q版灵宠出镜、卡通线条，偏神秘奇幻但仍然明亮

```
A vertical 9:16 mobile game background for a mysterious adventure encounter scene, bright colorful Chinese xianxia cartoon style matching the loading screen aesthetic — wondrous, magical, slightly mystical but NOT dark or gloomy:

Upper area (top 25%) — a twilight fantasy sky with beautiful gradient from soft indigo-purple (#C8B8E8) at the top through lavender (#D8CCF0) to warm peach-gold (#F5DFC8) near the horizon. Stylized fluffy clouds in soft purple, pink, and cream-gold tones (rounded cartoon shapes with clean outlines). A large luminous full moon partially visible in the upper-left, glowing with a warm golden-white halo. Scattered stars rendered as cute twinkling sparkles (golden and silver). Faint aurora-like streaks of soft green and lavender light across the sky.

Middle area — a wondrous hidden clearing in a celestial forest: the scene shows an ancient mystical stone circle (法阵) on the ground, rendered as a glowing circular pattern with soft cyan-blue (#7DD8E8) and pale gold light, with cute simplified Taoist symbols (not scary, playful cartoon style). The stone circle glows warmly upward. Flanking both sides: beautiful ancient trees with twisted trunks (warm brown with golden bark highlights) and luminous leaves in mixed jade-green and soft purple-pink tones, like magical cherry-blossom-meets-wisteria trees. Colorful floating firefly-like light orbs (soft gold, cyan, pink) drift lazily throughout the scene. In the background center, a faint mystical gateway or torii-like arch in soft golden stone, partially veiled by luminous mist, suggesting the unknown adventure ahead. A tiny adorable chibi spirit phoenix chick (Q版凤凰雏) perches curiously on a glowing mushroom (pastel pink cap, golden stem) to the lower-right, looking excited and curious. Scattered glowing flower petals in cyan and gold float in the air.

Lower area (bottom 30%) — a gentle transition from the mystical clearing to soft warm ground: mossy ancient stone path in warm grey-green with tiny glowing blue mushrooms along the edges. Soft luminous mist (warm peach-gold) hovering near the ground. Gradient fading to soft cream-lavender (#EDE3F5) at the bottom. Clean enough for UI overlay.

Overall: wondrous, magical, exciting, mysterious but FRIENDLY — like discovering a secret fairy grove during an adventure. NOT dark or threatening — the mystery is delightful and inviting, matching the loading screen's cheerful spirit. Color palette: soft indigo-purple, warm peach-gold, luminous cyan-blue, jade green, with pink and golden sparkle accents. Clean cartoon line-art style with bold outlines, soft watercolor color fills, vibrant pastel tones. The overall brightness level should be MEDIUM-HIGH — lighter than typical "mystery" scenes because a 35% dark overlay will be applied in-game. No text, no UI elements.

Style references: match the loading_bg.jpg aesthetic — colorful sky, magical atmosphere, cute chibi spirit pet, clean cartoon outlines, warm yet wondrous. Think Studio Ghibli's magical forests meets Chinese xianxia fairy tales.
```

---

## 七、棋盘格贴图（深浅两张）

**用途**：6列×5行棋盘的交替填充贴图  
**尺寸**：1:1 正方形（如 256×256），JPG  
**风格**：水彩仙侠玉石质感，深浅交替拼接  

### 7.1 深色格 `board_bg_dark.jpg`

```
A single square 1:1 tile texture, Chinese xianxia watercolor jade stone style, DARK variant:

Color: medium dusty purple-mauve (#6B5B7B) as base, with subtle darker plum veins and lighter lavender-pink marbling. Resembles a polished piece of soft amethyst jade (紫玉), NOT too dark — should feel like a twilight-toned stone, clearly distinguishable from but harmonious with a pale lavender-pink light tile.

Texture: smooth semi-translucent jade surface with very subtle watercolor wash variation, soft organic veining patterns. Gentle inner luminosity as if the stone glows faintly from within. A few tiny scattered golden fleck particles.

CRITICAL: absolutely NO border, NO edge line, NO frame, NO outline around the tile — the texture must go edge to edge seamlessly. NO central motif, NO icon, NO pattern stamp in the center (game pieces will cover the surface). Pure clean jade texture only.

Overall: elegant, mystical, medium-dark tone (not too heavy). Feels like a precious jade game board piece. Soft painterly watercolor texture, not photorealistic. Suitable for alternating checkerboard pattern with a pale lavender-pink companion tile.
```

### 7.2 浅色格 `board_bg_light.jpg`

```
A single square 1:1 tile texture, Chinese xianxia watercolor jade stone style, LIGHT variant:

Color: soft lavender-pink cream (#D8CDE0) as base, with subtle lighter cream and faint rose-purple marbling. Resembles a polished piece of pale rose quartz jade (淡紫玉).

Texture: smooth semi-translucent jade surface with very subtle watercolor wash variation, soft organic veining patterns. Gentle inner luminosity with a warm creamy glow. A few tiny scattered golden fleck particles.

CRITICAL: absolutely NO border, NO edge line, NO frame, NO outline around the tile — the texture must go edge to edge seamlessly. NO central motif, NO icon, NO pattern stamp in the center (game pieces will cover the surface). Pure clean jade texture only.

Overall: elegant, serene, light and airy. Clear but gentle contrast with the medium-dark purple-mauve companion tile. Soft painterly watercolor texture, not photorealistic.
```

---

## 八、灵宠框（5种属性）

**用途**：队伍栏中灵宠头像的外边框，覆盖在头像上层  
**尺寸**：1:1 正方形（如 512×512）  
**代码约束**：`frameScale = 1.12`（边框比内容大12%）  
**文件路径**：`assets/ui/frame_pet_*.png`（生成后抠图去背景）  
**背景**：纯品红色背景 #FF00FF（洋红幕，避免与任何五行属性色冲突，方便抠图；中心也是纯品红，代表透明区域）

### 8.1 金属性 `frame_pet_metal.png`

```
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, soft warm golden border with delicate ink brush texture, thin elegant gold line trim on inner edge, subtle auspicious cloud (祥云) pattern along the border in light gold watercolor wash, top-left corner: a small circular ink-wash seal stamp icon with a golden metallic symbol inside (stylized gold ingot/元宝), soft golden glow around the seal, border color palette: warm champagne gold (#D4AF37) fading to pale cream, very subtle gold foil flecks scattered on border surface, rounded corners with gentle ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface, no 3D effects, no heavy shadows, no realistic metal reflections, flat painterly style with gentle gradients, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
```

### 8.2 木属性 `frame_pet_wood.png`

```
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, soft jade green border with delicate ink brush texture, thin elegant emerald line trim on inner edge, subtle bamboo leaf and vine watercolor pattern along the border in sage green wash, top-left corner: a small circular ink-wash seal stamp icon with a green wood/leaf symbol inside (stylized bamboo sprout), soft spring-green glow around the seal, border color palette: muted sage green (#7BA05B) fading to pale mint cream, very subtle green watercolor splashes on border surface, rounded corners with gentle ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface, no 3D effects, no heavy shadows, no realistic reflections, flat painterly style with gentle gradients, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
```

### 8.3 水属性 `frame_pet_water.png`

```
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, soft cerulean blue border with delicate ink brush texture, thin elegant sapphire line trim on inner edge, subtle flowing water ripple and wave watercolor pattern along the border in soft blue wash, top-left corner: a small circular ink-wash seal stamp icon with a blue water droplet symbol inside (stylized water wave/水), soft aqua-blue glow around the seal, border color palette: serene sky blue (#5B9BD5) fading to pale ice blue cream, very subtle blue watercolor bleeding effects on border surface, rounded corners with gentle ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface, no 3D effects, no heavy shadows, no realistic reflections, flat painterly style with gentle gradients, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
```

### 8.4 火属性 `frame_pet_fire.png`

```
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, soft warm coral-red border with delicate ink brush texture, thin elegant vermillion line trim on inner edge, subtle stylized flame wisp and phoenix feather watercolor pattern along the border in warm red-orange wash, top-left corner: a small circular ink-wash seal stamp icon with a red flame symbol inside (stylized fire/火), soft warm ember glow around the seal, border color palette: soft coral red (#E07A5F) fading to pale peach cream, very subtle warm watercolor gradients on border surface, rounded corners with gentle ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface, no 3D effects, no heavy shadows, no realistic fire reflections, flat painterly style with gentle gradients, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
```

### 8.5 土属性 `frame_pet_earth.png`

```
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, soft warm brown-amber border with delicate ink brush texture, thin elegant bronze line trim on inner edge, subtle mountain peak and rock texture watercolor pattern along the border in warm ochre wash, top-left corner: a small circular ink-wash seal stamp icon with a brown earth/mountain symbol inside (stylized mountain/山), soft amber glow around the seal, border color palette: warm ochre brown (#C4956A) fading to pale sand cream, very subtle earthy watercolor textures on border surface, rounded corners with gentle ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface, no 3D effects, no heavy shadows, no realistic reflections, flat painterly style with gentle gradients, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
```

---

## 九、法宝框

**用途**：队伍栏中法宝头像的外边框，通用不分属性  
**尺寸**：1:1 正方形（如 512×512）  
**文件**：`assets/ui/frame_weapon.png`（生成后抠图去背景）  
**背景**：纯品红色背景 #FF00FF（洋红幕，方便抠图；中心也是纯品红，代表透明区域）

```
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, warm golden-bronze border with delicate ink brush texture, thin elegant dark gold line trim on inner edge (#B8942D), subtle ancient Taoist talisman pattern (道家符文) and flowing auspicious cloud (祥云) motifs in warm amber-gold watercolor wash along the border, NO corner element icon (unlike pet frames), border color palette: rich warm antique gold (#C9A84C) blending with deep bronze-amber (#A07840) fading to soft champagne cream (#F5E6C8), very subtle golden shimmer effect painted in watercolor style, gentle warm amber ink wash accents at corners with tiny golden sparkle flecks, rounded corners with graceful ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface with warm parchment undertone, universal warm tone harmonizing with the game's overall warm xianxia color palette (matching the golden UI borders, reward cards, and dark indigo-plum backgrounds), no 3D effects, no heavy shadows, no realistic metal reflections, flat painterly style with gentle warm gradients, slightly more refined and thinner border than pet frames, the frame should feel like an ancient celestial artifact holder — warm, precious, and mystical, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
```

---

## 十、确认提示框（弹窗面板 + 操作按钮）

**用途**：游戏内各类确认提示弹窗（如"开始新挑战"、"放弃当前进度"等决策弹窗）  
**整体风格**：水彩仙侠风，与主页背景及首页按钮统一，深色半透明面板 + 金色描边 + 水彩质感  
**背景**：纯黑色背景（方便抠图）

### 10.1 弹窗面板背景

**文件**：`assets/ui/dialog_bg.png`  
**尺寸**：宽高比约 4:3（如 800×600），圆角矩形

```
A horizontal rounded-rectangle game UI dialog panel, approximately 4:3 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor ink style:

Panel shape — elegant large rounded rectangle with double-line golden border: outer line is a thin ink-brush style gold line (#C9A84C), inner line is a thinner pale gold line (#E8D5A0) with ~4px gap between them, creating a refined frame effect. Corner areas have subtle golden 祥云 (auspicious cloud) ornamental flourishes extending slightly beyond the border.

Fill — semi-transparent deep gradient: rich dark indigo-plum (#1A1228) at center blending to slightly lighter warm dark purple-brown (#2A1F35) at edges. Subtle watercolor paper texture visible throughout, with very faint ink-wash cloud wisps (淡墨云纹) in slightly lighter purple-grey drifting across the interior, adding depth without distraction.

Top center — a small decorative golden divider element: a stylized horizontal ink-brush golden line with a tiny golden lotus (莲花) or jade disc (玉璧) motif at its center, serving as a title area separator.

Bottom area — slightly darker gradient fade toward the bottom third, providing visual grounding for button placement.

Decorative details — very faint golden sparkle particles scattered near the border. Subtle ink-wash texture variation across the panel surface. Four corner accents: tiny golden dot or cloud curl at each rounded corner.

Overall: mysterious, elegant, authoritative — appropriate for important game decisions. Dark enough for white/gold text to be clearly readable. Watercolor ink-wash texture, flat painterly style, no 3D bevel, no heavy drop shadow, no metallic sheen. Background must be perfectly SOLID PURE BLACK with absolutely no variation — for easy chroma-key removal.
```

### 10.2 确认按钮

**文件**：`assets/ui/btn_confirm.png`  
**尺寸**：宽高比约 3.5:1（如 700×200），圆角矩形

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style:

Button shape — elegant rounded rectangle with soft golden border (thin ink-brush style gold line, warm gold #C9A84C, not metallic). Fill: semi-transparent warm gradient from soft coral-pink (#F0A8A0) on left to pale peach-cream (#FFE8E0) on right, with subtle watercolor paper texture visible through. A gentle warm glow aura around the entire button edge.



Decorative elements — a small stylized golden checkmark (✓) or auspicious knot (如意结) icon on the left side of the text. Faint coral-pink ink-wash accent along the bottom edge, like a soft watercolor blush. Very subtle golden sparkle particles scattered near the border. Tiny 祥云 (auspicious cloud) wisp curling at the right end.

Overall: warm, decisive, encouraging — the primary action button for confirmations. Warm coral-pink tone conveys positive/affirmative action. Clean, elegant, clearly readable. Watercolor texture, no heavy 3D bevel, no drop shadow, flat painterly style with gentle luminous warmth. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

### 10.3 取消按钮

**文件**：`assets/ui/btn_cancel.png`  
**尺寸**：宽高比约 3.5:1（如 700×200），圆角矩形

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style:

Button shape — elegant rounded rectangle with soft golden border (thin ink-brush style gold line, muted gold #B8A870, slightly less prominent than confirm button). Fill: semi-transparent cool gradient from soft sky-blue (#A8C8E8) on left to pale ice-cream white (#F0F5FF) on right, with subtle watercolor paper texture visible through.



Decorative elements — a small stylized pale blue-silver returning arrow (↩) or crescent moon (弯月) icon on the left side of the text. Faint sky-blue ink-wash accent along the bottom edge, like a soft watercolor wash. Very subtle silver-white sparkle particles scattered. Tiny 祥云 (auspicious cloud) wisp curling at the right end, rendered in pale blue-grey rather than gold.

Overall: calm, neutral, non-intrusive — the secondary action button for cancellation. Cool blue tone conveys caution/retreat without negativity. Visually lighter/less prominent than the confirm button to guide user toward the primary action. Clean, elegant, clearly readable. Watercolor texture, flat painterly style, no 3D effects, no heavy shadows. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

---

## 十一、战斗胜利弹窗背景

**用途**：战斗胜利后弹出的结算面板背景（显示"战斗胜利"文字、速通提示、"选择奖励"按钮）  
**尺寸**：宽高比约 5:2（如 1000×400），圆角矩形，竖向居中显示  
**文件**：`assets/ui/victory_panel_bg.png`（生成后抠图去背景）  
**背景**：纯黑色背景 #000000（方便抠图）

**布局约束**：
- 上部 30%：标题文字区域（"战斗胜利"四字）
- 中部 30%：副标题/速通提示区域
- 下部 40%：按钮区域（放置"选择奖励"按钮）

```
A horizontal rounded-rectangle game UI victory panel, approximately 5:2 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor ink style, celebratory yet elegant:

Panel shape — large rounded rectangle with ornate double-line golden border: outer border is a slightly thick ink-brush style warm gold line (#D4AF37) with subtle calligraphic stroke variation, inner border is a thinner pale champagne-gold line (#E8D5A0) with ~5px gap. Corner decorations: stylized golden 祥云 (auspicious cloud) flourishes extending gracefully from each corner, with tiny golden sparkle dots at the tips.

Fill — rich semi-transparent gradient: deep warm indigo-purple (#1E1430) at center, blending to slightly warmer plum-brown (#2D1F3A) at edges. Overlaid with very subtle watercolor ink-wash texture — faint wispy golden cloud patterns (淡金云纹) drifting across the interior, creating depth without distraction. A gentle warm golden radiance emanating softly from the upper-center area, suggesting triumph and glory.

Top center decoration — an elegant horizontal golden ornamental divider: a stylized ink-brush golden line with a small golden lotus blossom (金莲) or victory knot (如意结) motif at its center, flanked by thin flowing golden lines that taper toward the edges. Above the divider, very faint golden light rays (like subtle god-rays) spreading upward, conveying a sense of achievement.

Bottom area — slightly deeper gradient fading toward warm darkness, providing visual grounding for button placement. A very faint suggestion of golden cloud wisps along the bottom edge.

Ambient details — scattered tiny golden sparkle particles concentrated near the border and upper area. Very subtle warm golden glow around the entire panel edge. Faint watercolor paper texture throughout the panel surface. The overall warmth and golden luminosity should convey victory and celebration while remaining refined and not garish.

Overall: triumphant, warm, celebratory yet elegant — appropriate for a battle victory moment in a xianxia game. Dark enough interior for white/gold text to be clearly readable. Rich golden accents throughout. Watercolor ink-wash texture, flat painterly style, no 3D bevel, no heavy drop shadow, no metallic sheen. Background must be perfectly SOLID PURE BLACK with absolutely no variation — for easy chroma-key removal.
```

---

## 十二、奖励加成卡片背景框

**用途**：战斗胜利后奖励选择界面中，每个可选奖励项（全队加成buff、灵兽选择、法宝选择）的卡片背景框  
**尺寸**：宽高比约 7:1（如 1050×150），宽扁圆角矩形，适配竖屏横向满宽布局  
**文件**：`assets/ui/reward_card_bg.png`（生成后抠图去背景）  
**背景**：纯黑色背景 #000000（方便抠图）

**布局约束**：
- 左侧 15%：图标/标签区域（放置属性图标、"加成"/"⚡速通"标签）
- 中部 60%：主文字区域（奖励名称、效果描述）
- 右侧 25%：辅助信息区域（背包容量、属性提示等）

```
A wide horizontal rounded-rectangle game UI card frame, approximately 7:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor ink style, refined and mystical:

Card shape — elegant wide rounded rectangle (like a horizontal scroll or jade tablet) with a delicate single-line border: thin ink-brush style pale gold line (#C9A84C) with subtle calligraphic variation, slightly thicker at corners tapering to thinner along straight edges. Rounded corners are softly curved, 不 too tight, giving a smooth scroll-like feel.

Fill — semi-transparent deep gradient: a rich dark teal-indigo (#141828) as the base, with a very subtle horizontal gradient — slightly warmer plum tint (#1A1430) on the left side blending to cooler dark blue-grey (#151D2A) on the right side. This gradient provides visual depth and subtle directional flow. Overlaid with very faint watercolor paper texture and barely visible ink-wash cloud wisps.

Left edge accent — a subtle vertical decorative element: a thin golden line segment with a tiny golden jade disc (玉璧) or ruyi (如意) motif at the center of the left edge, serving as a visual anchor for the icon/label area. Very faint golden glow emanating from this accent.

Bottom edge — an extremely subtle warm golden ink-wash stroke along the bottom 10%, like a faint watercolor blush of pale gold (#E8D5A0 at 15% opacity), providing visual grounding.

Right edge — a very faint mirror of the left accent: a tiny golden dot or minimal cloud curl, lighter and less prominent than the left side, maintaining visual balance without competing for attention.

Interior texture — very subtle variations: faint hexagonal or cloud-pattern watermark (暗纹) at ~5% opacity across the surface, like a hidden silk brocade pattern. This adds richness when viewed up close without interfering with overlaid text readability.

Overall: refined, mysterious, collectible-feeling — like a precious jade tablet or celestial scroll. Dark enough for white/gold/colored text to be clearly readable. Subtle golden accents provide elegance without overwhelming. Watercolor ink-wash texture, flat painterly style, no 3D bevel, no drop shadow, no metallic reflections. Must work well when multiple cards are stacked vertically with 10px gaps between them. Background must be perfectly SOLID PURE BLACK with absolutely no variation — for easy chroma-key removal.
```

---

## 十三、奖励选择确认按钮

**用途**：奖励选择界面底部的确认按钮（选定奖励后出现）  
**尺寸**：宽高比约 3.5:1（如 700×200），圆角矩形，与首页按钮风格统一  
**文件**：`assets/ui/btn_reward_confirm.png`（生成后抠图去背景）  
**背景**：纯黑色背景 #000000（方便抠图）

```
A horizontal rounded-rectangle game UI button, 3.5:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor style, celebratory and decisive:

Button shape — elegant rounded rectangle with warm golden border (thin ink-brush style gold line, rich gold #D4AF37, slightly more prominent than standard confirm button to convey importance). Fill: semi-transparent warm gradient from soft amber-gold (#E8C878) on left to pale champagne-cream (#FFF5E0) on right, with subtle watercolor paper texture visible through. A gentle warm golden glow aura around the entire button edge, slightly more luminous than standard buttons.

Text — Chinese characters "确认选择" centered, rendered in elegant dark ink brush calligraphy (semi-cursive 行楷), color deep warm rosewood-brown (#3D1F1F) with subtle gold shimmer on stroke edges.

Decorative elements — a small stylized golden ruyi scepter (如意) or auspicious knot icon on the left side of the text, symbolizing a fortunate choice. Faint amber-gold ink-wash accent along the bottom edge, like a warm watercolor wash. Scattered golden sparkle particles near the border, slightly more abundant than standard buttons. Tiny 祥云 (auspicious cloud) wisp curling at the right end in warm gold.

Overall: warm, decisive, celebratory — the primary action button for confirming a reward choice. Richer golden tone than standard confirm button to match the victory/reward context. Clean, elegant, clearly readable. Watercolor texture, no heavy 3D bevel, no drop shadow, flat painterly style with gentle luminous warmth. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal.
```

---

## 十四、战斗层数标签框

**用途**：战斗界面顶部显示当前层数（如"第 1 层"）的装饰文字框背景  
**尺寸**：宽高比约 4:1（如 480×120），左右对称的横向标签形态  
**文件**：`assets/ui/floor_label_bg.png`（生成后抠图去背景）  
**背景**：纯黑色背景 #000000（方便抠图）

**布局约束**：
- 中央为文字放置区域，需留足空间显示"第 XX 层"文字
- 左右两端可有对称装饰元素（如祥云、如意纹）
- 整体尺寸较小，不可喧宾夺主，需与战斗背景自然融合

```
A horizontal symmetrical game UI label/badge frame, approximately 4:1 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor ink style, compact and elegant:

Shape — a stylized horizontal banner/ribbon form with softly pointed or cloud-curved ends (like a celestial jade tablet 玉牌 or silk ribbon banner 绸带), NOT a simple rectangle. The overall silhouette is wider in the center tapering gracefully toward both ends, giving a flowing banner feel. Thin ink-brush style golden border (#C9A84C) with subtle calligraphic stroke variation following the banner contour.

Fill — semi-transparent deep gradient: rich dark indigo-purple (#1A1228) in the center blending to slightly darker plum (#15101E) at the tapered ends. Very subtle watercolor paper texture visible throughout. Faint ink-wash cloud wisps (淡墨云纹) drifting horizontally across the interior, very subtle and understated.

Left and right end decorations — small symmetrical golden 祥云 (auspicious cloud) curl motifs at each tapered end, rendered in soft ink-brush gold (#D4AF37), delicate and not overly ornate. These serve as visual bookends framing the central text area.

Top and bottom edge — very thin secondary pale gold line (#E8D5A0) running parallel to the main border at ~2px inset, creating a refined double-line frame effect along the longer horizontal edges only. The tapered ends have single-line border only.

Center area — clean and uncluttered, reserved for overlaid text. A very faint golden radiance (like a soft spotlight at ~8% opacity) emanating from the center, ensuring the text area feels subtly highlighted.

Overall: compact, refined, authoritative — like an official celestial rank plaque or floor marker in a tower. Must not be too decorative or large; this is a small informational label, not a major panel. Dark enough for gold/white text to be clearly readable. Watercolor ink-wash texture, flat painterly style, no 3D bevel, no heavy drop shadow, no metallic sheen. Should feel cohesive with the dialog_bg panel and other UI elements in the same xianxia watercolor aesthetic. Background must be perfectly SOLID PURE BLACK with absolutely no variation — for easy chroma-key removal.
```

---

## 十五、奖励选择页背景图

**用途**：战斗胜利后奖励选择页面的全屏背景（顶部标题"战斗胜利 - 选择奖励"、中间奖励卡片列表、底部确认按钮）  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/reward_bg.jpg`

**布局约束**：
- 顶部 0~15% 高度：标题文字区域（"战斗胜利 - 选择奖励"、速通提示），背景应有氛围感但不过于抢眼
- 中部 15%~80% 高度：奖励卡片列表区域（3~4张卡片纵向排列），背景需暗沉柔和，确保卡片内文字清晰可读
- 底部 80%~100%：确认按钮区域，背景应平稳过渡到深色

```
A vertical 9:16 mobile game background for a reward selection / victory loot screen, Chinese xianxia watercolor ink painting style, triumphant yet serene atmosphere with warm golden undertones:

Upper area (top 15%) — a warm celestial sky with soft golden radiance emanating from the upper center, like the afterglow of a victorious battle. Faint ink-wash auspicious clouds (祥云) in warm amber and pale gold drifting gracefully. Very subtle golden light rays (god-rays) streaming downward, conveying glory and achievement. A few tiny golden sparkle particles floating in the warm air. The tone is warm champagne-gold blending into deeper hues below.

Upper-middle area (15%~35%) — transitional zone: the warm golden glow gradually darkens into a rich deep indigo-plum (#1A1430). Faint watercolor ink-wash cloud layers in warm purple-brown tones, creating depth and atmospheric perspective. Very subtle suggestion of distant celestial palace rooftops or pagoda silhouettes in soft golden outline, barely visible through the mist — evoking the tower (通天塔) theme without being literal or distracting. Scattered tiny golden dust particles.

Central area (35%~70%) — the main card placement zone: a deep, rich, subdued background of dark indigo-purple (#141228) with very subtle warm undertone. This area must be DARK and CALM — serving as a neutral canvas for semi-transparent reward cards placed on top. Very faint vertical silk brocade texture (暗纹) at ~3% opacity, like subtle fabric weave, adding tactile richness without visual noise. Extremely subtle horizontal bands of slightly varying darkness (like layered ink-wash strokes), providing gentle visual rhythm that complements vertically stacked cards. A barely perceptible warm golden vignette glow from the edges inward.

Lower area (70%~100%) — gradual descent into deeper darkness: rich plum-black (#0E0A18) with very subtle warm purple-brown gradient. Faint suggestion of stylized golden lotus petals or cloud wisps along the very bottom edge at ~5% opacity, grounding the composition. The bottom 10% should be quite dark and simple for button overlay. Extremely subtle golden sparkle particles near the bottom edge.

Atmospheric details throughout — very faint floating golden motes (like fireflies or spiritual energy particles) scattered sparsely across the entire image, more concentrated near the top and thinning toward the bottom. Subtle ink-wash texture variation across the surface. The overall color journey from top to bottom: warm champagne-gold → amber-plum → deep indigo-purple → plum-black, creating a natural sense of descending from the heavens after victory.

Overall: triumphant, warm, contemplative — like standing in a celestial hall choosing one's reward after a hard-won battle. The mood should be celebratory but refined, not flashy or garish. Warm golden tones dominate the upper portion while the lower 70% is deeply subdued for UI readability. Watercolor ink-wash style with gentle luminosity. Color palette: warm gold (#D4AF37), champagne (#F5E6C8), deep indigo-plum (#1A1430), plum-black (#0E0A18). NO characters, NO pets, NO text, NO UI elements. Subtle watercolor paper texture throughout.
```

---

## 十六、说明面板背景（明亮水彩风）

**用途**：宠物详情、怪物详情、法宝详情等说明弹窗的面板背景，区别于暗色系的确认/操作弹窗  
**尺寸**：宽高比约 4:3（如 800×600），圆角矩形  
**文件**：`assets/ui/info_panel_bg.png`（生成后抠图去背景）  
**背景**：纯黑色背景 #000000（方便抠图）

**设计要求**：
- 与现有暗色弹窗 (`dialog_bg.png`) 形成鲜明对比——**明亮、温暖、淡雅**
- 风格贴近 Loading 页面和首页的水彩仙侠感：淡金、浅粉、薰衣草紫、奶白
- 文字将使用深色（深棕、深金），需确保面板底色足够浅以保证可读性

```
A horizontal rounded-rectangle game UI information panel, approximately 4:3 aspect ratio, on a SOLID PURE BLACK background (#000000), Chinese xianxia watercolor ink style, BRIGHT and WARM — distinctly different from the dark dialog panels:

Panel shape — elegant large rounded rectangle with refined double-line golden border: outer line is a thin ink-brush style warm gold line (#C9A84C) with subtle calligraphic variation, inner line is a thinner pale champagne-gold line (#DAC382) with ~4px gap between them. Corner areas have delicate golden 祥云 (auspicious cloud) ornamental flourishes extending slightly beyond the border, rendered in soft warm gold watercolor.

Fill — BRIGHT semi-transparent warm gradient, resembling an ancient celestial scroll or jade tablet:
- Top area: soft warm cream-white (#F8F0E4) with very subtle warm golden tint
- Upper-middle: gentle transition to pale warm beige (#F5EBE1) 
- Lower-middle: soft lavender-cream (#EEE4F0) blending in, like morning mist on a celestial mountain
- Bottom area: slightly deeper warm lavender-pink (#E8DCeB) providing visual grounding
The overall feel should be like aged rice paper (宣纸) with a warm, luminous quality.

Central glow — a very subtle radial warm golden glow emanating from the upper-center area at ~15% opacity, like sunlight filtering through celestial clouds, adding depth and warmth without being distracting.

Texture overlay — very faint watercolor paper texture throughout the entire panel surface, resembling traditional Chinese rice paper with subtle fiber patterns. Additionally, an extremely subtle silk brocade watermark pattern (暗纹) at ~3% opacity, like hidden cloud or lotus motifs woven into celestial fabric.

Top decorative divider — a delicate horizontal ink-brush golden line below the top area (~15% from top), with a tiny golden diamond/rhombus (菱形) motif at its center, flanked by thin tapering golden lines. This serves as a title separator. The line is rendered in soft watercolor gold (#C9A84C at 40% opacity).

Bottom area accent — an extremely subtle warm golden watercolor wash along the bottom 10% at ~8% opacity, like a faint golden cloud floor, providing gentle visual grounding.

Corner accents — four small golden cloud-curl (祥云) motifs at each rounded corner of the inner border, delicate and refined, rendered in soft gold watercolor. Tiny golden sparkle dots scattered near the corners.

Overall: BRIGHT, warm, elegant, scholarly — like reading a precious celestial scroll or jade tablet. The panel should feel distinctly LIGHTER and MORE INVITING than the dark dialog_bg panel. Think of the warm, inviting palette of the home_bg and loading_bg: off-white (#F8F0E4), pale gold (#F5E6C8), soft peach (#FADCD9), light lavender (#E8D5F5). 

The interior must be light enough for DARK text (deep brown #3D2B1F, dark gold #8B6914) to be clearly and comfortably readable — this is the opposite of the dark panels which use light text. Watercolor ink-wash texture, flat painterly style, no 3D bevel, no heavy drop shadow, no metallic sheen. Gentle warmth and luminosity throughout. Background must be perfectly SOLID PURE BLACK with absolutely no variation — for easy chroma-key removal.
```

---

## 十七、小程序展示图（分享卡片 / 商店封面）

**用途**：微信小程序分享卡片封面图、小程序商店展示截图、社交传播宣传图  
**尺寸**：5:4 横向（如 1280×1024），适配微信分享卡片和小程序详情页展示  
**文件**：`assets/ui/share_cover.jpg`

**设计目标**：
- 一眼吸引人点击，传达"仙侠消除+宠物养成+爬塔"的核心玩法
- 画面精致但不杂乱，焦点集中，信息层次清晰
- 与游戏内水彩仙侠风格高度统一
- 适合在微信聊天列表的小尺寸下依然能看清主体

**构图布局**：
- 左侧 40%：主角修仙者背影/侧身 + 2~3只可爱灵宠环绕
- 右侧 60%：通天塔在云雾中矗立，金光闪耀
- 下方 20%：五色（金木水火土）珠子散落排列，暗示消除玩法
- 上方留空：游戏标题"灵宠消消塔"金色书法字

```
A horizontal 5:4 aspect ratio promotional illustration for a Chinese Xianxia mobile game called "灵宠消消塔" (Spirit Pet Match Tower), watercolor ink painting style, warm dreamy atmosphere with golden highlights, visually striking yet clean and uncluttered:

LEFT SIDE (40%) — A young male Xianxia cultivator seen from a dynamic three-quarter back view, wearing a flowing blue-grey Daoist robe with golden cloud trim, black hair in a topknot with a golden hairpin. He stands confidently on a golden cloud, one hand raised toward the tower. Around him, THREE adorable chibi spirit pets (灵宠) float in a cheerful scattered arc: a tiny golden Qilin cub (金) with a jade pendant, a bright orange fox spirit (火) with a red flame tail tip, and a jade-green baby deer (木) with crystalline antlers bearing tiny flowers. All pets are cute, round, big-headed SD style with 2:1 head-body ratio, clean black outlines, vibrant flat colors — matching the game's pet art style. The cultivator and pets together form a compact, visually readable group.

RIGHT SIDE (60%) — A magnificent celestial pagoda tower rising majestically through layered pastel clouds, slightly off-center to the right. The tower has nine tiers, each subtly tinted in five-element colors from bottom to top: brown-amber (earth), red-coral (fire), blue-teal (water), jade-green (wood), champagne-gold (metal). The tower glows with soft golden inner light, with subtle golden Daoist rune patterns (符文) visible on its surface. Wispy ink-wash clouds in pale peach, lavender and cream surround the tower at various heights. Faint golden god-rays stream down from the tower's peak. A few distant floating celestial islands with waterfalls visible in the far background through the mist.

BOTTOM AREA (lower 15%) — Five translucent glowing elemental orbs (五行珠) scattered in a gentle arc across the bottom: a golden metallic orb, a jade-green wood orb, a sapphire-blue water orb, a coral-red fire orb, and an amber-brown earth orb. Each orb is simple, round, with a subtle elemental symbol inside and a soft color-matched glow. They rest on a bed of soft pastel clouds, subtly suggesting the match-3 puzzle gameplay without being literal game UI. A few golden sparkle particles drift around the orbs.

UPPER AREA (top 20%) — Clean ethereal sky with soft warm gradient from pale gold to lavender. The game title "灵宠消消塔" rendered in elegant Chinese brush calligraphy (行楷 semi-cursive) with warm off-white base color and golden shimmer on stroke edges, positioned in the upper-center area. The five characters have very subtle five-element color tints matching the tower tiers. Faint golden 祥云 (auspicious cloud) wisps frame the title. Below the title, a very small subtitle area for potential tagline text.

OVERALL ATMOSPHERE — Warm, inviting, adventurous, magical. The color palette combines: soft peach (#FADCD9), pale lavender (#E8D5F5), champagne gold (#F5E6C8), warm amber highlights (#D4AF37), with deeper indigo-purple (#1A1430) shadows for contrast. Watercolor paper texture throughout. Soft ink-wash technique with gentle color bleeding at cloud edges. The composition draws the eye naturally from the charismatic pets on the left → up to the cultivator → across to the glowing tower on the right → down to the colorful orbs, creating a natural visual flow.

The image should feel like a beautiful hand-painted scroll illustration that instantly communicates: "a charming Chinese fantasy adventure with cute pets, a mysterious tower to climb, and colorful puzzle elements." NOT cluttered — every element has breathing room. NOT too dark — warm and welcoming. Watercolor ink-wash painting style with Chinese traditional pigment colors. No UI elements, no health bars, no game interface. High resolution, vibrant yet harmonious.

Style references: Genshin Impact promotional art warmth, Chinese mobile game watercolor splash art, Studio Ghibli-inspired charm, traditional Chinese ink painting composition principles (留白 negative space).
```

---

## 十八、小程序图标（App Icon）

**用途**：微信小程序头像图标，显示于聊天列表、发现页小程序入口、搜索结果、分享卡片左下角等  
**尺寸**：1:1 正方形（推荐 512×512 或 1024×1024，微信会自动缩放）  
**文件**：`assets/ui/app_icon.png`（成品图，无需抠图）

**设计目标**：
- 极小尺寸（约40×40px显示）下依然清晰可辨识
- 一眼传达"灵宠 + 消除 + 爬塔"的核心主题
- 与展示图风格统一，水彩仙侠风
- 图标简洁有力，不超过2个主体元素

**构图布局**：
- 中心主体：一座简化的通天塔剪影，3~5层，从底到顶渐变五行色（土→火→水→木→金）
- 塔顶：一颗发光的金色灵珠，散发柔和光晕
- 背景：深靛紫色（#1A1430）圆形底，外圈一圈淡金色祥云纹边框
- 塔身两侧：各一片简化的祥云点缀，增加仙气

### 方案A：暗夜仙侠风（当前方案，偏暗沉）

```
A square 1:1 app icon for a Chinese Xianxia mobile game called "灵宠消消塔" (Spirit Pet Match Tower), designed to be recognizable at very small sizes (40×40px), clean and iconic, emphasizing both cute spirit pets and tower climbing:

BACKGROUND — The entire square canvas is filled with a rich deep indigo-purple gradient (#1A1430 to #2D1B69), giving a mystical night sky feel. A circular border ring in champagne gold (#D4AF37) with subtle traditional Chinese auspicious cloud (祥云) pattern embossed into the border is centered within the square. No transparent areas — the deep purple background extends to all edges and corners of the square canvas, ensuring the icon looks complete on any background color.

CENTER SUBJECT — A stylized, simplified celestial pagoda tower silhouette occupying about 50% of the icon height, slightly off-center to the right. The tower has 5 distinct tiers, each tier a clean geometric shape with slightly curved traditional Chinese roof eaves. Each tier is colored in a different five-element color from bottom to top:
- Tier 1 (bottom): warm amber-brown (#C8956C) for Earth (土)
- Tier 2: coral-red (#E85D4A) for Fire (火)  
- Tier 3: sapphire-blue (#4A8BC2) for Water (水)
- Tier 4: jade-green (#5BAD6F) for Wood (木)
- Tier 5 (top, smallest): champagne-gold (#D4AF37) for Metal (金)

The tower silhouette is clean and graphic — NOT detailed or realistic, but stylized like a logo. Each tier has a subtle inner glow matching its element color.

PET ACCENT — In the lower-left of the icon, a single adorable chibi spirit pet (灵宠) peeks out: a tiny round golden Qilin cub with big sparkly eyes, clean black outlines, cute SD proportions. The pet is small but eye-catching, adding warmth and cuteness that differentiates this icon from generic tower games. The pet and tower together form the two core visual elements.

TOWER TOP — Above the top tier, a single luminous golden orb (灵珠) floats, emitting a soft warm radial glow in concentric circles of gold (#FFD700 to transparent). The orb has a tiny starburst highlight, making it the brightest focal point of the entire icon. Two or three tiny golden sparkle particles float near the orb.

FLANKING ELEMENTS — On each side of the tower, a small simplified stylized cloud wisp (祥云) in soft pale gold (#F5E6C8, semi-transparent) gently curves upward. These clouds are minimal — just 2-3 swirl strokes each — adding an ethereal feel without adding visual noise.

BOTTOM ACCENT — At the base, a very subtle bed of soft pastel clouds in lavender (#E8D5F5, low opacity) creates a gentle foundation, suggesting the tower floats in the heavens. Two or three tiny colorful elemental orbs (五行珠) subtly visible near the base, hinting at the match-3 puzzle gameplay.

OVERALL STYLE — The icon should look like a polished game logo/emblem. Watercolor ink-painting inspired textures but with clean graphic edges suitable for an app icon. The color scheme is predominantly deep purple background with warm gold and five-element colored accents. The design must read clearly at 40×40px — the tower silhouette, golden orb, and cute pet should be immediately recognizable even at tiny sizes. No text in the icon. No complex details that would become muddy at small sizes.

Style: Chinese Xianxia game app icon, watercolor-meets-flat-design hybrid, elegant and mystical with a touch of cuteness from the spirit pet, premium mobile game quality. Think of it as a wax seal or jade pendant design — compact, symbolic, refined.
```

### 方案B：金辉暖阳风（暖色高饱和，金红橙为主）

```
A square 1:1 app icon for a Chinese Xianxia mobile game, designed for maximum visual impact at small sizes (40×40px), warm and vibrant golden-red color scheme, eye-catching on WeChat app list:

BACKGROUND — The entire square canvas is filled with a radiant warm gradient from deep rich crimson-red (#8B1A1A) at the bottom to brilliant amber-gold (#D4920A) at the top, like a glorious sunrise behind celestial mountains. The gradient is VIVID and SATURATED — no dull or muted tones. A thin circular border ring in bright polished gold (#FFD700) with subtle auspicious cloud (祥云) engravings, creating a premium emblem feel. The warm golden light should feel like it's radiating outward from the center.

CENTER SUBJECT — A stylized celestial pagoda tower occupying ~55% of the icon height, centered. The tower has 5 tiers with BRIGHT, VIVID five-element colors that POP against the warm background:
- Tier 1 (bottom): vivid amber-orange (#E8960A) for Earth (土), with warm glow
- Tier 2: brilliant scarlet-red (#FF4444) for Fire (火), with fiery inner glow
- Tier 3: vivid cerulean-blue (#2E9AFF) for Water (水), bright contrast against warm bg
- Tier 4: vibrant emerald-green (#3ACC5C) for Wood (木), fresh and eye-catching
- Tier 5 (top): gleaming bright gold (#FFD700) for Metal (金), the crown jewel

Each tier has a STRONG inner glow and crisp edges. The tower design is bold and graphic — clean geometric shapes with traditional Chinese curved roof eaves, high contrast, reads like a logo mark.

PET ACCENT — In the lower-left, a single adorable chibi spirit pet (灵宠): a tiny round golden Qilin cub with BIG sparkly eyes, rosy cheeks, bright golden body (#FFD54F), clean bold outlines. The pet is vibrant and cute — its warm golden color harmonizes with the background while its big eyes draw attention.

TOWER TOP — A blazing golden orb (灵珠) above the peak, emitting strong radial golden rays (#FFD700 → #FFF8DC → transparent). Prominent starburst highlight with multiple golden sparkle particles. This is the BRIGHTEST point of the icon — like a miniature sun crowning the tower.

FLANKING — Stylized golden cloud wisps (祥云) on each side, rendered in bright warm gold (#FFD700) with good opacity, more visible than subtle. Small red-orange flame-like energy wisps trailing upward from behind the tower, adding dynamism and energy.

BOTTOM — A bed of warm luminous clouds in peach-orange (#FFB366) and soft gold. Three tiny five-element orbs (using the same vivid colors as the tower tiers) nestled in the clouds, glowing brightly.

OVERALL — VIBRANT, WARM, ENERGETIC. The dominant palette is rich crimson, brilliant gold, and fiery amber — like a golden sunset or celestial flame. Every element should be HIGH CONTRAST and HIGH SATURATION. The icon must STAND OUT in a sea of app icons. No text. Clean graphic design with bold colors. Think premium Chinese fantasy RPG game icon — the kind that makes you want to tap it immediately. Polished, vivid, warm, inviting, with a touch of cuteness from the Qilin pet.
```

### 方案C：五彩流光风（五行色彩缤纷，活泼吸睛）

```
A square 1:1 app icon for a Chinese Xianxia mobile game, designed for maximum color impact and instant recognition at small sizes (40×40px), COLORFUL and VIBRANT with all five element colors prominently featured:

BACKGROUND — A dynamic radial gradient from deep royal purple (#3A1078) at the edges to a luminous warm violet (#6B3FA0) in the center, creating depth and richness. A ring of FIVE colored light segments around the circular border, each segment glowing in a vivid five-element color: gold, green, blue, red, amber — like a magical rotating aura. The border ring itself is bright gold (#FFD700) with these colored light accents bleeding outward, creating a rainbow halo effect that is VIVID and attention-grabbing.

CENTER SUBJECT — A celestial pagoda tower occupying ~50% icon height, centered. The tower design is BOLD and COLORFUL:
- Each of the 5 tiers is painted in a VIVID, SATURATED five-element color:
  - Tier 1: bright amber (#FF9900) with golden sparkles
  - Tier 2: vivid coral-red (#FF5252) with tiny flame accents
  - Tier 3: electric blue (#29B6F6) with water ripple shimmer
  - Tier 4: brilliant emerald (#4CAF50) with leaf sparkle accents
  - Tier 5: gleaming gold (#FFC107) with metallic sheen
- Each tier GLOWS brightly with its own color, creating a stack of colorful light. The overall tower looks like a magical rainbow beacon. Clean graphic style with bold outlines.

PET ACCENT — TWO tiny chibi spirit pets flanking the tower base: a round golden Qilin cub (left) and a tiny red phoenix chick (right), both with big shiny eyes, rosy cheeks, vibrant flat colors, bold clean outlines. Their presence adds cuteness and liveliness. Each pet's color matches their element (gold and red), adding to the rainbow effect.

TOWER TOP — A large brilliant golden starburst above the peak, with concentric rings of rainbow-tinted light (gold → red → blue → green cycling outward at low opacity). Multiple golden and multicolored sparkle particles radiating outward. This focal point is DAZZLING — the eye-magnet of the icon.

SURROUNDING ELEMENTS — Five floating elemental orbs arranged in a subtle arc around the tower (like orbiting satellites): each orb is small but BRIGHTLY glowing in its element color (gold, green, blue, red, amber), with tiny trailing light streaks suggesting orbital motion. Soft colorful clouds in pastel pink, lavender, and light cyan drift at the base.

OVERALL — COLORFUL, PLAYFUL, MAGICAL, PREMIUM. This icon should look like a kaleidoscope of beautiful Chinese fantasy colors. The five-element color scheme (金木水火土) should be IMMEDIATELY apparent — this is a game about five elements. Every color is at HIGH SATURATION. The design is clean and graphic despite being colorful — no muddy blending, each color zone is crisp. No text. The icon radiates energy and fun, making it irresistible to tap. Think of it as a magical gemstone or celestial artifact glowing with rainbow elemental power.
```

### 方案D：青碧仙境风（清新翠绿蓝，国风仙气）

```
A square 1:1 app icon for a Chinese Xianxia mobile game, designed for a fresh, mystical, distinctly Chinese fantasy aesthetic at small sizes (40×40px), dominated by vivid jade-green and celestial blue with golden accents:

BACKGROUND — The entire canvas filled with a lush gradient from deep teal (#0D5C63) at the bottom to a luminous celestial cyan-blue (#1A8FA8) in the upper area, evoking a mystical jade mountain spring or immortal's grotto. The colors are SATURATED and VIVID — a refreshing cool palette that stands out among warm-toned game icons. A thin circular border in bright jade-gold (#B8D700 blending to #FFD700), with tiny cloud scroll patterns, giving a precious jade artifact feel.

CENTER SUBJECT — A celestial pagoda tower occupying ~55% height, centered. The tower is painted in a harmonious cool-warm scheme:
- Base tiers in warm amber (#E8A838) and coral (#E86850), grounding with warmth
- Middle tiers in vivid cyan-blue (#2BB5D9) and emerald green (#32B866)
- Top tier and peak in gleaming bright gold (#FFD700)
- Each tier has visible Chinese architectural details (curved eaves, lantern silhouettes) rendered as clean graphic shapes. The tower GLOWS with a soft cyan-green inner light, like a jade structure lit from within.

PET ACCENT — A single adorable chibi spirit pet in the foreground-bottom: a cute jade-green baby dragon (木/水灵宠) with big luminous turquoise eyes, tiny crystal antlers, chubby round body, clean bold outlines. The pet is VIVID jade-green (#3ACC5C) with cyan (#40E0D0) accents — perfectly harmonizing with the cool background while being irresistibly cute. Its eyes sparkle with tiny star highlights.

TOWER TOP — A brilliant golden orb with a halo of cyan-green light rings, creating a unique jade-gold glow effect. Golden sparkle particles mixed with tiny cyan light motes, like fireflies around a sacred jade artifact.

FLANKING — Stylized cloud wisps in TWO tones: jade-green translucent clouds (left) and golden luminous clouds (right), creating visual contrast and balance. Behind the tower, faint ink-wash mountain silhouettes in dark teal, adding depth.

BOTTOM — Luminous cyan-green mist with scattered tiny five-element orbs glowing through the fog. A subtle reflection effect below the tower, like still water.

OVERALL — FRESH, MYSTICAL, DISTINCTLY CHINESE. The jade-green and celestial-blue palette is unique and refreshing — it stands out from the typical red-gold Chinese game icons. The colors are VIVID and SATURATED but harmonious. The icon feels like a precious jade artifact or a window into an immortal's realm. No text. Clean graphic design. Premium quality with a cool, refreshing, magical atmosphere. Think: jade pendant meets celestial observatory — serene yet eye-catching.
```

### 方案E：烈焰霸气风（暗底+高亮火焰，强视觉冲击）

```
A square 1:1 app icon for a Chinese Xianxia mobile game, designed for MAXIMUM visual impact and stop-scrolling effect at small sizes (40×40px), dramatic dark background with blazing bright elements, high contrast:

BACKGROUND — Deep black-purple (#0A0515) filling the entire canvas, extremely dark to maximize contrast with bright foreground elements. A thin circular border alternating between bright gold (#FFD700) and glowing ember-orange (#FF6B1A), with tiny flame-like decorative notches, giving an intense powerful feel. The dark background makes every bright element POP dramatically.

CENTER SUBJECT — A celestial pagoda tower occupying ~55% height, engulfed in spectacular visual effects:
- The tower itself is dark silhouette (#1A1030) with each tier's EDGES and ROOF EAVES outlined in BLAZING five-element neon-bright colors:
  - Tier 1 edge: brilliant amber-orange (#FFA500) with glow
  - Tier 2 edge: intense crimson-red (#FF2D2D) with ember particles
  - Tier 3 edge: electric neon-blue (#00B4FF) with water shimmer
  - Tier 4 edge: vivid lime-green (#39FF14) with leaf sparkles
  - Tier 5 edge: blazing gold (#FFD700) with metallic flash
- The effect is like the tower is RADIATING elemental energy from every tier — bright neon outlines against dark body, extremely high contrast. Visible elemental energy streams flowing upward along the tower surface.

PET ACCENT — A single chibi spirit pet (golden Qilin cub) in the lower area, but rendered with a DRAMATIC golden glow aura — the pet itself is warm gold (#FFD54F) with bright white highlights and a strong golden outer glow, making it look like a small burning star. Big sparkling eyes with visible light reflection. The pet radiates warmth and energy against the dark background.

TOWER TOP — An EXPLOSIVE golden starburst at the peak, with long bright rays extending outward in all directions. The rays have rainbow-tinted tips (red, blue, green) suggesting elemental power. Multiple sizes of golden sparkle particles scattered across the upper portion. This is a DRAMATIC focal point — like a supernova crowning the tower.

ENERGY EFFECTS — Visible swirling energy streams in five element colors orbiting the tower at various heights, like magical aurora trails. These colored light streams are BRIGHT and VIVID against the dark background. Tiny ember-like particles of various elemental colors drifting upward throughout the icon.

BOTTOM — Dark mist with subtle colored light patches from below, as if elemental energy seeps from the ground. The five elemental orbs glow intensely at the base, each casting its own colored light pool on the surrounding dark mist.

OVERALL — DRAMATIC, POWERFUL, EYE-CATCHING. Think OLED screen optimized — dark blacks with BLAZING bright colors create maximum visual impact. The icon should feel like a small explosion of magical energy contained in a frame. No text. The extreme contrast between the near-black background and the neon-bright five-element colors ensures this icon POPS in any app list. Premium quality, bold and dramatic. Think: a magical artifact glowing with barely contained elemental power in darkness.
```

---

## 十九、分享卡片图（3种场景）

> **整体要求**：微信分享卡片在聊天列表中显示非常小（约 300×240 的缩略图），所以设计必须**大字、高对比、视觉冲击力强**，在小尺寸下依然能看清核心信息。不使用 Canvas 动态绘制，直接用预设计的精美图片作为分享封面。

**通用尺寸**：5:4 横向（如 1280×1024），适配微信分享卡片标准比例  
**通用格式**：JPG（高质量压缩，控制在 128KB 以内加快分享加载）

### 19.1 默认邀请分享卡片

**用途**：用户通过微信右上角「···」菜单点击「转发给朋友」时的默认分享封面图  
**设计目标**：吸引从未玩过的人点击，传达"好玩、可爱、有趣"的第一印象  
**文件**：`assets/share/share_default.jpg`  
**风格**：明亮欢快、色彩缤纷、Q萌可爱风——像一张糖果色海报广告

```
A horizontal 5:4 aspect ratio share card image for a Chinese Xianxia mobile puzzle game, designed to be eye-catching and irresistible even at thumbnail size (300×240px), BRIGHT and COLORFUL candy-poster style — NOT the dark moody game UI style:

BACKGROUND — Vivid warm gradient from brilliant golden-orange (#FFB347) at the bottom to bright sky blue (#64B5F6) at the top, with fluffy white and pale pink cartoon clouds scattered throughout. The background is SATURATED and CHEERFUL like a candy advertisement. Rainbow-tinted light rays burst from the center-right area. Scattered golden sparkle particles and tiny colorful confetti pieces float everywhere. Overall feeling: JOYFUL, FESTIVE, ENERGETIC.

LEFT SIDE (45%) — THREE adorable chibi spirit pets (灵宠) in a stacked/overlapping playful group pose, each LARGE and clearly visible even at small sizes:
- Top: A golden Qilin cub with sparkly star-eyes, wearing a tiny golden crown, jumping excitedly with arms raised — bright warm gold (#FFD54F) body
- Middle: A jade-green baby dragon with big turquoise doe eyes, happily hugging a glowing five-color orb — vivid emerald green (#4CAF50)
- Bottom: A coral-red phoenix chick with rosy cheeks and tiny flame wings spread wide — brilliant orange-red (#FF5722)
All pets are LARGE (each ~30% of image height), super cute SD proportions (3:1 head-body ratio), bold clean black outlines, vibrant flat colors, visible sparkle highlights in eyes. They should be the FIRST thing you notice.

RIGHT SIDE (55%) — The celestial pagoda tower in a simplified, BRIGHT, cartoon style (NOT dark/moody), rendered in vivid five-element rainbow colors with each tier glowing brightly. The tower is partially behind colorful clouds, looking magical and inviting. Above the tower, a LARGE blazing golden starburst. Around the tower, floating colorful elemental orbs trailing rainbow light streams.

TOP AREA — Game title "灵宠消消塔" in LARGE bold Chinese characters, warm cream-white with thick golden outline and subtle drop shadow for maximum readability at small size. The characters are BIG — occupying ~15% of image height. Below the title: "快来一起冒险吧!" in smaller but still clearly readable warm white text.

BOTTOM AREA — A row of five LARGE colorful elemental orbs (gold, green, blue, red, amber) bouncing playfully, each with a cute cartoon face (simple dot-eyes and smile), suggesting the match-3 gameplay in a fun way. Behind the orbs: a golden banner ribbon with warm glow.

OVERALL — This card should look like a BRIGHT, FUN, PLAYFUL game advertisement. Think: mobile game ad that makes you want to tap immediately. Color palette is WARM and VIVID: golden orange, sky blue, candy pink, emerald green, coral red. Everything is HIGH CONTRAST and SATURATED. The cute pets are the star — they sell the game. ABSOLUTELY NO dark backgrounds, no moody atmosphere. This is pure joy and color. Must read clearly at tiny thumbnail size in WeChat chat list.

Style references: Candy Crush promotional banners, cute Chinese mobile game ads, Supercell game marketing art (Clash Royale cards), Japanese gacha game splash screens — bright, colorful, irresistible.
```

### 19.2 战绩炫耀分享卡片

**用途**：用户在「我的战绩」页面点击「分享战绩给好友」时的分享封面图，代码会在图片上叠加动态数据文字  
**设计目标**：让人看到好友的成就后产生好奇和竞争欲，"他都打到这了，我也要试试"  
**文件**：`assets/share/share_stats.jpg`  
**风格**：深色大气、金光闪耀、成就感/荣誉感——像游戏内的荣誉证书或段位卡

**布局约束**（代码会在对应区域绘制动态文字）：
- 顶部 15%：标题区域，留给代码绘制"五行通天塔·战绩"
- 中部左 25~45%：大号成就数字区，留给代码绘制"第 XX 层"
- 中部右 55~75%：数据列表区，留给代码绘制统计数据行
- 底部 15%：行动号召区，留给代码绘制"快来挑战通天塔吧！"

```
A horizontal 5:4 aspect ratio share card BACKGROUND image for displaying game achievement data, designed as an elegant dark luxury certificate/honor card, Chinese Xianxia style — this image serves as a BACKGROUND TEMPLATE where dynamic text will be overlaid by code:

OVERALL LAYOUT — The card is divided into visual zones with decorative elements that FRAME empty spaces for text overlay. The design must leave CLEAN, UNCLUTTERED AREAS for text while being visually rich in the decorative borders and corners.

BACKGROUND — Rich deep gradient from dark indigo-purple (#0E0A1E) at edges to slightly warmer plum-black (#1A1230) in the center. A very subtle radial golden glow emanates from the upper-center area at ~8% opacity, creating a warm spotlight effect. Fine watercolor paper texture throughout. Faint traditional Chinese cloud-and-wave pattern (云水纹) as a watermark at ~4% opacity across the entire surface, like a luxury certificate paper.

DECORATIVE FRAME — An ornate golden border system:
- Outer border: elegant ink-brush gold line (#D4AF37) with subtle thickness variation, ~20px from edges
- Inner border: thinner pale gold line (#E8D5A0) with ~8px gap from outer border
- Corner ornaments: elaborate golden 祥云 (auspicious cloud) and ruyi (如意) flourishes at all four corners, extending ~15% into the card. These are the most detailed decorative elements — beautiful Chinese traditional gold filigree patterns
- Top center: a decorative golden crown/lotus motif with radiating golden light rays, serving as a title header ornament. Below it, a thin horizontal golden divider line

LEFT DECORATIVE ZONE (0~20%) — A vertical decorative strip:
- A stylized golden celestial pagoda tower silhouette running vertically along the left side at ~10% opacity, serving as a watermark/background element
- Small golden ruyi knot patterns at 1/3 and 2/3 height positions
- Thin vertical golden accent line separating this zone from the center

CENTER AREA (20~80%) — MUST BE RELATIVELY CLEAN for text overlay:
- Upper center (15~30% height): clean dark space with only very faint golden radiance, reserved for title text
- Middle area (30~70% height): clean dark space with extremely subtle horizontal lines (like ruled paper lines at ~3% opacity in pale gold) suggesting data rows. A very faint vertical divider at ~50% width, separating left achievement zone from right data zone
- Lower area (70~85% height): clean dark space with faint golden cloud wisps at bottom edge

BOTTOM DECORATIVE ZONE (85~100%) — A horizontal decorative footer:
- Warm amber-gold watercolor wash gradient at ~15% opacity
- Small golden flame/phoenix wing motifs at left and right ends
- Center area clean for call-to-action text overlay
- A thin golden horizontal divider line at the top of this zone

RIGHT DECORATIVE ZONE (80~100%) — A subtle vertical accent:
- Faint golden bamboo leaf pattern at ~5% opacity
- Small golden sparkle clusters near corners
- Mirror-balanced with left zone but lighter/simpler

AMBIENT DETAILS — Scattered tiny golden sparkle particles concentrated near the borders and corners (~20 particles total, not cluttered). Very subtle warm golden vignette around the edges. Faint ink-wash cloud wisps in dark purple-grey drifting across the background at ~3% opacity.

OVERALL — This should look like a PREMIUM luxury certificate or honor card background — dark, elegant, gold-accented, prestigious. Think: a royal decree from a celestial emperor, or a Michelin star certificate in Chinese xianxia style. The design is ALL about the ornate golden frame and decorative elements creating an impression of prestige, while the CENTER is intentionally clean and dark for code-rendered dynamic text (white, gold, colored text will be drawn on top). Must be beautiful even before any text is added. High resolution, watercolor ink-wash style with metallic gold accents.
```

### 19.3 通关庆典分享卡片

**用途**：玩家通关（到达30层）后分享时使用的特殊封面图，代码会在图片上叠加"已通关"等动态文字  
**设计目标**：极致的荣耀感和视觉冲击力，让看到的人都想"我也要通关"  
**文件**：`assets/share/share_cleared.jpg`  
**风格**：华丽庆典、金光万丈、烟花绽放——像游戏内的通关CG/大成就解锁画面

**布局约束**（代码会在对应区域绘制动态文字）：
- 顶部 20%：留空给代码绘制"✦ 通关 ✦"大字
- 中部 50%：华丽装饰背景（塔顶、金龙、烟花等），留适当空间给数据文字
- 底部 20%：行动号召区

```
A horizontal 5:4 aspect ratio share card BACKGROUND image for a GAME COMPLETION celebration, designed as a spectacular triumphant achievement screen, Chinese Xianxia fantasy style — the most visually impressive card in the game:

BACKGROUND — Dynamic dramatic gradient: deep cosmic purple-black (#080418) at the outer edges rapidly transitioning to rich warm purple (#2A1050) in the middle ring, then to a BLAZING golden-amber center (#8B6914 at 30% opacity) creating a powerful radial burst effect. The overall impression should be of light EXPLODING from the center outward. Faint celestial star field visible in the darker outer areas — tiny twinkling stars in various colors.

CENTRAL SPECTACLE — The visual focus is a magnificent scene of triumph:
- A stylized celestial pagoda tower top (just the upper 3 tiers visible) in gleaming gold, BURSTING through clouds from the bottom-center. The tower glows with intense golden inner light, with visible golden energy veins and Daoist rune patterns (符文) pulsing across its surface
- From the tower peak, SPECTACULAR golden light rays explode outward in all directions, like a sunrise of pure golden energy. The rays are long, bright, and dramatic — extending to the edges of the image. Some rays have rainbow prismatic edges (red, blue, green tints)
- FIREWORKS: multiple spectacular Chinese-style fireworks (烟花) bursting in the upper area — large golden chrysanthemum bursts, smaller colorful starbursts in five-element colors (gold, green, blue, red, amber). Each firework is rendered in vivid, SATURATED colors with trailing sparks. At least 5-7 distinct firework bursts at various sizes and stages
- GOLDEN DRAGON: a magnificent Chinese dragon (金龙) coiled around or flying above the tower top, rendered in brilliant gold with glowing amber eyes and flowing mane. The dragon is stylized in traditional Chinese art style but with vibrant cartoon clarity — not realistic, but majestic and impressive. It should be clearly visible but not obscure the center text area
- Swirling golden cloud formations (祥云) billow dramatically from both sides, lit from within by golden and amber light, creating a frame around the central spectacle

SPIRIT PETS — 3-4 adorable chibi spirit pets floating/flying in celebration around the scene:
- A golden Qilin cub riding a firework trail, cheering with arms up
- A red phoenix chick with wings spread wide, trailing golden sparkles
- A blue water fox dancing on a golden cloud
- A green baby dragon doing a happy backflip
The pets are rendered in the cute SD style but GLOWING with golden auras — they look like they're celebrating victory. Each pet is small (~8% of image) and positioned around the periphery, not blocking the center.

TOP AREA (0~20%) — Spectacular but with CENTER CLEAN for text overlay:
- Left and right sides: firework bursts and golden cloud formations
- Center: CLEAN dark space (the golden radial glow serves as backdrop) where code will render "✦ 通关 ✦" text. A very subtle golden sparkle rain falling in this area
- A decorative golden laurel wreath (月桂花环) or Chinese victory garland frame loosely encircling the center text area at ~15% opacity — suggesting "champion" without being too prominent

MIDDLE AREA (20~70%) — The most visually spectacular zone:
- The tower, dragon, fireworks, and light rays are all concentrated here
- However, TWO clean vertical strips at ~35% and ~65% width positions remain relatively uncluttered for potential data text overlay (semi-transparent darker patches where the golden glow is slightly subdued)
- Golden confetti and sparkle particles EVERYWHERE in this zone

BOTTOM AREA (70~100%) — Gradually settling from spectacular to warm glow:
- Golden cloud formations forming a soft floor
- Fading firework trails and settling sparkle particles  
- Center area (bottom 15%) relatively clean with warm golden glow for call-to-action text
- Left and right: small golden lanterns (灯笼) and celebration streamers as decorative accents

AMBIENT EFFECTS THROUGHOUT:
- Hundreds of golden sparkle particles of various sizes floating everywhere
- Colorful confetti pieces (gold, red, green, blue) scattered across the image
- Subtle golden lens flare effects near the tower peak
- Warm golden atmospheric haze creating depth and dimension
- Very faint Chinese ink-wash texture underlying everything, maintaining the watercolor aesthetic

OVERALL — This must be the most SPECTACULAR, IMPRESSIVE, VISUALLY STUNNING image in the entire game asset collection. It should make the viewer go "WOW" and feel genuine awe. Think: end-game celebration cutscene meets New Year's Eve fireworks show meets imperial dragon dance festival. The golden color is DOMINANT — this is a shower of gold and light. Every element screams TRIUMPH and CELEBRATION. Must still read well at thumbnail size (300×240px) — the golden explosion and fireworks should be visible even tiny. High resolution, watercolor-meets-digital-painting style, maximum visual impact.

Style references: Genshin Impact wish animation golden screen, League of Legends ranked achievement splash, Chinese New Year celebration posters, Imperial palace golden hall ceiling paintings, fireworks photography composite.
```

### 19.4 分享复活求助卡片

**用途**：玩家第一次死亡时，点击「分享复活」按钮转发给好友的分享封面图  
**设计目标**：用Q萌搞笑的画风制造"好想帮忙"的冲动——灵宠们委屈求助的样子既可爱又好笑，让人忍不住点进来看看  
**文件**：`assets/share/share_revive.jpg`  
**风格**：Q萌搞笑求助风——与默认邀请卡同属明亮可爱体系，但用夸张的"委屈巴巴"表情和温暖色调传达求助感，像表情包一样让人会心一笑

**设计要点**：
- 与游戏整体Q萌画风保持一致，**不用暗黑写实风格**
- 灵宠们是主角——用夸张可爱的委屈/求助表情卖萌，让人心软想帮忙
- 颜色明亮温暖，以暖橙、淡紫、奶白为主，带一点点"呜呜"的搞笑氛围
- 核心文字"快来救我！"要在缩略图下清晰可辨

```
A horizontal 5:4 aspect ratio share card image for a CUTE REVIVAL REQUEST scenario in a Chinese Xianxia mobile puzzle game, designed in an ADORABLE, FUNNY, HEARTWARMING style that matches the game's chibi/Q-cute aesthetic — must make viewers think "aww I want to help!" even at thumbnail size (300×240px):

BACKGROUND — Warm, soft gradient from pale peach-pink (#FFE4D6) at the top to light lavender-purple (#E8D5F0) at the bottom, with fluffy pastel clouds scattered throughout. The overall tone is WARM, SOFT, and INVITING — like a cute sticker or emoji card. Scattered tiny golden sparkle particles and small white star shapes float gently. A few cartoon bandaid (创可贴) stickers and tiny hearts are scattered decoratively in the background at ~15% opacity, adding to the "help me heal" theme. Faint soft-focus bokeh circles in warm peach and lavender.

CENTER (main focus, 60% of image) — THREE adorable chibi spirit pets in an exaggerated "we need help!" group pose, LARGE and clearly visible, super cute SD proportions (3:1 head-body ratio):

- CENTER-TOP: A golden Qilin cub sitting down with HUGE teary puppy-dog eyes (泪汪汪), comically oversized tear drops sparkling at the corners of its eyes, a tiny cartoon bandaid on its cheek, holding up a small hand-written sign that says "救命" (help) in wobbly childlike handwriting. Its expression is the classic "委屈巴巴" meme face — pouty lower lip, big shimmering eyes. A small golden crown sits crooked/tilted on its head.

- CENTER-LEFT: A red phoenix chick lying dramatically on its back with X-shaped dizzy eyes (one eye X, one eye swirl spiral), tongue sticking out slightly, tiny cartoon stars and swirls circling above its head — the classic "knocked out" anime pose. Its small flame wings are droopy and dim. A tiny speech bubble near it says "呜呜~" in cute handwritten style. Despite being "KO'd", it still looks ADORABLE and funny, not sad.

- CENTER-RIGHT: A jade-green baby dragon with big worried eyes, frantically waving its tiny arms, with exaggerated motion lines around its hands showing panic. It has a tiny red cross (十字) first-aid hat on its head, playing "nurse dragon" trying to help its friends. A small heart with a crack in it floats above the dragon, with tiny sparkle particles suggesting it's trying to heal.

All three pets are LARGE (together occupying ~50% of the image area), with bold clean outlines, vibrant flat colors, and maximum cuteness. They should look like LINE/WeChat sticker characters — the kind you want to screenshot and share.

TOP AREA — The text "快来救我！" in LARGE bold rounded Chinese characters, warm coral-orange (#FF6B4A) with white outline and soft drop shadow, slightly tilted at a playful angle. The font style is rounded and bubbly (圆体), matching the cute aesthetic. Below it in smaller warm brown text: "好友助力·满血重生" with tiny golden sparkles around it. A decorative element: two small cartoon hands reaching toward each other from left and right sides of the text (like the "reaching hands" meme), one hand golden (the player), one hand pink with a heart (the friend being asked for help).

LEFT DECORATIVE AREA — A simplified cute version of the celestial pagoda tower, rendered in soft pastel gold and cream colors with rounded edges (not sharp/dramatic), partially hidden behind a fluffy cloud. A small cartoon flag on top of the tower with a heart symbol. The tower looks friendly and inviting, not imposing.

RIGHT DECORATIVE AREA — Floating five-element orbs in pastel candy colors (soft gold, mint green, baby blue, coral pink, warm amber), each with a simple cute face — but they look sleepy/dizzy with half-closed eyes and tiny "zzz" marks, matching the "knocked out" theme. They're arranged in a gentle arc.

BOTTOM AREA — A warm golden-cream banner ribbon with soft edges, containing smaller text space. Decorative elements: tiny cartoon hearts, sparkles, and a small "SOS" in a cute speech bubble. Two small spirit pet paw prints in soft gold as decorative accents.

AMBIENT DETAILS:
- Soft warm bokeh light circles in peach and lavender throughout
- Tiny floating hearts (some cracked/bandaged — cute detail) scattered around
- Small golden sparkle particles concentrated near the pets
- Cartoon-style "action lines" radiating softly from behind the pets for emphasis
- Very subtle confetti in pastel colors at the edges

COLOR PALETTE — Warm and soft, matching the game's friendly aesthetic:
- Primary: warm peach (#FFB89A), soft lavender (#D4B5E8), cream white (#FFF8F0)
- Secondary: coral orange (#FF6B4A), soft gold (#FFD54F), mint green (#A8E6CF)
- Accent: pastel pink hearts, baby blue highlights
- The overall palette is WARM, SOFT, and CHEERFUL — even though it's a "help me" card, it feels lighthearted and fun

EMOTIONAL DESIGN — This card should trigger THREE reactions:
1. "哈哈好可爱" — The exaggerated cute expressions make people smile/laugh
2. "好想帮忙啊" — The puppy-dog eyes and "救命" sign tug at heartstrings
3. "这是什么游戏？好可爱" — The charming art style makes non-players curious

Think: WeChat sticker pack meets cute mobile game ad. The tone is LIGHTHEARTED and FUNNY — it's a "help me" card that makes people SMILE, not feel heavy. Like sending a friend a cute crying cat meme — it's asking for help but in an endearing, shareable way.

MUST READ AT THUMBNAIL SIZE: The "快来救我！" text, the Qilin's teary eyes holding the "救命" sign, and the knocked-out phoenix should all be clearly visible even at 300×240px. Big shapes, high contrast against the soft background, bold outlines.

Style references: LINE Friends / Kakao Friends sticker art, Molly (泡泡玛特) figure expressions, cute Chinese mobile game chibi art (明日方舟 chibi operators, 原神 Q版), WeChat emoticon packs, Japanese kawaii gacha game promotional art.
```

---

## 附录：资源文件清单

| 序号 | 资源名称 | 文件路径 | 格式 | 尺寸比例 |
|------|---------|----------|------|---------|
| 1 | Loading页背景 | `assets/backgrounds/loading_bg.jpg` | JPG | 9:16 竖屏 |
| 2 | 主页背景 | `assets/backgrounds/home_bg.jpg` | JPG | 9:16 竖屏 |
| 3 | 标题文字 | `assets/ui/title_logo.png` | PNG（纯黑底抠图） | ~5:1 横向 |
| 4 | 开始挑战按钮 | `assets/ui/btn_start.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 5 | 继续挑战按钮 | `assets/ui/btn_continue.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 6 | 历史统计按钮 | `assets/ui/btn_history.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 7 | 排行榜按钮 | `assets/ui/btn_rank.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 8 | 商店背景 | `assets/backgrounds/shop_bg.jpg` | JPG | 9:16 竖屏 |
| 9 | 休息之地背景 | `assets/backgrounds/rest_bg.jpg` | JPG | 9:16 竖屏 |
| 10 | 奇遇事件背景 | `assets/backgrounds/adventure_bg.jpg` | JPG | 9:16 竖屏 |
| 11 | 棋盘深色格 | `assets/backgrounds/board_bg_dark.jpg` | JPG | 1:1 |
| 12 | 棋盘浅色格 | `assets/backgrounds/board_bg_light.jpg` | JPG | 1:1 |
| 13 | 金属性灵宠框 | `assets/ui/frame_pet_metal.png` | PNG（品红底抠图） | 1:1 |
| 14 | 木属性灵宠框 | `assets/ui/frame_pet_wood.png` | PNG（品红底抠图） | 1:1 |
| 15 | 水属性灵宠框 | `assets/ui/frame_pet_water.png` | PNG（品红底抠图） | 1:1 |
| 16 | 火属性灵宠框 | `assets/ui/frame_pet_fire.png` | PNG（品红底抠图） | 1:1 |
| 17 | 土属性灵宠框 | `assets/ui/frame_pet_earth.png` | PNG（品红底抠图） | 1:1 |
| 18 | 法宝通用框 | `assets/ui/frame_weapon.png` | PNG（品红底抠图） | 1:1 |
| 19 | 弹窗面板背景 | `assets/ui/dialog_bg.png` | PNG（纯黑底抠图） | ~4:3 横向 |
| 20 | 确认按钮 | `assets/ui/btn_confirm.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 21 | 取消按钮 | `assets/ui/btn_cancel.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 22 | 战斗胜利弹窗背景 | `assets/ui/victory_panel_bg.png` | PNG（纯黑底抠图） | ~5:2 横向 |
| 23 | 奖励加成卡片背景框 | `assets/ui/reward_card_bg.png` | PNG（纯黑底抠图） | ~7:1 宽扁 |
| 24 | 奖励确认按钮 | `assets/ui/btn_reward_confirm.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 25 | 战斗层数标签框 | `assets/ui/floor_label_bg.png` | PNG（纯黑底抠图） | ~4:1 横向 |
| 26 | 奖励选择页背景 | `assets/backgrounds/reward_bg.jpg` | JPG | 9:16 竖屏 |
| 27 | 说明面板背景 | `assets/ui/info_panel_bg.png` | PNG（纯黑底抠图） | ~4:3 横向 |
| 28 | 小程序展示图 | `assets/ui/share_cover.jpg` | JPG | 5:4 横向 |
| 29 | 小程序图标 | `assets/ui/app_icon.png` | PNG（成品图） | 1:1 正方形 |
| 30 | 默认邀请分享卡片 | `assets/share/share_default.jpg` | JPG | 5:4 横向 |
| 31 | 战绩炫耀分享卡片 | `assets/share/share_stats.jpg` | JPG | 5:4 横向 |
| 32 | 通关庆典分享卡片 | `assets/share/share_cleared.jpg` | JPG | 5:4 横向 |
| 33 | 分享复活求助卡片 | `assets/share/share_revive.jpg` | JPG | 5:4 横向 |

---

## 20. Buff奖励图标

**用途**：战斗胜利后三选一奖励中，数值buff类奖励的图标（灵兽和法宝已有头像框，buff类目前只有emoji占位）  
**使用位置**：战斗内胜利面板横排选择框、全屏奖励选择页卡片左侧、左侧全局增益图标列  
**设计目标**：精简、一眼可辨类别，与游戏仙侠Q萌风格统一  
**文件路径**：`assets/ui/buff_icon_[类别].png`  
**尺寸**：64×64px PNG（带透明通道）  
**风格统一要求**：
- 所有图标使用统一的**圆角方形底板**（约56×56内容区 + 4px透明边距），底板颜色根据类别区分
- 图标线条简洁，主体为**单一核心符号**，不超过2种颜色
- 线条粗度统一（2~3px），风格类似游戏内五行属性珠的简笔仙侠风
- 不需要文字，纯图形符号

### 8大类图标

| # | 类别 | 文件名 | 底板色 | 涵盖的buff字段 | 图标设计 |
|---|------|--------|--------|---------------|---------|
| 1 | 攻击强化 | `buff_icon_atk.png` | 暖红 `#5C2020` | allAtkPct, allDmgPct, counterDmgPct, skillDmgPct | 一把向上的小剑，剑身发淡金光芒 |
| 2 | 生命回复 | `buff_icon_heal.png` | 翠绿 `#1E4A2A` | healNow, postBattleHeal, regenPerTurn, fullHeal | 一颗心形，中间有个小十字，淡绿色发光 |
| 3 | 防御减伤 | `buff_icon_def.png` | 靛蓝 `#1E2A4A` | dmgReducePct, nextDmgReduce, grantShield, immuneOnce | 一面小盾牌，中间一个圆形宝石，淡蓝色 |
| 4 | 消除增幅 | `buff_icon_elim.png` | 橙黄 `#4A3A1E` | comboDmgPct, elim3DmgPct, elim4DmgPct, elim5DmgPct, bonusCombo | 三颗品字排列的珠子，中间闪一道连线光，代表消除连击 |
| 5 | 时间操控 | `buff_icon_time.png` | 淡紫 `#3A2A4A` | extraTimeSec, skillCdReducePct, resetAllCd | 一个简笔沙漏，上半流沙中，淡紫色调 |
| 6 | 血量强化 | `buff_icon_hp.png` | 深绿 `#2A4A2A` | hpMaxPct | 一颗大心形加一个向上箭头（↑），表示上限提升，深绿底 |
| 7 | 削弱敌人 | `buff_icon_weaken.png` | 暗紫 `#2A1E3A` | enemyAtkReducePct, enemyHpReducePct, eliteAtkReducePct, eliteHpReducePct, bossAtkReducePct, bossHpReducePct, nextStunEnemy, stunDurBonus | 一个裂开的骷髅/怪物轮廓，带向下箭头（↓），暗紫色 |
| 8 | 特殊效果 | `buff_icon_special.png` | 金色 `#4A3A10` | extraRevive, skipNextBattle, nextFirstTurnDouble, heartBoostPct | 一颗六芒星/仙符，金色发光，代表稀有特殊效果 |

### 图标Prompt（统一风格，一次生成8个）

```
A sprite sheet of 8 game buff icons (arranged in a 4×2 grid on transparent background), each icon is 64×64 pixels, designed for a Chinese Xianxia-themed cute mobile puzzle game. ALL icons share the same unified style:

UNIFIED STYLE RULES:
- Each icon sits on a ROUNDED SQUARE base plate (52×52px content area, 6px corner radius) with a subtle inner glow
- Icon artwork is a SINGLE clean symbol centered on the base plate, using bold simplified line art (2-3px stroke)
- Maximum 2 colors per icon (main color + highlight/accent)
- Style: simplified Chinese ink-brush meets modern flat game UI — clean, readable at 32px display size
- NO text, NO complex details — each icon must be identifiable at thumbnail size
- Slight paper/parchment texture on base plates for Xianxia feel
- Consistent 1px dark border on all base plates

THE 8 ICONS (left-to-right, top-to-bottom):

1. ATTACK BOOST (warm red base #5C2020):
   A small upward-pointing jian sword (Chinese straight sword) in gold (#FFD700), with 2-3 tiny sparkle lines radiating from the blade tip. Simple, bold silhouette.

2. HEALING (jade green base #1E4A2A):
   A heart shape in soft pink-red (#FF8888) with a small white cross (+) in the center. 2-3 tiny green healing particles floating up from the top.

3. DEFENSE (indigo blue base #1E2A4A):
   A simple shield shape in light blue (#88BBFF) with a small circular gem in the center. Clean outline, slightly rounded edges.

4. ELIMINATION BOOST (amber base #4A3A1E):
   Three small orbs arranged in a triangle/pin formation (representing puzzle pieces), connected by a thin golden lightning line between them. Orbs in warm orange (#FFAA44).

5. TIME CONTROL (soft purple base #3A2A4A):
   A simple hourglass shape in lavender (#BB99FF), with tiny sand particles visible in the upper chamber. Clean geometric design.

6. HP MAX UP (deep green base #2A4A2A):
   A large heart shape in bright green (#66DD66) with a bold upward arrow (↑) overlapping the top-right of the heart. Arrow in white.

7. ENEMY WEAKEN (dark purple base #2A1E3A):
   A simplified monster/skull face outline in pale purple (#AA88CC) with a downward arrow (↓) next to it. The face has X-eyes or cracked appearance.

8. SPECIAL EFFECT (gold base #4A3A10):
   A six-pointed star (hexagram) in bright gold (#FFD700) with a subtle glow effect. Center has a tiny Yin-Yang or Bagua symbol hint.

IMPORTANT: All 8 icons must look like they belong to the SAME icon set — consistent line weight, consistent padding within base plates, consistent level of detail. They should work as a cohesive set when displayed together in the game UI.

Output: PNG with transparent background, 256×128 total (4 columns × 2 rows, each cell 64×64).
```

### buff字段 → 图标映射表（代码使用）

| buff字段 | 图标类别 | 图标文件 |
|----------|---------|---------|
| `allAtkPct` | 攻击强化 | `buff_icon_atk.png` |
| `allDmgPct` | 攻击强化 | `buff_icon_atk.png` |
| `counterDmgPct` | 攻击强化 | `buff_icon_atk.png` |
| `skillDmgPct` | 攻击强化 | `buff_icon_atk.png` |
| `healNow` | 生命回复 | `buff_icon_heal.png` |
| `postBattleHeal` | 生命回复 | `buff_icon_heal.png` |
| `regenPerTurn` | 生命回复 | `buff_icon_heal.png` |
| `dmgReducePct` | 防御减伤 | `buff_icon_def.png` |
| `nextDmgReduce` | 防御减伤 | `buff_icon_def.png` |
| `grantShield` | 防御减伤 | `buff_icon_def.png` |
| `immuneOnce` | 防御减伤 | `buff_icon_def.png` |
| `comboDmgPct` | 消除增幅 | `buff_icon_elim.png` |
| `elim3DmgPct` | 消除增幅 | `buff_icon_elim.png` |
| `elim4DmgPct` | 消除增幅 | `buff_icon_elim.png` |
| `elim5DmgPct` | 消除增幅 | `buff_icon_elim.png` |
| `bonusCombo` | 消除增幅 | `buff_icon_elim.png` |
| `extraTimeSec` | 时间操控 | `buff_icon_time.png` |
| `skillCdReducePct` | 时间操控 | `buff_icon_time.png` |
| `resetAllCd` | 时间操控 | `buff_icon_time.png` |
| `hpMaxPct` | 血量强化 | `buff_icon_hp.png` |
| `enemyAtkReducePct` | 削弱敌人 | `buff_icon_weaken.png` |
| `enemyHpReducePct` | 削弱敌人 | `buff_icon_weaken.png` |
| `eliteAtkReducePct` | 削弱敌人 | `buff_icon_weaken.png` |
| `eliteHpReducePct` | 削弱敌人 | `buff_icon_weaken.png` |
| `bossAtkReducePct` | 削弱敌人 | `buff_icon_weaken.png` |
| `bossHpReducePct` | 削弱敌人 | `buff_icon_weaken.png` |
| `nextStunEnemy` | 削弱敌人 | `buff_icon_weaken.png` |
| `stunDurBonus` | 削弱敌人 | `buff_icon_weaken.png` |
| `extraRevive` | 特殊效果 | `buff_icon_special.png` |
| `skipNextBattle` | 特殊效果 | `buff_icon_special.png` |
| `nextFirstTurnDouble` | 特殊效果 | `buff_icon_special.png` |
| `heartBoostPct` | 特殊效果 | `buff_icon_special.png` |

---

## 21. 道具系统图标

**用途**：战斗界面右下角宝箱按钮 + 道具选择菜单中的道具图标  
**使用位置**：战斗场景敌人区域右下角（宝箱入口按钮）、道具菜单弹窗卡片左侧（道具图标）  
**设计目标**：一眼辨识，与游戏仙侠Q萌风格统一，色调温暖有质感  
**文件路径**：`assets/ui/icon_chest.png`、`assets/ui/icon_item_reset.png`、`assets/ui/icon_item_heal.png`  
**尺寸**：64×64px PNG（带透明通道）

### 3个图标详细设计

| # | 图标名称 | 文件名 | 设计描述 |
|---|---------|--------|---------|
| 1 | 灵宝匣（宝箱） | `icon_chest.png` | 一个Q版仙侠风小宝箱，箱体为深木色带金属包边，箱盖微微打开露出金光。箱体正面有一个小锁扣/太极纹章装饰。整体圆润Q萌，发淡金色光芒，底色透明。线条2-3px，简笔仙侠风。 |
| 2 | 乾坤重置 | `icon_item_reset.png` | 圆角方形底板（淡蓝色 `#1E3A5A`），中央一个八卦/太极图案，两条弧形箭头环绕形成旋转循环符号。箭头为亮蓝色（`#66CCFF`）带白色高光。代表"天地翻转、重排乾坤"。简洁2-3px线条，无文字。 |
| 3 | 回春妙术 | `icon_item_heal.png` | 圆角方形底板（翠绿色 `#1E4A2A`），中央一朵盛开的灵芝/莲花，花瓣为嫩绿色（`#44FF88`）带白色高光，花心有一个小小的心形或十字符号。2-3条向上飘散的绿色光点代表治愈灵气。简洁2-3px线条，无文字。 |

### 图标Prompt（统一风格，一次生成3个）

```
A sprite sheet of 3 game item icons (arranged in a 1×3 row on transparent background), each icon is 64×64 pixels, designed for a Chinese Xianxia-themed cute mobile puzzle game. ALL icons share the same unified style:

UNIFIED STYLE RULES:
- Clean, bold simplified line art (2-3px stroke), cute and readable at 32px display size
- Style: simplified Chinese ink-brush meets modern flat game UI — Xianxia Q-cute (仙侠Q萌)
- NO text, NO complex details — each icon must be identifiable at thumbnail size
- Slight paper/parchment texture feel, warm and magical atmosphere
- Consistent 1px dark border on base plates where applicable

THE 3 ICONS (left-to-right):

1. TREASURE CHEST (灵宝匣) — NO base plate, standalone icon:
   A cute rounded treasure chest made of dark wood (#5A3A1E) with golden metal trim (#D4A844). The lid is slightly ajar, revealing a bright golden glow (#FFD700) emanating from inside. A small Taiji (太极) symbol ornament on the front latch. The chest has a warm, inviting magical feel. Rounded corners, cute proportions (slightly wider than tall). 2-3 tiny gold sparkle particles around the opening.

2. BOARD RESET (乾坤重置) — on rounded square base plate (light blue-navy #1E3A5A):
   Two curved arrows forming a circular rotation symbol (♻-like but with only 2 arrows), colored in bright cyan (#66CCFF) with white highlights on arrow tips. In the center of the rotation, a tiny simplified Bagua/Taiji motif. Represents "heaven and earth reshuffled." Clean geometric design.

3. FULL HEAL (回春妙术) — on rounded square base plate (jade green #1E4A2A):
   A blooming Lingzhi mushroom (灵芝) or lotus flower in bright green (#44FF88) with white petal highlights. A small heart or cross symbol at the flower's center in pink-white. 2-3 tiny green healing particles floating upward from the flower. Represents magical healing spring. Soft, soothing feel.

IMPORTANT: All 3 icons must look like they belong to the SAME icon set as the existing buff icons — consistent line weight, consistent level of detail. The treasure chest is a standalone button icon (no base plate), while the two item icons have base plates matching the buff icon style.

Output: PNG with transparent background, 192×64 total (3 columns × 1 row, each cell 64×64).
```

### 附录资源清单补充

| 序号 | 资源名称 | 文件路径 | 格式 | 尺寸比例 |
|------|---------|----------|------|---------|
| 34 | 灵宝匣图标 | `assets/ui/icon_chest.png` | PNG（透明底） | 1:1 正方形 |
| 35 | 乾坤重置图标 | `assets/ui/icon_item_reset.png` | PNG（透明底） | 1:1 正方形 |
| 36 | 回春妙术图标 | `assets/ui/icon_item_heal.png` | PNG（透明底） | 1:1 正方形 |
