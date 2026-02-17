# 《五行通天塔》UI美术资源设计清单

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

Central composition — a young male xianxia cultivator (black hair, blue-grey Taoist robe) seen from behind, flying upward joyfully on a glowing golden cloud trail toward a magnificent towering pagoda in the upper center. The pagoda is a tall nine-story Five-Element celestial tower (五行通天塔) with each tier subtly tinted in five element colors (gold, green, blue, red, brown from top to bottom), glowing softly with mystical light, partially veiled in swirling clouds.

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

**用途**：首页顶部游戏名称 "五行通天塔"  
**尺寸**：宽高比约 5:1（如 1200×240）  
**文件**：`assets/ui/title_logo.png`（生成后抠图去背景）  
**背景**：纯黑色背景（方便抠图）

```
Chinese calligraphy game title logo "五行通天塔" (five Chinese characters), horizontal layout on a SOLID PURE BLACK background (#000000), flat black with absolutely no texture no gradient no noise:

Style — elegant Chinese brush calligraphy (行书/行楷 semi-cursive style) with xianxia fantasy embellishment. Each character rendered with confident ink brush strokes showing natural ink variation (浓淡干湿). Base ink color: bright off-white with golden tint (#F5E6C8), ensuring strong contrast against the black background.

Decorative effects — subtle golden glow outline around each character edge (not too thick, like gold foil gilding). The five characters subtly incorporate five-element color accents: 五(gold shimmer on strokes), 行(jade green tint on strokes), 通(sky blue tint on strokes), 天(warm coral-red tint on strokes), 塔(earth brown tint on strokes). The color tinting is very gentle and elegant, not overwhelming.

Additional embellishment — very faint golden 祥云 (auspicious cloud) wisps curling around and between the characters. Tiny golden sparkle particles scattered around. A subtle ink-wash splash/splatter effect behind the text adding dynamism.

Overall: majestic yet elegant, readable, beautiful as a game logo. The text should be the clear focal point. Background must be perfectly SOLID PURE BLACK with no variation — for easy chroma-key removal. High resolution, crisp edges.
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

```
A vertical 9:16 mobile game background for a mystical shop scene, Chinese xianxia watercolor ink painting style, warm and mysterious atmosphere:

Upper area (top 20%) — a softly glowing ancient wooden signboard or silk banner faintly visible in the misty background, subtle golden lantern light filtering through from above. Ethereal mist and faint ink-wash clouds in warm amber and soft purple tones.

Middle area — a dreamy impression of an ancient celestial merchant's alcove: faint watercolor silhouettes of wooden shelves along both sides holding glowing mystical items (jade bottles, scrolls, luminous orbs). The shelves are soft, blurred, and atmospheric — NOT detailed or distracting. A warm amber-gold glow emanates from the center, suggesting magical merchandise. Subtle floating golden dust particles. The overall tone is warm but subdued (dark burgundy-purple #3D2040 base with warm golden accents) to allow semi-transparent UI cards to be readable on top.

Lower area (bottom 35%) — gradually fading into deeper darkness with soft purple-brown gradient. Faint suggestion of an ancient stone floor with subtle watercolor texture. A few scattered golden sparkle particles.

Overall: mysterious, inviting, warm. Like entering a hidden immortal's treasure shop in the clouds. Color palette: deep plum-purple, warm amber-gold highlights, soft burgundy. Watercolor ink-wash style with gentle luminosity. NOT too bright — this is a background for overlaid UI elements. No characters, no text, no UI elements. Subtle watercolor paper texture throughout.
```

---

## 六、奇遇事件背景图

**用途**：奇遇事件页面的全屏背景（顶部标题、中间事件描述文字、底部按钮）  
**尺寸**：竖屏 9:16（如 1080×1920）  
**文件**：`assets/backgrounds/adventure_bg.jpg`

```
A vertical 9:16 mobile game background for a mysterious encounter/adventure event scene, Chinese xianxia watercolor ink painting style, ethereal and wondrous atmosphere:

Upper area (top 25%) — a mystical night sky with soft watercolor aurora in pale green, lavender, and gentle gold. Faint constellation patterns and tiny star sparkles. Wispy ink-wash clouds drifting across a deep indigo-blue sky (#1A1A3D).

Middle area — a dreamlike scene of a hidden celestial clearing: faint watercolor impression of an ancient glowing spirit formation (法阵) on the ground, rendered as soft concentric circles of pale blue-green light with subtle Taoist talisman patterns. Gentle luminous mist rising from the formation. On both sides, blurred ink-wash silhouettes of ancient twisted pine trees and mystical rocks, framing the central space. Floating ethereal firefly-like light orbs (pale gold and soft cyan) drifting lazily. The overall tone is cool and mystical (deep teal-indigo base with soft cyan-green and gold accents) — subdued enough for overlaid text to remain readable.

Lower area (bottom 35%) — soft gradient into deeper indigo darkness. Faint watercolor impression of moss-covered ancient stone path. Scattered pale blue luminous particles fading downward.

Overall: mysterious, wondrous, slightly eerie but not threatening — like stumbling upon a hidden magical place during a journey. Color palette: deep indigo-blue, soft teal-cyan, pale gold accents, faint green luminescence. Watercolor ink-wash style. NOT too bright — serves as background for overlaid UI text. No characters, no text, no UI elements. Subtle watercolor paper texture.
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
Square 1:1 ratio decorative frame on a SOLID PURE MAGENTA background (#FF00FF), center area also filled with the same pure magenta (representing transparent area where avatar will show through). Chinese xianxia watercolor ink style, elegant silver-lavender border with delicate ink brush texture, thin refined platinum-white line trim on inner edge, subtle Taoist talisman pattern (道家符文) and wispy cloud motifs in pale lavender-grey watercolor wash along the border, NO corner element icon (unlike pet frames), border color palette: soft silver grey (#B8B8C8) blending with pale lavender (#D4C5E2) fading to off-white cream, very subtle iridescent shimmer effect painted in watercolor style, gentle purple-tinged ink wash accents at corners, rounded corners with graceful ink brush strokes, clean crisp edges, light watercolor paper texture on frame surface, universal neutral tone suitable for all weapon types, no 3D effects, no heavy shadows, no realistic metal reflections, flat painterly style with gentle gradients, slightly more refined and thinner border than pet frames, game UI asset, high resolution. Both the outer background AND the inner center must be perfectly SOLID PURE MAGENTA (#FF00FF) — for easy chroma-key removal.
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
| 9 | 奇遇事件背景 | `assets/backgrounds/adventure_bg.jpg` | JPG | 9:16 竖屏 |
| 10 | 棋盘深色格 | `assets/backgrounds/board_bg_dark.jpg` | JPG | 1:1 |
| 11 | 棋盘浅色格 | `assets/backgrounds/board_bg_light.jpg` | JPG | 1:1 |
| 12 | 金属性灵宠框 | `assets/ui/frame_pet_metal.png` | PNG（品红底抠图） | 1:1 |
| 13 | 木属性灵宠框 | `assets/ui/frame_pet_wood.png` | PNG（品红底抠图） | 1:1 |
| 14 | 水属性灵宠框 | `assets/ui/frame_pet_water.png` | PNG（品红底抠图） | 1:1 |
| 15 | 火属性灵宠框 | `assets/ui/frame_pet_fire.png` | PNG（品红底抠图） | 1:1 |
| 16 | 土属性灵宠框 | `assets/ui/frame_pet_earth.png` | PNG（品红底抠图） | 1:1 |
| 17 | 法宝通用框 | `assets/ui/frame_weapon.png` | PNG（品红底抠图） | 1:1 |
