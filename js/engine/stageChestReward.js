/**
 * 通关宝箱展示数据
 * 只包装 settleStage 已经发放的奖励，不在这里额外发奖。
 */
const { getPetById, getPetAvatarPath, getPetRarity, PET_RARITY } = require('../data/pets')
const { getWeaponById, getWeaponRarity, getWeaponsByRarity } = require('../data/weapons')

const CHEST_SLOT_COUNT = 6

function _shuffle(arr) {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = out[i]; out[i] = out[j]; out[j] = t
  }
  return out
}

function _takeFill(items, count) {
  const out = []
  const src = items.filter(Boolean)
  if (!src.length) return out
  for (let i = 0; i < count; i++) out.push(src[i % src.length])
  return out
}

function _petItem(petId, opts = {}) {
  const pet = getPetById(petId)
  if (!pet) return null
  const rarity = getPetRarity(petId)
  return {
    kind: opts.kind || 'pet',
    id: petId,
    title: pet.name,
    sub: opts.sub || (opts.fragmentCount ? `${rarity} 灵宠碎片 ×${opts.fragmentCount}` : `${rarity} 灵宠`),
    amount: opts.amount || (opts.fragmentCount ? `×${opts.fragmentCount}` : '整宠'),
    rarity,
    attr: pet.attr,
    icon: getPetAvatarPath({ ...pet, star: 1 }),
    isActual: !!opts.isActual,
  }
}

function _weaponItem(weaponId, opts = {}) {
  const weapon = getWeaponById(weaponId)
  if (!weapon) return null
  const rarity = getWeaponRarity(weaponId) || 'R'
  return {
    kind: 'weapon',
    id: weaponId,
    title: weapon.name,
    sub: opts.sub || `${rarity} 法宝`,
    amount: opts.amount || (opts.duplicate ? '已拥有' : '新法宝'),
    rarity,
    icon: `assets/equipment/fabao_${weaponId}.png`,
    isActual: !!opts.isActual,
  }
}

function _resourceItem(kind, title, amount, icon, sub) {
  return {
    kind,
    title,
    amount,
    sub: sub || '通关奖励',
    icon,
    rarity: 'R',
    isActual: false,
  }
}

function _petHooksByRarity(rarity, excludeId) {
  const ids = (PET_RARITY[rarity] || PET_RARITY.R || []).filter(id => id !== excludeId)
  return _shuffle(ids).map(id => _petItem(id, { sub: '同池灵宠' })).filter(Boolean)
}

function _weaponHooksByRarity(rarity, excludeId) {
  return _shuffle(getWeaponsByRarity(rarity).filter(w => w.id !== excludeId))
    .map(w => _weaponItem(w.id, { sub: '同池法宝', amount: '可能获得' }))
    .filter(Boolean)
}

function _petPanel(result, reward) {
  if (!reward || !reward.petId) return null
  const isFragment = reward.type === 'fragment'
  const actual = _petItem(reward.petId, {
    isActual: true,
    kind: isFragment ? 'fragment' : 'pet',
    fragmentCount: isFragment ? (reward.count || 0) : 0,
    sub: isFragment ? '已有灵宠转化碎片' : '首通灵宠',
  })
  if (!actual) return null
  // 供恭喜获得旁标签：整宠为新获得，重复灵宠转碎片为已有
  actual.ownershipTag = isFragment ? 'owned' : 'new'
  const hooks = _takeFill(_petHooksByRarity(actual.rarity, reward.petId), CHEST_SLOT_COUNT - 1)
  return {
    kind: 'pet',
    chestKind: 'premium',
    title: '灵宠赐福',
    subtitle: '首通任选一匣，揭晓命定灵宠',
    resultText: isFragment ? '已转化为灵宠碎片' : '新灵宠已加入队伍',
    actual,
    hooks,
    stageId: result.stageId,
  }
}

function _weaponPanel(result, reward) {
  if (!reward || !reward.weaponId) return null
  const actual = _weaponItem(reward.weaponId, {
    isActual: true,
    duplicate: reward.wasDuplicate,
    sub: reward.wasDuplicate ? '已有法宝转化灵石' : 'Boss 首通法宝',
    amount: reward.wasDuplicate ? `灵石 +${reward.dupeSoulStone || 0}` : '新法宝',
  })
  if (!actual) return null
  actual.ownershipTag = reward.wasDuplicate ? 'owned' : 'new'
  const hooks = _takeFill(_weaponHooksByRarity(actual.rarity, reward.weaponId), CHEST_SLOT_COUNT - 1)
  return {
    kind: 'weapon',
    chestKind: 'weapon',
    title: '灵宝现世',
    subtitle: '击败 Boss，开启专属法宝匣',
    resultText: reward.wasDuplicate ? '已有法宝已转化为灵石' : '法宝已收入背包',
    actual,
    hooks,
    stageId: result.stageId,
  }
}

function _repeatPanel(g, result) {
  const rewards = result.rewards || []
  const frag = rewards.find(r => r.type === 'fragment' && r.petId && !r.fromStar)
  let actual = null
  if (frag) {
    actual = _petItem(frag.petId, {
      isActual: true,
      kind: 'fragment',
      fragmentCount: frag.count || 0,
      sub: '本关掉落碎片',
    })
  }
  if (!actual && result.soulStone > 0) {
    actual = _resourceItem('soulStone', '灵石', `+${result.soulStone}`, 'assets/ui/icon_soul_stone.png', '本关掉落')
    actual.isActual = true
  }
  if (!actual && result.cultExp > 0) {
    actual = _resourceItem('cultExp', '修炼经验', `+${result.cultExp}`, 'assets/ui/icon_cult_exp.png', '本关修炼')
    actual.isActual = true
  }
  if (!actual) return null

  const hooks = []
  const pool = (g.storage && g.storage.petPool) || []
  const candidates = _shuffle(pool.map(p => p.id).filter(Boolean))
  candidates.forEach(id => {
    const p = _petItem(id, { kind: 'fragment', fragmentCount: frag ? (frag.count || 1) : 1, sub: '可能掉落碎片' })
    if (p) hooks.push(p)
  })
  if (result.soulStone > 0) hooks.push(_resourceItem('soulStone', '灵石', `+${result.soulStone}`, 'assets/ui/icon_soul_stone.png', '周回奖励'))
  if (result.cultExp > 0) hooks.push(_resourceItem('cultExp', '修炼经验', `+${result.cultExp}`, 'assets/ui/icon_cult_exp.png', '周回奖励'))
  if (result.totalFragCount > 0) hooks.push(_resourceItem('fragment', '灵宠碎片', `×${result.totalFragCount}`, 'assets/ui/icon_universal_frag.png', '随机碎片'))

  return {
    kind: 'repeat',
    chestKind: 'normal',
    title: '通关宝匣',
    subtitle: '周回掉落已藏入宝箱',
    resultText: '奖励已收入囊中',
    actual,
    hooks: _takeFill(hooks, CHEST_SLOT_COUNT - 1),
    stageId: result.stageId,
  }
}

function buildStageChestPanels(g, stage, result) {
  if (!g || !stage || !result || !result.victory) return null
  const rewards = result.rewards || []
  const panels = []
  if (result.isFirstClear) {
    const petReward = rewards.find(r => r.type === 'pet' && r.petId) ||
      rewards.find(r => r.type === 'fragment' && r.petId && r.wasPet)
    const petPanel = _petPanel(result, petReward)
    if (petPanel) panels.push(petPanel)

    if (stage.order === 8) {
      const weaponReward = rewards.find(r => r.type === 'weapon' && r.weaponId)
      const weaponPanel = _weaponPanel(result, weaponReward)
      if (weaponPanel) panels.push(weaponPanel)
    }
  } else {
    const repeatPanel = _repeatPanel(g, result)
    if (repeatPanel) panels.push(repeatPanel)
  }
  if (!panels.length) return null
  return {
    panels,
    panelIdx: 0,
    state: 'choose',
    timer: 0,
    selectedIdx: -1,
    slots: new Array(CHEST_SLOT_COUNT).fill(null),
  }
}

function currentPanel(chestState) {
  if (!chestState || !chestState.panels) return null
  return chestState.panels[chestState.panelIdx || 0] || null
}

function reveal(chestState, selectedIdx) {
  const panel = currentPanel(chestState)
  if (!panel || chestState.state !== 'choose') return false
  const idx = Math.max(0, Math.min(CHEST_SLOT_COUNT - 1, selectedIdx | 0))
  const hooks = _takeFill(panel.hooks || [], CHEST_SLOT_COUNT - 1)
  const slots = []
  let hookIdx = 0
  for (let i = 0; i < CHEST_SLOT_COUNT; i++) {
    slots.push(i === idx ? panel.actual : hooks[hookIdx++])
  }
  chestState.selectedIdx = idx
  chestState.slots = slots
  chestState.state = 'revealing'
  chestState.revealTimer = 0
  // 先只展示选中匣；满延迟或用户点击后再翻开其余宝箱
  chestState.chestRestRevealed = false
  chestState.restRevealStartFrame = 0
  return true
}

function nextPanelOrFinish(g) {
  const chestState = g && g._stageChestRewardPanel
  if (!chestState) return true
  if ((chestState.panelIdx || 0) < chestState.panels.length - 1) {
    chestState.panelIdx = (chestState.panelIdx || 0) + 1
    chestState.state = 'choose'
    chestState.timer = 0
    chestState.selectedIdx = -1
    chestState.revealTimer = 0
    chestState.chestRestRevealed = false
    chestState.restRevealStartFrame = 0
    chestState.slots = new Array(CHEST_SLOT_COUNT).fill(null)
    return false
  }
  g._stageChestRewardPanel = null
  g.bState = 'victory'
  g.setScene('stageResult')
  return true
}

module.exports = {
  CHEST_SLOT_COUNT,
  buildStageChestPanels,
  currentPanel,
  reveal,
  nextPanelOrFinish,
}
