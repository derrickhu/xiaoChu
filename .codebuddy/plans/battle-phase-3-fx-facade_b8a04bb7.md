---
name: battle-phase-3-fx-facade
overview: 为战斗系统第3期制定实施方案：在 `js/engine/battle/` 中收口飘字、提示、震屏、闪光与攻击/治疗动画等表现触发入口，降低 `battle.js`、`skills.js`、`battleHelpers.js` 对表现层的直接耦合。
todos:
  - id: scan-fx-boundary
    content: 用 [subagent:code-explorer] 复核表现入口替换点与风险边界
    status: completed
  - id: add-fx-emitter
    content: 新增 fxEmitter 并更新 js/engine/battle/index.js 导出
    status: completed
    dependencies:
      - scan-fx-boundary
  - id: refactor-battle-flow
    content: 改造 battle.js 与 skillDamageResolver 统一触发 FX
    status: completed
    dependencies:
      - add-fx-emitter
  - id: refactor-skill-helper-flow
    content: 改造 skills.js 与 battleHelpers.js 收口前摇、治疗和受击反馈
    status: completed
    dependencies:
      - add-fx-emitter
  - id: verify-fx-regression
    content: 用 [subagent:code-explorer] 回归核对飘字、提示、震屏和动画时序
    status: completed
    dependencies:
      - refactor-battle-flow
      - refactor-skill-helper-flow
---

## User Requirements

### Product Overview

为第 3 期先输出一份可执行计划，再开始实施。范围聚焦战斗系统中的表现触发收口，把分散在各处的飘字、提示、震屏、闪光、攻击/治疗动画、宠技前摇等统一到一层入口中，便于后续继续拆逻辑层。

### Core Features

- 统一战斗表现入口，覆盖提示文字、伤害飘字、震屏、flash、攻击/治疗动画、宠技前摇。
- 保持当前视觉效果基本不变：单发、多段、群攻飘字样式不变，技能快闪、光波、受击反馈与现有手感一致。
- 将 `battle.js`、`skills.js`、`battleHelpers.js` 中直接触发表现的代码改为走统一入口，减少逻辑层与表现层硬耦合。
- 明确边界：本期不重写渲染消费层，不做敌方技能系统重构，不做棋盘动画事件化，不混入新的数值语义修补。
- 计划需给出低风险、可验证、可顺序执行的实施清单。

## Tech Stack Selection

- 语言与模块体系：JavaScript + CommonJS
- 现有战斗子模块：`/Users/huyi/dk_proj/xiao_chu/js/engine/battle/`
- 现有表现工厂：`/Users/huyi/dk_proj/xiao_chu/js/engine/dmgFloat.js`
- 现有动画与渲染消费层：
- `/Users/huyi/dk_proj/xiao_chu/js/render.js`
- `/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js`
- `/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleSkillVfxView.js`
- 现有桥接层：
- `/Users/huyi/dk_proj/xiao_chu/js/battleHelpers.js`
- `/Users/huyi/dk_proj/xiao_chu/js/main.js` 中的 `g._playHeroAttack()`、`g._playEnemyAttack()`、`g._playHealEffect()`、`g._addShield()`、`g._dealDmgToHero()`

## Implementation Approach

### 核心策略

第 3 期不继续扩大数值重构范围，而是新增一个很薄的 Battle FX Facade。它统一承接表现触发，但内部仍落到当前的状态结构与工厂方法上，例如 `g.skillEffects`、`g.dmgFloats`、`g.elimFloats`、`g.skillCastAnim`、`g.shakeT/shakeI`、`g._skillFlash`、`g._petSkillWave`。

### 高层工作方式

- `battle.js`、`skills.js`、`battleHelpers.js` 只描述“要触发什么表现”。
- 新增的 FX 模块负责把这些请求转换成当前渲染层能消费的旧结构。
- `render.js`、`animations.js`、`battleSkillVfxView.js` 尽量不改，维持消费协议稳定。

### 关键技术决策

- 新模块建议放在 `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js`，并通过 `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/index.js` 暴露统一入口，延续 battle 子目录的集中导出模式。
- 虽然 `/Users/huyi/dk_proj/xiao_chu/js/main.js` 已有 `g.events` 的 `TinyEmitter`，本期不把战斗效果改成异步全局事件总线；优先使用同步 facade，避免打乱当前帧驱动与渲染时序。
- 保留 `battleHelpers.js` 对 `main.js` 的桥接契约，优先让其内部转调 FX facade，避免为了第 3 期扩散到 `main.js` 外部接口改名。
- 不修改 `_beadConvertAnim`、`_comboAnim`、`_enemyDeathAnim` 的消费协议，只在触发入口上收口。

### 性能与可靠性

- 统一入口后，每次触发仍是 O(1) 状态写入或一次现有工厂调用，不引入新的全局扫描。
- 热路径主要在 `applyFinalDamage()`、`enemyTurn()`、`triggerPetSkill()`、`dealDmgToHero()`；本期只减少重复写状态，不增加额外渲染遍历。
- 通过继续复用 `dmgFloat.js` 与现有数组结构，避免额外对象转换层与重复分配。
- 兼容性优先于抽象纯度，先收口入口，再考虑后续更深层的事件化。

## Implementation Notes

- `shake` 需保留强反馈优先语义，统一入口内应支持 `Math.max` 风格合并，不能简单覆盖。
- `_skillFlash`、`_petSkillWave`、`skillCastAnim` 目前是单槽覆盖模型，第 3 期保持该模型不改成队列。
- `enterPetAtkShow()` 与 `applyFinalDamage()` 周围的 `_pendingCrit`、`_pendingHealApplied` 时序不能改变。
- `skillDamageResolver.js` 当前仍直接 `_playHeroAttack`、设置 `shake`、触发 victory，本期应一起改为走 FX facade，避免 battle 子目录内部再次分叉。
- `vulnerable`、敌方技能数值规则、棋盘变珠副作用不纳入本期，避免范围失控。
- 保持向后兼容，不做无关重构，不扩大到奖励、结算、商店、教学等链路。

## Architecture Design

### 模块关系

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js`
- 统一表现触发入口
- 向下复用 `dmgFloat.js` 与当前状态字段
- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js`
- 继续负责回合推进与结算语义
- 改为调用 FX facade 输出表现
- `/Users/huyi/dk_proj/xiao_chu/js/engine/skills.js`
- 继续负责技能分发与技能语义
- 改为调用 FX facade 输出宠技前摇、治疗反馈、技能飘字
- `/Users/huyi/dk_proj/xiao_chu/js/battleHelpers.js`
- 从“逻辑+表现混合层”收敛为“兼容桥接层”

### 建议入口能力

- `emitNotice(g, payload)`：统一 `skillEffects`
- `emitFloat(g, kind, payload)`：统一 `DF.*`
- `emitShake(g, payload)`：统一 `shakeT/shakeI`
- `emitFlash(g, payload)`：统一 `_screenFlash`、`_counterFlash`、`_blockFlash`
- `emitCast(g, payload)`：统一英雄攻击、敌人攻击、治疗动画
- `emitPetSkillIntro(g, payload)`：统一 `_petSkillWave` 与 `_skillFlash`

### Key Code Structures

```js
emitNotice(g, payload)
emitFloat(g, kind, payload)
emitShake(g, payload)
emitFlash(g, payload)
emitCast(g, payload)
emitPetSkillIntro(g, payload)
```

## Directory Structure

### Directory Structure Summary

本期以“新增统一 FX 入口 + 替换高耦合调用点”为主，尽量不碰消费层。

```text
/Users/huyi/dk_proj/xiao_chu/
├── js/
│   ├── battleHelpers.js                         # [MODIFY] 兼容桥接层。保留对 main.js 的旧接口，内部改为复用统一 FX 入口；逐步剥离受击、护盾、攻击/治疗动画中的表现直写。
│   └── engine/
│       ├── battle.js                           # [MODIFY] 战斗主流程。将 applyFinalDamage、enemyTurn、applyEnemySkill、enterPetAtkShow、Boss 入场提示等表现触发改为走 FX facade。
│       ├── skills.js                           # [MODIFY] 宠技入口。保留技能语义与分发，收口宠技前摇、治疗反馈、技能飘字触发。
│       └── battle/
│           ├── fxEmitter.js                    # [NEW] 战斗表现适配层。统一 notice、float、shake、flash、cast、pet skill intro 的生产口，内部复用当前状态结构与 dmgFloat 工厂。
│           ├── index.js                        # [MODIFY] battle 子目录统一导出新增 FX 入口，保持集中访问方式。
│           └── skillDamageResolver.js          # [MODIFY] 技能直伤提交层。去掉直接 `_playHeroAttack` 与 `shake` 写入，改为复用 FX facade，避免 battle 子模块内部继续耦合。
```

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核第 3 期涉及的表现触发调用点、兼容性边界与回归覆盖面，确保替换范围准确且不误伤消费层协议。
- Expected outcome: 输出可执行的调用点清单、风险点与回归项，支撑按文件分步落地。

---

## Phase 4 - 伤害数字特效优化

### Phase Goal

在第 3 期完成表现入口收口后，第 4 期聚焦“局内伤害数字反馈”的系统升级：参考智龙迷城的队伍栏读数方式，去掉当前 emoji 风格正文，让宠物攻击数字**在宠物框内生成、向上短促跳起、再回落到框内停住一小段**，确保玩家既能感到打击感，又能清楚读到每只宠物的输出；同时保持 `canvas2D` 路径下的性能可控。

### Visual Targets

- 去掉伤害正文中的 `🐾`、`💥`、`❤️`、`🛡️` 等 emoji，统一回到纯数字 / 短标签体系。
- 主伤害数字采用高饱和鲜亮配色 + 粗黑描边 + 轻外光，整体方向参考智龙迷城的“高亮数字贴在宠物框上”的读感。
- 宠物攻击数字默认锚定在**宠物框内部**，而不是框外上方；数字主体停留位置应落在头像上沿或头像右上读数区，保证“谁出手谁的框里冒数”。
- 暴击伤害与普通伤害分层：暴击更大、更亮，允许加入轻微横向震颤或二次回弹。
- 颜色从当前偏金黄统一方案，调整为**更鲜亮的属性系数字**：如水系偏亮青蓝、木系偏荧光绿、暗系偏亮紫、光系偏亮黄，整体保持高饱和与强可读性。
- 敌方总伤、治疗、受击、护盾、DOT 仍保留独立配色，但整体字形与动效风格统一，不与宠物框内主伤害读数抢主视觉。

### Motion Targets

- 宠物主伤害数字使用“框内回跳”节奏：`框内基线 -> 向上跳起 -> 回落到框内停住 -> 轻淡出`，而不是单向向上飘走。
- 普通伤害数字建议采用 `0.82 -> 1.16 -> 0.98 -> 1.00` 的缩放节奏，并伴随 8~14 像素的短促上跳；落点回到宠物框内读数区。
- 暴击数字支持更强过冲：`0.86 -> 1.26 -> 1.04 -> 1.00`，必要时增加 1~2 次轻微横向震颤。
- 多段伤害按 hit 顺序错峰 2~3 帧，并在同一宠物框内分层摆放：主数字优先占据上层，小数字可落在下沿或侧下方，避免遮脸与糊团。
- 群攻伤害按宠物框逐个爆发，每个框内独立执行“起跳后回框”的节奏，优先保证数字可读性与攻击来源辨识度。

### Technical Strategy

- 保持 `fxEmitter.js` 作为统一发射入口，不在第 4 期重新分叉表现入口。
- 重构 `dmgFloat.js`：将“位置 + 样式 + 动画预设”从简单文本飘字升级为“数字实例描述”。
- 升级 `render.js#drawDmgFloat()`：优先走离屏缓存后的 `drawImage` 渲染，减少高频 `strokeText + fillText + shadowBlur`。
- 新增轻量数字缓存层（建议放在 `js/engine/battle/numberGlyphCache.js` 或同级模块），按样式集缓存 `0-9`、`,`、`+`、`-` 等字形或整串数字 sprite。
- 保留 fallback：在缓存不可用或调试阶段，仍可退回文字绘制，保证改造分步可验证。

### Performance Constraints

- 运行时热路径优先使用 `drawImage` 绘制数字实例，避免每帧重新描边整串文本。
- 数字缓存按样式和字符串 key 复用，限制样式数量，避免缓存无限增长。
- 继续复用现有 `dmgFloats` 数组与 update 节奏，不新建额外全局遍历器。
- 不引入 WebGL，不改主循环驱动方式，坚持 `canvas2D` + 离屏缓存方案。

### Implementation Scope

#### In Scope

- `js/engine/dmgFloat.js`
- 去掉 emoji 正文
- 重做数字样式配置、锚点配置、跳跃动画预设
- 为宠物伤害支持“按宠物位起跳”的锚点参数
- `js/render.js`
- 升级 `drawDmgFloat()` 以支持 sprite 渲染、跳跃缩放、暴击差异化
- `js/engine/battle/fxEmitter.js`
- 扩展 `emitFloat()` 参数透传，支持 `petIdx`、`styleKey`、`motionPreset` 等数字表现元信息
- `js/engine/skills.js`
- 宠技单体、多段、群攻数字透传宠物索引或命中序号，支撑按宠物位发射
- `js/engine/battle.js`
- 敌方总伤、AOE、DOT、治疗等类型适配到新的数字风格系统

#### Out of Scope

- 不重写 `battleView.js` 的整体渲染结构。
- 不把所有 notice、combo 文案、技能名快闪在本期一起推翻重做。
- 不重构粒子系统或转 WebGL。
- 不改伤害数值语义、回合结算顺序和技能逻辑。

### Delivery Phases

1. **样式统一阶段**

- 去掉 emoji 正文
- 建立普通伤害 / 暴击 / 治疗 / 受击 / 护盾 / DOT 的统一数字样式表

2. **锚点重构阶段**

- 宠物数字改为在宠物框内部生成，并明确主数字落点与副数字落点
- 敌方总伤和我方受击保持独立锚点

3. **跳跃动画阶段**

- 实现“向上弹起后回到框内”的回跳节奏，而不是单向上飘
- 区分普通伤害、暴击、多段错峰与主/副数字层级

4. **鲜亮色样式阶段**

- 建立按属性区分的鲜亮色数字色盘
- 保持粗黑描边、外光和高对比读数效果

5. **高性能渲染阶段**

- 引入字形缓存 / 数字 sprite 缓存
- `drawDmgFloat()` 优先走 `drawImage`

6. **回归与调参阶段**

- 检查多段、群攻、治疗、护盾、DOT、AOE 的显示与性能
- 微调字号、描边、亮度、跳跃幅度、回落停留时间和寿命
4. **高性能渲染阶段**

- 引入字形缓存 / 数字 sprite 缓存
- `drawDmgFloat()` 优先走 `drawImage`

5. **回归与调参阶段**

- 检查多段、群攻、治疗、护盾、DOT、AOE 的显示与性能
- 微调字号、描边、亮度、跳跃幅度和寿命

### Acceptance Criteria

- 伤害数字正文不再出现 emoji。
- 宠物攻击时，数字能从对应宠物位附近起跳并保持清晰可读。
- 普通伤害与暴击伤害一眼可区分，且具备明显“跳一下”的打击感。
- 多段伤害不会糊成一团；群攻时数字分布有秩序。
- 在连续高频战斗场景下，数字渲染不会明显恶化帧率。
- 不需要为本期数字优化再次大改 battle 逻辑层。

### Risks and Mitigation

- **缓存膨胀**：限制样式集与缓存数量，必要时加入简单 LRU。
- **低端机模糊**：按 `S` / DPR 分档生成缓存纹理，避免过度拉伸。
- **动效过度影响可读性**：先落保守版跳跃曲线，再逐步增强。
- **与旧浮字并存冲突**：优先统一 `dmgFloat.js` 内的数字类型，避免新旧两套视觉长期混用。