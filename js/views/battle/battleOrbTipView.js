/**
 * 珠子攻击说明：已不再自动弹窗（原会在 1-4 等关卡首次弹出）
 * 玩家通过战斗内「攻略」查看；存档写入 orb_attack_tip 以保持与旧逻辑兼容
 */

const ORB_TIP_FLAG = 'orb_attack_tip'

function initOrbAttackTip(g) {
  if (g._orbTipChecked) return
  g._orbTipChecked = true
  g._orbTipDelay = 0
  g._showOrbAttackTip = false
  if (g.storage && !g.storage.isGuideShown(ORB_TIP_FLAG)) {
    g.storage.markGuideShown(ORB_TIP_FLAG)
  }
}

module.exports = {
  ORB_TIP_FLAG,
  initOrbAttackTip,
}
