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
| 18 | 弹窗面板背景 | `assets/ui/dialog_bg.png` | PNG（纯黑底抠图） | ~4:3 横向 |
| 19 | 确认按钮 | `assets/ui/btn_confirm.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 20 | 取消按钮 | `assets/ui/btn_cancel.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 21 | 战斗胜利弹窗背景 | `assets/ui/victory_panel_bg.png` | PNG（纯黑底抠图） | ~5:2 横向 |
| 22 | 奖励加成卡片背景框 | `assets/ui/reward_card_bg.png` | PNG（纯黑底抠图） | ~7:1 宽扁 |
| 23 | 奖励确认按钮 | `assets/ui/btn_reward_confirm.png` | PNG（纯黑底抠图） | ~3.5:1 横向 |
| 24 | 战斗层数标签框 | `assets/ui/floor_label_bg.png` | PNG（纯黑底抠图） | ~4:1 横向 |
| 25 | 奖励选择页背景 | `assets/backgrounds/reward_bg.jpg` | JPG | 9:16 竖屏 |
| 26 | 说明面板背景 | `assets/ui/info_panel_bg.png` | PNG（纯黑底抠图） | ~4:3 横向 |
| 27 | 小程序展示图 | `assets/ui/share_cover.jpg` | JPG | 5:4 横向 |
| 28 | 小程序图标 | `assets/ui/app_icon.png` | PNG（成品图） | 1:1 正方形 |
