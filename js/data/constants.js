/**
 * 全局数值常量集中管理 — 灵宠消消塔
 * 各域名前缀: STAMINA_*, CLOUD_*, RANK_*, TOWER_*, CULT_*, POOL_*, DEX_*, IDLE_*
 */

// ===== 体力系统 (STAMINA) — 数值定义已迁移至 balance/economy.js =====

const {
  STAMINA_RECOVER_INTERVAL_MS, STAMINA_INITIAL, STAMINA_SIDEBAR_REWARD,
  TOWER_BASE_EVENT_WEIGHTS, TOWER_SHOP_DISPLAY_COUNT, TOWER_SHOP_FREE_COUNT, TOWER_SHOP_HP_COST_PCT,
} = require('./balance/economy')

// ===== 云同步 (CLOUD) =====

const CLOUD_SYNC_BASE_DELAY_MS = 2000
const CLOUD_SYNC_MAX_BACKOFF_MS = 120000
const CLOUD_SYNC_MAX_FAIL = 5
const CLOUD_SYNC_LOG_THRESHOLD = 3
const CLOUD_SYNC_RETRY_INTERVAL_MS = 120000

// ===== 排行榜 (RANK) =====

const RANK_CACHE_TTL_MS = 30000

// ===== 塔层 / 肉鸽 (TOWER) =====

const TOWER_MAX_FLOOR = 30
const TOWER_COUNTER_MUL = 1.6
const TOWER_COUNTERED_MUL = 0.6
const TOWER_RECENT_LIMIT = 3

// ===== 修炼系统 (CULT) — 数值定义已迁移至 balance/cultivation.js =====

const {
  CULT_MAX_LEVEL, CULT_EXP_BASE, CULT_EXP_LINEAR, CULT_EXP_POW_EXP, CULT_EXP_POW_COEFF,
  CULT_KILL_BOSS_BASE, CULT_KILL_BOSS_FLOOR_COEFF,
  CULT_KILL_ELITE_BASE, CULT_KILL_ELITE_FLOOR_COEFF,
  CULT_KILL_NORMAL_BASE, CULT_KILL_NORMAL_FLOOR_COEFF,
} = require('./balance/cultivation')

// ===== 灵宠池 (POOL) — 数值定义已迁移至 balance/pool.js =====

const {
  POOL_MAX_LV, POOL_ADV_MAX_LV, POOL_RARITY_EXP_MUL,
  POOL_EXP_BASE, POOL_EXP_LINEAR, POOL_EXP_POW_EXP, POOL_EXP_POW_COEFF,
  POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_STAR_ATK_MUL,
  POOL_STAR_AWAKEN_COST, POOL_STAR_SS_COST, POOL_STAR_LV_CAP,
  POOL_FRAGMENT_TO_EXP, POOL_ENTRY_LEVEL, POOL_ENTRY_FRAGMENTS,
  POOL_R_LV_BONUS_RATE,
} = require('./balance/pool')

// ===== 连击里程碑 (COMBO) =====
// 阈值: 显示特殊文字的连击数
// 文案: 对应里程碑显示的文字
// 后续调整阶梯值只需改这里
const COMBO_MILESTONES = [
  { threshold: 3,  text: '破!',    color: '#4d88ff',  tier: 1 },  // 初级
  { threshold: 6,  text: '无双!',  color: '#ff8c00',  tier: 2 },  // 中级
  { threshold: 9,  text: '神威!',  color: '#ff4d6a',  tier: 3 },  // 高级
  { threshold: 12, text: '天选!',  color: '#9d4dff',  tier: 4 },  // 顶级
  { threshold: 15, text: '传说!',  color: '#ffd700',  tier: 5 },  // 传说
  { threshold: 18, text: '神话!',  color: '#ff2a6a',  tier: 6 },  // 神话
]
const COMBO_MILESTONE_INTERVAL = 3  // 里程碑间隔（用于震动判断等）

// 获取当前连击数对应的里程碑档位 (0=未命中任何里程碑)
function getComboTier(combo) {
  if (!combo || combo < COMBO_MILESTONES[0].threshold) return 0
  for (let i = COMBO_MILESTONES.length - 1; i >= 0; i--) {
    if (combo >= COMBO_MILESTONES[i].threshold) return COMBO_MILESTONES[i].tier
  }
  return 0
}

// 判断是否是里程碑阈值（精确匹配）
function isComboMilestone(combo) {
  return COMBO_MILESTONES.some(m => m.threshold === combo)
}

// ===== 秘境选关卡片布局 (STAGE_CARD) =====
// 所有值都是乘以 S（缩放因子）前的"设计稿 pt"，运行时会自动 * S
const STAGE_CARD = {
  marginV: 12,       // 卡片上下边距
  marginH: 46,       // 卡片左右边距（留出箭头空间）
  headerH: 52,       // 标题横幅高度
  footerH: 22,       // 圆底至卡片底（含当前星级一行 + 边距）
  gap: 4,            // 头/图、图/底 间隙
  innerPad: 14,      // 立绘区左右内边距
  cardRadius: 16,    // 卡片圆角
  imgRadius: 12,     // 立绘圆角
  imgInset: 10,      // 立绘在容器内再缩进的边距（0 = 贴满）
  maxImgPt: 140,   // 立绘圆直径上限（pt）
  /** 与 titleView drawStartBtn 星级说明条一致，用于秘境块垂直锚定 */
  condPanelPt: 38,
  condAboveStartBtnPt: 10,
  /** 怪物卡片底边与星级说明条顶边的间距 */
  blockAboveCondGapPt: 14,
  bgAlpha: 0.92,     // 卡片底板透明度
  borderAlpha: 0.42, // 卡片外框透明度 (0~1)
}

/** 首页标题 Logo（title_logo.png）布局，与 drawTopBar / getLayout.topBarH 同步 */
const TITLE_LOGO = {
  heightPt: 70,
  gapBelowStatusPt: 15,
  gapBelowLogoPt: 15,
}

/** 首页大厅：通天塔插画缩放、每日签到 / 右上角模式切换尺寸（与 titleView 同步） */
const TITLE_HOME = {
  /** 通天塔/切换图主插画高度占「顶栏底～petRowY」场景区的比例（略放大以贴近旧版视觉占比） */
  towerImgHeightSceneFrac: 0.92,
  /** 主插画最大宽度占屏宽比例 */
  towerImgMaxScreenWidthFrac: 0.94,
  /**
   * 通天塔主插画上移（×S），从原先「底边 = petRowY + 14S」再向上平移，避免压住开始按钮上方的「今日次数」文案
   */
  towerImgLiftPt: 22,
  /**
   * 通天塔首页：「今日次数」+ 开始/继续按钮 + 下方进度说明整体下移（×S），与塔图、底栏之间留出空隙
   */
  towerStartClusterDownPt: 22,
  /** 每日签到：总宽度、红包图标边长、标签字号（×S） */
  dailySignBtnWidthPt: 62,
  dailySignIconPt: 52,
  dailySignLabelPt: 11,
  /** 签到按钮顶边 = safeTop + 此项×S */
  dailySignTopBelowSafePt: 38,
  /** 游戏圈入口与签到区块底边的间距（×S），图标宽与签到图标一致 */
  gameClubGapBelowDailyPt: 10,
  /** 微信 createGameClubButton type=image（1:1，内容等比装进方图） */
  gameClubBtnImage: 'assets/ui/game_club_entry.png',
  /**
   * MP 后台 → 游戏能力地图 → 游戏圈 → 基础设置 / 帖子「游戏内跳转」中的 openlink。
   * 填写后首页游戏圈改为 Canvas 点击 + wx.createPageManager 打开，无原生按钮按下灰底；
   * 留空则仍用 createGameClubButton（会有点按高亮）。
   */
  gameClubOpenlink: '-SSEykJvFV3pORt5kTNpS2uRCE2Pk0t0-jfXJ_Rmeu4-PYB3x56w4rucmIjwdUnKt5TrJKXqLLC5SqbHDdrdsUMFZBJsDhi3iqVWOuJKB2Pr0tYGYTFYQndIlJ7WO-ZDTZbYpPAWCu9mOpD2i4vkuJnxTvbK6kZyOoJN-c1IVjQIMOTCZFywauSGPU0Qdrf_ymIrVjM4tEIKu1_hOH8e1T25ujcr2CeXUeR-SOEvqHOaiq6Z9lH8hUqqg5JQzEpuX3cGf0h39IfN-wDKxAf0M4mUC5XMktYzfjEyX4uyhz6vhgdxls7pS5Um-1AQJzHS_9h4qs2szApba_eovWdhXA',
  /** 模式切换（通天塔/秘境）：图案区高度、标签字号、相对 icon 加宽（×S） */
  modeSwitchIconPt: 30,
  modeSwitchLabelPt: 9,
  modeSwitchBtnExtraWPt: 6,
  /** 模式切换条左边距（×S），贴左与顶栏内容错开 */
  modeSwitchLeftMarginPt: 8,
  /** 秘境门两侧关卡切换钮：宽、高、圆角、箭头尖高度（×S），纯路径绘制避免字体假两层 */
  stageNavBtnWidthPt: 26,
  stageNavBtnHeightPt: 42,
  stageNavBtnRadiusPt: 10,
  stageNavChevronPt: 9,
}

/** 秘境编队：灵宠池≥此数量时，至少选几只才能开战（与关卡 teamSize.min 取较大值；池子不足则降为可上阵上限） */
const STAGE_FORMATION_MIN_PETS = 3

/** 局内「攻略」按钮顶边距 = safeTop + 此项×S，避开微信小游戏/小程序右上角胶囊菜单 */
const BATTLE_HELP_BTN_BELOW_SAFE_TOP_PT = 50

/** 新手教学赠送宠物 ID：金/木/水/土 4 只；秘境 1-1 首通另奖 f1，一同凑齐五行。与通天塔教学共用 */
const NEWBIE_PET_IDS = ['m1', 'w1', 's1', 'e1']

/** 法宝未解锁时展示（仅灵兽秘境投放，不进通天塔永久入库） */
const WEAPON_ACQUIRE_HINT_UNOWNED = '通过灵兽秘境关卡获取'

// ===== 灵兽图鉴页 (DEX) =====
// 须与 screens.rDex 中 drawPageTitle、bottomBar.drawPageTitle(bgH=48×S) 一致，避免统计行与 name_bg 重叠
const DEX_LAYOUT = {
  titleCenterBelowSafePt: 40,
  nameBgHalfHPt: 24,
  modeSwitchHPt: 22,
  modeSwitchGapPt: 4,
  gapTitleToDividerPt: 4,
  gapDividerToSummaryPt: 12,
  gapSummaryToTabPt: 12,
  tabHPt: 26,
  contentGapBelowTabPt: 6,
}

/** @param {number} safeTop @param {number} S */
function getDexContentTop(safeTop, S) {
  const titleBottom = safeTop + (DEX_LAYOUT.titleCenterBelowSafePt + DEX_LAYOUT.nameBgHalfHPt) * S
  const modeBottom = titleBottom + DEX_LAYOUT.modeSwitchGapPt * S + DEX_LAYOUT.modeSwitchHPt * S
  const sdivY = modeBottom + DEX_LAYOUT.gapTitleToDividerPt * S
  const summaryY = sdivY + DEX_LAYOUT.gapDividerToSummaryPt * S
  const tabY = summaryY + DEX_LAYOUT.gapSummaryToTabPt * S
  return tabY + DEX_LAYOUT.tabHPt * S + DEX_LAYOUT.contentGapBelowTabPt * S
}

module.exports = {
  // STAMINA
  STAMINA_RECOVER_INTERVAL_MS,
  STAMINA_INITIAL,
  STAMINA_SIDEBAR_REWARD,
  // CLOUD
  CLOUD_SYNC_BASE_DELAY_MS,
  CLOUD_SYNC_MAX_BACKOFF_MS,
  CLOUD_SYNC_MAX_FAIL,
  CLOUD_SYNC_LOG_THRESHOLD,
  CLOUD_SYNC_RETRY_INTERVAL_MS,
  // RANK
  RANK_CACHE_TTL_MS,
  // TOWER
  TOWER_MAX_FLOOR,
  TOWER_COUNTER_MUL,
  TOWER_COUNTERED_MUL,
  TOWER_RECENT_LIMIT,
  TOWER_BASE_EVENT_WEIGHTS,
  TOWER_SHOP_DISPLAY_COUNT,
  TOWER_SHOP_FREE_COUNT,
  TOWER_SHOP_HP_COST_PCT,
  // CULT
  CULT_MAX_LEVEL,
  CULT_EXP_BASE,
  CULT_EXP_LINEAR,
  CULT_EXP_POW_EXP,
  CULT_EXP_POW_COEFF,
  CULT_KILL_BOSS_BASE,
  CULT_KILL_BOSS_FLOOR_COEFF,
  CULT_KILL_ELITE_BASE,
  CULT_KILL_ELITE_FLOOR_COEFF,
  CULT_KILL_NORMAL_BASE,
  CULT_KILL_NORMAL_FLOOR_COEFF,
  // POOL
  POOL_MAX_LV,
  POOL_ADV_MAX_LV,
  POOL_RARITY_EXP_MUL,
  POOL_TIER_EXP_MUL: POOL_RARITY_EXP_MUL,
  POOL_EXP_BASE,
  POOL_EXP_LINEAR,
  POOL_EXP_POW_EXP,
  POOL_EXP_POW_COEFF,
  POOL_STAR_FRAG_COST,
  POOL_STAR_LV_REQ,
  POOL_STAR_ATK_MUL,
  POOL_STAR_AWAKEN_COST,
  POOL_STAR_SS_COST,
  POOL_STAR_LV_CAP,
  POOL_FRAGMENT_TO_EXP,
  POOL_ENTRY_LEVEL,
  POOL_ENTRY_FRAGMENTS,
  POOL_R_LV_BONUS_RATE,
  POOL_T3_LV_BONUS_RATE: POOL_R_LV_BONUS_RATE,
  // COMBO
  COMBO_MILESTONES,
  COMBO_MILESTONE_INTERVAL,
  getComboTier,
  isComboMilestone,
  // 秘境选关卡片布局
  STAGE_CARD,
  TITLE_LOGO,
  TITLE_HOME,
  STAGE_FORMATION_MIN_PETS,
  BATTLE_HELP_BTN_BELOW_SAFE_TOP_PT,
  NEWBIE_PET_IDS,
  WEAPON_ACQUIRE_HINT_UNOWNED,
  DEX_LAYOUT,
  getDexContentTop,
}
