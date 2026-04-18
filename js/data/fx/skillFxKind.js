/**
 * 技能 kind 分类
 *
 * 用途：
 *   把 sk.type（>40 种细节类型）归到 6 大视觉类别，驱动 emitPetSkillEffect 分发。
 *
 * 6 大类：
 *   - attack  攻击类（有飞向敌人的光波）
 *   - heal    治疗类（头顶金绿光柱）
 *   - shield  护盾类（六边形结界）
 *   - buff    增益类（向上箭头 + 金边）
 *   - convert 变珠类（棋盘金线扫描）
 *   - cc      控制类（眩晕/毒雾/净化）
 *
 * 未列出的 sk.type 默认归为 'buff'（保守：至少有前摇 + 飘字）。
 */

const KIND = Object.freeze({
  attack: 'attack',
  heal: 'heal',
  shield: 'shield',
  buff: 'buff',
  convert: 'convert',
  cc: 'cc',
})

// sk.type -> kind 映射
const TYPE_TO_KIND = Object.freeze({
  // attack
  instantDmg: 'attack',
  instantDmgDot: 'attack',
  multiHit: 'attack',
  teamAttack: 'attack',

  // heal
  healPct: 'heal',
  healFlat: 'heal',
  fullHeal: 'heal',
  fullHealPlus: 'heal',
  revive: 'heal',
  revivePlus: 'heal',

  // shield
  shield: 'shield',
  shieldPlus: 'shield',
  shieldReflect: 'shield',
  reduceDmg: 'shield',
  dmgImmune: 'shield',
  immuneShield: 'shield',
  immuneCtrl: 'shield',
  hpMaxShield: 'shield',

  // buff（涵盖所有属性/攻击/防御/暴击/combo/时间等加成）
  dmgBoost: 'buff',
  allAtkUp: 'buff',
  allDefUp: 'buff',
  allDmgUp: 'buff',
  allHpMaxUp: 'buff',
  hpMaxUp: 'buff',
  critBoost: 'buff',
  critDmgUp: 'buff',
  comboPlus: 'buff',
  comboPlusNeverBreak: 'buff',
  comboNeverBreak: 'buff',
  comboNeverBreakPlus: 'buff',
  comboDmgUp: 'buff',
  extraTime: 'buff',
  extraTimePlus: 'buff',
  ignoreDefPct: 'buff',
  ignoreDefFull: 'buff',
  heartBoost: 'buff',
  beadRateUp: 'buff',
  healOnElim: 'buff',
  shieldOnElim: 'buff',
  lowHpDmgUp: 'buff',
  stunPlusDmg: 'buff',
  warGod: 'buff',
  reflectPct: 'buff',
  guaranteeCrit: 'buff',
  onKillHeal: 'buff',

  // convert
  convertBead: 'convert',
  convertRow: 'convert',
  convertCol: 'convert',
  convertCross: 'convert',
  replaceBeads: 'convert',
  spawnHeart: 'convert',

  // cc
  stun: 'cc',
  stunDot: 'cc',
  stunBreakDef: 'cc',
  dot: 'cc',
  purify: 'cc',
})

function getSkillKind(sk) {
  if (!sk || !sk.type) return KIND.buff
  return TYPE_TO_KIND[sk.type] || KIND.buff
}

module.exports = { KIND, TYPE_TO_KIND, getSkillKind }
