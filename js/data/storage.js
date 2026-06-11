const P = require('../platform')
const api = require('../api')
const serverConfig = require('./serverConfig')
const cloudSync = require('./cloudSync')
const gpAnalytics = require('./gpAnalytics')
const RankingService = require('./rankingService')
const {
  STAMINA_RECOVER_INTERVAL_MS,
  STAMINA_INITIAL,
  STAMINA_SIDEBAR_REWARD,
  // STAMINA_SOFT_CAP_BUFFER / STAMINA_OVERFLOW_SOUL_RATIO：已停用（玩家领取不再折灵石）
  // 常量本身仍在 constants.js 中保留以兼容老存档迁移和可能的回滚
} = require('./constants')
const { isCurrentUserGM } = require('./gmConfig')
const { DATA_VERSION } = require('./giftConfig')
/**
 * 存储管理 — 灵宠消消塔
 * 当前架构：秘境推关 + 通天塔挑战 + 灵宠池 + 修炼 + 法宝 + 签到 / 每日任务
 * 本地缓存 + xiaochu-api 统一云存档（微信/抖音均走 HTTP API）
 * 持久化内容：关卡通关记录、灵宠池、资源（灵石/觉醒石/碎片/万能碎片/体力）、修炼数据、统计、设置等
 */

// ===== 匿名昵称（排行榜兜底） =====
// 未授权玩家也要上榜，由 openid 稳定哈希生成 4 位后缀，同一玩家昵称始终一致
function _hashOpenidToSuffix(openid) {
  if (!openid) return '0000'
  let h = 5381
  for (let i = 0; i < openid.length; i++) {
    h = ((h << 5) + h + openid.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36).toUpperCase().slice(-4).padStart(4, '0')
}

function genAnonNick(openid) {
  return '修士·' + _hashOpenidToSuffix(openid)
}

// 判断昵称是否为匿名（以"修士·"开头且后缀长度为 4）——用于 UI 决定是否展示"换头像昵称"引导
function isAnonNick(nickName) {
  return typeof nickName === 'string' && /^修士·[0-9A-Z]{4}$/.test(nickName)
}

/** GM 时间偏移（毫秒），GM 每"加一天"就 +86400000 */
let _gmTimeOffsetMs = 0

/** 获取当前时间（含 GM 偏移） */
function gmNow() { return Date.now() + _gmTimeOffsetMs }

/** 本地日历 YYYY-MM-DD（签到/每日任务等，避免 UTC 与玩家所在地跨日不一致） */
function localDateKey(d) {
  if (!d) d = new Date(gmNow())
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 当前存档版本号，每次结构变更时递增
const CURRENT_VERSION = 31
// 滚服上线时间：非一服若出现早于该时间的首登埋点 + 大量历史进度，视为一服旧档误写入新服。
const ROLLING_SERVER_START_AT = 1780230000000

function createAnalyticsSummary() {
  return {
    firstSeenDate: '',
    firstSeenAt: 0,
    firstSession: {
      events: {},
      stageStart: {},
      stageClear: {},
      stageFail: {},
      stageExit: {},
      adEntryShow: {},
      adClick: {},
      adShowSuccess: {},
      adComplete: {},
      adSkip: {},
      adError: {},
    },
  }
}

function _analyticsBucketForEvent(eventId) {
  const map = {
    stage_start: 'stageStart',
    stage_clear: 'stageClear',
    stage_fail: 'stageFail',
    stage_exit: 'stageExit',
    ad_entry_show: 'adEntryShow',
    ad_click: 'adClick',
    ad_show_success: 'adShowSuccess',
    ad_complete: 'adComplete',
    ad_skip: 'adSkip',
    ad_error: 'adError',
  }
  return map[eventId] || 'events'
}

function _analyticsKeyForEvent(eventId, params) {
  if (eventId === 'stage_start' || eventId === 'stage_clear' || eventId === 'stage_fail' || eventId === 'stage_exit') {
    return (params && params.stageId) || 'unknown_stage'
  }
  if (eventId === 'ad_entry_show' || eventId === 'ad_click' || eventId === 'ad_show_success'
      || eventId === 'ad_complete' || eventId === 'ad_skip' || eventId === 'ad_error') {
    return (params && params.slotId) || 'unknown_slot'
  }
  return eventId || 'unknown_event'
}

// 持久化数据（跨局保留）
function defaultPersist() {
  return {
    _version: CURRENT_VERSION,
    bestFloor: 0,         // 历史最高层数
    totalRuns: 0,         // 总挑战次数
    stats: {
      totalBattles: 0,
      totalCombos: 0,
      maxCombo: 0,
      bestFloorPets: [],  // 最高层时的宠物阵容
      bestFloorWeapon: null, // 最高层时的法宝
    },
    settings: {
      bgmOn: true,
      sfxOn: true,
      bgmVolume: 50,  // 背景音乐音量 0~100，默认50
    },
    petDex: [],  // 图鉴：历史收集到3星的宠物ID列表（兼容旧版）
    petDexSeen: [],  // 图鉴：已查看过详情的宠物ID列表
    petPoolSeen: [], // 灵宠池：已在池页面查看过详情的宠物ID列表（用于"NEW"角标）
    petPoolFavoriteIds: [], // 灵宠池：玩家收藏的宠物 ID（顺序决定同组内排序）
    dexMilestonesClaimed: [],  // 图鉴里程碑：已领取的里程碑ID列表
    dexMilestonesAdRewardClaimed: [],  // 图鉴里程碑：已领过广告额外一份货币奖励的里程碑ID
    dexRewardCompV: 1, // 图鉴隐藏加成改资源后的老玩家补发版本
    cultivation: {
      level: 1,              // 人物等级（从1级起始）
      exp: 0,                // 当前等级已积累经验
      totalExpEarned: 0,     // 历史累计获得经验（统计用）
      skillPoints: 0,        // 可用修炼点
      levels: { body:0, spirit:0, wisdom:0, defense:0, sense:0 },
      realmBreakSeen: 0,     // 已看过突破动画的最高境界索引
      // 修炼上限版本号：1=旧（Lv.60），2=v2（Lv.80），3=v3（Lv.120，百分比+境界祝福）
      capMigrationV: 3,
    },
    selectedAvatar: 'boy1',   // 当前选择的头像ID
    unlockedAvatars: ['boy1', 'girl1'], // 已解锁的形象列表
    // Phase 2：灵宠池
    petPool: [],             // 灵宠池宠物列表
    soulStone: 0,            // 灵石（共享宠物升级货币）
    awakenStone: 0,          // 觉醒石数量
    // Phase 2：体力系统（仅固定关卡消耗，肉鸽不消耗）
    stamina: {
      current: STAMINA_INITIAL,
      max: STAMINA_INITIAL,
      lastRecoverTime: 0,   // 首次进入时初始化为 Date.now()
    },
    // Phase 3：固定关卡
    stageClearRecord: {},    // { 'stage_1_1': { cleared, bestRating, clearCount, starsClaimed:[bool,bool,bool] } }
    // 章节星级里程碑领取标记：{ [chapterId]: { 8: bool, 16: bool, 24: bool } }
    //   阈值含义见 chapterMilestoneConfig.MILESTONE_TIERS（8/16/24 星）
    //   老字段形态可能是 [bool,bool,bool] 数组（v11 预留但未接线），v23→v24 迁移时转换
    chapterStarMilestones: {},
    chapterBadges: {},             // 章节徽章：{ [chapterId]: bool } 章节全 3★ 解锁
    weaponWildcardTickets: 0,      // SSR 法宝定向保底券数量（24★ 里程碑发放）
    dailyChallenges: { date: '', counts: {} },  // 每日挑战次数
    savedStageTeam: [],      // 持久化保存的"当前编队"（灵宠ID列表；战斗引擎从这里读）
    // ===== 预设编队（秘境/塔共用；默认 2 套，看广告解锁到 TEAM_PRESET_MAX） =====
    // 结构: [{ id, name, petIds, weaponId, lastUsedAt }]
    //   · petIds:  数组顺序即出战顺序，允许空（空预设 = "未保存的槽位"，UI 会提示去保存）
    //   · weaponId: null 代表不装备法宝；应用预设时会调 equipWeapon
    //   · lastUsedAt: 最近一次 applyTeamPreset 的时间戳，用于排序/统计
    teamPresets: [],
    teamPresetSlotUnlocked: 0,  // 已解锁槽位数，2 ≤ x ≤ TEAM_PRESET_MAX
    teamPresetActiveId: '',     // 最近一次"应用"的预设 id，用于 UI 高亮当前 tab
    sidebarRewardDate: '',   // 侧边栏复访奖励最后领取日期
    // Phase 4：灵宠派遣（挂机）
    idleDispatch: {
      slots: [],              // [{ petId, startTime }]  最多3个
      lastCollect: 0,         // 上次收取时间戳
    },
    // Phase 5：碎片银行
    fragmentBank: {},          // { petId: count } 未入池宠物的碎片
    towerDaily: { date: '', runs: 0, adRuns: 0 },  // 通天塔每日挑战次数
    guideFlags: {},            // { guideId: true } 新手指引已完成标记
    weaponCollection: [],      // 已获得法宝ID: ['w1','w5',...]
    equippedWeaponId: null,    // 当前装备的法宝ID
    // 签到系统
    loginSign: {
      day: 0,                  // 当前签到轮次进度 (1-30)
      lastDate: '',            // 上次签到日期 'YYYY-MM-DD'
      isNewbie: true,          // 是否仍处于首轮 30 天高爽奖励
      totalSignDays: 0,        // 历史累计签到天数
      pendingDoubleRewards: null, // 当日可翻倍资源快照
      doubleClaimedDate: '',   // 当日是否已完成翻倍领取
      cycleDays: 30,           // 当前签到轮次天数，用于兼容旧存档
      consecutiveDay: 0,       // 7天连续登录当前进度 (1-7)，0=未开始
      consecutiveClaimedDate: '', // 连续登录今日已领取日期
    },
    // 每日任务
    dailyTaskProgress: {
      date: '',
      tasks: {},               // { taskId: currentCount }
      claimed: {},             // { taskId: true }
      allClaimed: false,       // 是否已领「全部任务完成」基础奖励
      allBonusAdClaimed: false, // 是否已领当日「全部任务」广告翻倍奖励（与 adWatchLog.dailyTaskBonus 一致）
    },
    // 分享追踪
    shareTracking: {
      date: '',
      rewardCount: 0,          // 当日已领奖次数
      firstEverDone: false,    // 是否完成过首次分享
    },
    // 邀请追踪
    inviteCount: 0,
    invitedBy: null,
    // 广告观看记录（每日频控）
    adWatchLog: {},            // { [slotId]: { date: 'YYYY-MM-DD', count: N } }
    // 商业化首日漏斗汇总：只存聚合计数，详细事件走微信自定义分析
    analyticsSummary: createAnalyticsSummary(),
    // 通天塔活动赛季
    towerEvent: {
      seasonIndex: -1,         // 当前赛季序号（-1 表示从未初始化）
      claimed: [],             // 已领取的里程碑层数: [5, 10, ...]
    },
    // 天机试炼：双周赛季玩法进度
    trial: {
      seasonId: '',
      seasonScore: 0,
      bestScore: 0,
      bestFloor: 0,
      bestRun: null,
      claimed: [],
      daily: { date: '', runs: 0, firstHalfUsed: false, bestScore: 0, bestFloor: 0, questDone: {} },
    },
    // 万能碎片：可用于任意灵宠升星的通用材料
    universalFragment: 0,
    // 修炼境界：持久化"最近已通知到 UI 的大境界 id + 重阶"，用于判定晋升
    //   由 checkCultRealmUp() 比较 cultLv → getRealmByLv() 得到最新境界后更新
    //   只升不降：如果玩家通过 GM 或数据异常回退了 cultLv，不会触发"降级"
    lastCultRealmId: 'mortal',
    lastCultSubStage: 0,
    // 回归 / 删档（与 giftConfig.DATA_VERSION 对齐见 _load / resetAll 收尾赋值；此处 0 供「缺字段的旧存档」merge 后仍走 _checkDataVersion）
    lastActiveDate: '',
    dataVersion: 0,
  }
}

/** 全新本地档：已是当前大版本，避免首次落盘 dataVersion=0 导致二次启动误判删档弹窗 */
function _freshPersistDataVersion(d) {
  if (d && typeof d === 'object') d.dataVersion = DATA_VERSION
}

// 预设编队：保证 teamPresets 数组总是有 TEAM_PRESET_MAX 个槽位（缺几个补几个，多余保留），
//   以便迁移/全新玩家/云端同步回来的数据都能走同一份 UI。
//   - 迁移与 defaultPersist 首次落盘都会调用，防止"新老玩家字段不一致"两个 bug。
function ensureTeamPresets(d) {
  const { TEAM_PRESET_DEFAULT_UNLOCKED, TEAM_PRESET_MAX } = require('./constants')
  if (!Array.isArray(d.teamPresets)) d.teamPresets = []
  for (let i = d.teamPresets.length; i < TEAM_PRESET_MAX; i++) {
    d.teamPresets.push({
      id: `preset_${i + 1}`,
      name: `预设 ${i + 1}`,
      petIds: [],
      weaponId: null,
      lastUsedAt: 0,
    })
  }
  if (typeof d.teamPresetSlotUnlocked !== 'number' || d.teamPresetSlotUnlocked < TEAM_PRESET_DEFAULT_UNLOCKED) {
    d.teamPresetSlotUnlocked = TEAM_PRESET_DEFAULT_UNLOCKED
  }
  if (d.teamPresetSlotUnlocked > TEAM_PRESET_MAX) d.teamPresetSlotUnlocked = TEAM_PRESET_MAX
  if (!d.teamPresetActiveId) d.teamPresetActiveId = d.teamPresets[0].id
}

function grantDexRewardToData(d, reward) {
  if (!reward) return null
  const granted = {}
  if (reward.soulStone) {
    d.soulStone = (d.soulStone || 0) + reward.soulStone
    granted.soulStone = reward.soulStone
  }
  if (reward.awakenStone) {
    d.awakenStone = (d.awakenStone || 0) + reward.awakenStone
    granted.awakenStone = reward.awakenStone
  }
  if (reward.universalFragment) {
    d.universalFragment = (d.universalFragment || 0) + reward.universalFragment
    granted.universalFragment = reward.universalFragment
  }
  return Object.keys(granted).length > 0 ? granted : null
}

function grantDexRewardCompensation(d) {
  if (d.dexRewardCompV >= 1) return null
  const claimed = new Set(d.dexMilestonesClaimed || [])
  if (claimed.size === 0) {
    d.dexRewardCompV = 1
    return null
  }
  const { ALL_MILESTONES } = require('./dexConfig')
  const total = {}
  for (const m of ALL_MILESTONES) {
    if (!claimed.has(m.id)) continue
    // 只补发旧版隐藏加成里程碑；总量里程碑旧版本已经发过资源，不能重复补。
    if (!m.id.startsWith('elem_') && !m.id.startsWith('rarity_')) continue
    const granted = grantDexRewardToData(d, m.reward)
    if (!granted) continue
    for (const [k, v] of Object.entries(granted)) total[k] = (total[k] || 0) + v
  }
  d.dexRewardCompV = 1
  return Object.keys(total).length > 0 ? total : null
}

/**
 * 存档迁移注册表：key 为源版本号，value 为迁移函数
 * 每个迁移函数接收 data 并就地修改，将其升级到下一个版本
 * 示例：当 CURRENT_VERSION 升至 2 时，在此添加 migrations[1] = (d) => { ... }
 */
const migrations = {
  1: (d) => {
    if (!d.cultivation) {
      d.cultivation = {
        level: 1, exp: 0, totalExpEarned: 0, skillPoints: 0,
        levels: { body:0, spirit:0, wisdom:0, defense:0, sense:0 },
        realmBreakSeen: 0,
      }
    }
  },
  // v2→v3：修炼系统从"经验直接消耗"改为"等级+加点制"
  2: (d) => {
    const cult = d.cultivation || {}
    const { usedPoints: calcUsed } = require('./cultivationConfig')
    const used = calcUsed(cult.levels || {})
    cult.level = used
    cult.skillPoints = 0
    cult.exp = cult.exp || 0
    cult.totalExpEarned = cult.totalExpEarned || 0
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.realmBreakSeen === undefined) cult.realmBreakSeen = 0
    d.cultivation = cult
  },
  // v3→v4：Phase 2 灵宠池 + 共享经验池 + 体力系统
  3: (d) => {
    if (!d.petPool) d.petPool = []
    if (d.petExpPool == null) d.petExpPool = 0
    if (!d.stamina) d.stamina = { current: STAMINA_INITIAL, max: STAMINA_INITIAL, lastRecoverTime: Date.now() }
  },
  // v4→v5：Phase 3 固定关卡通关记录 + 每日挑战次数
  4: (d) => {
    if (!d.stageClearRecord) d.stageClearRecord = {}
    if (!d.dailyChallenges) d.dailyChallenges = { date: '', counts: {} }
  },
  // v5→v6：持久化编队
  5: (d) => {
    if (!d.savedStageTeam) d.savedStageTeam = []
  },
  // v6→v7：灵宠派遣（挂机）
  6: (d) => {
    if (!d.idleDispatch) d.idleDispatch = { slots: [], lastCollect: 0 }
  },
  // v7→v8：碎片银行
  7: (d) => {
    if (!d.fragmentBank) d.fragmentBank = {}
  },
  // v8→v9：新手指引标记
  8: (d) => {
    if (!d.guideFlags) d.guideFlags = {}
    if (d.tutorialDone) d.guideFlags.battle_tutorial = true
  },
  // v9→v10：灵石重命名 + 觉醒石
  9: (d) => {
    if (d.petExpPool !== undefined) {
      d.soulStone = d.petExpPool
      delete d.petExpPool
    }
    if (d.soulStone === undefined) d.soulStone = 0
    if (d.awakenStone === undefined) d.awakenStone = 0
  },
  // v10→v11：关卡星级奖励 + 章节里程碑
  10: (d) => {
    const RATING_TO_STARS = { S: 3, A: 2, B: 1 }
    const record = d.stageClearRecord || {}
    for (const sid of Object.keys(record)) {
      const r = record[sid]
      if (!r.starsClaimed) {
        // 根据历史最佳评级补发标记（已通关的按最佳评级设定已领取标记）
        const best = RATING_TO_STARS[r.bestRating] || 0
        r.starsClaimed = [best >= 1, best >= 2, best >= 3]
      }
    }
    if (!d.chapterStarMilestones) d.chapterStarMilestones = {}
  },
  // v11→v12：法宝背包 + 装备系统
  11: (d) => {
    if (!d.weaponCollection) d.weaponCollection = []
    if (d.equippedWeaponId === undefined) d.equippedWeaponId = null
  },
  // v12→v13：图鉴系统重设计 — 里程碑字段 + 旧petDex数据迁移入池
  12: (d) => {
    if (!d.dexMilestonesClaimed) d.dexMilestonesClaimed = []
    const pool = d.petPool || []
    const poolIds = new Set(pool.map(p => p.id))
    const oldDex = d.petDex || []
    for (const petId of oldDex) {
      if (!poolIds.has(petId)) {
        const { getPetById } = require('./pets')
        const pet = getPetById(petId)
        if (pet) {
          pool.push({
            id: petId, attr: pet.attr, star: 3,
            level: 10, fragments: 0,
            source: 'dex_migrate', obtainedAt: Date.now(),
          })
        }
      }
    }
    if (!d.petPool) d.petPool = pool
  },
  // v13→v14：广告观看频控字段
  13: (d) => {
    if (!d.adWatchLog) d.adWatchLog = {}
  },
  // v14→v15：通天塔每日挑战次数
  14: (d) => {
    if (!d.towerDaily) d.towerDaily = { date: '', runs: 0, adRuns: 0 }
  },
  // v15→v16：图鉴里程碑广告额外奖励（每档仅一次）
  15: (d) => {
    if (!d.dexMilestonesAdRewardClaimed) d.dexMilestonesAdRewardClaimed = []
  },
  // v16→v17：通天塔活动赛季
  16: (d) => {
    if (!d.towerEvent) d.towerEvent = { seasonIndex: -1, claimed: [] }
  },
  // v17→v18：万能碎片（可用于任意灵宠升星的通用材料）
  17: (d) => {
    if (d.universalFragment == null) d.universalFragment = 0
  },
  // v18→v19：新手冒险者礼包收敛为"只给真新手"——已通过 2-1 的存档静默标记已领，
  // 避免中后期老玩家突然弹出"新手礼包"造成违和
  18: (d) => {
    if (!d.guideFlags) d.guideFlags = {}
    const cleared = d.stageClearRecord && d.stageClearRecord['stage_2_1'] && d.stageClearRecord['stage_2_1'].cleared
    if (cleared) d.guideFlags.newbie_gift_claimed = true
  },
  // v19→v20：新手免费续命收敛为"只给真新手"——已通过 2-1 的存档将已用次数置满，
  // 避免老玩家在后续章节失败时突然弹"半血续战"造成关卡难度感知失衡
  19: (d) => {
    const cleared = d.stageClearRecord && d.stageClearRecord['stage_2_1'] && d.stageClearRecord['stage_2_1'].cleared
    if (cleared) d.newbieRevivesUsed = 9999
  },
  // v20→v21：修炼境界系统（A1 重构）
  //   旧字段 rankTierId 废弃；新增 lastCultRealmId / lastCultSubStage
  //   老玩家已经有 cultivation.level，为避免"首次启动就弹晋升仪式"，
  //   把 last* 对齐到当前境界（静默升段，不播动画）
  20: (d) => {
    const { getRealmByLv } = require('./cultivationConfig')
    const lv = (d.cultivation && d.cultivation.level) || 0
    const info = getRealmByLv(lv)
    if (d.lastCultRealmId == null) d.lastCultRealmId = info.realmId
    if (d.lastCultSubStage == null) d.lastCultSubStage = info.subStage
  },
  // v21→v22：灵宠池 NEW 角标
  //   新增 petPoolSeen 字段；把老玩家现有灵宠池里的宠物全部视为"已看过"，
  //   避免升级后老玩家一进池就一堆 NEW 困扰。
  21: (d) => {
    if (!Array.isArray(d.petPoolSeen)) d.petPoolSeen = []
    const pool = d.petPool || []
    for (const p of pool) {
      if (p && p.id && !d.petPoolSeen.includes(p.id)) d.petPoolSeen.push(p.id)
    }
  },
  // v22→v23：预设编队
  //   新增 teamPresets / teamPresetSlotUnlocked / teamPresetActiveId。
  //   老玩家无痛：把既有 savedStageTeam + equippedWeaponId 灌成「预设 1」，
  //   让他们第一次进编队页时就能"切一下预设 1 = 当前编队"。
  22: (d) => {
    ensureTeamPresets(d)
    const first = d.teamPresets[0]
    if (first && (!first.petIds || first.petIds.length === 0)) {
      if (Array.isArray(d.savedStageTeam) && d.savedStageTeam.length > 0) {
        first.petIds = d.savedStageTeam.slice()
      }
      if (d.equippedWeaponId) first.weaponId = d.equippedWeaponId
    }
  },
  // v23→v24：章节星级里程碑正式接线 + 徽章 + SSR 法宝保底券
  //   · chapterStarMilestones 老字段（v11 预留未用）若为旧数组形态 [bool,bool,bool]
  //     转换为 { 8, 16, 24 } 对象形态；老数据的阈值（5/10/15）不做回溯补发
  //     （plan 四节"老玩家不补发"明确决策）
  //   · 新增 chapterBadges / weaponWildcardTickets 字段
  23: (d) => {
    if (!d.chapterStarMilestones || typeof d.chapterStarMilestones !== 'object') {
      d.chapterStarMilestones = {}
    } else {
      for (const ch of Object.keys(d.chapterStarMilestones)) {
        const v = d.chapterStarMilestones[ch]
        if (Array.isArray(v)) {
          // 老字段（5/10/15★ 语义），按"不补发"原则直接丢弃，置空对象
          d.chapterStarMilestones[ch] = {}
        }
      }
    }
    if (!d.chapterBadges || typeof d.chapterBadges !== 'object') d.chapterBadges = {}
    if (typeof d.weaponWildcardTickets !== 'number') d.weaponWildcardTickets = 0
  },
  // v24→v25：SSR 法宝现货化
  //   · 旧设计：24★ 发"法宝保底券"，玩家去专门兑换页自己挑一件 SSR
  //   · 新设计：24★ 直接随机发放一件未拥有的 SSR；玩家反馈"券找不到兑换页 UX 差"
  //   · 迁移策略：把旧券逐张自动兑换成随机未拥有 SSR 法宝；全拥有走兜底 → 每张 60 万能碎片
  //   · 保证升级后玩家不会"券数 > 0 但没有入口"
  24: (d) => {
    const tickets = d.weaponWildcardTickets || 0
    if (tickets <= 0) {
      d.weaponWildcardTickets = 0
      return
    }
    const { WEAPON_RARITY } = require('./weapons')
    const ssrIds = WEAPON_RARITY.SSR || []
    if (!Array.isArray(d.weaponCollection)) d.weaponCollection = []
    let granted = 0
    let fallbackFrag = 0
    for (let i = 0; i < tickets; i++) {
      const available = ssrIds.filter(id => d.weaponCollection.indexOf(id) === -1)
      if (available.length === 0) {
        fallbackFrag += 60
        continue
      }
      const picked = available[Math.floor(Math.random() * available.length)]
      d.weaponCollection.push(picked)
      granted++
    }
    d.weaponWildcardTickets = 0
    if (fallbackFrag > 0) {
      d.universalFragment = (d.universalFragment || 0) + fallbackFrag
    }
    console.log(`[Storage] v24→v25 自动兑换 ${tickets} 张保底券：获得 ${granted} 件 SSR 法宝 + 兜底万能碎片 ${fallbackFrag}`)
  },
  // v25→v26：灵宠池收藏（详情页爱心、列表角标、默认置顶排序）
  25: (d) => {
    if (!Array.isArray(d.petPoolFavoriteIds)) d.petPoolFavoriteIds = []
    const ids = new Set((d.petPool || []).map(p => p && p.id).filter(Boolean))
    d.petPoolFavoriteIds = d.petPoolFavoriteIds.filter(id => ids.has(id))
  },
  // v26→v27：修炼系统百分比化 + Lv.80 扩容（_migrateCultV2）
  //   · MAX_LEVEL: 60 → 80，新增 20 修炼点（自动通过 cult.skillPoints 上限规则补齐）
  //   · 老 Lv.60 玩家把堆积的溢出经验清零，从 Lv.60 重新累积；非满级账号不动
  //   · CULT_CONFIG.maxLv 调整后若历史 levels[key] 超过新上限（不应发生，但兜底）→ 多余点退回
  //   · 打标 cultMigrationV2=true，配合 ceremony pending 标志做首次进入仪式
  26: (d) => {
    const cult = d.cultivation || {}
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.skillPoints == null) cult.skillPoints = 0
    if (cult.totalExpEarned == null) cult.totalExpEarned = 0
    // 1) 清掉满级溢出经验（v1 时代的"满级仍累积"留下的脏数据）
    //    判 level >= 60（旧上限）而非新上限 80，确保只清理"已经卡满的旧数据"
    if ((cult.level || 0) >= 60 && (cult.exp || 0) > 0) {
      cult.exp = 0
    }
    // 2) 兜底退点：CULT_CONFIG.maxLv 调整后若历史点数超出新上限，多余点退回 skillPoints
    const { CULT_CONFIG, CULT_KEYS } = require('./balance/cultivation')
    for (const k of CULT_KEYS) {
      const cap = CULT_CONFIG[k] && CULT_CONFIG[k].maxLv
      if (cap == null) continue
      const cur = cult.levels[k] || 0
      if (cur > cap) {
        cult.skillPoints += (cur - cap)
        cult.levels[k] = cap
      }
    }
    // 3) 标记 + 触发首次进入修炼界面的 ceremony / guide
    cult.capMigrationV = 2
    d.cultivation = cult
    // 触发"扩容仪式"待播放（首次进入修炼界面消费一次）；只有真·老玩家（已修过炼）才弹
    if ((cult.level || 0) >= 60) {
      d.cultMigrationCeremonyPending = true
    }
  },
  // v27→v28：天机试炼赛季进度
  27: (d) => {
    if (!d.trial) {
      d.trial = {
        seasonId: '',
        seasonScore: 0,
        bestScore: 0,
        bestFloor: 0,
        bestRun: null,
        claimed: [],
        daily: { date: '', runs: 0, firstHalfUsed: false, bestScore: 0, bestFloor: 0, questDone: {} },
      }
    }
  },
  // v28→v29：天机试炼奖励轨道改为赛季累计分，每日只计入当日最佳增量
  28: (d) => {
    if (!d.trial) {
      d.trial = {
        seasonId: '',
        seasonScore: 0,
        bestScore: 0,
        bestFloor: 0,
        bestRun: null,
        claimed: [],
        daily: { date: '', runs: 0, firstHalfUsed: false, bestScore: 0, bestFloor: 0, questDone: {} },
      }
    }
    if (typeof d.trial.seasonScore !== 'number') d.trial.seasonScore = 0
    if (!d.trial.daily) d.trial.daily = { date: '', runs: 0, firstHalfUsed: false, bestScore: 0, questDone: {} }
    if (typeof d.trial.daily.bestScore !== 'number') d.trial.daily.bestScore = 0
    if (!d.trial.daily.questDone) d.trial.daily.questDone = {}
  },
  // v29→v30：图鉴隐藏永久加成改为资源奖励
  //   · 老玩家已领取的属性/稀有度里程碑需要一次性补发新资源
  //   · 总量里程碑本来就是资源奖励，不能重复补发
  29: (d) => {
    // _load 会先用 defaultPersist 补默认字段，这里强制回到未补发状态，
    // 确保所有从 v29 升上来的老存档都能拿到一次补发。
    d.dexRewardCompV = 0
    grantDexRewardCompensation(d)
  },
  // v30→v31：修炼上限 Lv.100 → Lv.120（五维 maxLv +20）
  //   · 老 Lv.100 玩家清掉溢出 exp，从 Lv.100 继续累积
  //   · CULT_CONFIG.maxLv 调整后若历史 levels[key] 超过新上限 → 多余点退回
  //   · 打标 cult.capMigrationV=3，Lv.100+ 玩家首次进修炼页弹扩容仪式
  30: (d) => {
    const cult = d.cultivation || {}
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.skillPoints == null) cult.skillPoints = 0
    if (cult.totalExpEarned == null) cult.totalExpEarned = 0
    if ((cult.level || 0) >= 100 && (cult.exp || 0) > 0) {
      cult.exp = 0
    }
    const { CULT_CONFIG, CULT_KEYS } = require('./balance/cultivation')
    for (const k of CULT_KEYS) {
      const cap = CULT_CONFIG[k] && CULT_CONFIG[k].maxLv
      if (cap == null) continue
      const cur = cult.levels[k] || 0
      if (cur > cap) {
        cult.skillPoints += (cur - cap)
        cult.levels[k] = cap
      }
    }
    cult.capMigrationV = 3
    d.cultivation = cult
    if ((cult.level || 0) >= 100) {
      d.cultMigrationCeremonyPending = true
    }
  },
}

/** 从 oldVer 逐步迁移到 CURRENT_VERSION */
function runMigrations(data) {
  let v = data._version || 0
  while (v < CURRENT_VERSION) {
    const fn = migrations[v]
    if (fn) {
      console.log(`[Storage] 执行迁移 v${v} → v${v + 1}`)
      fn(data)
    }
    v++
    data._version = v
  }
}

class Storage {
  constructor(opts) {
    const options = opts || {}
    this.serverId = serverConfig.normalizeServerId(options.serverId)
    this._localKey = serverConfig.getLocalSaveKey(this.serverId)
    this._legacyLocalKey = serverConfig.getLegacyLocalSaveKey()
    this._d = null          // 持久化数据
    this._sessionStartAt = Date.now()
    // 用户信息（微信授权）
    this.userInfo = null      // { nickName, avatarUrl }
    this.userAuthorized = false
    this._load()
    this._loadUserInfo()
    // 抖音端没有 createUserInfoButton，先用默认身份允许提交
    // 后续通过 requestDouyinUserProfile 在 tap 事件中获取真实信息
    if (P.isDouyin && !this.userAuthorized) {
      this.userInfo = { nickName: '冒险者', avatarUrl: '' }
      this.userAuthorized = true
    }
    this._ranking = new RankingService({
      getContext: () => {
        const { getDexProgress } = require('./dexConfig')
        const pool = this._d.petPool || []
        const dexProg = getDexProgress(pool)
        const farN = this.getFarthestClearedStageCoords(false)
        const farE = this.getFarthestClearedStageCoords(true)
        // 未授权也要能上榜：用基于 openid 的稳定匿名昵称 + 空头像占位
        // 授权后 this.userInfo 会被覆盖为真实头像昵称，后续提交自动使用真名
        const anonInfo = this.userInfo || { nickName: genAnonNick(cloudSync.getOpenid()), avatarUrl: '' }
        return {
          userAuthorized: this.userAuthorized,
          userInfo: anonInfo,
          petDexCount: pool.length,
          masteredCount: dexProg.mastered.length,
          collectedCount: dexProg.collected.length,
          maxCombo: this._d.stats.maxCombo || 0,
          avgCombo: this._d.stats.totalBattles > 0 ? Math.round(this._d.stats.totalCombos / this._d.stats.totalBattles * 10) / 10 : 0,
          bestFloor: this.bestFloor,
          bestFloorPets: this.stats.bestFloorPets || [],
          bestFloorWeapon: this.stats.bestFloorWeapon,
          bestTotalTurns: this.stats.bestTotalTurns || 0,
          stageTotalStars: this.getStageTotalStars(),
          stageClearCount: this.getClearedNormalStageDistinctCount(),
          stageEliteClearCount: this.getStageEliteClearCount(),
          farthestChapter: this.getFarthestChapter(),
          farthestNormalChapter: farN ? farN.chapter : 0,
          farthestNormalOrder: farN ? farN.order : 0,
          farthestEliteChapter: farE ? farE.chapter : 0,
          farthestEliteOrder: farE ? farE.order : 0,
          // 档位（realmTier）：用于排行榜"同境界/全服"分档；基于 cultivation level 5 档聚合
          realmTier: require('./realmTier').getRealmTier(this.cultLv),
        }
      },
      markDirty: () => { if (this._eventBus) this._eventBus.emit('ranking:dirty') },
    })
    this._recordFirstEnterIfNeeded()
    this._initCloud()
  }

  // ===== 持久化数据访问 =====
  get bestFloor()   { return this._d.bestFloor }
  get totalRuns()   { return this._d.totalRuns }
  get stats()       { return this._d.stats }
  get settings()    { return this._d.settings }
  get cloudSyncReady() { return !!this._cloudSyncReady }

  hasGameplayProgress(data = this._d) {
    if (!data || typeof data !== 'object') return false
    const cult = data.cultivation || {}
    const levels = cult.levels || {}
    const hasCultivationProgress = (cult.totalExpEarned || 0) > 0
      || (cult.skillPoints || 0) > 0
      || Object.keys(levels).some((key) => (levels[key] || 0) > 0)
    const fragmentBank = data.fragmentBank || {}
    const hasFragments = Object.keys(fragmentBank).some((key) => (fragmentBank[key] || 0) > 0)

    return (data.bestFloor || 0) > 0
      || (data.totalRuns || 0) > 0
      || ((data.petPool && data.petPool.length) || 0) > 0
      || ((data.petDex && data.petDex.length) || 0) > 0
      || ((data.weaponCollection && data.weaponCollection.length) || 0) > 0
      || (data.soulStone || 0) > 0
      || (data.awakenStone || 0) > 0
      || !!(data.stageClearRecord && Object.keys(data.stageClearRecord).length > 0)
      || hasFragments
      || hasCultivationProgress
  }

  hasPersistentProgress(data = this._d) {
    if (this.hasGameplayProgress(data)) return true
    return !!(data && data.guideFlags && Object.keys(data.guideFlags).length > 0)
  }

  _isCrossServerLegacyData(data = this._d) {
    if (this.serverId === serverConfig.DEFAULT_SERVER_ID) return false
    if (!this.hasGameplayProgress(data)) return false
    const summary = (data && data.analyticsSummary) || {}
    const firstSeenAt = Number(summary.firstSeenAt || 0)
    if (!firstSeenAt || firstSeenAt >= ROLLING_SERVER_START_AT) return false
    const stageStars = this.getStageTotalStars ? this.getStageTotalStars() : 0
    const petCount = (data.petPool && data.petPool.length) || 0
    const cultLv = (data.cultivation && data.cultivation.level) || 0
    return stageStars >= 60 || petCount >= 20 || cultLv >= 20 || (data.bestFloor || 0) >= 20
  }

  _resetCrossServerLegacyData(reason) {
    console.warn('[Storage] 检测到一服旧档污染新服，重置当前服存档:', this.serverId, reason || '')
    this._d = defaultPersist()
    this._d.serverId = this.serverId
    _freshPersistDataVersion(this._d)
    ensureTeamPresets(this._d)
    try { P.removeStorageSync(this._localKey) } catch (_) {}
    try { P.setStorageSync(this._localKey, JSON.stringify(this._d)) } catch (_) {}
  }

  // 更新最高层数
  updateBestFloor(floor, pets, weapon, totalTurns) {
    if (floor > this._d.bestFloor) {
      this._d.bestFloor = floor
      this._d.stats.bestFloorPets = (pets || []).map(p => ({ id: p.id, name: p.name, attr: p.attr, atk: p.atk, star: p.star || 1 }))
      this._d.stats.bestFloorWeapon = weapon ? { name: weapon.name } : null
    }
    // 记录最快通关回合数（仅通关时，即totalTurns > 0）
    if (totalTurns > 0 && (!this._d.stats.bestTotalTurns || totalTurns < this._d.stats.bestTotalTurns)) {
      this._d.stats.bestTotalTurns = totalTurns
    }
    this._d.totalRuns++
    this._save()
  }

  // 记录战斗统计
  recordBattle(combo) {
    this._d.stats.totalBattles++
    this._d.stats.totalCombos += combo
    this._d.stats.maxCombo = Math.max(this._d.stats.maxCombo, combo)
    this._save()
  }

  // 设置
  toggleBgm() {
    this._d.settings.bgmOn = !this._d.settings.bgmOn
    this._save()
    return this._d.settings.bgmOn
  }
  toggleSfx() {
    this._d.settings.sfxOn = !this._d.settings.sfxOn
    this._save()
    return this._d.settings.sfxOn
  }

  /** 设置背景音乐音量（0~100） */
  setBgmVolume(vol) {
    this._d.settings.bgmVolume = Math.max(0, Math.min(100, Math.round(vol)))
    this._save()
    return this._d.settings.bgmVolume
  }

  // 图鉴：记录收集到3星的宠物（兼容旧版，新版由 petPool 派生）
  get petDex()    { return this._d.petDex || [] }
  addPetDex(petId) {
    if (!this._d.petDex) this._d.petDex = []
    if (!this._d.petDex.includes(petId)) {
      this._d.petDex.push(petId)
      this._save()
    }
  }

  // 图鉴：标记宠物已查看详情（红点消失）
  get petDexSeen() { return this._d.petDexSeen || [] }
  markDexSeen(petId) {
    if (!this._d.petDexSeen) this._d.petDexSeen = []
    if (!this._d.petDexSeen.includes(petId)) {
      this._d.petDexSeen.push(petId)
      this._save()
    }
  }

  // 灵宠池 NEW 角标：进入池内详情页即视为"已看过"
  get petPoolSeen() { return this._d.petPoolSeen || [] }
  get petPoolFavoriteIds() { return this._d.petPoolFavoriteIds || [] }
  isPetNewInPool(petId) {
    if (!petId) return false
    const pool = this._d.petPool || []
    if (!pool.some(p => p.id === petId)) return false
    const seen = this._d.petPoolSeen || []
    return !seen.includes(petId)
  }
  hasNewPetInPool() {
    const pool = this._d.petPool || []
    const seen = this._d.petPoolSeen || []
    return pool.some(p => !seen.includes(p.id))
  }
  markPetPoolSeen(petId) {
    if (!petId) return false
    if (!this._d.petPoolSeen) this._d.petPoolSeen = []
    if (this._d.petPoolSeen.includes(petId)) return false
    this._d.petPoolSeen.push(petId)
    this._save()
    return true
  }

  /** 灵宠池收藏：是否在收藏列表中（仅池内宠物有效） */
  isPetPoolFavorite(petId) {
    if (!petId || !this.getPoolPet(petId)) return false
    const arr = this._d.petPoolFavoriteIds
    return Array.isArray(arr) && arr.includes(petId)
  }

  /**
   * 切换灵宠池收藏状态
   * @returns {boolean|null} 切换后是否已收藏；未入池返回 null
   */
  togglePetPoolFavorite(petId) {
    if (!petId || !this.getPoolPet(petId)) return null
    if (!Array.isArray(this._d.petPoolFavoriteIds)) this._d.petPoolFavoriteIds = []
    const arr = this._d.petPoolFavoriteIds
    const i = arr.indexOf(petId)
    if (i >= 0) {
      arr.splice(i, 1)
      this._save()
      return false
    }
    arr.push(petId)
    this._save()
    return true
  }

  // ===== 图鉴里程碑系统 =====
  get dexMilestonesClaimed() { return this._d.dexMilestonesClaimed || [] }
  get dexMilestonesAdRewardClaimed() { return this._d.dexMilestonesAdRewardClaimed || [] }

  claimDexMilestone(milestoneId) {
    const { ALL_MILESTONES, isMilestoneReached } = require('./dexConfig')
    const m = ALL_MILESTONES.find(ms => ms.id === milestoneId)
    if (!m) return { success: false, message: '里程碑不存在' }
    if (!this._d.dexMilestonesClaimed) this._d.dexMilestonesClaimed = []
    if (this._d.dexMilestonesClaimed.includes(milestoneId)) return { success: false, message: '已领取' }
    if (!isMilestoneReached(m, this._d.petPool || [])) return { success: false, message: '未达成' }
    this._d.dexMilestonesClaimed.push(milestoneId)
    const granted = grantDexRewardToData(this._d, m.reward)
    this._save()
    return { success: true, reward: m.reward || null, granted, buff: null }
  }

  /** 图鉴里程碑「翻倍」广告：额外发放一份货币奖励，每档里程碑仅一次 */
  claimDexMilestoneAdReward(milestoneId) {
    const { ALL_MILESTONES, isMilestoneReached } = require('./dexConfig')
    const m = ALL_MILESTONES.find(ms => ms.id === milestoneId)
    if (!m || !m.reward) return { success: false, message: '无广告奖励' }
    if (m.adDouble === false) return { success: false, message: '该奖励不可翻倍' }
    if (!isMilestoneReached(m, this._d.petPool || [])) return { success: false, message: '未达成' }
    if (!this._d.dexMilestonesAdRewardClaimed) this._d.dexMilestonesAdRewardClaimed = []
    if (this._d.dexMilestonesAdRewardClaimed.includes(milestoneId)) return { success: false, message: '已领过' }
    this._d.dexMilestonesAdRewardClaimed.push(milestoneId)
    const granted = grantDexRewardToData(this._d, m.reward)
    this._save()
    return { success: true, reward: m.reward, granted }
  }

  getDexBuffs() {
    const { getDexBuffs } = require('./dexConfig')
    return getDexBuffs(this._d.dexMilestonesClaimed || [])
  }

  // ===== 修炼系统 =====
  get cultivation() { return this._d.cultivation }

  get selectedAvatar() { return this._d.selectedAvatar || 'boy1' }
  setSelectedAvatar(id) { this._d.selectedAvatar = id; this._save() }

  get unlockedAvatars() {
    if (!Array.isArray(this._d.unlockedAvatars)) this._d.unlockedAvatars = ['boy1', 'girl1']
    return this._d.unlockedAvatars
  }

  isAvatarUnlocked(avatarId) {
    return this.unlockedAvatars.includes(avatarId)
  }

  unlockAvatar(avatarId) {
    if (!Array.isArray(this._d.unlockedAvatars)) this._d.unlockedAvatars = ['boy1', 'girl1']
    if (!this._d.unlockedAvatars.includes(avatarId)) {
      this._d.unlockedAvatars.push(avatarId)
      this._save()
    }
  }

  /**
   * 消耗修炼点升级指定属性
   * @param {string} key - 属性键名
   * @param {number} [amount=1] - 加点数量
   * @returns {number} 实际升级的点数（0 表示失败）
   */
  upgradeCultivation(key, amount) {
    const { CULT_CONFIG } = require('./cultivationConfig')
    const cfg = CULT_CONFIG[key]
    if (!cfg) return 0
    const cult = this._d.cultivation
    if (cult.skillPoints <= 0) return 0
    const remaining = cfg.maxLv - cult.levels[key]
    if (remaining <= 0) return 0
    const actual = Math.min(amount || 1, remaining, cult.skillPoints)
    if (actual <= 0) return 0
    cult.skillPoints -= actual
    cult.levels[key] += actual
    this._save()
    return actual
  }

  /**
   * 增加修炼经验并自动升级，返回升级次数
   * 每升一级获得 1 修炼点
   */
  addCultExp(amount) {
    if (amount <= 0) return this._tryCultLevelUp()  // amount=0时仍尝试补升（经验表变更导致的历史溢出）
    const { MAX_LEVEL, expToNextLevel } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (cult.level == null || cult.level < 1) cult.level = 1
    if (cult.skillPoints == null) cult.skillPoints = 0
    // 满级直接吞入：只累计 totalExpEarned 用于统计，不再让 cult.exp 无上限堆积
    //   背景：早先策略"满级仍然累积 exp 用于显示"，导致提高 MAX_LEVEL 时老玩家瞬间蹿多级。
    //   修正后：满级 → totalExpEarned += amount，cult.exp 保持 0，扩容上限时直接从满级再累积。
    if (cult.level >= MAX_LEVEL) {
      cult.exp = 0
      cult.totalExpEarned += amount
      this._save()
      return 0
    }
    cult.exp += amount
    cult.totalExpEarned += amount
    let levelUps = 0
    while (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      if (cult.exp < needed) break
      cult.exp -= needed
      cult.level++
      cult.skillPoints++
      levelUps++
    }
    // 升到上限那一帧把残留经验一并清零，避免"卡在 9999 / 10000"显示
    if (cult.level >= MAX_LEVEL) cult.exp = 0
    this._save()
    return levelUps
  }

  /**
   * 尝试消化已有溢出经验（经验表下调后旧存档可能经验已够升级）
   * 返回补升的次数
   */
  _tryCultLevelUp() {
    const { MAX_LEVEL, expToNextLevel } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (!cult || cult.level == null || cult.level < 1) return 0
    if (cult.skillPoints == null) cult.skillPoints = 0
    let levelUps = 0
    while (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      if (cult.exp < needed) break
      cult.exp -= needed
      cult.level++
      cult.skillPoints++
      levelUps++
    }
    // 与 addCultExp 一致：升满级后清掉残留 exp，防止下次扩容时"无中生有"蹿级
    if (cult.level >= MAX_LEVEL && cult.exp > 0) cult.exp = 0
    if (levelUps > 0) this._save()
    // 达到阈值的形象自动解锁（每次都跑一次，幂等；配置见 cultivationConfig.AVATAR_UNLOCK_LV）
    this._syncAvatarUnlockByCultLv()
    return levelUps
  }

  // 按修炼等级补齐形象解锁
  //   独立成方法：
  //     1) _tryCultLevelUp 每次升级后调用
  //     2) storage 构造末尾做一次老账号兜底（历史上没触发过 unlockAvatar 的老玩家直接补上）
  _syncAvatarUnlockByCultLv() {
    const { AVATAR_UNLOCK_LV } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (!cult || cult.level == null) return
    for (const avId of Object.keys(AVATAR_UNLOCK_LV)) {
      if (cult.level >= AVATAR_UNLOCK_LV[avId]) this.unlockAvatar(avId)
    }
  }

  // ===== 新手指引 =====

  isGuideShown(id) { return !!(this._d.guideFlags && this._d.guideFlags[id]) }
  markGuideShown(id) {
    if (!this._d.guideFlags) this._d.guideFlags = {}
    const wasShown = !!this._d.guideFlags[id]
    this._d.guideFlags[id] = true
    if (!wasShown && id === 'intro_done') {
      this.recordFunnelEvent('intro_done')
    }
    this._save()
  }

  // ===== 首日漏斗 / 商业化埋点 =====

  _ensureAnalyticsSummary() {
    const tpl = createAnalyticsSummary()
    const s = this._d.analyticsSummary || (this._d.analyticsSummary = tpl)
    if (!s.firstSession || typeof s.firstSession !== 'object') s.firstSession = tpl.firstSession
    Object.keys(tpl.firstSession).forEach((k) => {
      if (!s.firstSession[k] || typeof s.firstSession[k] !== 'object') s.firstSession[k] = {}
    })
    if (typeof s.firstSeenDate !== 'string') s.firstSeenDate = ''
    if (typeof s.firstSeenAt !== 'number') s.firstSeenAt = 0
    return s
  }

  _recordFirstEnterIfNeeded() {
    const s = this._ensureAnalyticsSummary()
    if (s.firstSeenDate) return
    if (this.hasGameplayProgress()) return
    this.recordFunnelEvent('new_user_enter', {
      scene: 'startup',
      cloudSyncReady: !!this.cloudSyncReady,
      hasLocalProgress: false,
    })
  }

  recordFunnelEvent(eventId, params = {}) {
    if (!eventId) return
    const now = Date.now()
    const summary = this._ensureAnalyticsSummary()
    const firstDateBefore = summary.firstSeenDate
    if (!summary.firstSeenDate) summary.firstSeenDate = localDateKey(new Date(now))
    if (!summary.firstSeenAt) summary.firstSeenAt = now

    const sessionAgeSec = Math.max(0, Math.round((now - (this._sessionStartAt || now)) / 1000))
    const isNewUser = firstDateBefore ? summary.firstSeenDate === localDateKey(new Date(now)) : true
    const safeParams = Object.assign({}, params, {
      isNewUser,
      sessionAgeSec,
      dataVersion: DATA_VERSION,
    })
    try {
      gpAnalytics.trackFunnelEvent(eventId, safeParams)
    } catch (_e) {}

    const bucketName = _analyticsBucketForEvent(eventId)
    const bucket = summary.firstSession[bucketName] || (summary.firstSession[bucketName] = {})
    const key = _analyticsKeyForEvent(eventId, params)
    bucket[key] = (bucket[key] || 0) + 1
    if (eventId !== key) {
      const events = summary.firstSession.events || (summary.firstSession.events = {})
      events[eventId] = (events[eventId] || 0) + 1
    }
    summary.lastEventAt = now
    this._save()
  }

  // ===== 灵宠池系统 =====

  get petPool() { return this._d.petPool || [] }
  get petPoolCount() { return (this._d.petPool || []).length }
  get soulStone() { return this._d.soulStone || 0 }
  // 向后兼容旧名
  get petExpPool() { return this.soulStone }

  /**
   * 宠物入池（★3图鉴首次解锁时调用）
   * 入池初始状态：★1 Lv.5 + 2碎片
   */
  addToPetPool(petId, source = 'roguelike') {
    const { getPetById } = require('./pets')
    const { ENTRY_LEVEL, ENTRY_FRAGMENTS } = require('./petPoolConfig')
    const pet = getPetById(petId)
    if (!pet) return false
    const pool = this._d.petPool || (this._d.petPool = [])
    if (pool.find(p => p.id === petId)) return false
    const banked = (this._d.fragmentBank && this._d.fragmentBank[petId]) || 0
    pool.push({
      id: petId,
      attr: pet.attr,
      star: 1,
      level: ENTRY_LEVEL,
      fragments: ENTRY_FRAGMENTS + banked,
      source,
      obtainedAt: Date.now(),
    })
    if (banked > 0) delete this._d.fragmentBank[petId]
    this._save()
    const count = pool.length
    if (this._eventBus) {
      this._eventBus.emit('petPool:add', { petId, count, source })
    }
    return true
  }

  /** 直接设置宠物星级（仅用于新手入池等特殊场景） */
  setPoolPetStar(petId, star) {
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry) return false
    entry.star = star
    this._save()
    return true
  }

  /** 增加碎片（特定宠物） */
  addFragments(petId, count) {
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry) return false
    entry.fragments += count
    this._save()
    return true
  }

  /**
   * 分解碎片为灵石（1 碎片 = FRAGMENT_TO_EXP 灵石）
   * 名称保留 FRAGMENT_TO_EXP 是历史遗留：原为"经验"，现存档里全部导向灵石资源池
   * @returns {number} 获得的灵石量，0 表示失败
   */
  decomposeFragments(petId, count) {
    const { FRAGMENT_TO_EXP } = require('./petPoolConfig')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry || entry.fragments < count || count <= 0) return 0
    entry.fragments -= count
    const soulGained = count * FRAGMENT_TO_EXP
    this._d.soulStone = (this._d.soulStone || 0) + soulGained
    this._save()
    return soulGained
  }

  /** 增加灵石 */
  addSoulStone(amount) {
    if (amount <= 0) return
    this._d.soulStone = (this._d.soulStone || 0) + amount
    this._save()
  }

  /** 消耗灵石，返回是否成功 */
  consumeAwakenStone(amount) {
    if (amount <= 0) return false
    if ((this._d.awakenStone || 0) < amount) return false
    this._d.awakenStone -= amount
    this._save()
    return true
  }

  /** 增加觉醒石 */
  addAwakenStone(amount) {
    if (amount <= 0) return
    this._d.awakenStone = (this._d.awakenStone || 0) + amount
    this._save()
  }

  /** 读取觉醒石数量 */
  get awakenStone() { return this._d.awakenStone || 0 }

  // ===== 万能碎片（可用于任意灵宠升星的通用材料） =====

  get universalFragment() { return this._d.universalFragment || 0 }

  /** 增加万能碎片 */
  addUniversalFragment(amount) {
    if (!amount || amount <= 0) return
    this._d.universalFragment = (this._d.universalFragment || 0) + amount
    this._save()
  }

  /** 消耗万能碎片，返回是否成功 */
  consumeUniversalFragment(amount) {
    if (amount <= 0) return false
    if ((this._d.universalFragment || 0) < amount) return false
    this._d.universalFragment -= amount
    this._save()
    return true
  }

  /**
   * 从灵石池投入经验给指定宠物，返回升级次数
   * @param {string} petId - 目标宠物ID
   * @param {number} amount - 投入灵石量
   */
  investSoulStone(petId, amount) {
    const { petExpToNextLevel, getPoolPetMaxLv } = require('./petPoolConfig')
    const { getPetRarity } = require('./pets')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry || amount <= 0) return 0
    const available = Math.min(amount, this._d.soulStone || 0)
    if (available <= 0) return 0
    // 必须用 getPoolPetMaxLv：它会结合星级上限（POOL_STAR_LV_CAP）与来源上限取较大值，
    // 否则 ★4/★5 宠在非 stage 来源时会被错误卡在 POOL_MAX_LV=40，永远达不到升 5 星所需的 Lv.48
    const maxLv = getPoolPetMaxLv(entry)
    if (entry.level >= maxLv) return 0
    const rarity = getPetRarity(entry.id)
    let spent = 0, levelUps = 0
    let remaining = available
    while (entry.level < maxLv && remaining > 0) {
      const needed = petExpToNextLevel(entry.level, rarity)
      if (remaining >= needed) {
        remaining -= needed
        spent += needed
        entry.level++
        levelUps++
      } else {
        break
      }
    }
    if (spent > 0) {
      this._d.soulStone -= spent
      this.addDailyTaskProgress('pet_feed', 1)
      this._save()
    }
    return levelUps
  }

  /**
   * 升星（消耗碎片，需满足等级门槛）
   * 专属碎片不足时，自动用万能碎片补齐
   */
  upgradePoolPetStar(petId) {
    const { POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_STAR_AWAKEN_COST, getPoolPetMaxStar } = require('./petPoolConfig')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry) return { ok: false, reason: 'not_found' }
    const nextStar = entry.star + 1
    const maxStar = getPoolPetMaxStar(entry)
    if (nextStar > maxStar) return { ok: false, reason: 'max_star' }
    const lvReq = POOL_STAR_LV_REQ[nextStar]
    if (entry.level < lvReq) return { ok: false, reason: 'level_low', required: lvReq }
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    const petOwn = entry.fragments || 0
    const uniOwn = this._d.universalFragment || 0
    if (petOwn + uniOwn < fragCost) return { ok: false, reason: 'fragments_low', required: fragCost }
    const awakenCost = (nextStar >= 4 && POOL_STAR_AWAKEN_COST[nextStar]) || 0
    if (awakenCost > 0 && (this._d.awakenStone || 0) < awakenCost) {
      return { ok: false, reason: 'awaken_stone_low', required: awakenCost }
    }
    let usedUniversal = 0
    if (petOwn >= fragCost) {
      entry.fragments -= fragCost
    } else {
      usedUniversal = fragCost - petOwn
      entry.fragments = 0
      this._d.universalFragment = uniOwn - usedUniversal
    }
    if (awakenCost > 0) this._d.awakenStone -= awakenCost
    entry.star = nextStar
    // 记账：累计用掉的万能碎片。供"归元重修"反推可返还的万能碎片数量
    // 老存档升星时没写该字段，后续只有"新升星"会计入；功能公告需告知玩家
    if (usedUniversal > 0) entry.universalUsed = (entry.universalUsed || 0) + usedUniversal
    this._save()
    return { ok: true, newStar: nextStar, usedUniversal }
  }

  /**
   * 判断指定宠物当前是否在"编队在用"状态
   *   · savedStageTeam（秘境编队）
   *   · teamPresets 任一预设里
   * 只要被任何一份队伍引用，都视为占用，避免"重置后队列出现空槽"的数据不一致
   */
  isPoolPetInAnyTeam(petId) {
    if (!petId) return false
    const saved = this._d.savedStageTeam || []
    if (saved.indexOf(petId) >= 0) return true
    const presets = this._d.teamPresets || []
    for (const p of presets) {
      if (p && Array.isArray(p.petIds) && p.petIds.indexOf(petId) >= 0) return true
    }
    return false
  }

  /** 判断指定宠物当前是否在派遣中（占用 idleDispatch.slots） */
  isPoolPetDispatched(petId) {
    if (!petId) return false
    const slots = (this._d.idleDispatch && this._d.idleDispatch.slots) || []
    return slots.some(s => s && s.petId === petId)
  }

  /**
   * 归元重修 · 功能是否对当前玩家解锁
   *   解锁条件：已打到第 POOL_RESET_UNLOCK_CHAPTER 章（玩家此时才真正积累了可观养成成本）
   */
  isPoolResetUnlocked() {
    const { POOL_RESET_UNLOCK_CHAPTER } = require('./balance/pool')
    return this.getFarthestChapter() >= POOL_RESET_UNLOCK_CHAPTER
  }

  /**
   * 预检指定宠物可否重置，返回统一的判定结果给 UI 使用
   *   · 解锁条件 / 出战中 / 派遣中 / 冷却中 / 闸门觉醒石不足 / 无可返还
   * 不做任何写入
   */
  checkPoolPetResetStatus(petId) {
    const entry = this.getPoolPet(petId)
    if (!entry) return { ok: false, reason: 'not_found' }
    if (!this.isPoolResetUnlocked()) {
      const { POOL_RESET_UNLOCK_CHAPTER } = require('./balance/pool')
      return { ok: false, reason: 'locked', unlockChapter: POOL_RESET_UNLOCK_CHAPTER }
    }
    const { canResetPoolPet } = require('./petPoolConfig')
    return canResetPoolPet(entry, {
      awakenStone: this._d.awakenStone || 0,
      isDispatched: this.isPoolPetDispatched(petId),
    })
  }

  /**
   * 执行"归元重修"：扣闸门觉醒石 + 按档返还 + 宠物等级星级归 1
   *   · 专属碎片 100% 返回 poolPet.fragments（保留本宠属性）
   *   · 灵石/万能碎片/觉醒石按 useAd 档位返给全局资源池
   *   · 重置后写 entry.resetAt 用于 10 分钟冷却
   * @param {string} petId
   * @param {boolean} useAd - 是否走广告增强档（UI 层负责先播广告，播完成功再调此方法）
   * @returns {{ ok:boolean, reason?:string, refund?:object }}
   */
  resetPoolPet(petId, useAd) {
    const entry = this.getPoolPet(petId)
    if (!entry) return { ok: false, reason: 'not_found' }
    const status = this.checkPoolPetResetStatus(petId)
    if (!status.ok) return status
    const { calcPoolPetResetRefund } = require('./petPoolConfig')
    const refund = calcPoolPetResetRefund(entry, !!useAd)
    if (!refund) return { ok: false, reason: 'calc_fail' }
    if ((this._d.awakenStone || 0) < refund.gateCost) {
      return { ok: false, reason: 'gate_short', required: refund.gateCost }
    }
    this._d.awakenStone = (this._d.awakenStone || 0) - refund.gateCost
    if (refund.soulStone > 0) {
      this._d.soulStone = (this._d.soulStone || 0) + refund.soulStone
    }
    if (refund.awakenStone > 0) {
      this._d.awakenStone = (this._d.awakenStone || 0) + refund.awakenStone
    }
    if (refund.universalFrag > 0) {
      this._d.universalFragment = (this._d.universalFragment || 0) + refund.universalFrag
    }
    if (refund.selfFrag > 0) {
      entry.fragments = (entry.fragments || 0) + refund.selfFrag
    }
    entry.level = 1
    entry.star = 1
    entry.universalUsed = 0
    entry.resetAt = Date.now()
    this._save()
    return { ok: true, refund, usedAd: !!useAd }
  }

  /** 获取灵宠池中指定宠物 */
  getPoolPet(petId) {
    return (this._d.petPool || []).find(p => p.id === petId) || null
  }

  // ===== 体力系统（仅固定关卡消耗） =====

  get currentStamina() {
    // 节流：每 5 秒最多触发一次恢复计算，避免每帧 Date.now() 开销
    const now = Date.now()
    if (!this._staminaLastCheck || now - this._staminaLastCheck > 5000) {
      this._recoverStamina()
      this._staminaLastCheck = now
    }
    return this._d.stamina.current
  }

  get maxStamina() {
    const cultLv = (this._d.cultivation && this._d.cultivation.level) || 1
    // 基础上限 = STAMINA_INITIAL；修炼 Lv1 不额外加，从 Lv2 起每级 +1
    return STAMINA_INITIAL + Math.max(0, cultLv - 1)
  }

  consumeStamina(amount) {
    this._recoverStamina()
    if (this._d.stamina.current < amount) return false
    this._d.stamina.current -= amount
    this._save()
    return true
  }

  /** 已使用的新手免费续命次数 */
  getNewbieRevivesUsed() {
    return this._d.newbieRevivesUsed || 0
  }

  /** 消耗一次新手免费续命 */
  useNewbieRevive() {
    this._d.newbieRevivesUsed = (this._d.newbieRevivesUsed || 0) + 1
    this._save()
  }

  /**
   * 是否仍处于"新手阶段"：2-1 尚未通关。
   *
   * 所有"只给真新手"的宽松机制（新手免费续命、新手礼包弹窗等）
   * 统一走这个闸口，避免判据散落到多处导致下次再给老玩家误发福利。
   */
  isNewbiePhase() {
    return !this.isStageCleared('stage_2_1')
  }

  /** 下一点体力恢复的剩余秒数 */
  get staminaRecoverSec() {
    const s = this._d.stamina
    if (s.current >= s.max) return 0
    const elapsed = Date.now() - (s.lastRecoverTime || Date.now())
    const remain = STAMINA_RECOVER_INTERVAL_MS - (elapsed % STAMINA_RECOVER_INTERVAL_MS)
    return Math.ceil(remain / 1000)
  }

  _recoverStamina() {
    let s = this._d.stamina
    if (!s || typeof s !== 'object' || typeof s.current !== 'number') {
      this._d.stamina = { current: STAMINA_INITIAL, max: STAMINA_INITIAL, lastRecoverTime: Date.now() }
      s = this._d.stamina
      this._save()
    }
    const dynMax = this.maxStamina
    s.max = dynMax
    const cultLv = (this._d.cultivation && this._d.cultivation.level) || 1
    const legacyNaturalCap = STAMINA_INITIAL + cultLv
    if (s.current === legacyNaturalCap && legacyNaturalCap === dynMax + 1) {
      s.current = dynMax
    }
    if (!s.lastRecoverTime) { s.lastRecoverTime = Date.now(); return }
    const now = Date.now()
    const elapsed = now - s.lastRecoverTime
    const recovered = Math.floor(elapsed / STAMINA_RECOVER_INTERVAL_MS)
    if (recovered > 0) {
      // 仅在本体低于自然上限时累计时间恢复；签到/任务等奖励可使 current > dynMax，不得被 min 扣回
      if (s.current < dynMax) {
        s.current = Math.min(dynMax, s.current + recovered)
      }
      s.lastRecoverTime += recovered * STAMINA_RECOVER_INTERVAL_MS
    }
  }

  /** 签到、任务、广告、分享等奖励体力：全部入账，不受 maxStamina 限制，也不折算灵石
   *
   *  设计：
   *   - 自然恢复仍然只在 current < maxStamina 时累计（见 _recoverStamina）
   *   - 玩家主动领取的体力可以"存货"堆积，为周末高强度局攒够燃料
   *   - 不再有软顶折灵石（STAMINA_SOFT_CAP_BUFFER / STAMINA_OVERFLOW_SOUL_RATIO 已停用，
   *     常量保留是为了老存档兼容和可能的回滚，当前代码路径不再读取）
   *
   *  返回 { stamina, convertedSoul, convertedFrom }：保持签名向后兼容，
   *  convertedSoul / convertedFrom 始终为 0，调用方 noticeStaminaOverflow 会因此自动跳过提示。 */
  addBonusStamina(amount) {
    const n = Math.floor(Number(amount) || 0)
    if (n <= 0) return { stamina: 0, convertedSoul: 0, convertedFrom: 0 }
    this._recoverStamina()
    this._d.stamina.current = (this._d.stamina.current || 0) + n
    this._save()
    return { stamina: n, convertedSoul: 0, convertedFrom: 0 }
  }

  /** 体力溢出折算后的统一提示：由收体力的调用方把 addBonusStamina 返回值传进来，
   *  本函数只在真的发生折算时弹一次 toast，避免每处都写 if 判断。 */
  noticeStaminaOverflow(result) {
    if (!result || !result.convertedSoul) return
    const soul = result.convertedSoul
    const from = result.convertedFrom
    try {
      P.showGameToast(`体力已充裕，${from}点体力转为灵石×${soul}`, { type: 'resource', icon: 'assets/ui/icon_soul_stone.png' })
    } catch (_) {}
  }

  // ===== 侧边栏复访奖励（抖音必接） =====

  get sidebarRewardClaimedToday() {
    return this._d.sidebarRewardDate === localDateKey()
  }

  claimSidebarReward() {
    if (this.sidebarRewardClaimedToday) return false
    this._recoverStamina()
    this._d.stamina.current += STAMINA_SIDEBAR_REWARD
    this._d.sidebarRewardDate = localDateKey()
    this._save()
    return true
  }

  // ===== 签到系统 =====

  _ensureLoginSign() {
    const { LOGIN_CYCLE_DAYS } = require('./giftConfig')
    if (!this._d.loginSign) {
      this._d.loginSign = {
        day: 0,
        lastDate: '',
        isNewbie: true,
        totalSignDays: 0,
        pendingDoubleRewards: null,
        doubleClaimedDate: '',
        cycleDays: LOGIN_CYCLE_DAYS,
        milestonePetClaimed: [],
        consecutiveDay: 0,
        consecutiveClaimedDate: '',
      }
      return
    }
    const sign = this._d.loginSign
    if (!Array.isArray(sign.milestonePetClaimed)) sign.milestonePetClaimed = []
    if (sign.consecutiveDay == null) sign.consecutiveDay = 0
    if (typeof sign.consecutiveClaimedDate !== 'string') sign.consecutiveClaimedDate = ''
    const legacyDay = Math.max(0, Number(sign.day) || 0)
    const total = Math.max(0, Number(sign.totalSignDays) || legacyDay)
    sign.totalSignDays = total
    sign.cycleDays = LOGIN_CYCLE_DAYS
    sign.day = total > 0 ? ((total - 1) % LOGIN_CYCLE_DAYS) + 1 : 0
    sign.isNewbie = total < LOGIN_CYCLE_DAYS
    if (typeof sign.lastDate !== 'string') sign.lastDate = ''
    if (typeof sign.doubleClaimedDate !== 'string') sign.doubleClaimedDate = ''
    if (!sign.pendingDoubleRewards || typeof sign.pendingDoubleRewards !== 'object') sign.pendingDoubleRewards = null
    const today = localDateKey()
    if (sign.lastDate !== today) {
      sign.pendingDoubleRewards = null
    } else if (!sign.pendingDoubleRewards && sign.doubleClaimedDate !== today) {
      // 旧存档迁移 / 升级后首次打开：今天已签到但缺少翻倍快照，自动补上
      const {
        cloneLoginRewardRewards,
        getDoubleableLoginRewards,
        getScaledLoginRewardByDay,
      } = require('./giftConfig')
      const cycleDay = sign.day || 1
      const scaled = getScaledLoginRewardByDay(cycleDay, sign.isNewbie)
      if (scaled && scaled.rewards) {
        const doubleable = getDoubleableLoginRewards(scaled.rewards)
        sign.pendingDoubleRewards = Object.keys(doubleable).length ? cloneLoginRewardRewards(doubleable) : null
      }
    }
  }

  get loginSign() { this._ensureLoginSign(); return this._d.loginSign }

  get canSignToday() {
    this._ensureLoginSign()
    return this._d.loginSign.lastDate !== localDateKey()
  }

  /** 获取连续登录状态：当前连续天数、今天签到后会是第几天 */
  get consecutiveLoginState() {
    this._ensureLoginSign()
    const { CONSECUTIVE_CYCLE_DAYS } = require('./giftConfig')
    const sign = this._d.loginSign
    const today = localDateKey()
    const yesterday = localDateKey(new Date(gmNow() - 86400000))
    const current = sign.consecutiveDay || 0

    // 预览：如果今天签到，连续天数会变成几
    let preview = current
    if (this.canSignToday) {
      if (sign.lastDate === yesterday) {
        preview = current >= CONSECUTIVE_CYCLE_DAYS ? 1 : current + 1
      } else {
        preview = 1
      }
    }

    return {
      currentDay: current,
      previewDay: preview,
      cycleDays: CONSECUTIVE_CYCLE_DAYS,
      claimedToday: sign.consecutiveClaimedDate === today,
    }
  }

  get loginRewardDoubleState() {
    this._ensureLoginSign()
    const sign = this._d.loginSign
    const today = localDateKey()
    const pendingRewards = sign.pendingDoubleRewards && typeof sign.pendingDoubleRewards === 'object'
      ? Object.assign({}, sign.pendingDoubleRewards)
      : null
    const hasPending = !!(pendingRewards && Object.keys(pendingRewards).length)
    const claimed = sign.doubleClaimedDate === today
    const eligible = !this.canSignToday && sign.lastDate === today && hasPending && !claimed
    return { eligible, claimed, pendingRewards }
  }

  _mergeLoginRewardResult(target, patch) {
    if (!patch) return target
    Object.keys(patch).forEach((key) => {
      const value = patch[key]
      if (value == null) return
      if (typeof value === 'number') {
        target[key] = (target[key] || 0) + value
        return
      }
      if (Array.isArray(value)) {
        target[key] = (target[key] || []).concat(value)
        return
      }
      if ((key === 'petFragment' || key === 'petDuplicateFragment') && value.petId) {
        if (target[key] && target[key].petId === value.petId) {
          target[key].count = (target[key].count || 0) + (value.count || 0)
        } else {
          target[key] = { petId: value.petId, count: value.count || 0 }
        }
        return
      }
      target[key] = Object.assign({}, value)
    })
    return target
  }

  _grantLoginRewardBundle(rewards) {
    const granted = {}
    if (!rewards) return granted
    if (rewards.soulStone) {
      this.addSoulStone(rewards.soulStone)
      granted.soulStone = rewards.soulStone
    }
    if (rewards.awakenStone) {
      this.addAwakenStone(rewards.awakenStone)
      granted.awakenStone = rewards.awakenStone
    }
    if (rewards.stamina) {
      const r = this.addBonusStamina(rewards.stamina)
      this.noticeStaminaOverflow(r)
      granted.stamina = rewards.stamina
    }
    if (rewards.universalFragment) {
      this.addUniversalFragment(rewards.universalFragment)
      granted.universalFragment = rewards.universalFragment
    }
    if (rewards.fragment) {
      const fragResult = this.addRandomFragments(rewards.fragment)
      granted.fragment = rewards.fragment
      if (fragResult && fragResult.petId) granted.fragmentDetails = [fragResult]
    }
    if (rewards.petFragment && rewards.petFragment.petId && rewards.petFragment.count > 0) {
      this.addFragmentSmart(rewards.petFragment.petId, rewards.petFragment.count)
      granted.petFragment = { petId: rewards.petFragment.petId, count: rewards.petFragment.count }
    }
    if (rewards.petId) {
      const petId = rewards.petId
      if (this.getPoolPet(petId)) {
        const { LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS } = require('./giftConfig')
        const duplicate = rewards.petDuplicateFragment || {
          petId,
          count: rewards.duplicateFragments || LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS,
        }
        if (duplicate && duplicate.petId && duplicate.count > 0) {
          this.addFragmentSmart(duplicate.petId, duplicate.count)
          granted.petDuplicateFragment = { petId: duplicate.petId, count: duplicate.count }
        }
      } else if (this.addToPetPool(petId, 'signIn')) {
        granted.petId = petId
      }
    } else if (rewards.petDuplicateFragment && rewards.petDuplicateFragment.petId && rewards.petDuplicateFragment.count > 0) {
      this.addFragmentSmart(rewards.petDuplicateFragment.petId, rewards.petDuplicateFragment.count)
      granted.petDuplicateFragment = {
        petId: rewards.petDuplicateFragment.petId,
        count: rewards.petDuplicateFragment.count,
      }
    }
    return granted
  }

  grantRewardBundle(rewards) {
    return this._grantLoginRewardBundle(rewards)
  }

  claimLoginReward() {
    if (!this.canSignToday) return null
    this._ensureLoginSign()
    const sign = this._d.loginSign
    const {
      LOGIN_CYCLE_DAYS,
      CONSECUTIVE_CYCLE_DAYS,
      cloneLoginRewardRewards,
      getDoubleableLoginRewards,
      getLoginMilestoneReward,
      getLoginRewardRatio,
      getScaledLoginRewardByDay,
      getConsecutiveLoginReward,
    } = require('./giftConfig')
    const claimIsNewbie = (sign.totalSignDays || 0) < LOGIN_CYCLE_DAYS
    const claimDay = ((sign.totalSignDays || 0) % LOGIN_CYCLE_DAYS) + 1
    const scaled = getScaledLoginRewardByDay(claimDay, claimIsNewbie)
    if (!scaled || !scaled.rewards) return null

    const grantedRewards = this._grantLoginRewardBundle(scaled.rewards)
    let milestoneRewards = null
    if (claimDay === LOGIN_CYCLE_DAYS) {
      milestoneRewards = this._grantLoginRewardBundle(getLoginMilestoneReward(claimIsNewbie))
    }

    // ── 连续登录处理 ──
    const today = localDateKey()
    const yesterday = localDateKey(new Date(gmNow() - 86400000))
    let prevConsec = sign.consecutiveDay || 0
    if (sign.lastDate === yesterday) {
      // 昨天签过 → 连续+1（超过7天循环归1）
      prevConsec = prevConsec >= CONSECUTIVE_CYCLE_DAYS ? 1 : prevConsec + 1
    } else if (sign.lastDate !== today) {
      // 断签了 → 重新从第1天开始
      prevConsec = 1
    }
    sign.consecutiveDay = prevConsec

    // 自动发放连续登录奖励
    const consecReward = getConsecutiveLoginReward(prevConsec)
    let consecutiveGranted = null
    if (consecReward && consecReward.rewards) {
      consecutiveGranted = this._grantLoginRewardBundle(consecReward.rewards)
      sign.consecutiveClaimedDate = today
    }

    sign.day = claimDay
    sign.lastDate = today
    sign.totalSignDays = (sign.totalSignDays || 0) + 1
    sign.isNewbie = sign.totalSignDays < LOGIN_CYCLE_DAYS
    sign.pendingDoubleRewards = cloneLoginRewardRewards(getDoubleableLoginRewards(scaled.rewards))
    if (!Object.keys(sign.pendingDoubleRewards).length) sign.pendingDoubleRewards = null
    sign.doubleClaimedDate = ''
    sign.cycleDays = LOGIN_CYCLE_DAYS
    this._d._updateTime = gmNow()
    this._save()

    return {
      day: claimDay,
      totalSignDays: sign.totalSignDays,
      isNewbie: claimIsNewbie,
      ratio: getLoginRewardRatio(claimIsNewbie),
      rewards: grantedRewards,
      milestoneRewards,
      doubleableRewards: sign.pendingDoubleRewards ? cloneLoginRewardRewards(sign.pendingDoubleRewards) : null,
      canDouble: !!(sign.pendingDoubleRewards && Object.keys(sign.pendingDoubleRewards).length),
      consecutiveDay: prevConsec,
      consecutiveRewards: consecutiveGranted,
    }
  }

  claimLoginAdDouble() {
    this._ensureLoginSign()
    const sign = this._d.loginSign
    const today = localDateKey()
    if (this.canSignToday || sign.lastDate !== today || sign.doubleClaimedDate === today) return null
    const { cloneLoginRewardRewards } = require('./giftConfig')
    const pendingRewards = sign.pendingDoubleRewards ? cloneLoginRewardRewards(sign.pendingDoubleRewards) : null
    if (!pendingRewards || !Object.keys(pendingRewards).length) return null
    const grantedRewards = this._grantLoginRewardBundle(pendingRewards)
    sign.doubleClaimedDate = today
    this._save()
    return {
      day: sign.day || 0,
      totalSignDays: sign.totalSignDays || 0,
      rewards: grantedRewards,
    }
  }

  /**
   * 领取里程碑宠物奖励（进度条上的 SSR 头像，不可视频双倍）
   * @param {number} day - 里程碑天数 (7/15/22/30)
   * @returns {{ success, message, reward }|null}
   */
  claimMilestonePet(day) {
    this._ensureLoginSign()
    const sign = this._d.loginSign
    const { LOGIN_MILESTONE_PETS } = require('./giftConfig')
    const milestone = LOGIN_MILESTONE_PETS.find(m => m.day === day)
    if (!milestone) return { success: false, message: '里程碑不存在' }

    // 检查进度是否达到（累计进度最多到30天，不再循环）
    const { LOGIN_CYCLE_DAYS } = require('./giftConfig')
    const progressDays = Math.min(LOGIN_CYCLE_DAYS, sign.totalSignDays || 0)
    if (progressDays < day) return { success: false, message: '签到天数未达到' }

    // 检查是否已领取
    if (!Array.isArray(sign.milestonePetClaimed)) sign.milestonePetClaimed = []
    if (sign.milestonePetClaimed.includes(day)) return { success: false, message: '已领取' }

    // 发放奖励
    const reward = {}
    if (milestone.type === 'pet') {
      // 整宠：尝试入池，已有则给重复碎片
      if (this.getPoolPet(milestone.petId)) {
        const dupCount = milestone.duplicateFragments || 25
        this.addFragmentSmart(milestone.petId, dupCount)
        reward.petDuplicateFragment = { petId: milestone.petId, count: dupCount }
      } else {
        this.addToPetPool(milestone.petId, 'signIn')
        reward.petId = milestone.petId
      }
    } else if (milestone.type === 'fragment') {
      this.addFragmentSmart(milestone.petId, milestone.count)
      reward.petFragment = { petId: milestone.petId, count: milestone.count }
    }

    // 标记已领取
    sign.milestonePetClaimed.push(day)
    this._save()

    return { success: true, reward, milestone }
  }

  // ===== 每日任务 =====

  _ensureDailyTask() {
    const today = localDateKey()
    if (!this._d.dailyTaskProgress || this._d.dailyTaskProgress.date !== today) {
      this._d.dailyTaskProgress = {
        date: today, tasks: {}, claimed: {}, allClaimed: false, allBonusAdClaimed: false,
      }
    }
  }

  get dailyTaskProgress() { this._ensureDailyTask(); return this._d.dailyTaskProgress }

  /** 与签到/每日任务一致的日历日 YYYY-MM-DD（含 GM 时间偏移）；广告频控须与此对齐 */
  getCalendarDateKey() {
    return localDateKey()
  }

  /**
   * 若广告日志显示当日「全部任务翻倍」次数已用尽，补写 allBonusAdClaimed（修复旧版未落档或日历不一致）
   */
  syncDailyAllBonusAdFlagFromAdLog() {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    if (!p.allClaimed || p.allBonusAdClaimed) return
    const AdManager = require('../adManager')
    const lim = AdManager.getDailyLimit('dailyTaskBonus')
    if (lim > 0 && AdManager.getTodayCount('dailyTaskBonus') >= lim) {
      p.allBonusAdClaimed = true
      this._save()
    }
  }

  /** 首页「每日签到」入口红点 */
  get hasSignInEntryBadge() {
    return this.canSignToday
  }

  /** 首页「每日任务」入口红点：可领任务或全完成但未领额外奖 */
  get hasDailyTaskEntryBadge() {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    const { getAvailableDailyTasks } = require('./giftConfig')
    const dailyTasks = getAvailableDailyTasks(this)
    for (const task of dailyTasks) {
      const cur = p.tasks[task.id] || 0
      if (cur >= task.condition.count && !p.claimed[task.id]) return true
    }
    const allDone = dailyTasks.every(t => p.claimed[t.id])
    if (allDone && !p.allClaimed) return true
    if (allDone && p.allClaimed && !p.allBonusAdClaimed) {
      this.syncDailyAllBonusAdFlagFromAdLog()
      if (p.allBonusAdClaimed) return false
      const AdManager = require('../adManager')
      if (AdManager.canShow('dailyTaskBonus')) return true
    }
    return false
  }

  /** 兼容：签到或任务任一有红点 */
  get hasDailyRewardEntryBadge() {
    return this.hasSignInEntryBadge || this.hasDailyTaskEntryBadge
  }

  addDailyTaskProgress(taskId, amount) {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    p.tasks[taskId] = (p.tasks[taskId] || 0) + (amount || 1)
    this._save()
  }

  claimDailyTask(taskId) {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    if (p.claimed[taskId]) return false
    const { getAvailableDailyTasks, getScaledDailyTaskReward } = require('./giftConfig')
    const task = getAvailableDailyTasks(this).find(t => t.id === taskId)
    if (!task) return false
    if ((p.tasks[taskId] || 0) < task.condition.count) return false
    p.claimed[taskId] = true
    const r = getScaledDailyTaskReward(task, this.currentChapter)
    this.grantRewardBundle(r)
    this._save()
    return true
  }

  claimDailyAllBonus() {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    if (p.allClaimed) return false
    const { getAvailableDailyTasks, getScaledDailyAllBonus } = require('./giftConfig')
    const allDone = getAvailableDailyTasks(this).every(t => p.claimed[t.id])
    if (!allDone) return false
    p.allClaimed = true
    const r = getScaledDailyAllBonus(this.currentChapter)
    this.grantRewardBundle(r)
    this._save()
    return true
  }

  /** 标记当日「全部任务完成奖励」已通过广告/分享翻倍领取（防重复、供首页追踪与 UI） */
  markDailyAllBonusAdClaimed() {
    this._ensureDailyTask()
    this._d.dailyTaskProgress.allBonusAdClaimed = true
    this._save()
  }

  // ===== 分享追踪 =====

  _ensureShareTracking() {
    const today = localDateKey()
    if (!this._d.shareTracking || this._d.shareTracking.date !== today) {
      this._d.shareTracking = { date: today, rewardCount: this._d.shareTracking ? 0 : 0, firstEverDone: (this._d.shareTracking && this._d.shareTracking.firstEverDone) || false }
    }
    // 场景奖励标记（首次触发永久记录，防止 sceneOnce 场景被反复领奖）
    if (!this._d.shareSceneFlags) this._d.shareSceneFlags = {}
  }

  get shareTracking() { this._ensureShareTracking(); return this._d.shareTracking }

  /**
   * 记录一次分享并按规则发奖
   * @param {string} [sceneKey] 分享场景 key（对应 SHARE_SCENES）；未传则只结算 daily / firstEver
   * @param {object} [opts] { mode: 'friend'|'timeline' }
   * @returns {object|null} 发奖详情 { stamina, soulStone, fragment }，无奖则 null
   *
   * 口径与 shareRewardCalc.computeShareReward 完全一致 —— 预览与入账共用一个事实源。
   * 这里只负责：
   *   1) 从 computeShareReward 拿到 parts 明细（已决定每部分发多少）
   *   2) 把 flag / counter / 资源实际落到存档
   *   3) 聚合 merged 作为返回值，供调用方展示 toast / 飞行动画
   */
  recordShare(sceneKey, opts) {
    this._ensureShareTracking()
    const { computeShareReward } = require('./shareRewardCalc')
    const calc = computeShareReward(this, sceneKey)
    const { parts, meta, merged } = calc
    const st = this._d.shareTracking

    // 每日基础奖：只在 allowed 时增加 rewardCount，与 computeShareReward 的判定对齐
    if (meta.dailyAllowed) {
      st.rewardCount = (st.rewardCount || 0) + 1
      if (parts.daily.stamina) {
        this.noticeStaminaOverflow(this.addBonusStamina(parts.daily.stamina))
      }
      if (parts.daily.soulStone) this.addSoulStone(parts.daily.soulStone)
      if (parts.daily.fragment)  this.addUniversalFragment(parts.daily.fragment)
    }

    // 首次永久奖：入账并翻 firstEverDone
    if (meta.firstEverAllowed) {
      st.firstEverDone = true
      if (parts.firstEver.stamina) {
        this.noticeStaminaOverflow(this.addBonusStamina(parts.firstEver.stamina))
      }
      if (parts.firstEver.soulStone) this.addSoulStone(parts.firstEver.soulStone)
      if (parts.firstEver.fragment)  this.addUniversalFragment(parts.firstEver.fragment)
    }

    // 场景奖：入账并写 flag（sceneOnce / 24h 冷却的封禁都由 computeShareReward 决定允许与否）
    if (meta.sceneAllowed && sceneKey) {
      this._d.shareSceneFlags[sceneKey] = Date.now()
      if (parts.scene.stamina) {
        this.noticeStaminaOverflow(this.addBonusStamina(parts.scene.stamina))
      }
      if (parts.scene.soulStone) this.addSoulStone(parts.scene.soulStone)
      if (parts.scene.fragment)  this.addUniversalFragment(parts.scene.fragment)
    }

    this.addDailyTaskProgress('share_1', 1)
    this._save()

    void opts // 预留埋点/朋友圈差异化

    const hasReward = merged.stamina > 0 || merged.soulStone > 0 || merged.fragment > 0
    return hasReward ? merged : null
  }

  // ===== 回归检测 =====

  checkComeback() {
    const now = Date.now()
    const last = this._d.lastActiveDate
    this._d.lastActiveDate = localDateKey()
    if (!last) { this._save(); return false }
    const lastTs = new Date(last + 'T00:00:00').getTime()
    const { COMEBACK_THRESHOLD_MS, COMEBACK_REWARD } = require('./giftConfig')
    if (now - lastTs < COMEBACK_THRESHOLD_MS) { this._save(); return false }
    if (COMEBACK_REWARD.staminaFull) { this._recoverStamina(); this._d.stamina.current = this._d.stamina.max }
    if (COMEBACK_REWARD.soulStone) this.addSoulStone(COMEBACK_REWARD.soulStone)
    this._save()
    return true
  }

  updateActiveDate() {
    this._d.lastActiveDate = localDateKey()
    this._save()
  }

  // ===== 邀请系统 =====

  /**
   * 新玩家处理邀请 inviter
   *   1. 本地发 INVITE_REWARD.soulStone 给新玩家（保留老逻辑）
   *   2. 记录 inviterId 到 _d.pendingInviteReport，由 main.js 异步通过 xiaochu-api 上报云端
   *      （不在 storage 里直接发请求，保持 storage 不依赖平台层）
   */
  processInvite(inviterId) {
    if (!inviterId) return false
    if (this._d.invitedBy) return false
    const { INVITE_REWARD } = require('./giftConfig')
    this._d.invitedBy = inviterId
    if (INVITE_REWARD.soulStone) this.addSoulStone(INVITE_REWARD.soulStone)
    // 标记待上报：由 cloudSync / main.js 调 xiaochu-api /share/recordInvite
    this._d.pendingInviteReport = inviterId
    this._save()
    return true
  }

  // ===== 邀请方（老玩家）收到被邀请成功的反奖 =====
  //   当 xiaochu-api /share/claimInvites 返回 count > 0 时，客户端调用此方法入账
  //   每人发 INVITE_REWARD.soulStone；上限由 INVITE_MAX_COUNT 控制
  grantInviterReward(newInviteCount) {
    if (!newInviteCount || newInviteCount <= 0) return null
    const { INVITE_REWARD, INVITE_MAX_COUNT } = require('./giftConfig')
    const current = this._d.inviteGrantedCount || 0
    const allowed = Math.max(0, Math.min(newInviteCount, (INVITE_MAX_COUNT || 10) - current))
    if (allowed <= 0) return null
    this._d.inviteGrantedCount = current + allowed
    const soulStone = (INVITE_REWARD.soulStone || 0) * allowed
    if (soulStone) this.addSoulStone(soulStone)
    this._save()
    return { count: allowed, soulStone }
  }

  // 访问器：供 main.js 判断是否需要上报 / 已领取计数
  getPendingInviteReport() { return this._d.pendingInviteReport || null }
  clearPendingInviteReport() {
    if (this._d.pendingInviteReport) {
      this._d.pendingInviteReport = null
      this._save()
    }
  }
  get inviteGrantedCount() { return this._d.inviteGrantedCount || 0 }

  // ===== 固定关卡记录 =====

  /** 根据已通关记录推算玩家当前所在章节（1-5），用于经济体系缩放 */
  get currentChapter() {
    const rec = this._d.stageClearRecord || {}
    let maxCh = 1
    for (const sid of Object.keys(rec)) {
      if (rec[sid] && rec[sid].cleared) {
        const m = sid.match(/^stage_(\d+)_/)
        if (m) { const ch = parseInt(m[1], 10); if (ch > maxCh) maxCh = ch }
      }
    }
    return Math.min(maxCh, 12)
  }

  get stageClearRecord() {
    return this._d.stageClearRecord || (this._d.stageClearRecord = {})
  }

  isStageCleared(stageId) {
    return !!(this._d.stageClearRecord && this._d.stageClearRecord[stageId] && this._d.stageClearRecord[stageId].cleared)
  }

  getStageBestRating(stageId) {
    return (this._d.stageClearRecord && this._d.stageClearRecord[stageId] && this._d.stageClearRecord[stageId].bestRating) || null
  }

  /** 指定关卡累计通关次数（重复刷关每次 +1） */
  getStageClearCount(stageId) {
    return (this._d.stageClearRecord && this._d.stageClearRecord[stageId] && this._d.stageClearRecord[stageId].clearCount) || 0
  }

  recordStageClear(stageId, rating, isFirst) {
    const RATING_ORDER = { B: 1, A: 2, S: 3 }
    const record = this._d.stageClearRecord || (this._d.stageClearRecord = {})
    if (!record[stageId]) record[stageId] = { cleared: false, bestRating: null, clearCount: 0, starsClaimed: [false, false, false] }
    const r = record[stageId]
    r.cleared = true
    r.clearCount++
    if (!r.bestRating || RATING_ORDER[rating] > RATING_ORDER[r.bestRating]) {
      r.bestRating = rating
    }
    if (!r.starsClaimed) r.starsClaimed = [false, false, false]
    this._save()
  }

  // ===== 星级奖励领取 =====

  getStageStarsClaimed(stageId) {
    const r = this._d.stageClearRecord && this._d.stageClearRecord[stageId]
    return (r && r.starsClaimed) || [false, false, false]
  }

  claimStageStar(stageId, starIndex) {
    const record = this._d.stageClearRecord || (this._d.stageClearRecord = {})
    if (!record[stageId]) record[stageId] = { cleared: false, bestRating: null, clearCount: 0, starsClaimed: [false, false, false] }
    if (!record[stageId].starsClaimed) record[stageId].starsClaimed = [false, false, false]
    record[stageId].starsClaimed[starIndex] = true
    this._save()
  }

  // ===== 章节通关宝箱 =====

  isChapterClearClaimed(chapterId) {
    const m = this._d.chapterClearClaimed || {}
    return !!m[chapterId]
  }

  claimChapterClear(chapterId) {
    if (!this._d.chapterClearClaimed) this._d.chapterClearClaimed = {}
    this._d.chapterClearClaimed[chapterId] = true
    this._save()
  }

  getChapterTotalStars(chapterId, difficulty) {
    const RATING_TO_STARS = { S: 3, A: 2, B: 1 }
    const { getChapterStages } = require('./stages')
    const stages = getChapterStages(chapterId, difficulty || 'normal')
    let total = 0
    for (const s of stages) {
      const best = this.getStageBestRating(s.id)
      total += RATING_TO_STARS[best] || 0
    }
    return total
  }

  // ===== 章节里程碑（8★/16★/24★） =====

  /** 某章某档是否已领取 */
  isChapterMilestoneClaimed(chapterId, tier) {
    const m = this._d.chapterStarMilestones || {}
    return !!(m[chapterId] && m[chapterId][tier])
  }

  /** 标记某章某档为已领（仅写存档，不下发奖励；奖励由 settleStage 统一发） */
  markChapterMilestoneClaimed(chapterId, tier) {
    if (!this._d.chapterStarMilestones) this._d.chapterStarMilestones = {}
    if (!this._d.chapterStarMilestones[chapterId]) this._d.chapterStarMilestones[chapterId] = {}
    this._d.chapterStarMilestones[chapterId][tier] = true
    this._save()
  }

  /** 返回某章已领取的档位数组（用于 UI 展示槽位状态） */
  getChapterMilestoneClaimed(chapterId) {
    const m = (this._d.chapterStarMilestones && this._d.chapterStarMilestones[chapterId]) || {}
    return { 8: !!m[8], 16: !!m[16], 24: !!m[24] }
  }

  // ===== 章节徽章 =====

  isChapterBadgeUnlocked(chapterId) {
    const m = this._d.chapterBadges || {}
    return !!m[chapterId]
  }

  unlockChapterBadge(chapterId) {
    if (!this._d.chapterBadges) this._d.chapterBadges = {}
    if (this._d.chapterBadges[chapterId]) return false
    this._d.chapterBadges[chapterId] = true
    this._save()
    return true
  }

  /** 返回已解锁的章节 id 数组（用于成就页 / 章节主线页展示） */
  getUnlockedChapterBadges() {
    const m = this._d.chapterBadges || {}
    return Object.keys(m).filter(k => m[k]).map(k => Number(k))
  }

  // ===== SSR 法宝定向保底券 =====

  get weaponWildcardTickets() {
    return this._d.weaponWildcardTickets || 0
  }

  /** 增加保底券（里程碑 24★ 档发放） */
  addWeaponWildcardTickets(n) {
    if (!n || n <= 0) return
    if (typeof this._d.weaponWildcardTickets !== 'number') this._d.weaponWildcardTickets = 0
    this._d.weaponWildcardTickets += n
    this._save()
  }

  /**
   * 使用一张保底券兑换指定 SSR 法宝
   * @returns {boolean} 成功返回 true；余额不足或法宝已拥有返回 false
   */
  useWeaponWildcardTicket(weaponId) {
    const { getWeaponById, getWeaponRarity } = require('./weapons')
    const w = getWeaponById(weaponId)
    if (!w) return false
    if ((getWeaponRarity(weaponId) || 'R') !== 'SSR') return false
    if (this.hasWeapon(weaponId)) return false
    if ((this._d.weaponWildcardTickets || 0) <= 0) return false
    this._d.weaponWildcardTickets -= 1
    const added = this.addWeapon(weaponId)
    // addWeapon 内部会 _save，这里保险再 _save 一次
    this._save()
    return added
  }

  // ===== 秘境排行统计 =====

  getStageTotalStars() {
    const RATING_TO_STARS = { S: 3, A: 2, B: 1 }
    const rec = this._d.stageClearRecord || {}
    let total = 0
    for (const id of Object.keys(rec)) {
      if (rec[id].cleared) total += RATING_TO_STARS[rec[id].bestRating] || 0
    }
    return total
  }

  /** 已至少通关过的普通关数量（每关最多计 1，不含精英关） */
  getClearedNormalStageDistinctCount() {
    const rec = this._d.stageClearRecord || {}
    let count = 0
    for (const id of Object.keys(rec)) {
      if (rec[id].cleared && !id.endsWith('_elite')) count++
    }
    return count
  }

  getStageEliteClearCount() {
    const rec = this._d.stageClearRecord || {}
    let count = 0
    for (const id of Object.keys(rec)) {
      if (rec[id].cleared && id.endsWith('_elite')) count++
    }
    return count
  }

  getFarthestChapter() {
    const rec = this._d.stageClearRecord || {}
    let max = 0
    for (const id of Object.keys(rec)) {
      if (!rec[id].cleared) continue
      const m = id.match(/^stage_(\d+)_/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max
  }

  /**
   * 已通关关卡中，按章节/关卡序号最远的一关（用于排行展示，不暴露总关卡数）
   * @param {boolean} elite true=精英 stage_*_*_elite，false=普通 stage_*_*
   * @returns {{ chapter: number, order: number } | null}
   */
  getFarthestClearedStageCoords(elite) {
    const rec = this._d.stageClearRecord || {}
    let bestCh = 0
    let bestOrd = 0
    const re = elite ? /^stage_(\d+)_(\d+)_elite$/ : /^stage_(\d+)_(\d+)$/
    for (const id of Object.keys(rec)) {
      if (!rec[id].cleared) continue
      if (elite !== !!id.endsWith('_elite')) continue
      const m = id.match(re)
      if (!m) continue
      const ch = parseInt(m[1], 10)
      const ord = parseInt(m[2], 10)
      if (ch > bestCh || (ch === bestCh && ord > bestOrd)) {
        bestCh = ch
        bestOrd = ord
      }
    }
    if (bestCh === 0) return null
    return { chapter: bestCh, order: bestOrd }
  }

  // ===== 每日挑战次数 =====

  _refreshDailyChallenges() {
    const today = localDateKey()
    if (!this._d.dailyChallenges || this._d.dailyChallenges.date !== today) {
      this._d.dailyChallenges = { date: today, counts: {} }
    }
  }

  canChallengeStage(stageId, dailyLimit) {
    if (!dailyLimit) return true
    this._refreshDailyChallenges()
    const counts = this._d.dailyChallenges.counts
    return (counts[stageId] || 0) < dailyLimit
  }

  getStageDailyCount(stageId) {
    this._refreshDailyChallenges()
    return this._d.dailyChallenges.counts[stageId] || 0
  }

  recordStageChallenge(stageId) {
    this._refreshDailyChallenges()
    const counts = this._d.dailyChallenges.counts
    counts[stageId] = (counts[stageId] || 0) + 1
    this._save()
  }

  // ===== 通天塔每日次数 =====

  _refreshTowerDaily() {
    const today = localDateKey()
    if (!this._d.towerDaily || this._d.towerDaily.date !== today) {
      this._d.towerDaily = { date: today, runs: 0, adRuns: 0 }
    }
  }

  getTowerDailyRuns() {
    this._refreshTowerDaily()
    return this._d.towerDaily.runs
  }

  getTowerDailyAdRuns() {
    this._refreshTowerDaily()
    return this._d.towerDaily.adRuns
  }

  canStartTowerRun() {
    const { TOWER_DAILY } = require('./economyConfig')
    this._refreshTowerDaily()
    const td = this._d.towerDaily
    return (td.runs < TOWER_DAILY.freeRuns) || (td.adRuns < TOWER_DAILY.adExtraRuns)
  }

  canStartTowerRunFree() {
    const { TOWER_DAILY } = require('./economyConfig')
    this._refreshTowerDaily()
    return this._d.towerDaily.runs < TOWER_DAILY.freeRuns
  }

  recordTowerRun() {
    this._refreshTowerDaily()
    this._d.towerDaily.runs++
    this._save()
  }

  recordTowerAdRun() {
    this._refreshTowerDaily()
    this._d.towerDaily.adRuns++
    this._save()
  }

  // ===== 通天塔活动赛季 =====

  /**
   * 确保 towerEvent 与当前赛季同步；赛季切换时重置 claimed
   */
  _refreshTowerEvent() {
    const { getCurrentSeasonIndex } = require('./towerEvent')
    const idx = getCurrentSeasonIndex()
    const te = this._d.towerEvent
    if (!te || te.seasonIndex !== idx) {
      this._d.towerEvent = { seasonIndex: idx, claimed: [] }
    }
  }

  getTowerEventState() {
    this._refreshTowerEvent()
    return this._d.towerEvent
  }

  isTowerMilestoneClaimed(floor) {
    this._refreshTowerEvent()
    return (this._d.towerEvent.claimed || []).includes(floor)
  }

  claimTowerMilestone(floor) {
    this._refreshTowerEvent()
    if (!this._d.towerEvent.claimed.includes(floor)) {
      this._d.towerEvent.claimed.push(floor)
      this._save()
    }
  }

  // ===== 天机试炼 =====

  _defaultTrialState(seasonId) {
    return {
      seasonId: seasonId || '',
      seasonScore: 0,
      bestScore: 0,
      bestFloor: 0,
      bestRun: null,
      claimed: [],
      daily: { date: '', runs: 0, firstHalfUsed: false, bestScore: 0, bestFloor: 0, questDone: {} },
    }
  }

  _refreshTrial(seasonId) {
    const sid = seasonId || (require('./trialSeason').getCurrentTrialSeason().id)
    if (!this._d.trial || this._d.trial.seasonId !== sid) {
      this._d.trial = this._defaultTrialState(sid)
      this._clearSavedTrialRunInMemory()
    }
    const today = localDateKey()
    if (!this._d.trial.daily || this._d.trial.daily.date !== today) {
      this._d.trial.daily = { date: today, runs: 0, firstHalfUsed: false, bestScore: 0, bestFloor: 0, questDone: {} }
      this._clearSavedTrialRunInMemory()
    }
    if (typeof this._d.trial.seasonScore !== 'number') this._d.trial.seasonScore = 0
    if (typeof this._d.trial.daily.bestScore !== 'number') this._d.trial.daily.bestScore = 0
    if (typeof this._d.trial.daily.bestFloor !== 'number') this._d.trial.daily.bestFloor = 0
    if (!this._d.trial.daily.questDone) this._d.trial.daily.questDone = {}
    if (!Array.isArray(this._d.trial.claimed)) this._d.trial.claimed = []
    return this._d.trial
  }

  getTrialState(seasonId) {
    return this._refreshTrial(seasonId)
  }

  isTrialUnlocked() {
    const season = require('./trialSeason').getCurrentTrialSeason()
    return this.isStageCleared(season.unlockStageId)
  }

  isTrialFirstRunToday(seasonId) {
    const st = this._refreshTrial(seasonId)
    return !st.daily.firstHalfUsed && (st.daily.runs || 0) === 0
  }

  startTrialRun(seasonId) {
    const trialSeason = require('./trialSeason')
    const season = trialSeason.getCurrentTrialSeason()
    const sid = seasonId || season.id
    if (!this.isTrialUnlocked()) return { ok: false, reason: 'locked' }
    const cost = trialSeason.getTrialStaminaCost(this)
    if (!this.consumeStamina(cost)) return { ok: false, reason: 'stamina', cost }
    const st = this._refreshTrial(sid)
    st.daily.runs = (st.daily.runs || 0) + 1
    if (cost === season.firstDailyStaminaCost) st.daily.firstHalfUsed = true
    this.addDailyTaskProgress('trial_1', 1)
    this._save()
    return { ok: true, cost }
  }

  startTrialContinueRun(seasonId) {
    const trialSeason = require('./trialSeason')
    const season = trialSeason.getCurrentTrialSeason()
    const sid = seasonId || season.id
    if (!this.isTrialUnlocked()) return { ok: false, reason: 'locked' }
    const cost = trialSeason.getTrialStaminaCost(this)
    if (!this.consumeStamina(cost)) return { ok: false, reason: 'stamina', cost }
    const st = this._refreshTrial(sid)
    st.daily.runs = (st.daily.runs || 0) + 1
    if (cost === season.firstDailyStaminaCost) st.daily.firstHalfUsed = true
    this.addDailyTaskProgress('trial_1', 1)
    this._save()
    return { ok: true, cost }
  }

  grantTrialRewards(tiers) {
    const granted = []
    const trialSeason = require('./trialSeason')
    const trialAttrs = (trialSeason.getDailyAttrTheme().enemyAttrs || []).filter(Boolean)
    for (const tier of tiers || []) {
      for (const reward of tier.rewards || []) {
        const item = { ...reward }
        if (reward.type === 'soulStone') this.addSoulStone(reward.count || 0)
        else if (reward.type === 'universalFragment') this.addUniversalFragment(reward.count || 0)
        else if (reward.type === 'awakenStone') this.addAwakenStone(reward.count || 0)
        else if (reward.type === 'randomFragment') {
          const got = this.addRandomFragmentsByAttrs(reward.count || 0, trialAttrs)
          item.attrs = trialAttrs.slice()
          item.petId = got && got.petId
          item.attr = got && got.attr
        } else if (reward.type === 'weapon') {
          item.isNew = this.addWeapon(reward.id)
          if (!item.isNew) {
            item.duplicateSoulStone = 500
            this.addSoulStone(item.duplicateSoulStone)
          }
        }
        granted.push(item)
      }
    }
    return granted
  }

  grantTrialRunFragmentReward(result) {
    const trialSeason = require('./trialSeason')
    const passedFloor = Math.max(0, (result && result.floor) || 0)
    const reward = trialSeason.calcTrialRunFragmentReward(passedFloor)
    if (!reward || !reward.count) return []
    const trialAttrs = (trialSeason.getDailyAttrTheme().enemyAttrs || []).filter(Boolean)
    const item = { ...reward, attrs: trialAttrs.slice() }
    const got = this.addRandomFragmentsByAttrs(reward.count || 0, trialAttrs)
    item.petId = got && got.petId
    item.attr = got && got.attr
    return [item]
  }

  settleTrialRun(seasonId, result) {
    const trialSeason = require('./trialSeason')
    const st = this._refreshTrial(seasonId)
    const score = (result && result.score) || 0
    const scoreParts = (result && result.scoreParts) || {}
    const battleScore = Math.max(0, score - (scoreParts.dailyQuest || 0))
    const prevDailyBest = st.daily.bestScore || 0
    const battleScoreAdded = Math.max(0, battleScore - prevDailyBest)
    if (battleScoreAdded > 0) {
      st.daily.bestScore = battleScore
    }
    const reachedFloor = (result && result.floor) || 0
    if (reachedFloor > (st.daily.bestFloor || 0)) {
      st.daily.bestFloor = reachedFloor
    }
    let questScoreAdded = 0
    st.daily.questDone = st.daily.questDone || {}
    for (const quest of (result && result.dailyQuestResults) || []) {
      if (quest && quest.done && !st.daily.questDone[quest.id]) {
        st.daily.questDone[quest.id] = true
        questScoreAdded += quest.score || 0
      }
    }
    const scoreAdded = battleScoreAdded + questScoreAdded
    if (scoreAdded > 0) {
      st.seasonScore = (st.seasonScore || 0) + scoreAdded
    }
    if (score > (st.bestScore || 0)) {
      st.bestScore = score
      st.bestFloor = reachedFloor
      st.bestRun = result
    }
    const tiers = trialSeason.getClaimableTrialRewards(st.seasonScore || 0, st.claimed)
    for (const tier of tiers) st.claimed.push(tier.score)
    this._save()
    const rewards = this.grantTrialRunFragmentReward(result).concat(this.grantTrialRewards(tiers))
    return { tiers, rewards, bestScore: st.bestScore, seasonScore: st.seasonScore || 0, scoreAdded }
  }

  // ===== 持久化编队 =====

  get savedStageTeam() {
    return this._d.savedStageTeam || []
  }

  /** 保存编队：保留顺序，可多属性重复；过滤不在池中的 ID、同一只灵宠不重复入队 */
  saveStageteam(teamIds) {
    const poolIds = new Set((this._d.petPool || []).map(p => p.id))
    const seen = new Set()
    const out = []
    for (const id of teamIds || []) {
      if (!id || !poolIds.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
    this._d.savedStageTeam = out
    this._save()
  }

  /** 获取有效的已保存编队（排除已不在池中的、非法重复 ID） */
  getValidSavedTeam() {
    const saved = this._d.savedStageTeam || []
    if (saved.length === 0) return []
    const poolIds = new Set((this._d.petPool || []).map(p => p.id))
    const seen = new Set()
    const out = []
    for (const id of saved) {
      if (!poolIds.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
    const same = out.length === saved.length && out.every((id, i) => id === saved[i])
    if (!same) {
      this._d.savedStageTeam = out
      this._save()
    }
    return out
  }

  // ===== 预设编队（秘境/塔共用；灵宠 + 法宝一键整套切换） =====
  // 设计要点：
  //   · teamPresets 是"收藏夹"，只在玩家主动「保存 / 切换 / 重命名」时改
  //   · savedStageTeam + equippedWeaponId 是"当前编队"，战斗引擎读这两份
  //   · 胜利结算继续只写 savedStageTeam，不污染预设；玩家临时微调阵容后，
  //     如果想存进预设需要主动点"保存到预设"。这样避免"不小心多练一局就覆盖"。

  /** 预设编队只读数组（含 locked 标记供 UI 用；按槽位顺序返回） */
  getTeamPresetsForView() {
    ensureTeamPresets(this._d)
    const unlocked = this._d.teamPresetSlotUnlocked || 0
    return this._d.teamPresets.map((p, idx) => ({
      id: p.id,
      name: p.name,
      petIds: (p.petIds || []).slice(),
      weaponId: p.weaponId || null,
      lastUsedAt: p.lastUsedAt || 0,
      locked: idx >= unlocked,
      isActive: p.id === this._d.teamPresetActiveId,
    }))
  }

  /** 已解锁槽位数 */
  get teamPresetSlotUnlocked() {
    ensureTeamPresets(this._d)
    return this._d.teamPresetSlotUnlocked
  }

  /** 当前激活预设 id */
  get teamPresetActiveId() {
    ensureTeamPresets(this._d)
    return this._d.teamPresetActiveId
  }

  /** 内部：按 id 找到预设槽位索引；找不到返回 -1 */
  _findPresetIdx(id) {
    const presets = this._d.teamPresets || []
    for (let i = 0; i < presets.length; i++) {
      if (presets[i].id === id) return i
    }
    return -1
  }

  /** 读预设（含合法化：剔除不在池中的宠物、重复宠物；法宝若未拥有则清空） */
  getTeamPreset(id) {
    ensureTeamPresets(this._d)
    const idx = this._findPresetIdx(id)
    if (idx < 0) return null
    const p = this._d.teamPresets[idx]
    const poolIds = new Set((this._d.petPool || []).map(pp => pp.id))
    const seen = new Set()
    const petIds = []
    for (const pid of p.petIds || []) {
      if (!pid || !poolIds.has(pid) || seen.has(pid)) continue
      seen.add(pid)
      petIds.push(pid)
    }
    let weaponId = p.weaponId || null
    if (weaponId && !(this._d.weaponCollection || []).includes(weaponId)) weaponId = null
    return { id: p.id, name: p.name, petIds, weaponId, lastUsedAt: p.lastUsedAt || 0, locked: idx >= (this._d.teamPresetSlotUnlocked || 0) }
  }

  /**
   * 把指定预设应用为"当前编队"：
   *   · 同步 savedStageTeam / equippedWeaponId
   *   · 更新 teamPresetActiveId + lastUsedAt
   *   · 自动合法化（池内、去重、法宝已拥有）
   *   · 锁定槽位不可应用（返回 null）
   *   · **空预设**：仅更新 activeId，不清空当前编队 / 不换装备——避免"点了空 tab，
   *     屏幕上精心调好的阵容一键清零"的糟糕体感。空预设通常和"保存"配合：
   *     切过去 + 点保存 = 把当前队伍存进去。
   * 返回实际应用到战斗的数据或 null。
   */
  applyTeamPreset(id) {
    ensureTeamPresets(this._d)
    const idx = this._findPresetIdx(id)
    if (idx < 0) return null
    if (idx >= (this._d.teamPresetSlotUnlocked || 0)) return null
    const valid = this.getTeamPreset(id)
    if (!valid) return null
    if (valid.petIds.length === 0) {
      this._d.teamPresetActiveId = id
      this._save()
      return valid
    }
    this._d.savedStageTeam = valid.petIds.slice()
    this._d.equippedWeaponId = valid.weaponId || null
    this._d.teamPresetActiveId = id
    this._d.teamPresets[idx].lastUsedAt = gmNow()
    this._save()
    return valid
  }

  /**
   * 根据阵容属性分布生成"智能默认名"
   *   · 全空：null（调用方用 "预设 N" 兜底）
   *   · 单属性：金系队 / 木系队 / …
   *   · 双属性：按数量主次拼接，如"金火队"
   *   · 三属性或更多（非全五）：取前两主属性 + "混队"，如"金水混队"
   *   · 五属性：五行齐队
   * 这样玩家不手动改名也能一眼看出每套预设的定位。
   */
  _computeSmartPresetName(petIds) {
    if (!Array.isArray(petIds) || petIds.length === 0) return null
    const ATTR_CN = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
    const pool = this._d.petPool || []
    const byId = new Map(pool.map(p => [p.id, p]))
    const counts = {}
    for (const pid of petIds) {
      const pp = byId.get(pid)
      if (!pp || !pp.attr) continue
      counts[pp.attr] = (counts[pp.attr] || 0) + 1
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (sorted.length === 0) return null
    if (sorted.length === 1) return ATTR_CN[sorted[0][0]] + '系队'
    if (sorted.length >= 5) return '五行齐队'
    if (sorted.length === 2) return sorted.map(s => ATTR_CN[s[0]]).join('') + '队'
    return sorted.slice(0, 2).map(s => ATTR_CN[s[0]]).join('') + '混队'
  }

  /**
   * 把当前编队（savedStageTeam + equippedWeaponId）保存到指定预设槽位
   *   · 锁定槽位不可写（返回 false）
   *   · 当前编队为空也不让保存（返回 false；调用方给 toast 提示"先选几只"）
   *   · 同步把 teamPresetActiveId 切到该槽位：玩家刚保存完，很可能就想"就用它"
   *   · 自动重命名（基于阵容属性），玩家无需手动改名。若未来加 rename UI，
   *     可通过 preset.nameCustomized = true 跳过覆盖；一期默认总是自动命名。
   */
  saveCurrentToPreset(id) {
    ensureTeamPresets(this._d)
    const idx = this._findPresetIdx(id)
    if (idx < 0) return false
    if (idx >= (this._d.teamPresetSlotUnlocked || 0)) return false
    const saved = this.getValidSavedTeam()
    if (saved.length === 0) return false
    const preset = this._d.teamPresets[idx]
    preset.petIds = saved.slice()
    preset.weaponId = this._d.equippedWeaponId || null
    preset.lastUsedAt = gmNow()
    // 自动命名：玩家没手动改过名时覆盖为智能名
    if (!preset.nameCustomized) {
      const smart = this._computeSmartPresetName(preset.petIds)
      preset.name = smart || `预设 ${idx + 1}`
    }
    this._d.teamPresetActiveId = id
    this._save()
    return true
  }

  /**
   * 重命名预设。空串/全空白视为恢复默认，自动重新走一次智能命名（或"预设 N"）。
   * 超过 TEAM_PRESET_NAME_MAX_LEN 的部分切断（UI 防挤占）。
   * 玩家一旦手动改名 → nameCustomized=true，后续 saveCurrentToPreset 不再覆盖；
   * 清空恢复默认则重新回到"自动跟随阵容命名"状态。
   */
  renameTeamPreset(id, name) {
    ensureTeamPresets(this._d)
    const { TEAM_PRESET_NAME_MAX_LEN } = require('./constants')
    const idx = this._findPresetIdx(id)
    if (idx < 0) return false
    const raw = (name || '').trim()
    const preset = this._d.teamPresets[idx]
    if (!raw) {
      const smart = this._computeSmartPresetName(preset.petIds)
      preset.name = smart || `预设 ${idx + 1}`
      preset.nameCustomized = false
    } else {
      preset.name = raw.slice(0, TEAM_PRESET_NAME_MAX_LEN)
      preset.nameCustomized = true
    }
    this._save()
    return true
  }

  /**
   * 解锁下一个预设槽位（看广告成功后调用）。
   * 返回解锁后的槽位数；已到上限则返回 null。
   */
  unlockNextTeamPresetSlot() {
    ensureTeamPresets(this._d)
    const { TEAM_PRESET_MAX } = require('./constants')
    const cur = this._d.teamPresetSlotUnlocked || 0
    if (cur >= TEAM_PRESET_MAX) return null
    this._d.teamPresetSlotUnlocked = cur + 1
    this._save()
    return this._d.teamPresetSlotUnlocked
  }

  // ===== 灵宠派遣（挂机）系统 =====

  get idleDispatch() { return this._d.idleDispatch || (this._d.idleDispatch = { slots: [], lastCollect: 0 }) }

  /** 派遣一只宠物（添加到槽位） */
  idleAssign(petId) {
    const { IDLE_MAX_SLOTS } = require('./petPoolConfig')
    const dispatch = this.idleDispatch
    if (dispatch.slots.length >= IDLE_MAX_SLOTS) return false
    if (dispatch.slots.find(s => s.petId === petId)) return false
    const pool = this._d.petPool || []
    if (!pool.find(p => p.id === petId)) return false
    dispatch.slots.push({ petId, startTime: Date.now() })
    this.addDailyTaskProgress('idle_collect', 1)
    this._save()
    return true
  }

  /** 撤回一只派遣中的宠物 */
  idleRecall(petId) {
    const dispatch = this.idleDispatch
    const idx = dispatch.slots.findIndex(s => s.petId === petId)
    if (idx < 0) return false
    dispatch.slots.splice(idx, 1)
    this._save()
    return true
  }

  /** 检查是否有可收取的派遣产出 */
  idleHasReward() {
    const { IDLE_FRAG_INTERVAL } = require('./petPoolConfig')
    const dispatch = this.idleDispatch
    if (dispatch.slots.length === 0) return false
    const now = Date.now()
    return dispatch.slots.some(s => (now - s.startTime) >= IDLE_FRAG_INTERVAL)
  }

  /**
   * 收取所有派遣产出（碎片归各宠物，经验归共享池）
   * @returns {{ totalFragments: number, totalSoulStone: number, details: Array }} 产出明细
   */
  idleCollect() {
    const { calcIdleReward } = require('./petPoolConfig')
    const dispatch = this.idleDispatch
    if (dispatch.slots.length === 0) return null
    const now = Date.now()
    let totalFragments = 0, totalSoulStone = 0
    const details = []
    for (const slot of dispatch.slots) {
      const elapsed = now - slot.startTime
      const poolPet = (this._d.petPool || []).find(p => p.id === slot.petId)
      if (!poolPet) continue
      const reward = calcIdleReward(elapsed, poolPet.level)
      if (reward.fragments > 0) {
        poolPet.fragments = (poolPet.fragments || 0) + reward.fragments
        totalFragments += reward.fragments
      }
      if (reward.soulStone > 0) {
        totalSoulStone += reward.soulStone
      }
      details.push({ petId: slot.petId, fragments: reward.fragments, soulStone: reward.soulStone })
      slot.startTime = now
    }
    if (totalSoulStone > 0) {
      this._d.soulStone = (this._d.soulStone || 0) + totalSoulStone
    }
    dispatch.lastCollect = now
    this._save()
    return { totalFragments, totalSoulStone, details }
  }

  /** 获取当前派遣中的宠物ID列表 */
  get idleSlotPetIds() {
    return (this.idleDispatch.slots || []).map(s => s.petId)
  }

  // ===== 法宝背包 & 装备 =====

  get weaponCollection() {
    return this._d.weaponCollection || []
  }

  get equippedWeaponId() {
    return this._d.equippedWeaponId || null
  }

  addWeapon(weaponId) {
    if (!weaponId) return false
    if (!this._d.weaponCollection) this._d.weaponCollection = []
    if (!this._d.weaponCollection.includes(weaponId)) {
      const wasEmpty = this._d.weaponCollection.length === 0
      this._d.weaponCollection.push(weaponId)
      this._save()
      // 首件法宝：回首页后由 main 消费 _pendingGuide → weapon_nav_unlock（小灵指底栏）
      if (wasEmpty && !this.isGuideShown('weapon_nav_unlock') && !this.isGuideShown('weapon_equip')) {
        try {
          const gm = typeof GameGlobal !== 'undefined' && GameGlobal.__gameMain
          if (gm && !gm._pendingGuide) gm._pendingGuide = 'weapon_nav_unlock'
        } catch (_) {}
      }
      return true
    }
    return false
  }

  equipWeapon(weaponId) {
    if (weaponId && !this._d.weaponCollection.includes(weaponId)) return false
    this._d.equippedWeaponId = weaponId
    this._save()
    return true
  }

  unequipWeapon() {
    this._d.equippedWeaponId = null
    this._save()
  }

  hasWeapon(weaponId) {
    return (this._d.weaponCollection || []).includes(weaponId)
  }

  // ===== 碎片银行 =====

  /** 给碎片银行中某宠物加碎片 */
  addFragmentToBank(petId, count = 1) {
    this._ensureCultivationFields()
    if (!this._d.fragmentBank[petId]) this._d.fragmentBank[petId] = 0
    this._d.fragmentBank[petId] += count
    this._save()
  }

  /**
   * 智能添加碎片：已入池→直接加到宠物上，未入池→进银行
   */
  addFragmentSmart(petId, count = 1) {
    const pet = this.getPoolPet(petId)
    if (pet) {
      pet.fragments = (pet.fragments || 0) + count
      this._save()
    } else {
      this.addFragmentToBank(petId, count)
    }
  }

  /**
   * 按品质权重分配碎片给随机宠物（一次分配 count 片给同一只宠物）
   * @param {number} count
   * @param {object} [rarityWeights] - 缺省时使用 chestConfig.DEFAULT_RANDOM_FRAG_WEIGHTS
   * @returns {{ petId, count }}
   */
  addRandomFragments(count, rarityWeights) {
    const { rollPetByRarity } = require('./chestConfig')
    const petId = rollPetByRarity(rarityWeights)
    this.addFragmentSmart(petId, count)
    return { petId, count }
  }

  /**
   * 按指定属性池随机发放碎片，供属性主题活动使用。
   */
  addRandomFragmentsByAttrs(count, attrs, rarityWeights) {
    const { PETS, getPetRarity } = require('./pets')
    const { DEFAULT_RANDOM_FRAG_WEIGHTS } = require('./chestConfig')
    const attrList = (attrs || []).filter(attr => PETS[attr] && PETS[attr].length > 0)
    if (attrList.length === 0) return this.addRandomFragments(count, rarityWeights)
    const weights = rarityWeights || DEFAULT_RANDOM_FRAG_WEIGHTS
    const totalW = (weights.R || 0) + (weights.SR || 0) + (weights.SSR || 0)
    let rarity = 'R'
    if (totalW > 0) {
      const roll = Math.random() * totalW
      if (roll < (weights.SSR || 0)) rarity = 'SSR'
      else if (roll < (weights.SSR || 0) + (weights.SR || 0)) rarity = 'SR'
    }
    let candidates = attrList.flatMap(attr => PETS[attr].filter(p => getPetRarity(p.id) === rarity))
    if (candidates.length === 0) candidates = attrList.flatMap(attr => PETS[attr])
    const pet = candidates[Math.floor(Math.random() * candidates.length)]
    const petId = pet && pet.id
    if (!petId) return this.addRandomFragments(count, rarityWeights)
    this.addFragmentSmart(petId, count)
    return { petId, count, attr: pet.attr }
  }

  /** 获取碎片银行全部数据 */
  get fragmentBank() {
    this._ensureCultivationFields()
    return this._d.fragmentBank
  }

  /** 获取碎片银行中某宠物的碎片数 */
  getBankFragments(petId) {
    this._ensureCultivationFields()
    return this._d.fragmentBank[petId] || 0
  }

  // ===== 碎片召唤 =====

  /**
   * 用碎片银行的碎片召唤宠物
   * @returns {{ success, message }}
   */
  summonPet(petId) {
    const { SUMMON_FRAG_COST } = require('./chestConfig')
    const { getPetRarity } = require('./pets')

    this._ensureCultivationFields()
    const banked = this._d.fragmentBank[petId] || 0
    const rarity = getPetRarity(petId)
    const cost = SUMMON_FRAG_COST[rarity] || 15

    if (banked < cost) return { success: false, message: `碎片不足（需${cost}，有${banked}）` }
    if (this.getPoolPet(petId)) return { success: false, message: '已拥有该灵宠' }

    this._d.fragmentBank[petId] -= cost
    if (this._d.fragmentBank[petId] <= 0) delete this._d.fragmentBank[petId]

    this.addToPetPool(petId, 'summon')
    return { success: true, message: '召唤成功' }
  }

  // ===== 局内暂存（暂存退出用）=====
  _clearSavedTrialRunInMemory() {
    delete this._d.savedTrialRun
    if (this._d.savedRun && this._d.savedRun.mode === 'trial') delete this._d.savedRun
  }

  saveRunState(runState) {
    if (runState && runState.mode === 'trial') {
      this._d.savedTrialRun = { ...runState, trialDate: localDateKey() }
    }
    else this._d.savedRun = runState
    this._save()
  }

  loadRunState(mode) {
    if (mode === 'trial') {
      const saved = this._d.savedTrialRun || (this._d.savedRun && this._d.savedRun.mode === 'trial' ? this._d.savedRun : null)
      if (!saved) return null
      const today = localDateKey()
      const season = require('./trialSeason').getCurrentTrialSeason()
      const savedSeasonId = saved.trialRun && saved.trialRun.seasonId
      if ((saved.trialDate && saved.trialDate !== today) || (savedSeasonId && savedSeasonId !== season.id)) {
        this._clearSavedTrialRunInMemory()
        this._save()
        return null
      }
      return saved
    }
    return this._d.savedRun && this._d.savedRun.mode !== 'trial' ? this._d.savedRun : null
  }

  clearRunState(mode) {
    if (mode === 'trial') {
      this._clearSavedTrialRunInMemory()
      this._save()
      return
    }
    delete this._d.savedRun
    this._save()
  }

  hasSavedRun(mode) {
    if (mode === 'trial') return !!(this._d.savedTrialRun || (this._d.savedRun && this._d.savedRun.mode === 'trial'))
    return !!(this._d.savedRun && this._d.savedRun.mode !== 'trial')
  }

  // 彻底重置
  async resetAll() {
    this._d = defaultPersist()
    this._d.serverId = this.serverId
    _freshPersistDataVersion(this._d)
    try { P.removeStorageSync(this._localKey) } catch(e) {}
    this._save()
    if (cloudSync.isReady()) {
      try {
        await api.syncPlayerData(this._d)
      } catch(e) { console.warn('[Storage] 云端重置失败:', e) }
    }
    return true
  }

  // ===== 本地存储 =====
  _loadUserInfo() {
    try {
      const raw = P.getStorageSync('wxtower_userinfo')
      if (raw) {
        const info = JSON.parse(raw)
        // 验证数据有效性：过滤掉之前getUserProfile返回的无效默认值
        if (info && info.nickName && info.nickName !== '微信用户' && info.avatarUrl && info.avatarUrl.length > 10) {
          this.userInfo = info
          this.userAuthorized = true
          console.log('[Storage] 已加载用户信息:', info.nickName)
        } else {
          console.warn('[Storage] 缓存的用户信息无效，清除:', info)
          P.removeStorageSync('wxtower_userinfo')
          this.userInfo = null
          this.userAuthorized = false
        }
      }
    } catch(e) {
      console.warn('[Storage] 加载用户信息失败:', e)
    }
  }

  _saveUserInfo(info) {
    this.userInfo = info
    this.userAuthorized = true
    try { P.setStorageSync('wxtower_userinfo', JSON.stringify(info)) } catch(e) {}
  }

  // 微信用户信息授权（头像+昵称）
  // 小游戏必须通过 createUserInfoButton 获取真实头像昵称
  // 预创建透明按钮覆盖在排行按钮上，用户点击即触发授权
  // rect: { left, top, width, height } — 逻辑像素（CSS像素）
  showUserInfoBtn(rect, callback) {
    this.destroyUserInfoBtn()
    console.log('[UserInfoBtn] 开始创建, rect:', JSON.stringify(rect))
    try {
      const btn = P.createUserInfoButton({
        type: 'text',
        text: '',
        style: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: 'rgba(0,0,0,0)',
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
          borderRadius: 0,
          color: 'rgba(0,0,0,0)',
          fontSize: 1,
          textAlign: 'center',
          lineHeight: rect.height,
        },
        withCredentials: false,
      })
      console.log('[UserInfoBtn] 创建成功, btn:', !!btn)
      if (!btn) {
        if (callback) callback(false, null)
        return
      }
      this._userInfoBtn = btn
      this._userInfoBtnCallback = callback
      btn.onTap((res) => {
        console.log('[UserInfoBtn] onTap触发, res:', JSON.stringify(res))
        btn.destroy()
        this._userInfoBtn = null
        const cb = this._userInfoBtnCallback
        this._userInfoBtnCallback = null

        // 检查是否因隐私API未配置导致失败
        const errMsg = res.errMsg || ''
        if (errMsg.indexOf('no privacy api permission') !== -1 || res.err_code === -12034) {
          console.warn('[UserInfo] 隐私API未配置，需在公众平台配置用户隐私保护指引')
          // 隐私API未配置时直接放行进入排行榜
          if (cb) cb(false, null)
          return
        }

        if (res.userInfo && res.userInfo.nickName && res.userInfo.nickName !== '微信用户') {
          const info = {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl,
          }
          console.log('[UserInfoBtn] 获取到用户信息:', info.nickName, info.avatarUrl)
          this._saveUserInfo(info)
          if (cb) cb(true, info)
        } else if (res.errMsg && res.errMsg.indexOf('fail') !== -1) {
          // 用户拒绝授权 → 尝试引导去设置页
          console.warn('[UserInfo] 授权失败，尝试openSetting')
          this._tryOpenSetting(cb)
        } else {
          console.warn('[UserInfo] 未获取到有效信息，跳过')
          if (cb) cb(false, null)
        }
      })
    } catch(e) {
      console.warn('[UserInfo] createUserInfoButton失败:', e)
      if (callback) callback(false, null)
    }
  }

  /**
   * 从已授权状态拉取并校验昵称头像（与 _loadUserInfo 门槛一致，避免只存占位图）
   */
  _applyUserInfoFromGetUserInfoResult(infoRes, callback) {
    const u = infoRes && infoRes.userInfo
    if (u && u.nickName && u.nickName !== '微信用户' && u.avatarUrl && u.avatarUrl.length > 10) {
      const info = { nickName: u.nickName, avatarUrl: u.avatarUrl }
      this._saveUserInfo(info)
      if (callback) callback(true, info)
    } else {
      if (callback) callback(false, null)
    }
  }

  /**
   * 用户曾点「拒绝」后：WeChat 不会再弹系统授权，只能进设置或走页面黄条 createUserInfoButton
   */
  _showUserInfoOpenSettingModal(callback) {
    P.showModal({
      title: '授权提示',
      content: '好友榜与完整排行展示需要获取您的昵称和头像。若曾拒绝，请在微信设置中重新开启',
      confirmText: '去设置',
      cancelText: '暂不',
      success: (modalRes) => {
        if (!modalRes.confirm) {
          if (callback) callback(false, null)
          return
        }
        P.openSetting({
          success: (openRes) => {
            console.log('[UserInfo] openSetting result:', JSON.stringify(openRes.authSetting))
            if (openRes.authSetting['scope.userInfo']) {
              P.getUserInfo({
                withCredentials: false,
                success: (infoRes) => { this._applyUserInfoFromGetUserInfoResult(infoRes, callback) },
                fail: () => { if (callback) callback(false, null) },
              })
            } else {
              if (callback) callback(false, null)
            }
          },
          fail: () => { if (callback) callback(false, null) },
        })
      },
      fail: () => { if (callback) callback(false, null) },
    })
  }

  /**
   * 从未询问过（scope 为 undefined）：先试 wx.authorize，失败再与「已拒绝」同路径去设置
   */
  _tryAuthorizeUserInfoThenSetting(callback) {
    const base = typeof wx !== 'undefined' ? wx : null
    const fallback = () => { this._showUserInfoOpenSettingModal(callback) }
    if (base && typeof base.authorize === 'function') {
      try {
        base.authorize({
          scope: 'scope.userInfo',
          success: () => {
            P.getUserInfo({
              withCredentials: false,
              success: (infoRes) => {
                if (infoRes && infoRes.userInfo && infoRes.userInfo.nickName && infoRes.userInfo.nickName !== '微信用户') {
                  this._applyUserInfoFromGetUserInfoResult(infoRes, callback)
                } else {
                  fallback()
                }
              },
              fail: fallback,
            })
          },
          fail: fallback,
        })
      } catch (e) {
        console.warn('[UserInfo] authorize 不可用，改走设置页', e)
        fallback()
      }
    } else {
      fallback()
    }
  }

  // 引导用户到设置页开启 userInfo 授权
  _tryOpenSetting(callback) {
    P.getSetting({
      success: (settingRes) => {
        console.log('[UserInfo] getSetting:', JSON.stringify(settingRes.authSetting))
        const su = settingRes.authSetting && settingRes.authSetting['scope.userInfo']
        if (su === false) {
          this._showUserInfoOpenSettingModal(callback)
        } else if (su === true) {
          P.getUserInfo({
            withCredentials: false,
            success: (infoRes) => { this._applyUserInfoFromGetUserInfoResult(infoRes, callback) },
            fail: () => { if (callback) callback(false, null) },
          })
        } else {
          this._tryAuthorizeUserInfoThenSetting(callback)
        }
      },
      fail: () => { if (callback) callback(false, null) },
    })
  }

  /**
   * 排行页切到「好友」数据源时：未同意则每次给出引导（拒绝后 WeChat 不会自动再弹，由本处统一拉起设置/authorize）
   * @param {object} g Main 实例
   */
  promptFriendRankUserInfo(g) {
    if (!P.isWeChat || !g) return
    P.getSetting({
      success: (res) => {
        const su = res.authSetting && res.authSetting['scope.userInfo']
        if (su === true) {
          if (!this.needsRealNameCta()) return
          try { P.showToast && P.showToast({ title: '请轻触上方黄条完成授权', icon: 'none', duration: 2200 }) } catch (_) {}
          return
        }
        this._tryOpenSetting((ok) => {
          if (ok) {
            try {
              const snap = this._ranking && this._ranking.getContextSnapshot && this._ranking.getContextSnapshot()
              if (snap) {
                const fr = require('./friendRanking')
                fr.uploadScores(snap, { force: true })
              }
            } catch (e) { console.warn('[FriendRank] 授权后补传分数失败', e) }
            g._rankFriendForceRefresh = true
            g._dirty = true
          }
        })
      },
      fail: () => {},
    })
  }

  /**
   * 排行榜"换头像昵称"入口统一调用：根据平台分发
   *   · 微信：先尝试 getUserInfo 兜底，失败则引导设置页（_tryOpenSetting 已有完整级联）
   *   · 抖音：走 requestDouyinUserInfo
   * callback(ok, info) — ok 为真时 info 为 { nickName, avatarUrl }
   */
  requestRealNameAuth(callback) {
    const cb = callback || (() => {})
    if (P.isDouyin) {
      this.requestDouyinUserInfo(cb)
      return
    }
    const base = typeof wx !== 'undefined' ? wx : null
    if (!base || typeof base.getUserInfo !== 'function') {
      cb(false, null)
      return
    }
    base.getUserInfo({
      withCredentials: false,
      success: (res) => {
        const info = res && res.userInfo
        if (info && info.nickName && info.nickName !== '微信用户' && info.avatarUrl && info.avatarUrl.length > 10) {
          this._saveUserInfo({ nickName: info.nickName, avatarUrl: info.avatarUrl })
          cb(true, this.userInfo)
        } else {
          // 拿不到真实昵称头像 → 走设置页级联引导
          this._tryOpenSetting(cb)
        }
      },
      fail: () => {
        this._tryOpenSetting(cb)
      },
    })
  }

  /**
   * 抖音端获取用户信息（通过 tt.getUserInfo）
   * 成功后更新 userInfo 和 userAuthorized
   */
  requestDouyinUserInfo(callback) {
    console.log('[Douyin] 尝试获取用户信息...')
    P.getUserInfo({
      withCredentials: false,
      success: (res) => {
        console.log('[Douyin] getUserInfo 返回:', JSON.stringify(res).slice(0, 300))
        if (res.userInfo && res.userInfo.nickName) {
          const info = {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl || '',
          }
          console.log('[Douyin] 获取用户信息成功:', info.nickName)
          this._saveUserInfo(info)
          if (callback) callback(true, info)
        } else {
          console.warn('[Douyin] getUserInfo 返回空信息')
          if (callback) callback(false)
        }
      },
      fail: (err) => {
        console.warn('[Douyin] getUserInfo 失败:', err.errMsg || err)
        if (callback) callback(false)
      },
    })
  }

  // 更新按钮位置（排行按钮位置可能因有无存档而变化）
  updateUserInfoBtnPos(rect) {
    if (!this._userInfoBtn) return
    try {
      this._userInfoBtn.style.left = rect.left
      this._userInfoBtn.style.top = rect.top
      this._userInfoBtn.style.width = rect.width
      this._userInfoBtn.style.height = rect.height
    } catch(e) {}
  }

  // 销毁授权按钮
  destroyUserInfoBtn() {
    if (this._userInfoBtn) {
      try { this._userInfoBtn.destroy() } catch(e) {}
      this._userInfoBtn = null
      this._userInfoBtnCallback = null
    }
  }

  // ===== 排行榜（委托 RankingService）=====

  get rankAllList() { return this._ranking.rankAllList }
  set rankAllList(v) { this._ranking.rankAllList = v }
  get rankAllWeeklyList() { return this._ranking.rankAllWeeklyList }
  set rankAllWeeklyList(v) { this._ranking.rankAllWeeklyList = v }
  get rankAllWeeklyPeriodKey() { return this._ranking.rankAllWeeklyPeriodKey }
  get rankDexList() { return this._ranking.rankDexList }
  set rankDexList(v) { this._ranking.rankDexList = v }
  get rankComboList() { return this._ranking.rankComboList }
  set rankComboList(v) { this._ranking.rankComboList = v }
  get rankStageList() { return this._ranking.rankStageList }
  set rankStageList(v) { this._ranking.rankStageList = v }
  get rankStageMyRank() { return this._ranking.rankStageMyRank }
  set rankStageMyRank(v) { this._ranking.rankStageMyRank = v }
  get rankAllMyRank() { return this._ranking.rankAllMyRank }
  set rankAllMyRank(v) { this._ranking.rankAllMyRank = v }
  get rankAllWeeklyMyRank() { return this._ranking.rankAllWeeklyMyRank }
  set rankAllWeeklyMyRank(v) { this._ranking.rankAllWeeklyMyRank = v }
  get rankDexMyRank() { return this._ranking.rankDexMyRank }
  set rankDexMyRank(v) { this._ranking.rankDexMyRank = v }
  get rankComboMyRank() { return this._ranking.rankComboMyRank }
  set rankComboMyRank(v) { this._ranking.rankComboMyRank = v }
  get rankLoading() { return this._ranking.rankLoading }
  set rankLoading(v) { this._ranking.rankLoading = v }
  get rankLoadingMsg() { return this._ranking.rankLoadingMsg }
  set rankLoadingMsg(v) { this._ranking.rankLoadingMsg = v }
  get rankLastFetch() { return this._ranking.rankLastFetch }
  set rankLastFetch(v) { this._ranking.rankLastFetch = v }
  get rankLastFetchTab() { return this._ranking.rankLastFetchTab }
  set rankLastFetchTab(v) { this._ranking.rankLastFetchTab = v }

  // ==== 档位榜（同境界）=====
  get rankStageTierList() { return this._ranking.rankStageTierList }
  set rankStageTierList(v) { this._ranking.rankStageTierList = v }
  get rankAllTierList() { return this._ranking.rankAllTierList }
  set rankAllTierList(v) { this._ranking.rankAllTierList = v }
  get rankAllWeeklyTierList() { return this._ranking.rankAllWeeklyTierList }
  set rankAllWeeklyTierList(v) { this._ranking.rankAllWeeklyTierList = v }
  get rankStageTierMyRank() { return this._ranking.rankStageTierMyRank }
  set rankStageTierMyRank(v) { this._ranking.rankStageTierMyRank = v }
  get rankAllTierMyRank() { return this._ranking.rankAllTierMyRank }
  set rankAllTierMyRank(v) { this._ranking.rankAllTierMyRank = v }
  get rankAllWeeklyTierMyRank() { return this._ranking.rankAllWeeklyTierMyRank }
  set rankAllWeeklyTierMyRank(v) { this._ranking.rankAllWeeklyTierMyRank = v }
  get rankCurrentTier() { return this._ranking.rankCurrentTier }

  // ==== 名次反馈：由 RankingService 写入，UI 层消费一次（consumeRankingFeedback）====
  get pendingRankingFeedback() { return this._ranking.pendingFeedback }
  consumeRankingFeedback() {
    const fb = this._ranking.pendingFeedback
    this._ranking.pendingFeedback = null
    return fb
  }
  // ==== 修炼境界系统（A1 重构后） ====

  /** 当前修炼等级（便捷访问） */
  get cultLv() { return (this._d.cultivation && this._d.cultivation.level) || 0 }

  /**
   * 修炼扩容仪式待播放标记：v26→v27 迁移给老满级玩家打的一次性 flag。
   *   · 首次进入修炼界面消费一次（消费后清零，不重复弹）
   *   · 全新档不打这个 flag，避免对没修过炼的新玩家弹陌生仪式
   */
  consumeCultMigrationCeremony() {
    if (!this._d.cultMigrationCeremonyPending) return false
    this._d.cultMigrationCeremonyPending = false
    this._save()
    return true
  }
  get cultMigrationCeremonyPending() { return !!this._d.cultMigrationCeremonyPending }

  /** 当前境界完整信息（{ realmId, realmName, subStage, subStageName, fullName, ... }） */
  getCultRealmInfo() {
    const { getRealmByLv } = require('./cultivationConfig')
    return getRealmByLv(this.cultLv)
  }

  /**
   * 检查"自上次通知以来"是否发生了境界跨档。
   *   · 调用时机：任何会让 cultLv 变化的地方，例如 addCultExp 升级后
   *   · 比较规则：cultLv → 当前境界 vs 持久化的 lastCultRealmId / lastCultSubStage
   *   · 返回：
   *       { kind:'major', prev, curr }  大境界跨档（触发全屏仪式）
   *       { kind:'minor', prev, curr }  同大境界内重阶推进（走结算行/lingCheer）
   *       null                          未变化
   *   · 只升不降：若 cultLv 回退（GM 等异常），不会向下通知
   *   · 幂等：连续调用只在 cultLv 真正变化时才返回非 null
   */
  checkCultRealmUp() {
    const { getRealmByLv, REALMS } = require('./cultivationConfig')
    const curr = getRealmByLv(this.cultLv)
    // 便于 tierCeremony 读取 name/color/accent 等老字段
    curr.name = curr.realmName
    const prevId = (this._d.lastCultRealmId) || 'mortal'
    const prevSubStage = this._d.lastCultSubStage || 0
    const prevIdx = REALMS.findIndex(r => r.id === prevId)
    const currIdx = REALMS.findIndex(r => r.id === curr.realmId)

    // 构造 prev 时以"旧大境界的起点 Lv"为基准查 realm，再覆盖成 prev 的重阶
    const _buildPrev = () => {
      const prevRealm = REALMS[Math.max(0, prevIdx)] || REALMS[0]
      const baseInfo = getRealmByLv(prevRealm.minLv + prevSubStage)
      baseInfo.name = baseInfo.realmName
      return baseInfo
    }

    let up = null
    if (currIdx > prevIdx) {
      up = { kind: 'major', prev: _buildPrev(), curr }
    } else if (currIdx === prevIdx && curr.subStage > prevSubStage) {
      up = { kind: 'minor', prev: _buildPrev(), curr }
    }

    if (up) {
      this._d.lastCultRealmId = curr.realmId
      this._d.lastCultSubStage = curr.subStage
      this._save()
      // 埋点：realm_up 只在真正跨档时触发一次；静默迁移（migration）不走这条路径。
      try {
        gpAnalytics.track('realm_up', {
          kind: up.kind,
          from: up.prev.realmId,
          fromSub: up.prev.subStage,
          to: curr.realmId,
          toSub: curr.subStage,
          cultLv: this.cultLv,
        })
      } catch (_e) { /* 埋点失败不影响业务 */ }
    }
    return up
  }


  /** 里程碑"首次进入 Top10/Top3/Top1"去重，跨 session 持久化 */
  hasRankMilestone(tab, level) {
    const bag = (this._d && this._d.rankMilestones) || {}
    return !!(bag[tab] && bag[tab][level])
  }
  markRankMilestone(tab, level) {
    if (!this._d) return
    if (!this._d.rankMilestones) this._d.rankMilestones = {}
    if (!this._d.rankMilestones[tab]) this._d.rankMilestones[tab] = {}
    if (this._d.rankMilestones[tab][level]) return false
    this._d.rankMilestones[tab][level] = Date.now()
    this._save()
    return true
  }

  // ==== 名次变动三档 UI 频控 ====
  //   tier 1：每榜单每日 2 次（小幅上升/下降）
  //   tier 2：每榜单每周 1 次（进 Top10，按 ISO 周）
  //   tier 3：走 rankMilestones（一生一次）
  _getIsoWeekKey() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    // ISO 周算法：取周四作为锚定日
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(), 0, 4)
    const wk = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`
  }
  canShowRankTier(tab, tier) {
    const bag = (this._d && this._d.rankFeedback) || {}
    const rec = bag[tab] || {}
    if (tier === 1) {
      const today = localDateKey()
      if (rec.date !== today) return true
      return (rec.count || 0) < 2
    }
    if (tier === 2) {
      return rec.weeklyKey !== this._getIsoWeekKey()
    }
    return true
  }
  consumeRankTier(tab, tier) {
    if (!this._d) return
    if (!this._d.rankFeedback) this._d.rankFeedback = {}
    const rec = this._d.rankFeedback[tab] || {}
    if (tier === 1) {
      const today = localDateKey()
      if (rec.date !== today) { rec.date = today; rec.count = 0 }
      rec.count = (rec.count || 0) + 1
    } else if (tier === 2) {
      rec.weeklyKey = this._getIsoWeekKey()
    }
    this._d.rankFeedback[tab] = rec
    this._save()
  }

  submitScore(floor, pets, weapon, totalTurns) {
    return this._ranking.submitScore(floor, pets, weapon, totalTurns)
  }
  submitDexAndCombo() {
    return this._ranking.submitDexAndCombo()
  }
  submitStageRanking() {
    return this._ranking.submitStageRanking()
  }
  fetchRanking(tab, force, scope) {
    return this._ranking.fetchRanking(tab, force, scope)
  }
  fetchRankingCombined(tab, needSubmit, scope) {
    return this._ranking.fetchRankingCombined(tab, needSubmit, scope)
  }

  // ==== 通天塔周榜奖励：每日首登检查 + 领取 ====
  //   · xiaochu-api ranking/action 只读预览；claimWeeklyReward 幂等写入 weeklyReward 表
  //   · 客户端按 GM 账号静默跳过
  //   · 每日首次调用（本地日历日）才发起请求，避免频繁云调
  async checkWeeklyRewardOnceToday() {
    if (isCurrentUserGM()) return null
    if (!cloudSync.isReady()) return null
    const today = localDateKey()
    if (this._d._lastWeeklyRewardCheckDate === today) return this._d._lastWeeklyRewardPreview || null
    try {
      const r = await api.ranking({ action: 'checkWeeklyReward' })
      const result = (r && r.data) || r
      this._d._lastWeeklyRewardCheckDate = today
      this._d._lastWeeklyRewardPreview = result && result.code === 0 ? {
        periodKey: result.periodKey,
        rank: result.rank,
        reward: result.reward,
        claimed: !!result.claimed,
        canClaim: !!result.canClaim,
      } : null
      this._save()
      return this._d._lastWeeklyRewardPreview
    } catch (e) {
      console.warn('[Ranking] checkWeeklyReward 失败:', e.message || e)
      return null
    }
  }

  async claimWeeklyReward() {
    if (isCurrentUserGM()) return { ok: false, reason: 'gm' }
    if (!cloudSync.isReady()) return { ok: false, reason: 'cloud_not_ready' }
    try {
      const r = await api.ranking({ action: 'claimWeeklyReward' })
      const result = (r && r.data) || r
      if (!result || result.code !== 0 || !result.reward) {
        return { ok: false, reason: 'no_reward', result }
      }
      // 仅在 justGranted=true 时本地入账，避免同一奖励被重复发放
      if (result.justGranted) {
        const reward = result.reward
        if (reward.soulStone > 0) this.addSoulStone(reward.soulStone)
        if (reward.uniFrag > 0) this.addUniversalFragment(reward.uniFrag)
      }
      // 刷新本地缓存的预览状态，避免再次弹窗
      if (this._d._lastWeeklyRewardPreview) {
        this._d._lastWeeklyRewardPreview.claimed = true
        this._d._lastWeeklyRewardPreview.canClaim = false
      }
      this._save()
      return {
        ok: true,
        justGranted: !!result.justGranted,
        periodKey: result.periodKey,
        rank: result.rank,
        reward: result.reward,
      }
    } catch (e) {
      console.warn('[Ranking] claimWeeklyReward 失败:', e.message || e)
      return { ok: false, reason: 'error', error: e.message || String(e) }
    }
  }

  _load() {
    try {
      let raw = P.getStorageSync(this._localKey)
      if (!raw && this.serverId === serverConfig.DEFAULT_SERVER_ID) raw = P.getStorageSync(this._legacyLocalKey)
      if (raw) {
        this._d = JSON.parse(raw)
        // 补全新版本新增的默认字段
        const def = defaultPersist()
        Object.keys(def).forEach(k => {
          if (this._d[k] === undefined) this._d[k] = def[k]
        })
        // 版本迁移：旧存档升级到当前版本
        if ((this._d._version || 0) < CURRENT_VERSION) {
          runMigrations(this._d)
          this._save()
        }
        // 确保 cultivation 字段完整（防止迁移失败或字段缺失）
        this._ensureCultivationFields()
        // 老账号兜底：按当前修炼等级补齐形象解锁
        //   背景：早期 _tryCultLevelUp 没挂 unlockAvatar，历史上有玩家 Lv.10+ 但 boy2/girl2 还锁着
        //   这里每次加载做一次幂等补齐，彻底收掉"等级到了但形象没解锁"的 bug
        this._syncAvatarUnlockByCultLv()
        // 确保预设编队字段完整（兼容迁移失败 / 云端回灌数据 / defaultPersist 空骨架）
        ensureTeamPresets(this._d)
        if (this._isCrossServerLegacyData(this._d)) {
          this._resetCrossServerLegacyData('local')
        }
        // 二测删档检测（已废弃，防止老用户客户端残留 dataVersion 导致误清档）
        // this._checkDataVersion()
      } else {
        this._d = defaultPersist()
        ensureTeamPresets(this._d)
        _freshPersistDataVersion(this._d)
      }
    } catch(e) {
      console.warn('Storage load error:', e)
      this._d = defaultPersist()
      ensureTeamPresets(this._d)
      _freshPersistDataVersion(this._d)
    }
    this._d.serverId = this.serverId
  }

  _checkDataVersion() {
    const { WIPE_COMPENSATION } = require('./giftConfig')
    if ((this._d.dataVersion || 0) < DATA_VERSION) {
      const playerId = this._d.playerId || null
      this._d = defaultPersist()
      if (playerId) this._d.playerId = playerId
      this._d.dataVersion = DATA_VERSION
      if (WIPE_COMPENSATION.staminaFull) this._d.stamina.current = this._d.stamina.max
      if (WIPE_COMPENSATION.soulStone) this._d.soulStone = WIPE_COMPENSATION.soulStone
      if (WIPE_COMPENSATION.awakenStone) this._d.awakenStone = WIPE_COMPENSATION.awakenStone
      if (WIPE_COMPENSATION.fragment) {
        const targets = ['m1', 'w1', 's1', 'e1', 'f1']
        const each = Math.floor(WIPE_COMPENSATION.fragment / targets.length)
        targets.forEach(id => { this._d.fragmentBank[id] = each })
      }
      this._d._pendingWipeNotice = true
      this._d._updateTime = Date.now()
      this._save()
      P.removeStorageSync('introDone')
      P.removeStorageSync('tutorialDone')
      console.log('[Storage] 大版本清档完成，已发放补偿')
    }
  }

  clearWipeNotice() {
    this._d._pendingWipeNotice = false
    this._save()
  }

  // 补全持久化子字段（兼容任何版本的存档残缺）
  _ensureCultivationFields() {
    const cult = this._d.cultivation
    if (!cult) { this._d.cultivation = defaultPersist().cultivation; return }
    if (cult.level == null || cult.level < 1) cult.level = 1
    if (cult.exp == null) cult.exp = 0
    if (cult.totalExpEarned == null) cult.totalExpEarned = 0
    if (cult.skillPoints == null) cult.skillPoints = 0
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.realmBreakSeen == null) cult.realmBreakSeen = 0
    if (cult.capMigrationV == null) cult.capMigrationV = 3
    if (!this._d.selectedAvatar) this._d.selectedAvatar = 'boy1'
    if (!Array.isArray(this._d.unlockedAvatars)) this._d.unlockedAvatars = ['boy1', 'girl1']
    // Phase 2 字段补全
    if (!this._d.petPool) this._d.petPool = []
    if (this._d.soulStone == null) this._d.soulStone = 0
    if (this._d.awakenStone == null) this._d.awakenStone = 0
    if (this._d.universalFragment == null) this._d.universalFragment = 0
    if (!this._d.stamina) this._d.stamina = { current: STAMINA_INITIAL, max: STAMINA_INITIAL, lastRecoverTime: Date.now() }
    // Phase 3 字段补全
    if (!this._d.stageClearRecord) this._d.stageClearRecord = {}
    if (!this._d.dailyChallenges) this._d.dailyChallenges = { date: '', counts: {} }
    if (!this._d.savedStageTeam) this._d.savedStageTeam = []
    if (!this._d.sidebarRewardDate) this._d.sidebarRewardDate = ''
    // Phase 4 字段补全
    if (!this._d.idleDispatch) this._d.idleDispatch = { slots: [], lastCollect: 0 }
    // Phase 5 字段补全
    if (!this._d.fragmentBank) this._d.fragmentBank = {}
    if (!this._d.chestRewards) this._d.chestRewards = { claimed: {} }
    if (!this._d.adWatchLog) this._d.adWatchLog = {}
    if (!this._d.towerDaily) this._d.towerDaily = { date: '', runs: 0, adRuns: 0 }
    if (!this._d.towerEvent) this._d.towerEvent = { seasonIndex: -1, claimed: [] }
    if (this._d.dexRewardCompV == null) this._d.dexRewardCompV = 1
  }

  // ===== GM 调试方法（仅白名单用户可调用）=====

  /** GM：推进虚拟日期 N 天，不改签到状态；用于测试连续签到/每日重置 */
  gmAdvanceDay(days = 1) {
    if (!isCurrentUserGM()) return
    const step = Math.max(1, Number(days) || 1)
    _gmTimeOffsetMs += step * 86400000
    this._ensureLoginSign()
    this._d.loginSign.pendingDoubleRewards = null
    this._d.loginSign.doubleClaimedDate = ''
    this._d.loginSign.consecutiveClaimedDate = ''
    if (this._d.adWatchLog && this._d.adWatchLog.signDouble) {
      delete this._d.adWatchLog.signDouble
    }
    this._d._updateTime = gmNow()
    this._save()
  }

  /** GM：仅重置今日签到状态（同一天内重新测试，不推进时间） */
  gmResetSignToday() {
    if (!isCurrentUserGM()) return
    this._ensureLoginSign()
    const sign = this._d.loginSign
    sign.lastDate = ''
    sign.pendingDoubleRewards = null
    sign.doubleClaimedDate = ''
    sign.consecutiveClaimedDate = ''
    if (this._d.adWatchLog && this._d.adWatchLog.signDouble) {
      delete this._d.adWatchLog.signDouble
    }
    this._d._updateTime = gmNow()
    this._save()
  }

  /** GM：重置翻倍状态（保留签到，重新变为可翻倍） */
  gmResetDouble() {
    if (!isCurrentUserGM()) return
    this._ensureLoginSign()
    const sign = this._d.loginSign
    sign.doubleClaimedDate = ''
    const { getScaledLoginRewardByDay, getDoubleableLoginRewards, cloneLoginRewardRewards } = require('./giftConfig')
    const cycleDay = sign.day || 1
    const scaled = getScaledLoginRewardByDay(cycleDay, sign.isNewbie)
    if (scaled && scaled.rewards) {
      sign.pendingDoubleRewards = cloneLoginRewardRewards(getDoubleableLoginRewards(scaled.rewards))
    }
    this._save()
  }

  /** GM：直接设置累计签到天数（同时清除广告次数，模拟"到了新的一天"） */
  gmSetSignDay(n) {
    if (!isCurrentUserGM()) return
    const { LOGIN_CYCLE_DAYS } = require('./giftConfig')
    this._ensureLoginSign()
    const sign = this._d.loginSign
    sign.totalSignDays = Math.max(0, n)
    sign.day = sign.totalSignDays > 0 ? ((sign.totalSignDays - 1) % LOGIN_CYCLE_DAYS) + 1 : 0
    sign.isNewbie = sign.totalSignDays < LOGIN_CYCLE_DAYS
    sign.lastDate = ''
    sign.pendingDoubleRewards = null
    sign.doubleClaimedDate = ''
    sign.consecutiveDay = 0
    sign.consecutiveClaimedDate = ''
    // 模拟换天：广告次数也一并清除
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

  /**
   * GM：增减修炼经验（delta 可为负，支持降级回退测试）
   *   · 加经验：走 addCultExp
   *   · 减经验：优先扣当前 exp，不足则逐级降级并回收修炼点
   */
  gmAdjustCultExp(delta) {
    if (!isCurrentUserGM()) return null
    const n = Math.floor(Number(delta) || 0)
    if (n === 0) return this._gmCultSnapshot()
    const cult = this._d.cultivation
    if (!cult) return null
    if (cult.level == null || cult.level < 1) cult.level = 1
    if (cult.skillPoints == null) cult.skillPoints = 0
    if (!cult.levels) cult.levels = { body: 0, spirit: 0, wisdom: 0, defense: 0, sense: 0 }

    if (n > 0) {
      this.addCultExp(n)
      return this._gmCultSnapshot()
    }

    const { expToNextLevel } = require('./cultivationConfig')
    let remaining = -n
    while (remaining > 0 && cult.level >= 1) {
      if (cult.exp >= remaining) {
        cult.exp -= remaining
        remaining = 0
        break
      }
      remaining -= cult.exp
      if (cult.level <= 1) {
        cult.exp = 0
        break
      }
      cult.level--
      cult.skillPoints = Math.max(0, cult.skillPoints - 1)
      cult.exp = expToNextLevel(cult.level)
    }
    this._save()
    return this._gmCultSnapshot()
  }

  /** GM：增减修炼等级（每级同步 ±1 修炼点，降级时 exp 清零） */
  gmAdjustCultLevel(delta) {
    if (!isCurrentUserGM()) return null
    const step = Math.floor(Number(delta) || 0)
    if (step === 0) return this._gmCultSnapshot()
    const { MAX_LEVEL, expToNextLevel } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (!cult) return null
    if (cult.level == null || cult.level < 1) cult.level = 1
    if (cult.skillPoints == null) cult.skillPoints = 0

    if (step > 0) {
      for (let i = 0; i < step && cult.level < MAX_LEVEL; i++) {
        const need = Math.max(0, expToNextLevel(cult.level) - (cult.exp || 0))
        this.addCultExp(need > 0 ? need : expToNextLevel(cult.level))
      }
      return this._gmCultSnapshot()
    }

    for (let i = 0; i < -step && cult.level > 1; i++) {
      cult.level--
      cult.skillPoints = Math.max(0, cult.skillPoints - 1)
      cult.exp = 0
    }
    this._save()
    return this._gmCultSnapshot()
  }

  _gmCultSnapshot() {
    const cult = this._d.cultivation || {}
    const { expToNextLevel, MAX_LEVEL } = require('./cultivationConfig')
    const lv = cult.level || 1
    const need = lv >= MAX_LEVEL ? 0 : expToNextLevel(lv)
    return { level: lv, exp: cult.exp || 0, need, skillPoints: cult.skillPoints || 0 }
  }

  /**
   * GM：重置所有"情绪峰值弹窗 flag" + "境界仪式 flag"，方便真机调试时重放 tierCeremony / 炫耀卡
   *   · celebrateFlags      —— shareHooks 的一生一次 / 每关一次幂等标记（firstPet / firstSRating / stageFirstClear_* 等）
   *   · lastCultRealmId/Sub —— storage.checkCultRealmUp 的进度 flag，清零后下次跨档就会按当前 cultLv 重新判 major/minor
   *   注：cultivation.level 不动；玩家自己决定是否配合 GM 改经验回退测试
   */
  gmResetCelebrateFlags() {
    if (!isCurrentUserGM()) return
    this._d.celebrateFlags = {}
    this._d.lastCultRealmId = 'mortal'
    this._d.lastCultSubStage = 0
    this._save()
  }

  _save() {
    try {
      this._d.serverId = this.serverId
      P.setStorageSync(this._localKey, JSON.stringify(this._d))
      // GM 时间偏移期间跳过云同步，防止云端旧数据覆盖本地
      if (_gmTimeOffsetMs === 0) {
        cloudSync.debounceSyncToCloud(this._d)
      }
      if (this._eventBus) this._eventBus.emit('data:save')
    } catch(e) {
      console.warn('Storage save error:', e)
    }
  }

  async _initCloud() {
    try {
      await cloudSync.init(this._d, {
        localKey: this._localKey,
        serverId: this.serverId,
        currentVersion: CURRENT_VERSION,
        runMigrations,
        storage: this,
        onSyncDone: () => this._onCloudSyncDone(),
      })
    } catch (e) {
      console.warn('[Storage] Cloud init error:', e && (e.message || e))
    } finally {
      this._cloudSyncReady = true
      try {
        const uid = cloudSync.getOpenid && cloudSync.getOpenid()
        if (uid) gpAnalytics.setUserId(uid)
        gpAnalytics.trackSessionStart({
          cloud_sync_ready: !!uid,
          has_persistent_progress: this.hasPersistentProgress(),
        })
      } catch (_e) {}
    }
    this._ranking.preheatRanking()
  }

  // ====== 微信平台礼包：待领队列（启动拉取 → 玩家点 UI 领取 → 真正发放） ======

  /**
   * 云同步拉到待领礼包后调用，仅入队，不发奖。
   * @param {Array<{ id, giftTypeId, giftId, rewards }>} list
   */
  appendPendingPlatformGifts(list) {
    if (!Array.isArray(list) || list.length === 0) return
    if (!Array.isArray(this._pendingPlatformGiftClaims)) this._pendingPlatformGiftClaims = []
    const existed = new Set(this._pendingPlatformGiftClaims.map((g) => g.id))
    for (const item of list) {
      if (!item || !item.id || existed.has(item.id)) continue
      this._pendingPlatformGiftClaims.push({
        id: item.id,
        giftTypeId: item.giftTypeId || 0,
        giftId: item.giftId || '',
        rewards: item.rewards || {},
      })
      existed.add(item.id)
    }
  }

  hasPendingPlatformGiftClaims() {
    return !!(Array.isArray(this._pendingPlatformGiftClaims) && this._pendingPlatformGiftClaims.length)
  }

  /** UI 用：合并待领礼包奖励（调试/兼容；正常流程由 platformWelfare 自动 grant） */
  getPendingPlatformGiftTotalRewards() {
    if (!this.hasPendingPlatformGiftClaims()) return null
    const total = {}
    for (const gift of this._pendingPlatformGiftClaims) {
      const r = gift.rewards || {}
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'number') total[k] = (total[k] || 0) + v
      }
    }
    return Object.keys(total).length ? total : null
  }

  /**
   * 平台礼包自动/手动发放：写本地 ID、清队列、上报埋点。
   * 返回 { ids, granted, total }；调用方负责再 markGranted 到云端。
   */
  claimPendingPlatformGifts() {
    if (!this.hasPendingPlatformGiftClaims()) return null
    const claims = this._pendingPlatformGiftClaims.slice()
    const ids = []
    const total = {}
    const giftTypes = {}
    const giftIds = {}
    let grantCount = 0
    if (!this._d.platformGiftGrantedIds) this._d.platformGiftGrantedIds = {}

    for (const gift of claims) {
      if (!gift || !gift.id) continue
      const rewards = gift.rewards || {}
      if (!Object.keys(rewards).length) continue
      const granted = this._grantLoginRewardBundle(rewards)
      if (!granted || Object.keys(granted).length === 0) continue
      grantCount++
      ids.push(gift.id)
      this._d.platformGiftGrantedIds[gift.id] = Date.now()
      const typeKey = String(gift.giftTypeId || 'unknown')
      giftTypes[typeKey] = (giftTypes[typeKey] || 0) + 1
      if (gift.giftId) giftIds[gift.giftId] = (giftIds[gift.giftId] || 0) + 1
      for (const [k, v] of Object.entries(granted)) {
        if (typeof v === 'number') total[k] = (total[k] || 0) + v
      }
    }

    this._pendingPlatformGiftClaims = null
    this._pendingPlatformGiftRewards = null

    if (grantCount === 0) {
      this._save()
      return { ids: [], granted: {}, total: {} }
    }

    if (!this._d.platformGiftSummary) {
      this._d.platformGiftSummary = { totalClaims: 0, giftTypes: {}, giftIds: {}, rewards: {}, lastClaimAt: 0 }
    }
    const summary = this._d.platformGiftSummary
    summary.totalClaims = (summary.totalClaims || 0) + grantCount
    summary.lastClaimAt = Date.now()
    for (const [k, v] of Object.entries(giftTypes)) summary.giftTypes[k] = (summary.giftTypes[k] || 0) + v
    for (const [k, v] of Object.entries(giftIds)) summary.giftIds[k] = (summary.giftIds[k] || 0) + v
    for (const [k, v] of Object.entries(total)) summary.rewards[k] = (summary.rewards[k] || 0) + v

    if (this.recordFunnelEvent) {
      this.recordFunnelEvent('platform_gift_claimed', {
        giftTypeId: Object.keys(giftTypes).join(','),
        giftCount: grantCount,
        universalFragment: total.universalFragment || 0,
      })
    }
    this._save()
    return { ids, granted: total, total }
  }

  isPlatformGiftLocallyGranted(id) {
    if (!id) return false
    const map = this._d.platformGiftGrantedIds || {}
    return !!map[id]
  }

  _onCloudSyncDone() {
    if (this._isCrossServerLegacyData(this._d)) {
      this._resetCrossServerLegacyData('cloud')
      this._save()
      return
    }
    const hasProgress = this.hasPersistentProgress()
    if (!hasProgress) return

    if (this.recordFunnelEvent) {
      this.recordFunnelEvent('cloud_veteran_restored', {
        scene: 'cloud_sync',
        stageClearCount: this.getClearedNormalStageDistinctCount(),
        petPoolCount: (this._d.petPool || []).length,
      })
    }

    // 补写独立 key，防止下次启动还走新手流程
    const introKey = serverConfig.scopedKey('introDone', this.serverId)
    const tutorialKey = serverConfig.scopedKey('tutorialDone', this.serverId)
    const stageTutorialKey = serverConfig.scopedKey('stageTutorialDone', this.serverId)
    const stageTutorial12Key = serverConfig.scopedKey('stageTutorialDone_1_2', this.serverId)
    if (!P.getStorageSync(introKey)) {
      P.setStorageSync(introKey, true)
      console.log('[Storage] 云端为老玩家，补写 introDone')
    }
    if (!P.getStorageSync(tutorialKey)) {
      P.setStorageSync(tutorialKey, true)
      console.log('[Storage] 云端为老玩家，补写 tutorialDone')
    }
    if (!P.getStorageSync(stageTutorialKey)) {
      P.setStorageSync(stageTutorialKey, true)
      console.log('[Storage] 云端为老玩家，补写 stageTutorialDone')
    }
    if (!P.getStorageSync(stageTutorial12Key)) {
      P.setStorageSync(stageTutorial12Key, true)
      console.log('[Storage] 云端为老玩家，补写 stageTutorialDone_1_2')
    }

    // 通知主循环：如果当前还在 intro/教学中，应跳转回首页
    if (this._eventBus) {
      this._eventBus.emit('cloud:veteranRestored')
    }

    // 云合并后数据已是最终态，静默提交图鉴/连击排行（未授权玩家走匿名昵称兜底）
    if ((this._d.petPool || []).length > 0) {
      this.submitDexAndCombo()
    }
  }

  // 排行榜 UI 是否需要展示"换真实头像昵称"软引导
  //   · 微信：未授权或没真实头像昵称时返回 true
  //   · 抖音：默认"冒险者"时返回 true，主动授权过就为 false
  needsRealNameCta() {
    if (!this.userInfo) return true
    const nick = this.userInfo.nickName || ''
    if (isAnonNick(nick)) return true
    if (nick === '冒险者' || nick === '微信用户' || nick === '修士') return true
    return !this.userAuthorized
  }

  // UI 层统一取显示用昵称：
  //   · 授权后：微信/抖音授权昵称（真名）
  //   · 未授权：用 openid 生成稳定匿名昵称 "修士·XXXX"，和排行榜完全一致
  //   · openid 都拿不到（冷启动早期）：兜底 "修士"，不崩
  getDisplayNickName() {
    const nick = this.userInfo && this.userInfo.nickName
    if (nick && !isAnonNick(nick) && nick !== '修士' && nick !== '微信用户') {
      return nick
    }
    try {
      const oid = cloudSync.getOpenid && cloudSync.getOpenid()
      if (oid) return genAnonNick(oid)
    } catch (_) {}
    return '修士'
  }

}

Storage.genAnonNick = genAnonNick
Storage.isAnonNick = isAnonNick

module.exports = Storage
