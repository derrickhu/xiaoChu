---
name: remove-top-enemy-total-damage-float
overview: 移除战斗中显示在敌人上方的旧总伤飘字，仅保留宠物框内的伤害表现，并评估是否清理相关残留分发代码。
todos:
  - id: scan-float-chain
    content: 使用 [subagent:code-explorer] 复核 enemyTotalDmg 全链路与残留引用
    status: completed
  - id: remove-top-total-float
    content: 修改 battle.js，移除普通攻击顶部总伤发射与兼容状态
    status: completed
    dependencies:
      - scan-float-chain
  - id: cleanup-float-impl
    content: 清理 fxEmitter.js 和 dmgFloat.js 的旧总伤分发与实现
    status: completed
    dependencies:
      - remove-top-total-float
  - id: regression-check
    content: 回归验证宠物框数字、DOT、反弹与治疗显示
    status: completed
    dependencies:
      - cleanup-float-impl
---

## User Requirements

- 去掉之前显示在敌人上方的旧总伤害数字。
- 主伤害读数统一保留在宠物框内的数字体系，不再和顶部旧数字重复出现。
- 不影响其他仍需要在敌人区域显示的飘字，例如持续伤害、反弹、敌人治疗等。

## Product Overview

- 战斗主伤害反馈将集中在队伍栏宠物框内显示。
- 敌人上方不再出现旧版总伤数字，画面更干净，读数焦点更明确。

## Core Features

- 移除普通转珠攻击结算里的顶部总伤飘字。
- 保留并继续使用宠物框内普通攻击、宠技、多段伤害数字。
- 清理旧总伤数字的残留分发与实现，避免后续再次误用。

## Tech Stack Selection

- 现有项目技术栈：原生 JavaScript，CommonJS 模块
- 渲染方式：Canvas2D 自研渲染链路
- 相关模块：战斗结算在 `js/engine/battle.js`，飘字分发在 `js/engine/battle/fxEmitter.js`，飘字实现与样式在 `js/engine/dmgFloat.js`

## Implementation Approach

- 直接基于现有链路做减法处理。已确认旧顶部总伤数字由 `battle.js` 中普通攻击结算阶段发出，而宠物框内数字已由 `enterPetAtkShow()` 发出，因此最佳方案是移除顶部总伤发射点，保留宠物框数字主链路。
- 当前仓库中 `emitFloat(g, 'enemyTotalDmg', ...)` 仅确认存在一个普通攻击调用点；若复核后无其他调用，则继续清理 `fxEmitter.js` 的分发分支与 `dmgFloat.js` 的旧实现、导出及相关配置，避免死代码残留。
- 性能方面，这次改动不会增加任何计算复杂度；删除顶部总伤后，每次攻击还会少一次飘字对象创建与一次绘制调用，开销略降。

## Implementation Notes

- 仅移除“敌人头顶旧总伤”这一路，不扩大到 DOT、反弹、敌人治疗、护盾等其他敌方区域飘字。
- 现有 `_suppressEnemyTotalFloat` 仅服务于旧总伤兼容逻辑，若顶部总伤完全移除，应一并删掉相关状态，降低分支复杂度。
- 不改动 `animations.js` 与 `render.js` 的现有回跳、缓存逻辑，除非回归时发现仍有顶部旧数字残留入口。

## Architecture Design

- 普通攻击显示链路调整为：`enterPetAtkShow()` 负责宠物框数字展示，`applyFinalDamage()` 只负责伤害结算、血量变化与战斗结果，不再负责顶部总伤可视化。
- 飘字分发层仅保留仍有业务调用的类型。
- 飘字实现层保留宠物框数字与其他仍在使用的敌方飘字实现，移除废弃顶部总伤实现。

## Directory Structure

### Directory Structure Summary

本次改动聚焦于移除旧顶部总伤数字链路，并清理与之绑定的分发和实现代码，保持宠物框内数字为唯一主伤害视觉。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle.js`  [MODIFY]  
伤害结算主链路。移除普通攻击阶段对 `enemyTotalDmg` 的发射；清理 `_suppressEnemyTotalFloat` 相关兼容状态；保留 `enterPetAtkShow()` 中的宠物框内数字逻辑。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/battle/fxEmitter.js`  [MODIFY]  
飘字分发层。若无剩余调用，删除 `enemyTotalDmg` 分发分支，避免旧类型继续暴露。

- `/Users/huyi/dk_proj/xiao_chu/js/engine/dmgFloat.js`  [MODIFY]  
飘字实现层。若确认无引用，删除 `enemyTotalDmg()` 旧实现、相关导出及配套配置，保留宠物框、DOT、反弹、治疗等现有实现。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核 `enemyTotalDmg` 在仓库中的剩余调用与依赖，确认清理范围
- Expected outcome: 明确旧顶部总伤是否只剩普通攻击链路，并安全删除无用分发与实现