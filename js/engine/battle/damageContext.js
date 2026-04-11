function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function cloneObject(obj) {
  if (!obj || typeof obj !== 'object') return obj == null ? null : obj
  return Object.assign({}, obj)
}

function cloneMap(map) {
  if (!map || typeof map !== 'object') return {}
  return Object.assign({}, map)
}

function cloneList(list) {
  if (!Array.isArray(list)) return []
  return list.map(item => (item && typeof item === 'object') ? Object.assign({}, item) : item)
}

function pickOverride(overrides, key, fallback) {
  return hasOwn(overrides, key) ? overrides[key] : fallback
}

function buildDamageContext(g, overrides) {
  const opts = overrides || {}
  const runBuffs = cloneObject(pickOverride(opts, 'runBuffs', g.runBuffs || {})) || {}
  runBuffs.attrDmgPct = cloneMap(runBuffs.attrDmgPct)

  const ctx = {
    combo: pickOverride(opts, 'combo', g.combo || 0),
    pendingDmgMap: cloneMap(pickOverride(opts, 'pendingDmgMap', g._pendingDmgMap || {})),
    pendingHeal: pickOverride(opts, 'pendingHeal', g._pendingHeal || 0),
    runBuffs,
    heroBuffs: cloneList(pickOverride(opts, 'heroBuffs', g.heroBuffs || [])),
    weapon: cloneObject(pickOverride(opts, 'weapon', g.weapon || null)),
    enemy: cloneObject(pickOverride(opts, 'enemy', g.enemy || null)),
    enemyBuffs: cloneList(pickOverride(opts, 'enemyBuffs', g.enemyBuffs || [])),
    heroHp: pickOverride(opts, 'heroHp', g.heroHp || 0),
    heroMaxHp: pickOverride(opts, 'heroMaxHp', g.heroMaxHp || 0),
    pendingCrit: pickOverride(opts, 'pendingCrit', g._pendingCrit),
    pendingCritMul: pickOverride(opts, 'pendingCritMul', g._pendingCritMul),
    pendingAttrMaxCount: cloneMap(pickOverride(opts, 'pendingAttrMaxCount', g._pendingAttrMaxCount || {})),
    nextDmgDouble: !!pickOverride(opts, 'nextDmgDouble', g.nextDmgDouble),
    pets: cloneList(pickOverride(opts, 'pets', g.pets || [])),
  }

  return Object.freeze(ctx)
}

module.exports = {
  buildDamageContext,
}
