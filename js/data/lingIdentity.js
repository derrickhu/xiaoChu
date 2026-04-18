/**
 * 仙宠 · 小灵 —— 玩家守护灵 身份常量
 *
 * 定位：玩家的灵兽搭档 / 守护灵（不进入灵宠池，不可养成，是独立 NPC）
 * 口吻：软糯、略黏人、有点小嘚瑟但不聒噪，称呼玩家为"主人"
 *
 * 所有"有人在和玩家说话"的 UI（引导气泡 / 讲解卡 / 失败寄语 / 回归问候）
 * 统一引用此文件的常量，避免说话人/头像路径多处重复导致不一致。
 */

const LING = {
  name:    '小灵',
  /** 标签常用形态：讲解卡说话人、引导气泡右上小标签 */
  speaker: '仙宠 · 小灵',
  /** 头像交付图（已 rembg + trim + 居中），256×256，～94K */
  avatar:  'assets/ui/guide_xiaoling.png',

  /** 常见口吻片段 — 写文案时参考，保持语气一致 */
  tones: {
    greetFirstTime:  '主人，我是小灵，以后就由我陪着你啦～',
    greetComeback:   '主人回来啦！',
    encourage:       '主人别灰心，',
    celebrate:       '主人我们做到啦！',
    lead:            '主人，我来教你～',
    hint:            '主人，我观察到',
    goodLuck:        '祝主人此行顺遂～',
  },

  /**
   * 即时反馈文案库 —— 宠物升级/升星/突破/派遣/首通 等"玩家做了点什么"时
   * 统一走这里取；所有 UI 反馈组件（lingCheer、petDetailView、cultivationView 等）
   * 都从这里拿文案，避免分散写死。
   *
   * 用法：
   *   const { LING } = require('../data/lingIdentity')
   *   const msg = LING.cheer.petStarUp(petName, newStar)
   */
  cheer: {
    /** 升星通用（★2~★4） */
    petStarUp(petName, newStar) {
      if (newStar === 2) return `主人～ ${petName || '它'}解锁技能啦！`
      if (newStar === 3) return `主人，${petName || '它'}星星越来越多了呢～`
      if (newStar === 4) return `主人，${petName || '它'}觉醒了新力量！`
      return `主人～ ${petName || '它'}更厉害啦！`
    },
    /** 满星★5 */
    petStarMax(petName) {
      return `主人主人，${petName || '它'}精通啦～背景故事也解锁咯！`
    },
    /** 连升多级（>= 5 级） */
    petLevelUpBig(petName, levels) {
      return `主人，${petName || '它'}一口气升了 ${levels} 级！`
    },
    /** 大境界突破（在全屏仪式之后出场，或兜底路径） */
    realmBreak(realmName) {
      return `恭喜主人晋入「${realmName}」！道行大涨～`
    },
    /**
     * 修炼普通升级（每 1 Lv 都可能触发；结算页金光行用）
     *   用一个 Lv%5 的简单取模轮换 5 句，保持陪伴感又不单调
     */
    cultLvUp(prevLv, currLv, skillPts) {
      const phrases = [
        `修炼又精进啦～Lv.${prevLv} → Lv.${currLv}`,
        `主人感悟更深了～Lv.${currLv} 到手`,
        `道行再涨 Lv.${currLv}，主人加油！`,
        `小灵感觉到灵气更强啦～Lv.${currLv}`,
        `主人又磨出一层功夫～Lv.${currLv}`,
      ]
      const pick = phrases[(currLv || 0) % phrases.length]
      if (skillPts > 0) return `${pick}  +${skillPts} 修炼点`
      return pick
    },
    /** 小阶跨档（同大境界内，例如 感气·二重 → 感气·三重） */
    cultSubRealmUp(realmFullName) {
      return `突破·${realmFullName}！主人又更进一层～`
    },
    /** 首通普通关卡 */
    stageFirstClear(stageName) {
      return stageName
        ? `主人又闯过「${stageName}」～ 下一关也一起加油！`
        : '主人又闯过一关～ 下一关也一起加油！'
    },
    /** 首通 BOSS / 终章 */
    stageFirstClearBoss() {
      return '主人，大魔王伏诛！干得漂亮～'
    },
    /** 派遣收取 */
    idleCollect(fragments, soulStone) {
      return `主人～ 这趟小家伙们挑了 ${fragments} 枚碎片、${soulStone} 灵石回来！`
    },
    /** 图鉴里程碑（元素/品阶收录达成） */
    dexMilestone(title) {
      return title ? `图鉴「${title}」达成～ 永久加成到手！` : '图鉴里程碑达成～ 永久加成到手！'
    },
    /** 通天塔破纪录 */
    towerNewBest(floor) {
      return `主人爬到 ${floor} 层啦！又创新高～`
    },
    /** 逆风翻盘（残血胜利）—— 紧张过后的释然 */
    comebackWin(stageName) {
      return stageName
        ? `哇～「${stageName}」主人差点就…好险！这一仗精彩！`
        : '惊险逆转～主人这一仗打得漂亮！'
    },
    /** 境界大跨档（感气 → 炼气 等）—— 修仙里程碑 */
    realmUp(currName) {
      return currName
        ? `主人晋入「${currName}」啦～修为又迈上新台阶！`
        : '主人境界突破～修为精进！'
    },
    /** 每日任务全清 */
    dailyAllDone() {
      return '主人今日功课全部做完啦～了不起！'
    },
    /** 首次获得灵宠（通常在 1-1 首通后） */
    firstPet(petName) {
      return `主人，${petName || '它'}愿意陪着你啦～我们以后就是一家啦！`
    },
    /** 首次 S 评价（一生一次的大里程碑） */
    firstS(stageName) {
      return stageName
        ? `主人太厉害啦～「${stageName}」拿到了 S 评价！`
        : '主人居然打出了 S 评价！快给自己点个赞～'
    },
    /** 章节圆满（任意章通关） */
    chapterComplete(chapterName) {
      return chapterName
        ? `「${chapterName}」圆满结卷～下一卷的故事等主人翻开！`
        : '一章圆满～下一卷继续我们的故事！'
    },
    /** 邀请好友反奖到账 */
    inviteReward(granted) {
      const count = (granted && granted.count) || 0
      const stone = (granted && granted.soulStone) || 0
      if (count <= 0) return ''
      if (count === 1) return `有好友因主人而来～ 灵石 +${stone}！`
      return `${count} 位好友因主人而来～ 灵石 +${stone}！`
    },
  },

  /**
   * 秘境关卡教学文案库 —— 第 1 章 1-1 ~ 1-8 新机制讲解
   *
   * 结构：
   *   stageCards[stageId]  阻塞式讲解卡（drawLingCard），仅 1-1 / 1-2 / 1-3 首通前弹出
   *                         字段对齐 drawLingCard 参数：subLabel/title/lines/note
   *   stageTips[stageId]   非阻塞横条（_mechanicOpenTip 增强版），1-4 ~ 1-8 用
   *                         小灵口吻的一句话，小头像会自动画在横条左侧
   *
   * 原则：去掉"第 X 课"编号，统一用"小灵讲堂"副标签，避免"只有 1-1 有课"的违和感。
   */
  teach: {
    stageCards: {
      stage_1_1: {
        subLabel: '小灵讲堂 · 转珠',
        title: '拖珠攻击！',
        lines: [
          '主人第一次下秘境，小灵先带你练手～',
          '按住一颗灵珠沿路径拖动，凑齐三颗同色就会消除，',
          '对应属性的灵宠就会替主人出手啦！',
        ],
        note: '小灵提示：跟着发光路径走，保证一次命中～',
      },
      stage_1_2: {
        subLabel: '小灵讲堂 · 心珠回血',
        title: '粉色心珠 = 生命线',
        lines: [
          '主人，这一关敌人会反手打你哦～',
          '受伤时留意棋盘上的粉色心珠，',
          '三颗心珠连线消除，可以立刻回血！',
        ],
        note: '血量吃紧时，心珠是小灵最大的依靠～',
      },
      stage_1_3: {
        subLabel: '小灵讲堂 · 五行相克',
        title: '克制属性 · 伤害翻倍',
        lines: [
          '主人记着五行相克哦：',
          '金克木 · 木克土 · 土克水 · 水克火 · 火克金。',
          '用克制属性的灵宠攻击，伤害 ×1.6；',
          '被克制属性则只有 ×0.5，要避开～',
        ],
        note: '开战先看看敌人的属性图标，再挑合适的珠子～',
      },
    },

    stageTips: {
      stage_1_4: '主人试试一次消两组灵珠 —— Combo 伤害翻倍哦～',
      stage_1_5: '主人，从灵宠头像上滑一下 —— 放大招的时候到啦！',
      stage_1_6: '主人排 4 颗同色在一起，伤害直接 ×1.5！',
      stage_1_7: '主人若能排 5 连，伤害 ×2 还能把敌人晕住～',
      stage_1_8: 'Boss 现身啦！主人把这一章学到的都使出来～',
    },
  },
}

module.exports = { LING }
