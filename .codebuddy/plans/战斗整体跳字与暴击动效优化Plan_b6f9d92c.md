---
name: 战斗整体跳字与暴击动效优化Plan
overview: 将原先偏向土属性的局部飘字强化方案，调整为覆盖全属性宠物区跳字、总伤区跳字、暴击反馈与展示时序的整体动效优化方案，仅输出可讨论的实现计划，不直接施工。
todos:
  - id: review-float-chain
    content: 用 [subagent:code-explorer] 复核全属性跳字与暴击链路
    status: completed
  - id: choose-standard-tier
    content: 确定宠物区、总伤区、暴击三类标准档参数
    status: completed
    dependencies:
      - review-float-chain
  - id: tune-float-motion
    content: 改造 dmgFloat.js 与 animations.js 动作曲线
    status: completed
    dependencies:
      - choose-standard-tier
  - id: adjust-battle-timing
    content: 调整 main.js、battle.js、fxEmitter.js 展示时序
    status: completed
    dependencies:
      - tune-float-motion
  - id: enhance-visual-feedback
    content: 强化 render、battleTeamBarView、battleComboView 视觉反馈
    status: completed
    dependencies:
      - adjust-battle-timing
---

## User Requirements

- 先输出一份可讨论的整体优化方案，不直接施工。
- 优化范围不是单一土属性，而是战斗里所有属性共用的整体跳字动效。
- 宠物区跳字需要更明显、更爽，重点强化“先上跳出框、再回弹回框内、停顿一下、再慢慢消失”的节奏。
- 总伤区跳字也要延长停留时间，但层级要和宠物区区分，避免主战区过满。
- 需要一起考虑暴击表现，让暴击比普通命中更炸、更有确认感。

## Product Overview

- 本方案聚焦战斗中的三类反馈：宠物区跳字、总伤区跳字、暴击附加演出。
- 视觉效果上，整体会更强调跳出感、回弹感、停顿感和爆发感，同时保留数字可读性与战斗节奏。

## Core Features

- 宠物区所有属性统一升级为更高、更久、更有回弹层次的跳字动效。
- 总伤区统一延长停留与淡出节奏，和宠物区形成主次分层。
- 暴击效果在现有基础上增强，加入更明显的字效、闪光、震动或局部脉冲。
- 提供保守、标准、夸张三档方案，便于先选体验强度再落地。

## Tech Stack Selection

- 现有项目为 JavaScript 游戏工程，采用自研 Canvas 渲染与主循环更新。
- 已确认的关键链路：
- 飘字配置与创建：`/Users/huyi/dk_proj/xiao_chu/js/engine/dmgFloat.js`
- 飘字逐帧更新：`/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js`
- 战斗状态时序：`/Users/huyi/dk_proj/xiao_chu/js/main.js`
- 宠物区与总伤触发：`/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js`
- 飘字绘制：`/Users/huyi/dk_proj/xiao_chu/js/render.js`
- 宠物槽位锚点：`/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleTeamBarView.js`
- 闪屏与反馈分发：`/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js`
- 现有 glow 与冲击环：`/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleComboView.js`

## Implementation Approach

整体方案建议基于现有“配置驱动飘字系统”做统一升级，不新建第二套动画框架。核心策略是：所有属性共享一套更强的宠物区基线动效，宠物区、总伤区、暴击三类反馈再分别分层，保证爽感提升但不让画面失控。

### 已验证的现状

- `dmgFloat.js` 已集中管理 `slotDamageMain / slotDamageCrit / damageMain / damageCrit` 等样式和运动参数。
- `animations.js` 已统一支持 `riseFrames / returnFrames / reboundFrames / holdFrames / lifeFrames / fadeStart`，非常适合直接强化“跳出、回弹、停顿、淡出”。
- `main.js` 当前 `petAtkShow` 为 24 帧、`preAttack` 为 10 帧；如果不联动调整时序，只改飘字参数会被状态切走。
- `battle.js` 已区分宠物区伤害、总伤、暴击、克制提示；`fxEmitter.js` 已支持 `combo / counter / screen / heroHurt` 等 flash 通道。
- 当前已经存在基础暴击表现：`slotDamageCrit`、`damageCrit`、局部抖动、`暴击！` notice、`combo` flash。

### 方案分档

#### 方案 A：保守档

- 宠物区：延长停留，略增上跳与回弹。
- 总伤区：延长停留和淡出。
- 暴击：只增强字号、glow、shake。
- 适合快速试水，风险最低。

#### 方案 B：标准档

- 宠物区：统一升级为“跳出框外、回弹回框、停顿、渐隐”。
- 总伤区：延长停留，保留轻回落，不照搬宠物区深回弹。
- 暴击：增强字效、局部闪爆、槽位脉冲与震动。
- 这是最推荐的方向，最符合你的目标。

#### 方案 C：夸张档

- 宠物区：更大幅度出框、更强回弹与残影。
- 总伤区：暴击时叠加强白闪与外扩冲击环。
- 暴击：局部与全屏反馈同时增强。
- 爽感最强，但更容易影响节奏与可读性。

### Recommended Final Direction

建议先按 **方案 B 标准档** 实施：

- 所有属性统一使用更强的宠物区基础 motion，而不是只给某一属性开特例。
- 总伤区只做“更久、更稳、更亮”，不做过深回框。
- 暴击在现有链路上叠一层轻量爆闪和槽位脉冲，避免上重粒子系统。

### Performance & Reliability

- 当前飘字更新仍是遍历 `g.dmgFloats` 与 `g._petSlotFloats`，复杂度为 `O(n)`；方案应继续保持这个模型。
- 优先通过 motion 参数、现有 flash、局部 ring/glow 达成效果，避免为每次命中新增大量粒子对象。
- `render.js` 已有飘字样式与缓存路径，适合继续复用，避免引入额外文本绘制开销。
- 主要风险点：

1. `petAtkShow` 或 `preAttack` 拉太长导致战斗变拖；
2. 总伤暴击过亮，压住敌方受击信息；
3. 多宠同回合数字叠加时出现遮挡。

- 控制方式：先只升级四类核心样式 `slotDamageMain / slotDamageCrit / damageMain / damageCrit`，其余命中特效后补。

## Implementation Notes

- 先做“全属性统一基线”，属性差异继续只保留在颜色层，不先拆成五套 motion。
- 如果工作区里还残留之前临时加过的 `土属性` 专属 motion / 偏移特例，需先移除，再进入统一调优。
- 宠物区动效必须和 `main.js` 的状态窗口一起调，不建议只改参数。
- 暴击增强优先复用 `emitFlash()`、`battleComboView.js` 现有 ring/glow，减少 blast radius。
- 尽量保持 `emitFloat()` 当前调用签名兼容；如需新增暴击强度或局部 flash，只扩展可选 payload。
- 保持向后兼容，避免影响治疗、DOT、护盾等非本次目标的飘字类型。

## Architecture Design

本次改造继续沿用现有战斗表现架构：

- **配置层**：`dmgFloat.js`  
负责宠物区、总伤区、暴击三类跳字的字号、发光、motion、停留时长配置。
- **更新层**：`animations.js`  
统一推进上跳、回弹、停顿、渐隐与抖动逻辑。
- **状态层**：`main.js`  
调整 `petAtkShow` 与 `preAttack` 时间窗口，保证动效完整播放。
- **触发层**：`battle.js`、`fxEmitter.js`  
统一分发宠物伤害、总伤、暴击、闪屏与震动事件。
- **渲染层**：`render.js`、`battleTeamBarView.js`、`battleComboView.js`  
负责字效分层、宠物槽位落点、局部光环与暴击闪爆复用。

## Directory Structure Summary

本次建议集中修改现有战斗表现模块，不新增独立系统。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/dmgFloat.js` [MODIFY]  
飘字配置中心。统一升级宠物区与总伤区的 motion 参数，并拉开普通与暴击差异。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js` [MODIFY]  
飘字逐帧更新。完善“跳出、回弹、停顿、淡出”的执行顺序与插值节奏。

- `/Users/huyi/dk_proj/xiao_chu/js/main.js` [MODIFY]  
战斗状态时序。延长 `petAtkShow` 与 `preAttack` 的展示窗口，避免动效被截断。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js` [MODIFY]  
战斗飘字触发入口。校准宠物区、总伤区、暴击的触发顺序和反馈配合。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js` [MODIFY]  
反馈分发层。复用或扩展局部闪爆、屏闪、震动等轻量反馈事件。

- `/Users/huyi/dk_proj/xiao_chu/js/render.js` [MODIFY]  
飘字渲染层。增强暴击描边、高光、glow 层次，必要时加入轻量残影。

- `/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleTeamBarView.js` [MODIFY]  
宠物槽位锚点与局部脉冲层。保证回框落点稳定，并增强槽位内的命中确认感。

- `/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleComboView.js` [MODIFY]  
复用现有 glow、ray、ring 逻辑，为总伤暴击或宠物区暴击补一层局部爆发反馈。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核战斗跳字、暴击反馈、状态机时序与渲染调用链，确认改动范围完整。
- Expected outcome: 输出无遗漏的受影响文件与回归点，避免只改参数却漏掉时序和渲染层配合。