/**
 * 塔层系统 — 五行通天塔
 * 随机地图事件 + 怪物生成 + 奇遇 + 商店 + 休息 + BOSS
 * 无局外养成，每局完全重置
 */

const { randomPetByAttr, randomPet } = require('./pets')
const { randomWeapon } = require('./weapons')

// ===== 五行属性基础 =====
const ATTRS = ['metal','wood','earth','water','fire']
const ATTR_NAME = { metal:'金', wood:'木', earth:'土', water:'水', fire:'火' }
const ATTR_COLOR = {
  metal: { main:'#ffd700', bg:'#353520', lt:'#ffed80', dk:'#cca800' },
  wood:  { main:'#4dcc4d', bg:'#153515', lt:'#80ff80', dk:'#20a020' },
  earth: { main:'#d4a056', bg:'#2a2015', lt:'#e8c080', dk:'#a07030' },
  water: { main:'#4dabff', bg:'#152535', lt:'#80ccff', dk:'#2080cc' },
  fire:  { main:'#ff4d4d', bg:'#3a1515', lt:'#ff8080', dk:'#cc2020' },
}
const COUNTER_MAP = { metal:'wood', wood:'earth', earth:'water', water:'fire', fire:'metal' }
const COUNTER_BY  = { wood:'metal', earth:'wood', water:'earth', fire:'water', metal:'fire' }
// 克制倍率（提升至2.5倍，让策略消除更有意义）
const COUNTER_MUL = 2.5      // 克制对方伤害倍率
const COUNTERED_MUL = 0.5    // 被克制伤害倍率

// 棋盘灵珠（含心珠）
const BEAD_ATTRS = ['metal','wood','earth','water','fire','heart']
const BEAD_ATTR_NAME = { ...ATTR_NAME, heart:'心' }
const BEAD_ATTR_COLOR = {
  ...ATTR_COLOR,
  heart: { main:'#ff69b4', bg:'#351525', lt:'#ff99cc', dk:'#cc3080' },
}

// ===== 事件类型 =====
const EVENT_TYPE = {
  BATTLE:  'battle',
  ELITE:   'elite',
  BOSS:    'boss',
  ADVENTURE: 'adventure',
  SHOP:    'shop',
  REST:    'rest',
}

// ===== 事件概率（基础） =====
const BASE_EVENT_WEIGHTS = {
  battle:    70,
  elite:      8,
  adventure:  5,
  shop:       4,
  rest:       3,
}

// ===== 总层数 =====
const MAX_FLOOR = 30

// ===== 怪物数据（按层段，30层制，数值曲线压平，保证后期不会断崖式碾压玩家） =====
// 调优：后期HP从3600降至2000, ATK从75降至40, 整体增长约12~15倍（配合玩家层数成长）
const MONSTER_TIERS = [
  { minFloor:1,   maxFloor:5,   hpMin:100,  hpMax:200,   atkMin:3,   atkMax:5   },
  { minFloor:6,   maxFloor:10,  hpMin:220,  hpMax:400,   atkMin:5,   atkMax:10  },
  { minFloor:11,  maxFloor:15,  hpMin:420,  hpMax:700,   atkMin:9,   atkMax:16  },
  { minFloor:16,  maxFloor:20,  hpMin:720,  hpMax:1100,  atkMin:14,  atkMax:24  },
  { minFloor:21,  maxFloor:25,  hpMin:1100, hpMax:1600,  atkMin:22,  atkMax:34  },
  { minFloor:26,  maxFloor:30,  hpMin:1500, hpMax:2000,  atkMin:30,  atkMax:40  },
]

// 普通怪物名池（按属性）
const MONSTER_NAMES = {
  metal: ['金灵鼠妖','铜甲兵','金锋散修','锐金妖兵','金翎蛮将','天罡妖卫','金鹏妖尊'],
  wood:  ['木灵花妖','藤蔓小精','青木散修','枯藤妖兵','苍木蛮将','灵木妖卫','万木妖尊'],
  earth: ['土灵石怪','泥人兵','黄土散修','山岩妖兵','裂地蛮将','厚土妖卫','磐岩妖尊'],
  water: ['水灵鱼妖','冰魄小精','碧水散修','寒潮妖兵','沧澜蛮将','深渊妖卫','蛟龙妖尊'],
  fire:  ['火灵狐妖','焰灵小精','赤炎散修','爆炎妖兵','焚天蛮将','烈焰妖卫','朱雀妖尊'],
}

// 精英怪物名池
const ELITE_NAMES = {
  metal: ['金甲妖将·碎天','破军金狮','金罡战魔'],
  wood:  ['枯木大妖·噬灵','缠枝毒蛇王','万木妖魔'],
  earth: ['磐岩巨魔·震地','山岳石王','镇地魔将'],
  water: ['深渊蛟魔·溺魂','冰魄仙蛇','寒潮魔将'],
  fire:  ['焚天魔凰·灭世','炎狱妖帝','赤炎魔君'],
}

// 精英怪技能
const ELITE_SKILLS = ['stun','defDown','selfHeal','breakBead','atkBuff']

// BOSS名池（10个，前8个用于1-40层随机，后2个为50/60层固定BOSS）
const BOSS_NAMES = [
  '炼狱守卫·妖兵统领',
  '五行妖将·破阵',
  '天罡妖帝·噬天',
  '混沌魔神·灭世',
  '太古凶兽·吞天',
  '九天妖皇·逆仙',
  '混沌始祖·鸿蒙',
  '天道化身·审判',
]
// 50/60层固定BOSS → 改为20/30层
const BOSS_FINAL = [
  { floor:20, name:'万妖之主·通天',   bossNum:9 },
  { floor:30, name:'无上大妖·超越',   bossNum:10 },
]

// 妖兽技能池（战斗中使用）
const ENEMY_SKILLS = {
  atkBuff:   { name:'妖气暴涨', desc:'攻击提升30%,持续2回合', type:'buff', field:'atk', rate:0.3, dur:2 },
  poison:    { name:'瘴毒',     desc:'每回合造成{val}点伤害,持续3回合', type:'dot', dur:3 },
  seal:      { name:'禁珠咒',   desc:'随机封锁2颗灵珠,持续2回合', type:'seal', count:2, dur:2 },
  convert:   { name:'灵脉紊乱', desc:'随机转换3颗灵珠属性', type:'convert', count:3 },
  aoe:       { name:'妖力横扫', desc:'对修士造成{val}点伤害', type:'aoe' },
  defDown:   { name:'碎甲爪',   desc:'降低修士防御30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵术',   desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
  stun:      { name:'妖力震慑', desc:'眩晕修士，无法操作1回合', type:'stun', dur:1 },
  selfHeal:  { name:'妖力再生', desc:'回复自身15%最大血量', type:'selfHeal', pct:15 },
  breakBead: { name:'碎珠术',   desc:'随机破坏3颗灵珠', type:'breakBead', count:3 },
}

// ===== 奇遇事件（30个） =====
const ADVENTURES = [
  { id:'adv1',  name:'误入灵脉',   desc:'全队攻击+3%',              effect:'allAtkUp',    pct:3 },
  { id:'adv2',  name:'捡到仙丹',   desc:'立即回血50%',              effect:'healPct',     pct:50 },
  { id:'adv3',  name:'上古洞府',   desc:'血量上限+10%',             effect:'hpMaxUp',     pct:10 },
  { id:'adv4',  name:'天降灵物',   desc:'随机获得一件法宝',          effect:'getWeapon' },
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
  { id:'adv16', name:'仙人点化',   desc:'随机获得一只新灵兽',        effect:'getPet' },
  { id:'adv17', name:'无尘之地',   desc:'清除所有负面状态',          effect:'clearDebuff' },
  { id:'adv18', name:'灵泉洗礼',   desc:'心珠效果+20%',             effect:'heartBoost',  pct:20 },
  { id:'adv19', name:'神兵残影',   desc:'法宝效果临时提升20%',       effect:'weaponBoost', pct:20 },
  { id:'adv20', name:'五行调和',   desc:'全属性伤害+3%',            effect:'allDmgUp',    pct:3 },
  { id:'adv21', name:'山神赐福',   desc:'血量上限+8%',              effect:'hpMaxUp',     pct:8 },
  { id:'adv22', name:'妖巢空寂',   desc:'直接跳过一层',              effect:'skipFloor' },
  { id:'adv23', name:'上古战魂',   desc:'下一层伤害翻倍',            effect:'nextDmgDouble' },
  { id:'adv24', name:'静心咒',     desc:'转珠时间+1秒',             effect:'extraTime',   sec:1 },
  { id:'adv25', name:'天护',       desc:'抵挡一次致命攻击',          effect:'tempRevive' },
  { id:'adv26', name:'灵兽觉醒',   desc:'随机一只灵兽攻击+10%',     effect:'petAtkUp',    pct:10 },
  { id:'adv27', name:'仙酿',       desc:'回血70%',                  effect:'healPct',     pct:70 },
  { id:'adv28', name:'地脉之力',   desc:'下回合必定高珠掉落',        effect:'goodBeads' },
  { id:'adv29', name:'破邪',       desc:'免疫下一次控制',            effect:'immuneOnce' },
  { id:'adv30', name:'机缘',       desc:'直接获得三选一奖励',        effect:'tripleChoice' },
]

// ===== 商店物品池（免费兑换） =====
const SHOP_ITEMS = [
  { id:'shop1', name:'随机新灵兽一只', effect:'getPet' },
  { id:'shop2', name:'随机法宝一件',   effect:'getWeapon' },
  { id:'shop3', name:'满血回复',       effect:'fullHeal' },
  { id:'shop4', name:'随机强化一只灵兽（攻击+20%）', effect:'upgradePet', pct:20 },
  { id:'shop5', name:'移除所有负面状态', effect:'clearDebuff' },
  { id:'shop6', name:'血量上限+10%',    effect:'hpMaxUp', pct:10 },
]

// ===== 休息之地选项 =====
const REST_OPTIONS = [
  { id:'rest1', name:'休息回血', desc:'回复50%最大血量', effect:'healPct', pct:50 },
  { id:'rest2', name:'修炼增强', desc:'获得临时小BUFF（攻击+5%）', effect:'allAtkUp', pct:5 },
]

// ===== 胜利后三选一奖励类型 =====
const REWARD_TYPES = {
  NEW_PET:    'newPet',
  NEW_WEAPON: 'newWeapon',
  BUFF:       'buff',       // 全队加成奖励
}

// ===== 加成奖励池（重做：去掉蚊子叮，改为体感明显的变革性效果）=====
// 小档（普通战斗掉落）——每次拿到都能明显感到变强
const BUFF_POOL_MINOR = [
  { id:'m1',  label:'全队攻击 +12%',          buff:'allAtkPct',       val:12 },
  { id:'m2',  label:'全队攻击 +15%',          buff:'allAtkPct',       val:15 },
  { id:'m3',  label:'血量上限 +12%',          buff:'hpMaxPct',        val:12 },
  { id:'m4',  label:'血量上限 +18%',          buff:'hpMaxPct',        val:18 },
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
// 中档（精英战斗掉落）——质变级
const BUFF_POOL_MEDIUM = [
  { id:'e1',  label:'全队攻击 +15%',          buff:'allAtkPct',       val:15 },
  { id:'e2',  label:'血量上限 +20%',          buff:'hpMaxPct',        val:20 },
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
// 大档（BOSS战掉落）——超级强化，拿到就起飞
const BUFF_POOL_MAJOR = [
  { id:'M1',  label:'全队攻击 +25%',          buff:'allAtkPct',       val:25 },
  { id:'M2',  label:'血量上限 +30%',          buff:'hpMaxPct',        val:30 },
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
// 速通奖励池（5回合内击败的额外奖励，独特效果）
const BUFF_POOL_SPEEDKILL = [
  { id:'s1',  label:'[速通] 回复40%血量',       buff:'healNow',           val:40 },
  { id:'s2',  label:'[速通] 全队攻击 +12%',     buff:'allAtkPct',         val:12 },
  { id:'s3',  label:'[速通] 血量上限 +15%',     buff:'hpMaxPct',          val:15 },
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
// 合并所有（兼容旧引用）
const ALL_BUFF_REWARDS = [...BUFF_POOL_MINOR, ...BUFF_POOL_MEDIUM, ...BUFF_POOL_MAJOR]

// ===== 工具函数 =====
function _lerp(a, b, t) { return a + (b - a) * t }
function _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ===== 生成某层怪物 =====
function generateMonster(floor) {
  const attr = _pick(ATTRS)

  // 查找数值段
  let tier = MONSTER_TIERS[MONSTER_TIERS.length - 1]
  for (const t of MONSTER_TIERS) {
    if (floor >= t.minFloor && floor <= t.maxFloor) { tier = t; break }
  }

  // 层段内线性插值
  const progress = Math.min(1, (floor - tier.minFloor) / Math.max(1, tier.maxFloor - tier.minFloor))

  // 增加随机性：基础值±15%波动
  const rand = () => 0.85 + Math.random() * 0.30
  let hp  = Math.round(_lerp(tier.hpMin, tier.hpMax, progress) * rand())
  let atk = Math.round(_lerp(tier.atkMin, tier.atkMax, progress) * rand())

  // 名字：根据层数从弱到强选（30层制，每5层升一档）
  const names = MONSTER_NAMES[attr]
  const nameIdx = Math.min(Math.floor(floor / 5), names.length - 1)
  const name = names[nameIdx]

  // 技能：1-8层无技能，9层起逐步加技能（30层制）
  const skills = []
  const skillPool1 = ['poison','seal','convert']
  const skillPool2 = ['atkBuff','defDown','healBlock']
  if (floor >= 9) skills.push(_pick(skillPool1))
  if (floor >= 18) skills.push(_pick(skillPool2))
  // 25层以上有小概率带第3个技能
  if (floor >= 25 && Math.random() < 0.3) {
    const allSkills = [...skillPool1, ...skillPool2, 'breakBead']
    const extra = _pick(allSkills.filter(s => !skills.includes(s)))
    if (extra) skills.push(extra)
  }

  // 怪物图片
  const attrKeyMap = { metal:'m', wood:'w', earth:'e', water:'s', fire:'f' }
  const monKey = attrKeyMap[attr] || 'm'
  const monIdx = nameIdx + 1

  return { name, attr, hp, maxHp: hp, atk, def: Math.round(atk * 0.35), skills, avatar: `enemies/mon_${monKey}_${monIdx}` }
}

// ===== 生成精英怪 =====
function generateElite(floor) {
  const base = generateMonster(floor)
  const attr = base.attr

  // 精英 = 普通×(2.2~2.8)血 ×(1.6~2.0)攻
  const hpMul = 2.2 + Math.random() * 0.6
  const atkMul = 1.6 + Math.random() * 0.4
  base.hp    = Math.round(base.hp * hpMul)
  base.maxHp = base.hp
  base.atk   = Math.round(base.atk * atkMul)
  base.def   = Math.round(base.def * 1.5)

  // 名称
  base.name = _pick(ELITE_NAMES[attr])
  base.isElite = true

  // 精英必带2个技能
  const skillPool = ['stun','defDown','selfHeal','breakBead','atkBuff','poison','seal']
  const s1 = _pick(skillPool)
  let s2 = _pick(skillPool)
  while (s2 === s1) s2 = _pick(skillPool)
  base.skills = [s1, s2]

  // 精英图片：elite_{属性缩写}_{1-3}，根据名字索引匹配
  const eliteAttrMap = { metal:'m', wood:'w', water:'s', fire:'f', earth:'e' }
  const eliteKey = eliteAttrMap[attr] || 'm'
  const eliteNames = ELITE_NAMES[attr]
  const eliteIdx = eliteNames.indexOf(base.name) + 1 || _rand(1,3)
  base.avatar = `enemies/elite_${eliteKey}_${eliteIdx}`
  // 精英专属战斗背景（每属性3张随机选1张）
  base.battleBg = `enemies/bg_elite_${eliteKey}_${_rand(1,3)}`
  return base
}

// ===== 生成BOSS =====
function generateBoss(floor) {
  const base = generateMonster(floor)

  // BOSS倍率随层数递增（30层制）
  const bossLevel = Math.floor(floor / 10) + 1  // 1~3
  const hpMul  = Math.min(2.5 + (bossLevel - 1) * 0.8, 5)
  const atkMul = Math.min(1.5 + (bossLevel - 1) * 0.3, 2.5)
  const defMul = Math.min(1.2 + (bossLevel - 1) * 0.2, 2)

  base.hp    = Math.round(base.hp * hpMul)
  base.maxHp = base.hp
  base.atk   = Math.round(base.atk * atkMul)
  base.def   = Math.round(base.def * defMul)
  base.isBoss = true
  base.attr   = _pick(ATTRS)

  // 20/30层：固定BOSS
  const finalBoss = BOSS_FINAL.find(b => b.floor === floor)
  if (finalBoss) {
    base.name = finalBoss.name
    base.avatar = `enemies/boss_${finalBoss.bossNum}`
    base.battleBg = `enemies/bg_boss_${finalBoss.bossNum}`
  } else {
    // 10层：从BOSS_NAMES池中随机选
    const idx = Math.floor(Math.random() * BOSS_NAMES.length)
    base.name = BOSS_NAMES[idx]
    const bossNum = idx + 1  // 1~8
    base.avatar = `enemies/boss_${bossNum}`
    base.battleBg = `enemies/bg_boss_${bossNum}`
  }

  // BOSS必带2个技能：控制+减伤/回血
  const ctrlSkills = ['stun','seal','convert']
  const defSkills  = ['selfHeal','atkBuff','defDown','healBlock']
  base.skills = [_pick(ctrlSkills), _pick(defSkills)]
  // 20/30层BOSS额外加第3个技能
  if (finalBoss) {
    const allSkills = [...ctrlSkills, ...defSkills, 'poison', 'breakBead']
    const extra = _pick(allSkills.filter(s => !base.skills.includes(s)))
    if (extra) base.skills.push(extra)
  }

  return base
}

// ===== 生成某层事件 =====
function generateFloorEvent(floor) {
  // 每10层强制BOSS
  if (floor % 10 === 0) {
    return { type: EVENT_TYPE.BOSS, data: generateBoss(floor) }
  }

  // 权重随机事件
  const weights = { ...BASE_EVENT_WEIGHTS }

  // 前2层：只出普通战斗（30层制更快进入完整体验）
  if (floor <= 2) {
    weights.elite = 0
    weights.adventure = 0
    weights.shop = 0
    weights.rest = 0
  } else if (floor <= 4) {
    // 3-4层：开放奇遇和休息
    weights.elite = 0
    weights.shop = 0
    weights.adventure = 8
    weights.rest = 3
  } else {
    // 5层起：全面开放
    weights.elite += Math.floor(floor / 4) * 3
    if (floor % 5 === 0) weights.elite += 18
    weights.adventure += Math.floor(floor / 6) * 2
    weights.shop += Math.floor(floor / 8) * 2
    weights.rest += Math.floor(floor / 8) * 2
    if (floor >= 15) weights.battle -= 10
    if (floor >= 22) weights.battle -= 10
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let eventType = 'battle'

  for (const [type, w] of Object.entries(weights)) {
    roll -= w
    if (roll <= 0) { eventType = type; break }
  }

  switch (eventType) {
    case 'battle':
      return { type: EVENT_TYPE.BATTLE, data: generateMonster(floor) }
    case 'elite':
      return { type: EVENT_TYPE.ELITE, data: generateElite(floor) }
    case 'adventure':
      return { type: EVENT_TYPE.ADVENTURE, data: _pick(ADVENTURES) }
    case 'shop':
      // 随机3个商品
      const items = []
      const pool = [...SHOP_ITEMS]
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length)
        items.push(pool.splice(idx, 1)[0])
      }
      return { type: EVENT_TYPE.SHOP, data: items }
    case 'rest':
      return { type: EVENT_TYPE.REST, data: REST_OPTIONS }
    default:
      return { type: EVENT_TYPE.BATTLE, data: generateMonster(floor) }
  }
}

// ===== 生成胜利后三选一奖励 =====
// eventType: 'battle' | 'elite' | 'boss'
// speedKill: 是否速通（5回合内击败）
function generateRewards(floor, eventType, speedKill) {
  const rewards = []
  const usedIds = new Set()

  // 从指定池中随机选一个不重复的
  function pickFrom(pool) {
    const avail = pool.filter(b => !usedIds.has(b.id))
    if (avail.length === 0) return null
    const b = _pick(avail)
    usedIds.add(b.id)
    return { type: REWARD_TYPES.BUFF, label: b.label, data: { ...b } }
  }

  if (eventType === 'boss') {
    // BOSS战斗：2件法宝 + 1个大档buff 三选一（速通4选1）
    const wpnIds = new Set()
    for (let i = 0; i < 2; i++) {
      let w = randomWeapon()
      let tries = 0
      while (wpnIds.has(w.id) && tries < 20) { w = randomWeapon(); tries++ }
      wpnIds.add(w.id)
      rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
    }
    rewards.push(pickFrom(BUFF_POOL_MAJOR))
  } else if (eventType === 'elite') {
    // 精英战斗：2只灵宠 + 1个中档buff 三选一（速通4选1）
    const petIds = new Set()
    for (let i = 0; i < 2; i++) {
      let p = randomPet()
      let tries = 0
      while (petIds.has(p.id) && tries < 20) { p = randomPet(); tries++ }
      petIds.add(p.id)
      rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${p.name}`, data: p })
    }
    rewards.push(pickFrom(BUFF_POOL_MEDIUM))
  } else {
    // 普通战斗：30%概率掉落宠物（30层制加速build）
    if (Math.random() < 0.30) {
      const newPet = randomPet()
      rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${newPet.name}`, data: newPet })
      rewards.push(pickFrom(BUFF_POOL_MINOR))
      rewards.push(pickFrom(BUFF_POOL_MINOR))
    } else {
      rewards.push(pickFrom(BUFF_POOL_MINOR))
      rewards.push(pickFrom(BUFF_POOL_MINOR))
      rewards.push(pickFrom(BUFF_POOL_MINOR))
    }
  }

  // 速通额外奖励：精英/boss追加同类型第4个选项，普通战追加速通buff
  if (speedKill) {
    if (eventType === 'boss') {
      let w = randomWeapon()
      let tries = 0
      const existIds = new Set(rewards.map(r => r.data && r.data.id))
      while (existIds.has(w.id) && tries < 20) { w = randomWeapon(); tries++ }
      rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
    } else if (eventType === 'elite') {
      let p = randomPet()
      let tries = 0
      const existIds = new Set(rewards.map(r => r.data && r.data.id))
      while (existIds.has(p.id) && tries < 20) { p = randomPet(); tries++ }
      rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${p.name}`, data: p })
    } else {
      const bonus = pickFrom(BUFF_POOL_SPEEDKILL)
      if (bonus) { bonus.isSpeed = true; rewards.push(bonus) }
    }
  }

  // 安全过滤null（池子耗尽情况）
  return rewards.filter(r => r != null)
}

// ===== 灵珠权重（根据属性偏好生成） =====
function getBeadWeights(floorAttr, weapon) {
  const weights = {
    metal: 1, wood: 1, earth: 1, water: 1, fire: 1, heart: 0.8
  }
  // 如果本层有属性偏向，增加该属性珠出现率
  if (floorAttr && weights[floorAttr] !== undefined) {
    weights[floorAttr] = 1.4
  }
  // 法宝beadRateUp效果
  if (weapon && weapon.type === 'beadRateUp' && weapon.attr) {
    weights[weapon.attr] = (weights[weapon.attr] || 1) * 1.5
  }
  return weights
}

module.exports = {
  // 常量
  MAX_FLOOR,
  ATTRS, ATTR_NAME, ATTR_COLOR,
  COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL,
  BEAD_ATTRS, BEAD_ATTR_NAME, BEAD_ATTR_COLOR,
  EVENT_TYPE,
  ENEMY_SKILLS,
  ADVENTURES, SHOP_ITEMS, REST_OPTIONS,
  REWARD_TYPES,
  ALL_BUFF_REWARDS,
  BUFF_POOL_SPEEDKILL,
  MONSTER_NAMES, ELITE_NAMES, BOSS_NAMES, BOSS_FINAL,

  // 生成器
  generateMonster,
  generateElite,
  generateBoss,
  generateFloorEvent,
  generateRewards,
  getBeadWeights,
}
