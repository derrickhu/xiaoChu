/**
 * 塔内奇遇 / 商店 / 休息 / 三选一 Buff 池
 * 所有 pct / val / weight 数值集中于此，调优时只改此文件
 */

// ===== 奇遇事件池 =====
const ADVENTURES = [
  { id:'adv2',  name:'捡到仙丹',   desc:'立即回血50%',              effect:'healPct',     pct:50 },
  { id:'adv3',  name:'上古洞府',   desc:'血量上限+10%',             effect:'hpMaxUp',     pct:10 },
  { id:'adv5',  name:'仙兽引路',   desc:'下一层必定不遇怪',          effect:'skipBattle' },
  { id:'adv6',  name:'秘境泉水',   desc:'满血回复',                  effect:'fullHeal' },
  { id:'adv7',  name:'道骨仙风',   desc:'转珠时间+0.5秒',           effect:'extraTime',   sec:0.5 },
  { id:'adv8',  name:'灵石遍地',   desc:'随机强化一只灵兽',          effect:'upgradePet' },
  { id:'adv9',  name:'仙光护体',   desc:'获得一层临时护盾',          effect:'shield',      val:50 },
  { id:'adv10', name:'古符现世',   desc:'下次战斗怪物眩晕一回合',    effect:'nextStun' },
  { id:'adv11', name:'草木滋养',   desc:'木属性伤害+5%',            effect:'attrDmgUp',   attr:'wood', pct:5 },
  { id:'adv12', name:'金水相合',   desc:'金属性+水属性伤害+5%',     effect:'multiAttrUp', attrs:['metal','water'], pct:5 },
  { id:'adv13', name:'火焰赐福',   desc:'火属性伤害+8%',            effect:'attrDmgUp',   attr:'fire', pct:8 },
  { id:'adv14', name:'大地加持',   desc:'土属性伤害+5%',            effect:'attrDmgUp',   attr:'earth', pct:5 },
  { id:'adv15', name:'道心稳固',   desc:'下次战斗Combo不会断',      effect:'comboNeverBreak' },
  { id:'adv17', name:'无尘之地',   desc:'清除所有负面状态',          effect:'clearDebuff' },
  { id:'adv18', name:'灵泉洗礼',   desc:'心珠效果+20%',             effect:'heartBoost',  pct:20 },
  { id:'adv19', name:'神兵残影',   desc:'法宝效果临时提升20%',       effect:'weaponBoost', pct:20 },
  { id:'adv22', name:'妖巢宝箱',   desc:'全队攻击+8%持续本局',       effect:'allDmgUp',    pct:8 },
  { id:'adv23', name:'上古战魂',   desc:'下一层伤害翻倍',            effect:'nextDmgDouble' },
  { id:'adv24', name:'静心咒',     desc:'转珠时间+1秒',             effect:'extraTime',   sec:1 },
  { id:'adv25', name:'天护',       desc:'抵挡一次致命攻击',          effect:'tempRevive' },
  { id:'adv26', name:'灵兽觉醒',   desc:'随机一只灵兽攻击+10%',     effect:'petAtkUp',    pct:10 },
  { id:'adv27', name:'仙酿',       desc:'回血70%',                  effect:'healPct',     pct:70 },
  { id:'adv28', name:'地脉之力',   desc:'下回合必定高珠掉落',        effect:'goodBeads' },
  { id:'adv29', name:'破邪',       desc:'免疫下一次控制',            effect:'immuneOnce' },
  { id:'adv30', name:'机缘',       desc:'直接获得三选一奖励',        effect:'tripleChoice' },
]

// ===== 商店物品池 =====
const SHOP_ITEMS = [
  { id:'shop4',  name:'攻击秘药',   desc:'选择一只灵兽，攻击+25%',   effect:'upgradePet',   pct:25, weight:6, rarity:'rare' },
  { id:'shop5',  name:'悟道丹',     desc:'选择一只灵兽，技能CD-1',   effect:'cdReduce',     weight:3,  rarity:'epic' },
  { id:'shop6',  name:'满血回复',   desc:'血量恢复至上限',           effect:'fullHeal',     weight:10, rarity:'normal' },
  { id:'shop7',  name:'血脉丹',     desc:'血量上限+15%',             effect:'hpMaxUp',      pct:15, weight:10, rarity:'normal' },
  { id:'shop8',  name:'护身符',     desc:'永久受伤减免+8%',          effect:'dmgReduce',    pct:8, weight:6, rarity:'rare' },
  { id:'shop9',  name:'还魂玉',     desc:'获得1次额外复活机会',      effect:'extraRevive',  weight:6,  rarity:'rare' },
  { id:'shop10', name:'灵力结晶',   desc:'全队技能伤害+15%',         effect:'skillDmgUp',   pct:15, weight:10, rarity:'normal' },
]

// ===== 休息之地选项 =====
const REST_OPTIONS = [
  { id:'rest1', name:'休息回血', desc:'回复35%最大血量', effect:'healPct', pct:35 },
  { id:'rest2', name:'修炼增强', desc:'获得临时小BUFF（攻击+5%）', effect:'allAtkUp', pct:5 },
]

// ===== 加成奖励池 =====
const BUFF_POOL_MINOR = [
  { id:'m1',  label:'全队攻击 +12%',          buff:'allAtkPct',       val:12 },
  { id:'m2',  label:'全队攻击 +15%',          buff:'allAtkPct',       val:15 },
  { id:'m5',  label:'心珠回复 +20%',          buff:'heartBoostPct',   val:20 },
  { id:'m6',  label:'Combo伤害 +12%',         buff:'comboDmgPct',     val:12 },
  { id:'m7',  label:'3消伤害 +15%',           buff:'elim3DmgPct',     val:15 },
  { id:'m8',  label:'转珠时间 +0.5秒',        buff:'extraTimeSec',    val:0.5 },
  { id:'m9',  label:'每回合回血 +5',           buff:'regenPerTurn',    val:5 },
  { id:'m10', label:'受伤减免 -8%',           buff:'dmgReducePct',    val:8 },
  { id:'m11', label:'怪物攻击 -8%',           buff:'enemyAtkReducePct', val:8 },
  { id:'m12', label:'怪物血量 -8%',           buff:'enemyHpReducePct',  val:8 },
  { id:'m13', label:'立即恢复40%血量',        buff:'healNow',         val:40 },
  { id:'m14', label:'战后额外回血15%',        buff:'postBattleHeal',  val:15 },
]

const BUFF_POOL_MEDIUM = [
  { id:'e1',  label:'全队攻击 +15%',          buff:'allAtkPct',       val:15 },
  { id:'e3',  label:'心珠回复 +25%',          buff:'heartBoostPct',   val:25 },
  { id:'e4',  label:'Combo伤害 +15%',         buff:'comboDmgPct',     val:15 },
  { id:'e5',  label:'4消伤害 +20%',           buff:'elim4DmgPct',     val:20 },
  { id:'e6',  label:'克制伤害 +15%',          buff:'counterDmgPct',   val:15 },
  { id:'e7',  label:'技能伤害 +15%',          buff:'skillDmgPct',     val:15 },
  { id:'e8',  label:'技能CD -15%',            buff:'skillCdReducePct',val:15 },
  { id:'e9',  label:'转珠时间 +1秒',          buff:'extraTimeSec',    val:1 },
  { id:'e10', label:'每回合回血 +5',           buff:'regenPerTurn',    val:5 },
  { id:'e11', label:'受伤减免 -10%',          buff:'dmgReducePct',    val:10 },
  { id:'e12', label:'精英攻击 -10%',          buff:'eliteAtkReducePct', val:10 },
  { id:'e13', label:'精英血量 -10%',          buff:'eliteHpReducePct',  val:10 },
  { id:'e14', label:'立即恢复50%血量',        buff:'healNow',         val:50 },
  { id:'e15', label:'下场减伤30%',            buff:'nextDmgReduce',   val:30 },
  { id:'e16', label:'战后额外回血20%',        buff:'postBattleHeal',  val:20 },
]

const BUFF_POOL_MAJOR = [
  { id:'M1',  label:'全队攻击 +25%',          buff:'allAtkPct',       val:25 },
  { id:'M3',  label:'心珠回复 +40%',          buff:'heartBoostPct',   val:40 },
  { id:'M4',  label:'Combo伤害 +25%',         buff:'comboDmgPct',     val:25 },
  { id:'M5',  label:'5消伤害 +30%',           buff:'elim5DmgPct',     val:30 },
  { id:'M6',  label:'克制伤害 +25%',          buff:'counterDmgPct',   val:25 },
  { id:'M7',  label:'技能伤害 +25%',          buff:'skillDmgPct',     val:25 },
  { id:'M8',  label:'技能CD -25%',            buff:'skillCdReducePct',val:25 },
  { id:'M9',  label:'转珠时间 +1.5秒',        buff:'extraTimeSec',    val:1.5 },
  { id:'M10', label:'每回合回血 +8',           buff:'regenPerTurn',    val:8 },
  { id:'M11', label:'受伤减免 -15%',          buff:'dmgReducePct',    val:15 },
  { id:'M12', label:'额外 +2连击',            buff:'bonusCombo',      val:2 },
  { id:'M13', label:'5消眩晕 +2回合',         buff:'stunDurBonus',    val:2 },
  { id:'M14', label:'BOSS攻击 -15%',          buff:'bossAtkReducePct', val:15 },
  { id:'M15', label:'BOSS血量 -15%',          buff:'bossHpReducePct',  val:15 },
  { id:'M16', label:'立即恢复100%血量',       buff:'healNow',         val:100 },
  { id:'M17', label:'下场减伤50%',            buff:'nextDmgReduce',   val:50 },
  { id:'M18', label:'额外1次复活机会',        buff:'extraRevive',     val:1 },
]

const BUFF_POOL_SPEEDKILL = [
  { id:'s1',  label:'[速通] 回复40%血量',       buff:'healNow',           val:40 },
  { id:'s2',  label:'[速通] 全队攻击 +12%',     buff:'allAtkPct',         val:12 },
  { id:'s4',  label:'[速通] 心珠效果 +20%',     buff:'heartBoostPct',     val:20 },
  { id:'s5',  label:'[速通] 怪物血量 -8%',      buff:'enemyHpReducePct',  val:8 },
  { id:'s6',  label:'[速通] 转珠时间 +0.8秒',   buff:'extraTimeSec',      val:0.8 },
  { id:'s7',  label:'[速通] 回血 +5/回合',      buff:'regenPerTurn',      val:5 },
  { id:'s8',  label:'[速通] 受伤 -8%',          buff:'dmgReducePct',      val:8 },
  { id:'s9',  label:'[速通] Combo伤害 +12%',    buff:'comboDmgPct',       val:12 },
  { id:'s10', label:'[速通] 技能伤害 +12%',     buff:'skillDmgPct',       val:12 },
  { id:'s11', label:'[速通] 下场首回合伤害翻倍', buff:'nextFirstTurnDouble', val:1 },
  { id:'s12', label:'[速通] 下场敌人眩晕1回合', buff:'nextStunEnemy',      val:1 },
  { id:'s13', label:'[速通] 获得60点护盾',      buff:'grantShield',        val:60 },
  { id:'s14', label:'[速通] 技能CD全部重置',    buff:'resetAllCd',         val:1 },
  { id:'s15', label:'[速通] 跳过下一场战斗',    buff:'skipNextBattle',     val:1 },
  { id:'s16', label:'[速通] 下场免疫一次伤害',  buff:'immuneOnce',         val:1 },
]

module.exports = {
  ADVENTURES,
  SHOP_ITEMS,
  REST_OPTIONS,
  BUFF_POOL_MINOR,
  BUFF_POOL_MEDIUM,
  BUFF_POOL_MAJOR,
  BUFF_POOL_SPEEDKILL,
}
