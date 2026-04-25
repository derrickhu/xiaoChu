/**
 * 灵宠定位配置
 *
 * 目标：
 * - UI 只读取定位结果，不直接判断 skill.type
 * - 新增宠物 / 新技能时优先补本文件映射，避免详情页持续堆 if/else
 * - 未配置的新技能走“辅助型 / 未归类”兜底，并可通过校验函数发现
 */

const ROLE = {
  ATTACK: 'attack',
  BURST: 'burst',
  CONVERT: 'convert',
  CONTROL: 'control',
  SHIELD: 'shield',
  HEAL: 'heal',
  SUPPORT: 'support',
}

const PET_ROLE_META = {
  [ROLE.ATTACK]: { key: ROLE.ATTACK, label: '攻击型', short: '攻击', desc: '擅长直接伤害与多段输出' },
  [ROLE.BURST]: { key: ROLE.BURST, label: '爆发型', short: '爆发', desc: '擅长增伤、暴击与破防爆发' },
  [ROLE.CONVERT]: { key: ROLE.CONVERT, label: '转珠型', short: '转珠', desc: '擅长改变珠盘与提升指定珠率' },
  [ROLE.CONTROL]: { key: ROLE.CONTROL, label: '控制型', short: '控制', desc: '擅长眩晕、冰冻与削弱敌方' },
  [ROLE.SHIELD]: { key: ROLE.SHIELD, label: '护盾型', short: '护盾', desc: '擅长护盾、减伤与反弹守护' },
  [ROLE.HEAL]: { key: ROLE.HEAL, label: '恢复型', short: '恢复', desc: '擅长回血、心珠与续航恢复' },
  [ROLE.SUPPORT]: { key: ROLE.SUPPORT, label: '辅助型', short: '辅助', desc: '擅长免控、连击、复活与节奏辅助' },
}

const PET_ROLE_FALLBACK_TAG = { key: 'unclassified', label: '未归类', short: '未归类', desc: '新技能待补充定位配置' }

const SKILL_TYPE_ROLE_MAP = {
  instantDmg: { role: ROLE.ATTACK },
  instantDmgDot: { role: ROLE.ATTACK, tags: [ROLE.CONTROL] },
  multiHit: { role: ROLE.ATTACK },
  teamAttack: { role: ROLE.ATTACK, tags: [ROLE.BURST] },

  dmgBoost: { role: ROLE.BURST },
  ignoreDefFull: { role: ROLE.BURST },
  guaranteeCrit: { role: ROLE.BURST },
  critBoost: { role: ROLE.BURST },
  critDmgUp: { role: ROLE.BURST },
  comboDmgUp: { role: ROLE.BURST },
  lowHpDmgUp: { role: ROLE.BURST },
  warGod: { role: ROLE.BURST, tags: [ROLE.SUPPORT] },
  allAtkUp: { role: ROLE.BURST, tags: [ROLE.SUPPORT] },
  allDmgUp: { role: ROLE.BURST, tags: [ROLE.SUPPORT] },

  convertBead: { role: ROLE.CONVERT },
  convertRow: { role: ROLE.CONVERT },
  convertCol: { role: ROLE.CONVERT },
  convertCross: { role: ROLE.CONVERT },
  replaceBeads: { role: ROLE.CONVERT },
  beadRateUp: { role: ROLE.CONVERT },

  stun: { role: ROLE.CONTROL },
  stunDot: { role: ROLE.CONTROL, tags: [ROLE.ATTACK] },
  stunPlusDmg: { role: ROLE.CONTROL, tags: [ROLE.BURST] },
  stunBreakDef: { role: ROLE.CONTROL, tags: [ROLE.BURST] },
  dot: { role: ROLE.CONTROL, tags: [ROLE.ATTACK] },

  shield: { role: ROLE.SHIELD },
  shieldPlus: { role: ROLE.SHIELD },
  reflectPct: { role: ROLE.SHIELD },
  allDefUp: { role: ROLE.SHIELD, tags: [ROLE.SUPPORT] },
  immuneShield: { role: ROLE.SHIELD, tags: [ROLE.SUPPORT] },

  healPct: { role: ROLE.HEAL },
  hpMaxUp: { role: ROLE.HEAL, tags: [ROLE.SHIELD] },

  extraTimePlus: { role: ROLE.SUPPORT },
  comboPlusNeverBreak: { role: ROLE.SUPPORT, tags: [ROLE.BURST] },
  comboNeverBreakPlus: { role: ROLE.SUPPORT, tags: [ROLE.BURST] },
  immuneCtrl: { role: ROLE.SUPPORT },
  purify: { role: ROLE.SUPPORT, tags: [ROLE.HEAL] },
  revivePlus: { role: ROLE.SUPPORT, tags: [ROLE.HEAL] },
}

function _uniqueRoles(list) {
  const out = []
  for (const role of list) {
    if (role && PET_ROLE_META[role] && out.indexOf(role) < 0) out.push(role)
  }
  return out
}

function _applySkillRoleRules(skill, base) {
  if (!skill) return base
  const roles = [base.role].concat(base.tags || [])

  // 心珠转换本质是续航工具，比普通转珠更应该标记为恢复。
  if (skill.type === 'replaceBeads' && skill.toAttr === 'heart') roles.unshift(ROLE.HEAL)

  // 同时带护盾 / 减伤 / 反弹时，副标签补护盾，方便玩家理解用途。
  if (skill.shieldVal || skill.val || skill.reducePct || skill.defBoost || skill.reflectPct) roles.push(ROLE.SHIELD)

  // 同时带回血 / 再生时，补恢复标签。
  if (skill.healPct || skill.regen || skill.heartBoost) roles.push(ROLE.HEAL)

  // 带额外增伤 / 攻击提升时补爆发。
  if (skill.dmgBoost || skill.atkBoost || skill.extraDmgPct || skill.critDmgBonus) roles.push(ROLE.BURST)

  const uniq = _uniqueRoles(roles)
  return { role: uniq[0] || ROLE.SUPPORT, tags: uniq.slice(1) }
}

function getPetRoleTags(pet) {
  const skill = pet && pet.skill
  const type = skill && skill.type
  if (type && !SKILL_TYPE_ROLE_MAP[type]) {
    return [PET_ROLE_META[ROLE.SUPPORT], PET_ROLE_FALLBACK_TAG]
  }
  const base = (type && SKILL_TYPE_ROLE_MAP[type]) || { role: ROLE.SUPPORT }
  const resolved = _applySkillRoleRules(skill, base)
  const roles = _uniqueRoles([resolved.role].concat(resolved.tags || [])).slice(0, 2)
  if (roles.length === 0) roles.push(ROLE.SUPPORT)
  return roles.map(role => PET_ROLE_META[role] || PET_ROLE_META[ROLE.SUPPORT])
}

function getPetRole(pet) {
  return getPetRoleTags(pet)[0] || PET_ROLE_META[ROLE.SUPPORT]
}

function getPetRoleSummary(pet) {
  const tags = getPetRoleTags(pet)
  const main = tags[0] || PET_ROLE_META[ROLE.SUPPORT]
  const sub = tags[1]
  if (sub === PET_ROLE_FALLBACK_TAG) return `${main.label} · ${sub.label}：${sub.desc}`
  return sub ? `${main.label} · ${sub.short}辅助：${main.desc}` : `${main.label}：${main.desc}`
}

function validatePetRoleCoverage(PETS) {
  const missing = {}
  if (!PETS) return missing
  Object.keys(PETS).forEach(attr => {
    ;(PETS[attr] || []).forEach(p => {
      const type = p && p.skill && p.skill.type
      if (type && !SKILL_TYPE_ROLE_MAP[type]) {
        if (!missing[type]) missing[type] = []
        missing[type].push(p.id)
      }
    })
  })
  return missing
}

module.exports = {
  ROLE,
  PET_ROLE_META,
  SKILL_TYPE_ROLE_MAP,
  getPetRole,
  getPetRoleTags,
  getPetRoleSummary,
  validatePetRoleCoverage,
}
