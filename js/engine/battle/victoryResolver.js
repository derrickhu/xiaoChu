/**
 * 战斗胜利统一结算器
 *
 * 把"敌人 HP ≤ 0 → 胜利"这条流水线从 6 处散点收敛到一处：
 *   - lastTurnCount / lastSpeedKill / runTotalTurns 一次写入，避免散点复制粘贴
 *   - 修正 turnCount 语义：
 *       内部 turnCount 的含义是"已完成完整 round 数（玩家+敌人各行动一遍）"，
 *       击杀敌人的那一把操作属于"下一回合的玩家阶段"，
 *       所以对玩家可见的"本场战斗回合数 = turnCount + 1"，
 *       不然"一击秒杀"会记 0 回合，导致通天塔 runTotalTurns 被系统性压低。
 *   - 敌人死亡动画 / 音乐 / bState 切换统一触发，避免 DOT、AOE 击杀遗漏
 *   - 未来新增"胜利时触发 X"只改这里
 */

const MusicMgr = require('../../runtime/music')
const { SPEED_KILL_TURNS } = require('../../data/balance/combat')

const DEATH_ANIM_DURATION = 45

/**
 * 结算战斗胜利。调用方需自行确认 enemy.hp <= 0。
 *
 * @param {object} g
 * @param {object} [opts]
 * @param {boolean} [opts.giveExp=true]     是否发放击杀经验（GM 跳过战斗可关）
 * @param {boolean} [opts.speedKillEligible=true]  是否参与速通判定（GM 强制 false）
 * @param {boolean} [opts.playMusic=true]   是否播放胜利音乐
 * @param {boolean} [opts.deathAnim=true]   是否触发敌人死亡动画
 */
function commitBattleVictory(g, opts) {
  opts = opts || {}
  // 玩家视角：打了几合就是几合。turnCount 是内部完整 round 计数，需 +1 才对齐玩家直觉。
  const battleTurns = (g.turnCount | 0) + 1
  g.lastTurnCount = battleTurns
  g.lastSpeedKill = opts.speedKillEligible === false ? false : (battleTurns <= SPEED_KILL_TURNS)
  g.runTotalTurns = (g.runTotalTurns || 0) + battleTurns

  if (opts.giveExp !== false) {
    // 延迟 require 避开 battle.js ↔ victoryResolver 的循环依赖
    const { addKillExp } = require('../battle.js')
    if (typeof addKillExp === 'function') addKillExp(g)
  }
  if (opts.playMusic !== false) MusicMgr.playVictory()
  g.bState = 'victory'
  if (opts.deathAnim !== false) {
    g._enemyDeathAnim = { timer: 0, duration: DEATH_ANIM_DURATION }
  }
}

module.exports = {
  commitBattleVictory,
}
