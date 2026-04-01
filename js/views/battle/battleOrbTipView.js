/**
 * 首次进入战斗：珠子攻击机制说明弹窗
 */
const V = require('../env')
const { drawDialog, drawTipRow, drawDivider } = require('../uiComponents')

// ===== 首次珠子攻击提示 =====
const ORB_TIP_FLAG = 'orb_attack_tip'

function initOrbAttackTip(g) {
  if (g._orbTipChecked) return
  g._orbTipChecked = true
  if (g.storage && g.storage.isGuideShown(ORB_TIP_FLAG)) return
  // 延迟几帧再弹出，让玩家先看到棋盘
  g._orbTipDelay = 30
}

function drawOrbAttackTip(g) {
  const { ctx, W, H, S } = V
  if (!g._orbTipTimer) g._orbTipTimer = 0
  g._orbTipTimer++
  const lineH = 28 * S

  drawDialog(ctx, S, W, H, {
    title: '珠子攻击指南',
    icon: '💡',
    timer: g._orbTipTimer,
    frame: g.af,
    panelH: 240 * S,
    renderContent: function (c, _S, area) {
      var y = area.y
      drawTipRow(c, _S, area.x, y, lineH, { shape: 'burst', color: '#b8860b' }, '有效珠', '匹配宠物属性，消除造成伤害', '#b8860b', '#8B7355')
      y += lineH
      drawTipRow(c, _S, area.x, y, lineH, { shape: 'dim', color: '#999' }, '无效珠', '暗淡显示，不造成伤害', '#999', '#8B7355')
      y += lineH
      drawTipRow(c, _S, area.x, y, lineH, { shape: 'heart', color: '#e04080' }, '心珠', '始终有效，消除回复生命', '#e04080', '#8B7355')
      y += lineH + 4 * _S
      drawDivider(c, _S, area.x + 10 * _S, area.x + area.w - 10 * _S, y)
      y += 12 * _S
      c.fillStyle = '#a08860'
      c.font = (11 * _S) + 'px "PingFang SC",sans-serif'
      c.textAlign = 'center'
      c.fillText('💡 消除无效珠仍可触发 Combo 增加连击倍率', area.x + area.w / 2, y)
      y += 18 * _S
      c.fillStyle = '#8a7a60'
      c.font = (10 * _S) + 'px "PingFang SC",sans-serif'
      c.fillText('合理搭配队伍属性以覆盖更多珠子颜色', area.x + area.w / 2, y)
    },
  })
}

module.exports = { ORB_TIP_FLAG, initOrbAttackTip, drawOrbAttackTip }
