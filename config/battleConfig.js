/**
 * 战斗 UI 配置 — 布局尺寸、动画参数、颜色主题
 * 所有战斗界面的可调参数集中管理
 */

module.exports = {
  PANEL_WIDTH_RATIO: 0.88,
  PANEL_INNER_PAD: 18,
  EXIT_BTN_SIZE: 32,
  CHEST_SIZE: 36,

  VICTORY_ANIM_DURATION: 30,
  VICTORY_ENTER_DURATION: 15,
  ENEMY_HIT_FLASH_MAX: 12,
  ELIM_ANIM_FRAMES: 16,

  DRAG_TRAIL_MAX: 12,
  DRAG_TRAIL_INTERVAL: 3,

  ATK_BONUS_INTERVAL: 5,
  ATK_BONUS_BASE: 10,
  ATK_BONUS_PER_TIER: 2,

  COLORS: {
    hpBar: '#d4607a',
    hpBarHeal: '#4dcc4d',
    victoryTitle: '#C07000',
    defeatText: '#f0e0c0',
    hpUp: '#27864A',
    atkUp: '#C06020',
    weaponBonus: '#8B6914',
    expColor: '#5b48b0',
    gmBtnBg: 'rgba(200,30,60,0.85)',
    gmBtnBorder: '#ff6688',
  },
}
