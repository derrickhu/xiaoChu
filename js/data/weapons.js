/**
 * 武器系统 — 五行通天塔
 * 5属性 × 10把 = 50把武器
 * 主角仅装备1把，全程生效
 * 武器 = 全队被动/光环效果
 */

const WEAPONS = {
  // ===== 金属性武器（10把） =====
  metal: [
    { id:'wm1',  name:'青锋剑',   desc:'全队攻击力+15%',                     type:'allAtkUp',     pct:15 },
    { id:'wm2',  name:'碎甲刃',   desc:'金属性伤害+35%',                     type:'attrDmgUp',    attr:'metal', pct:35 },
    { id:'wm3',  name:'金罡甲',   desc:'受到所有伤害-20%',                   type:'reduceDmg',    pct:20 },
    { id:'wm4',  name:'聚金珠',   desc:'金珠出现概率大幅提升',               type:'beadRateUp',   attr:'metal' },
    { id:'wm5',  name:'连环金符', desc:'Combo伤害额外+25%',                  type:'comboDmgUp',   pct:25 },
    { id:'wm6',  name:'锐金令',   desc:'消除5个金珠必定暴击',               type:'guaranteeCrit', attr:'metal', minCount:5 },
    { id:'wm7',  name:'金影靴',   desc:'转珠时间+1秒',                       type:'extraTime',    sec:1 },
    { id:'wm8',  name:'吞金甲',   desc:'消除金珠时，回复5%血量',            type:'healOnElim',   attr:'metal', pct:5 },
    { id:'wm9',  name:'镇金印',   desc:'每5层，全队攻击+5%',                type:'perFloorBuff', per:5, pct:5, field:'atk' },
    { id:'wm10', name:'不灭金身', desc:'抵挡1次致死伤害（一局一次）',        type:'revive' },
  ],

  // ===== 木属性武器（10把） =====
  wood: [
    { id:'ww1',  name:'长生木杖', desc:'每回合自动回血5%',                   type:'regenPct',     pct:5 },
    { id:'ww2',  name:'枯木藤甲', desc:'木属性伤害+35%',                     type:'attrDmgUp',    attr:'wood', pct:35 },
    { id:'ww3',  name:'万木符',   desc:'木珠出现概率大幅提升',               type:'beadRateUp',   attr:'wood' },
    { id:'ww4',  name:'回春玉',   desc:'心珠效果+50%',                       type:'heartBoost',   pct:50 },
    { id:'ww5',  name:'青木铠',   desc:'受到伤害-18%',                       type:'reduceDmg',    pct:18 },
    { id:'ww6',  name:'藤萝索',   desc:'消除木珠时回血5%',                   type:'healOnElim',   attr:'wood', pct:5 },
    { id:'ww7',  name:'灵木印',   desc:'血量上限+25%',                       type:'hpMaxUp',      pct:25 },
    { id:'ww8',  name:'生生不息', desc:'Combo时额外回血2%',                  type:'comboHeal',    pct:2 },
    { id:'ww9',  name:'毒藤杖',   desc:'攻击时有概率让怪物中毒',            type:'poisonChance', dmg:15, dur:3, chance:30 },
    { id:'ww10', name:'木灵甲',   desc:'免疫持续伤害',                       type:'immuneDot' },
  ],

  // ===== 水属性武器（10把） =====
  water: [
    { id:'ws1',  name:'沧澜杖',   desc:'水属性伤害+35%',                     type:'attrDmgUp',    attr:'water', pct:35 },
    { id:'ws2',  name:'冰魄甲',   desc:'受到伤害-25%',                       type:'reduceDmg',    pct:25 },
    { id:'ws3',  name:'凝水珠',   desc:'水珠出现概率大幅提升',               type:'beadRateUp',   attr:'water' },
    { id:'ws4',  name:'寒川印',   desc:'被攻击反弹20%伤害',                  type:'reflectPct',   pct:20 },
    { id:'ws5',  name:'静心玉',   desc:'转珠时间+1秒',                       type:'extraTime',    sec:1 },
    { id:'ws6',  name:'流水符',   desc:'Combo伤害+20%',                      type:'comboDmgUp',   pct:20 },
    { id:'ws7',  name:'海灵铠',   desc:'免疫眩晕1次',                        type:'immuneStun' },
    { id:'ws8',  name:'潮声杖',   desc:'怪物眩晕时，我方伤害+40%',          type:'stunBonusDmg', pct:40 },
    { id:'ws9',  name:'水镜盾',   desc:'消除水珠时获得小额护盾',            type:'shieldOnElim', attr:'water', val:15 },
    { id:'ws10', name:'玄冰甲',   desc:'每回合概率挡一次伤害',              type:'blockChance',  chance:20 },
  ],

  // ===== 火属性武器（10把） =====
  fire: [
    { id:'wf1',  name:'焚天剑',   desc:'火属性伤害+40%',                     type:'attrDmgUp',    attr:'fire', pct:40 },
    { id:'wf2',  name:'烈阳珠',   desc:'火珠出现概率大幅提升',               type:'beadRateUp',   attr:'fire' },
    { id:'wf3',  name:'爆炎符',   desc:'暴击率+25%，暴击伤害+40%',          type:'critAll',      critRate:25, critDmg:40 },
    { id:'wf4',  name:'燎原印',   desc:'Combo伤害额外+30%',                  type:'comboDmgUp',   pct:30 },
    { id:'wf5',  name:'火凰甲',   desc:'击杀怪物后回血10%',                  type:'onKillHeal',   pct:10 },
    { id:'wf6',  name:'炎啸刃',   desc:'消除5个火珠触发全体攻击',           type:'aoeOnElim',    attr:'fire', minCount:5 },
    { id:'wf7',  name:'焚心印',   desc:'每段Combo暴击率+5%',                type:'comboToCrit',  pct:5 },
    { id:'wf8',  name:'烈焰铠',   desc:'火属性伤害无视15%防御',             type:'ignoreDefPct', attr:'fire', pct:15 },
    { id:'wf9',  name:'赤焰靴',   desc:'转珠更易形成大Combo',               type:'comboPlus',    count:1 },
    { id:'wf10', name:'浴火印',   desc:'残血时临时提升20%伤害',             type:'lowHpDmgUp',   pct:20, threshold:30 },
  ],

  // ===== 土属性武器（10把） =====
  earth: [
    { id:'we1',  name:'五岳盾',   desc:'土属性伤害+35%',                     type:'attrDmgUp',    attr:'earth', pct:35 },
    { id:'we2',  name:'厚土铠',   desc:'受到伤害-28%',                       type:'reduceDmg',    pct:28 },
    { id:'we3',  name:'镇地珠',   desc:'土珠出现概率大幅提升',               type:'beadRateUp',   attr:'earth' },
    { id:'we4',  name:'磐石印',   desc:'血量上限+30%',                       type:'hpMaxUp',      pct:30 },
    { id:'we5',  name:'山岩符',   desc:'护盾效果+50%',                       type:'shieldBoost',  pct:50 },
    { id:'we6',  name:'镇魔印',   desc:'免疫所有控制',                       type:'immuneCtrl' },
    { id:'we7',  name:'裂地刃',   desc:'消除土珠时获得护盾',                type:'shieldOnElim', attr:'earth', val:20 },
    { id:'we8',  name:'玄武甲',   desc:'被攻击有概率眩晕怪物',              type:'counterStun',  chance:20 },
    { id:'we9',  name:'守山印',   desc:'每5层血量上限+5%',                  type:'perFloorBuff', per:5, pct:5, field:'hpMax' },
    { id:'we10', name:'大地铠',   desc:'不会被负面效果影响',                type:'immuneDebuff' },
  ],
}

// 获取指定属性的所有武器
function getWeaponsByAttr(attr) {
  return WEAPONS[attr] || []
}

// 获取所有武器的平铺列表
function getAllWeapons() {
  const all = []
  for (const attr of ['metal','wood','water','fire','earth']) {
    for (const w of WEAPONS[attr]) {
      all.push({ ...w, attr })
    }
  }
  return all
}

// 按id查找武器
function getWeaponById(id) {
  for (const attr of ['metal','wood','water','fire','earth']) {
    const found = WEAPONS[attr].find(w => w.id === id)
    if (found) return { ...found, attr }
  }
  return null
}

// 随机获取一把指定属性的武器
function randomWeaponByAttr(attr) {
  const pool = WEAPONS[attr]
  return { ...pool[Math.floor(Math.random() * pool.length)], attr }
}

// 随机获取一把任意属性的武器
function randomWeapon() {
  const attrs = ['metal','wood','water','fire','earth']
  const attr = attrs[Math.floor(Math.random() * attrs.length)]
  return randomWeaponByAttr(attr)
}

// 开局随机一把白色武器（从简单效果中选）
function generateStarterWeapon() {
  const attrs = ['metal','wood','water','fire','earth']
  const attr = attrs[Math.floor(Math.random() * attrs.length)]
  // 从前5把（较基础）中随机选
  const pool = WEAPONS[attr].slice(0, 5)
  const w = pool[Math.floor(Math.random() * pool.length)]
  return { ...w, attr }
}

module.exports = {
  WEAPONS,
  getWeaponsByAttr,
  getAllWeapons,
  getWeaponById,
  randomWeaponByAttr,
  randomWeapon,
  generateStarterWeapon,
}
