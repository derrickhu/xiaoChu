/**
 * 分享场景配置 — 统一管理所有分享文案、图片
 * 使用方式：shareManager.doShare(g, 'sceneKey', templateData)
 */

const SHARE_SCENES = {
  passive: {
    titleFn: (d) => d.isCleared
      ? `${d.turns ? d.turns + '回合' : ''}通关五行通天塔！收集${d.dex}只灵兽，你敢来挑战吗？`
      : `我已攻到消消塔第${d.floor}层，收集了${d.dex}只灵兽，你能比我更强吗？`,
    imageUrl: 'assets/share/share_default.jpg',
    imageUrlCleared: 'assets/share/share_cover.jpg',
  },
  stats: {
    titles: [
      (d) => `消消塔第${d.floor}层！${d.dex}只灵兽助阵，最高${d.combo}连击！`,
      (d) => `五行通天塔第${d.floor}层，收集${d.dex}只灵兽，你敢来比吗？`,
    ],
    imageUrl: 'assets/share/share_cover.jpg',
  },
  stageFirstClear: {
    titleFn: (d) => {
      if (d.isFinalBoss) {
        const prefix = d.isElite ? '精英终章' : '终章'
        return `${prefix}「${d.stageName}」首通 ${d.rating} 评价！终章守关已破，快来挑战万妖之主！`
      }
      return `秘境「${d.stageName}」首通 ${d.rating} 评价！灵宠消消乐，你也来试试！`
    },
    imageUrl: 'assets/share/share_default.jpg',
  },
  petStarUp: {
    titleFn: (d) => `灵宠「${d.petName}」升至${d.star}★！灵宠消消乐，快来培养你的灵宠！`,
    imageUrl: 'assets/share/share_default.jpg',
  },
  weaponObtain: {
    titleFn: (d) => `获得法宝「${d.weaponName}」！灵宠消消乐，法宝助力闯关！`,
    imageUrl: 'assets/share/share_default.jpg',
  },
  chapterComplete: {
    titleFn: (d) => `「${d.chapterName}」全部通关！灵宠消消乐，一起来冒险！`,
    imageUrl: 'assets/share/share_cover.jpg',
  },
  towerDefeat: {
    titleFn: (d) => `我在消消塔第${d.floor}层倒下了，快来助我一臂之力！`,
    imageUrl: 'assets/share/share_revive.jpg',
  },
  towerItem: {
    titleFn: (d) => `我正在挑战消消塔第${d.floor}层，一起来修仙！`,
    imageUrl: 'assets/share/share_default.jpg',
  },
}

module.exports = { SHARE_SCENES }
