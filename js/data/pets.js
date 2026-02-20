/**
 * 宠物系统 — 五行通天塔（爽感重做版）
 * 5属性 × 20只 = 100只宠物
 * 核心改动：CD大幅缩短(3-6)、效果大幅增强、变珠整行/列级别
 * 新增"五行共鸣"必杀技机制（4只宠物技能全部就绪时可触发）
 */

// ===== 技能效果类型 =====
// dmgBoost  — 下次该属性伤害×N倍（改为倍率制，体感更强）
// convertBead — 随机N颗珠子变为指定属性（数量大幅提升）
// convertRow — 整行变为指定属性（新增）
// convertCol — 整列变为指定属性（新增）
// convertCross — 十字变为指定属性（新增）
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
// stunPlusDmg — 眩晕+下次伤害×N倍
// fullHeal  — 满血回复
// allHpMaxUp — 全队血量上限+X%
// dmgImmune — 本回合受到伤害变为1点
// guaranteeCrit — 本次攻击必定暴击+暴击伤害提升
// comboDmgUp — Combo伤害额外+X%
// percentAtkUp — 每N层全队攻击+X%（永久叠加）
// onKillHeal — 击杀怪物后回血X%
// multiHit  — 连续攻击N次（新增，每次造成X%伤害）
// explode   — 消除后引发爆炸，对敌人造成额外伤害（新增）

const PETS = {
  // ===== （一）金属性宠物（20只） =====
  metal: [
    { id:'m1',  name:'金锋灵猫',  atk:8,  skill:{ name:'锋芒斩', desc:'下次金属性伤害×2倍', type:'dmgBoost', attr:'metal', pct:100 }, cd:3 },
    { id:'m2',  name:'锐金鼠将',  atk:9,  skill:{ name:'金珠阵', desc:'整行珠子变为金珠', type:'convertRow', attr:'metal' }, cd:4 },
    { id:'m3',  name:'玄甲金狮',  atk:9,  skill:{ name:'金甲术', desc:'获得护盾40点+本回合免伤50%', type:'shieldPlus', val:40, reducePct:50 }, cd:5 },
    { id:'m4',  name:'天罡金鹏',  atk:10, skill:{ name:'天罡击', desc:'对敌人造成250%攻击力伤害', type:'instantDmg', attr:'metal', pct:250 }, cd:4 },
    { id:'m5',  name:'碎金战将',  atk:11, skill:{ name:'金缚锁', desc:'敌人眩晕2回合', type:'stun', dur:2 }, cd:5 },
    { id:'m6',  name:'金光剑灵',  atk:11, skill:{ name:'剑气纵横', desc:'Combo+3，且本次Combo不会断', type:'comboPlusNeverBreak', count:3 }, cd:4 },
    { id:'m7',  name:'金罡守卫',  atk:9,  skill:{ name:'罡气盾', desc:'获得护盾50点', type:'shield', val:50 }, cd:5 },
    { id:'m8',  name:'鸣金神雀',  atk:10, skill:{ name:'鸣金诀', desc:'转珠时间+3秒+金珠概率大增', type:'extraTimePlus', sec:3, attr:'metal' }, cd:5 },
    { id:'m9',  name:'破甲金将',  atk:12, skill:{ name:'破甲斩', desc:'下次金攻无视全部防御+伤害×1.5', type:'ignoreDefFull', attr:'metal', pct:100, dmgMul:50 }, cd:4 },
    { id:'m10', name:'九天金凰',  atk:12, skill:{ name:'金身不灭', desc:'抵挡一次致死伤害+回复50%血量', type:'revivePlus', healPct:50 }, cd:6 },
    { id:'m11', name:'锐金斥候',  atk:11, skill:{ name:'锐金三连', desc:'连续攻击3次，每次100%攻击力', type:'multiHit', attr:'metal', hits:3, pct:100 }, cd:4 },
    { id:'m12', name:'金纹战将',  atk:11, skill:{ name:'金愈阵', desc:'消除金珠时回血15%，持续3回合', type:'healOnElim', attr:'metal', pct:15 }, cd:4 },
    { id:'m13', name:'金影刺客',  atk:12, skill:{ name:'致命金刺', desc:'必定暴击+暴击伤害+100%', type:'guaranteeCrit', attr:'metal', critDmgBonus:100 }, cd:4 },
    { id:'m14', name:'金甲神卫',  atk:10, skill:{ name:'绝对防御', desc:'本回合受到伤害变为1点', type:'dmgImmune' }, cd:5 },
    { id:'m15', name:'金虹使者',  atk:12, skill:{ name:'金虹贯日', desc:'十字形珠子全变金珠', type:'convertCross', attr:'metal' }, cd:5 },
    { id:'m16', name:'金罡战魂',  atk:11, skill:{ name:'战魂爆发', desc:'全队攻击+50%持续2回合', type:'allAtkUp', pct:50, dur:2 }, cd:5 },
    { id:'m17', name:'金翎神使',  atk:11, skill:{ name:'金翎风暴', desc:'随机8颗变金珠+金珠概率大增', type:'convertBead', attr:'metal', count:8, beadBoost:true }, cd:4 },
    { id:'m18', name:'金锋战神',  atk:13, skill:{ name:'战神降临', desc:'全队攻击+40%持续3回合+必暴击1回合', type:'warGod', pct:40, dur:3 }, cd:6 },
    { id:'m19', name:'金耀星君',  atk:12, skill:{ name:'星耀裂空', desc:'眩晕2回合+下次金伤×3倍', type:'stunPlusDmg', attr:'metal', pct:200, stunDur:2 }, cd:5 },
    { id:'m20', name:'万钧金神',  atk:14, skill:{ name:'万钧神威', desc:'立即造成500%金属性爆裂伤害', type:'instantDmg', attr:'metal', pct:500 }, cd:5 },
  ],

  // ===== （二）木属性宠物（20只） =====
  wood: [
    { id:'w1',  name:'青灵木鹿',  atk:8,  skill:{ name:'春回大地', desc:'立即回复30%血量', type:'healPct', pct:30 }, cd:3 },
    { id:'w2',  name:'藤萝灵蛇',  atk:8,  skill:{ name:'剧毒蛇牙', desc:'剧毒：每回合50点，持续3回合', type:'dot', dmg:50, dur:3 }, cd:4 },
    { id:'w3',  name:'苍木灵熊',  atk:9,  skill:{ name:'熊力护体', desc:'护盾50点+反弹20%伤害2回合', type:'shieldReflect', val:50, reflectPct:20, dur:2 }, cd:5 },
    { id:'w4',  name:'万木灵狐',  atk:9,  skill:{ name:'万木化珠', desc:'整列珠子变木珠', type:'convertCol', attr:'wood' }, cd:4 },
    { id:'w5',  name:'灵木仙子',  atk:10, skill:{ name:'生生不息', desc:'每回合回血40点，持续3回合', type:'dot', dmg:-40, dur:3, isHeal:true }, cd:4 },
    { id:'w6',  name:'青木战灵',  atk:11, skill:{ name:'木灵爆发', desc:'下次木属性伤害×2.5倍', type:'dmgBoost', attr:'wood', pct:150 }, cd:3 },
    { id:'w7',  name:'缠枝藤君',  atk:10, skill:{ name:'缠枝锁魂', desc:'敌人眩晕2回合+中毒30/回合', type:'stunDot', dur:2, dotDmg:30, dotDur:3 }, cd:5 },
    { id:'w8',  name:'枯木老妖',  atk:9,  skill:{ name:'古木回春', desc:'血量上限+30%+立即回复等量血量', type:'hpMaxUp', pct:30 }, cd:5 },
    { id:'w9',  name:'木灵使者',  atk:11, skill:{ name:'灵心愈术', desc:'心珠效果×3持续2回合', type:'heartBoost', mul:3, dur:2 }, cd:4 },
    { id:'w10', name:'万木之主',  atk:12, skill:{ name:'万木天威', desc:'全队全属性伤害+40%持续3回合', type:'allDmgUp', pct:40, dur:3 }, cd:6 },
    { id:'w11', name:'青藤守卫',  atk:9,  skill:{ name:'藤甲壁垒', desc:'护盾60点+减伤30%持续2回合', type:'shieldPlus', val:60, reducePct:30 }, cd:6 },
    { id:'w12', name:'翠竹灵蟋',  atk:11, skill:{ name:'翠竹连击', desc:'连续攻击3次，每次120%木属性伤害', type:'multiHit', attr:'wood', hits:3, pct:120 }, cd:4 },
    { id:'w13', name:'灵芝仙菇',  atk:9,  skill:{ name:'净化万毒', desc:'清除所有负面+免疫控制2回合', type:'purify', immuneDur:2 }, cd:4 },
    { id:'w14', name:'苍蟒木蛟',  atk:11, skill:{ name:'蛟龙回春', desc:'消除木珠回血12%，持续3回合', type:'healOnElim', attr:'wood', pct:12 }, cd:4 },
    { id:'w15', name:'木灵仙鹿',  atk:10, skill:{ name:'仙鹿满愈', desc:'满血回复+全队攻击+20%', type:'fullHealPlus', atkPct:20 }, cd:5 },
    { id:'w16', name:'千年古藤',  atk:12, skill:{ name:'古藤缠天', desc:'十字形珠子全变木珠', type:'convertCross', attr:'wood' }, cd:5 },
    { id:'w17', name:'碧玉螳螂',  atk:11, skill:{ name:'螳螂无双', desc:'Combo不断+Combo伤害+50%', type:'comboNeverBreakPlus', comboDmgPct:50 }, cd:4 },
    { id:'w18', name:'青鸾翠雀',  atk:11, skill:{ name:'翠雀风舞', desc:'整行变木珠+木珠概率大增', type:'convertRow', attr:'wood', beadBoost:true }, cd:4 },
    { id:'w19', name:'万木神龟',  atk:12, skill:{ name:'神龟之力', desc:'血量上限+40%+护盾50点', type:'hpMaxShield', hpPct:40, shieldVal:50 }, cd:7 },
    { id:'w20', name:'神木麒麟',  atk:14, skill:{ name:'神木灭世', desc:'立即500%木属性爆裂伤害', type:'instantDmg', attr:'wood', pct:500 }, cd:5 },
  ],

  // ===== （三）水属性宠物（20只） =====
  water: [
    { id:'s1',  name:'沧澜水雀',  atk:8,  skill:{ name:'水珠涌现', desc:'整列珠子变水珠', type:'convertCol', attr:'water' }, cd:4 },
    { id:'s2',  name:'冰魄灵龟',  atk:9,  skill:{ name:'冰魄铠甲', desc:'护盾50点+免伤60%本回合', type:'shieldPlus', val:50, reducePct:60 }, cd:5 },
    { id:'s3',  name:'海灵蛟童',  atk:9,  skill:{ name:'寒冰封印', desc:'冰冻敌人2回合', type:'stun', dur:2 }, cd:5 },
    { id:'s4',  name:'玄水蛟龙',  atk:10, skill:{ name:'蛟龙怒击', desc:'250%水属性直接伤害', type:'instantDmg', attr:'water', pct:250 }, cd:4 },
    { id:'s5',  name:'碧波灵蛙',  atk:9,  skill:{ name:'碧波愈泉', desc:'回复40%血量', type:'healPct', pct:40 }, cd:4 },
    { id:'s6',  name:'流水灵鱼',  atk:11, skill:{ name:'水灵爆涌', desc:'下次水属性伤害×2.5倍', type:'dmgBoost', attr:'water', pct:150 }, cd:3 },
    { id:'s7',  name:'寒冰灵蟹',  atk:10, skill:{ name:'寒冰之壁', desc:'反弹40%伤害持续2回合', type:'reflectPct', pct:40, dur:2 }, cd:4 },
    { id:'s8',  name:'海魂巨鲸',  atk:11, skill:{ name:'鲸吞回复', desc:'消除水珠回血12%持续3回合', type:'healOnElim', attr:'water', pct:12 }, cd:4 },
    { id:'s9',  name:'凝水灵蚌',  atk:9,  skill:{ name:'凝水护体', desc:'免疫所有控制2回合', type:'immuneCtrl', dur:2 }, cd:5 },
    { id:'s10', name:'沧海龙神',  atk:13, skill:{ name:'龙神覆海', desc:'全场一半珠子变水珠（约18颗）', type:'convertBead', attr:'water', count:18 }, cd:6 },
    { id:'s11', name:'冰玄灵蛾',  atk:11, skill:{ name:'冰玄风暴', desc:'随机8颗变水珠+水珠概率大增', type:'convertBead', attr:'water', count:8, beadBoost:true }, cd:4 },
    { id:'s12', name:'沧澜海蛇',  atk:12, skill:{ name:'海蛇三连', desc:'连续攻击3次，每次120%水伤害', type:'multiHit', attr:'water', hits:3, pct:120 }, cd:4 },
    { id:'s13', name:'玄水灵蟾',  atk:10, skill:{ name:'水盾壁障', desc:'护盾60点', type:'shield', val:60 }, cd:5 },
    { id:'s14', name:'冰魄灵鹤',  atk:12, skill:{ name:'冰魄封天', desc:'眩晕2回合+水伤×2倍', type:'stunPlusDmg', attr:'water', pct:100, stunDur:2 }, cd:5 },
    { id:'s15', name:'海灵水母',  atk:11, skill:{ name:'水母幻术', desc:'转珠时间+3秒+Combo不断', type:'extraTimePlus', sec:3, comboNeverBreak:true }, cd:5 },
    { id:'s16', name:'水镜灵蝶',  atk:11, skill:{ name:'水镜反射', desc:'反弹50%伤害1回合+护盾40', type:'shieldReflect', val:40, reflectPct:50, dur:1 }, cd:5 },
    { id:'s17', name:'沧澜鲲鹏',  atk:14, skill:{ name:'鲲鹏怒涛', desc:'500%水属性爆裂伤害', type:'instantDmg', attr:'water', pct:500 }, cd:5 },
    { id:'s18', name:'玄水神蛟',  atk:12, skill:{ name:'神蛟护佑', desc:'全队防御+50%持续3回合', type:'allDefUp', pct:50, dur:3 }, cd:5 },
    { id:'s19', name:'水纹灵獭',  atk:11, skill:{ name:'灵獭水盾', desc:'消除水珠获护盾25点持续2回合', type:'shieldOnElim', attr:'water', val:25, dur:2 }, cd:6 },
    { id:'s20', name:'冰凰神鸟',  atk:11, skill:{ name:'冰凰绝对', desc:'免疫所有控制2回合+护盾50', type:'immuneShield', immuneDur:2, shieldVal:50 }, cd:6 },
  ],

  // ===== （四）火属性宠物（20只） =====
  fire: [
    { id:'f1',  name:'赤焰火狐',  atk:8,  skill:{ name:'焰爪连击', desc:'下次火属性伤害×2倍', type:'dmgBoost', attr:'fire', pct:100 }, cd:3 },
    { id:'f2',  name:'焚天火狼',  atk:9,  skill:{ name:'烈火珠阵', desc:'整行珠子变火珠', type:'convertRow', attr:'fire' }, cd:4 },
    { id:'f3',  name:'烈阳火凰',  atk:11, skill:{ name:'凤凰烈焰', desc:'350%火属性直接伤害', type:'instantDmg', attr:'fire', pct:350 }, cd:4 },
    { id:'f4',  name:'炎狱火麟',  atk:11, skill:{ name:'炎狱暴击', desc:'必暴击+暴击伤害+100%', type:'guaranteeCrit', critDmgBonus:100 }, cd:4 },
    { id:'f5',  name:'爆炎火蟾',  atk:10, skill:{ name:'烈焰灼烧', desc:'剧毒灼烧：每回合60点持续3回合', type:'dot', dmg:60, dur:3 }, cd:4 },
    { id:'f6',  name:'火莲灵花',  atk:11, skill:{ name:'火莲绽放', desc:'Combo伤害额外+60%', type:'comboDmgUp', pct:60 }, cd:4 },
    { id:'f7',  name:'焚天火鸦',  atk:11, skill:{ name:'焚天之怒', desc:'敌人眩晕2回合', type:'stun', dur:2 }, cd:5 },
    { id:'f8',  name:'赤炎火蝎',  atk:11, skill:{ name:'炎魔连击', desc:'Combo+4且不会断', type:'comboPlusNeverBreak', count:4 }, cd:4 },
    { id:'f9',  name:'火灵赤蛇',  atk:10, skill:{ name:'火蛇吸血', desc:'击杀怪物后满血', type:'onKillHeal', pct:100 }, cd:5 },
    { id:'f10', name:'朱雀神火',  atk:13, skill:{ name:'朱雀圣焰', desc:'全队暴击率+80%持续3回合', type:'critBoost', pct:80, dur:3 }, cd:5 },
    { id:'f11', name:'焚天火猿',  atk:12, skill:{ name:'焚魂珠阵', desc:'随机8颗变火珠+火珠概率大增', type:'convertBead', attr:'fire', count:8, beadBoost:true }, cd:4 },
    { id:'f12', name:'炎狱火蜥',  atk:12, skill:{ name:'炎狱三连', desc:'连续攻击3次，每次130%火伤害', type:'multiHit', attr:'fire', hits:3, pct:130 }, cd:4 },
    { id:'f13', name:'烈阳火鹰',  atk:11, skill:{ name:'烈阳风暴', desc:'全队主动攻击，每只150%伤害', type:'teamAttack', pct:150 }, cd:5 },
    { id:'f14', name:'火凰灵蝶',  atk:12, skill:{ name:'凰翼爆炎', desc:'暴击伤害+80%+必暴击1回合', type:'critDmgUp', pct:80, guaranteeCrit:true }, cd:5 },
    { id:'f15', name:'炎爆火鼠',  atk:12, skill:{ name:'炎爆裂天', desc:'眩晕2回合+火伤×3倍', type:'stunPlusDmg', attr:'fire', pct:200, stunDur:2 }, cd:5 },
    { id:'f16', name:'焚天火蟒',  atk:14, skill:{ name:'天火焚灭', desc:'500%火属性爆裂伤害+灼烧', type:'instantDmgDot', attr:'fire', pct:500, dotDmg:40, dotDur:3 }, cd:5 },
    { id:'f17', name:'赤焰麒麟',  atk:13, skill:{ name:'麒麟战焰', desc:'全队攻击+50%持续3回合', type:'allAtkUp', pct:50, dur:3 }, cd:6 },
    { id:'f18', name:'火元灵龟',  atk:12, skill:{ name:'元火暴击', desc:'每段Combo暴击率+10%', type:'critBoost', pct:10, dur:1, perCombo:true }, cd:4 },
    { id:'f19', name:'炎狱火龙',  atk:12, skill:{ name:'龙炎破甲', desc:'火伤无视全部防御+伤害×1.5', type:'ignoreDefFull', attr:'fire', pct:100, dmgMul:50 }, cd:4 },
    { id:'f20', name:'火灵神猫',  atk:11, skill:{ name:'余烬爆发', desc:'残血时伤害+80%', type:'lowHpDmgUp', pct:80 }, cd:4 },
  ],

  // ===== （五）土属性宠物（20只） =====
  earth: [
    { id:'e1',  name:'厚土石灵',  atk:9,  skill:{ name:'厚土护体', desc:'护盾50点+减伤50%本回合', type:'shieldPlus', val:50, reducePct:50 }, cd:5 },
    { id:'e2',  name:'山岳石怪',  atk:9,  skill:{ name:'山岳珠阵', desc:'整行珠子变土珠', type:'convertRow', attr:'earth' }, cd:4 },
    { id:'e3',  name:'镇地石犀',  atk:10, skill:{ name:'镇地壁垒', desc:'获得护盾70点', type:'shield', val:70 }, cd:6 },
    { id:'e4',  name:'玄武圣兽',  atk:11, skill:{ name:'玄武震慑', desc:'敌人眩晕2回合', type:'stun', dur:2 }, cd:5 },
    { id:'e5',  name:'裂地穿山甲',  atk:12, skill:{ name:'裂地重击', desc:'下次土属性伤害×2.5倍', type:'dmgBoost', attr:'earth', pct:150 }, cd:3 },
    { id:'e6',  name:'山岩石蟹',  atk:10, skill:{ name:'岩甲回春', desc:'血量上限+30%+立即回满', type:'hpMaxUp', pct:30 }, cd:5 },
    { id:'e7',  name:'镇山石狮',  atk:11, skill:{ name:'石狮无畏', desc:'免疫所有控制2回合', type:'immuneCtrl', dur:2 }, cd:5 },
    { id:'e8',  name:'大地灵鼹',  atk:11, skill:{ name:'大地反噬', desc:'反弹50%伤害2回合', type:'reflectPct', pct:50, dur:2 }, cd:4 },
    { id:'e9',  name:'玄土石蟒',  atk:12, skill:{ name:'蟒击碎岩', desc:'350%土属性直接伤害', type:'instantDmg', attr:'earth', pct:350 }, cd:4 },
    { id:'e10', name:'后土神兽',  atk:13, skill:{ name:'后土庇佑', desc:'全队防御+60%持续3回合', type:'allDefUp', pct:60, dur:3 }, cd:6 },
    { id:'e11', name:'厚土灵虫',  atk:11, skill:{ name:'土魂涌现', desc:'随机8颗变土珠+土珠概率大增', type:'convertBead', attr:'earth', count:8, beadBoost:true }, cd:4 },
    { id:'e12', name:'山岳灵兔',  atk:12, skill:{ name:'兔踢三连', desc:'连续攻击3次，每次120%土伤害', type:'multiHit', attr:'earth', hits:3, pct:120 }, cd:4 },
    { id:'e13', name:'镇地石龙',  atk:11, skill:{ name:'镇地龙盾', desc:'护盾60点+护盾效果+50%', type:'shield', val:60, bonusPct:50 }, cd:6 },
    { id:'e14', name:'玄土灵蛤',  atk:12, skill:{ name:'蛤蟆震地', desc:'眩晕1回合+破甲（防御归零）', type:'stunBreakDef', stunDur:1 }, cd:4 },
    { id:'e15', name:'裂地灵蚁',  atk:11, skill:{ name:'灵蚁护盾', desc:'消除土珠获护盾30点持续2回合', type:'shieldOnElim', attr:'earth', val:30, dur:2 }, cd:6 },
    { id:'e16', name:'山岩石象',  atk:11, skill:{ name:'象踏山崩', desc:'本回合受伤变为1点', type:'dmgImmune' }, cd:5 },
    { id:'e17', name:'后土灵蚕',  atk:10, skill:{ name:'地脉转珠', desc:'十字形珠子全变土珠', type:'convertCross', attr:'earth' }, cd:5 },
    { id:'e18', name:'镇地神牛',  atk:14, skill:{ name:'神牛碎天', desc:'500%土属性爆裂伤害', type:'instantDmg', attr:'earth', pct:500 }, cd:5 },
    { id:'e19', name:'厚土灵龟',  atk:11, skill:{ name:'仙龟铁壁', desc:'血量上限+40%+护盾70点', type:'hpMaxShield', hpPct:40, shieldVal:70 }, cd:7 },
    { id:'e20', name:'玄武神君',  atk:13, skill:{ name:'玄武破天', desc:'眩晕2回合+土伤×3倍', type:'stunPlusDmg', attr:'earth', pct:200, stunDur:2 }, cd:5 },
  ],
}

// ===== 星级融合系统常量 =====
const MAX_STAR = 3          // 最高星级
const STAR_ATK_MUL = 1.3    // 每升1星ATK倍率
const STAR_SKILL_MUL = 1.25 // 每升1星技能数值倍率

// 获取宠物星级加成后的ATK
function getPetStarAtk(pet) {
  const star = pet.star || 1
  return Math.floor(pet.atk * Math.pow(STAR_ATK_MUL, star - 1))
}

// 获取宠物星级技能数值倍率（用于乘以技能关键数值）
function getPetStarSkillMul(pet) {
  const star = pet.star || 1
  return Math.pow(STAR_SKILL_MUL, star - 1)
}

// 尝试融合宠物：在已有宠物列表中查找同ID宠物，找到则升星
// allPets: 包含 g.pets 和 g.petBag 的合并数组
// newPet: 新获得的宠物
// 返回: { merged: true/false, target: 被升星的宠物/null }
function tryMergePet(allPets, newPet) {
  const target = allPets.find(p => p.id === newPet.id)
  if (target && (target.star || 1) < MAX_STAR) {
    target.star = (target.star || 1) + 1
    return { merged: true, target }
  }
  if (target && (target.star || 1) >= MAX_STAR) {
    // 已满星，无法融合也不新增
    return { merged: true, target, maxed: true }
  }
  return { merged: false, target: null }
}

// 检查是否有同ID宠物已上场（用于禁止同ID上场）
function hasSameIdOnTeam(pets, petId, excludeIndex) {
  return pets.some((p, i) => p && p.id === petId && i !== excludeIndex)
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
      all.push({ ...p, attr, star: 1 })
    }
  }
  return all
}

// 按id查找宠物
function getPetById(id) {
  for (const attr of ['metal','wood','water','fire','earth']) {
    const found = PETS[attr].find(p => p.id === id)
    if (found) return { ...found, attr, star: 1 }
  }
  return null
}

// 随机获取一只指定属性的宠物
function randomPetByAttr(attr) {
  const pool = PETS[attr]
  return { ...pool[Math.floor(Math.random() * pool.length)], attr, star: 1 }
}

// 随机获取一只任意属性的宠物（全局100只池，仅用于无session pool场景）
function randomPet() {
  const attrs = ['metal','wood','water','fire','earth']
  const attr = attrs[Math.floor(Math.random() * attrs.length)]
  return randomPetByAttr(attr)
}

// 从本局宠物池中随机获取一只宠物
function randomPetFromPool(sessionPool) {
  if (!sessionPool || sessionPool.length === 0) return randomPet()
  const p = sessionPool[Math.floor(Math.random() * sessionPool.length)]
  return { ...p, star: 1 }
}

// 生成本局宠物池：每属性随机5只，共25只（大幅提高同ID命中率）
function generateSessionPetPool() {
  const pool = []
  for (const attr of ['metal','wood','water','fire','earth']) {
    const attrPets = [...PETS[attr]]
    // 洗牌
    for (let i = attrPets.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[attrPets[i], attrPets[j]] = [attrPets[j], attrPets[i]]
    }
    // 取前5只
    for (let k = 0; k < 5 && k < attrPets.length; k++) {
      pool.push({ ...attrPets[k], attr, star: 1 })
    }
  }
  return pool
}

// 开局生成初始4只宠物（从本局池中选，保证初始宠物在池子内）
function generateStarterPets(sessionPool) {
  const allAttrs = ['metal','wood','water','fire','earth']
  // 随机打乱后取前4个属性
  for (let i = allAttrs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allAttrs[i], allAttrs[j]] = [allAttrs[j], allAttrs[i]]
  }
  const chosen = allAttrs.slice(0, 4)
  return chosen.map(attr => {
    // 从本局池中该属性的前几只（较弱的）中选
    if (sessionPool) {
      const attrPool = sessionPool.filter(p => p.attr === attr)
      // 按atk排序取前3只（较弱的）
      attrPool.sort((a, b) => a.atk - b.atk)
      const weakPool = attrPool.slice(0, Math.min(3, attrPool.length))
      if (weakPool.length > 0) {
        const pet = weakPool[Math.floor(Math.random() * weakPool.length)]
        return { ...pet, attr, star: 1, currentCd: 0 }
      }
    }
    // fallback: 从前8只中随机选
    const pool = PETS[attr].slice(0, 8)
    const pet = pool[Math.floor(Math.random() * pool.length)]
    return { ...pet, attr, star: 1, currentCd: 0 }
  })
}

// 获取宠物头像路径：★3满星使用水墨国风JPG，其余使用原版PNG
function getPetAvatarPath(pet) {
  if ((pet.star || 1) >= MAX_STAR) {
    return `assets/pets/pet_${pet.id}_s3.jpg`
  }
  return `assets/pets/pet_${pet.id}.png`
}

module.exports = {
  PETS,
  MAX_STAR,
  getPetStarAtk,
  getPetStarSkillMul,
  tryMergePet,
  hasSameIdOnTeam,
  getPetsByAttr,
  getAllPets,
  getPetById,
  randomPetByAttr,
  randomPet,
  randomPetFromPool,
  generateSessionPetPool,
  generateStarterPets,
  getPetAvatarPath,
}
