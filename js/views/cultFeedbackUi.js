/**
 * 修炼即时反馈 UI · 公共绘制
 *
 * 提供两种升级反馈的统一绘制（结算页、通天塔结算页共用）：
 *   1) drawCultLvUpRow        普通 Lv 升级行（小灵 mini 头像 + 金色口吻）
 *   2) drawCultSubRealmUpRow  小阶跨档金光行（更亮、描边、更大字号）
 *
 * 大境界（major）跨档不在此处绘制——走全屏 tierCeremony。
 *
 * 设计原则：
 *   - 所有文案从 LING.cheer 取，UI 只负责渲染，避免"文案写死在 UI 层"
 *   - 两个函数返回消耗的 y 偏移，方便调用方继续排版
 *   - 调用方控制 alpha/裁剪，本函数只做中心化绘制
 */
const { LING } = require('../data/lingIdentity')

/**
 * 画一行"修炼升级"提示（小灵头像 + 口吻）
 * @returns {number} y 偏移（固定 16*S）
 */
function drawCultLvUpRow(c, R, S, cx, cy, prevLv, currLv, skillPts) {
  const text = (LING && LING.cheer && LING.cheer.cultLvUp && LING.cheer.cultLvUp(prevLv, currLv, skillPts))
    || `升级！Lv.${prevLv} → Lv.${currLv}  获得 ${skillPts} 修炼点`
  c.save()
  c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
  c.textBaseline = 'middle'
  const tw = c.measureText(text).width
  const avatarSz = 14 * S
  const gap = 5 * S
  const totalW = avatarSz + gap + tw
  const startX = cx - totalW / 2
  const avatar = R.getImg && LING && LING.avatar ? R.getImg(LING.avatar) : null
  if (avatar && avatar.width > 0) {
    c.drawImage(avatar, startX, cy - avatarSz / 2 + 4 * S, avatarSz, avatarSz)
  }
  c.textAlign = 'left'
  c.fillStyle = '#D4A030'
  c.shadowColor = 'rgba(200,150,0,0.4)'; c.shadowBlur = 6 * S
  c.fillText(text, startX + avatarSz + gap, cy + 4 * S)
  c.restore()
  return 16 * S
}

/**
 * 画一行"小阶突破"金光提示（比普通升级更醒目）
 * @returns {number} y 偏移（固定 18*S）
 */
function drawCultSubRealmUpRow(c, R, S, cx, cy, realmFullName) {
  const text = (LING && LING.cheer && LING.cheer.cultSubRealmUp && LING.cheer.cultSubRealmUp(realmFullName))
    || `突破·${realmFullName}！`
  c.save()
  c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.textBaseline = 'middle'
  const tw = c.measureText(text).width
  const avatarSz = 16 * S
  const gap = 6 * S
  const totalW = avatarSz + gap + tw
  const startX = cx - totalW / 2
  const avatar = R.getImg && LING && LING.avatar ? R.getImg(LING.avatar) : null
  if (avatar && avatar.width > 0) {
    c.drawImage(avatar, startX, cy - avatarSz / 2 + 4 * S, avatarSz, avatarSz)
  }
  c.textAlign = 'left'
  c.fillStyle = '#FFD86A'
  c.shadowColor = 'rgba(255,180,40,0.75)'; c.shadowBlur = 10 * S
  c.strokeStyle = 'rgba(120,60,0,0.45)'; c.lineWidth = 2 * S
  c.strokeText(text, startX + avatarSz + gap, cy + 4 * S)
  c.fillText(text, startX + avatarSz + gap, cy + 4 * S)
  c.restore()
  return 18 * S
}

module.exports = { drawCultLvUpRow, drawCultSubRealmUpRow }
