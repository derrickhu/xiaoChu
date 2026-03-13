/**
 * 渐进式指引管理器
 * 维护 guideFlags 状态，判断指引是否需要触发，管理指引队列
 */

const GUIDE_DEFS = {
  // Phase 3: 爬塔即时指引
  reward_first: {
    steps: [
      { text: '战斗胜利！选择一个奖励来强化你的队伍', position: 'center' },
    ],
  },
  event_adventure: {
    steps: [
      { text: '这是奇遇事件，选择不同选项可获得不同效果', position: 'center' },
    ],
  },
  event_rest: {
    steps: [
      { text: '在休息点可以回血或获得增益，合理选择很重要', position: 'center' },
    ],
  },
  event_shop: {
    steps: [
      { text: '商店消耗血量换取强力道具，量力而行', position: 'center' },
    ],
  },
  elite_first: {
    steps: [
      { text: '精英怪比普通敌人更强，但击败后会掉落法宝！', position: 'center' },
    ],
  },
  boss_first: {
    steps: [
      { text: 'BOSS 拥有特殊技能，注意技能预告并合理应对', position: 'center' },
    ],
  },
  weapon_equip: {
    steps: [
      { text: '你获得了法宝！法宝效果在战斗中自动生效', position: 'center' },
    ],
  },
  buff_first: {
    steps: [
      { text: '这是局内增益，仅本局有效，叠加越多越强', position: 'center' },
    ],
  },

  // Phase 4: 功能解锁指引
  petPool_unlock: {
    steps: [
      { text: '灵宠池已解锁！在这里管理和培养你的灵宠', position: 'bottom', highlightId: 'nav_pet' },
      { text: '点击查看灵宠详情，可以投入经验升级', position: 'center' },
    ],
  },
  cultivation_unlock: {
    steps: [
      { text: '你获得了修炼经验！进入修炼可以消耗修炼点强化属性', position: 'bottom', highlightId: 'nav_cult' },
    ],
  },
  stage_unlock: {
    steps: [
      { text: '灵宠池已达 5 只！固定关卡模式已解锁！', position: 'center' },
      { text: '固定关卡使用灵宠池阵容挑战，修炼加成在此生效', position: 'center' },
    ],
  },
  idle_intro: {
    steps: [
      { text: '派遣灵宠自动修行，每 4 小时产出碎片，用于升星', position: 'center' },
    ],
  },
}

let _currentGuide = null
let _stepIdx = 0
let _queue = []
let _fadeAlpha = 0

function shouldShow(g, guideId) {
  if (!GUIDE_DEFS[guideId]) return false
  return !g.storage.isGuideShown(guideId)
}

function trigger(g, guideId, highlight) {
  if (!shouldShow(g, guideId)) return false
  _queue.push({ id: guideId, highlight })
  if (!_currentGuide) _dequeue(g)
  return true
}

function _dequeue(g) {
  if (_queue.length === 0) {
    _currentGuide = null
    return
  }
  const item = _queue.shift()
  const def = GUIDE_DEFS[item.id]
  _currentGuide = {
    id: item.id,
    steps: def.steps,
    highlight: item.highlight || null,
  }
  _stepIdx = 0
  _fadeAlpha = 0
}

function isActive() {
  return _currentGuide !== null
}

function getCurrent() {
  if (!_currentGuide) return null
  return {
    ..._currentGuide.steps[_stepIdx],
    highlight: _currentGuide.highlight,
    stepIdx: _stepIdx,
    totalSteps: _currentGuide.steps.length,
  }
}

function advance(g) {
  if (!_currentGuide) return
  _stepIdx++
  if (_stepIdx >= _currentGuide.steps.length) {
    g.storage.markGuideShown(_currentGuide.id)
    _dequeue(g)
  }
  _fadeAlpha = 0
}

function updateFade() {
  if (_currentGuide && _fadeAlpha < 1) {
    _fadeAlpha = Math.min(1, _fadeAlpha + 0.06)
  }
}

function getFadeAlpha() {
  return _fadeAlpha
}

function dismiss(g) {
  if (!_currentGuide) return
  g.storage.markGuideShown(_currentGuide.id)
  _currentGuide = null
  _stepIdx = 0
  _queue = []
}

module.exports = {
  shouldShow,
  trigger,
  isActive,
  getCurrent,
  advance,
  updateFade,
  getFadeAlpha,
  dismiss,
  GUIDE_DEFS,
}
