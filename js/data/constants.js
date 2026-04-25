/**
 * 全局数值常量集中管理 — 灵宠消消塔
 * 各域名前缀: STAMINA_*, CLOUD_*, RANK_*, TOWER_*, CULT_*, POOL_*, DEX_*, IDLE_*
 */

// ===== 体力系统 (STAMINA) — 数值定义已迁移至 balance/economy.js =====

const {
  STAMINA_RECOVER_INTERVAL_MS, STAMINA_INITIAL, STAMINA_SIDEBAR_REWARD, STAMINA_COST,
  STAMINA_SOFT_CAP_BUFFER, STAMINA_OVERFLOW_SOUL_RATIO,
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

// ===== 塔层 / 肉鸽 (TOWER) — 数值已迁移至 balance/combat.js =====
const {
  TOWER_MAX_FLOOR, TOWER_COUNTER_MUL, TOWER_COUNTERED_MUL, TOWER_RECENT_LIMIT,
} = require('./balance/combat')

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
  POOL_RESET_REFUND_BASE, POOL_RESET_REFUND_AD,
  POOL_RESET_GATE_COST, POOL_RESET_COOLDOWN_MS, POOL_RESET_UNLOCK_CHAPTER,
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
  // gapBelowStatusPt：logo 顶部距离状态栏底部（safeTop + 96）的距离。
  // 头像外框比头像大 22%，头像下方的昵称要避开外框底边 + 留呼吸距离，
  // 因此 logo 不能太贴状态栏；以前的 15 会和昵称底部几乎贴到一起。
  gapBelowStatusPt: 22,
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
  towerStartClusterDownPt: 14,
  /** 通天塔首页：塔图与开始按钮区整体上移（×S），为底部「本周活动」卡片留位 */
  towerUiShiftUpPt: 22,
  /** 进度文案基线（middle）到活动卡片顶边的间距（×S） */
  towerEventBannerBelowProgressGapPt: 14,
  /** 活动卡片比开始按钮（0.6 屏宽）多加的宽度（×S），略宽一点即可 */
  towerEventBannerExtraWPt: 12,
  /** 右侧签到 / 游戏圈 / 任务三枚图标边长（×S），共用此项 */
  dailySignBtnWidthPt: 62,
  dailySignIconPt: 46,
  dailySignLabelPt: 11,
  /** 签到按钮顶边 = safeTop + 此项×S */
  dailySignTopBelowSafePt: 58,
  /** 游戏圈入口与签到区块底边的间距（×S），图标宽与签到图标一致 */
  gameClubGapBelowDailyPt: 10,
  /** 每日任务入口：紧贴游戏圈图标区块底边的间距（×S） */
  dailyTaskGapBelowGameClubPt: 10,
  /** 每日任务入口图标（与 daily_sign_icon 同列；缺图时用 Canvas 占位） */
  dailyTaskBtnImage: 'assets/ui/daily_task_icon.png',
  /** 微信 createGameClubButton type=image（1:1，内容等比装进方图） */
  gameClubBtnImage: 'assets/ui/game_club_entry_icon_v1.png',
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

/**
 * 签到弹窗 — 布局与 game2D_huahua/src/gameobjects/ui/CheckInPanel.ts 设计坐标一致
 * （DESIGN_WIDTH=750；本工程画布宽 W，缩放 u=W/750，勿再用 main的 S=W/375 去乘14、20 等「花华设计像素」）
 * 图片在 assets/ui/checkin_huahua/
 */
const CHECKIN_HUAHUA = {
  maskAlpha: 0.6,
  designWidth: 750,
  /** CheckInPanel CARD_AREA_W（与花华一致；随 u=W/750 铺满比例，不再用像素上限 620 锁死） */
  cardAreaWDesign: 620,
  /** CheckInPanel CARD_GAP */
  cardGapDesign: 14,
  /** 常规卡片高度 */
  cardHDesign: 172,
  /** 强调卡/终章卡高度 */
  highlightCardHDesign: 132,
  /** 终章达成卡高度 */
  finaleBonusHDesign: 118,
  /** 底部操作区预留高度 */
  actionAreaHDesign: 160,
  /** 操作区与卡片区垂直间距 */
  actionGapDesign: 20,
  /** CheckInPanel._refresh ESTIMATED_H（标题区+里程碑+分页卡片+连续登录+双按钮留白） */
  estimatedContentHDesign: 1200,
  milestoneMaxDays: 30,
  milestoneThresholds: [7, 15, 22, 30],
  titleBanner: 'assets/ui/checkin_huahua/checkin_title_banner.png',
  /** 横幅上「每日奖励」相对图高的纵位置0~1（标题略上提，尽量落在卷轴正文视觉正中） */
  titleTextYFrac: 0.59,
  /** 仅标题横幅相对面板顶额外下移，设计像素×(W/750)，不带动整块面板 */
  titleBannerOffsetYPt: 14,
  /** 标题横幅绘制后推进到下一个区块的有效高度比例，低于1可吃掉图底部视觉空白 */
  titleBannerAdvanceFrac: 0.78,
  milestonePanel: 'assets/ui/checkin_huahua/checkin_milestone_panel.png',
  cardFuture: 'assets/ui/checkin_huahua/checkin_card_future.png',
  cardToday: 'assets/ui/checkin_huahua/checkin_card_today.png',
  cardSigned: 'assets/ui/checkin_huahua/checkin_card_signed.png',
  cardHighlight: 'assets/ui/checkin_huahua/checkin_card_day7.png',
  /** 兼容旧签到页字段名，待30天签到视图重构完成后移除 */
  cardDay7: 'assets/ui/checkin_huahua/checkin_card_day7.png',
  btnOrange: 'assets/ui/checkin_huahua/deco_card_btn_2.png',
  milestoneGift: (i) => `assets/ui/checkin_huahua/checkin_milestone_gift_${i}.png`,
  /** 第7天固定 SSR 展示图标（默认走炎狱火麟头像） */
  specialPetIcon: 'assets/pets/pet_f4.png',
  /** 兼容旧签到页字段名，待30天签到视图重构完成后移除 */
  day7PetChoiceIcon: 'assets/pets/pet_f4.png',
  /** 兼容旧签到页字段名，待30天签到视图重构完成后移除 */
  day7HDesign: 132,
}

/** 秘境编队：灵宠池≥此数量时，至少选几只才能开战（与关卡 teamSize.min 取较大值；池子不足则降为可上阵上限） */
const STAGE_FORMATION_MIN_PETS = 3

/** 预设编队：默认赠送 2 套，看广告解锁到 5 套上限（灵宠 + 法宝整组切换；秘境/塔共用） */
const TEAM_PRESET_DEFAULT_UNLOCKED = 2
const TEAM_PRESET_MAX = 5
/** 预设编队名称长度（中文字符数上限；多余部分切断，避免 UI 挤占） */
const TEAM_PRESET_NAME_MAX_LEN = 6

/** 局内「攻略」按钮顶边距 = safeTop + 此项×S，避开微信小游戏/小程序右上角胶囊菜单 */
const BATTLE_HELP_BTN_BELOW_SAFE_TOP_PT = 50

/** 每日任务弹窗：面板顶边不低于 safeTop + 此项×S，整体下移避免关闭钮与微信胶囊重叠 */
const DAILY_TASK_PANEL_MIN_TOP_BELOW_SAFE_PT = 52

/** 新手教学赠送宠物 ID：五行各一只。与通天塔教学共用 */
const NEWBIE_PET_IDS = ['m1', 'w1', 's1', 'e1', 'f1']
/** 其中以 ★2 入池的宠物（有技能）；其余以 ★1 入池（无技能，需升星解锁） */
const NEWBIE_2STAR_IDS = ['f1', 'w1']

/** 新手第 1 章全 8 关免体力（通关/失败均不扣），保证首日充足游玩时间 */
const NEWBIE_FREE_STAMINA_STAGES = [
  'stage_1_1', 'stage_1_2', 'stage_1_3', 'stage_1_4',
  'stage_1_5', 'stage_1_6', 'stage_1_7', 'stage_1_8',
]

/** 首通里程碑体力赠送（关卡ID → 赠送体力），让新手在关键节点获得额外推关动力
 *  注：第 1 章关卡全免体力，里程碑体力只用于"让第二天有 1~2h 爽玩时间"，
 *  不需要给出夸张的数字，否则会叠加成 300+ 的滞留库存。 */
const FIRST_CLEAR_STAMINA_BONUS = {
  'stage_1_3': 30,
  'stage_1_8': 30,
}

/** 首通里程碑灵石赠送（关卡ID → 赠送灵石），保证新手有足够灵石升级宠物
 *  v2 "Day1 经济温和收紧"：四档 200/300/300/400 → 150/200/200/250（-25~37%）
 *    · 玩家反馈 Day1 推到 4-4 时灵石已 9000+，首通加成叠加里程碑过于丰厚
 *    · 此处四档是最早的"教程期"钩子，减少后仍保留对新手升级的推拉感
 */
const FIRST_CLEAR_SOULSTONE_BONUS = {
  'stage_1_1': 150,
  'stage_1_3': 200,
  'stage_1_5': 200,
  'stage_1_8': 250,
}

/** 新手冒险者礼包内容（教学结束后一次性领取）
 *  注：第 1 章关卡全免体力 + 首通里程碑已提供充足体力，礼包不再重复发体力，
 *  等价替换为灵石（1 体力 ≈ 5 灵石的软顶折算比），聚焦"升级推关"的成长资源。
 *  v2 "Day1 经济温和收紧"：850 灵石 / 10 万能 → 500 灵石 / 5 万能，
 *    · Day1 全局 9000+ 灵石溢出 30 倍，礼包属于"最柔和削减"的切入点，
 *    · 5 万能碎片仍可让新手在第 1~2 次 SSR 宠物召唤中感受到抗卡保护。
 */
// v2.2 "曲线平滑方案 A"：灵石 500 → 300（-40%），与里程碑前 3 章再降一档（-750）共同削 Day1 爆点
//   · 5 万能碎片保持：新手抗卡保护不动，避免影响"首次 SSR 召唤体验"
const NEWBIE_GIFT_REWARDS = {
  soulStone: 300,
  universalFragment: 5,
}

/** 新手免费续命次数（前 N 次战斗失败免费复活，降低挫败流失） */
const NEWBIE_FREE_REVIVE_COUNT = 5

/** 新手关卡珠色限制：值为允许的攻击属性种数（心珠始终保留），降低认知负担 */
const NEWBIE_BEAD_ATTR_LIMIT = {
  'stage_1_1': 3,
  'stage_1_2': 4,
}

/**
 * 第 1 章关卡技巧聚焦配置：每关教一个技巧 + 可选挑战目标
 * focus: 技巧类型标识    openTip: 开场提示文案
 * battleTip: 首次触发时的战中飘字
 * challenge: { type, threshold, rewardSoulStone, desc } 挑战目标
 */
const STAGE_MECHANIC_FOCUS = {
  stage_1_2: {
    focus: 'heartHeal',
    openTip: '心珠可以回血，受伤时试试消除它！',
    battleTip: '心珠回血！',
    challenge: { type: 'heartHeal', threshold: 1, rewardSoulStone: 10, desc: '消除心珠回血 1 次' },
  },
  stage_1_3: {
    focus: 'counter',
    openTip: '克制属性伤害翻倍！注意敌人的弱点',
    battleTip: '克制命中！伤害 x1.6',
    challenge: { type: 'counter', threshold: 1, rewardSoulStone: 10, desc: '触发克制攻击 1 次' },
  },
  stage_1_4: {
    focus: 'combo',
    openTip: '一次拖珠消除多组 = Combo！伤害翻倍！',
    battleTip: 'Combo！伤害倍增！',
    challenge: { type: 'combo', threshold: 2, rewardSoulStone: 15, desc: '达成 2 连击以上' },
  },
  stage_1_5: {
    focus: 'petSkill',
    openTip: '宠物技能已就绪！上滑宠物头像释放！',
    battleTip: '技能释放成功！',
    challenge: { type: 'petSkill', threshold: 1, rewardSoulStone: 15, desc: '使用宠物技能 1 次' },
  },
  stage_1_6: {
    focus: 'elim4',
    openTip: '4 颗成排消除 = 1.5 倍伤害！试试排列更多',
    battleTip: '4 连消！x1.5 伤害',
    challenge: { type: 'elim4', threshold: 1, rewardSoulStone: 15, desc: '达成 4 连消除 1 次' },
  },
  stage_1_7: {
    focus: 'elim5',
    openTip: '5 颗成排 = 2 倍伤害 + 全队属性爆发！',
    battleTip: '5 连消！x2 伤害 + 全队爆发！',
    challenge: { type: 'elim5', threshold: 1, rewardSoulStone: 20, desc: '达成 5 连消除 1 次' },
  },
  stage_1_8: {
    focus: 'boss',
    openTip: 'Boss 战！用上你学到的一切！',
    challenge: { type: 'sRating', threshold: 1, rewardSoulStone: 30, desc: 'S 评级通关' },
  },
}

/** 法宝未解锁时展示（仅灵兽秘境投放，不进通天塔永久入库） */
const WEAPON_ACQUIRE_HINT_UNOWNED = '通过灵兽秘境关卡获取'

/** Canvas 图片 LRU 缓存上限：按真机长局优先，避免大图解码缓存长期堆积 */
const RENDER_IMG_CACHE_MAX = 220

// ===== 内存调试（上架保持 MEMORY_DEBUG=false 即无任何监听与定时器）=====
/** false：零开销，可进生产包；true：注册 onMemoryWarning + 可选周期快照（见下） */
const MEMORY_DEBUG = false
/** true 且 MEMORY_DEBUG 时：仅 GM 启用，普通玩家不注册监听 */
const MEMORY_DEBUG_ONLY_GM = true
/** 周期快照间隔（ms）；0 表示不打周期日志，仅系统内存告警时打一条 */
const MEMORY_DEBUG_INTERVAL_MS = 30000

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
  STAMINA_COST,
  STAMINA_SOFT_CAP_BUFFER,
  STAMINA_OVERFLOW_SOUL_RATIO,
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
  POOL_RESET_REFUND_BASE,
  POOL_RESET_REFUND_AD,
  POOL_RESET_GATE_COST,
  POOL_RESET_COOLDOWN_MS,
  POOL_RESET_UNLOCK_CHAPTER,
  // COMBO
  COMBO_MILESTONES,
  COMBO_MILESTONE_INTERVAL,
  getComboTier,
  isComboMilestone,
  // 秘境选关卡片布局
  STAGE_CARD,
  TITLE_LOGO,
  TITLE_HOME,
  CHECKIN_HUAHUA,
  STAGE_FORMATION_MIN_PETS,
  TEAM_PRESET_DEFAULT_UNLOCKED,
  TEAM_PRESET_MAX,
  TEAM_PRESET_NAME_MAX_LEN,
  BATTLE_HELP_BTN_BELOW_SAFE_TOP_PT,
  DAILY_TASK_PANEL_MIN_TOP_BELOW_SAFE_PT,
  NEWBIE_PET_IDS,
  NEWBIE_2STAR_IDS,
  NEWBIE_FREE_STAMINA_STAGES,
  NEWBIE_FREE_REVIVE_COUNT,
  FIRST_CLEAR_STAMINA_BONUS,
  FIRST_CLEAR_SOULSTONE_BONUS,
  NEWBIE_GIFT_REWARDS,
  NEWBIE_BEAD_ATTR_LIMIT,
  STAGE_MECHANIC_FOCUS,
  WEAPON_ACQUIRE_HINT_UNOWNED,
  RENDER_IMG_CACHE_MAX,
  MEMORY_DEBUG,
  MEMORY_DEBUG_ONLY_GM,
  MEMORY_DEBUG_INTERVAL_MS,
  DEX_LAYOUT,
  getDexContentTop,
}
