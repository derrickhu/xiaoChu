/**
 * 全局数值常量集中管理 — 灵宠消消塔
 * 各域名前缀: STAMINA_*, CLOUD_*, RANK_*, TOWER_*, CULT_*, POOL_*, DEX_*, IDLE_*
 */

// ===== 体力系统 (STAMINA) =====

const STAMINA_RECOVER_INTERVAL_MS = 3 * 60 * 1000
const STAMINA_INITIAL = 100
const STAMINA_SIDEBAR_REWARD = 30

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
const TOWER_COUNTER_MUL = 2.5
const TOWER_COUNTERED_MUL = 0.5
const TOWER_RECENT_LIMIT = 3
const TOWER_BASE_EVENT_WEIGHTS = {
  battle:    70,
  elite:      8,
  adventure:  5,
  shop:       4,
  rest:       3,
}
const TOWER_SHOP_DISPLAY_COUNT = 4
const TOWER_SHOP_FREE_COUNT = 1
const TOWER_SHOP_HP_COST_PCT = 15

// ===== 修炼系统 (CULT) =====

const CULT_MAX_LEVEL = 60
const CULT_EXP_BASE = 400
const CULT_EXP_LINEAR = 100
const CULT_EXP_POW_EXP = 1.6
const CULT_EXP_POW_COEFF = 6
const CULT_KILL_BOSS_BASE = 30
const CULT_KILL_BOSS_FLOOR_COEFF = 4
const CULT_KILL_ELITE_BASE = 15
const CULT_KILL_ELITE_FLOOR_COEFF = 3
const CULT_KILL_NORMAL_BASE = 5
const CULT_KILL_NORMAL_FLOOR_COEFF = 2

// ===== 灵宠池 (POOL) =====

const POOL_MAX_LV = 40
const POOL_ADV_MAX_LV = 60
const POOL_RARITY_EXP_MUL = { R: 1.0, SR: 1.3, SSR: 1.6 }
const POOL_EXP_BASE = 20
const POOL_EXP_LINEAR = 8
const POOL_EXP_POW_EXP = 1.4
const POOL_EXP_POW_COEFF = 0.5
const POOL_STAR_FRAG_COST = { 2: 5, 3: 15, 4: 30, 5: 50 }
const POOL_STAR_LV_REQ = { 2: 10, 3: 20, 4: 35, 5: 45 }
const POOL_STAR_ATK_MUL = { 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 2.8 }
const POOL_STAR_AWAKEN_COST = { 4: 3, 5: 8 }
const POOL_STAR_SS_COST = { 2: 200, 3: 800, 4: 2500, 5: 6000 }
const POOL_STAR_LV_CAP = { 1: 40, 2: 40, 3: 40, 4: 50, 5: 60 }
const POOL_FRAGMENT_TO_EXP = 40
const POOL_ENTRY_LEVEL = 5
const POOL_ENTRY_FRAGMENTS = 2
const POOL_R_LV_BONUS_RATE = 0.8

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
  /** 每日签到：总宽度、红包图标边长、标签字号（×S） */
  dailySignBtnWidthPt: 62,
  dailySignIconPt: 52,
  dailySignLabelPt: 11,
  /** 签到按钮顶边 = safeTop + 此项×S */
  dailySignTopBelowSafePt: 38,
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

/** 新手教学赠送宠物 ID：金/木/水 3 只，秘境 1-1 和通天塔教学共用 */
const NEWBIE_PET_IDS = ['m1', 'w1', 's1']

// ===== 灵兽图鉴页 (DEX) =====
// 须与 screens.rDex 中 drawPageTitle、bottomBar.drawPageTitle(bgH=48×S) 一致，避免统计行与 name_bg 重叠
const DEX_LAYOUT = {
  titleCenterBelowSafePt: 40,
  nameBgHalfHPt: 24,
  gapTitleToDividerPt: 6,
  gapDividerToSummaryPt: 12,
  gapSummaryToTabPt: 12,
  tabHPt: 26,
  contentGapBelowTabPt: 6,
}

/** @param {number} safeTop @param {number} S */
function getDexContentTop(safeTop, S) {
  const titleBottom = safeTop + (DEX_LAYOUT.titleCenterBelowSafePt + DEX_LAYOUT.nameBgHalfHPt) * S
  const sdivY = titleBottom + DEX_LAYOUT.gapTitleToDividerPt * S
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
  DEX_LAYOUT,
  getDexContentTop,
}
