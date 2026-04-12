---
name: battle-combo-effect-optimization
overview: 为战斗中的连击表现制定优化方案：移除预估伤害显示，强化“几连击”的主视觉、停留时长与阶段反馈；在用户确认方案前不进行任何代码改动。
todos:
  - id: remove-combo-estimate
    content: 删除连击预估伤害链路并收拢视图上下文
    status: completed
  - id: boost-combo-main-text
    content: 强化连击主数字与“连击”字样的主视觉权重
    status: completed
    dependencies:
      - remove-combo-estimate
  - id: tune-combo-timing
    content: 调整 battle 与 animations 的连击冲击和停留节奏
    status: completed
    dependencies:
      - remove-combo-estimate
  - id: verify-combo-feedback
    content: 校验连击层级反馈、粒子强度与战斗节奏
    status: completed
    dependencies:
      - boost-combo-main-text
      - tune-combo-timing
---

## User Requirements

- 去掉连击区域里的“预估伤害”副文案，不再让它分散注意力。
- 重点强化“几连击”的显性表达，让玩家一眼看清当前连击数，并明确感受到连击带来的强化反馈。
- 连击文字要更大、更亮、更有冲击感，停留时间可适度拉长，整体观感要更爽。
- 先输出并沉淀为 Plan，后续根据 Plan 讨论确认，再开始实际修改。

## Product Overview

当前战斗中的连击展示保留原有位置与整体体系，但改成以“连击主数字 + 连击标识 + 里程碑强化反馈”为核心。画面上应减少杂讯信息，让连击数字成为视觉中心，出现时更炸，停留时更稳，退场时更顺。

## Core Features

- 移除连击区无用的预估伤害文案，收拢视觉焦点。
- 放大连击主数字，提升“连击”二字存在感与整体辨识度。
- 延长连击弹出后的可见时长，并优化弹入、停留、淡出的节奏。
- 保留并强化里程碑、闪光、粒子等辅助反馈，但始终服务于主连击数字。

## Tech Stack Selection

- 现有项目为微信小游戏 JavaScript 工程，入口与配置位于 `/Users/huyi/dk_proj/xiao_chu/game.js`、`/Users/huyi/dk_proj/xiao_chu/game.json`
- 代码采用 CommonJS 模块组织，战斗表现链路主要由自研渲染与动画模块驱动
- 本次改动沿用现有战斗表现链路，不引入新框架、不重建新系统

## Implementation Approach

### 高层策略

采用“现有连击链路内聚强化”的方式实现：直接在连击触发、连击动画更新、连击视图绘制三段链路内收口改动。先去掉预估伤害副信息，再把主连击数字、连击标识、里程碑特效和停留节奏整体强化。

### 方案如何工作

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js` 继续负责连击触发时的 `_comboAnim`、`_comboFlash`、粒子和里程碑初始化。
- `/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js` 继续负责 `_comboAnim` 的弹入、停留、淡出节奏。
- `/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleComboView.js` 继续负责主字、里程碑、背景和 VFX 绘制，但删除预估伤害绘制链路并重做主视觉权重。

### 关键技术决策

- **删除预估伤害而不是弱化显示**：当前 `battleComboView.js` 明确引入 `estimateDamage`，并在每次绘制时拼接“预估伤害”文案；直接移除可最大化聚焦主连击数字，同时减少无意义计算。
- **保留横排“数字 + 连击”结构**：现有布局已稳定，改成上下双层会扩大改动面；本轮优先通过字号、描边、颜色、发光和字重提升显性识别。
- **只改表现，不改机制**：不调整真实伤害公式、不改 `COMBO_MILESTONES` 阈值机制，避免影响战斗平衡与已有体验预期。
- **渐进增强而非重写**：沿用已存在的 `_comboFlash`、`_comboParticles`、里程碑文案逻辑，只增强参数和视觉权重，避免技术债。

### 性能与可靠性

- 现状中连击视图存在额外估算调用；移除该链路后，连击绘制回到常量级文本渲染加粒子绘制，能降低每帧不必要计算。
- 主要性能瓶颈仍在粒子与 glow 绘制；增强方案应控制粒子数量和爆闪半径，避免在高连击时过度放大 GPU/Canvas 开销。
- 动画调整保持在现有 `_comboAnim` 状态结构内，复杂度维持 O(1)；粒子更新保持现有 O(n) 模式，不增加新的遍历层级。

## Implementation Notes

- 优先在 `battleComboView.js` 断开 `estimateDamage` 依赖与 `drawComboDmgText()` 入口，再决定是否继续清理仅服务该副文案的闲置字段，避免一次性改动过深。
- 调整 `_updateComboAnim()` 时，只延长余韵与淡出时机，不改变战斗状态机本身，防止连击表现反向拖慢回合节奏。
- `battle.js` 中对 `_comboAnim` 初始 scale、`_comboFlash` 时长与粒子数量的增强应按 tier 递增，避免低连击就出现过度爆闪。
- 保持当前“combo 文本显示条件”和“combo 层 VFX”解耦的修复成果，不能让低连击或特殊闪光重新被文本门控吃掉。
- 当前 `package.json` 未提供可用测试脚本，落地后应以目标文件诊断检查和战斗内回归验证为主。

## Architecture Design

### 现有结构

- **触发层**：`/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js`
- 消除成立后递增 `g.combo`
- 初始化 `_comboAnim`、`_comboFlash`、`_comboParticles`
- 按里程碑触发额外粒子、音效、震动
- **动画层**：`/Users/huyi/dk_proj/xiao_chu/js/engine/animations.js`
- 逐帧推进 `_comboAnim.timer`
- 计算 scale、alpha、offsetY 等视觉状态
- **表现层**：`/Users/huyi/dk_proj/xiao_chu/js/views/battle/battleComboView.js`
- 绘制主连击数字
- 绘制里程碑文案与背景爆点
- 绘制 combo 粒子和闪光

### 本次改造关系

- 触发层只增强“出现时的冲击感”
- 动画层只增强“停留与退场节奏”
- 表现层负责“视觉聚焦收口”，确保所有强化都围绕主连击数字

## Directory Structure

## Directory Structure Summary

本次实现不新增文件，集中改造现有连击表现链路，范围控制在触发、动画、视图三个模块内。

```text
/Users/huyi/dk_proj/xiao_chu/
├── js/
│   ├── engine/
│   │   ├── battle.js                 # [MODIFY] 连击触发与初始化入口。增强 _comboAnim 初始冲击感、_comboFlash 时长与 tier 粒子强度，但不改连击机制与伤害公式。
│   │   └── animations.js            # [MODIFY] 连击动画时序控制。延长连击停留与余韵时长，微调弹入、呼吸、淡出节奏，保持状态字段兼容。
│   └── views/
│       └── battle/
│           └── battleComboView.js   # [MODIFY] 连击主视图核心文件。移除预估伤害文案与 estimateDamage 依赖，放大主数字，增强“连击”字样、里程碑文字与背景视觉层次。
```

### 关联依赖（预期不修改）

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/damageEstimator.js`
- 当前仅作为连击预估伤害来源；本轮目标是从连击视图链路中移除其依赖，不计划改动其内部实现。
- `/Users/huyi/dk_proj/xiao_chu/js/data/constants.js`
- 当前提供 `COMBO_MILESTONES` 与 tier 判定；如讨论后确认需统一抽离字号或档位映射，再考虑扩展，否则保持不动。