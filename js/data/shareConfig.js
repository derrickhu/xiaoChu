/**
 * 分享场景配置 — 统一管理所有分享文案、图片、奖励
 *
 * 使用方式：shareCore(g, 'sceneKey', data, opts)
 *
 * 字段说明：
 *   - titleFn(data)          : 好友/群分享标题
 *   - timelineTitleFn(data)  : 朋友圈分享标题（可选，省略则回落 titleFn）
 *   - imageUrl               : 默认静态分享图（相对路径）
 *   - imageUrlCleared        : 已通关变体（仅 passive/stats 使用）
 *   - useCard                : 是否启用动态炫耀卡（shareCard.generateCard 合成），默认 false
 *   - cardTemplate           : 动态卡底图 key（对应 assets/share/card_base/*.jpg）
 *   - reward                 : 分享奖励（在每日基础奖之外叠加；首次触发后 sceneOnce=true 不再发）
 *     · stamina              : 体力
 *     · soulStone            : 灵石
 *     · fragment             : 万能碎片
 *   - sceneOnce              : 本场景 key 每用户只奖一次（防刷）
 */

const SHARE_SCENES = {
  // ========== 被动分享（右上角菜单 / 日任 share_1 / 广告降级） ==========
  passive: {
    titleFn: (d) => d.isCleared
      ? `${d.turns ? d.turns + '回合' : ''}通关五行通天塔！收集${d.dex}只灵兽，你敢来挑战吗？`
      : `我已攻到消消塔第${d.floor}层，收集了${d.dex}只灵兽，你能比我更强吗？`,
    timelineTitleFn: (d) => d.isCleared
      ? `通关五行通天塔，${d.dex}只灵兽同行！来一起修仙`
      : `修仙之旅到第${d.floor}层，一起来五行通天塔吧`,
    imageUrl: 'assets/share/share_default.jpg',
    imageUrlCleared: 'assets/share/share_cover.jpg',
  },

  // ========== 首页「炫耀战绩」 ==========
  stats: {
    titles: [
      (d) => `消消塔第${d.floor}层！${d.dex}只灵兽助阵，最高${d.combo}连击！`,
      (d) => `五行通天塔第${d.floor}层，收集${d.dex}只灵兽，你敢来比吗？`,
    ],
    timelineTitleFn: (d) => `通天塔第${d.floor}层 · ${d.dex}只灵兽 · ${d.combo}连击`,
    imageUrl: 'assets/share/share_cover.jpg',
  },

  // ========== 情绪峰值：首通 1-1 / 获得首只灵宠 ==========
  firstPet: {
    titleFn: (d) => `我收服了第一只灵宠「${d.petName || '灵兽'}」！一起来修仙打怪吧～`,
    timelineTitleFn: (d) => `刚收服了「${d.petName || '灵宠'}」，灵宠消消塔真好玩`,
    imageUrl: 'assets/share/share_default.jpg',
    useCard: true,
    cardTemplate: 'first_pet',
    reward: { soulStone: 50, fragment: 5 },
    sceneOnce: true,
  },

  // ========== 情绪峰值：首通关 ==========
  stageFirstClear: {
    titleFn: (d) => {
      if (d.isFinalBoss) {
        const prefix = d.isElite ? '精英终章' : '终章'
        return `${prefix}「${d.stageName}」首通 ${d.rating} 评价！终章守关已破，快来挑战万妖之主！`
      }
      return `秘境「${d.stageName}」首通 ${d.rating} 评价！灵宠消消乐，你也来试试！`
    },
    timelineTitleFn: (d) => `${d.rating} 评价首通「${d.stageName}」，一起修仙吧`,
    imageUrl: 'assets/share/share_default.jpg',
    useCard: true,
    cardTemplate: 'stage_first_clear',
    reward: { soulStone: 30 },
  },

  // ========== 情绪峰值：首次拿到 S 评价 ==========
  firstSRating: {
    titleFn: (d) => `${d.turns ? d.turns + '回合' : ''}S 评价通关「${d.stageName}」！我也能当高手`,
    timelineTitleFn: (d) => `人生第一个 S 评价，通关「${d.stageName}」`,
    imageUrl: 'assets/share/share_default.jpg',
    useCard: true,
    cardTemplate: 'first_s',
    reward: { soulStone: 30 },
    sceneOnce: true,
  },

  // ========== 情绪峰值：灵宠升 3★ / 5★ ==========
  petStarUp: {
    titleFn: (d) => `灵宠「${d.petName}」升至${d.star}★！灵宠消消塔，快来培养你的灵宠！`,
    timelineTitleFn: (d) => `${d.star}★灵宠养成ing～ 「${d.petName}」真帅！`,
    imageUrl: 'assets/share/share_default.jpg',
    useCard: true,
    cardTemplate: 'pet_starup',
    reward: { soulStone: 20 },
  },

  // ========== 情绪峰值：章节通关 ==========
  chapterComplete: {
    titleFn: (d) => `「${d.chapterName}」全部通关！灵宠消消塔，一起来冒险！`,
    timelineTitleFn: (d) => `章节「${d.chapterName}」圆满通关，下一章继续`,
    imageUrl: 'assets/share/share_cover.jpg',
    useCard: true,
    cardTemplate: 'chapter_complete',
    reward: { soulStone: 50 },
  },

  // ========== 情绪峰值：逆风翻盘（战斗中血量 ≤10% 胜利） ==========
  // 底图：短期复用 first_s.jpg（"高手时刻"质感相近），后续可换专属逆风底图
  comebackWin: {
    titleFn: (d) => `${d.hpPct}% 残血翻盘「${d.stageName}」！手心全是汗，快来看我怎么赢的`,
    timelineTitleFn: (d) => `残血${d.hpPct}%翻盘「${d.stageName}」，灵宠消消塔真刺激`,
    imageUrl: 'assets/share/share_default.jpg',
    useCard: true,
    cardTemplate: 'first_s',
    reward: { soulStone: 30 },
  },

  // ========== 情绪峰值：境界大跨档（感气 → 炼气 等） ==========
  // 底图：短期复用 chapter_complete.jpg（"里程碑"质感相近），后续可换专属境界底图
  realmUp: {
    titleFn: (d) => `修为精进！我已晋入「${d.currName}」境，一起来修仙`,
    timelineTitleFn: (d) => `${d.prevName} → ${d.currName}，修仙之路又迈一档`,
    imageUrl: 'assets/share/share_cover.jpg',
    useCard: true,
    cardTemplate: 'chapter_complete',
    reward: { soulStone: 50 },
  },

  // ========== 情绪峰值：通天塔新高 ==========
  towerNewBest: {
    titleFn: (d) => `通天塔新纪录！第${d.floor}层，来挑战我的记录`,
    timelineTitleFn: (d) => `通天塔第${d.floor}层新高！你能爬多高？`,
    imageUrl: 'assets/share/share_cover.jpg',
    useCard: true,
    cardTemplate: 'tower_new_best',
    reward: { soulStone: 100 },
  },

  // ========== 功能分享：武器/法宝获得 ==========
  weaponObtain: {
    titleFn: (d) => `获得法宝「${d.weaponName}」！灵宠消消塔，法宝助力闯关！`,
    imageUrl: 'assets/share/share_default.jpg',
  },

  // ========== 功能分享：通天塔局内死亡求助（保留现有） ==========
  towerDefeat: {
    titleFn: (d) => `我在消消塔第${d.floor}层倒下了，快来助我一臂之力！`,
    imageUrl: 'assets/share/share_revive.jpg',
  },

  // ========== 功能分享：通天塔通关（保留现有） ==========
  towerClear: {
    titleFn: (d) => `我在五行通天塔打到第${d.floor}层，来挑战我`,
    imageUrl: 'assets/share/share_cover.jpg',
  },

  // ========== 功能分享：塔内物品炫耀（保留现有） ==========
  towerItem: {
    titleFn: (d) => `我正在挑战消消塔第${d.floor}层，一起来修仙！`,
    imageUrl: 'assets/share/share_default.jpg',
  },
}

module.exports = { SHARE_SCENES }
