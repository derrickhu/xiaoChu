---
name: crit-render-performance-plan-v2
overview: 为暴击触发卡顿问题创建正式优化计划，聚焦暴击特效链路抽象、渲染缓存化和同帧特效扇出控制。计划将给出分阶段实施顺序、优先级和验收标准。
todos:
  - id: audit-crit-chain
    content: 使用[subagent:code-explorer]复核暴击链路并定义统一配置
    status: pending
  - id: add-crit-config
    content: 新增js/engine/battle/critFxConfig.js收拢暴击规则与质量档
    status: pending
    dependencies:
      - audit-crit-chain
  - id: limit-crit-fanout
    content: 改造battle.js与dmgFloat.js限制暴击扇出和生命周期
    status: pending
    dependencies:
      - add-crit-config
  - id: cache-heavy-crit-render
    content: 优化render.js缓存暴击文案、burst贴图与文本测量
    status: pending
    dependencies:
      - limit-crit-fanout
  - id: simplify-battle-subviews
    content: 优化battleTeamBarView.js、battleComboView.js、battleSkillVfxView.js减少实时绘制
    status: pending
    dependencies:
      - cache-heavy-crit-render
  - id: quality-budget-regression
    content: 使用[subagent:code-explorer]接入降级策略并回归battleView与main渲染链
    status: pending
    dependencies:
      - simplify-battle-subviews
---

## User Requirements

- 为战斗中的暴击反馈制定一份正式优化方案，重点解决暴击出现时的卡顿。
- 保留当前已经强化后的暴击爽感，不改动暴击判定与数值结算，只优化表现链路与渲染方式。
- 方案需要覆盖代码抽象、渲染优化、性能控制、分阶段实施和验收标准。

## Product Overview

- 暴击仍然以敌方受击点、总伤数字、中央提示、来源槽位形成强烈反馈。
- 视觉上继续保持“明显强于普通命中”的爆发感，但减少多层效果同帧堆叠导致的顿挫。
- 方案输出为可执行 Plan，不直接进入实现。

## Core Features

- 统一暴击表现配置，收拢分散的暴击触发与参数控制。
- 控制暴击特效扇出、持续时间和叠层数量，降低首帧尖峰。
- 将高成本暴击效果改为缓存化、预渲染或轻量复用。
- 建立质量分级与降级策略，在性能不足时优先保留核心暴击反馈。

## Tech Stack Selection

- 现有项目为基于 `game.js / game.json` 的小游戏项目，渲染核心在 `js/render.js`，战斗局部视图位于 `js/views/battle/*`。
- 代码风格为 **JavaScript + CommonJS**，通过 `require/module.exports` 组织模块。
- 渲染方式为 **Canvas 2D**，并已存在可复用的缓存能力：
- `js/render.js`：`_dmgFloatTexCache`、`cachedLinearGrad`、`cachedRadialGrad`
- `js/engine/effectComposer.js`：`drawGlowSpot`、`beginGlow/endGlow`

## Implementation Approach

### 总体策略

将“暴击”从当前分散在多个模块里的即时特效调用，抽象为统一的暴击表现配置与预算控制；在事件发射阶段减少扇出，在渲染阶段把高成本图形从“每帧现算”改为“离屏缓存 + 轻量 drawImage/透明度/缩放组合”。

### 关键技术决策

1. **新增暴击表现配置模块，而不是继续散落硬编码**

- 当前暴击参数分散在 `js/engine/battle.js`、`js/engine/dmgFloat.js`、`js/views/battle/battleTeamBarView.js`、`js/views/battle/battleComboView.js`、`js/render.js`。
- 新增集中配置模块更适合承载：主暴击来源选择、生命周期、质量档、预算阈值、各层启停开关。

2. **优先复用现有缓存基础设施**

- 不重建新的渲染框架，优先复用 `render.js` 中已有的伤害字贴图缓存与渐变缓存，以及 `effectComposer.js` 中已有的 glow 能力。
- 这样改动集中、风险更低，也能避免引入新的渲染路径。

3. **先减扇出，再做缓存**

- 当前最明显的尖峰来自暴击时同时激活多条特效链，尤其宠物槽暴击效果会按参战宠物数放大。
- 先把“完整暴击槽位特效”限制为单个主来源，再逐步将中央暴击字、burst、pulse/beam 缓存化，收益最高。

4. **把随机扰动改为确定性扰动**

- 将暴击相关的 `Math.random()` 抖动替换为基于帧、索引和 seed 的确定性偏移，减少运行期波动和视觉闪烁。

### Performance and Reliability

- 当前热点近似为：**O(活跃特效数 × 每特效重型绘制成本)**，重型成本主要来自渐变、路径、阴影文字、多段线。
- 优化后的目标仍是 **O(活跃特效数)**，但每个特效主要变成：
- `drawImage`
- 透明度变化
- 简单缩放/位移
- 主要瓶颈与缓解：
- **同帧活跃层过多**：用预算和质量档控制
- **离屏贴图数量膨胀**：缓存 key 有界，按分辨率/样式/LRU 淘汰
- **兼容性**：若离屏能力不可用，保留当前路径但自动降级为 lite 效果

## Implementation Notes

- 保持现有 `emitFloat / emitFlash / emitNotice / emitCast` 调用链可兼容，避免影响非暴击场景。
- 不改动 `damageFormula`、暴击倍率和伤害结算顺序，只调整表现事件和渲染开销。
- 新增缓存时必须把 `scale/style/palette/quality` 纳入 key，避免不同暴击样式复用错误贴图。
- 优先改造暴击专属热点：中央 `暴击！`、`totalCrit` burst、宠物槽暴击 pulse/beam/badge、`critBurst`。
- 控制改动范围，避免顺带重构普通治疗、DOT、护盾等无关特效。

## Architecture Design

### 现有结构上的改造方向

- **战斗逻辑层**：`js/engine/battle.js`
- 负责在暴击发生时发出统一的暴击表现事件元数据。
- **表现状态层**：`js/engine/dmgFloat.js`、`js/engine/animations.js`
- 负责生成可缓存、可降级的飘字和动画状态。
- **渲染层**：`js/render.js`、`js/views/battle/*`
- 负责消费缓存贴图与轻量化绘制。
- **效果基础设施层**：`js/engine/effectComposer.js`
- 负责提供 glow/离屏叠加和统一复用能力。

### 组件关系

- `battle.js` 统一生成暴击表现配置和预算信息
- `dmgFloat.js` 根据配置生成轻量浮字对象
- `animations.js` 更新寿命、缩放、透明度和降级状态
- `render.js` 与 `battleTeamBarView.js / battleComboView.js / battleSkillVfxView.js` 使用缓存贴图渲染
- `effectComposer.js` 为 glow 与附加层提供可复用缓冲

## Directory Structure

### Directory Structure Summary

本次实现以现有战斗渲染链为基础，不改动数值结算，只对暴击表现配置、渲染热点和缓存复用进行结构化优化。

```text
/Users/huyi/dk_proj/xiao_chu/
├── js/
│   ├── engine/
│   │   ├── battle.js                         # [MODIFY] 暴击表现事件发射入口。限制完整暴击槽位扇出，接入统一暴击配置与预算控制，保持原有战斗结算顺序。
│   │   ├── animations.js                    # [MODIFY] 动画生命周期与活跃效果更新。新增暴击活跃负载统计、降级触发与更紧凑的高成本效果寿命控制。
│   │   ├── dmgFloat.js                      # [MODIFY] 暴击总伤/槽位飘字生成中枢。拆分创建参数与渲染参数，输出缓存友好的 burst/pulse/profile 元数据。
│   │   ├── effectComposer.js                # [MODIFY] 现有 glow/离屏能力增强。补充暴击叠加层复用接口、缓存边界和统一的 glow 合成入口。
│   │   └── battle/
│   │       └── critFxConfig.js              # [NEW] 暴击表现统一配置模块。定义主暴击来源选择、质量档、预算阈值、寿命和各层启停参数。
│   ├── render.js                            # [MODIFY] 底层 Canvas 渲染核心。新增暴击文案贴图缓存、burst 贴图缓存、文本测量缓存，并将重型暴击绘制改为轻量复用。
│   └── views/
│       └── battle/
│           ├── battleTeamBarView.js         # [MODIFY] 宠物槽暴击 pulse/beam/badge 优化。去掉高频临时对象，改用缓存帧或简化路径绘制。
│           ├── battleComboView.js           # [MODIFY] 暴击 combo burst 与主文案优化。减少实时渐变、路径和阴影绘制，接入质量档与预算限制。
│           ├── battleSkillVfxView.js        # [MODIFY] 暴击重叠时的技能闪光/波纹附加层优化。减少随机数和高成本线段绘制，避免与暴击主链路同时拉高尖峰。
│           └── battleView.js                # [MODIFY] 战斗视图调度层。必要时透传暴击质量状态或统一控制暴击相关子视图的启停顺序，避免层间重复开销。
└── js/main.js                               # [MODIFY] 全局渲染调度。必要时为 skillEffects/dmgFloats/skillCast 的 glow 合成或质量档切换提供统一入口。
```

## Key Code Structures

- 暴击配置对象建议至少包含：
- `quality`: `full | medium | lite`
- `primarySlotRule`: 主暴击槽位选择规则
- `budget`: 同帧特效预算与降级阈值
- `layers`: `enemyTotalCrit / critNotice / slotCrit / comboCritBurst / screenFlash` 各自的启停、寿命、贴图策略
- 渲染缓存建议至少区分：
- 暴击文案贴图缓存
- 暴击 burst 贴图缓存
- 文本测量缓存
- 统一 glow 叠加缓存

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核 `battle.js`、`render.js`、`js/views/battle/*`、`effectComposer.js` 的跨文件调用链与热点影响范围。
- Expected outcome: 在实施每个阶段前后产出可靠的影响面确认、热点复查和回归关注点，避免漏改渲染链路。