/**
 * 宠物系统 — 灵宠消消塔（爽感重做版）
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
// replaceBeads — 全场指定属性珠全部转为另一属性（五行克制转珠）

const PETS = {
  // ===== （一）金属性宠物（20只） =====
  metal: [
    { id:'m1',  name:'金锋灵猫',  atk:8,  skill:{ name:'锋芒斩', desc:'下次金属性伤害×2倍', type:'dmgBoost', attr:'metal', pct:100 }, cd:2 },
    { id:'m2',  name:'锐金鼠将',  atk:9,  skill:{ name:'金珠阵', desc:'整行珠子变为金珠', type:'convertRow', attr:'metal' }, cd:4 },
    { id:'m3',  name:'玄甲金狮',  atk:9,  skill:{ name:'金甲术', desc:'获得护盾12点+本回合免伤25%', type:'shieldPlus', val:12, reducePct:25 }, cd:3 },
    { id:'m4',  name:'天罡金鹏',  atk:10, skill:{ name:'天罡击', desc:'对敌人造成250%攻击力伤害', type:'instantDmg', attr:'metal', pct:250 }, cd:3 },
    { id:'m5',  name:'碎金战将',  atk:11, skill:{ name:'金缚锁', desc:'敌人眩晕2回合', type:'stun', dur:2 }, cd:5 },
    { id:'m6',  name:'金光剑灵',  atk:11, skill:{ name:'剑气纵横', desc:'Combo+2，且本次Combo不会断', type:'comboPlusNeverBreak', count:2 }, cd:5 },
    { id:'m7',  name:'金罡守卫',  atk:9,  skill:{ name:'罡气化愈', desc:'全部木珠转为心珠', type:'replaceBeads', fromAttr:'wood', toAttr:'heart' }, cd:4 },
    { id:'m8',  name:'鸣金神雀',  atk:10, skill:{ name:'鸣金诀', desc:'转珠时间+3秒+金珠概率大增', type:'extraTimePlus', sec:3, attr:'metal' }, cd:4 },
    { id:'m9',  name:'破甲金将',  atk:12, skill:{ name:'破甲斩', desc:'下次金攻无视全部防御+伤害×1.5', type:'ignoreDefFull', attr:'metal', pct:100, dmgMul:50 }, cd:4 },
    { id:'m10', name:'九天金凰',  atk:12, skill:{ name:'金身不灭', desc:'抵挡一次致死伤害+回复50%血量', type:'revivePlus', healPct:50 }, cd:7 },
    { id:'m11', name:'锐金斥候',  atk:11, skill:{ name:'锐金三连', desc:'连续攻击3次，每次100%攻击力', type:'multiHit', attr:'metal', hits:3, pct:100 }, cd:4 },
    { id:'m12', name:'金纹战将',  atk:11, skill:{ name:'金纹化木', desc:'全部木珠转金珠+金伤+30%', type:'replaceBeads', fromAttr:'wood', toAttr:'metal', dmgBoost:30 }, cd:4 },
    { id:'m13', name:'金影刺客',  atk:12, skill:{ name:'致命金刺', desc:'必定暴击+暴击伤害+50%', type:'guaranteeCrit', attr:'metal', critDmgBonus:50 }, cd:3 },
    { id:'m14', name:'金甲神卫',  atk:10, skill:{ name:'金甲战吼', desc:'全队攻击+35%持续2回合', type:'allAtkUp', pct:35, dur:2 }, cd:5 },
    { id:'m15', name:'金虹使者',  atk:12, skill:{ name:'金虹贯日', desc:'十字形珠子全变金珠', type:'convertCross', attr:'metal' }, cd:4 },
    { id:'m16', name:'金罡战魂',  atk:11, skill:{ name:'战魂爆发', desc:'全队攻击+50%持续2回合', type:'allAtkUp', pct:50, dur:2 }, cd:6 },
    { id:'m17', name:'金翎神使',  atk:11, skill:{ name:'金翎风暴', desc:'随机8颗变金珠+金珠概率大增', type:'convertBead', attr:'metal', count:8, beadBoost:true }, cd:4 },
    { id:'m18', name:'金锋战神',  atk:13, skill:{ name:'战神降临', desc:'全队攻击+40%持续3回合+必暴击1回合', type:'warGod', pct:40, dur:3 }, cd:7 },
    { id:'m19', name:'金耀星君',  atk:12, skill:{ name:'星耀裂空', desc:'眩晕2回合+下次金伤×3倍', type:'stunPlusDmg', attr:'metal', pct:200, stunDur:2 }, cd:6 },
    { id:'m20', name:'万钧金神',  atk:14, skill:{ name:'万钧神威', desc:'立即造成500%金属性爆裂伤害', type:'instantDmg', attr:'metal', pct:500 }, cd:5 },
  ],

  // ===== （二）木属性宠物（20只） =====
  wood: [
    { id:'w1',  name:'青灵木鹿',  atk:8,  skill:{ name:'春回大地', desc:'立即回复30%血量', type:'healPct', pct:30 }, cd:3 },
    { id:'w2',  name:'藤萝灵蛇',  atk:8,  skill:{ name:'剧毒蛇牙', desc:'剧毒：每回合25点，持续3回合', type:'dot', dmg:25, dur:3 }, cd:3 },
    { id:'w3',  name:'苍木灵熊',  atk:9,  skill:{ name:'熊力化愈', desc:'全部土珠转为心珠', type:'replaceBeads', fromAttr:'earth', toAttr:'heart' }, cd:4 },
    { id:'w4',  name:'万木灵狐',  atk:9,  skill:{ name:'万木化珠', desc:'整列珠子变木珠', type:'convertCol', attr:'wood' }, cd:4 },
    { id:'w5',  name:'灵木仙子',  atk:10, skill:{ name:'仙子化土', desc:'全部土珠转木珠+每回合回血8点2回合', type:'replaceBeads', fromAttr:'earth', toAttr:'wood', regen:8, regenDur:2 }, cd:4 },
    { id:'w6',  name:'青木战灵',  atk:11, skill:{ name:'木灵爆发', desc:'下次木属性伤害×2.5倍', type:'dmgBoost', attr:'wood', pct:150 }, cd:2 },
    { id:'w7',  name:'缠枝藤君',  atk:10, skill:{ name:'缠枝锁魂', desc:'敌人眩晕2回合+中毒18/回合', type:'stunDot', dur:2, dotDmg:18, dotDur:3 }, cd:6 },
    { id:'w8',  name:'枯木老妖',  atk:9,  skill:{ name:'枯木缠魂', desc:'眩晕1回合+中毒20/回合持续3回合', type:'stunDot', dur:1, dotDmg:20, dotDur:3 }, cd:5 },
    { id:'w9',  name:'木灵使者',  atk:11, skill:{ name:'灵木滋生', desc:'下回合木珠出现概率大增', type:'beadRateUp', attr:'wood' }, cd:2 },
    { id:'w10', name:'万木之主',  atk:12, skill:{ name:'万木天威', desc:'全队全属性伤害+40%持续3回合', type:'allDmgUp', pct:40, dur:3 }, cd:7 },
    { id:'w11', name:'青藤守卫',  atk:9,  skill:{ name:'藤甲壁垒', desc:'护盾30点+减伤20%持续2回合', type:'shieldPlus', val:30, reducePct:20 }, cd:6 },
    { id:'w12', name:'翠竹灵蟋',  atk:11, skill:{ name:'翠竹连击', desc:'连续攻击3次，每次120%木属性伤害', type:'multiHit', attr:'wood', hits:3, pct:120 }, cd:4 },
    { id:'w13', name:'灵芝仙菇',  atk:9,  skill:{ name:'净化万毒', desc:'清除所有负面+免疫控制2回合', type:'purify', immuneDur:2 }, cd:4 },
    { id:'w14', name:'苍蟒木蛟',  atk:11, skill:{ name:'蛟龙木爆', desc:'下次木属性伤害×2倍', type:'dmgBoost', attr:'wood', pct:100 }, cd:2 },
    { id:'w15', name:'木灵仙鹿',  atk:10, skill:{ name:'仙鹿化珠', desc:'全部土珠转木珠+全队攻击+20%', type:'replaceBeads', fromAttr:'earth', toAttr:'wood', atkBoost:20 }, cd:5 },
    { id:'w16', name:'千年古藤',  atk:12, skill:{ name:'古藤缠天', desc:'十字形珠子全变木珠', type:'convertCross', attr:'wood' }, cd:4 },
    { id:'w17', name:'碧玉螳螂',  atk:11, skill:{ name:'螳螂无双', desc:'Combo不断+Combo伤害+50%', type:'comboNeverBreakPlus', comboDmgPct:50 }, cd:5 },
    { id:'w18', name:'青鸾翠雀',  atk:11, skill:{ name:'翠雀风舞', desc:'整行变木珠+木珠概率大增', type:'convertRow', attr:'wood', beadBoost:true }, cd:4 },
    { id:'w19', name:'万木神龟',  atk:12, skill:{ name:'神龟之力', desc:'全队防御+40%持续3回合', type:'allDefUp', pct:40, dur:3 }, cd:6 },
    { id:'w20', name:'神木麒麟',  atk:14, skill:{ name:'神木灭世', desc:'立即500%木属性爆裂伤害', type:'instantDmg', attr:'wood', pct:500 }, cd:5 },
  ],

  // ===== （三）水属性宠物（20只） =====
  water: [
    { id:'s1',  name:'沧澜水雀',  atk:8,  skill:{ name:'水珠涌现', desc:'整列珠子变水珠', type:'convertCol', attr:'water' }, cd:4 },
    { id:'s2',  name:'冰魄灵龟',  atk:9,  skill:{ name:'冰魄化愈', desc:'全部火珠转为心珠', type:'replaceBeads', fromAttr:'fire', toAttr:'heart' }, cd:4 },
    { id:'s3',  name:'海灵蛟童',  atk:9,  skill:{ name:'寒冰封印', desc:'冰冻敌人2回合', type:'stun', dur:2 }, cd:5 },
    { id:'s4',  name:'玄水蛟龙',  atk:10, skill:{ name:'蛟龙怒击', desc:'250%水属性直接伤害', type:'instantDmg', attr:'water', pct:250 }, cd:3 },
    { id:'s5',  name:'碧波灵蛙',  atk:9,  skill:{ name:'碧波愈泉', desc:'回复40%血量', type:'healPct', pct:40 }, cd:4 },
    { id:'s6',  name:'流水灵鱼',  atk:11, skill:{ name:'水灵爆涌', desc:'下次水属性伤害×2.5倍', type:'dmgBoost', attr:'water', pct:150 }, cd:2 },
    { id:'s7',  name:'寒冰灵蟹',  atk:10, skill:{ name:'寒冰之壁', desc:'反弹25%伤害持续2回合', type:'reflectPct', pct:25, dur:2 }, cd:4 },
    { id:'s8',  name:'海魂巨鲸',  atk:11, skill:{ name:'鲸吞怒涛', desc:'全属性伤害+30%持续2回合', type:'allDmgUp', pct:30, dur:2 }, cd:5 },
    { id:'s9',  name:'凝水灵蚌',  atk:9,  skill:{ name:'凝水护体', desc:'免疫所有控制2回合', type:'immuneCtrl', dur:2 }, cd:4 },
    { id:'s10', name:'沧海龙神',  atk:13, skill:{ name:'龙神覆海', desc:'全场一半珠子变水珠（约18颗）', type:'convertBead', attr:'water', count:18 }, cd:7 },
    { id:'s11', name:'冰玄灵蛾',  atk:11, skill:{ name:'冰玄风暴', desc:'随机8颗变水珠+水珠概率大增', type:'convertBead', attr:'water', count:8, beadBoost:true }, cd:4 },
    { id:'s12', name:'沧澜海蛇',  atk:12, skill:{ name:'海蛇三连', desc:'连续攻击3次，每次120%水伤害', type:'multiHit', attr:'water', hits:3, pct:120 }, cd:4 },
    { id:'s13', name:'玄水灵蟾',  atk:10, skill:{ name:'灵蟾冰封', desc:'冰冻敌人1回合+水伤×2倍', type:'stunPlusDmg', attr:'water', pct:100, stunDur:1 }, cd:4 },
    { id:'s14', name:'冰魄灵鹤',  atk:12, skill:{ name:'冰魄封天', desc:'眩晕2回合+水伤×2倍', type:'stunPlusDmg', attr:'water', pct:100, stunDur:2 }, cd:6 },
    { id:'s15', name:'海灵水母',  atk:11, skill:{ name:'水母幻术', desc:'转珠时间+3秒+Combo不断', type:'extraTimePlus', sec:3, comboNeverBreak:true }, cd:5 },
    { id:'s16', name:'水镜灵蝶',  atk:11, skill:{ name:'水镜反射', desc:'反弹30%伤害持续2回合', type:'reflectPct', pct:30, dur:2 }, cd:4 },
    { id:'s17', name:'沧澜鲲鹏',  atk:14, skill:{ name:'鲲鹏怒涛', desc:'500%水属性爆裂伤害', type:'instantDmg', attr:'water', pct:500 }, cd:5 },
    { id:'s18', name:'玄水神蛟',  atk:12, skill:{ name:'神蛟护佑', desc:'全队防御+50%持续3回合', type:'allDefUp', pct:50, dur:3 }, cd:6 },
    { id:'s19', name:'水纹灵獭',  atk:11, skill:{ name:'灵獭化火', desc:'全部火珠转水珠+水珠概率大增', type:'replaceBeads', fromAttr:'fire', toAttr:'water', beadBoost:true }, cd:4 },
    { id:'s20', name:'冰凰神鸟',  atk:11, skill:{ name:'冰凰绝对', desc:'免疫所有控制2回合+护盾20点', type:'immuneShield', immuneDur:2, shieldVal:20 }, cd:5 },
  ],

  // ===== （四）火属性宠物（20只） =====
  fire: [
    { id:'f1',  name:'赤焰火狐',  atk:8,  skill:{ name:'焰爪连击', desc:'下次火属性伤害×2倍', type:'dmgBoost', attr:'fire', pct:100 }, cd:2 },
    { id:'f2',  name:'焚天火狼',  atk:9,  skill:{ name:'烈火珠阵', desc:'整行珠子变火珠', type:'convertRow', attr:'fire' }, cd:4 },
    { id:'f3',  name:'烈阳火凰',  atk:11, skill:{ name:'凤凰烈焰', desc:'350%火属性直接伤害', type:'instantDmg', attr:'fire', pct:350 }, cd:4 },
    { id:'f4',  name:'炎狱火麟',  atk:11, skill:{ name:'炎狱暴击', desc:'必暴击+暴击伤害+50%', type:'guaranteeCrit', critDmgBonus:50 }, cd:3 },
    { id:'f5',  name:'爆炎火蟾',  atk:10, skill:{ name:'烈焰灼烧', desc:'灼烧：每回合30点持续3回合', type:'dot', dmg:30, dur:3 }, cd:3 },
    { id:'f6',  name:'火莲灵花',  atk:11, skill:{ name:'火莲绽放', desc:'Combo伤害额外+60%', type:'comboDmgUp', pct:60 }, cd:3 },
    { id:'f7',  name:'焚天火鸦',  atk:11, skill:{ name:'焚天之怒', desc:'敌人眩晕2回合', type:'stun', dur:2 }, cd:5 },
    { id:'f8',  name:'赤炎火蝎',  atk:11, skill:{ name:'炎魔连击', desc:'Combo+4且不会断', type:'comboPlusNeverBreak', count:4 }, cd:5 },
    { id:'f9',  name:'火灵赤蛇',  atk:10, skill:{ name:'蛇焰化愈', desc:'全部金珠转为心珠', type:'replaceBeads', fromAttr:'metal', toAttr:'heart' }, cd:4 },
    { id:'f10', name:'朱雀神火',  atk:13, skill:{ name:'朱雀圣焰', desc:'全队暴击率+50%持续2回合', type:'critBoost', pct:50, dur:2 }, cd:5 },
    { id:'f11', name:'焚天火猿',  atk:12, skill:{ name:'焚魂珠阵', desc:'随机8颗变火珠+火珠概率大增', type:'convertBead', attr:'fire', count:8, beadBoost:true }, cd:4 },
    { id:'f12', name:'炎狱火蜥',  atk:12, skill:{ name:'炎狱三连', desc:'连续攻击3次，每次130%火伤害', type:'multiHit', attr:'fire', hits:3, pct:130 }, cd:4 },
    { id:'f13', name:'烈阳火鹰',  atk:11, skill:{ name:'烈阳风暴', desc:'全队主动攻击，每只150%伤害', type:'teamAttack', pct:150 }, cd:6 },
    { id:'f14', name:'火凰灵蝶',  atk:12, skill:{ name:'凰翼爆炎', desc:'暴击伤害+40%+必暴击1回合', type:'critDmgUp', pct:40, guaranteeCrit:true }, cd:4 },
    { id:'f15', name:'炎爆火鼠',  atk:12, skill:{ name:'炎爆裂天', desc:'眩晕2回合+火伤×3倍', type:'stunPlusDmg', attr:'fire', pct:200, stunDur:2 }, cd:6 },
    { id:'f16', name:'焚天火蟒',  atk:14, skill:{ name:'天火焚灭', desc:'500%火属性爆裂伤害+灼烧', type:'instantDmgDot', attr:'fire', pct:500, dotDmg:25, dotDur:3 }, cd:6 },
    { id:'f17', name:'赤焰麒麟',  atk:13, skill:{ name:'麒麟战焰', desc:'全队攻击+50%持续3回合', type:'allAtkUp', pct:50, dur:3 }, cd:7 },
    { id:'f18', name:'火元灵龟',  atk:12, skill:{ name:'元火暴击', desc:'每段Combo暴击率+10%', type:'critBoost', pct:10, dur:1, perCombo:true }, cd:3 },
    { id:'f19', name:'炎狱火龙',  atk:12, skill:{ name:'龙炎破甲', desc:'火伤无视全部防御+伤害×1.5', type:'ignoreDefFull', attr:'fire', pct:100, dmgMul:50 }, cd:4 },
    { id:'f20', name:'火灵神猫',  atk:11, skill:{ name:'余烬爆发', desc:'残血时伤害+80%', type:'lowHpDmgUp', pct:80 }, cd:3 },
  ],

  // ===== （五）土属性宠物（20只） =====
  earth: [
    { id:'e1',  name:'厚土石灵',  atk:9,  skill:{ name:'厚土化愈', desc:'全部水珠转为心珠', type:'replaceBeads', fromAttr:'water', toAttr:'heart' }, cd:4 },
    { id:'e2',  name:'山岳石怪',  atk:9,  skill:{ name:'山岳珠阵', desc:'整行珠子变土珠', type:'convertRow', attr:'earth' }, cd:4 },
    { id:'e3',  name:'镇地石犀',  atk:10, skill:{ name:'镇地壁垒', desc:'获得护盾35点', type:'shield', val:35 }, cd:5 },
    { id:'e4',  name:'玄武圣兽',  atk:11, skill:{ name:'玄武震慑', desc:'敌人眩晕2回合', type:'stun', dur:2 }, cd:5 },
    { id:'e5',  name:'裂地穿山甲',  atk:12, skill:{ name:'裂地重击', desc:'下次土属性伤害×2.5倍', type:'dmgBoost', attr:'earth', pct:150 }, cd:2 },
    { id:'e6',  name:'山岩石蟹',  atk:10, skill:{ name:'岩甲回春', desc:'血量上限+30%+立即回满', type:'hpMaxUp', pct:30 }, cd:6 },
    { id:'e7',  name:'镇山石狮',  atk:11, skill:{ name:'石狮无畏', desc:'免疫所有控制2回合', type:'immuneCtrl', dur:2 }, cd:4 },
    { id:'e8',  name:'大地灵鼹',  atk:11, skill:{ name:'大地反噬', desc:'反弹30%伤害2回合', type:'reflectPct', pct:30, dur:2 }, cd:4 },
    { id:'e9',  name:'玄土石蟒',  atk:12, skill:{ name:'蟒击碎岩', desc:'350%土属性直接伤害', type:'instantDmg', attr:'earth', pct:350 }, cd:4 },
    { id:'e10', name:'后土神兽',  atk:13, skill:{ name:'后土庇佑', desc:'全队防御+60%持续3回合', type:'allDefUp', pct:60, dur:3 }, cd:7 },
    { id:'e11', name:'厚土灵虫',  atk:11, skill:{ name:'土魂涌现', desc:'随机8颗变土珠+土珠概率大增', type:'convertBead', attr:'earth', count:8, beadBoost:true }, cd:4 },
    { id:'e12', name:'山岳灵兔',  atk:12, skill:{ name:'兔踢三连', desc:'连续攻击3次，每次120%土伤害', type:'multiHit', attr:'earth', hits:3, pct:120 }, cd:4 },
    { id:'e13', name:'镇地石龙',  atk:11, skill:{ name:'镇地龙吼', desc:'全队防御+40%持续2回合', type:'allDefUp', pct:40, dur:2 }, cd:5 },
    { id:'e14', name:'玄土灵蛤',  atk:12, skill:{ name:'蛤蟆震地', desc:'眩晕1回合+破甲（防御归零）', type:'stunBreakDef', stunDur:1 }, cd:5 },
    { id:'e15', name:'裂地灵蚁',  atk:11, skill:{ name:'灵蚁化水', desc:'全部水珠转土珠+土珠概率大增', type:'replaceBeads', fromAttr:'water', toAttr:'earth', beadBoost:true }, cd:4 },
    { id:'e16', name:'山岩石象',  atk:11, skill:{ name:'象踏碎甲', desc:'眩晕1回合+破甲（防御减半）', type:'stunBreakDef', stunDur:1 }, cd:4 },
    { id:'e17', name:'后土灵蚕',  atk:10, skill:{ name:'地脉转珠', desc:'十字形珠子全变土珠', type:'convertCross', attr:'earth' }, cd:4 },
    { id:'e18', name:'镇地神牛',  atk:14, skill:{ name:'神牛碎天', desc:'500%土属性爆裂伤害', type:'instantDmg', attr:'earth', pct:500 }, cd:5 },
    { id:'e19', name:'厚土灵龟',  atk:11, skill:{ name:'灵龟镇水', desc:'全部水珠转土珠+全队防御+20%', type:'replaceBeads', fromAttr:'water', toAttr:'earth', defBoost:20 }, cd:5 },
    { id:'e20', name:'玄武神君',  atk:13, skill:{ name:'玄武破天', desc:'眩晕2回合+土伤×3倍', type:'stunPlusDmg', attr:'earth', pct:200, stunDur:2 }, cd:6 },
  ],
}

// ===== 宠物强度分档（T1神兽 / T2灵兽 / T3幼兽） =====
// T1: ATK≥13 或拥有终极技能（500%爆裂、战神、复活、眩晕+3倍等）
// T2: ATK 10-12 且技能中等偏强
// T3: ATK 8-9 或技能偏弱/偏辅助
const PET_TIER = {
  T1: [
    'm10','m18','m19','m20',        // 九天金凰、金锋战神、金耀星君、万钧金神
    'w10','w20',                    // 万木之主、神木麒麟
    's10','s17',                    // 沧海龙神、沧澜鲲鹏
    'f10','f16','f17',              // 朱雀神火、焚天火蟒、赤焰麒麟
    'e10','e18','e20',              // 后土神兽、镇地神牛、玄武神君
  ],
  T2: [
    'm4','m5','m6','m9','m11','m13','m14','m15','m16','m17',  // 金属性中坚
    'w5','w6','w7','w12','w14','w15','w16','w17','w18','w19', // 木属性中坚
    's4','s6','s8','s11','s12','s14','s15','s16','s18','s19','s20', // 水属性中坚
    'f3','f4','f5','f6','f7','f8','f11','f12','f13','f14','f15','f18','f19','f20', // 火属性中坚
    'e4','e5','e8','e9','e11','e12','e13','e14','e15','e16','e17','e19', // 土属性中坚
  ],
  T3: [
    'm1','m2','m3','m7','m8','m12',  // 金属性幼兽
    'w1','w2','w3','w4','w8','w9','w11','w13', // 木属性幼兽
    's1','s2','s3','s5','s7','s9','s13', // 水属性幼兽
    'f1','f2','f9',                  // 火属性幼兽
    'e1','e2','e3','e6','e7',        // 土属性幼兽
  ],
}

// 根据宠物ID获取档位
function getPetTier(id) {
  if (PET_TIER.T1.includes(id)) return 'T1'
  if (PET_TIER.T2.includes(id)) return 'T2'
  return 'T3'
}

// 不同获取渠道的档位权重
const TIER_WEIGHTS = {
  starter:   { T3:100, T2:0,  T1:0  },  // 开局初始：全T3
  normal:    { T3:50,  T2:40, T1:10 },  // 普通战斗
  elite:     { T3:15,  T2:55, T1:30 },  // 精英战斗
  boss:      { T3:0,   T2:40, T1:60 },  // BOSS战斗
  shop:      { T3:30,  T2:50, T1:20 },  // 商店招募
  adventure: { T3:0,   T2:30, T1:70 },  // 奇遇
}

// ===== ★3满星技能强化覆写 =====
// 每只宠物升到★3后技能质变，desc更新+数值/效果增强
const STAR3_SKILL_OVERRIDE = {
  // --- 金属性 ---
  m1:  { desc:'下次金属性伤害×3倍，持续2回合', pct:200, dur:2 },
  m2:  { desc:'整行变金珠+额外随机3颗变金珠', extra:3 },
  m3:  { desc:'护盾20点+本回合免伤35%+反弹15%伤害', val:20, reducePct:35, reflectPct:15 },
  m4:  { desc:'对敌造成350%伤害+无视50%防御', pct:350, ignoreDefPct:50 },
  m5:  { desc:'眩晕2回合+期间受伤+30%', dur:2, extraDmgPct:30 },
  m6:  { desc:'Combo+3不断+Combo伤害+25%', count:3, comboDmgPct:25 },
  m7:  { desc:'全部木珠转心珠+心珠回复+40%', toAttr:'heart', heartBoost:40 },
  m8:  { desc:'转珠+5秒+金珠概率大增+Combo+1', sec:5, bonusCombo:1 },
  m9:  { desc:'金攻无视全防+伤害×2倍', dmgMul:100 },
  m10: { desc:'抵挡致死+回复80%血量+无敌1回合', healPct:80, immuneDur:1 },
  m11: { desc:'连续攻击4次，每次120%攻击力', hits:4, pct:120 },
  m12: { desc:'全部木珠转金珠+金伤+50%', dmgBoost:50 },
  m13: { desc:'必暴击+暴击伤害+80%', critDmgBonus:80 },
  m14: { desc:'全队攻击+45%持续3回合', pct:45, dur:3 },
  m15: { desc:'十字形全变金珠+金属性伤害+40%', dmgBoost:40 },
  m16: { desc:'全队攻击+65%持续3回合', pct:65, dur:3 },
  m17: { desc:'随机12颗变金珠+金珠概率大增', count:12 },
  m18: { desc:'全队攻击+55%持续4回合+必暴击2回合', pct:55, dur:4, critDur:2 },
  m19: { desc:'眩晕3回合+下次金伤×4倍', stunDur:3, pct:300 },
  m20: { desc:'700%金属性爆裂伤害+溅射全体30%', pct:700, splash:30 },
  // --- 木属性 ---
  w1:  { desc:'回复50%血量+清除1个负面', pct:50, cleanse:1 },
  w2:  { desc:'剧毒40点/回合，持续4回合', dmg:40, dur:4 },
  w3:  { desc:'全部土珠转心珠+心珠回复+40%', heartBoost:40 },
  w4:  { desc:'整列变木珠+额外随机3颗变木珠', extra:3 },
  w5:  { desc:'全部土珠转木珠+回血12点/回合持续3回合', regen:12, regenDur:3 },
  w6:  { desc:'下次木属性伤害×3.5倍', pct:250 },
  w7:  { desc:'眩晕3回合+中毒30/回合持续3回合', dur:3, dotDmg:30 },
  w8:  { desc:'眩晕2回合+中毒30/回合持续4回合', dur:2, dotDmg:30, dotDur:4 },
  w9:  { desc:'木珠概率大增持续2回合', dur:2 },
  w10: { desc:'全队全属性伤害+55%持续4回合', pct:55, dur:4 },
  w11: { desc:'护盾45点+减伤30%持续3回合', val:45, reducePct:30, dur:3 },
  w12: { desc:'连续攻击4次，每次140%木伤害', hits:4, pct:140 },
  w13: { desc:'清除所有负面+免疫控制3回合+回复15%血量', immuneDur:3, healPct:15 },
  w14: { desc:'下次木属性伤害×3倍', pct:200 },
  w15: { desc:'全部土珠转木珠+全队攻击+30%', atkBoost:30 },
  w16: { desc:'十字形全变木珠+木属性伤害+40%', dmgBoost:40 },
  w17: { desc:'Combo不断+Combo伤害+70%', comboDmgPct:70 },
  w18: { desc:'整行变木珠+木珠概率大增+木伤+20%', dmgBoost:20 },
  w19: { desc:'全队防御+55%持续4回合', pct:55, dur:4 },
  w20: { desc:'700%木属性爆裂伤害+全体回复15%', pct:700, teamHealPct:15 },
  // --- 水属性 ---
  s1:  { desc:'整列变水珠+额外随机3颗变水珠', extra:3 },
  s2:  { desc:'全部火珠转心珠+心珠回复+40%', heartBoost:40 },
  s3:  { desc:'冰冻敌人2回合+受伤+25%', dur:2, extraDmgPct:25 },
  s4:  { desc:'350%水属性伤害+无视50%防御', pct:350, ignoreDefPct:50 },
  s5:  { desc:'回复60%血量+清除1个负面', pct:60, cleanse:1 },
  s6:  { desc:'下次水属性伤害×3.5倍', pct:250 },
  s7:  { desc:'反弹40%伤害持续3回合', pct:40, dur:3 },
  s8:  { desc:'全属性伤害+45%持续3回合', pct:45, dur:3 },
  s9:  { desc:'免疫所有控制3回合', dur:3 },
  s10: { desc:'全场一半珠子变水珠+水伤+30%', count:18, dmgBoost:30 },
  s11: { desc:'随机12颗变水珠+水珠概率大增', count:12 },
  s12: { desc:'连续攻击4次，每次140%水伤害', hits:4, pct:140 },
  s13: { desc:'冰冻2回合+水伤×3倍', stunDur:2, pct:200 },
  s14: { desc:'眩晕3回合+水伤×3倍', stunDur:3, pct:200 },
  s15: { desc:'转珠+5秒+Combo不断+Combo+1', sec:5, bonusCombo:1 },
  s16: { desc:'反弹40%伤害持续3回合', pct:40, dur:3 },
  s17: { desc:'700%水属性爆裂伤害+冰冻1回合', pct:700, stunDur:1 },
  s18: { desc:'全队防御+65%持续4回合', pct:65, dur:4 },
  s19: { desc:'全部火珠转水珠+水珠概率大增+水伤+25%', dmgBoost:25 },
  s20: { desc:'免疫控制3回合+护盾35点', immuneDur:3, shieldVal:35 },
  // --- 火属性 ---
  f1:  { desc:'下次火属性伤害×3倍，持续2回合', pct:200, dur:2 },
  f2:  { desc:'整行变火珠+额外随机3颗变火珠', extra:3 },
  f3:  { desc:'500%火属性直接伤害', pct:500 },
  f4:  { desc:'必暴击+暴击伤害+80%', critDmgBonus:80 },
  f5:  { desc:'灼烧40点/回合，持续4回合', dmg:40, dur:4 },
  f6:  { desc:'Combo伤害额外+80%', pct:80 },
  f7:  { desc:'眩晕2回合+期间受伤+30%', dur:2, extraDmgPct:30 },
  f8:  { desc:'Combo+6不断+Combo伤害+25%', count:6, comboDmgPct:25 },
  f9:  { desc:'全部金珠转心珠+心珠回复+40%', heartBoost:40 },
  f10: { desc:'全队暴击率+70%持续3回合', pct:70, dur:3 },
  f11: { desc:'随机12颗变火珠+火珠概率大增', count:12 },
  f12: { desc:'连续攻击4次，每次150%火伤害', hits:4, pct:150 },
  f13: { desc:'全队主动攻击，每只200%伤害', pct:200 },
  f14: { desc:'暴击伤害+60%+必暴击2回合', pct:60, critDur:2 },
  f15: { desc:'眩晕3回合+火伤×4倍', stunDur:3, pct:300 },
  f16: { desc:'700%火属性爆裂伤害+灼烧40点3回合', pct:700, dotDmg:40 },
  f17: { desc:'全队攻击+65%持续4回合', pct:65, dur:4 },
  f18: { desc:'每段Combo暴击率+15%', pct:15 },
  f19: { desc:'火伤无视全防+伤害×2倍', dmgMul:100 },
  f20: { desc:'残血时伤害+120%', pct:120 },
  // --- 土属性 ---
  e1:  { desc:'全部水珠转心珠+心珠回复+40%', heartBoost:40 },
  e2:  { desc:'整行变土珠+额外随机3颗变土珠', extra:3 },
  e3:  { desc:'护盾55点+减伤15%持续1回合', val:55, reducePct:15 },
  e4:  { desc:'眩晕2回合+期间受伤+30%', dur:2, extraDmgPct:30 },
  e5:  { desc:'下次土属性伤害×3.5倍', pct:250 },
  e6:  { desc:'血量上限+40%+立即回满', pct:40 },
  e7:  { desc:'免疫所有控制3回合+护盾20点', dur:3, shieldVal:20 },
  e8:  { desc:'反弹40%伤害3回合', pct:40, dur:3 },
  e9:  { desc:'500%土属性直接伤害', pct:500 },
  e10: { desc:'全队防御+75%持续4回合', pct:75, dur:4 },
  e11: { desc:'随机12颗变土珠+土珠概率大增', count:12 },
  e12: { desc:'连续攻击4次，每次140%土伤害', hits:4, pct:140 },
  e13: { desc:'全队防御+55%持续3回合', pct:55, dur:3 },
  e14: { desc:'眩晕2回合+破甲（防御归零）+受伤+20%', stunDur:2, extraDmgPct:20 },
  e15: { desc:'全部水珠转土珠+土珠概率大增+土伤+25%', dmgBoost:25 },
  e16: { desc:'眩晕2回合+破甲（防御归零）', stunDur:2 },
  e17: { desc:'十字形全变土珠+土属性伤害+40%', dmgBoost:40 },
  e18: { desc:'700%土属性爆裂伤害+眩晕1回合', pct:700, stunDur:1 },
  e19: { desc:'全部水珠转土珠+全队防御+30%', defBoost:30 },
  e20: { desc:'眩晕3回合+土伤×4倍', stunDur:3, pct:300 },
}

// 判断宠物当前星级是否已解锁技能（★1无技能，★2+解锁）
function petHasSkill(pet) {
  return (pet.star || 1) >= 2 && !!pet.skill
}

// 获取宠物当前技能描述（★1无技能，★2基础技能，★3强化技能）
function getPetSkillDesc(pet) {
  const star = pet.star || 1
  if (star < 2) return ''  // ★1无技能
  if (star >= 3 && STAR3_SKILL_OVERRIDE[pet.id]) {
    return STAR3_SKILL_OVERRIDE[pet.id].desc
  }
  return pet.skill ? pet.skill.desc : ''
}

// 获取★3强化数据（若有）
function getStar3Override(petId) {
  return STAR3_SKILL_OVERRIDE[petId] || null
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

// 获取宠物星级技能数值倍率（★1无技能，★2=1.0基础，★3=1.25强化）
function getPetStarSkillMul(pet) {
  const star = pet.star || 1
  if (star < 2) return 0  // ★1无技能
  return Math.pow(STAR_SKILL_MUL, star - 2)  // ★2=1.0, ★3=1.25
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

// 从本局宠物池中随机获取一只宠物（支持渠道分池）
// ownedIds: 可选，已拥有宠物ID集合，30%概率优先抽已拥有的（促进升星）
// source: 获取渠道 'normal'|'elite'|'boss'|'shop'|'adventure'|'starter'
// maxedIds: 可选，已满星(★3)宠物ID集合，从池中排除
function randomPetFromPool(sessionPool, ownedIds, source, maxedIds) {
  if (!sessionPool || sessionPool.length === 0) return randomPet()

  // 过滤掉已满星的宠物
  let pool = sessionPool
  if (maxedIds && maxedIds.size > 0) {
    pool = sessionPool.filter(p => !maxedIds.has(p.id))
    if (pool.length === 0) pool = sessionPool // 全满星时退化为全池
  }

  const weights = TIER_WEIGHTS[source] || TIER_WEIGHTS.normal

  // 按权重roll档位
  const totalW = weights.T3 + weights.T2 + weights.T1
  let roll = Math.random() * totalW
  let tier = 'T3'
  if (roll < weights.T1) tier = 'T1'
  else if (roll < weights.T1 + weights.T2) tier = 'T2'
  else tier = 'T3'

  // 从本局池中筛出该档位的宠物
  let tierPool = pool.filter(p => getPetTier(p.id) === tier)
  // 若该档位在池中没有（极端情况），退化为全池
  if (tierPool.length === 0) tierPool = pool

  // 30%概率偏向已有宠物（兼顾升星与新鲜感）
  if (ownedIds && ownedIds.size > 0 && Math.random() < 0.3) {
    const owned = tierPool.filter(p => ownedIds.has(p.id))
    if (owned.length > 0) {
      const p = owned[Math.floor(Math.random() * owned.length)]
      return { ...p, star: 1 }
    }
  }
  const p = tierPool[Math.floor(Math.random() * tierPool.length)]
  return { ...p, star: 1 }
}

// 生成本局宠物池：每属性保证1只T1+1只T2+1只T3，共15只（分层组池+升星友好）
function generateSessionPetPool() {
  const pool = []
  for (const attr of ['metal','wood','water','fire','earth']) {
    const attrPets = PETS[attr]
    const t1 = attrPets.filter(p => PET_TIER.T1.includes(p.id))
    const t2 = attrPets.filter(p => PET_TIER.T2.includes(p.id))
    const t3 = attrPets.filter(p => PET_TIER.T3.includes(p.id))
    // 每档随机选1只
    const shuffle = arr => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    }
    if (t1.length > 0) pool.push({ ...shuffle(t1)[0], attr, star: 1 })
    if (t2.length > 0) pool.push({ ...shuffle(t2)[0], attr, star: 1 })
    if (t3.length > 0) pool.push({ ...shuffle(t3)[0], attr, star: 1 })
  }
  return pool
}

// 开局生成初始4只宠物（从本局池中选T3幼兽，保证成长曲线）
function generateStarterPets(sessionPool) {
  const allAttrs = ['metal','wood','water','fire','earth']
  // 随机打乱后取前4个属性
  for (let i = allAttrs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allAttrs[i], allAttrs[j]] = [allAttrs[j], allAttrs[i]]
  }
  const chosen = allAttrs.slice(0, 4)
  return chosen.map(attr => {
    // 优先从本局池中该属性的T3幼兽选
    if (sessionPool) {
      const t3Pool = sessionPool.filter(p => p.attr === attr && getPetTier(p.id) === 'T3')
      if (t3Pool.length > 0) {
        const pet = t3Pool[Math.floor(Math.random() * t3Pool.length)]
        return { ...pet, attr, star: 1, currentCd: 0 }
      }
      // 若T3没有，从该属性全池中选最弱的
      const attrPool = sessionPool.filter(p => p.attr === attr)
      attrPool.sort((a, b) => a.atk - b.atk)
      if (attrPool.length > 0) {
        return { ...attrPool[0], attr, star: 1, currentCd: 0 }
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

// ===== 灵兽图鉴故事 =====
const PET_LORE = {
  // ── 金属性 ──
  m1:  '出身西荒矿脉的野猫，偶食一枚金精石后通灵开智。爪尖常年泛着锋锐金光，修士路过矿脉时见它一爪劈开顽石，遂收为灵宠。性格高傲，不喜与人亲近，唯独对金属性灵珠爱不释手。',
  m2:  '传闻此鼠本是金矿深处的鼠王，统领千鼠开采灵石。后被金罡妖帝击败，不得已投入修士门下。它善于排兵布阵，能以金珠组成阵法，连精英妖兵见了都要退避三舍。',
  m3:  '自称"玄甲将军"的金狮幼崽，出生时浑身覆满金色鳞甲。据说它的祖先曾是守护九天金矿的神兽，如今血脉衰落，但骨子里的骄傲丝毫不减。战斗时喜欢用金甲硬抗敌人攻击，一边挨打一边骂对方"痒痒的"。',
  m4:  '天罡山上空盘旋的金色大鹏，翼展虽不过三尺，却能卷起金色罡风。据说天罡妖卫见到它都会行礼——因为它长得实在太像天罡妖帝年幼时的模样。它自己倒不在乎这些，只想找更多的金属性灵珠来修炼。',
  m5:  '战场上捡回来的破碎金傀儡，被修士用灵力重新修复后竟然产生了灵智。性格暴躁，动不动就要"碎了谁"。它的金缚锁据说是从炼狱守卫·妖兵统领那里偷学来的，虽然威力差了十万八千里。',
  m6:  '原是一把被遗弃的金色飞剑，在灵脉交汇处吸收天地灵气千年，化为剑灵。它记不清自己的主人是谁了，只记得一句口诀"剑气纵横，斩尽邪魔"。现在它把这句话当作战斗口号，每次出招都要喊一遍。',
  m7:  '金罡山下的小守卫，负责看守一处不重要的灵石矿。它力气不大，攻击平平，但有一手不错的罡气化愈术，修士受伤时总是第一个跑来帮忙。梦想是有朝一日成为像金罡战魂一样的强者。',
  m8:  '通体金黄的灵雀，叫声清脆如金铃，据说鸣叫时能震碎劣质灵石。它以前在天罡山当传令鸟，负责在各个哨所间传递消息，对地形了如指掌，常常能帮修士找到隐藏的宝物。',
  m9:  '从金甲妖将·碎天手下叛逃的妖兵，受了重伤被修士救回。为报恩化为灵宠随行。它最擅长找到敌人铠甲的破绽，一击破甲，连曾经的长官都忌惮它三分。',
  m10: '九天之上最后一只金凰幼雏，其母在抵抗混沌魔神·灭世时陨落。它继承了母亲的金身不灭之法，浴火重生后身披纯金羽翼。虽然年幼，但体内蕴含的力量连元婴修士都不敢小觑。',
  m11: '身形灵活的金色斥候，善于在战场上快速穿梭。它能在眨眼间连续发出三道金色锐气，敌人往往还没反应过来就已经身中数击。以前在锐金妖兵的队伍里当过逃兵，现在说起来还有点不好意思。',
  m12: '身上刻满金色纹路的战将灵兽，据说这些纹路蕴含着五行转化的奥秘。它无意间领悟了"金生水、水生木"的道理，能将金属性灵力转化为木属性攻击，让敌人防不胜防。',
  m13: '来无影去无踪的暗金色灵兽，修士至今不知它原来的身份。它出手极快，一击致命后便消失在金光中。有人说它是被万妖之主·通天放逐的影卫，也有人说它不过是金矿里的一只灵鼬。',
  m14: '浑身金甲的忠诚卫士，嗓门极大，一声战吼能让周围的灵珠都为之颤动。它的防御力虽然不是最强的，但它的战吼能极大提升同伴的士气。曾经守护过一座已经坍塌的金属性秘境入口。',
  m15: '传说金虹出现之地，必有奇宝。这只灵兽便是在金虹之下诞生的，体内天生蕴含金虹之力。金虹贯日是它的看家本领，一击之下如同万道金光齐落，极为壮观。',
  m16: '无主的金色战魂，不知在战场上游荡了多少岁月。修士以灵力引导它凝聚成形，从此成为最忠实的战斗伙伴。它没有过去的记忆，只有战斗的本能——爆发时浑身金焰升腾，连周围空气都在燃烧。',
  m17: '金翎山上的灵鸟使者，尾羽如同金色刀刃。相传它是破军金狮的旧部，金狮被修士击败后它主动投诚。它能操控金色羽翎在空中形成风暴，密密麻麻的羽刃让敌人无处可躲。',
  m18: '金属性灵兽中的传说——战神。据说它曾单独对抗一整支金甲妖兵队伍，毫发无伤地击退了所有敌人。它的"战神降临"一出，天地金光大作，连周围的普通灵珠都会被激发出金色光芒。修士们私下称它为"小金帝"。',
  m19: '夜空中最亮的金色星辰化形而来。它出现时，天空中总会多出一颗金色的星星。它的星耀裂空之术可以从天际召唤一道金色星光，威力惊人。据说它的终极目标是与九天金凰联手，重建九天金矿。',
  m20: '金属性灵兽中当之无愧的王者，体型虽小但蕴含万钧之力。传说它是远古金神的最后一滴精血所化，一出生就拥有了超越多数灵兽的力量。它的万钧神威能压制一切金属性以下的存在，就连妖皇看见它也要客气三分。',

  // ── 木属性 ──
  w1:  '林间温顺的青色灵鹿，以百草为食，走过之处花草自生。受伤的小动物总爱聚在它身旁，因为它身上散发的灵气能加速伤口愈合。虽然性格胆小，但为了保护同伴时会变得异常勇敢。',
  w2:  '藤萝深处修炼成精的灵蛇，本性并不凶恶，只是牙上的剧毒让人望而生畏。它喜欢在阳光下晒暖，偶尔帮修士驱赶靠近营地的妖虫。据说它的毒液稀释后是极好的灵药引子。',
  w3:  '森林深处的灵熊，体型在幼崽中算大的，但性格憨厚老实。它的熊力化愈术是从一棵千年古树那里学来的，每次施展时身上会冒出嫩绿色的光芒。最大的爱好是冬眠和吃蜂蜜味的灵果。',
  w4:  '万木森林中最狡猾的灵狐，能将周围的落叶化为灵珠。它的脑子转得比谁都快，修士还没想到的战术它已经布置好了。唯一的缺点是太爱偷懒——没有战斗时就窝在木灵使者的藤蔓吊床上睡觉。',
  w5:  '由百花精华凝聚而成的灵体，据说是灵木仙子转世。它能将大地之力转化为土属性灵珠，是队伍中难得的属性转化型灵宠。说话轻声细语，走路都不愿踩到一朵小花。',
  w6:  '脾气火爆的青色战灵，和它温和的木属性完全不搭。它以前是苍木蛮将的坐骑，被修士击败后不仅不记恨，反而觉得"强者为尊"，主动追随。爆发起来出手极快，两个回合就能再次释放木灵之力。',
  w7:  '古老森林中的藤蔓之主，性格阴沉，喜欢用藤蔓将敌人层层缠绕。据说它曾经困住过一只逃跑的金甲妖将长达三天三夜。它说话慢悠悠的，干活也慢悠悠的，但一旦缠住你——别想跑。',
  w8:  '看起来像一截枯木桩子，实际上已经活了上百年。它脾气古怪，说话阴阳怪气，但偏偏缠魂术极为厉害。据说它的前身是一棵被雷劈过的古树，所以对雷电特别敏感，每次打雷都要钻到修士身后。',
  w9:  '年轻有朝气的木灵使者，身上总是围绕着新生的枝芽。它出手虽然不重，但胜在恢复极快，两个回合就能再次施展灵木之术。森林中的小动物都喜欢围着它转，因为它身上永远是春天的味道。',
  w10: '万木森林最深处的存在，所有木属性灵兽都以它为尊。它极少露面，但一旦出手便是天地变色——万木齐动，枝叶化刃。据说它与神木麒麟是同源而生的一对存在，一个掌管森林，一个掌管新生。',
  w11: '总是躲在藤甲后面的胆小灵兽，但它的防御力出奇地强。据说藤甲壁垒可以挡住精英级妖兵的全力一击。它最大的烦恼是走路太慢——背着一身藤甲，跑都跑不动。',
  w12: '竹林中长大的灵蟋蟀，弹跳力惊人，攻击速度极快。它能在一瞬间完成三次翠竹连击，每一击都精准无比。平时喜欢在竹叶上弹琴——虽然修士们觉得那更像是噪音。',
  w13: '形似灵芝的可爱蘑菇灵兽，浑身散发淡淡药香。它天生具有净化之力，任何毒素在它面前都会被分解。虽然攻击力不高，但在面对毒系敌人时简直是救命稻草。它最讨厌的事是被人误认为食材。',
  w14: '半蟒半蛟的凶猛灵兽，在木属性灵兽中战力拔尖。它的蛟龙木爆出手极快，两回合一个循环，连续轰炸让敌人喘不过气。据说它一直想进化为真正的蛟龙，为此每天都在拼命修炼。',
  w15: '通体翠绿的仙鹿，角上结着五彩灵珠。它温和而优雅，能将木属性灵力化为各种灵珠。据说它曾是万木之主的侍从，后来自愿下山辅佐修士。跑起来时蹄下生花，美得不像话。',
  w16: '据说已经活了一千年的古藤精，粗壮的藤条能轻松卷起巨石。它说话像个老学究，总爱讲"当年我还是棵小苗的时候……"。但它的古藤缠天之术确实名不虚传，就连枯木大妖·噬灵都曾被它困住过。',
  w17: '翠绿色的螳螂灵兽，一对镰刀臂削铁如泥。它自认为是木属性中最帅的灵兽，每天要花很长时间整理触角。战斗风格凌厉果断，螳螂无双的连招让敌人目不暇接。唯一的弱点——怕鸟。',
  w18: '青鸾与翠雀的混血后代，羽毛青翠欲滴。它在空中的舞姿优美无比，但可别被外表骗了——翠雀风舞带起的木属性风刃杀伤力极强。它的梦想是飞到天罡山顶看一看传说中的金色云海。',
  w19: '背上长满苔藓和小树的巨龟，看起来像座移动的小山丘。它的防御力极高，神龟之力一发动就如同一座山压向敌人。虽然行动缓慢但意志坚定，据说它正在慢慢地——非常慢地——朝着化神境走去。',
  w20: '传说中的神木麒麟，木属性灵兽中的至尊。据说太古时期它与万木之主共同创造了第一片森林。它的神木灭世之术可以在瞬间让整片大地化为密林，将敌人淹没在无尽的枝叶之中。脾气温和但底线很高——谁敢伤害森林，它绝不饶恕。',

  // ── 水属性 ──
  s1:  '沧澜海边的小水雀，翅膀沾着水就能飞。它发现灵珠的本领在水属性灵兽中首屈一指，经常叼回各种水属性灵珠献给修士。据说它以前是一只普通的海鸥，喝了一口灵泉水后才变成了灵兽。',
  s2:  '背壳上结着冰晶的小灵龟，据说它的壳里藏着一小片远古冰海的碎片。它的冰魄化愈术冰凉舒适，受伤时被它治疗简直是享受。性格沉稳，是队伍中最可靠的治疗担当之一。',
  s3:  '海底龙宫里的蛟童，因为贪玩跑到岸上来被修士捡到。它虽然还小，但已经会使寒冰封印了，冻住的敌人要好一会儿才能挣脱。最大的毛病是爱哭——打架输了哭，肚子饿了哭，想家了也哭。',
  s4:  '正统蛟龙血脉的水属性灵兽，虽然还只是幼年体但已有大将之风。蛟龙怒击一出，水浪滔天。它总是板着一张脸，仿佛谁都欠它十万灵石。据说它最大的心愿是有朝一日化为真龙。',
  s5:  '碧绿色的灵蛙，个头不大但浑身充满灵力。它的碧波愈泉能治愈同伴的伤势，是战场上的小太阳。平时喜欢蹲在修士的肩膀上"呱呱"叫，虽然修士总觉得这叫声有点吵。',
  s6:  '在灵河里长大的金色小鱼，游速极快，攻击如同水中闪电。水灵爆涌只需两回合冷却，是水属性中节奏最快的攻击型灵兽之一。它的梦想是游遍九天十八海，看遍世间所有的灵河。',
  s7:  '浑身覆盖冰晶甲壳的灵蟹，钳子虽小但力气不小。它的寒冰之壁可以在修士面前形成一堵冰墙，挡住相当可观的伤害。性格内向，平时就喜欢缩在壳里吐泡泡，被打扰了才不情不愿地出来战斗。',
  s8:  '海域中的巨鲸幼崽，一张嘴就是一个漩涡。鲸吞怒涛的范围极大，虽然冷却较长但威力十足。它食量惊人，修士的灵石储备经常被它偷吃。好在它战斗时确实给力——值得那些灵石了。',
  s9:  '深海中的灵蚌，壳内含有一颗微型灵珠。它的凝水护体能在自身周围形成水幕屏障，虽然攻击力不强但防御相当可靠。它最珍视壳里的那颗灵珠——据说那是它从深渊蛟魔·溺魂领地里偷来的。',
  s10: '沧海深处最古老的龙神后裔，即使是幼年体也散发着令人敬畏的龙威。龙神覆海一出，方圆百里化为泽国。传说它的母亲就是那条守护沧海入口的太古龙神，因抵抗九天妖皇·逆仙的入侵而陨落。它继承了母亲的力量和使命。',
  s11: '银白色的冰蛾灵兽，翅膀上的鳞粉能在空中形成冰晶风暴。它看起来很弱小，但千万不要小看它——冰玄风暴可以同时攻击多个敌人，在群战中极为好用。它讨厌火，一靠近火堆就开始抖。',
  s12: '沧澜海底最快的海蛇，三次连续攻击如同三道水刃划过。它以前是深渊妖卫的斥候，后来不满妖族的暴行而出逃。被修士收留后变得非常忠诚，每次战斗都冲在最前面。',
  s13: '圆滚滚的玄水灵蟾，虽然长得不好看但本事不小。它的灵蟾冰封能将脚下的水面瞬间冻结，让敌人动弹不得。平时最喜欢蹲在石头上发呆，发呆的样子像一块长了眼睛的石头。',
  s14: '冰蓝色的灵鹤，在寒冰之巅修炼多年。它的冰魄封天可以召唤大片冰晶从天而降，冻住整个战场。据说它原本是冰魄仙蛇的仆从，不满于仙蛇的残暴统治而出走。姿态优雅，每一个动作都像在跳舞。',
  s15: '半透明的海灵水母，触手上布满微型灵阵。水母幻术可以扰乱敌人的感知，让对方分不清哪个是真身哪个是幻影。它没有固定形态，高兴时是圆的，生气时会变成方的——修士觉得这很有趣。',
  s16: '翅膀如同两面水镜的灵蝶，美丽而致命。它的水镜反射能将敌人的攻击原样弹回，是对付强敌的利器。传说它是由一滴仙人的泪水化成的——也有人说那只是一个美丽的传说。',
  s17: '远古鲲鹏的后裔，体内同时蕴含水属性和风属性之力。鲲鹏怒涛一出如同海啸降临，威力排在水属性灵兽前列。它性格豪爽，最看不惯以强凌弱，经常主动挑战比自己强大的敌人。',
  s18: '拥有神蛟血脉的守护型灵兽，它宁可自己受伤也要保护队友。神蛟护佑是水属性中最强的防御技能之一，能在危急关头为全队撑起水幕护盾。它对修士的忠诚度极高，据说即使修士倒下了它也不会离开。',
  s19: '可爱的水獭灵兽，身上的水纹在月光下会发出荧光。它能将水属性灵力转化为火属性——这在水系灵兽中极为罕见。据说是因为它小时候掉进过一个火水交融的灵泉，从此身兼两种属性之力。',
  s20: '冰与火的矛盾结合体——冰凰。据说远古时期有一只凤凰飞入了绝对零度的冰海，从此化为冰凰神鸟。它的冰凰绝对能在瞬间将周围温度降至极低，一切生物都会被冻结。虽然看起来冷冰冰，其实内心还挺暖的。',

  // ── 火属性 ──
  f1:  '赤红色的小火狐，尾巴上总是跳动着小火苗。它出手速度极快，两个回合就能再次发动焰爪连击。性格活泼好动，喜欢在营地里窜来窜去，偶尔不小心把修士的帐篷点着——然后假装什么都没发生。',
  f2:  '火焰谷中的狼王幼崽，继承了父亲的烈火珠阵。它的嚎叫能点燃周围的灵珠，形成火焰阵法。虽然看起来凶猛，其实特别护食——谁要碰它的烤肉，它就跟谁拼命。',
  f3:  '凤凰血脉觉醒的烈阳火鸟，虽然离真正的凤凰还差得远，但凤凰烈焰的威力已经相当可观。它身上总是散发着温暖的光芒，寒冷的夜晚修士们都喜欢围着它取暖。它对此毫不介意——甚至有点享受被围观的感觉。',
  f4:  '全身覆盖火焰鳞片的火麟兽，出招又快又狠。炎狱暴击命中要害时的伤害极为恐怖。据说它是从炎狱妖帝手下逃出来的战奴，被修士解救后发誓永不再为妖族效力。虽然表面冷酷，但其实心存感恩。',
  f5:  '浑身冒火的蟾蜍灵兽，虽然其貌不扬但实力不俗。烈焰灼烧能持续造成火焰伤害，让敌人痛苦不堪。它最大的爱好是泡在岩浆温泉里——对它来说那就像泡澡一样舒服。',
  f6:  '由火焰莲花化形的灵兽，美丽而危险。火莲绽放时花瓣四散，每一片都是灼热的火刃。它不喜欢战斗，但更不喜欢有人打扰它在火焰泉边冥想。据说它在思考一个哲学问题——"到底是先有花还是先有火"。',
  f7:  '全身漆黑，只有眼睛是赤红色的火鸦。焚天之怒一出，黑色火焰能焚烧一切。它的来历成谜，据说与焚天魔凰·灭世有某种血脉关联。性格阴郁寡言，但对修士绝对忠诚——大概因为修士是唯一不怕它外表的人。',
  f8:  '通红的蝎子灵兽，尾刺上的火焰永不熄灭。炎魔连击能在短时间内发出多次攻击，配合尾刺的灼烧效果极为恐怖。它走路时地面会留下焦黑的脚印。修士的鞋子已经被它烫坏了好几双。',
  f9:  '红色的小蛇灵兽，蛇信子上跳动着火星。和其他火属性灵兽的暴力不同，它擅长的是蛇焰化愈——用温暖的火焰帮助同伴恢复。据说蛇焰化愈比普通治疗更舒适，就像泡在温泉里一样。',
  f10: '传说中的朱雀幼鸟，火属性灵兽中的皇族。朱雀圣焰带着神圣之力，能灼伤一切邪魔外道。它虽然还小，但眼神中透着与年龄不符的威严。据说它与九天金凰是表亲，两家经常为"谁更厉害"吵架。',
  f11: '火焰山中的灵猿，身手矫健，善于以火焰珠阵困住敌人。据说它以前是赤炎魔君的宠物，后来赤炎魔君被修士击败，它就"识时务"地换了主人。烹饪手艺不错——用自己的火焰烤出来的灵果特别香。',
  f12: '全身覆盖火焰鳞片的蜥蜴灵兽，在火焰中如鱼得水。炎狱三连的攻击速度极快，三道火刃几乎同时命中。它最讨厌水，下雨天就窝在山洞里不出来，修士怎么叫都没用。',
  f13: '在烈阳中翱翔的火鹰，目光如炬，能从极高处发现猎物。烈阳风暴可以从空中卷起一片火海。虽然冷却较长，但一击的覆盖范围极广。它的骄傲程度不亚于天罡金鹏——动不动就"本座"来"本座"去的。',
  f14: '凤凰系血脉的灵蝶，翅膀上的花纹是炎狱的图案。凰翼爆炎能在振翅瞬间释放大量火焰，美丽而致命。它和火莲灵花是好朋友，两个经常一起在火焰泉边聊天，被修士称为"火焰闺蜜"。',
  f15: '别看它个头小，这只火鼠体内蕴含的爆炸力令人咋舌。炎爆裂天能在一瞬间释放全部火力，虽然冷却较长但足以一击定胜负。它跑得飞快，而且有个奇怪的习惯——喜欢把找到的灵石全部搬到自己的窝里。',
  f16: '远古焚天蟒的后裔，体内流淌着太古火焰的力量。天火焚灭一出，连空气都在燃烧。据说它是朱雀神火之外最强的火属性灵兽，两者之间的较量至今没有定论。它很少说话——因为一开口就会喷火。',
  f17: '赤焰麒麟，火属性中的王者之一。麒麟战焰融合了麒麟神火与战斗意志，威力惊天动地。据说它与赤焰魔君曾有一段恩怨——魔君曾想吞噬它来提升修为，结果反被它打得落荒而逃。现在它跟着修士，每天都在变得更强。',
  f18: '背壳上燃烧着永恒火焰的灵龟，是火水双属性的奇特存在。元火暴击出手极快，三回合一个循环，火力输出稳定而持续。据说它的壳里封印着一小块太古炎核——这也是它火焰永不熄灭的秘密。',
  f19: '龙族中专修火道的炎龙幼崽，虽然还没长出翅膀但已经有了龙的威严。龙炎破甲能无视部分防御直接造成伤害。它的目标是有朝一日成为像沧海龙神那样的存在——虽然属性不同，但梦想是相通的。',
  f20: '外表像一只可爱的橘猫，实际上是火灵之力凝聚而成的神猫。余烬爆发能将看似熄灭的火焰重新引爆，让敌人猝不及防。它喜欢假装在睡觉，然后趁人不注意从背后偷袭——修士的发际线就是被它吓退的。',

  // ── 土属性 ──
  e1:  '山脚下最老实的石灵，圆滚滚的身体看起来人畜无害。厚土化愈术虽然简单但疗效稳定，是土属性中最可靠的治疗型灵兽。它说话慢、走路慢、打架也慢，但从不缺席任何一场战斗。',
  e2:  '由山岩碎片聚合而成的石怪，脑袋方方正正的。它的山岳珠阵能将脚下的碎石化为灵珠，虽然攻击力一般但资源生成能力不错。它最大的烦恼是经常被人当成路边的石头——坐在它身上的修士不止一个。',
  e3:  '全身覆盖坚硬犀甲的镇地灵兽，防御力在幼年灵兽中首屈一指。镇地壁垒能在身前形成一面石墙，挡住大部分攻击。性格固执，一旦决定守住某个位置就绝不退后——修士曾花了三个时辰才把它从门口挪开。',
  e4:  '传承玄武血脉的幼年灵兽，天生带有震慑之力。玄武震慑一发动，周围的低级妖兽会不由自主地瑟瑟发抖。它外表沉稳，内心却渴望冒险。最大的秘密——它偷偷在练习游泳，因为真正的玄武应该水陆双栖。',
  e5:  '铠甲鳞片坚硬如铁的穿山甲灵兽，以裂地重击闻名。它钻地速度极快，两个回合就能完成一次从地下突袭的循环。曾经一头钻进了磐岩巨魔·震地的领地，还全身而退——据它说是"跑得快"。',
  e6:  '山间溪流旁的岩蟹灵兽，甲壳上长满了青苔。岩甲回春结合了土的防御和木的治愈，是独特的防御治疗型灵兽。它的钳子虽然不大但力气十足，偶尔帮修士夹碎灵石矿——当然，它更多时候在晒太阳。',
  e7:  '镇山石狮的幼崽，继承了父辈无畏的战斗精神。石狮无畏发动时浑身石化，攻击力和防御力同时提升。虽然是幼崽但脾气很大，每天都在门口"站岗"，连修士的朋友来了都要先检查一番。',
  e8:  '地底深处的灵鼹鼠，最擅长从地下发起突然袭击。大地反噬能将敌人踩过的大地之力反射回去，以彼之道还施彼身。它几乎不在地面上出现，修士想找它时只能敲敲地面——它会从地下冒出个脑袋来。',
  e9:  '巨大的岩石蟒蛇，身体像一节节石柱连接在一起。蟒击碎岩一出力可开山，是土属性中攻击力数一数二的存在。据说它的身体里蕴含着大地脉搏的节律——每当大地震动，它就会变得异常亢奋。',
  e10: '传说中后土大神遗留在人间的最后一只神兽。后土庇佑能为全队提供强大的防御加成，是土属性中的最高守护者。它平时看起来就是一只普通的土色大狗，但一旦发动技能，整个大地都会为之呼应。',
  e11: '土黄色的灵虫，看起来不起眼但胜在数量取胜。土魂涌现能从地下召唤大量土属性灵珠，为队伍提供源源不断的弹药。据说地底下有一支庞大的灵虫军团，而它就是这支军团的联络员。',
  e12: '圆滚滚、蹦蹦跳跳的山岳灵兔，耳朵上沾满了泥土。别看它可爱，它的兔踢三连又快又准，三脚下去连山岩石王都要疼半天。据说它的腿力来自于每天在山上蹦跶——从山脚蹦到山顶再蹦回来。',
  e13: '由镇地石犀进化而来的土龙灵兽，吼声震耳欲聋。镇地龙吼能在大范围内造成震荡伤害，同时让敌人短暂失去平衡。它对镇地石犀有种长辈般的关爱，常常教它战斗技巧——虽然石犀更想学的是怎么跑快点。',
  e14: '体型圆胖的灵蛤蟆，看起来呆呆的实际上力大无穷。蛤蟆震地一跳，方圆数丈的地面都会裂开。它有一项隐藏技能——可以预感地震。每次它疯狂跳跃时修士就知道要找个安全的地方了。',
  e15: '土属性中罕见的转化型灵兽，能将土之灵力化为水属性攻击。据说它的蚁穴通到了一条地下暗河，所以同时习得了水属性之力。它工作非常勤快，经常帮修士搬运物资——只要你给它足够的灵果当报酬。',
  e16: '山岩石象的幼年体，皮肤坚硬如同岩石。象踏碎甲能无视部分防御造成伤害，在对付高防御敌人时极为好用。它脾气温顺，对修士非常亲近，喜欢用鼻子卷住修士的手表示亲密——只是力气大了点，经常把人卷起来。',
  e17: '吐出的蚕丝蕴含土之灵力，能改变灵珠排列的神奇灵兽。地脉转珠是一种独特的辅助技能，可以重新排列棋盘上的灵珠。它一天到晚都在吐丝，不吐丝的时候就在吃桑叶。修士的衣服被它吐的丝缠住过不止一次。',
  e18: '镇地神牛，土属性灵兽中力量最强的存在之一。神牛碎天一击之下如同天崩地裂，就连磐岩巨魔·震地在它面前也不敢大意。据说它的祖先曾是大地之神的坐骑，这份力量一代代传承至今。',
  e19: '修习水之道的土属性灵龟，体内同时蕴含土水双属性。灵龟镇水能压制水属性敌人的力量。据说它与万木神龟是同族远亲，两只龟经常比赛——比谁跑得更慢。结果至今没有分出胜负，因为两只都睡着了。',
  e20: '玄武神君，土属性灵兽中的至尊存在。它继承了远古玄武真神的力量，玄武破天一出，天地为之变色。据说它一直在等待一位足够强大的修士，带它去挑战通天塔最深处的秘密——那个连万妖之主都不敢触碰的禁地。',
}

function getPetLore(petId) {
  return PET_LORE[petId] || ''
}

module.exports = {
  PETS,
  MAX_STAR,
  PET_TIER,
  STAR3_SKILL_OVERRIDE,
  getPetTier,
  petHasSkill,
  getPetSkillDesc,
  getStar3Override,
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
  getPetLore,
  getMaxedPetIds,
}

// 收集已满星(★3)宠物ID集合
function getMaxedPetIds(g) {
  const ids = new Set()
  if (g.pets) g.pets.forEach(p => { if (p && (p.star || 1) >= MAX_STAR) ids.add(p.id) })
  if (g.petBag) g.petBag.forEach(p => { if (p && (p.star || 1) >= MAX_STAR) ids.add(p.id) })
  return ids
}
