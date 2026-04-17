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
      { text: '恭喜！首只二星灵宠已永久加入——灵宠池与图鉴同时解锁！', position: 'bottom', highlightId: 'nav_pet' },
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
      {
        text: '点下面亮框里的「点击派遣」空位，再选一只灵宠上阵\n派遣后每 4 小时自动产出碎片',
        position: 'top',
        highlightId: 'idle_dispatch_slot',
        showFinger: true,
      },
    ],
  },

  // 新手秘境引导序列（漫画结束后触发，渐进式引导到主玩法）
  newbie_stage_start: {
    steps: [
      { text: '灵兽秘境在召唤你！\n点击下方按钮，开始第一场冒险！', position: 'bottom' },
    ],
  },
  newbie_stage_continue: {
    steps: [
      { text: '恭喜首通！新的灵宠伙伴已加入你的队伍', position: 'center' },
      { text: '点击「灵宠」查看你的队伍\n在这里可以培养和强化灵宠', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 从灵宠池/派遣返回主页后触发（1-1 完成 → 引导到 1-2）
  newbie_continue_1_2: {
    steps: [
      { text: '继续挑战下一关！\n战胜敌人，收集更多灵宠与资源', position: 'bottom' },
    ],
  },
  // 1-2 完成 → 引导到 1-3
  newbie_continue_1_3: {
    steps: [
      { text: '最后一关试炼！击败碧潮鲸\n巩固技巧，完成本章挑战', position: 'bottom' },
    ],
  },
  // 1-3 通关后进灵宠池：引导养成首触
  newbie_grow_intro: {
    steps: [
      { text: '恭喜通关！去看看你的灵宠队伍吧', position: 'center' },
      { text: '消耗灵石升级灵宠\n提升等级可解锁升星功能！', position: 'center' },
    ],
  },
  // 碎片够但等级不够：提示先升级
  starup_level_hint: {
    steps: [
      { text: '有灵宠的碎片已够升星\n继续投入灵石升到 10 级即可升星解锁技能！', position: 'center' },
      { text: '点击「灵宠」查看详情并升级', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 碎片和等级都够：引导升星
  starup_intro: {
    steps: [
      { text: '灵宠已达到升星条件！\n升星后将解锁强力技能', position: 'center' },
      { text: '点击「灵宠」查看详情并升星', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  newbie_team_ready: {
    steps: [
      { text: '灵宠已就绪！', position: 'center' },
      { text: '点击「修炼」消耗经验强化体质\n提升血量、护盾和转珠时间', position: 'bottom', highlightId: 'nav_cult' },
    ],
  },
  // 第 1 章通关后触发：养成总引导（综合引导升级、升星、修炼的作用）
  chapter1_grow_summary: {
    steps: [
      { text: '恭喜完成第 1 章全部关卡！\n后续挑战需要更强的灵宠阵容', position: 'center' },
      { text: '升级：消耗灵石提升等级\n等级越高攻击力越强', position: 'center' },
      { text: '升星：满足等级+碎片条件即可升星\n★2 解锁技能 / ★3 技能强化 / ★4 获得被动', position: 'center' },
      { text: '去灵宠详情页查看完整成长路线\n规划你的强化目标吧！', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 第 1 章通关 + 养成总引导 + 通天塔解锁后触发
  newbie_after_cult: {
    steps: [
      { text: '新手引导完成！\n前方还有更多秘境和强敌等着你\n继续强化阵容，挑战更高的塔层吧！', position: 'center' },
    ],
  },
  // 第 1 章通关后解锁通天塔
  tower_unlock: {
    steps: [
      { text: '恭喜通关第 1 章！通天塔挑战已解锁！', position: 'center' },
      { text: '通天塔是无尽闯关挑战\n看看你能爬到多高！', position: 'center' },
      { text: '通天塔不消耗体力，每天可免费挑战 3 次\n体力不够时也能来这里战斗！', position: 'center' },
      { text: '每日 0 点刷新免费次数与奖励\n记得每天来挑战领取塔券！', position: 'center' },
    ],
  },
  // 每日任务 / 签到入口首次说明
  daily_entry_intro: {
    steps: [
      { text: '每日任务与签到：免费的每日奖励\n记得每天回来领取灵石、体力和碎片！', position: 'center' },
    ],
  },
  // 派遣首次有可领奖励提示
  idle_collect_hint: {
    steps: [
      { text: '派遣有奖励可领！\n进入「灵宠」点击派遣槽位收取', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 灵宠池首次进入引导
  pet_pool_intro: {
    steps: [
      { text: '这里是灵宠池，管理你的所有灵宠', position: 'center' },
      { text: '收集碎片可以为灵宠升星\n升星后攻击力大幅提升，还能解锁技能', position: 'center' },
      { text: '点击下方「派遣修行」\n灵宠自动修行，定时收取碎片奖励！', position: 'center', highlightId: 'idle_btn' },
    ],
  },
  // 从派遣返回灵宠池后触发
  newbie_after_dispatch: {
    steps: [
      { text: '派遣已设置！灵宠会自动修行\n记得定时回来收取奖励哦', position: 'center' },
      { text: '回到秘境继续战斗\n收集更多灵宠来壮大队伍！', position: 'bottom', highlightId: 'nav_stage' },
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

/**
 * 结束当前引导条目并标记已展示，但保留队列中其他待展示项
 * 目的：不同场景切换时误关引导，不应让尚未触发过的引导被误标记
 */
function dismiss(g) {
  if (!_currentGuide) return
  g.storage.markGuideShown(_currentGuide.id)
  _currentGuide = null
  _stepIdx = 0
  _fadeAlpha = 0
  _dequeue(g)
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
