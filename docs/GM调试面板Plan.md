# GM 调试面板 — 实施计划

> 状态：**待确认**
> 创建时间：2026-04-12

---

## 一、需求背景

当前无法快速测试签到、翻倍等每日功能，需等待真实日期切换。需要一个 GM 调试面板，让白名单内的 GM 玩家能直接操作存档数据来模拟各种场景。

---

## 二、整体方案

### 入口位置

在 **签到弹窗右上角**（关闭按钮左边），GM 玩家多一个红色小 `GM` 按钮。点击后展开 GM 调试浮层，覆盖在签到弹窗之上。

### 安全保障

- 入口仅在 `isCurrentUserGM() === true` 时渲染
- 所有 GM 方法内部做双重校验 `if (!isCurrentUserGM()) return`
- 非 GM 用户完全看不到、碰不到

---

## 三、GM 面板功能清单

以签到测试为核心，兼顾常用调试：

| # | 功能 | 按钮文案 | 实现原理 |
|---|------|---------|---------|
| 1 | **重置今日签到** | `重置签到` | 清空 `loginSign.lastDate` → `canSignToday` 变 `true` |
| 2 | **重置翻倍状态** | `重置翻倍` | 清空 `doubleClaimedDate`，重建 `pendingDoubleRewards`（从当天签到日配置重新取） |
| 3 | **设置签到天数 ±** | `−1` / `+1` | 直接修改 `totalSignDays`，联动更新 `day`、`isNewbie` |
| 4 | **跳到第7天** | `→7天` | `totalSignDays` 设为 6（下次签到即第7天），重置 `lastDate` |
| 5 | **跳到第30天** | `→30天` | `totalSignDays` 设为 29，重置 `lastDate` |
| 6 | **切换首轮/轮回** | `切轮` | 首轮→设 `totalSignDays = 30`；轮回→设 `totalSignDays = 0` |
| 7 | **重置广告次数** | `重置广告` | 清空 `adWatchLog.signDouble` 当日记录 |
| 8 | **加灵石** | `灵石+1000` | `addSoulStone(1000)` |
| 9 | **体力回满** | `回满体力` | `stamina.current = maxStamina` |

---

## 四、文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `js/views/gmPanelView.js` | GM 面板的渲染函数 `rGMPanel` + 事件函数 `tGMPanel` |

### 修改文件

| 文件 | 变更 |
|------|------|
| `js/data/storage.js` | 新增 GM 专用方法（集中管理，不散落外部）：`gmResetSignToday()`、`gmResetDouble()`、`gmSetSignDay(n)`、`gmResetSignAdCount()`、`gmRefillStamina()` |
| `js/gameState.js` | 新增状态字段 `g._showGMPanel = false` |
| `js/views/dailyRewardView.js` | ① 签到弹窗中 GM 用户渲染 "GM" 入口按钮；② `_signRects` 增加 `gmBtnRect`；③ `tDailySign` 中处理 GM 按钮点击事件 |
| `js/main.js` | 在渲染循环和触摸分发中接入 `rGMPanel` / `tGMPanel` |

---

## 五、storage.js — GM 方法设计

```js
// ===== GM 调试方法（仅白名单用户可调用）=====

/** GM：重置今日签到状态（让 canSignToday 变为 true） */
gmResetSignToday() {
  if (!isCurrentUserGM()) return
  this._ensureLoginSign()
  this._d.loginSign.lastDate = ''
  this._d.loginSign.pendingDoubleRewards = null
  this._d.loginSign.doubleClaimedDate = ''
  this._save()
}

/** GM：重置翻倍状态（保留签到，重新变为可翻倍） */
gmResetDouble() {
  if (!isCurrentUserGM()) return
  this._ensureLoginSign()
  const sign = this._d.loginSign
  sign.doubleClaimedDate = ''
  // 重建 pendingDoubleRewards
  const { getScaledLoginRewardByDay, getDoubleableLoginRewards, cloneLoginRewardRewards } = require('./giftConfig')
  const cycleDay = sign.day || 1
  const scaled = getScaledLoginRewardByDay(cycleDay, sign.isNewbie)
  if (scaled && scaled.rewards) {
    sign.pendingDoubleRewards = cloneLoginRewardRewards(getDoubleableLoginRewards(scaled.rewards))
  }
  this._save()
}

/** GM：直接设置累计签到天数 */
gmSetSignDay(n) {
  if (!isCurrentUserGM()) return
  const { LOGIN_CYCLE_DAYS } = require('./giftConfig')
  this._ensureLoginSign()
  const sign = this._d.loginSign
  sign.totalSignDays = Math.max(0, n)
  sign.day = sign.totalSignDays > 0 ? ((sign.totalSignDays - 1) % LOGIN_CYCLE_DAYS) + 1 : 0
  sign.isNewbie = sign.totalSignDays < LOGIN_CYCLE_DAYS
  sign.lastDate = ''  // 重置签到让下次可签
  sign.pendingDoubleRewards = null
  sign.doubleClaimedDate = ''
  this._save()
}

/** GM：重置签到翻倍广告的每日观看计数 */
gmResetSignAdCount() {
  if (!isCurrentUserGM()) return
  if (this._d.adWatchLog && this._d.adWatchLog.signDouble) {
    delete this._d.adWatchLog.signDouble
  }
  this._save()
}

/** GM：体力回满 */
gmRefillStamina() {
  if (!isCurrentUserGM()) return
  this._recoverStamina()
  this._d.stamina.current = this.maxStamina
  this._save()
}
```

---

## 六、gmPanelView.js — 面板 UI 设计

### 布局

```
半透明黑遮罩
┌─────────────────────────────┐
│  🔴 GM 调试面板         [✕]  │  ← 红色标题栏
├─────────────────────────────┤
│  📅 签到天数: 2/30            │
│  [−1]  [+1]  [→7天]  [→30天]  │
│                              │
│  [重置签到]  [重置翻倍]        │
│  [切轮]     [重置广告]         │
│                              │
│  💰 灵石 476   [+1000]        │
│  ⚡ 体力 150   [回满]          │
└─────────────────────────────┘
```

- 半透明黑底 + 圆角白卡
- 红色标题栏标明 "GM"，与游戏风格区分
- 按钮统一用简单矩形色块 + 文字，不追求美术效果

### 交互

- 点击任何功能按钮 → 调用 `storage.gmXxx()` → 自动 `_save()` → `g._dirty = true` 刷新画面
- 点击关闭或遮罩 → `g._showGMPanel = false`
- GM 面板打开期间签到弹窗保持在底下（不关闭）

---

## 七、数据流

```
签到弹窗 GM按钮(dailyRewardView)
  → g._showGMPanel = true
  → gmPanelView.rGMPanel() 渲染浮层
  → 用户点功能按钮
  → storage.gmXxx() 修改存档 + _save()
  → g._dirty = true
  → 关闭 GM 面板后回到签到弹窗，状态已更新
```

---

## 八、main.js 接入点

```js
// 渲染（在签到弹窗渲染之后）
rGMPanel(g)

// 触摸（在签到弹窗触摸之前，优先级更高）
if (tGMPanel(g, x, y, type)) return
```

---

## 九、实施步骤

1. **storage.js** — 添加 5 个 GM 方法
2. **gameState.js** — 添加 `_showGMPanel` 字段
3. **gmPanelView.js** — 新建文件，实现渲染 + 事件
4. **dailyRewardView.js** — 签到弹窗增加 GM 入口按钮
5. **main.js** — 接入 GM 面板的渲染和触摸

---

## 十、测试用例

| 场景 | 操作 | 预期结果 |
|------|------|---------|
| 签到→翻倍完整流程 | 重置签到 → 签到 → 按钮变"看视频再领一份" → 翻倍 → 按钮变"奖励已领满" | 一气呵成 |
| 重复测试签到 | 重置签到 → 再签 | 可无限次测试 |
| 测试翻倍 | 重置翻倍 + 重置广告 → 翻倍 | 可重复测试翻倍 |
| 测试第7天高亮奖励 | →7天 → 签到 | 签到第7天，领取特殊奖励 |
| 测试第30天达成 | →30天 → 签到 | 签到第30天，领取达成奖励 |
| 首轮/轮回切换 | 切轮 → 重置签到 | 奖励配置切换 |

---

**请确认是否 OK，我立即开始编码。**
