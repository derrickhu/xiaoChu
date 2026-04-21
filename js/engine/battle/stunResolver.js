/**
 * 控制效果（眩晕 / 冰冻）统一施加器
 *
 * 游戏内存在两种"跳过普攻"控制，从玩家表现上看是不同皮肤/主题，
 * 但共享绝大部分战斗规则（跳过普攻、stunDurBonus 延长、w42 控制增伤、已控不叠加）。
 * 冰冻额外：期间水属性伤害 +30%（走 damageFormula 的 FREEZE_WATER_DMG_MUL）
 *
 *   眩晕（stun）   —— 金/火/土/木 通用控制，金色星星，文字"眩晕"
 *   冰冻（freeze） —— 水系专属控制，冰蓝色，文字"冰冻"，额外水伤加成
 *
 * 把"施加/免疫/延长/叠加"的散点收敋到这里，
 * 新增任何控制来源只需调用 applyStunToEnemy / applyFreezeToEnemy。
 */
const STUN_BUFF_NAME = '\u7729\u6655' // 眩晕
const FREEZE_BUFF_NAME = '\u51b0\u51bb' // 冰冻

const CONTROL_TYPES = ['stun', 'freeze']

/**
 * 判断一个 buff 是否属于"跳过普攻"类控制 buff。
 * 战斗引擎里所有"敌人是否被控制"的查询都应走这里，
 * 以免散点 `b.type === 'stun'` 漏掉 freeze。
 */
function isEnemyControlBuff(b) {
  return !!b && CONTROL_TYPES.includes(b.type)
}

/**
 * 返回敌人身上当前的控制 buff（若有），用于 UI 查询 / 伤害公式引用。
 */
function findEnemyControlBuff(g) {
  if (!g || !g.enemyBuffs) return null
  return g.enemyBuffs.find(isEnemyControlBuff) || null
}

/**
 * 对敌人施加控制效果（默认眩晕）。
 *
 * @param {object} g         游戏状态
 * @param {number} baseDur   基础回合数（不含 runBuffs 加成）
 * @param {object} [opts]
 * @param {string} [opts.source]       来源标识（'petSkill'|'weapon'|'preBattle'），预留埋点
 * @param {boolean} [opts.applyBonus]  是否叠加 runBuffs.stunDurBonus，默认 true（stun/freeze 都吃）
 * @param {'stun'|'freeze'} [opts.controlType]  控制类型，默认 'stun'
 * @returns {'applied'|'skipped'}
 */
function applyStunToEnemy(g, baseDur, opts) {
  opts = opts || {}
  if (!g.enemy || g.enemy.hp <= 0) return 'skipped'
  let dur = baseDur | 0
  if (dur <= 0) return 'skipped'
  const controlType = CONTROL_TYPES.includes(opts.controlType) ? opts.controlType : 'stun'
  if (opts.applyBonus !== false && g.runBuffs && g.runBuffs.stunDurBonus) {
    dur += g.runBuffs.stunDurBonus
  }
  // 已有任一控制 buff 则跳过（不刷新、不叠加），避免循环锁死
  if (g.enemyBuffs.some(isEnemyControlBuff)) return 'skipped'
  const name = controlType === 'freeze' ? FREEZE_BUFF_NAME : STUN_BUFF_NAME
  g.enemyBuffs.push({ type: controlType, name, dur, bad: true })
  return 'applied'
}

/**
 * 对敌人施加冰冻（applyStunToEnemy 的 freeze 语义化别名）。
 */
function applyFreezeToEnemy(g, baseDur, opts) {
  return applyStunToEnemy(g, baseDur, Object.assign({}, opts || {}, { controlType: 'freeze' }))
}

/**
 * 对玩家施加眩晕（来自敌方技能/Boss 大招）。
 * 注意：玩家不会被冰冻，冰冻仅作为敌方负面；所以这里不需要 controlType。
 *
 * 自动处理所有免疫来源：
 *   - 法宝 immuneStun（w44 鲛人泪珠，永久免疫）
 *   - 技能 immuneCtrl（宠物免控 buff）
 *   - 一次性 immuneOnce（消费后失效）
 *
 * @returns {'applied'|'skipped'|'immune'}
 */
function applyStunToHero(g, dur) {
  if ((dur | 0) <= 0) return 'skipped'
  if (g.weapon && g.weapon.type === 'immuneStun') return 'immune'
  if (g.heroBuffs.some(b => b.type === 'immuneCtrl')) return 'immune'
  if (g.immuneOnce) { g.immuneOnce = false; return 'immune' }
  if (g.heroBuffs.some(b => b.type === 'heroStun')) return 'skipped'
  g.heroBuffs.push({ type: 'heroStun', name: STUN_BUFF_NAME, dur: dur | 0, bad: true })
  return 'applied'
}

module.exports = {
  applyStunToEnemy,
  applyFreezeToEnemy,
  applyStunToHero,
  isEnemyControlBuff,
  findEnemyControlBuff,
  STUN_BUFF_NAME,
  FREEZE_BUFF_NAME,
  CONTROL_TYPES,
}
