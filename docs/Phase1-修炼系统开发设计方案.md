# Phase 1：修炼系统（局外经验与永久升级）开发设计方案

> 版本日期：2026-03-08（v2 — 实际实现后更新）  
> 前置依赖：Phase 0（已完成）  
> 状态：**已实现**

---

## 一、设计原则

### 1.1 三条养成线的职责分工

```
灵宠池升星（Phase 2）→ 攻击力成长（输出线）
修炼系统（Phase 1）  → HP/减伤/护盾/回复/操作时间（生存线）
固定关卡（Phase 3）  → 高级灵宠/碎片获取（内容消耗线）
```

### 1.2 核心约束

| 约束 | 说明 |
|------|------|
| **肉鸽保持纯粹** | 修炼升级**不影响**肉鸽塔中的任何数值。肉鸽的魅力在于每局从零开始的随机性，局外变量不应介入 |
| **攻击归灵宠池** | 修炼树不提供任何攻击/伤害加成，攻击成长完全由灵宠池升星（Phase 2）承载 |
| **不设额外门槛** | 修炼境界仅为展示性称号，不作为灵宠池、固定关卡等任何系统的解锁条件 |
| **修炼作用于固定关卡** | 所有修炼属性仅在固定关卡模式（`battleMode = 'stage'`）中生效 |

### 1.3 日常循环

```
打肉鸽塔 ──→ 赚经验 + 3星图鉴解锁灵宠入池
    │                    │
    ▼                    ▼
修炼提升生存面板    灵宠池升星提升攻击
    │                    │
    └──────┬─────────────┘
           ▼
    挑战固定关卡（Phase 3）
           │
           ▼
    获得高级灵宠/碎片 → 进一步变强
```

---

## 二、等级与修炼点系统

### 2.1 核心流程

```
打肉鸽/固定关卡 → 累积经验 → 升级（自动） → 获得修炼点 → 手动分配到升级树
```

每局战斗中累积的经验在局结束时统一结算。每次升级自动获得 **1 修炼点**，修炼点用于在修炼树上手动分配。

### 2.2 等级配置

- **最大等级**：60 级
- **每级获得**：1 修炼点
- **修炼树总需**：58 点（20+15+5+10+8），多出 2 点作为容错
- **升级经验公式**：

```javascript
expToNextLevel(level) = Math.floor(40 + level * 12 + Math.pow(level, 1.6) * 0.8)
```

经验节奏参考：

| 等级 | 升级所需 | 累计约需 |
|------|---------|---------|
| Lv1→2 | 53 | 53 |
| Lv5→6 | 118 | ~430 |
| Lv10→11 | 202 | ~1,200 |
| Lv20→21 | 416 | ~4,800 |
| Lv30→31 | 682 | ~12,000 |
| Lv50→51 | 1,352 | ~40,000 |
| Lv59→60 | 1,705 | ~60,000 |

### 2.3 修炼境界（由等级决定，纯展示）

境界由**人物等级**自动判定，仅影响显示称号和角色视觉特效：

| 等级范围 | 境界名 | 视觉效果 |
|----------|--------|----------|
| 0 | 凡人 | 无 |
| 1~4 | 感气期 | 无 |
| 5~14 | 练气期 | 淡金光环 + 3 灵气粒子 |
| 15~29 | 筑基期 | 蓝紫光环 + 5 灵气粒子 |
| 30~44 | 金丹期 | 金色光环 + 7 灵气粒子 |
| 45~57 | 元婴期 | 红金光环 + 10 灵气粒子 |
| 58+ | 化神期（满级） | 全套特效 + 12 灵气粒子 |

---

## 三、修炼升级树

### 3.1 五项升级属性

| # | 内部Key | 名称 | 主题名 | 效果 | 每级增量 | 上限 | 满级总收益 | 定位 |
|---|---------|------|--------|------|----------|------|-----------|------|
| 1 | `body` | 体魄 | 淬体 | 固定关卡 HP 上限增加 | +5 | 20 级 | +100 HP | 核心生存 |
| 2 | `spirit` | 灵力 | 通脉 | 固定关卡心珠回复基数增加 | +1 | 15 级 | +15 回复 | 续航 |
| 3 | `wisdom` | 悟性 | 感悟 | 固定关卡转珠时间增加 | +0.15s | 5 级 | +0.75s | 操作体验 |
| 4 | `defense` | 根骨 | 筑基 | 固定关卡每次受伤减免固定值 | +2 | 10 级 | -20 伤害/次 | 防御 |
| 5 | `sense` | 神识 | 开窍 | 固定关卡开局获得护盾 | +8 | 8 级 | +64 护盾 | 开局优势 |

**总计 58 点满。** 每次升级消耗 1 修炼点。

### 3.2 属性生效规则

- 所有属性**仅在固定关卡模式**（`g.battleMode === 'stage'`）中生效
- 肉鸽塔中所有修炼属性**不生效**，保持现有纯随机体验
- 根骨减伤为**固定值减免**（先减后算百分比减伤），最低伤害不低于 1

---

## 四、经验系统

### 4.1 经验获取来源

#### 肉鸽塔（主要经验来源）

| 来源 | 经验量 | 说明 |
|------|--------|------|
| 消除 | 3消 +1 / 4消 +2 / 5+消 +3 | 基础来源，所有消除均计入 |
| Combo | 每段 combo +2 | 鼓励高 combo 操作 |
| 击杀普通敌人 | `5 + floor × 2` | 按层数递增 |
| 击杀精英敌人 | `15 + floor × 3` | 精英额外奖励 |
| 击杀 BOSS | `30 + floor × 4` | BOSS 大额奖励 |
| 层数到达奖励 | `finalFloor × 3` | 按最终到达层数结算 |
| 通关奖励 | 500 | 仅通关第 30 层时获得 |
| **失败保底** | 以上总和 × 60% | 失败不白玩 |

#### 固定关卡（Phase 3 后开放）

| 来源 | 经验量 | 说明 |
|------|--------|------|
| 关卡内消除/combo | 同上规则 | 战斗中自然积累 |
| 通关奖励 | 按关卡难度 50~200 | 根据关卡难度档位给予 |
| 首通额外奖励 | 通关奖励 × 1.5 | 首通激励 |

### 4.2 经验结算流程

```
局内累积
  │ 消除/combo/击杀时 → g.runExp += N（同步追踪明细到 _runElimExp/_runComboExp/_runKillExp）
  ▼
局结束结算（settleExp）
  │ layerExp = finalFloor × 3
  │ clearBonus = 通关 ? 500 : 0
  │ rawTotal = runExp + layerExp + clearBonus
  │ finalExp = 通关 ? rawTotal : floor(rawTotal × 0.6)
  ▼
自动升级
  │ storage.addCultExp(finalExp)
  │   → exp 累加 → 循环检查 expToNextLevel
  │   → 每满一级：level++, skillPoints++
  │   → 返回本次升级次数 levelUps
  ▼
结算界面展示
  │ 显示本局获得经验明细 + 升级信息
  │ 分为"本局加成"和"修炼收益"两个区域
  │ 有可升级项时显示"前往修炼"快捷入口
  ▼
修炼界面
  │ 玩家手动分配修炼点到各属性
```

### 4.3 重新开局经验结算

当玩家在战斗中或标题页选择"重新开局"时，已积累的局内经验按**失败标准**（60%）结算，确保不浪费已有进度。通过独立的 `settleExp()` 函数实现。

### 4.4 战斗中经验反馈

为增强经验获得的即时反馈感，实现了以下视觉特效：

| 特效 | 位置 | 说明 |
|------|------|------|
| 经验指示器 | 战斗界面右上角（退出按钮下方） | 圆形图标 + `EXP` 标签 + 当前 `runExp` 数值，经验变化时脉冲放大 |
| 经验飘字 | 消除/击杀位置 → 指示器 | `+N` 文字沿贝塞尔曲线飞向指示器，到达时触发脉冲 |
| 过层经验汇总 | 事件页面顶部 | 进入新一层时短暂显示"上层获得经验 +XX"并淡出 |
| 胜利面板经验 | 战斗胜利弹窗 | "修炼收益"分区显示本层获得的修炼经验 |

---

## 五、数据结构设计

### 5.1 持久化数据（storage.js）

```javascript
// defaultPersist() 中的 cultivation 字段
cultivation: {
  level: 0,              // 人物等级（0~60）
  exp: 0,                // 当前等级已积累经验（用于升级判定）
  totalExpEarned: 0,     // 历史累计获得经验（统计用）
  skillPoints: 0,        // 可用修炼点（每升一级+1，消耗在升级树上）
  levels: {
    body: 0,             // 体魄等级（0~20）
    spirit: 0,           // 灵力等级（0~15）
    wisdom: 0,           // 悟性等级（0~5）
    defense: 0,          // 根骨等级（0~10）
    sense: 0,            // 神识等级（0~8）
  },
  realmBreakSeen: 0,     // 已看过突破动画的最高境界索引（防止重复播放）
},
selectedAvatar: 'boy1',  // 当前选择的角色形象ID
```

### 5.2 存档版本迁移

```javascript
// storage.js — CURRENT_VERSION = 3
const migrations = {
  // v0→v1：旧版无修炼字段，补全默认值
  1: (d) => {
    if (!d.cultivation) {
      d.cultivation = { level:0, exp:0, totalExpEarned:0, skillPoints:0,
        levels:{body:0,spirit:0,wisdom:0,defense:0,sense:0}, realmBreakSeen:0 }
    }
  },
  // v2→v3：从"经验直接消耗"改为"等级+加点制"，保留已有修炼进度
  2: (d) => {
    const cult = d.cultivation || {}
    const used = usedPoints(cult.levels)
    cult.level = used  // 等级 = 已投入点数
    cult.skillPoints = 0
    // ... 补全缺失字段
  },
}
```

另有 `_ensureCultivationFields()` 防御函数，在 `_load()` 后调用，保证所有嵌套字段存在默认值。

### 5.3 局内临时状态（gameState.js）

```javascript
// 修炼经验累积
g.runExp = 0             // 本局累积原始经验（消除+combo+击杀）
g._runElimExp = 0        // 消除经验分项
g._runComboExp = 0       // 连击经验分项
g._runKillExp = 0        // 击杀经验分项

// 经验反馈特效
g._expFloats = []        // 飞行中的经验飘字数组
g._expIndicatorPulse = 0 // 经验图标脉冲倒计时帧
g._expIndicatorX = 0     // 经验图标中心坐标（由 battleView 写入）
g._expIndicatorY = 0
g._floorStartExp = 0     // 本层开始时的 runExp 快照
g._floorExpSummary = null // 过层经验汇总 { amount, timer }
```

### 5.4 修炼配置常量

```javascript
// js/data/cultivationConfig.js
const MAX_LEVEL = 60

function expToNextLevel(level) {
  if (level >= MAX_LEVEL) return Infinity
  return Math.floor(40 + level * 12 + Math.pow(level, 1.6) * 0.8)
}

const CULT_CONFIG = {
  body:    { name:'体魄', theme:'淬体', maxLv:20, perLv:5,    unit:'HP上限',    desc:'固定关卡中英雄HP上限' },
  spirit:  { name:'灵力', theme:'通脉', maxLv:15, perLv:1,    unit:'心珠回复',  desc:'固定关卡中心珠回复基数' },
  wisdom:  { name:'悟性', theme:'感悟', maxLv:5,  perLv:0.15, unit:'s转珠时间', desc:'固定关卡中转珠操作时间' },
  defense: { name:'根骨', theme:'筑基', maxLv:10, perLv:2,    unit:'减伤',      desc:'固定关卡中每次受伤减免固定值' },
  sense:   { name:'神识', theme:'开窍', maxLv:8,  perLv:8,    unit:'护盾',      desc:'固定关卡中开局获得护盾' },
}

const CULT_KEYS = ['body', 'spirit', 'wisdom', 'defense', 'sense']
const TOTAL_POINTS_NEEDED = 58  // 20+15+5+10+8

function effectValue(key, level) { ... }  // 当前等级的累计效果值
function usedPoints(levels) { ... }       // 已分配的总修炼点数

// 境界系统：由等级决定
const REALMS = [
  { minLv: 0,  name: '凡人' },
  { minLv: 1,  name: '感气期' },
  { minLv: 5,  name: '练气期' },
  { minLv: 15, name: '筑基期' },
  { minLv: 30, name: '金丹期' },
  { minLv: 45, name: '元婴期' },
  { minLv: 58, name: '化神期' },
]

function currentRealm(level) { ... }  // 参数为等级，非属性等级和
function nextRealm(level) { ... }     // 下一境界

module.exports = {
  MAX_LEVEL, expToNextLevel,
  CULT_CONFIG, CULT_KEYS, TOTAL_POINTS_NEEDED,
  effectValue, usedPoints,
  REALMS, currentRealm, nextRealm,
}
```

---

## 六、代码改动清单

### 6.1 改动总览

| 优先级 | 改动 | 涉及文件 | 新增/修改 |
|--------|------|----------|-----------|
| P0 | 修炼配置常量 | `js/data/cultivationConfig.js` | **新增** |
| P0 | 持久化修炼数据 + 等级加点 | `js/data/storage.js` | 修改 |
| P0 | 局内经验累积（消除/连击/击杀） | `js/engine/battle.js` | 修改 |
| P0 | 局结算发放经验 + 自动升级 | `js/engine/runManager.js` | 修改 |
| P0 | 固定关卡开局应用修炼加成 | `js/engine/runManager.js` | 修改 |
| P0 | 暂存经验到存档续玩 | `js/engine/runManager.js` | 修改 |
| P0 | 重新开局经验结算 | `js/engine/runManager.js`（settleExp） | 修改 |
| P1 | 修炼 UI 界面（放射型星盘） | `js/views/cultivationView.js` | **新增** |
| P1 | 修炼触摸处理 + 导航栏 | `js/views/cultivationView.js` | **新增** |
| P1 | 场景注册 | `js/main.js` | 修改 |
| P1 | 首页导航栏入口 + 红点 | `js/views/titleView.js` | 修改 |
| P1 | 底部导航栏在修炼界面复用 | `js/views/titleView.js` → `cultivationView.js` | 修改 |
| P2 | 结算界面经验展示 + 升级提示 | `js/views/screens.js`（gameover 场景） | 修改 |
| P2 | 战斗经验指示器 + 飘字特效 | `js/views/battleView.js` | 修改 |
| P2 | 经验飘字动画更新 | `js/engine/animations.js` | 修改 |
| P2 | 经验反馈临时状态字段 | `js/gameState.js` | 修改 |
| P2 | 战斗胜利面板区分局内/局外 | `js/views/battleView.js` | 修改 |
| P2 | 过层经验汇总显示 | `js/views/eventView.js` | 修改 |
| P3 | 重新开局经验结算集成 | `js/input/touchHandlers.js` | 修改 |
| P3 | 调试跳过按钮经验模拟 | `js/input/touchHandlers.js` | 修改 |

### 6.2 各文件详细改动

#### 6.2.1 `js/data/cultivationConfig.js`（新增）

修炼系统的核心配置文件，包含：
- `MAX_LEVEL` = 60，`expToNextLevel()` 统一经验曲线
- `CULT_CONFIG` 五属性配置（无 `baseExp`，改为 1 点/级统一消耗）
- `CULT_KEYS` 属性键数组、`TOTAL_POINTS_NEEDED` = 58
- `effectValue(key, level)` / `usedPoints(levels)` 工具函数
- `REALMS` / `currentRealm(level)` / `nextRealm(level)` 境界系统

#### 6.2.2 `js/data/storage.js`

```
改动点：
1. CURRENT_VERSION 升到 3（v1→v2 补全字段，v2→v3 改为等级加点制）
2. defaultPersist() 新增 cultivation 字段（含 level/exp/skillPoints）和 selectedAvatar
3. _ensureCultivationFields() 防御函数，保证嵌套字段完整
4. upgradeCultivation(key)：消耗 1 修炼点升级指定属性
5. addCultExp(amount)：增加经验并自动升级，返回升级次数
6. cultivation 属性 getter（直接返回引用，非深拷贝）
```

#### 6.2.3 `js/engine/battle.js`

```
改动点：
1. 消除结算时累加经验（elimExp 按 3消/4消/5+消 = 1/2/3）
2. Combo 每段 +2 经验
3. 击杀敌人时累加经验（_addKillExp 辅助函数）
4. 生成经验飘字（g._expFloats）飞向指示器
5. 根骨减伤（g._cultDmgReduce）和灵力心珠加成（g._cultHeartBase）在固定关卡中生效
```

#### 6.2.4 `js/engine/runManager.js`

```
改动点：
1. startRun：初始化 g.runExp/g._runElimExp/g._runComboExp/g._runKillExp = 0
2. startRun：初始化 g._floorStartExp/g._floorExpSummary/g._expFloats
3. startRun：如果 battleMode === 'stage'，应用修炼加成
4. nextFloor：计算过层经验汇总、重置经验快照和飘字
5. settleExp(g)：独立导出的经验结算函数（供 endRun 和重新开局调用）
6. endRun：调用 settleExp(g)
7. saveAndExit / resumeRun：暂存/恢复 runExp 及修炼加成相关字段
```

**settleExp 核心逻辑**：
```javascript
function settleExp(g) {
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor
  const layerExp = finalFloor * 3
  const clearBonus = g.cleared ? 500 : 0
  const rawTotal = (g.runExp || 0) + layerExp + clearBonus
  const finalExp = g.cleared ? rawTotal : Math.floor(rawTotal * 0.6)
  const prevLevel = g.storage.cultivation.level || 0
  const levelUps = finalExp > 0 ? g.storage.addCultExp(finalExp) : 0
  // 保存结果供结算界面展示
  g._lastRunExp = finalExp
  g._lastRunLevelUps = levelUps
  g._lastRunPrevLevel = prevLevel
  g._lastRunExpDetail = { elimExp, comboExp, killExp, layerExp, clearBonus, rawTotal, isCleared }
}
```

#### 6.2.5 `js/views/cultivationView.js`（新增）

```
职责：渲染放射型修炼星盘界面
主要函数：
  - rCultivation(g)          — 主渲染函数
  - tCultivation(g,x,y,type) — 触摸处理
  - _drawBackground(...)      — 洞府背景 + 浮动灵气粒子
  - _drawEnergyLines(...)     — 中心到各节点的灵气连线 + 流动粒子
  - _drawFormation(...)       — 多层旋转法阵特效（六边形/五芒星/祥云/光环）
  - _drawNode(...)            — 属性节点（圆形底盘 + 环形进度条 + 图标）
  - _drawAvatar(...)          — 中央打坐角色（含境界光环/灵气粒子/浮动动画）
  - _drawDetailPanel(...)     — 属性升级详情弹窗
  - _drawAvatarPanel(...)     — 角色形象选择面板
  - _drawRealmBreak(...)      — 境界突破全屏动画
  - checkRealmBreak(g)        — 境界突破检查
  - hasCultUpgradeAvailable() — 红点判断（有修炼点且未满级）
导出：
  - rCultivation, tCultivation
  - hasCultUpgradeAvailable, resetScroll, checkRealmBreak
```

#### 6.2.6 `js/views/titleView.js`

```
改动点：
1. BAR_ITEMS 导航栏增加"修炼"入口（key:'cultivation'）
2. drawBottomBar 导出为公共函数，修炼界面复用
3. 修炼红点：hasCultUpgradeAvailable 判断
4. 导航栏选中状态：图标外发光效果（shadowBlur）
5. getLayout() 导出供修炼界面获取布局参数
```

#### 6.2.7 `js/main.js`

```
改动点：
1. render 分发新增 'cultivation' 场景 → cultView.rCultivation
2. touch 分发新增 'cultivation' 场景 → cultView.tCultivation
```

#### 6.2.8 `js/views/screens.js`（gameover 场景）

```
改动点：
展示"获得修炼经验"区域：
  - g._lastRunExp（经验总量）
  - 经验明细（消除/连击/击杀/层数/通关加成）
  - 未通关时标注"保底 60%"
  - 升级提示：Lv.X → Lv.Y 获得 N 修炼点
  - 经验条 + 当前等级 + 当前境界
  - "前往修炼"按钮（有可升级项时显示）
```

#### 6.2.9 `js/views/battleView.js`

```
改动点：
1. _drawExpIndicator：战斗右上角经验指示器（圆形图标+数值+脉冲动画）
2. _drawExpFloats：经验飘字（贝塞尔曲线飞向指示器）
3. 战斗胜利面板区分"本局加成"和"修炼收益"两个分区
```

#### 6.2.10 `js/engine/animations.js`

```
改动点：
1. 更新 g._expFloats 位置和透明度
2. 飘字到达目标时触发 g._expIndicatorPulse
3. 递减 g._expIndicatorPulse 和 g._floorExpSummary.timer
```

#### 6.2.11 `js/views/eventView.js`

```
改动点：
1. 进入事件页面时显示 g._floorExpSummary（"上层获得经验 +XX"）
2. 带淡出动画
```

#### 6.2.12 `js/input/touchHandlers.js`

```
改动点：
1. 重新开局（战斗退出弹窗、标题页弹窗）前调用 settleExp 结算经验
2. 调试跳过按钮模拟击杀+消除经验（方便调试）
3. gameover 场景"前往修炼"按钮跳转
4. 标题页/修炼页底部导航栏触摸处理
```

#### 6.2.13 `js/gameState.js`

```
改动点：
新增经验反馈特效相关字段（_expFloats、_expIndicatorPulse、_expIndicatorX/Y、_floorStartExp、_floorExpSummary）
```

---

## 七、UI 设计

### 7.1 修炼主界面布局（放射型星盘）

```
┌────────────────────────────────────┐
│                                    │
│           修炼洞府                  │ 顶部标题
│      「筑基期」 Lv.18              │ 境界名 + 等级
│      ████████░░░ 234/416           │ 经验条
│        可用修炼点：3               │ 修炼点
│   下次境界突破：Lv.30「金丹期」     │ 下次里程碑
│                                    │
│          [悟] (节点)               │
│         ╱          ╲               │ 5个属性节点
│       [体]    ⬡法阵⬡   [灵]       │ 环形排列
│         ╲    ╱ 打坐 ╲  ╱          │ + 中央法阵
│          [根]        [识]          │ + 打坐角色
│              🧘 角色                │
│           ══════════              │ 打坐平台
│            更换形象                 │
│                                    │
│  [更多][排行][图鉴] 🔥 [修炼][统计]│ 底部导航栏
└────────────────────────────────────┘
```

### 7.2 视觉元素

| 元素 | 实现方式 |
|------|----------|
| 背景 | `cultivation_bg.jpg` 洞府场景 + 代码绘制浮动灵气粒子 |
| 灵气连线 | 渐变线 + shadowBlur 发光 + 流动粒子（双粒子错开半周期） |
| 法阵 | 多层旋转几何（六边形、五芒星、内五边形、祥云纹、脉冲光环、属性色光点），透明度随修炼等级提升 |
| 属性节点 | 白色半透明圆底盘 + 环形进度条 + 属性色主题图标 + 等级文字 |
| 打坐角色 | 透明底 PNG 图片，底部对齐背景打坐台，带轻微浮动动画 |
| 境界特效 | 6 级视觉层次：无→淡光环→蓝紫光环→金色光环→红金光环→全套特效，含灵气环绕粒子 |
| 角色形象 | 6 位可选角色（4 已解锁 + 2 未解锁），打坐全身图 + 头像缩略 |
| 底部导航 | 复用首页 `drawBottomBar`，修炼图标为选中态（外发光） |
| 升级按钮 | 详情面板中金色渐变按钮，"修炼（消耗 1 修炼点）" |

### 7.3 交互细节

| 操作 | 响应 |
|------|------|
| 点击属性节点 | 弹出详情面板，显示当前效果/下一级预览/升级按钮 |
| 点击升级按钮（有修炼点） | 消耗 1 修炼点，等级+1，播放升级音效，节点闪光，检查境界突破。修炼点用完或满级自动关闭面板 |
| 点击升级按钮（无修炼点） | 按钮灰色，显示"修炼点不足" |
| 点击已满级按钮 | 灰色"已满级"状态 |
| 点击打坐角色 | 弹出"选择形象"面板 |
| 选择形象 | 切换打坐角色图片，保存到 storage |
| 点击面板外区域 | 关闭当前面板 |
| 境界突破动画中 | 点击任意位置跳过 |
| 底部导航栏 | 切换到对应场景（战斗/图鉴/排行/统计/更多） |

### 7.4 结算界面经验展示

```
┌────────────────────────────┐
│ 获得修炼经验                │
│                            │
│ 消除经验    +42            │
│ 连击经验    +28            │
│ 击杀经验    +65            │
│ 层数奖励    +36            │
│ 通关加成    +500           │ ← 通关时
│ 保底 60%                   │ ← 失败时
│ ─────────────────          │
│ 合计        +403           │
│                            │
│ 升级！Lv.12 → Lv.14       │ （升级时显示）
│ 获得 2 修炼点              │
│                            │
│ ████████░░░ 234/416 Lv.14  │ 经验条
│ 修炼境界：筑基期           │
│                            │
│      [前往修炼]            │ （有可升级项时显示）
└────────────────────────────┘
```

### 7.5 战斗胜利面板

胜利面板分为两个信息区域：

```
┌────────────────────────────┐
│ ▸ 本局加成                  │
│   境界加成  凝气四层         │
│   HP上限    +15             │
│   攻击加成  +12%            │
│   法宝加成  ...             │
│                            │
│ ▸ 修炼收益                  │
│   修炼经验  +23             │
└────────────────────────────┘
```

---

## 八、关键流程图

### 8.1 整体流程

```
标题页
  ├── 底部导航"修炼"→ 修炼界面
  │     │ 分配修炼点到升级树 → 属性提升
  │     │ 切换角色形象
  │     └── 底部导航切换回其他页面
  ├── 点击"开始挑战"→ 肉鸽塔
  │     │ 局内消除/combo/击杀 → 累积 g.runExp（右上角经验指示器实时显示）
  │     │ 过层时显示本层经验汇总
  │     │ 局结束 → settleExp → 自动升级 → gameover 场景展示经验 + 升级信息
  │     │           └→ gameover 中可点"前往修炼"→ 修炼界面
  │     │ 重新开局 → settleExp（按失败结算 60%）→ 新局
  │     └→ 返回标题页
  └── 点击"固定关卡"（Phase 3）→ 编队 → 战斗
        │ 开局时应用修炼加成（HP/护盾/转珠时间/减伤/心珠回复）
        │ 局内同样累积 g.runExp
        │ 局结束 → settleExp → 发放经验
        └→ 返回
```

### 8.2 升级流程（等级 + 加点）

```
经验获得
  ├── storage.addCultExp(amount)
  │     ├── exp += amount
  │     └── while exp >= expToNextLevel(level):
  │           ├── exp -= needed
  │           ├── level++
  │           └── skillPoints++
  ▼
修炼界面分配
  ├── 点击属性节点 → 打开详情面板
  ├── 点击"修炼"按钮
  │     ├── 检查：skillPoints > 0？→ 否 → "修炼点不足"
  │     ├── 检查：属性等级 < maxLv？→ 否 → "已满级"
  │     └── 通过 →
  │           ├── skillPoints--
  │           ├── levels[key]++
  │           ├── storage._save()
  │           ├── 播放升级音效 + 节点闪光
  │           └── checkRealmBreak：检查 level 是否达到新境界
  │                 ├── 否 → 结束
  │                 └── 是 → 播放境界突破全屏动画 → 更新 realmBreakSeen
  └── 修炼点用完或满级 → 自动关闭面板
```

---

## 九、角色形象系统

### 9.1 角色列表

| ID | 名称 | 解锁状态 | 文件 |
|----|------|----------|------|
| boy1 | 修仙少年 | 已解锁 | `char_boy1.png` / `hero_cultivation.jpg` |
| girl1 | 灵木仙子 | 已解锁 | `char_girl1.png` / `avatar_girl1.jpg` |
| boy2 | 剑灵少侠 | 已解锁 | `char_boy2.png` / `avatar_boy2.jpg` |
| girl2 | 星月仙子 | 已解锁 | `char_girl2.png` / `avatar_girl2.jpg` |
| boy3 | 天罡道童 | 未解锁 | `char_boy3.png` / `avatar_boy3.jpg` |
| girl3 | 花灵仙子 | 未解锁 | `char_girl3.png` / `avatar_girl3.jpg` |

### 9.2 资源规格

- **打坐全身图**（`char_*.png`）：透明底 PNG，正面盘腿打坐，头身比 1:2 ~ 1:3
- **头像缩略**（`avatar_*.jpg` / `hero_cultivation.jpg`）：圆形裁剪用
- **背景**（`cultivation_bg.jpg`）：洞府场景，含打坐平台

---

## 十、测试要点

| 测试项 | 验证内容 |
|--------|---------|
| 经验累积准确性 | 消除 3/4/5+ 分别给 1/2/3 经验；combo 每段 +2；击杀按层数和敌人类型正确计算 |
| 失败保底 | 失败时经验 = 总和 × 60%，向下取整 |
| 自动升级 | addCultExp 正确循环升级，每级获得 1 修炼点 |
| 修炼点消耗 | 每次升级消耗 1 修炼点，不能透支 |
| 满级限制 | 各属性不能超过上限，满级后按钮灰色；等级 60 级后经验继续累积但不升级 |
| 修炼点不足 | 无修炼点时无法升级，显示提示 |
| 肉鸽不受影响 | 肉鸽塔中 heroMaxHp/dragTimeLimit/heroShield/伤害计算均不受修炼影响 |
| 固定关卡加成生效 | 固定关卡中各项修炼加成正确应用（体魄→HP、神识→护盾、悟性→时间、根骨→减伤、灵力→回复） |
| 存档兼容 | 旧存档升级到 v3 后自动获得默认字段，已有进度不丢失 |
| _ensureCultivationFields | 缺失字段自动补全，不会 null/undefined 报错 |
| 续玩恢复 | saveAndExit 后 resumeRun 能正确恢复 runExp 及修炼加成 |
| 重新开局经验 | 重新开局前按失败结算已积累经验 |
| 境界显示 | 等级变化时境界名称正确更新 |
| 突破动画 | 首次达到新境界时播放动画，重复进入不再播放 |
| 红点提示 | 有修炼点且有未满级属性时显示红点 |
| 结算展示 | gameover 场景正确展示经验明细、升级信息、经验条 |
| 经验反馈 | 战斗中消除/击杀后飘字正确飞向指示器，数值正确 |
| 角色切换 | 选择形象后打坐角色正确更换，存档持久化 |
| 导航栏 | 修炼界面底部导航栏正常工作，选中态正确 |
