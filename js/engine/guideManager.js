/**
 * 渐进式指引管理器
 * 维护 guideFlags 状态，判断指引是否需要触发，管理指引队列
 *
 * 【文案规范 · 务必遵守】
 * 1. 指引文案里出现"本章/最后一关/章末/终章/还剩 X 关"等 **相对进度描述** 时，
 *    必须与触发条件完全匹配。例如：
 *      - "完成本章" → 只能出现在触发条件为章末关（如 stage_1_8）的引导里
 *      - "最后一关" → 只能出现在确为该章节最后关的引导里（目前每章 8 关）
 *    这类文案一旦关卡结构调整（例如第 1 章从 N 关扩到 N+2 关），必须跟随更新。
 * 2. 中间关卡（如 1-2/1-3 引导）不要描述"本章进度"，改用
 *      - 机制讲解（"试试相克属性"）
 *      - 目标描述（"去击败 XX"）
 *      - 激励话语（"继续加油"）
 * 3. 每章关卡数常量见 stages.js 注释："12章×8关"。若这个数变了，
 *    全局搜索本文件与 lingIdentity.js，检查是否有"本章 / 最后一关 / 第 X 章"的硬编码。
 *
 * 历史教训：早期第一章只规划 3 关时，newbie_continue_1_3 写了"最后一关试炼在眼前啦"，
 * 后续扩到 8 关后没同步修改，玩家在 1-3 就看到"完成本章"，完全跳戏。
 */

const GUIDE_DEFS = {
  // Phase 3: 爬塔即时指引（小灵口吻）
  reward_first: {
    steps: [
      { text: '主人打赢啦！挑一个奖励带走，队伍会更强哦～', position: 'center' },
    ],
  },
  event_adventure: {
    steps: [
      { text: '主人，这是奇遇事件，不同选项效果不一样，小心选～', position: 'center' },
    ],
  },
  event_rest: {
    steps: [
      { text: '休息点可以回血或拿增益——主人根据情况挑一项吧！', position: 'center' },
    ],
  },
  event_shop: {
    steps: [
      { text: '商店用血量换道具，主人量力而行就好～', position: 'center' },
    ],
  },
  elite_first: {
    steps: [
      { text: '主人，精英怪比普通怪硬不少，但赢了会掉法宝哦！', position: 'center' },
    ],
  },
  boss_first: {
    steps: [
      { text: '主人小心，BOSS 有大招，看清预告再应对～', position: 'center' },
    ],
  },
  weapon_equip: {
    steps: [
      { text: '主人拿到新法宝啦！它的效果在战斗中会自动生效～', position: 'center' },
    ],
  },
  buff_first: {
    steps: [
      { text: '这是局内增益哦，只在这一局有用，多叠几层更爽～', position: 'center' },
    ],
  },

  // Phase 4: 功能解锁指引
  dex_unlock: {
    steps: [
      { text: '主人，图鉴解锁啦～你遇到过的灵宠都在这里', position: 'bottom', highlightId: 'nav_dex' },
      { text: '每只灵宠的属性技能都会被记下，集齐图鉴是修仙大目标！', position: 'center' },
    ],
  },
  petPool_unlock: {
    steps: [
      { text: '恭喜主人～第一只二星灵宠永久入伙，灵宠池和图鉴都解锁啦！', position: 'bottom', highlightId: 'nav_pet' },
      { text: '灵宠池是主人永久伙伴的家，强化后能上灵兽秘境～', position: 'center', highlightId: 'nav_pet' },
      { text: '图鉴记录所有遇到过的灵宠，解锁后就能带它们出战啦！', position: 'bottom', highlightId: 'nav_dex' },
    ],
  },
  cultivation_unlock: {
    steps: [
      { text: '主人拿到修炼经验啦～点修炼可以消耗修炼点强化属性哦', position: 'bottom', highlightId: 'nav_cult' },
    ],
  },
  stage_unlock: {
    steps: [
      { text: '灵宠池已经 5 只啦——灵兽秘境解锁！', position: 'center' },
      { text: '秘境用灵宠池阵容出战，修炼加成在这里完全生效哦～', position: 'center' },
    ],
  },
  idle_intro: {
    steps: [
      {
        text: '主人看这个亮框～\n点「点击派遣」空位再挑一只灵宠上，\n派遣后每 4 小时小灵帮你收碎片！',
        position: 'top',
        highlightId: 'idle_dispatch_slot',
        showFinger: true,
      },
    ],
  },

  // 新手秘境引导序列（漫画结束后触发，渐进式引导到主玩法）
  newbie_stage_start: {
    steps: [
      { text: '主人，灵兽秘境在召唤啦！\n点下方按钮，我们一起去冒险！', position: 'bottom' },
    ],
  },
  newbie_stage_continue: {
    steps: [
      { text: '首通完成～新伙伴加入主人队伍啦！', position: 'center' },
      { text: '点「灵宠」可以看到主人的队伍，\n在那里还能培养和强化它们哦', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 从灵宠池/派遣返回主页后触发（1-1 完成 → 引导到 1-2）
  newbie_continue_1_2: {
    steps: [
      { text: '接下来继续挑战下一关～\n打怪收更多灵宠和资源，主人加油！', position: 'bottom' },
    ],
  },
  // 1-2 完成 → 引导到 1-3（五行相克教学关，敌方为水属性·碧潮鲸）
  // 注意：1-3 只是第 1 章第 3 关，本章共 8 关，文案禁止出现"最后一关/完成本章"等相对进度词
  newbie_continue_1_3: {
    steps: [
      { text: '下一关登场的是碧潮鲸～\n试着用相克属性对付它，主人加油！', position: 'bottom' },
    ],
  },
  // 1-3 通关后进灵宠池：引导养成首触（此时距离本章通关还早，文案聚焦"带队伍变强"而非"章节进度"）
  newbie_grow_intro: {
    steps: [
      { text: '打得不错主人～一起去看看灵宠队伍吧', position: 'center' },
      { text: '用灵石给灵宠升级～\n升到一定等级就能解锁升星功能哦！', position: 'center' },
    ],
  },
  // 碎片够但等级不够：提示先升级
  starup_level_hint: {
    steps: [
      { text: '主人，有灵宠的碎片已经攒够升星啦～\n但它还要升到 10 级才能解锁升星和技能哦', position: 'center' },
      { text: '点「灵宠」看详情，先把等级拉起来！', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 碎片和等级都够：引导升星
  starup_intro: {
    steps: [
      { text: '主人主人～这只灵宠升星条件齐啦！\n升星会解锁强力技能哦', position: 'center' },
      { text: '去「灵宠」详情页点升星吧！', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  newbie_team_ready: {
    steps: [
      { text: '灵宠都就绪啦！', position: 'center' },
      { text: '点「修炼」消耗经验强化体质～\n血量、护盾、转珠时间都能提升哦', position: 'bottom', highlightId: 'nav_cult' },
    ],
  },
  // 第 1 章通关后触发：养成总引导（综合引导升级、升星、修炼的作用）
  chapter1_grow_summary: {
    steps: [
      { text: '恭喜主人完成第 1 章～\n后面的挑战需要更强的阵容了哦', position: 'center' },
      { text: '升级：消耗灵石提升等级，\n等级越高攻击越高～', position: 'center' },
      { text: '升星：满足等级+碎片即可升星，\n★2 解锁技能 / ★3 技能强化 / ★4 获得被动', position: 'center' },
      { text: '去灵宠详情页看完整成长路线，\n主人规划一下强化目标吧！', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 第 1 章通关 + 养成总引导 + 通天塔解锁后触发
  newbie_after_cult: {
    steps: [
      { text: '主人，新手引导到这里告一段落啦～\n前方还有更多秘境和强敌，\n我们继续强化阵容，一路通天！', position: 'center' },
    ],
  },
  // 第 1 章通关后解锁通天塔
  tower_unlock: {
    steps: [
      { text: '恭喜通关第 1 章～通天塔也解锁啦！', position: 'center' },
      { text: '通天塔是无尽闯关——主人能爬到第几层呢？', position: 'center' },
      { text: '通天塔不消耗体力，每天还有 3 次免费挑战哦', position: 'center' },
      { text: '每天 0 点刷新免费次数和奖励，\n记得回来领塔券～', position: 'center' },
    ],
  },
  // 每日任务 / 签到入口首次说明
  daily_entry_intro: {
    steps: [
      { text: '主人，每日任务和签到是免费福利～\n记得每天回来领灵石、体力和碎片！', position: 'center' },
    ],
  },
  // 派遣首次有可领奖励提示
  idle_collect_hint: {
    steps: [
      { text: '派遣有奖励可领啦！\n进「灵宠」点派遣槽位收一下～', position: 'bottom', highlightId: 'nav_pet' },
    ],
  },
  // 灵宠池首次进入引导
  pet_pool_intro: {
    steps: [
      { text: '主人，这里是灵宠池，管理所有灵宠～', position: 'center' },
      { text: '攒碎片可以升星，\n升星后攻击大幅提升，还能解锁技能哦', position: 'center' },
      { text: '下方「派遣修行」点开，\n灵宠会自动修行，定时回来收碎片！', position: 'center', highlightId: 'idle_btn' },
    ],
  },
  // 灵宠池角标系统引导：首次进池且看到 ⭐ / NEW 时触发一次
  // 目标：用一句话帮玩家建立"卡面颜色 → 含义"的直觉，具体缺什么留到详情页再看
  pet_pool_badge_intro: {
    steps: [
      { text: '主人看这里～\n金色 ⭐ 的灵宠可以推进升星哦，优先关照它们！', position: 'center' },
      { text: '红色 NEW 是刚入伙的新伙伴，\n点进去看看它们的身世和本事吧～', position: 'center' },
      { text: '顶部 ⭐ / NEW 的数字按一下，\n小灵帮主人直接定位到它们～', position: 'center' },
    ],
  },
  // 从派遣返回灵宠池后触发
  newbie_after_dispatch: {
    steps: [
      { text: '派遣好啦～灵宠会自动修行，\n记得定时回来收奖励哦', position: 'center' },
      { text: '走吧主人，回秘境继续战斗～\n再多收些灵宠壮大队伍！', position: 'bottom', highlightId: 'nav_stage' },
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
