---
name: battle-phase2-skill-damage-resolver
overview: 为第2期制定可执行方案：把 `skills.js` 中宠物技能直伤链路收口到 `js/engine/battle/`，统一技能伤害计算、扣血收尾与表现触发边界。
todos:
  - id: scan-skill-paths
    content: 用 [subagent:code-explorer] 复核四类直伤与收尾差异
    status: completed
  - id: add-skill-resolver
    content: 新增 skillDamageResolver.js，统一技能伤害结果与提交逻辑
    status: completed
    dependencies:
      - scan-skill-paths
  - id: export-skill-api
    content: 更新 battle/index.js 导出技能伤害解析入口
    status: completed
    dependencies:
      - add-skill-resolver
  - id: refactor-skill-cases
    content: 改造 skills.js 四个直伤 case，保留前摇与三类飘字
    status: completed
    dependencies:
      - export-skill-api
  - id: verify-skill-regression
    content: 验证单发、多段、群攻、DOT附加与击杀回归
    status: completed
    dependencies:
      - refactor-skill-cases
---

## User Requirements

### Product Overview

为第 2 期输出一份只针对“宠物技能直伤收口”的实施计划，不执行代码修改。将 `skills.js` 中分散的技能伤害落地逻辑收敛到 `js/engine/battle/`，为后续继续拆表现层做准备。

### Core Features

- 收口 4 条宠物技能直伤链路：`instantDmg`、`instantDmgDot`、`multiHit`、`teamAttack`
- 统一技能伤害结果结构，减少 `skills.js` 内部重复的扣血、击杀收尾、附加效果处理
- 明确边界：技能前摇与技能宣告仍留在 `skills.js`，伤害计算与落地提交进入 battle 子目录
- 保持现有视觉效果不变：单发技能继续用单发飘字，多段技能继续逐段飘字，全队攻击继续按宠物分列飘字
- 本期不进入表现事件化，不改 `render.js`、`animations.js`、`dmgFloat.js` 的消费方式，不扩展到 `battle.js` 其他直接扣血路径

### User Requirements

- 仅做第 2 期 Plan
- 范围只覆盖宠物技能直伤收口
- 需要明确哪些逻辑进入 `js/engine/battle/`，哪些继续留在 `skills.js`
- 需要给出低风险、可验证的分步执行清单

## Tech Stack Selection

- 语言与模块：JavaScript + CommonJS
- 现有战斗目录：`js/engine/battle/` 已存在 `damageContext.js`、`damageFormula.js`、`damageEstimator.js`、`index.js`
- 现有技能入口：`js/engine/skills.js`
- 现有伤害表现：`js/engine/dmgFloat.js`

## Implementation Approach

### 核心策略

第 2 期不强行把技能直伤并入第 1 期的 `calcTotalDamage()`，而是新增一个“技能伤害专用 resolver”。原因是当前 4 条技能链路的公式并不一致：

- `instantDmg`：吃 `skillDmgPct`，可带 `ignoreDefPct`，可附加 `stunDur`、`teamHealPct`
- `instantDmgDot`：吃 `skillDmgPct`，命中后附加 DOT
- `multiHit`：逐段出飘字，当前按总和一次扣血
- `teamAttack`：遍历全队宠物，吃 `allAtkPct` 与 `skillDmgPct`，并且每只宠物当前都会单独减一次防御

因此本期最佳方案是：

1. 在 `js/engine/battle/` 下新增 `skillDamageResolver.js`
2. 复用现有 `buildDamageContext()` 与 `getEnemyDefense()` 等基础能力
3. 让 `skills.js` 保留技能前摇、技能名闪屏、光波、三类飘字调用
4. 把“算多少伤害、何时扣血、附加哪些状态、如何做技能路径击杀收尾”统一收进 resolver

### How it works

- `skills.js` 继续负责：星级覆写、技能前摇、`g._petSkillWave`、`g._skillFlash`、前置震屏
- `skillDamageResolver.js` 负责：构建技能上下文、生成统一 `SkillDamageResult`、提交敌人掉血/附加 buff/英雄回血/技能路径击杀收尾
- `skills.js` 在拿到 `SkillDamageResult` 后，只根据 `entries` 调用现有 `DF.petSkillDmg`、`DF.petMultiHitDmg`、`DF.petTeamAtkDmg`

### Key technical decisions

- 复用 `buildDamageContext(g, overrides)`：已有 overrides 能力，足够支撑技能直伤快照
- 复用 `getEnemyDefense(ctx)`：避免 `skills.js` 自己继续散落减防逻辑
- 不复用 `calcTotalDamage()`：普通消珠伤害和技能直伤规则不同，强行复用会引入公式漂移
- 不改 `battle.js` 其他直接扣血逻辑：如 `aoeOnElim`、敌方 DOT、反伤等，控制爆炸半径
- 不把 `DF.*` 飘字下沉到 resolver：第 2 期只收口数值落地，不提前进入第 3 期 FX 事件化

### Performance & Reliability

- `instantDmg` / `instantDmgDot`：时间复杂度 O(1)
- `multiHit`：O(hits)
- `teamAttack`：O(pets)
- 每次技能触发只构建一次 context，避免重复扫描 `g`
- 保留现有三类飘字 API，避免额外渲染对象转换
- 技能击杀收尾在 resolver 内统一，减少 4 个 case 的重复分支与遗漏风险

## Implementation Notes

- 保持技能前摇特效留在 `skills.js`，避免本期误碰节奏与手感
- 保持 `multiHit` 当前“逐段飘字、总和扣血”的行为，不顺手改成逐段真实扣血
- 保持 `teamAttack` 当前“每只宠物各自减防”的规则，不偷偷改成先汇总后统一减防
- 保持技能路径现有击杀行为，不自动引入 `battle.js` 普通攻击那套额外结算副作用，避免行为突变
- 只改技能直伤四个 case，其他 `skills.js` 分支不做顺手重构

## Architecture Design

### 模块边界

- `skills.js`
- 保留：技能类型分发、星级覆写、前摇/技能名表现、三类飘字调用
- 改造：4 个直伤 case 改为“准备参数 -> 调 resolver -> 按结果做飘字”
- `skillDamageResolver.js`
- 新增：技能上下文读取、4 类直伤公式、统一结果结构、统一提交与技能路径击杀收尾
- `battle/index.js`
- 增补：导出技能 resolver，保持 battle 子目录统一入口
- `damageContext.js`
- 复用：读取 `runBuffs`、`enemy`、`enemyBuffs`、`heroHp`、`heroMaxHp`、`pets`

### 推荐结果结构

建议 `skillDamageResolver.js` 输出统一结果对象，至少包含：

- `type`：`single` / `multi` / `team`
- `totalDmg`
- `entries`：用于现有三类飘字的逐项明细
- `attackAttr`
- `shake`
- `heroHeal`
- `enemyBuffsToAdd`
- `enemyKilled`

## Directory Structure

## Directory Structure Summary

本期只新增技能伤害专用 resolver，并最小化改动 `skills.js` 的四个直伤 case。

```text
/Users/huyi/dk_proj/xiao_chu/
├── js/
│   └── engine/
│       ├── battle/
│       │   ├── skillDamageResolver.js   # [NEW] 技能直伤专用解析与提交模块。负责 instantDmg / instantDmgDot / multiHit / teamAttack 的结果结构、敌人扣血、附加 buff、英雄回血、技能路径击杀收尾。复用现有 damageContext/getEnemyDefense，避免直接复用普通消珠公式。
│       │   └── index.js                 # [MODIFY] 统一导出 skillDamageResolver 的公开接口，保持 battle 子目录入口集中。
│       └── skills.js                    # [MODIFY] 保留技能前摇与技能宣告逻辑，仅把 4 个直伤 case 改为调用 resolver，并按返回 entries 调用现有 DF.petSkillDmg / petMultiHitDmg / petTeamAtkDmg。
```

## Key Code Structures

本期无需提前生成实现代码，执行时建议围绕以下接口组织：

- `resolveSkillDamage(g, payload)`：按技能类型生成统一结果结构
- `commitSkillDamage(g, result)`：提交 HP、附加效果与技能路径击杀收尾
- `result.entries`：供 `skills.js` 继续调用现有三类飘字 API

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 复核 `skills.js` 四类直伤分支、`enemy.hp` 修改点、`DF.*` 飘字调用点与 `battle/` 现有接口，保证第 2 期只覆盖技能直伤链路
- Expected outcome: 输出可执行的跨文件映射，确保 resolver 接入范围准确且不误伤 `battle.js` 其他直接扣血路径