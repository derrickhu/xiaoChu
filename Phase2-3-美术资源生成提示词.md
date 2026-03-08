# Phase 2-3 美术资源生成提示词

> 本文件记录各模块所需美术资源及其 AI 生成提示词（Midjourney / Stable Diffusion 风格）
> 游戏整体风格：**中国古风仙侠水墨**，色调偏暖金/紫/青，UI 边框偏金色系

---

## 一、灵宠池界面

### 1. 灵宠池背景图
- **文件路径**：`assets/backgrounds/petpool_bg.jpg`
- **尺寸建议**：750×1334 px（竖屏）
- **提示词**：
```
Chinese fantasy immortal cultivation scene, a mystical spirit beast sanctuary, floating islands with waterfalls and glowing spirit orbs, soft purple and gold mist, ancient Chinese pavilion in the background, sacred animal statues, ethereal lighting, warm golden and teal color palette, painterly Chinese ink wash style, no text, no characters, game background art, vertical composition --ar 9:16 --s 750
```

### 2. 宠物卡片底图
- **文件路径**：`assets/ui/pet_card_bg.png`
- **尺寸建议**：200×270 px（单张卡片尺寸，透明底 PNG）
- **提示词**：
```
Game card frame template, Chinese ancient jade and gold ornamental border, rectangular card with rounded corners, semi-transparent dark interior, subtle golden cloud patterns on edges, spirit beast card design, Chinese fantasy style, ornate but not overly complex, warm gold and dark brown tones, transparent background, flat vector game UI asset --ar 3:4 --s 500
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
Square game avatar frame, Chinese ancient gold ornamental border, intricate metallic golden dragon cloud motifs, glowing golden edge, transparent center for character portrait, transparent background, game UI icon frame, Chinese fantasy wuxia style, single asset flat design --ar 1:1 --s 500
```
- 木属性替换：`jade green vine and leaf motifs, glowing emerald green edge`
- 水属性替换：`flowing water and wave motifs, glowing ice blue edge`
- 火属性替换：`flame and phoenix motifs, glowing crimson red edge`
- 土属性替换：`mountain and earth crack motifs, glowing amber brown edge`

### 4. 经验池图标
- **文件路径**：`assets/ui/icon_exp_pool.png`
- **尺寸建议**：48×48 px（透明底 PNG）
- **提示词**：
```
Small game icon, glowing blue crystal orb containing swirling energy, Chinese fantasy style, spirit energy essence, game UI icon, transparent background, flat design --ar 1:1 --s 400
```

---

## 使用说明

1. 生成后将图片放入对应路径
2. 背景图使用 JPG 格式（压缩体积），UI 元素使用 PNG 格式（透明底）
3. 头像框需要中心透明，用于叠加在宠物头像上方
4. 卡片底图需要半透明暗色内部区域，文字/图标绘制在其上
