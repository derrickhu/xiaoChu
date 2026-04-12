---
name: battle-damage-float-pd-style-proposal
overview: 为战斗中的宠物区跳字与总伤区跳字提出一份独立视觉方案，重点讨论停留时长、智龙迷城风格的上跳回弹、以及更明显的暴击强化表现，确认后再实施。
todos:
  - id: review-float-chain
    content: 用 [subagent:code-explorer] 复核飘字、暴击与状态机链路
    status: pending
  - id: confirm-animation-tier
    content: 确定宠物区、总伤区、暴击三类动效标准档
    status: pending
    dependencies:
      - review-float-chain
  - id: tune-float-motion
    content: 改造 dmgFloat.js 与 animations.js 动作曲线
    status: pending
    dependencies:
      - confirm-animation-tier
  - id: adjust-battle-timing
    content: 调整 main.js 与 battle.js 展示时序
    status: pending
    dependencies:
      - tune-float-motion
  - id: enhance-crit-feedback
    content: 强化 render、battleComboView、battleTeamBarView 暴击反馈
    status: pending
    dependencies:
      - tune-float-motion
      - adjust-battle-timing
---

## User Requirements

- 针对战斗中的两个跳字区域，单独整理一份可讨论方案，不直接动工。
- 宠物区跳字需要停留更久，并强化为“先上跳出框、再回弹进框内、停顿一下、再逐渐消失”的节奏。
- 总伤区跳字也需要停留更久，但应与宠物区区分层次，避免主视区过满。
- 需要确认宠物区当前是否已有暴击表现，并提出更明显的暴击演出方案。

## Product Overview

- 本方案聚焦战斗中“宠物区跳字、总伤区跳字、暴击反馈”三部分的动效升级。
- 视觉上强调更清晰的伤害确认感、更有节奏的跳字停顿，以及更明显的暴击爆发感，同时保持战斗信息可读性。

## Core Features

- 宠物区跳字升级为更明显的上跳、回弹、停留、淡出流程。
- 总伤区跳字延长停留时间，并优化淡出节奏。
- 暴击效果从现有基础上增强，加入更强的爆闪、震动或局部光效层次。
- 输出保守、标准、夸张三档可讨论方案，便于先定体验再施工。

## Tech Stack Selection

- 现有项目为 JavaScript 游戏工程，使用自研 Canvas 渲染与主循环更新。
- 已确认的核心链路：
- 伤害跳字配置与创建：`/Users/huyi/dk_proj/xiao_chu/js/engine/dmgFloat.js`
- 跳字逐帧更新：`/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js`
- 状态机时序：`/Users/huyi/dk_proj/xiao_chu/js/main.js`
- 宠物区与总伤触发：`/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js`
- 飘字渲染：`/Users/huyi/dk_proj/xiao_chu/js/render.js`
- 宠物槽位锚点绘制：`/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleTeamBarView.js`
- 现有全屏闪光/光斑：`/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleComboView.js`
- 闪屏与反馈事件分发：`/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js`

## Implementation Approach

先沿用现有“配置驱动的飘字系统”，在不新增第二套动画框架的前提下，对宠物区、总伤区、暴击区分别做参数分层和少量状态机配套调整。核心思路是：宠物区强化为明显的“上跳出框→回弹回槽→框内停顿→渐隐”，总伤区只延长停留与淡出，不完全照搬宠物区回框逻辑；暴击则在现有大字、抖动、发光基础上增加一层更强的局部爆发反馈。

### Key Technical Decisions

- **优先复用 `dmgFloat.js` 的 `MOTION_PRESETS`**  
当前宠物区已存在 `riseFrames / returnFrames / holdFrames / lifeFrames / fadeStart` 结构，适合直接强化，不应另起一套专用动画系统。
- **必须同步调整状态机时序，而不是只改动效参数**  
当前 `main.js` 中：
- `petAtkShow` 仅 16 帧
- `preAttack` 仅 8 帧  
这会截断宠物区动效观感。若不配套调整，延长 `lifeFrames` 体感提升有限。
- **总伤区与宠物区分开处理**  
宠物区有头像框锚点，适合做“跳出再回框”；总伤区位于敌方主区域，推荐“更长停留 + 更慢淡出 + 更强暴击爆闪”，避免中心视觉过于来回弹跳。
- **暴击增强优先复用现有反馈通道**  
当前暴击已有：
- `slotDamageCrit / damageCrit` 字体参数
- `_shakeOffset` 抖动
- `emitFlash(g, 'combo')`
- `emitNotice(... '暴击！')`
- `emitShake(...)`  
推荐在此基础上增加“局部光爆/冲击环/槽位脉冲”之一，避免引入重型粒子系统。

### Recommended Discussion Proposal

#### 方案 A：保守档

- 宠物区：只延长 `holdFrames / lifeFrames / fadeStart`，略增 `riseDist`。
- 总伤区：只延长 `lifeFrames / fadeStart`。
- 暴击：小幅提升字号、glow、shake。
- 优点：风险低，节奏变化小。
- 缺点：与用户想要的“智龙迷城式跳出回弹”差距较大。

#### 方案 B：标准档

- 宠物区：强化为明显上跳、回弹入框、框内停顿、慢淡出。
- 总伤区：延长停留，增加轻微 settle 感，但不做深回弹。
- 暴击：增加更明显的光爆、震动、描边高光，必要时增加宠物槽位局部脉冲。
- 优点：最符合当前诉求，改动集中、风险可控。
- 缺点：需要同时校准 `petAtkShow / preAttack` 节奏。

#### 方案 C：夸张档

- 宠物区：更大幅度跳出、回弹、冲击残影。
- 总伤区：暴击时叠加更强白闪、外扩环、长停顿。
- 暴击：局部与全屏反馈同时加强。
- 优点：打击感最强。
- 缺点：更可能打乱现有战斗节奏，视觉噪声和性能压力更高。

### Recommended Final Direction

建议优先讨论并落地 **方案 B（标准档）**：

- 宠物区：明显上跳回弹，回框后停 6 到 10 帧，再渐隐。
- 总伤区：延长停留，但不做宠物区式深回框。
- 暴击：加强字效、局部爆闪与震动，不直接堆大量粒子。

### Performance & Reliability

- 当前更新为按帧遍历 `g.dmgFloats` 与 `g._petSlotFloats`，复杂度为 **O(n)**；方案应尽量保持这一结构不变。
- 应优先通过参数与轻量 flash 达成效果，避免为每个宠物暴击新增大量粒子对象。
- `render.js` 已有飘字 sprite/cache 路径，适合继续复用，避免频繁创建昂贵文本贴图。
- 风险点主要在于：

1. `petAtkShow` 时长过长导致战斗节奏变慢；
2. 总伤暴击过亮影响敌方受击信息读取；
3. 宠物区多个数字同时出现时出现遮挡。  
建议通过“单档参数表 + 小步调节”控制爆炸半径。

## Implementation Notes

- 不建议一开始改所有跳字，只改 `slotDamageMain / slotDamageCrit / damageMain / damageCrit` 四类。
- 优先保持 `emitFloat()` 现有调用兼容；只有在新增专属暴击闪爆时，才扩展可选 payload。
- 若增加暴击局部闪爆，优先复用 `emitFlash()` 与 `battleComboView.js` 现有 glow 机制。
- 先定一组标准档时序，再评估是否需要开放多档配置，避免过早复杂化。
- 宠物区与总伤区应分开验收，不能用同一组 motion 参数硬套。

## Architecture Design

本次方案基于现有链路做局部增强，不引入新架构：

- **配置层**：`dmgFloat.js`  
定义宠物区、总伤区、暴击的样式与运动参数。
- **更新层**：`animations.js`  
统一执行上跳、回弹、停顿、淡出等逐帧逻辑。
- **状态层**：`main.js`  
控制 `petAtkShow` 与 `preAttack` 的展示窗口。
- **触发层**：`battle.js` 与 `fxEmitter.js`  
在宠物伤害与总伤结算时分发普通/暴击表现。
- **渲染层**：`render.js`、`battleTeamBarView.js`、`battleComboView.js`  
分别负责字效绘制、槽位锚点定位、局部或全屏光效补强。

## Directory Structure Summary

本方案不建议新增独立系统，推荐集中修改现有战斗跳字与反馈模块。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/dmgFloat.js`  [MODIFY]  
伤害跳字配置中心。负责调整 `slotDamageMain`、`slotDamageCrit`、`damageMain`、`damageCrit` 的字号、发光、运动曲线、停留时长与暴击差异化参数。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js`  [MODIFY]  
飘字逐帧更新逻辑。负责校准“上跳、回弹、停顿、淡出”的执行顺序和插值表现，必要时支持更明显的回弹段或暴击脉冲段。

- `/Users/huyi/dk_proj/xiao_chu/js/main.js`  [MODIFY]  
战斗状态机时序。负责调整 `petAtkShow` 与 `preAttack` 停留时间，使宠物区新动效能完整被看见，不被状态切换截断。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js`  [MODIFY]  
战斗跳字触发入口。负责保持宠物区伤害、总伤、暴击三类事件的触发节奏一致，并为更强暴击反馈补充必要上下文。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js`  [MODIFY]  
反馈事件分发层。若采用局部暴击闪爆或槽位脉冲，需要在这里扩展复用型 flash 事件，而不是散落到多处直接赋值。

- `/Users/huyi/dk_proj/xiao_chu/js/render.js`  [MODIFY]  
通用飘字渲染。负责增强暴击文字的描边、渐变、高光、发光层次，必要时增加轻量残影或二次高光。

- `/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleTeamBarView.js`  [MODIFY]  
宠物槽位浮字锚点层。负责确认“跳出框外、回弹进框内”的视觉落点稳定，避免多宠同时跳字时偏移异常。

- `/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleComboView.js`  [MODIFY]  
现有 glow/flash 绘制层。若采用标准档暴击增强方案，可在这里复用已有光斑、冲击环或局部闪爆逻辑，避免新建重型特效模块。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核战斗跳字、暴击反馈、状态机时序的完整调用链与受影响文件
- Expected outcome: 输出无遗漏的改动范围和回归点，避免只改表象而漏掉时序与渲染层