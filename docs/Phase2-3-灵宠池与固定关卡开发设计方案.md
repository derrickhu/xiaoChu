# Phase 2&3：灵宠池与固定关卡 — 开发设计方案

> 版本日期：2026-03-08（决策确认版）  
> 前置依赖：Phase 0（已完成）、Phase 1（已完成）  
> 状态：**开发完成（待联调验证）**

---

## 一、设计原则回顾

### 1.1 三支柱结构

```
肉鸽爬塔（现有，保持纯粹）
  │ 3星图鉴 → ★1入池（唯一入池途径）
  │ 再次同宠3星 → 碎片
  │ 赚经验 → 修炼升级
  ▼
灵宠池（Phase 2，局外持久养成）
  │ 碎片升星 + 等级培养
  │ 编队出战固定关卡
  ▼
固定关卡（Phase 3）
  │ 用灵宠池编队挑战
  │ 获取碎片 + 经验
  │ Phase 4 后获取高级灵宠
  ▼
反哺循环
  │ 碎片 → 灵宠池升星
  │ 高级灵宠 → 入池培养
  │ 高级灵宠也可"带它出战"到肉鸽
```

### 1.2 核心约束

| 约束 | 说明 |
|------|------|
| **肉鸽保持纯粹** | 肉鸽塔内的宠物星级/技能/属性等玩法完全不受灵宠池影响。灵宠池数据不介入肉鸽内部数值 |
| **入池唯一途径** | 只有肉鸽中★3 图鉴解锁才能入池（★1 形态），保持图鉴系统的核心价值 |
| **灵宠池独立培养** | 灵宠池中的等级/星级系统与肉鸽内的★1→★3 完全独立。肉鸽内是简化的局内升星，灵宠池是长期的局外养成 |
| **修炼作用于固定关卡** | Phase 1 的修炼加成（HP/减伤/护盾/回复/转珠时间）仅在固定关卡中生效 |
| **体力仅限关卡** | 肉鸽不消耗体力（想玩就玩），体力仅用于固定关卡，控制养成内容消耗节奏 |

### 1.3 "带它出战"功能说明

"带它出战"是图鉴系统的专属功能，**仅作用于肉鸽塔**：

| 情况 | 行为 |
|------|------|
| 指定的是普通灵宠（已在图鉴中） | 以★1 形态替换初始队伍同属性宠物（现有逻辑） |
| 指定的是高级灵宠（灵宠池中获得的） | 将该高级灵宠加入当局 `sessionPetPool` 对应属性池中，以★1 形态替换初始队伍同属性宠物 |

**设计意图**：高级灵宠通过"带它出战"可以在肉鸽中被使用，但仍然遵循局内规则（★1 起步、需要抽到重复才升星）。高级灵宠在肉鸽中可能有更强的基础技能或更高的基础攻击，体现差异化价值，但不破坏肉鸽的随机性和公平性。

---

## 二、体力系统

### 2.1 基础设定

| 项目 | 设定 |
|------|------|
| 体力上限 | 100 |
| 自然恢复 | 每 30 分钟恢复 1 点（每日自然恢复 48 点） |
| **肉鸽消耗** | **不消耗体力，想玩就玩** |
| 固定关卡消耗 | 每次 10 体力 |
| 首次游玩 | 满体力 100 |
| 恢复计算 | 基于真实时间差，离线也恢复 |

> **决策确认**：肉鸽不消耗体力，暂不限制收益。体力仅控制固定关卡游玩频率。

### 2.2 数据结构

```javascript
// storage.js 新增
stamina: {
  current: 100,          // 当前体力
  max: 100,              // 体力上限
  lastRecoverTime: 0,    // 上次恢复计算时间戳（ms）
}
```

### 2.3 恢复算法

```javascript
function recoverStamina(staminaData) {
  const now = Date.now()
  const elapsed = now - staminaData.lastRecoverTime
  const RECOVER_INTERVAL = 30 * 60 * 1000  // 30分钟
  const recovered = Math.floor(elapsed / RECOVER_INTERVAL)
  if (recovered > 0) {
    staminaData.current = Math.min(staminaData.max, staminaData.current + recovered)
    staminaData.lastRecoverTime += recovered * RECOVER_INTERVAL
  }
  return staminaData
}
```

### 2.4 体力不足处理

- 体力不足时"开始挑战"/"出战"按钮变灰
- 显示"体力不足，XX:XX 后恢复"倒计时
- 后续可扩展：观看广告恢复体力、每日签到送体力等

### 2.5 UI 展示

- 首页顶栏显示体力：`⚡ 72/100`，附带恢复倒计时
- 体力低于消耗值时按钮置灰 + 提示

---

## 三、Phase 2 — 灵宠池

### 3.1 入池与碎片规则

| 触发条件 | 结果 |
|----------|------|
| 肉鸽中首次某只宠物达到★3 图鉴 | 该宠物以 **★1 Lv.5 + 赠送2碎片** 进入灵宠池 |
| 肉鸽中再次同一只宠物达到★3 图鉴 | 获得该宠物碎片 ×5 |
| 固定关卡通关（Phase 3） | 按关卡配置获得随机碎片 |
| 固定关卡首通（Phase 4 后） | 指定高级灵宠★1 入池 |
| 碎片分解 | 不需要的碎片可分解：**1碎片 = 40宠物经验** |

### 3.2 灵宠池独立培养体系

灵宠池中的宠物拥有**独立的等级系统**，与肉鸽内的★1/★2/★3 完全分开：

#### 3.2.1 等级系统

| 项目 | 设定 |
|------|------|
| 等级范围 | Lv.1 ~ Lv.40（普通灵宠） / Lv.1 ~ Lv.60（高级灵宠，Phase 4） |
| 升级资源 | 灵宠经验（从固定关卡战斗中获取，或消耗通用经验丹） |
| 每级收益 | 攻击力 +1~2（按基础攻击和档位微调） |

#### 3.2.2 星级系统（等级门槛 + 碎片）

灵宠池中的升星需要**同时满足等级门槛和碎片数量**：

| 目标星级 | 等级门槛 | 所需碎片 | 解锁内容 |
|----------|----------|----------|----------|
| ★1（入池） | Lv.5 | - | 基础攻击（无技能）+ 赠送2碎片 |
| ★2 | Lv.10 | 5 碎片 | 解锁技能 A |
| ★3 | **Lv.20** | 15 碎片 | 技能 A 强化 |
| ★4（仅高级，Phase 4） | Lv.45 | 30 碎片 | 终极形态 |

> ★2/★3 的效果与肉鸽内的★2/★3 技能相同，但解锁条件完全不同。肉鸽内靠重复获取自动升星（简洁快速），灵宠池靠长期培养（等级+碎片双重门槛）。

#### 3.2.3 灵宠池攻击力计算

```javascript
// 灵宠池中宠物的攻击力（仅用于固定关卡）
function getPoolPetAtk(poolPet) {
  const basePet = getPetById(poolPet.id)
  if (!basePet) return 0
  const baseAtk = basePet.atk
  // 等级加成：每级 +1（T1/T2）或 +0.8（T3），向下取整
  const tier = getPetTier(basePet)
  const lvBonus = tier === 'T3' ? Math.floor(poolPet.level * 0.8) : poolPet.level
  // 星级倍率
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  return Math.floor((baseAtk + lvBonus) * starMul)
}

const POOL_STAR_ATK_MUL = {
  1: 1.0,
  2: 1.3,
  3: 1.7,
  4: 2.2,  // Phase 4
}
```

#### 3.2.4 共享宠物经验池

**核心改动**：从"参战宠物各自获得经验"变为"所有经验汇入共享池，玩家自主分配"。

| 来源 | 经验量 | 说明 |
|------|--------|------|
| **肉鸽局结算** | 战斗经验×30% + 层数×2 + 通关奖励200 | 独立于修炼经验计算 |
| **固定关卡结算** | 关卡基础经验 × 评价倍率 | Phase 3 |
| **碎片分解** | 1碎片 = 40经验 | 不需要的碎片回收 |
| 通用经验丹（后续扩展） | 固定值 | 道具 |

**按档位差异化升级成本**（`petPoolConfig.js`中`TIER_EXP_MUL`）：
- T3 宠物（ATK 8~9）：基础成本×1.0 — 便宜易练
- T2 宠物（ATK 10~12）：基础成本×1.3 — 中等
- T1 宠物（ATK 13~14）：基础成本×1.6 — 长期投资

灵宠经验升级公式（含档位倍率）：

```javascript
function petExpToNextLevel(level, tier) {
  const base = Math.floor(20 + level * 8 + Math.pow(level, 1.4) * 0.5)
  const mul = TIER_EXP_MUL[tier] || 1.0
  return Math.floor(base * mul)
}
```

经验节奏参考：

| 等级 | 升级所需 | 累计约需 | 里程碑 |
|------|---------|---------|--------|
| Lv.1→2 | 29 | 29 | |
| Lv.5→6 | 66 | ~240 | |
| Lv.10→11 | 113 | ~700 | 可升★2 |
| Lv.15→16 | 165 | ~1,500 | |
| Lv.25→26 | 296 | ~4,200 | 可升★3 |
| Lv.30→31 | 365 | ~5,900 | |
| Lv.40 | - | ~10,000 | 普通满级 |

### 3.3 灵宠池数据结构

```javascript
// storage.js 中新增持久化字段
{
  petPool: [
    {
      id: 'w5',              // 宠物 ID（与 pets.js 一致）
      attr: 'wood',          // 属性（冗余，方便筛选）
      star: 1,               // 当前星级 1~3（普通）/ 1~4（高级，Phase 4）
      level: 5,              // 当前等级（入池初始 Lv.5）
      fragments: 2,          // 当前碎片数（入池初始 2）
      source: 'roguelike',   // 来源：'roguelike' | 'stage'
      obtainedAt: 0,         // 入池时间戳
    }
  ],
  petExpPool: 0,             // 共享宠物经验池（未分配）
}
```

> **注意**：灵宠池中宠物没有 `exp` 字段。`level` 是已投入经验的结果，共享经验池 `petExpPool` 是待分配的全局资源。

### 3.4 Storage 新增接口

> **已实现**：见 `js/data/storage.js` 中 "灵宠池系统" 和 "体力系统" 部分。

关键接口：
- `addToPetPool(petId, source)` — 入池（★1 Lv.5 + 2碎片）
- `addFragments(petId, count)` — 增加碎片
- `decomposeFragments(petId, count)` — 分解碎片为共享经验
- `addPetExp(amount)` — 增加共享经验池
- `investPetExp(petId, amount)` — 从共享池投入经验升级指定宠物
- `upgradePoolPetStar(petId)` — 升星（需等级+碎片双门槛）
- `get petPool` / `get petPoolCount` / `get petExpPool` — 读取接口
- `consumeStamina(amount)` / `get currentStamina` / `get staminaRecoverSec` — 体力接口

### 3.5 入池逻辑改动（skills.js）

```javascript
// 修改 _mergePetAndDex 函数
function _mergePetAndDex(g, allPets, newPet) {
  const result = tryMergePet(allPets, newPet)
  if (result.merged && result.target && (result.target.star || 1) >= MAX_STAR) {
    // 记录到图鉴
    const alreadyInDex = g.storage.data.petDex.includes(result.target.id)
    g.storage.addPetDex(result.target.id)

    if (!alreadyInDex) {
      // 首次★3图鉴 → 入池
      const added = g.storage.addToPetPool(result.target.id, 'roguelike')
      if (added) {
        g._petPoolEntryPopup = { petId: result.target.id }
      }
    } else {
      // 再次★3 → 碎片（仅已入池的宠物）
      const inPool = g.storage.petPool.find(p => p.id === result.target.id)
      if (inPool) {
        g.storage.addFragments(result.target.id, 5)
        g._fragmentObtainedPopup = { petId: result.target.id, count: 5 }
      }
    }
  }
  return result
}
```

### 3.6 "带它出战"增强（runManager.js）

```javascript
// startRun 中处理指定宠物
if (g._designatedPetId) {
  const dpId = g._designatedPetId
  g._designatedPetId = null
  let dpData = null, dpAttr = ''
  for (const attr of ['metal','wood','water','fire','earth']) {
    const found = PETS[attr].find(p => p.id === dpId)
    if (found) { dpData = found; dpAttr = attr; break }
  }
  if (dpData) {
    const designatedPet = { ...dpData, attr: dpAttr, star: 1, currentCd: 0 }

    // 如果是灵宠池中的高级灵宠，先加入当局 sessionPetPool
    const poolEntry = g.storage.petPool.find(p => p.id === dpId)
    if (poolEntry && poolEntry.source === 'stage') {
      // 高级灵宠加入当局宠物池（确保肉鸽内也能抽到它升星）
      if (g.sessionPetPool[dpAttr] && !g.sessionPetPool[dpAttr].find(p => p.id === dpId)) {
        g.sessionPetPool[dpAttr].push(dpData)
      }
    }

    // 替换队伍中同属性宠物
    const sameAttrIdx = g.pets.findIndex(p => p.attr === dpAttr)
    if (sameAttrIdx >= 0) {
      g.pets[sameAttrIdx] = designatedPet
    } else {
      g.pets[g.pets.length - 1] = designatedPet
    }
  }
}
```

### 3.7 灵宠池解锁条件

| 条件 | 效果 |
|------|------|
| 首只宠物入池 | 解锁底部导航"灵宠"标签（移除 `locked: true`） |
| 灵宠池 ≥ 5 只 | 解锁固定关卡入口（首页 stage 模式可用） |

### 3.8 灵宠池 UI 设计

#### 3.8.1 主界面布局（简洁方案）

```
┌────────────────────────────────────┐
│  灵宠池    宠物经验：1,234   已收集8 │ 顶栏：全局经验池余额 + 收集数
│  ─────────────────────────────     │
│  [全部] [金] [木] [水] [火] [土]   │ 属性筛选（不是功能子标签）
│                                    │
│  ┌─────┐ ┌─────┐ ┌─────┐         │ 宠物卡片网格（3列）
│  │ 头像 │ │ 头像 │ │ 头像 │         │
│  │金锋灵│ │玄甲金│ │青灵木│         │
│  │★★☆  │ │★☆☆  │ │★★★  │         │ 星级显示
│  │Lv.18 │ │Lv.5  │ │Lv.32│         │ 等级显示
│  │ATK:45│ │ATK:16│ │ATK:58│         │ 当前攻击力
│  └─────┘ └─────┘ └─────┘         │
│  ...（可滚动）                      │
│                                    │
│  固定关卡未解锁（还需2只灵宠入池）  │ 解锁提示（< 5只时）
│                                    │
│  [修炼][灵宠][图鉴] ⚔ [排行][统计][更多] │ 底部导航栏
└────────────────────────────────────┘
```

> **UI 决策**：不加子标签。编队在固定关卡流程中单独处理。Phase 6 合成到时加顶部子标签。

#### 3.8.2 宠物详情面板（点击卡片弹出）

```
┌──────────────────────────────────┐
│  金锋灵猫                         │ 名称
│  属性：金 | 档位：T3 | 来源：图鉴  │ 基础信息
│  ────────────────────────         │
│  攻击力：45                       │ 含等级加成
│    基础 8 + 等级 +18 × 星级 ×1.3  │ 攻击力明细
│  ────────────────────────         │
│  [升级] Lv.18→19 消耗 165 经验    │ 投入经验（长按连续升级）
│  宠物经验池余额：1,234             │ 当前可用
│  ────────────────────────         │
│  星级：★★☆                       │
│  技能：锋芒斩（已解锁）            │ ★2 已解锁
│    下次金属性伤害×2倍              │
│  ────────────────────────         │
│  下一星级：★★★                    │
│  需要：Lv.20（当前 Lv.18）         │ 等级门槛
│  碎片：3 / 15  ██░░░░░░░░░       │ 碎片进度
│  [升星]  [分解碎片→经验]           │ 碎片操作
│  ────────────────────────         │
│  提示："再升 2 级即可升星"          │ 接近时高亮引导
└──────────────────────────────────┘
```

### 3.9 Phase 2 代码改动清单

| 优先级 | 改动 | 涉及文件 | 新增/修改 | 预估工时 |
|--------|------|----------|-----------|----------|
| P0 | 灵宠池数据结构 + 接口 | `js/data/storage.js` | 修改 | 0.5天 |
| P0 | 灵宠池配置（升星/经验/攻击力公式） | `js/data/petPoolConfig.js` | **新增** | 0.5天 |
| P0 | 存档版本迁移 v3→v4 | `js/data/storage.js` | 修改 | 0.3天 |
| P0 | ★3 入池/碎片判断 | `js/engine/skills.js` | 修改 | 0.5天 |
| P0 | 体力系统数据 + 恢复逻辑 | `js/data/storage.js` | 修改 | 0.5天 |
| P0 | "带它出战"高级灵宠支持 | `js/engine/runManager.js` | 修改 | 0.3天 |
| P1 | 灵宠池主界面 + 触摸 | `js/views/petPoolView.js` | **新增** | 2.5天 |
| P1 | 宠物详情面板（含等级/碎片/升星） | `js/views/petPoolView.js` | **新增** | 1天 |
| P1 | 入池/碎片获得弹窗 | `js/views/dialogs.js` | 修改 | 0.5天 |
| P1 | 场景注册 + 导航解锁 | `js/main.js` + `js/views/titleView.js` | 修改 | 0.3天 |
| P1 | 首页体力显示 | `js/views/titleView.js` | 修改 | 0.3天 |
| P1 | 肉鸽/关卡开始前体力检查 | `js/input/touchHandlers.js` | 修改 | 0.3天 |
| P2 | 云同步 petPool + stamina | `js/data/storage.js` | 修改 | 0.3天 |
| P2 | gameState 新增字段 | `js/gameState.js` | 修改 | 0.2天 |
| P2 | 灵宠池红点（有碎片可升星时） | `js/views/titleView.js` | 修改 | 0.2天 |

**Phase 2 总预估：7~8 工作日（约 1.5~2 周）**

---

## 四、Phase 3 — 固定关卡

### 4.1 解锁与入口

| 条件 | 效果 |
|------|------|
| 灵宠池 ≥ 5 只 | 首页模式切换浮钮中"固定关卡"变为可用状态 |
| 首页切换到 stage 模式 | 点击"开始挑战"→ 进入关卡选择页（`stageSelect` 场景） |

**与肉鸽的 UI 区分**：
- 肉鸽模式：点击"开始挑战"→ 直接 `startRun()` → 进入第一层事件
- 固定关卡模式：点击"开始挑战"→ 进入 `stageSelect` 场景 → 选择关卡 → 编队 → 战斗

### 4.2 关卡配置结构

```javascript
// js/data/stages.js — 新增文件

const CHAPTERS = [
  { id: 1, name: '灵山试炼', desc: '灵山脚下，试炼开始', unlockPool: 5 },
  { id: 2, name: '幽冥秘境', desc: '幽暗深处，危机四伏', unlockPool: 10 },
  { id: 3, name: '天劫雷域', desc: '九天雷劫，唯强者渡', unlockPool: 15 },
]

const STAGES = [
  {
    id: 'stage_1_1',
    name: '初试·土灵',
    chapter: 1,
    order: 1,
    waves: [
      {
        enemies: [
          {
            name: '山灵', attr: 'earth', hp: 500, atk: 18, def: 6,
            skills: [], avatar: 'enemies/earth_1.png',
          }
        ]
      }
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 3, a: 5 },        // S/A 评价回合阈值
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_earth', count: 5 },
        { type: 'exp', amount: 200 },
        { type: 'petExp', amount: 80 },
      ],
      repeatClear: {
        fragments: { min: 1, max: 3, pool: 'chapter' },
        exp: 50,
        petExp: 40,
      },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: null },
    // 战斗中获取的灵宠经验基础值（参战宠物平分）
    battlePetExp: 30,
  },
  {
    id: 'stage_1_2',
    name: '烈焰·双波',
    chapter: 1,
    order: 2,
    waves: [
      {
        enemies: [
          {
            name: '火灵兽', attr: 'fire', hp: 600, atk: 20, def: 7,
            skills: [], avatar: 'enemies/fire_1.png',
          }
        ]
      },
      {
        enemies: [
          {
            name: '炎魔', attr: 'fire', hp: 800, atk: 26, def: 9,
            skills: ['atkBuff'], avatar: 'enemies/fire_2.png',
          }
        ]
      },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 8 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_fire', count: 8 },
        { type: 'exp', amount: 300 },
        { type: 'petExp', amount: 120 },
      ],
      repeatClear: {
        fragments: { min: 2, max: 4, pool: 'chapter' },
        exp: 80,
        petExp: 60,
      },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_1_1' },
    battlePetExp: 40,
  },
  // ... 每章 4~6 关，首批总计 12~18 关
]

module.exports = {
  CHAPTERS,
  STAGES,
  getStageById(id) { return STAGES.find(s => s.id === id) },
  getChapterStages(chapterId) {
    return STAGES.filter(s => s.chapter === chapterId).sort((a,b) => a.order - b.order)
  },
  isStageUnlocked(stageId, clearRecord, poolCount) { ... },
  isChapterUnlocked(chapterId, poolCount) { ... },
}
```

### 4.3 场景流转

```
首页（stage 模式）
  │ 点击"开始挑战"→ 检查体力 ≥ 10 && 灵宠池 ≥ 5
  ▼
stageSelect（关卡选择）
  │ 按章节展示关卡列表
  │ 标注：难度 / 首通标记 / 星级评价 / 每日剩余次数
  │ 选择一个已解锁的关卡
  ▼
stageTeam（编队）
  │ 从灵宠池选 3~5 只
  │ 显示每只灵宠的等级/星级/属性/攻击力
  │ 确认出战（≥ 3 只时按钮可用）
  ▼
battle（战斗 — battleMode='stage'）
  │ 复用现有战斗引擎
  │ 差异：宠物来自编队 / 敌人来自关卡配置
  │ 多波次支持（波间保留棋盘，显示"第 X 波"过渡）
  │ 修炼加成生效
  │ 无法宝 / 无奇遇 / 无商店 / 无休息
  ▼
stageResult（关卡结算）
  │ 评价 S/A/B
  │ 展示掉落：碎片 + 修炼经验 + 灵宠经验
  │ 首通额外奖励
  │ 灵宠经验分配（参战宠物均分）
  │ 扣除体力
  ▼
stageSelect（返回关卡选择）
```

### 4.4 战斗引擎适配

#### 4.4.1 新增状态字段（gameState.js）

```javascript
// Phase 3 新增
g.battleMode = 'roguelike'    // 'roguelike' | 'stage'
g._stageId = null             // 当前关卡 ID
g._stageWaves = []            // 当前关卡波次配置
g._stageWaveIdx = 0           // 当前波次索引
g._stageTeam = []             // 编队灵宠 poolPet 引用列表
g._stageTeamFilter = 'all'    // 编队属性筛选
g._stageTeamScroll = 0        // 编队列表滚动
g._stageTotalTurns = 0        // 关卡总回合数（跨波次累计）
g._stageResult = null         // 结算数据
```

#### 4.4.2 战斗初始化（stageManager.js）

```javascript
function startStage(g, stageId, teamPetIds) {
  const stage = getStageById(stageId)
  if (!stage) return false

  // 扣除体力
  g.storage.consumeStamina(stage.staminaCost)

  g.battleMode = 'stage'
  g._stageId = stageId
  g._stageWaves = stage.waves
  g._stageWaveIdx = 0
  g._stageTotalTurns = 0

  // 从灵宠池构建战斗用宠物数组
  g.pets = teamPetIds.map(id => {
    const poolPet = g.storage.petPool.find(p => p.id === id)
    const basePet = getPetById(id)
    return {
      ...basePet,
      star: poolPet.star,
      atk: getPoolPetAtk(poolPet),  // 使用灵宠池攻击力
      currentCd: 0,
      _poolRef: poolPet,            // 保留引用，结算时分配经验
    }
  })

  // 应用修炼加成
  const cult = g.storage.cultivation
  g.heroMaxHp = 100 + effectValue('body', cult.levels.body)
  g.heroHp = g.heroMaxHp
  g.heroShield = effectValue('sense', cult.levels.sense)
  g.dragTimeLimit = (8 + effectValue('wisdom', cult.levels.wisdom)) * 60
  g._cultDmgReduce = effectValue('defense', cult.levels.defense)
  g._cultHeartBase = effectValue('spirit', cult.levels.spirit)

  // 初始化经验追踪
  g.runExp = 0
  g._runElimExp = 0
  g._runComboExp = 0
  g._runKillExp = 0

  // 法宝/背包清空（固定关卡不使用法宝）
  g.weapon = null
  g.petBag = []
  g.weaponBag = []
  g.runBuffs = { ...DEFAULT_RUN_BUFFS }

  // 加载第一波敌人
  loadWave(g, 0)

  // 初始化棋盘
  initBoard(g)
  g.bState = 'playerTurn'
  g.scene = 'battle'
}

function loadWave(g, waveIdx) {
  const wave = g._stageWaves[waveIdx]
  const enemies = wave.enemies.map(e => ({
    ...e,
    maxHp: e.hp,
    buffs: [],
  }))
  // 固定关卡只有单敌人（基础版）
  g.enemy = enemies[0]
  g._stageWaveIdx = waveIdx
}
```

#### 4.4.3 battle.js 波次处理

```javascript
// victory 状态中新增 stage 分支
if (g.bState === 'victory') {
  if (g.battleMode === 'stage') {
    g._stageTotalTurns += g.turnCount
    if (g._stageWaveIdx < g._stageWaves.length - 1) {
      // 还有下一波 → 波间过渡
      g.bState = 'waveTransition'
      g._stateTimer = 60  // 1秒过渡动画
    } else {
      // 全部波次完成 → 进入关卡结算
      settleStage(g)
    }
  } else {
    // 现有肉鸽胜利逻辑不变
  }
}

// 新增 waveTransition 状态处理
if (g.bState === 'waveTransition') {
  g._stateTimer--
  if (g._stateTimer <= 0) {
    loadWave(g, g._stageWaveIdx + 1)
    g.turnCount = 0
    g.bState = 'playerTurn'
  }
}

// defeat 状态中新增 stage 分支
if (g.bState === 'defeat' && g.battleMode === 'stage') {
  // 固定关卡失败：不惩罚，不结算碎片奖励
  // 但仍结算修炼经验（按失败保底 60%）和灵宠经验（50%）
  settleStageDefeat(g)
}
```

### 4.5 关卡结算

```javascript
// stageManager.js

function settleStage(g) {
  const stage = getStageById(g._stageId)
  const isFirstClear = !g.storage.isStageCleared(g._stageId)
  const rating = calculateRating(g._stageTotalTurns, stage.rating)

  // 评价倍率
  const ratingMul = { S: 2.0, A: 1.5, B: 1.0 }[rating]

  // 碎片奖励
  const rewards = []
  if (isFirstClear && stage.rewards.firstClear) {
    rewards.push(...resolveRewards(g, stage.rewards.firstClear))
  }
  const fragRange = stage.rewards.repeatClear.fragments
  const fragCount = Math.ceil(randomInt(fragRange.min, fragRange.max) * ratingMul)
  const fragTarget = pickFragmentTarget(g, stage)
  rewards.push({ type: 'fragment', petId: fragTarget, count: fragCount })

  // 修炼经验
  const baseExp = stage.rewards.repeatClear.exp || 0
  const firstClearExpBonus = isFirstClear ? Math.floor(baseExp * 0.5) : 0
  const layerExp = 0  // 固定关卡无层数概念
  const clearBonus = Math.ceil(baseExp * ratingMul) + firstClearExpBonus
  const rawTotal = (g.runExp || 0) + clearBonus
  const finalExp = rawTotal
  const prevLevel = g.storage.cultivation.level || 0
  const levelUps = finalExp > 0 ? g.storage.addCultExp(finalExp) : 0

  // 灵宠经验（参战宠物均分）
  const basePetExp = stage.rewards.repeatClear.petExp || 0
  const petExp = Math.ceil(basePetExp * ratingMul)
  const petLevelUps = {}
  g.pets.forEach(pet => {
    if (pet._poolRef) {
      const ups = g.storage.addPetPoolExp(pet.id, petExp)
      if (ups > 0) petLevelUps[pet.id] = ups
    }
  })

  // 应用碎片
  rewards.forEach(r => {
    if (r.type === 'fragment' && r.petId) {
      g.storage.addFragments(r.petId, r.count)
    }
  })

  // 记录通关
  g.storage.recordStageClear(g._stageId, rating, isFirstClear)

  // 结算数据（供 stageResult 场景展示）
  g._stageResult = {
    stageId: g._stageId,
    rating,
    isFirstClear,
    rewards,
    cultExp: finalExp,
    cultLevelUps: levelUps,
    cultPrevLevel: prevLevel,
    petExp,
    petLevelUps,
    totalTurns: g._stageTotalTurns,
  }

  g.scene = 'stageResult'
}

function calculateRating(totalTurns, ratingConfig) {
  if (totalTurns <= ratingConfig.s) return 'S'
  if (totalTurns <= ratingConfig.a) return 'A'
  return 'B'
}

function pickFragmentTarget(g, stage) {
  // 从灵宠池中按关卡章节属性倾向随机选择一个宠物给碎片
  const pool = g.storage.petPool
  if (pool.length === 0) return null
  // 优先未满星的宠物
  const notMaxed = pool.filter(p => p.star < 3)
  const candidates = notMaxed.length > 0 ? notMaxed : pool
  return candidates[Math.floor(Math.random() * candidates.length)].id
}
```

### 4.6 关卡选择 UI 设计

```
┌────────────────────────────────────┐
│  固定关卡       ⚡72/100           │ 顶栏
│  ─────────────────────────────     │
│  第一章：灵山试炼                   │ 章节标题
│                                    │
│  ┌────────────────────────────┐   │ 关卡卡片
│  │ 初试·土灵            ★★★  │   │ 名称 + 最佳评价
│  │ 土属性 | 1 波          3/3 │   │ 属性/波次/今日剩余
│  │ [已通关·S评价]             │   │ 通关状态
│  └────────────────────────────┘   │
│  ┌────────────────────────────┐   │
│  │ 烈焰·双波            ★★☆  │   │
│  │ 火属性 | 2 波          2/3 │   │
│  │ [已通关·A评价]             │   │
│  └────────────────────────────┘   │
│  ┌────────────────────────────┐   │
│  │ 寒冰试炼              🔒   │   │ 未解锁
│  │ 需通关：烈焰·双波          │   │ 前置条件
│  └────────────────────────────┘   │
│                                    │
│  ──── 第二章：幽冥秘境 ────       │ 下一章节
│  🔒 灵宠池需达10只解锁            │ 章节解锁条件
│                                    │
│  [< 返回首页]                      │ 返回按钮
└────────────────────────────────────┘
```

### 4.7 编队 UI 设计

```
┌────────────────────────────────────┐
│  编队出战         初试·土灵        │ 标题 + 关卡名
│  ─────────────────────────────     │
│  出战阵容（3/5）   ⚡消耗10体力    │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐  │ 5 个槽位
│  │🐉 │ │🐢 │ │🦊 │ │ + │ │ + │  │ 已选 + 空位
│  │★2 │ │★1 │ │★3 │ │   │ │   │  │
│  │Lv18│ │Lv5│ │L32│ │   │ │   │  │
│  └───┘ └───┘ └───┘ └───┘ └───┘  │
│  ─────────────────────────────     │
│  灵宠池                            │
│  [全部] [金] [木] [水] [火] [土]   │ 属性筛选
│  ┌─────┐ ┌─────┐ ┌─────┐         │
│  │ 🐲  │ │ 🦅  │ │ 🐍  │         │ 可选列表
│  │Lv.12│ │Lv.8 │ │Lv.20│         │ 已选的灰色
│  │ATK32│ │ATK22│ │ATK48│         │ 点击选入/取消
│  └─────┘ └─────┘ └─────┘         │
│                                    │
│  关卡提示：土属性敌人，推荐金属性   │ 关卡提示
│       [ 出战！]  [ 返回 ]          │ 确认/返回
└────────────────────────────────────┘
```

### 4.8 关卡结算 UI 设计

```
┌────────────────────────────────────┐
│                                    │
│        ✦ 关卡通关！ ✦              │ 大标题
│                                    │
│   初试·土灵      评价：★★★ S      │ 关卡名 + 评价
│   总回合数：3                      │
│   ─────────────────────────        │
│   ▸ 掉落奖励                       │
│     土灵碎片   ×4                  │ 碎片
│     修炼经验   +150                │ 修炼经验
│   ─────────────────────────        │
│   ▸ 首通奖励                       │ 仅首通显示
│     金锋灵猫碎片 ×5               │
│     修炼经验   +200                │
│   ─────────────────────────        │
│   ▸ 灵宠成长                       │
│     金锋灵猫  +40 EXP  Lv.18→19  │ 参战宠物经验
│     玄甲金狮  +40 EXP             │
│     青灵木鹿  +40 EXP  升级！      │
│   ─────────────────────────        │
│   ▸ 修炼                           │
│     Lv.14  ████████░░ 234/416     │ 修炼经验条
│                                    │
│    [ 再次挑战 ]  [ 返回关卡列表 ]   │ 底部按钮
└────────────────────────────────────┘
```

### 4.9 Storage 扩展

```javascript
// storage.js 新增（Phase 3）

// 通关记录
// stageClearRecord: { 'stage_1_1': { cleared: true, bestRating: 'S', clearCount: 5 } }

recordStageClear(stageId, rating, isFirst) {
  const record = this._data.stageClearRecord || (this._data.stageClearRecord = {})
  if (!record[stageId]) record[stageId] = { cleared: false, bestRating: null, clearCount: 0 }
  const r = record[stageId]
  r.cleared = true
  r.clearCount++
  if (!r.bestRating || RATING_ORDER[rating] > RATING_ORDER[r.bestRating]) {
    r.bestRating = rating
  }
  this._save()
}

isStageCleared(stageId) {
  return !!(this._data.stageClearRecord && this._data.stageClearRecord[stageId]?.cleared)
}

getStageBestRating(stageId) {
  return this._data.stageClearRecord?.[stageId]?.bestRating || null
}

const RATING_ORDER = { B: 1, A: 2, S: 3 }

// 每日挑战次数
// dailyChallenges: { date: '2026-03-08', counts: { 'stage_1_1': 2 } }

canChallengeStage(stageId, dailyLimit) {
  this._refreshDailyChallenges()
  const counts = this._data.dailyChallenges.counts
  return (counts[stageId] || 0) < dailyLimit
}

recordStageChallenge(stageId) {
  this._refreshDailyChallenges()
  const counts = this._data.dailyChallenges.counts
  counts[stageId] = (counts[stageId] || 0) + 1
  this._save()
}

_refreshDailyChallenges() {
  const today = new Date().toISOString().slice(0, 10)
  if (!this._data.dailyChallenges || this._data.dailyChallenges.date !== today) {
    this._data.dailyChallenges = { date: today, counts: {} }
  }
}

// 体力
consumeStamina(amount) {
  this._recoverStamina()
  this._data.stamina.current = Math.max(0, this._data.stamina.current - amount)
  this._save()
}

get currentStamina() {
  this._recoverStamina()
  return this._data.stamina.current
}

_recoverStamina() {
  const s = this._data.stamina
  const now = Date.now()
  const INTERVAL = 30 * 60 * 1000
  const elapsed = now - (s.lastRecoverTime || now)
  const recovered = Math.floor(elapsed / INTERVAL)
  if (recovered > 0) {
    s.current = Math.min(s.max, s.current + recovered)
    s.lastRecoverTime = (s.lastRecoverTime || now) + recovered * INTERVAL
  }
}
```

### 4.10 存档版本迁移

```javascript
// storage.js 迁移（已实现 v3→v4，Phase 3 再加 v4→v5）
3: (d) => {
  // Phase 2：灵宠池 + 共享经验池 + 体力
  if (!d.petPool) d.petPool = []
  if (d.petExpPool == null) d.petExpPool = 0
  if (!d.stamina) d.stamina = { current: 100, max: 100, lastRecoverTime: Date.now() }
},
4: (d) => {
  // Phase 3：关卡通关记录 + 每日挑战（待实现）
  if (!d.stageClearRecord) d.stageClearRecord = {}
  if (!d.dailyChallenges) d.dailyChallenges = { date: '', counts: {} }
},
```

### 4.11 场景注册（main.js）

```javascript
// render 分发新增
case 'petPool':      petPoolView.rPetPool(this); break
case 'stageSelect':  stageSelectView.rStageSelect(this); break
case 'stageTeam':    stageTeamView.rStageTeam(this); break
case 'stageResult':  stageResultView.rStageResult(this); break

// touch 分发新增
case 'petPool':      petPoolView.tPetPool(this, x, y, type); break
case 'stageSelect':  stageSelectView.tStageSelect(this, x, y, type); break
case 'stageTeam':    stageTeamView.tStageTeam(this, x, y, type); break
case 'stageResult':  stageResultView.tStageResult(this, x, y, type); break
```

### 4.12 titleView.js 改动

```javascript
// 导航解锁逻辑
const BAR_ITEMS = [
  { key: 'cultivation', label: '修炼', icon: '☯', img: '...' },
  // locked 改为动态判断
  { key: 'pets', label: '灵宠', icon: '🐾',
    get locked() { return g.storage.petPoolCount === 0 },
    img: '...' },
  { key: 'dex', label: '图鉴', icon: '📖', img: '...' },
  { key: 'battle', label: '战斗', icon: '⚔', center: true },
  { key: 'rank', label: '排行', icon: '🏆', img: '...' },
  { key: 'stats', label: '统计', icon: '📊', img: '...' },
  { key: 'more', label: '更多', icon: '⚙', img: '...' },
]

// stage 模式点击"开始挑战"
if (g.titleMode === 'stage') {
  if (g.storage.petPoolCount < 5) {
    // 提示：灵宠池需达5只
    g._toastMsg = '灵宠池需达5只才能挑战固定关卡'
    return
  }
  if (g.storage.currentStamina < 10) {
    g._toastMsg = '体力不足'
    return
  }
  g.scene = 'stageSelect'  // 进入关卡选择页
}

// 首页顶栏体力显示
// drawTopBar 中增加：⚡ 72/100 + 恢复倒计时
```

### 4.13 Phase 3 代码改动清单

| 优先级 | 改动 | 涉及文件 | 新增/修改 | 预估工时 |
|--------|------|----------|-----------|----------|
| P0 | 关卡配置数据（首批 12~18 关） | `js/data/stages.js` | **新增** | 1.5天 |
| P0 | 关卡流程管理 | `js/engine/stageManager.js` | **新增** | 1.5天 |
| P0 | 战斗引擎适配（波次/stage 分支） | `js/engine/battle.js` | 修改 | 1天 |
| P0 | 存储扩展（通关记录/每日次数/体力） | `js/data/storage.js` | 修改 | 0.5天 |
| P0 | 存档版本迁移 v4→v5 | `js/data/storage.js` | 修改 | 0.2天 |
| P1 | 关卡选择 UI + 触摸 | `js/views/stageSelectView.js` | **新增** | 2天 |
| P1 | 编队 UI + 触摸 | `js/views/stageTeamView.js` | **新增** | 2天 |
| P1 | 关卡结算 UI + 触摸 | `js/views/stageResultView.js` | **新增** | 1.5天 |
| P1 | 场景注册 | `js/main.js` | 修改 | 0.3天 |
| P1 | 首页 stage 模式接入 | `js/views/titleView.js` | 修改 | 0.5天 |
| P1 | 触摸分发新场景 | `js/input/touchHandlers.js` | 修改 | 0.5天 |
| P2 | 波间过渡动画（"第 X 波"） | `js/views/battleView.js` | 修改 | 0.5天 |
| P2 | 新场景状态字段 | `js/gameState.js` | 修改 | 0.2天 |
| P3 | 关卡音效 | `js/runtime/music.js` | 修改 | 0.3天 |

**Phase 3 总预估：12~13 工作日（约 2.5~3 周）**

---

## 五、工作量总评

| Phase | 核心工作 | 新增文件 | 修改文件 | 预估工期 |
|-------|----------|----------|----------|----------|
| Phase 2 | 灵宠池数据+独立培养+体力+UI | 2 | 7 | **1.5~2 周** |
| Phase 3 | 关卡配置+3场景+战斗适配+编队 | 4 | 6 | **2.5~3 周** |
| **合计** | | **6 新文件** | **~10 修改** | **4~5 周** |

### 新增文件清单

| 文件 | 行数预估 | 职责 |
|------|---------|------|
| `js/data/petPoolConfig.js` | ~80 | 灵宠池升星/经验/攻击力公式 |
| `js/views/petPoolView.js` | ~600 | 灵宠池 UI + 详情面板 + 触摸 |
| `js/data/stages.js` | ~300 | 关卡配置数据 |
| `js/engine/stageManager.js` | ~250 | 关卡流程控制 + 结算 |
| `js/views/stageSelectView.js` | ~400 | 关卡选择 UI + 触摸 |
| `js/views/stageTeamView.js` | ~450 | 编队 UI + 触摸 |
| `js/views/stageResultView.js` | ~350 | 关卡结算 UI + 触摸 |

### 主要修改文件

| 文件 | 改动量预估 | 主要改动 |
|------|-----------|----------|
| `js/data/storage.js` | +150 行 | petPool/stamina/stageClear 接口 + 迁移 |
| `js/engine/battle.js` | +60 行 | 波次处理 + defeat stage 分支 |
| `js/engine/skills.js` | +30 行 | 入池/碎片逻辑 |
| `js/engine/runManager.js` | +20 行 | 高级灵宠"带它出战" |
| `js/views/titleView.js` | +40 行 | 体力显示 + stage 入口 + 导航解锁 |
| `js/main.js` | +15 行 | 场景注册 |
| `js/gameState.js` | +15 行 | 新状态字段 |
| `js/input/touchHandlers.js` | +30 行 | 新场景触摸分发 + 体力检查 |

---

## 六、推荐开发顺序

```
第 1 周：Phase 2 数据层 + 体力系统
  ├── petPoolConfig.js 新增
  ├── storage.js 灵宠池接口 + 体力接口 + 迁移 v3→v4
  ├── skills.js 入池/碎片逻辑
  ├── runManager.js 高级灵宠"带它出战"
  ├── gameState.js 新字段
  └── 验证：肉鸽中★3 宠物正确入池/碎片

第 2 周：Phase 2 UI + Phase 3 数据层
  ├── petPoolView.js 灵宠池界面 + 详情面板 + 触摸
  ├── titleView.js 导航解锁 + 体力显示
  ├── dialogs.js 入池/碎片弹窗
  ├── main.js 场景注册（petPool）
  ├── stages.js 关卡配置（首批 12~18 关）
  └── stageManager.js 关卡流程骨架

第 3 周：Phase 3 战斗适配 + 新场景
  ├── battle.js 波次/stage 分支
  ├── stageSelectView.js 关卡选择界面
  ├── stageTeamView.js 编队界面
  ├── storage.js 通关记录 + 每日次数 + 迁移 v4→v5
  └── main.js + touchHandlers.js 新场景注册

第 4 周：Phase 3 结算 + 联调 + 打磨
  ├── stageResultView.js 结算界面
  ├── titleView.js stage 模式完整接入
  ├── battleView.js 波间过渡
  ├── 全流程联调（肉鸽→入池→培养→编队→关卡→结算→碎片→升星）
  └── 数值调优 + UI 打磨 + 体力节奏验证
```

---

## 七、风险与待决项

| # | 风险/待决 | 应对 |
|---|----------|------|
| 1 | battle.js 体积增长 | 波次逻辑尽量收敛在 stageManager.js 中，battle.js 仅增加分支跳转 |
| 2 | 灵宠经验获取节奏 | 需实际测试：一次固定关卡给多少灵宠经验，Lv.10 和 Lv.25 门槛是否合理 |
| 3 | 碎片获取节奏 | 肉鸽再次★3 给 5 碎片，固定关卡给 1~4 碎片，★2 需 5 碎片、★3 需 15 碎片，需验证玩家升星周期 |
| 4 | 体力数值平衡 | 100 体力 / 肉鸽 20 / 关卡 10 / 恢复 48/天，需验证日活频率是否合适 |
| 5 | 关卡数值设计 | 首批 12~18 关的怪物 HP/ATK/技能需要配合灵宠池平均战力调优 |
| 6 | 高级灵宠（Phase 4） | 本方案中预留了 `source: 'stage'` 和 ★4 相关字段，但不实现，Phase 4 再补充 |
| 7 | 固定关卡失败的灵宠经验 | 建议失败也给 50% 灵宠经验，避免完全白玩 |
| 8 | 编队记忆 | 是否记住上次编队？建议记忆，每次进编队页默认上次阵容 |

---

## 八、测试要点

### Phase 2 测试

| 测试项 | 验证内容 |
|--------|---------|
| 入池准确性 | 首次★3 入池为★1 Lv.1；重复★3 给 5 碎片 |
| 灵宠池 UI | 卡片展示正确：等级/星级/攻击力/碎片进度 |
| 属性筛选 | 全部/金/木/水/火/土 筛选正确 |
| 升星门槛 | 等级不足时升星按钮提示等级要求；碎片不足提示碎片要求 |
| 升星效果 | 升星后攻击力正确计算；★2 解锁技能 |
| 灵宠等级 | 经验累加正确；升级后 level+1；满级后不再升级 |
| 导航解锁 | 首只入池 → "灵宠"标签解锁 |
| 体力系统 | 恢复计算正确；离线恢复正确；消耗正确 |
| 体力不足 | 按钮灰色 + 提示文字 |
| 存档兼容 | v3→v4 迁移后旧存档不丢数据 |
| "带它出战"增强 | 高级灵宠加入 sessionPetPool 且以★1 替换队伍 |

### Phase 3 测试

| 测试项 | 验证内容 |
|--------|---------|
| 关卡解锁 | 灵宠池 ≥ 5 解锁；前置关卡解锁链正确 |
| 编队 | 3~5 只编队；筛选；已选灰色标记 |
| 战斗初始化 | 敌人来自配置；宠物用灵宠池攻击力；修炼加成生效 |
| 多波次 | 波间棋盘保留；回合数跨波累计；"第 X 波"过渡 |
| 评价 | S/A/B 阈值正确 |
| 碎片掉落 | 评价倍率正确；首通额外奖励正确 |
| 灵宠经验 | 参战宠物均分；评价倍率加成 |
| 修炼经验 | 固定关卡中经验累积和结算正确 |
| 每日次数 | 上限 3 次（首通不计）；跨日重置 |
| 失败处理 | 失败不扣碎片；给 50% 灵宠经验和 60% 修炼经验 |
| 返回流程 | 结算后返回关卡选择；关卡选择返回首页 |
| 肉鸽不受影响 | 所有固定关卡改动不影响肉鸽模式 |
