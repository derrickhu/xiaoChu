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
  dex_unlock: {
    steps: [
      { text: '图鉴已解锁！你遇到过的灵宠都会记录在这里', position: 'bottom', highlightId: 'nav_dex' },
      { text: '图鉴记录每只灵宠的属性与技能，集齐全图鉴是修仙目标之一！', position: 'center' },
    ],
  },
  petPool_unlock: {
    steps: [
      { text: '恭喜！首只三星灵宠已永久加入——灵宠池与图鉴同时解锁！', position: 'bottom', highlightId: 'nav_pet' },
      { text: '灵宠池：在这里培养你的永久伙伴，强化后可用于灵兽秘境等玩法。', position: 'center', highlightId: 'nav_pet' },
      { text: '图鉴：记录你遇到过的每只灵宠，解锁图鉴可带宠出战！', position: 'bottom', highlightId: 'nav_dex' },
    ],
  },
  cultivation_unlock: {
    steps: [
      { text: '你获得了修炼经验！进入修炼可以消耗修炼点强化属性', position: 'bottom', highlightId: 'nav_cult' },
    ],
  },
  stage_unlock: {
    steps: [
      { text: '灵宠池已达 5 只！灵兽秘境已解锁！', position: 'center' },
      { text: '灵兽秘境使用灵宠池阵容出战，修炼加成在此完全生效！', position: 'center' },
    ],
  },
  idle_intro: {
    steps: [
      { text: '派遣灵宠自动修行，每 4 小时产出碎片，用于升星', position: 'center' },
    ],
  },

  // 新手秘境引导序列（漫画结束后触发，渐进式引导到主玩法）
  newbie_stage_start: {
    steps: [
      { text: '灵兽秘境在召唤你！\n点击下方按钮，开始第一场冒险！', position: 'bottom', restrictToHighlight: true },
    ],
  },
  newbie_stage_continue: {
    steps: [
      { text: '恭喜通关！你获得了 3 只灵宠伙伴！\n它们已正式加入你的队伍', position: 'center' },
      { text: '点击「灵宠」查看你的队伍\n在这里可以培养和强化灵宠', position: 'bottom', highlightId: 'nav_pet', restrictToHighlight: true },
    ],
  },
  // 从灵宠池/派遣返回主页后触发
  newbie_after_pets: {
    steps: [
      { text: '继续挑战下一关\n击败更强的敌人，收集新灵宠！', position: 'center' },
    ],
  },
  newbie_team_ready: {
    steps: [
      { text: '五行灵宠集齐！你的队伍已初具规模！', position: 'center' },
      { text: '点击「修炼」消耗经验强化属性\n战斗会更加轻松', position: 'bottom', highlightId: 'nav_cult', restrictToHighlight: true },
    ],
  },
  // 从修炼返回主页后触发
  newbie_after_cult: {
    steps: [
      { text: '新手引导完成！你已掌握所有核心玩法\n接下来尽情探索秘境，不断强化阵容吧！', position: 'center' },
    ],
  },
  // 灵宠池首次进入引导
  pet_pool_intro: {
    steps: [
      { text: '这里是灵宠池，管理你的所有灵宠', position: 'center' },
      { text: '收集碎片可以为灵宠升星\n升星后攻击力大幅提升，还能解锁技能', position: 'center' },
      { text: '点击下方「派遣修行」\n灵宠自动修行，定时收取碎片奖励！', position: 'center', highlightId: 'idle_btn', restrictToHighlight: true },
    ],
  },
  // 从派遣返回灵宠池后触发
  newbie_after_dispatch: {
    steps: [
      { text: '派遣已设置！灵宠会自动修行\n记得定时回来收取奖励哦', position: 'center' },
      { text: '回到秘境继续战斗\n收集更多灵宠来壮大队伍！', position: 'bottom', highlightId: 'nav_stage', restrictToHighlight: true },
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
    guideId: _currentGuide.id,
    highlight: _currentGuide.highlight,
    stepIdx: _stepIdx,
    totalSteps: _currentGuide.steps.length,
  }
}

function getCurrentId() {
  return _currentGuide ? _currentGuide.id : null
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
  // 队列中待展示的指引也一并标记为已展示，避免dismiss后重复触发
  _queue.forEach(item => g.storage.markGuideShown(item.id))
  _currentGuide = null
  _stepIdx = 0
  _queue = []
}

module.exports = {
  shouldShow,
  trigger,
  isActive,
  getCurrent,
  getCurrentId,
  advance,
  updateFade,
  getFadeAlpha,
  dismiss,
  GUIDE_DEFS,
}
