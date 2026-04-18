/**
 * 技能预载 badge 配置
 *
 * 用途：
 *   释放技能瞬间，在被加成宠物头顶弹一个大号"× N 火"/"必暴"/"连击+30%"等
 *   飘字，让玩家立刻看清技能的 *效果* 而不只是 *名字*。
 *
 * 设计：
 *   - 按 sk.type 映射一组 { label, color, attr, subKind }
 *   - subKind 后续会用在 battleStatusBar 与 _drawBuffFx 做视觉分化
 *   - 未覆盖的 type 返回 null，调用方跳过
 */

const { ATTR_NAME, ATTR_COLOR } = require('../tower')

const SUB = Object.freeze({
  preloadAttr: 'preloadAttr',   // 下次某属性伤害×N
  preloadAll: 'preloadAll',     // 所有伤害/攻击提升
  preloadCrit: 'preloadCrit',   // 下次必暴
  preloadCombo: 'preloadCombo', // 连击加成
  preloadExec: 'preloadExec',   // 处决/低血加成
  stateTime: 'stateTime',       // 时间/combo 不断
  stateShield: 'stateShield',   // 护盾类（单独 kind）
  stateBuff: 'stateBuff',       // 常规增益
})

// 只画真正"一次性预载 + 效果强"的，避免头顶满屏飘字
function resolveBadge(sk, pct) {
  if (!sk || !sk.type) return null
  const p = pct || sk.pct || 0
  switch (sk.type) {
    case 'dmgBoost': {
      const attr = sk.attr
      const label = (attr && ATTR_NAME[attr])
        ? `×${1 + Math.round(p / 100)} ${ATTR_NAME[attr]}`
        : `×${1 + Math.round(p / 100)}`
      const color = (attr && ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || '#ffd860'
      return { label, color, subKind: SUB.preloadAttr, attr }
    }
    case 'allAtkUp':
      return { label: `攻击 +${Math.round(p)}%`, color: '#ff6a6a', subKind: SUB.preloadAll }
    case 'allDmgUp':
      return { label: `伤害 +${Math.round(p)}%`, color: '#ffb040', subKind: SUB.preloadAll }
    case 'allDefUp':
      return { label: `防御 +${Math.round(p)}%`, color: '#7dd3fc', subKind: SUB.stateBuff }
    case 'critBoost':
    case 'critDmgUp':
      return { label: `暴击 +${Math.round(p)}%`, color: '#ffd860', subKind: SUB.preloadCrit }
    case 'guaranteeCrit':
      return { label: '必暴击', color: '#ffd860', subKind: SUB.preloadCrit }
    case 'warGod':
      return { label: '狂暴!', color: '#ff3b30', subKind: SUB.preloadAll }
    case 'comboDmgUp':
      return { label: `连击 +${Math.round(p)}%`, color: '#fff1a0', subKind: SUB.preloadCombo }
    case 'comboPlus':
    case 'comboPlusNeverBreak':
      return { label: '连击保护', color: '#fff1a0', subKind: SUB.stateTime }
    case 'comboNeverBreak':
    case 'comboNeverBreakPlus':
      return { label: '连击不断', color: '#fff1a0', subKind: SUB.stateTime }
    case 'extraTime':
    case 'extraTimePlus':
      return { label: `时间 +${Math.round(p) || sk.sec || 3}`, color: '#b088ff', subKind: SUB.stateTime }
    case 'lowHpDmgUp':
      return { label: '绝境爆发', color: '#ff4d4d', subKind: SUB.preloadExec }
    case 'ignoreDefPct':
    case 'ignoreDefFull':
      return { label: '破防', color: '#d0d0d0', subKind: SUB.preloadAttr }
    case 'reflectPct':
      return { label: `反伤 ${Math.round(p)}%`, color: '#40e8ff', subKind: SUB.stateBuff }
    case 'onKillHeal':
      return { label: '击杀回血', color: '#4dff90', subKind: SUB.stateBuff }
    case 'heartBoost':
      return { label: '心珠强化', color: '#ff8fb0', subKind: SUB.stateBuff }
    case 'healOnElim':
      return { label: '消珠回血', color: '#4dff90', subKind: SUB.stateBuff }
    case 'shieldOnElim':
      return { label: '消珠结盾', color: '#ffd860', subKind: SUB.stateShield }
    default:
      return null
  }
}

// buff type（heroBuffs 里存的）反查 subKind，用于 battleStatusBar 状态分类
function resolveSubKindByBuffType(b) {
  if (!b) return null
  switch (b.type) {
    case 'dmgBoost': return SUB.preloadAttr
    case 'allAtkUp':
    case 'allDmgUp': return SUB.preloadAll
    case 'guaranteeCrit':
    case 'critBoost':
    case 'critDmgUp': return SUB.preloadCrit
    case 'comboDmgUp': return SUB.preloadCombo
    case 'lowHpDmgUp': return SUB.preloadExec
    case 'ignoreDefPct':
    case 'ignoreDefFull': return SUB.preloadAttr
    case 'comboPlus':
    case 'comboPlusNeverBreak':
    case 'comboNeverBreak':
    case 'comboNeverBreakPlus': return SUB.stateTime
    default: return null
  }
}

module.exports = {
  SUB,
  resolveBadge,
  resolveSubKindByBuffType,
}
