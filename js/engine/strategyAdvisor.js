/**
 * 攻略诊断引擎 — 纯数据计算，不依赖 UI
 * 提供失败诊断、升级建议、队伍摘要、攻略页数据
 */

const { ATTRS, ATTR_NAME, COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL } = require('../data/tower')
const { POOL_STAR_ATK_MUL, POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_STAR_AWAKEN_COST } = require('../data/constants')
const { getPoolPetAtk, getPoolPetMaxLv } = require('../data/petPoolConfig')
const { getPetById, getPetRarity } = require('../data/pets')
const { CULT_CONFIG, CULT_KEYS, effectValue, usedPoints } = require('../data/cultivationConfig')
const { COMBO_MUL_BREAKPOINTS, ELIM_MUL_4, ELIM_MUL_5 } = require('../data/balance/combat')

const COMBO_DMG_RATES = COMBO_MUL_BREAKPOINTS.map(bp => bp.rate)

/**
 * 估算平均每回合 Combo 段数（保守值）
 */
const AVG_COMBO_STAGES = 2.5

/**
 * 估算 Combo 倍率
 */
function _avgComboMul() {
  let mul = 1
  for (let i = 0; i < AVG_COMBO_STAGES; i++) {
    mul += COMBO_DMG_RATES[Math.min(i, COMBO_DMG_RATES.length - 1)]
  }
  return mul
}

/**
 * 模拟宠物升 N 级后的 ATK
 */
function _simulateAtk(poolPet, lvDelta) {
  const fake = { ...poolPet, level: poolPet.level + lvDelta }
  return getPoolPetAtk(fake)
}

/**
 * 模拟宠物升 1 星后的 ATK
 */
function _simulateStarAtk(poolPet) {
  const fake = { ...poolPet, star: poolPet.star + 1 }
  return getPoolPetAtk(fake)
}

// ===== 核心 API =====

/**
 * 队伍战力摘要
 */
function getTeamPowerSummary(storage, teamPetIds) {
  const pool = storage.petPool || []
  const pets = teamPetIds.map(id => {
    const pp = pool.find(p => p.id === id)
    if (!pp) return null
    const base = getPetById(id)
    return { id, name: base ? base.name : id, attr: pp.attr, atk: getPoolPetAtk(pp), star: pp.star }
  }).filter(Boolean)

  const totalAtk = pets.reduce((s, p) => s + p.atk, 0)
  const attrCoverage = [...new Set(pets.map(p => p.attr))]
  return { pets, totalAtk, attrCoverage, coverCount: attrCoverage.length }
}

/**
 * 按"投入产出比"排序的升级建议
 */
function getSuggestedUpgrades(storage, enemyAttr) {
  const pool = storage.petPool || []
  const suggestions = []
  const counterAttr = COUNTER_BY[enemyAttr]

  for (const pp of pool) {
    const base = getPetById(pp.id)
    if (!base) continue
    const curAtk = getPoolPetAtk(pp)
    const isCounter = pp.attr === counterAttr
    const weight = isCounter ? COUNTER_MUL : 1

    // 升 5 级的收益
    const maxLv = getPoolPetMaxLv(pp)
    if (pp.level + 5 <= maxLv) {
      const newAtk = _simulateAtk(pp, 5)
      const delta = newAtk - curAtk
      if (delta > 0) {
        suggestions.push({
          type: 'level',
          petId: pp.id,
          petName: base.name,
          attr: pp.attr,
          from: `Lv.${pp.level}`,
          to: `Lv.${pp.level + 5}`,
          atkFrom: curAtk,
          atkTo: newAtk,
          delta,
          cost: '灵石',
          score: delta * weight,
          action: 'petPool',
        })
      }
    }

    // 升 1 星的收益
    const nextStar = pp.star + 1
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    if (fragCost) {
      const lvReq = POOL_STAR_LV_REQ[nextStar] || 0
      const awakenCost = POOL_STAR_AWAKEN_COST[nextStar] || 0
      const newAtk = _simulateStarAtk(pp)
      const delta = newAtk - curAtk
      const hasFrag = (pp.fragments || 0) >= fragCost
      const hasLv = pp.level >= lvReq
      if (delta > 0) {
        const readiness = (hasFrag ? 1 : 0) + (hasLv ? 1 : 0)
        suggestions.push({
          type: 'star',
          petId: pp.id,
          petName: base.name,
          attr: pp.attr,
          from: `★${pp.star}`,
          to: `★${nextStar}`,
          atkFrom: curAtk,
          atkTo: newAtk,
          delta,
          cost: `${fragCost}碎片${awakenCost > 0 ? ` + ${awakenCost}觉醒石` : ''}`,
          ready: hasFrag && hasLv,
          needFrag: hasFrag ? 0 : fragCost - (pp.fragments || 0),
          needLv: hasLv ? 0 : lvReq - pp.level,
          score: delta * weight * (readiness + 1),
          action: 'petPool',
        })
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score)
  return suggestions.slice(0, 4)
}

/**
 * 失败诊断 — 返回结构化分析结果
 */
function analyzeDefeat(storage, result) {
  const team = result.teamSnapshot || []
  const enemyAttr = result.enemyAttr
  const enemyHp = result.enemyMaxHp || 1
  const enemyAtk = result.enemyAtk || 0

  const teamTotalAtk = team.reduce((s, p) => s + (p.atk || 0), 0)
  const counterAttr = COUNTER_BY[enemyAttr]
  const hasCounter = team.some(p => p.attr === counterAttr)
  const attrCoverage = [...new Set(team.map(p => p.attr))]

  const comboMul = _avgComboMul()
  const effectiveAtk = teamTotalAtk * (hasCounter ? 1.3 : 1) * comboMul
  const turnsToKill = effectiveAtk > 0 ? Math.ceil(enemyHp / effectiveAtk) : 99

  // 建议 ATK：让 turnsToKill <= 8 为目标
  const targetTurns = 8
  const suggestedAtk = Math.ceil(enemyHp / (targetTurns * comboMul * (hasCounter ? 1.3 : 1)))

  const tips = []

  // 1. 战力差距
  const gap = suggestedAtk - teamTotalAtk
  if (gap > 0) {
    const pct = Math.min(100, Math.round(teamTotalAtk / suggestedAtk * 100))
    tips.push({
      icon: '📊',
      iconColor: pct < 50 ? '#cc3030' : pct < 80 ? '#D4A030' : '#40A060',
      title: `队伍总攻击 ${teamTotalAtk}`,
      desc: `建议提升至 ${suggestedAtk}+ 以稳定通关`,
      priority: 12,
      action: 'petPool',
      data: { teamAtk: teamTotalAtk, suggestedAtk, pct },
    })
  }

  // 2. 克制阵容
  if (!hasCounter && counterAttr) {
    const attrName = ATTR_NAME[counterAttr] || counterAttr
    const counterPetInPool = (storage.petPool || []).find(p => p.attr === counterAttr)
    tips.push({
      icon: '⚔',
      iconColor: '#ff6633',
      title: `带入${attrName}属性灵宠`,
      desc: counterPetInPool
        ? `${getPetById(counterPetInPool.id)?.name || attrName}克制敌人（伤害×${COUNTER_MUL}）`
        : `克制敌人可造成 ${COUNTER_MUL} 倍伤害`,
      priority: 11,
      action: counterPetInPool ? 'stageTeam' : null,
    })
  }

  // 3. 具体升级建议（取 top-2）
  const upgrades = getSuggestedUpgrades(storage, enemyAttr)
  for (let i = 0; i < Math.min(2, upgrades.length); i++) {
    const u = upgrades[i]
    const label = u.type === 'star'
      ? `升星 ${u.petName} ${u.from}→${u.to}`
      : `升级 ${u.petName} ${u.from}→${u.to}`
    const detail = u.type === 'star'
      ? `ATK ${u.atkFrom}→${u.atkTo}${u.ready ? '（可升）' : `（需${u.needFrag > 0 ? u.needFrag + '碎片' : ''}${u.needLv > 0 ? ' Lv' + (u.needLv + parseInt(u.from.replace('Lv.', ''))) : ''}）`}`
      : `ATK ${u.atkFrom}→${u.atkTo}`
    tips.push({
      icon: u.type === 'star' ? '★' : '⬆',
      iconColor: u.type === 'star' ? '#FFD700' : '#4488CC',
      title: label,
      desc: detail,
      priority: 10 - i,
      action: u.action,
    })
  }

  // 4. 修炼点未分配
  const cult = storage.cultivation
  const totalPoints = cult.level || 0
  const used = usedPoints(cult.levels || {})
  if (totalPoints > used) {
    const free = totalPoints - used
    const bodyLv = (cult.levels || {}).body || 0
    const bodyMax = CULT_CONFIG.body.maxLv
    const canBody = Math.min(free, bodyMax - bodyLv)
    const hpGain = canBody > 0 ? canBody * CULT_CONFIG.body.perLv : 0
    tips.push({
      icon: '🧘',
      iconColor: '#9060D0',
      title: `${free} 修炼点未分配`,
      desc: hpGain > 0 ? `可分配体魄 +${hpGain} HP` : '可提升防御/转珠时间等',
      priority: 7,
      action: 'cultivation',
    })
  }

  // 5. 属性覆盖不足
  if (attrCoverage.length < 3 && (storage.petPool || []).length >= 3) {
    tips.push({
      icon: '🎨',
      iconColor: '#6699CC',
      title: `属性覆盖 ${attrCoverage.length}/5`,
      desc: '建议覆盖 3+ 属性提高伤害稳定性',
      priority: 5,
      action: 'stageTeam',
    })
  }

  tips.sort((a, b) => b.priority - a.priority)
  return {
    teamTotalAtk,
    suggestedAtk: Math.max(suggestedAtk, teamTotalAtk),
    powerPct: suggestedAtk > 0 ? Math.min(100, Math.round(teamTotalAtk / suggestedAtk * 100)) : 100,
    turnsToKill,
    hasCounter,
    attrCoverage,
    tips: tips.slice(0, 4),
  }
}

/**
 * 攻略页数据（数值全部从配置读取）
 */
function getHelpPageData() {
  return {
    counterMul: COUNTER_MUL,
    counteredMul: COUNTERED_MUL,
    counterChain: ATTRS.map(a => ATTR_NAME[a]).join('→') + '→' + ATTR_NAME[ATTRS[0]],
    counterPairs: ATTRS.map(a => ({ from: ATTR_NAME[a], to: ATTR_NAME[COUNTER_MAP[a]] })),
    elimMul4: ELIM_MUL_4,
    elimMul5: ELIM_MUL_5,
    comboDmgRates: COMBO_DMG_RATES,
    starAtkMul: POOL_STAR_ATK_MUL,
    cultConfig: CULT_KEYS.map(k => ({
      key: k,
      name: CULT_CONFIG[k].name,
      perLv: CULT_CONFIG[k].perLv,
      unit: CULT_CONFIG[k].unit,
      maxLv: CULT_CONFIG[k].maxLv,
    })),
  }
}

module.exports = {
  analyzeDefeat,
  getSuggestedUpgrades,
  getTeamPowerSummary,
  getHelpPageData,
}
