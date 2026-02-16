/**
 * 宠物系统 — 五行通天塔
 * 5属性 × 20只 = 100只宠物
 * 每只宠物：属性 + 基础攻击 + 1个主动技能 + 固定CD
 * 宠物仅在消除对应属性珠时攻击
 */

// ===== 技能效果类型 =====
// dmgBoost  — 下次/本次该属性伤害+X%
// convertBead — 随机N颗珠子变为指定属性
// shield    — 获得护盾(N点)
// reduceDmg — 本回合受到伤害-X%
// stun      — 敌人眩晕N回合（跳过攻击）
// comboPlus — 本次Combo+N（虚拟额外combo段）
// extraTime — 转珠时间+N秒
// ignoreDefPct — 下次该属性攻击无视X%防御
// revive    — 抵挡一次致死伤害（本局1次）
// healPct   — 立即回复X%最大血量
// healFlat  — 立即回复N点血量
// dot       — 敌人中毒/灼烧，每回合N点，持续M回合
// instantDmg — 立即造成一次该属性伤害（倍率pct%基础攻击）
// hpMaxUp   — 血量上限+X%
// heartBoost — 心珠效果+X%（或翻倍1回合）
// allDmgUp  — 全队所有属性伤害+X%，持续N回合
// allAtkUp  — 全队攻击+X%，持续N回合
// allDefUp  — 全队防御+X%，持续N回合
// critBoost — 暴击率+X%，持续N回合
// critDmgUp — 暴击伤害+X%
// reflectPct — 反弹X%伤害，持续N回合
// immuneCtrl — 免疫控制N回合
// beadRateUp — 指定属性珠出现概率大幅提升1回合
// comboNeverBreak — 本次Combo不会断
// healOnElim — 消除该属性珠时回血X%
// shieldOnElim — 消除该属性珠时获得护盾N点
// lowHpDmgUp — 残血时临时伤害+X%
// stunPlusDmg — 眩晕+下次伤害+X%
// fullHeal  — 满血回复
// allHpMaxUp — 全队血量上限+X%
// dmgImmune — 本回合受到伤害变为1点
// guaranteeCrit — 本次攻击必定暴击
// comboDmgUp — Combo伤害额外+X%
// percentAtkUp — 每N层全队攻击+X%（永久叠加）
// onKillHeal — 击杀怪物后回血X%

const PETS = {
  // ===== （一）金属性宠物（20只） =====
  metal: [
    { id:'m1',  name:'金锋灵猫',  atk:7,  skill:{ name:'锋芒', desc:'下次金属性伤害+30%', type:'dmgBoost', attr:'metal', pct:30 }, cd:6 },
    { id:'m2',  name:'锐金鼠将',  atk:8,  skill:{ name:'化金', desc:'随机3颗珠子变为金珠', type:'convertBead', attr:'metal', count:3 }, cd:7 },
    { id:'m3',  name:'玄甲金狮',  atk:8,  skill:{ name:'金甲', desc:'本回合受到伤害-40%', type:'reduceDmg', pct:40 }, cd:8 },
    { id:'m4',  name:'天罡金鹏',  atk:9,  skill:{ name:'金击', desc:'立即造成一次金属性伤害', type:'instantDmg', attr:'metal', pct:150 }, cd:7 },
    { id:'m5',  name:'碎金战将',  atk:10, skill:{ name:'金缚', desc:'敌人眩晕1回合', type:'stun', dur:1 }, cd:9 },
    { id:'m6',  name:'金光剑灵',  atk:10, skill:{ name:'剑意', desc:'本次Combo+2', type:'comboPlus', count:2 }, cd:8 },
    { id:'m7',  name:'金罡守卫',  atk:8,  skill:{ name:'金盾', desc:'获得护盾（50点）', type:'shield', val:50 }, cd:9 },
    { id:'m8',  name:'鸣金神雀',  atk:9,  skill:{ name:'鸣金', desc:'转珠时间+2秒', type:'extraTime', sec:2 }, cd:10 },
    { id:'m9',  name:'破甲金将',  atk:11, skill:{ name:'破甲', desc:'下次金攻无视50%防御', type:'ignoreDefPct', attr:'metal', pct:50 }, cd:8 },
    { id:'m10', name:'九天金凰',  atk:11, skill:{ name:'金身', desc:'抵挡一次致死伤害（本局1次）', type:'revive' }, cd:12 },
    { id:'m11', name:'锐金斥候',  atk:10, skill:{ name:'锐金', desc:'下次金属性伤害+60%', type:'dmgBoost', attr:'metal', pct:60 }, cd:7 },
    { id:'m12', name:'金纹战将',  atk:10, skill:{ name:'金愈', desc:'消除金珠时回血10%', type:'healOnElim', attr:'metal', pct:10 }, cd:8 },
    { id:'m13', name:'金影刺客',  atk:11, skill:{ name:'金刺', desc:'消除5个金珠必定暴击', type:'guaranteeCrit', attr:'metal', minCount:5 }, cd:9 },
    { id:'m14', name:'金甲神卫',  atk:9,  skill:{ name:'神卫', desc:'受到所有伤害-20%', type:'reduceDmg', pct:20 }, cd:8 },
    { id:'m15', name:'金虹使者',  atk:11, skill:{ name:'金虹', desc:'随机5颗珠子变金珠', type:'convertBead', attr:'metal', count:5 }, cd:10 },
    { id:'m16', name:'金罡战魂',  atk:10, skill:{ name:'战魂', desc:'本回合受到伤害变为1点', type:'dmgImmune' }, cd:11 },
    { id:'m17', name:'金翎神使',  atk:10, skill:{ name:'金翎', desc:'金珠出现概率大幅提升1回合', type:'beadRateUp', attr:'metal' }, cd:9 },
    { id:'m18', name:'金锋战神',  atk:12, skill:{ name:'战意', desc:'全队攻击+25%，持续3回合', type:'allAtkUp', pct:25, dur:3 }, cd:12 },
    { id:'m19', name:'金耀星君',  atk:11, skill:{ name:'星耀', desc:'敌人眩晕+下次金伤+50%', type:'stunPlusDmg', attr:'metal', pct:50, stunDur:1 }, cd:10 },
    { id:'m20', name:'万钧金神',  atk:13, skill:{ name:'万钧', desc:'立即造成巨额金属性伤害', type:'instantDmg', attr:'metal', pct:300 }, cd:11 },
  ],

  // ===== （二）木属性宠物（20只） =====
  wood: [
    { id:'w1',  name:'青灵木鹿',  atk:7,  skill:{ name:'春愈', desc:'立即回复40点生命', type:'healFlat', val:40 }, cd:6 },
    { id:'w2',  name:'藤萝灵蛇',  atk:7,  skill:{ name:'毒蛇', desc:'敌人中毒，每回合掉20血，持续3回合', type:'dot', dmg:20, dur:3 }, cd:8 },
    { id:'w3',  name:'苍木灵熊',  atk:8,  skill:{ name:'熊力', desc:'本回合受伤-40%', type:'reduceDmg', pct:40 }, cd:8 },
    { id:'w4',  name:'万木灵狐',  atk:8,  skill:{ name:'木化', desc:'随机3颗变木珠', type:'convertBead', attr:'wood', count:3 }, cd:7 },
    { id:'w5',  name:'灵木仙子',  atk:9,  skill:{ name:'回春', desc:'每回合回血20点，持续3回合', type:'dot', dmg:-20, dur:3, isHeal:true }, cd:9 },
    { id:'w6',  name:'青木战灵',  atk:10, skill:{ name:'木灵', desc:'下次木属性伤害+50%', type:'dmgBoost', attr:'wood', pct:50 }, cd:7 },
    { id:'w7',  name:'缠枝藤君',  atk:9,  skill:{ name:'缠枝', desc:'敌人眩晕1回合', type:'stun', dur:1 }, cd:9 },
    { id:'w8',  name:'枯木老妖',  atk:8,  skill:{ name:'古木', desc:'血量上限+20%', type:'hpMaxUp', pct:20 }, cd:8 },
    { id:'w9',  name:'木灵使者',  atk:10, skill:{ name:'灵心', desc:'心珠效果翻倍1回合', type:'heartBoost', mul:2, dur:1 }, cd:9 },
    { id:'w10', name:'万木之主',  atk:11, skill:{ name:'万木', desc:'全队全属性伤害+20%，持续3回合', type:'allDmgUp', pct:20, dur:3 }, cd:12 },
    { id:'w11', name:'青藤守卫',  atk:8,  skill:{ name:'藤盾', desc:'获得厚护盾（70点）', type:'shield', val:70 }, cd:9 },
    { id:'w12', name:'翠竹灵蟋',  atk:10, skill:{ name:'木锐', desc:'下次木伤+70%', type:'dmgBoost', attr:'wood', pct:70 }, cd:8 },
    { id:'w13', name:'灵芝仙菇',  atk:8,  skill:{ name:'净化', desc:'免疫持续伤害1回合', type:'immuneCtrl', dur:1 }, cd:8 },
    { id:'w14', name:'苍蟒木蛟',  atk:10, skill:{ name:'生机', desc:'消除木珠时回血8%', type:'healOnElim', attr:'wood', pct:8 }, cd:7 },
    { id:'w15', name:'木灵仙鹿',  atk:9,  skill:{ name:'仙愈', desc:'满血回复', type:'fullHeal' }, cd:12 },
    { id:'w16', name:'千年古藤',  atk:11, skill:{ name:'仙木', desc:'随机5颗变木珠', type:'convertBead', attr:'wood', count:5 }, cd:10 },
    { id:'w17', name:'碧玉螳螂',  atk:10, skill:{ name:'元木', desc:'本次Combo不会断', type:'comboNeverBreak' }, cd:8 },
    { id:'w18', name:'青鸾翠雀',  atk:10, skill:{ name:'木元', desc:'木珠概率大幅提升1回合', type:'beadRateUp', attr:'wood' }, cd:9 },
    { id:'w19', name:'万木神龟',  atk:11, skill:{ name:'灵木', desc:'全队血量上限+30%', type:'allHpMaxUp', pct:30 }, cd:11 },
    { id:'w20', name:'神木麒麟',  atk:13, skill:{ name:'神木', desc:'立即高额木属性伤害', type:'instantDmg', attr:'wood', pct:300 }, cd:10 },
  ],

  // ===== （三）水属性宠物（20只） =====
  water: [
    { id:'s1',  name:'沧澜水雀',  atk:7,  skill:{ name:'水化', desc:'随机3颗珠子变水珠', type:'convertBead', attr:'water', count:3 }, cd:7 },
    { id:'s2',  name:'冰魄灵龟',  atk:8,  skill:{ name:'冰甲', desc:'本回合受伤-50%', type:'reduceDmg', pct:50 }, cd:9 },
    { id:'s3',  name:'海灵蛟童',  atk:8,  skill:{ name:'冰封', desc:'冰冻敌人1回合', type:'stun', dur:1 }, cd:9 },
    { id:'s4',  name:'玄水蛟龙',  atk:9,  skill:{ name:'水击', desc:'立即造成水属性伤害', type:'instantDmg', attr:'water', pct:150 }, cd:7 },
    { id:'s5',  name:'碧波灵蛙',  atk:8,  skill:{ name:'碧波', desc:'回复大量生命（60点）', type:'healFlat', val:60 }, cd:8 },
    { id:'s6',  name:'流水灵鱼',  atk:10, skill:{ name:'水灵', desc:'下次水属性伤害+50%', type:'dmgBoost', attr:'water', pct:50 }, cd:7 },
    { id:'s7',  name:'寒冰灵蟹',  atk:9,  skill:{ name:'寒川', desc:'反弹伤害20%，持续2回合', type:'reflectPct', pct:20, dur:2 }, cd:9 },
    { id:'s8',  name:'海魂巨鲸',  atk:10, skill:{ name:'海魂', desc:'消除水珠时额外回血', type:'healOnElim', attr:'water', pct:8 }, cd:8 },
    { id:'s9',  name:'凝水灵蚌',  atk:8,  skill:{ name:'凝水', desc:'免疫眩晕1次', type:'immuneCtrl', dur:1 }, cd:10 },
    { id:'s10', name:'沧海龙神',  atk:12, skill:{ name:'沧海', desc:'全场一半珠子变水珠', type:'convertBead', attr:'water', count:18 }, cd:13 },
    { id:'s11', name:'冰玄灵蛾',  atk:10, skill:{ name:'冰玄', desc:'水珠概率大幅提升1回合', type:'beadRateUp', attr:'water' }, cd:9 },
    { id:'s12', name:'沧澜海蛇',  atk:11, skill:{ name:'澜击', desc:'下次水伤+70%', type:'dmgBoost', attr:'water', pct:70 }, cd:8 },
    { id:'s13', name:'玄水灵蟾',  atk:9,  skill:{ name:'水盾', desc:'获得护盾（60点）', type:'shield', val:60 }, cd:9 },
    { id:'s14', name:'冰魄灵鹤',  atk:11, skill:{ name:'冰魄', desc:'眩晕+水伤+40%', type:'stunPlusDmg', attr:'water', pct:40, stunDur:1 }, cd:10 },
    { id:'s15', name:'海灵水母',  atk:10, skill:{ name:'海灵', desc:'转珠时间+2秒', type:'extraTime', sec:2 }, cd:10 },
    { id:'s16', name:'水镜灵蝶',  atk:10, skill:{ name:'水镜', desc:'反弹30%伤害1回合', type:'reflectPct', pct:30, dur:1 }, cd:9 },
    { id:'s17', name:'沧澜鲲鹏',  atk:13, skill:{ name:'仙澜', desc:'立即巨额水伤', type:'instantDmg', attr:'water', pct:300 }, cd:11 },
    { id:'s18', name:'玄水神蛟',  atk:11, skill:{ name:'玄水', desc:'全队防御+30%，持续3回合', type:'allDefUp', pct:30, dur:3 }, cd:12 },
    { id:'s19', name:'水纹灵獭',  atk:10, skill:{ name:'水纹', desc:'消除水珠获护盾（40点）', type:'shieldOnElim', attr:'water', val:40 }, cd:8 },
    { id:'s20', name:'冰凰神鸟',  atk:10, skill:{ name:'冰凰', desc:'免疫所有控制1回合', type:'immuneCtrl', dur:1 }, cd:10 },
  ],

  // ===== （四）火属性宠物（20只） =====
  fire: [
    { id:'f1',  name:'赤焰火狐',  atk:7,  skill:{ name:'焰爪', desc:'下次火属性伤害+40%', type:'dmgBoost', attr:'fire', pct:40 }, cd:6 },
    { id:'f2',  name:'焚天火狼',  atk:8,  skill:{ name:'火化', desc:'随机3颗变火珠', type:'convertBead', attr:'fire', count:3 }, cd:7 },
    { id:'f3',  name:'烈阳火凰',  atk:10, skill:{ name:'烈阳', desc:'立即造成高额火伤害', type:'instantDmg', attr:'fire', pct:200 }, cd:8 },
    { id:'f4',  name:'炎狱火麟',  atk:10, skill:{ name:'暴燃', desc:'本次攻击必定暴击', type:'guaranteeCrit' }, cd:9 },
    { id:'f5',  name:'爆炎火蟾',  atk:9,  skill:{ name:'灼烧', desc:'敌人灼烧，每回合25血，持续3回合', type:'dot', dmg:25, dur:3 }, cd:9 },
    { id:'f6',  name:'火莲灵花',  atk:10, skill:{ name:'火莲', desc:'Combo伤害额外+30%', type:'comboDmgUp', pct:30 }, cd:8 },
    { id:'f7',  name:'焚天火鸦',  atk:10, skill:{ name:'焚天', desc:'敌人眩晕1回合', type:'stun', dur:1 }, cd:9 },
    { id:'f8',  name:'赤炎火蝎',  atk:10, skill:{ name:'炎魔', desc:'更容易出大Combo', type:'comboPlus', count:3 }, cd:8 },
    { id:'f9',  name:'火灵赤蛇',  atk:9,  skill:{ name:'火愈', desc:'击杀怪物后回血50%', type:'onKillHeal', pct:50 }, cd:10 },
    { id:'f10', name:'朱雀神火',  atk:12, skill:{ name:'神火', desc:'全队暴击率+50%，持续3回合', type:'critBoost', pct:50, dur:3 }, cd:12 },
    { id:'f11', name:'焚天火猿',  atk:11, skill:{ name:'焚魂', desc:'火珠概率大幅提升1回合', type:'beadRateUp', attr:'fire' }, cd:9 },
    { id:'f12', name:'炎狱火蜥',  atk:11, skill:{ name:'炎狱', desc:'下次火伤+70%', type:'dmgBoost', attr:'fire', pct:70 }, cd:8 },
    { id:'f13', name:'烈阳火鹰',  atk:10, skill:{ name:'烈灵', desc:'消除5火珠触发全体攻击', type:'guaranteeCrit', attr:'fire', minCount:5 }, cd:9 },
    { id:'f14', name:'火凰灵蝶',  atk:11, skill:{ name:'凰翼', desc:'暴击伤害+50%', type:'critDmgUp', pct:50 }, cd:10 },
    { id:'f15', name:'炎爆火鼠',  atk:11, skill:{ name:'炎爆', desc:'眩晕+火伤+50%', type:'stunPlusDmg', attr:'fire', pct:50, stunDur:1 }, cd:10 },
    { id:'f16', name:'焚天火蟒',  atk:13, skill:{ name:'天焚', desc:'立即巨额火属性伤害', type:'instantDmg', attr:'fire', pct:350 }, cd:11 },
    { id:'f17', name:'赤焰麒麟',  atk:12, skill:{ name:'战焰', desc:'全队攻击+30%，持续3回合', type:'allAtkUp', pct:30, dur:3 }, cd:12 },
    { id:'f18', name:'火元灵龟',  atk:11, skill:{ name:'火元', desc:'每段Combo暴击率+5%', type:'critBoost', pct:5, dur:1, perCombo:true }, cd:9 },
    { id:'f19', name:'炎狱火龙',  atk:11, skill:{ name:'炎神', desc:'火伤无视25%防御', type:'ignoreDefPct', attr:'fire', pct:25 }, cd:9 },
    { id:'f20', name:'火灵神猫',  atk:10, skill:{ name:'余烬', desc:'残血时临时伤害+30%', type:'lowHpDmgUp', pct:30 }, cd:10 },
  ],

  // ===== （五）土属性宠物（20只） =====
  earth: [
    { id:'e1',  name:'厚土石灵',  atk:8,  skill:{ name:'厚土', desc:'本回合受伤-40%', type:'reduceDmg', pct:40 }, cd:8 },
    { id:'e2',  name:'山岳石怪',  atk:8,  skill:{ name:'土化', desc:'随机3颗变土珠', type:'convertBead', attr:'earth', count:3 }, cd:7 },
    { id:'e3',  name:'镇地石犀',  atk:9,  skill:{ name:'镇地', desc:'获得厚护盾（80点）', type:'shield', val:80 }, cd:9 },
    { id:'e4',  name:'玄武圣兽',  atk:10, skill:{ name:'玄武', desc:'眩晕敌人1回合', type:'stun', dur:1 }, cd:9 },
    { id:'e5',  name:'裂地穿山甲',  atk:11, skill:{ name:'裂地', desc:'下次土属性伤害+60%', type:'dmgBoost', attr:'earth', pct:60 }, cd:7 },
    { id:'e6',  name:'山岩石蟹',  atk:9,  skill:{ name:'山岩', desc:'血量上限+30%', type:'hpMaxUp', pct:30 }, cd:10 },
    { id:'e7',  name:'镇山石狮',  atk:10, skill:{ name:'石尊', desc:'免疫所有控制1回合', type:'immuneCtrl', dur:1 }, cd:10 },
    { id:'e8',  name:'大地灵鼹',  atk:10, skill:{ name:'大地', desc:'反弹30%伤害1回合', type:'reflectPct', pct:30, dur:1 }, cd:9 },
    { id:'e9',  name:'玄土石蟒',  atk:11, skill:{ name:'玄土', desc:'立即造成土属性高额伤害', type:'instantDmg', attr:'earth', pct:250 }, cd:10 },
    { id:'e10', name:'后土神兽',  atk:12, skill:{ name:'后土', desc:'全队防御+50%，持续3回合', type:'allDefUp', pct:50, dur:3 }, cd:13 },
    { id:'e11', name:'厚土灵虫',  atk:10, skill:{ name:'土魂', desc:'土珠概率大幅提升1回合', type:'beadRateUp', attr:'earth' }, cd:9 },
    { id:'e12', name:'山岳灵兔',  atk:11, skill:{ name:'岳击', desc:'下次土伤+70%', type:'dmgBoost', attr:'earth', pct:70 }, cd:8 },
    { id:'e13', name:'镇地石龙',  atk:10, skill:{ name:'镇盾', desc:'护盾效果+50%', type:'shield', val:60, bonusPct:50 }, cd:9 },
    { id:'e14', name:'玄土灵蛤',  atk:11, skill:{ name:'震慑', desc:'被攻击20%概率眩晕敌人', type:'stun', dur:1, chance:20 }, cd:10 },
    { id:'e15', name:'裂地灵蚁',  atk:10, skill:{ name:'裂盾', desc:'消除土珠获得护盾（50点）', type:'shieldOnElim', attr:'earth', val:50 }, cd:8 },
    { id:'e16', name:'山岩石象',  atk:10, skill:{ name:'岩甲', desc:'受到伤害-30%', type:'reduceDmg', pct:30 }, cd:9 },
    { id:'e17', name:'后土灵蚕',  atk:9,  skill:{ name:'地脉', desc:'每5层血量上限+5%', type:'percentAtkUp', per:5, pct:5, field:'hpMax' }, cd:10 },
    { id:'e18', name:'镇地神牛',  atk:13, skill:{ name:'天镇', desc:'立即巨额土属性伤害', type:'instantDmg', attr:'earth', pct:300 }, cd:11 },
    { id:'e19', name:'厚土灵龟',  atk:10, skill:{ name:'仙土', desc:'血量上限+40%', type:'hpMaxUp', pct:40 }, cd:11 },
    { id:'e20', name:'玄武神君',  atk:12, skill:{ name:'神武', desc:'眩晕+土伤+50%', type:'stunPlusDmg', attr:'earth', pct:50, stunDur:1 }, cd:10 },
  ],
}

// 获取指定属性的所有宠物
function getPetsByAttr(attr) {
  return PETS[attr] || []
}

// 获取所有宠物的平铺列表
function getAllPets() {
  const all = []
  for (const attr of ['metal','wood','water','fire','earth']) {
    for (const p of PETS[attr]) {
      all.push({ ...p, attr })
    }
  }
  return all
}

// 按id查找宠物
function getPetById(id) {
  for (const attr of ['metal','wood','water','fire','earth']) {
    const found = PETS[attr].find(p => p.id === id)
    if (found) return { ...found, attr }
  }
  return null
}

// 随机获取一只指定属性的宠物
function randomPetByAttr(attr) {
  const pool = PETS[attr]
  return { ...pool[Math.floor(Math.random() * pool.length)], attr }
}

// 随机获取一只任意属性的宠物
function randomPet() {
  const attrs = ['metal','wood','water','fire','earth']
  const attr = attrs[Math.floor(Math.random() * attrs.length)]
  return randomPetByAttr(attr)
}

// 开局生成初始4只宠物（随机4个不同属性，从弱的里选）
function generateStarterPets() {
  const allAttrs = ['metal','wood','water','fire','earth']
  // 随机打乱后取前4个属性
  for (let i = allAttrs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allAttrs[i], allAttrs[j]] = [allAttrs[j], allAttrs[i]]
  }
  const chosen = allAttrs.slice(0, 4)
  return chosen.map(attr => {
    // 从前8只（较弱的）中随机选1只
    const pool = PETS[attr].slice(0, 8)
    const pet = pool[Math.floor(Math.random() * pool.length)]
    return { ...pet, attr, currentCd: 0 }
  })
}

module.exports = {
  PETS,
  getPetsByAttr,
  getAllPets,
  getPetById,
  randomPetByAttr,
  randomPet,
  generateStarterPets,
}
