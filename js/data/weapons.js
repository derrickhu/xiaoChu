/**
 * 法宝系统 — 灵宠消消塔
 * 50件法宝，不分属性
 * 主角仅装备1件，全程生效
 * 法宝 = 被动技能（类似队长技能）
 * 法宝本身无属性、无攻击值
 * 某些法宝的效果可针对特定属性（用效果内嵌的 attr 字段表示）
 */

const WEAPONS = [
  // --- 攻击增伤类 ---
  { id:'w1',  name:'天机镜',     desc:'全队攻击力+15%',                     type:'allAtkUp',      pct:15 },
  { id:'w2',  name:'破军钟',     desc:'金属性伤害+35%',                     type:'attrDmgUp',     attr:'metal', pct:35 },
  { id:'w3',  name:'碧落仙葫',   desc:'木属性伤害+35%',                     type:'attrDmgUp',     attr:'wood', pct:35 },
  { id:'w4',  name:'沧海玄珠',   desc:'水属性伤害+35%',                     type:'attrDmgUp',     attr:'water', pct:35 },
  { id:'w5',  name:'赤霄神灯',   desc:'火属性伤害+40%',                     type:'attrDmgUp',     attr:'fire', pct:40 },
  { id:'w6',  name:'昆仑玉璧',   desc:'土属性伤害+35%',                     type:'attrDmgUp',     attr:'earth', pct:35 },
  { id:'w7',  name:'八卦金盘',   desc:'Combo伤害额外+25%',                  type:'comboDmgUp',    pct:25 },
  { id:'w8',  name:'流云仙扇',   desc:'降低敌方攻击力15%',                  type:'weakenEnemy',   pct:15 },
  { id:'w9',  name:'燎原宝塔',   desc:'火属性宠物攻击力+30%',              type:'attrPetAtkUp',  attr:'fire', pct:30 },

  // --- 暴击类 ---
  { id:'w10', name:'火凤令牌',   desc:'暴击率+25%，暴击伤害+40%',          type:'critAll',       critRate:25, critDmg:40 },
  { id:'w11', name:'紫金葫芦',   desc:'消除5个金珠必定暴击',               type:'guaranteeCrit', attr:'metal', minCount:5 },
  { id:'w12', name:'焚心宝印',   desc:'每段Combo暴击率+5%',                type:'comboToCrit',   pct:5 },

  // --- 防御减伤类 ---
  { id:'w13', name:'玄铁如意',   desc:'金属性宠物攻击力+30%',              type:'attrPetAtkUp',  attr:'metal', pct:30 },
  { id:'w14', name:'藤甲天衣',   desc:'受到土属性怪普攻伤害-30%',           type:'reduceAttrAtkDmg', attr:'earth', pct:30 },
  { id:'w15', name:'寒冰宝鉴',   desc:'受到敌方直接技能伤害-25%',           type:'reduceSkillDmg', pct:25 },
  { id:'w16', name:'厚土宝甲',   desc:'受到所有伤害-15%',                   type:'reduceDmg',     pct:15 },
  { id:'w17', name:'烈焰神甲',   desc:'受到金属性怪普攻伤害-30%',           type:'reduceAttrAtkDmg', attr:'metal', pct:30 },

  // --- 回血治疗类 ---
  { id:'w18', name:'万寿青莲',   desc:'每回合自动回血5%',                   type:'regenPct',      pct:5 },
  { id:'w19', name:'九转金丹',   desc:'消除金珠时回复5%血量',              type:'healOnElim',    attr:'metal', pct:5 },
  { id:'w20', name:'缠枝灵索',   desc:'消除木珠时回血5%',                   type:'healOnElim',    attr:'wood', pct:5 },
  { id:'w21', name:'凤血丹炉',   desc:'击杀怪物后回血10%',                  type:'onKillHeal',    pct:10 },
  { id:'w22', name:'长生玉牌',   desc:'Combo时额外回血2%',                  type:'comboHeal',     pct:2 },
  { id:'w23', name:'玲珑玉净瓶', desc:'心珠效果+50%',                       type:'heartBoost',    pct:50 },

  // --- 血量护盾类 ---
  { id:'w24', name:'建木神符',   desc:'血量上限+25%',                       type:'hpMaxUp',       pct:25 },
  { id:'w25', name:'磐石仙鼎',   desc:'土属性伤害无视怪物防御',            type:'ignoreDefPct',  attr:'earth', pct:100 },
  { id:'w26', name:'水月宝镜',   desc:'消除水珠时获得小额护盾',            type:'shieldOnElim',  attr:'water', val:15 },
  { id:'w27', name:'开山神斧',   desc:'消除土珠时获得护盾',                type:'shieldOnElim',  attr:'earth', val:20 },
  { id:'w28', name:'山河社稷图', desc:'护盾效果+50%',                       type:'shieldBoost',   pct:50 },
  { id:'w29', name:'不灭金身',   desc:'抵挡1次致死伤害（一局一次）',        type:'revive' },

  // --- 珠率提升类 ---
  { id:'w30', name:'聚灵金铃',   desc:'金珠出现概率大幅提升',               type:'beadRateUp',    attr:'metal' },
  { id:'w31', name:'扶桑神木',   desc:'木珠出现概率大幅提升',               type:'beadRateUp',    attr:'wood' },
  { id:'w32', name:'潮汐法螺',   desc:'水珠出现概率大幅提升',               type:'beadRateUp',    attr:'water' },
  { id:'w33', name:'三昧真火扇', desc:'火珠出现概率大幅提升',               type:'beadRateUp',    attr:'fire' },
  { id:'w34', name:'息壤神珠',   desc:'土珠出现概率大幅提升',               type:'beadRateUp',    attr:'earth' },

  // --- 转珠操控类 ---
  { id:'w35', name:'金翼飞轮',   desc:'敌人残血10%以下时直接斩杀',          type:'execute',       threshold:10 },
  { id:'w36', name:'定水神针',   desc:'消除5个水珠必定暴击',               type:'guaranteeCrit', attr:'water', minCount:5 },
  { id:'w37', name:'踏火风火轮', desc:'转珠时间+2秒',                     type:'extraTime',     sec:2 },

  // --- 特殊触发类 ---
  { id:'w38', name:'炎龙法珠',   desc:'消除5火珠触发额外攻击',             type:'aoeOnElim',     attr:'fire', minCount:5 },
  { id:'w39', name:'蛊雕毒珠',   desc:'攻击时有概率让怪物中毒',            type:'poisonChance',  dmg:15, dur:3, chance:30 },
  { id:'w40', name:'玄龟宝印',   desc:'被攻击反弹20%伤害',                  type:'reflectPct',    pct:20 },
  { id:'w41', name:'玄武宝令',   desc:'被攻击有概率眩晕怪物',              type:'counterStun',   chance:20 },
  { id:'w42', name:'碧波神灯',   desc:'怪物眩晕时，我方伤害+40%',          type:'stunBonusDmg',  pct:40 },
  { id:'w43', name:'浴火金莲',   desc:'残血时临时提升20%伤害',             type:'lowHpDmgUp',    pct:20, threshold:30 },

  // --- 免疫类 ---
  { id:'w44', name:'鲛人泪珠',   desc:'永久免疫眩晕',                       type:'immuneStun' },
  { id:'w45', name:'灵木仙屏',   desc:'免疫持续伤害',                       type:'immuneDot' },
  { id:'w46', name:'镇妖宝塔',   desc:'破防：怪物防御值变为0',              type:'breakDef' },
  { id:'w47', name:'混元宝伞',   desc:'不会被负面效果影响',                type:'immuneDebuff' },

  // --- 层数成长类 ---
  { id:'w48', name:'镇岳金印',   desc:'每5层，全队攻击+5%',                type:'perFloorBuff',  per:5, pct:5, field:'atk' },
  { id:'w49', name:'九鼎神印',   desc:'每5层血量上限+5%',                  type:'perFloorBuff',  per:5, pct:5, field:'hpMax' },
  { id:'w50', name:'玄冰琉璃',   desc:'每回合概率挡一次伤害',              type:'blockChance',   chance:20 },
]

// 获取所有法宝
function getAllWeapons() {
  return WEAPONS.slice()
}

// 按id查找法宝
function getWeaponById(id) {
  return WEAPONS.find(w => w.id === id) || null
}

// 随机获取一件法宝（可传入排除ID集合）
function randomWeapon(excludeIds) {
  if (excludeIds && excludeIds.size > 0) {
    const pool = WEAPONS.filter(w => !excludeIds.has(w.id))
    if (pool.length > 0) return { ...pool[Math.floor(Math.random() * pool.length)] }
  }
  return { ...WEAPONS[Math.floor(Math.random() * WEAPONS.length)] }
}

// 开局随机一件基础法宝（从前20件较基础效果中选）
function generateStarterWeapon() {
  const pool = WEAPONS.slice(0, 20)
  return { ...pool[Math.floor(Math.random() * pool.length)] }
}

module.exports = {
  WEAPONS,
  getAllWeapons,
  getWeaponById,
  randomWeapon,
  generateStarterWeapon,
}
