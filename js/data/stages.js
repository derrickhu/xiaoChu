/**
 * 固定关卡配置 — 5章×8关 = 40 普通 + 40 精英 = 80 关
 * 普通关: 线性解锁 stage_1_1 → stage_1_2 → … → stage_5_8
 * 精英关: 对应普通关 bestRating === 'S' 解锁
 */

const { STAGE_REWARDS } = require('./economyConfig')

// ===== 章节体力（普通/精英分档） =====
const CHAPTER_STAMINA = {
  1: { normal: 4, elite: 6 },
  2: { normal: 6, elite: 9 },
  3: { normal: 10, elite: 15 },
  4: { normal: 12, elite: 18 },
  5: { normal: 15, elite: 22 },
}

// ===== 精英倍率（基于对应普通关数值） =====
const ELITE_MULTIPLIERS = {
  1: { hp: 1.8, atk: 1.3, def: 1.5 },
  2: { hp: 2.0, atk: 1.4, def: 1.5 },
  3: { hp: 2.2, atk: 1.5, def: 1.5 },
  4: { hp: 2.5, atk: 1.6, def: 1.8 },
  5: { hp: 3.0, atk: 1.8, def: 2.0 },
}

// ===== 周回碎片档位 =====
const CHAPTER_REP_FRAG = {
  1: { normal: { min: 1, max: 2, pool: 'chapter' }, elite: { min: 1, max: 3, pool: 'chapter' } },
  2: { normal: { min: 2, max: 3, pool: 'chapter' }, elite: { min: 2, max: 4, pool: 'chapter' } },
  3: { normal: { min: 2, max: 4, pool: 'chapter' }, elite: { min: 3, max: 5, pool: 'chapter' } },
  4: { normal: { min: 3, max: 5, pool: 'chapter' }, elite: { min: 4, max: 6, pool: 'chapter' } },
  5: { normal: { min: 3, max: 5, pool: 'chapter' }, elite: { min: 4, max: 7, pool: 'chapter' } },
}

// ===== 章节 =====
const CHAPTERS = [
  { id: 1, name: '灵山试炼', desc: '灵山脚下，试炼开始' },
  { id: 2, name: '幽冥秘境', desc: '幽暗深处，危机四伏' },
  { id: 3, name: '天劫雷域', desc: '九天雷劫，唯强者渡' },
  { id: 4, name: '仙灵古域', desc: '上古遗境，灵气纵横' },
  { id: 5, name: '万妖禁地', desc: '妖族圣域，终极之战' },
]

// ===== 奖励构建 =====
function mkRewards(ch, ord, diff, petId, weaponId, exp, repExp) {
  const idx = ord - 1
  const firstClear = [
    { type: 'pet', petId, fragCount: 5 },
  ]
  if (weaponId) firstClear.push({ type: 'weapon', weaponId })
  firstClear.push(
    { type: 'exp', amount: exp },
    { type: 'soulStone', amount: STAGE_REWARDS[ch][diff].soulStone.first[idx] },
  )
  return {
    firstClear,
    repeatClear: {
      fragments: CHAPTER_REP_FRAG[ch][diff],
      exp: repExp,
      soulStone: STAGE_REWARDS[ch][diff].soulStone.repeat[idx],
    },
  }
}

// ===== 关卡规格定义 =====
// 每条 spec 同时生成 1 个普通关 + 1 个精英关
// enemy  — 普通关敌人数据；精英关自动乘以 ELITE_MULTIPLIERS 并追加 eSkills
// pet/weapon — 普通关宠物/法宝首通奖励
// ePet/eWpn — 精英关宠物/法宝首通奖励
const STAGE_SPECS = {

  // ── 第一章：灵山试炼（Ch1: 16R） ──
  1: [
    {
      name: '初试·岩獾',
      enemy: { name: '岩獾', attr: 'earth', hp: 80, atk: 4, def: 0, skills: ['convert'], avatar: 'stage_enemies/rock_badger', newbieOverride: { hp: 60, atk: 3, def: 0 } },
      pet: 'm1', weapon: 'w1', exp: 80, repExp: 55, bs: 20, rating: { s: 5, a: 8 },
      teamSize: { min: 1, max: 5 }, staminaCost: 0,
      ePet: 'm3', eWpn: null, eExp: 100, eRepExp: 70, eBs: 25, eRating: { s: 7, a: 10 },
      eSkills: ['atkBuff'],
    },
    {
      name: '烈焰·焰狮',
      enemy: { name: '焰狮', attr: 'fire', hp: 125, atk: 5, def: 0, skills: ['convert'], avatar: 'stage_enemies/blaze_lion' },
      pet: 'w1', weapon: null, exp: 90, repExp: 60, bs: 22, rating: { s: 5, a: 8 },
      teamSize: { min: 1, max: 5 },
      ePet: 'w3', eWpn: 'w2', eExp: 110, eRepExp: 75, eBs: 28, eRating: { s: 7, a: 10 },
      eSkills: ['atkBuff'],
    },
    {
      name: '寒潮·碧潮鲸',
      enemy: { name: '碧潮鲸', attr: 'water', hp: 170, atk: 6, def: 1, skills: ['convert'], avatar: 'stage_enemies/tide_whale' },
      pet: 's1', weapon: 'w4', exp: 100, repExp: 70, bs: 25, rating: { s: 6, a: 9 },
      teamSize: { min: 2, max: 5 },
      ePet: 's3', eWpn: null, eExp: 120, eRepExp: 80, eBs: 30, eRating: { s: 8, a: 11 },
      eSkills: ['atkBuff'],
    },
    {
      name: '金锋·雷貂',
      enemy: { name: '雷貂', attr: 'metal', hp: 215, atk: 7, def: 1, skills: ['atkBuff'], avatar: 'stage_enemies/thunder_marten' },
      pet: 'f1', weapon: null, exp: 110, repExp: 75, bs: 28, rating: { s: 6, a: 9 },
      ePet: 'f2', eWpn: 'w5', eExp: 130, eRepExp: 90, eBs: 35, eRating: { s: 8, a: 11 },
      eSkills: ['defBuff'],
    },
    {
      name: '翠影·灵鹿',
      enemy: { name: '灵鹿', attr: 'wood', hp: 260, atk: 8, def: 2, skills: ['convert', 'atkBuff'], avatar: 'stage_enemies/leaf_deer' },
      pet: 'e1', weapon: 'w3', exp: 120, repExp: 80, bs: 30, rating: { s: 6, a: 10 },
      ePet: 'e2', eWpn: 'w7', eExp: 140, eRepExp: 95, eBs: 38, eRating: { s: 8, a: 12 },
      eSkills: ['defBuff'],
    },
    {
      name: '冰潭·寒獭',
      enemy: { name: '寒獭', attr: 'water', hp: 300, atk: 9, def: 2, skills: ['atkBuff'], avatar: 'stage_enemies/frost_otter' },
      pet: 'm2', weapon: 'w6', exp: 130, repExp: 90, bs: 35, rating: { s: 7, a: 10 },
      ePet: 'm7', eWpn: null, eExp: 150, eRepExp: 100, eBs: 42, eRating: { s: 9, a: 12 },
      eSkills: ['defBuff'],
    },
    {
      name: '灼光·焰灵',
      enemy: { name: '焰灵', attr: 'fire', hp: 350, atk: 11, def: 3, skills: ['convert', 'atkBuff'], avatar: 'stage_enemies/fire_wisp' },
      pet: 'w2', weapon: 'w8', exp: 140, repExp: 95, bs: 40, rating: { s: 7, a: 11 },
      ePet: 'w4', eWpn: null, eExp: 170, eRepExp: 115, eBs: 45, eRating: { s: 9, a: 13 },
      eSkills: ['healPct'],
    },
    {
      name: '灵山守关·风隼将',
      enemy: { name: '风隼将', attr: 'metal', hp: 400, atk: 12, def: 3, skills: ['atkBuff', 'defBuff'], avatar: 'stage_enemies/wind_falcon', isBoss: true },
      pet: 's2', weapon: null, exp: 160, repExp: 110, bs: 50, rating: { s: 8, a: 12 },
      ePet: 'm8', eWpn: 'w9', eExp: 200, eRepExp: 140, eBs: 50, eRating: { s: 10, a: 14 },
      eSkills: ['healPct'],
    },
  ],

  // ── 第二章：幽冥秘境（Ch2: 13R + 3SR） ──
  2: [
    {
      name: '幽影·月光水母',
      enemy: { name: '月光水母', attr: 'water', hp: 450, atk: 14, def: 3, skills: ['atkBuff', 'convert'], avatar: 'stage_enemies/moon_jellyfish' },
      pet: 'm12', weapon: 'w13', exp: 150, repExp: 100, bs: 40, rating: { s: 6, a: 10 },
      ePet: 'w11', eWpn: 'w16', eExp: 200, eRepExp: 135, eBs: 50, eRating: { s: 8, a: 12 },
      eSkills: ['defBuff'],
    },
    {
      name: '妖火·炎蝶',
      enemy: { name: '炎蝶', attr: 'fire', hp: 550, atk: 15, def: 4, skills: ['atkBuff', 'defBuff'], avatar: 'stage_enemies/flame_butterfly' },
      pet: 'w8', weapon: null, exp: 160, repExp: 110, bs: 45, rating: { s: 7, a: 10 },
      ePet: 's9', eWpn: null, eExp: 220, eRepExp: 150, eBs: 55, eRating: { s: 9, a: 12 },
      eSkills: ['healPct'],
    },
    {
      name: '磐岩·石龟',
      enemy: { name: '石龟', attr: 'earth', hp: 660, atk: 17, def: 5, skills: ['defBuff', 'healPct'], avatar: 'stage_enemies/stone_turtle' },
      pet: 's5', weapon: 'w14', exp: 180, repExp: 120, bs: 48, rating: { s: 7, a: 11 },
      ePet: 'w13', eWpn: 'w17', eExp: 240, eRepExp: 160, eBs: 58, eRating: { s: 9, a: 13 },
      eSkills: ['bossWeaken'],
    },
    {
      name: '铁壁·铁甲犰狳',
      enemy: { name: '铁甲犰狳', attr: 'metal', hp: 770, atk: 19, def: 5, skills: ['atkBuff', 'defBuff'], avatar: 'stage_enemies/iron_armadillo' },
      pet: 'f9', weapon: null, exp: 200, repExp: 135, bs: 52, rating: { s: 7, a: 11 },
      ePet: 'e7', eWpn: null, eExp: 260, eRepExp: 175, eBs: 62, eRating: { s: 9, a: 13 },
      eSkills: ['bossBlitz'],
    },
    {
      name: '竹影·竹灵熊',
      enemy: { name: '竹灵熊', attr: 'wood', hp: 880, atk: 21, def: 6, skills: ['atkBuff', 'healPct'], avatar: 'stage_enemies/bamboo_panda' },
      pet: 'e3', weapon: 'w15', exp: 220, repExp: 150, bs: 55, rating: { s: 8, a: 12 },
      ePet: 's13', eWpn: 'w19', eExp: 280, eRepExp: 190, eBs: 65, eRating: { s: 10, a: 14 },
      eSkills: ['bossQuake'],
    },
    {
      name: '狐火·炎狐',
      enemy: { name: '炎狐', attr: 'fire', hp: 1000, atk: 22, def: 7, skills: ['atkBuff', 'defBuff'], avatar: 'stage_enemies/flame_fox' },
      pet: 'w9', weapon: null, exp: 240, repExp: 160, bs: 60, rating: { s: 8, a: 12 },
      ePet: 'm4', eWpn: null, eExp: 300, eRepExp: 200, eBs: 70, eRating: { s: 10, a: 14 },
      eSkills: ['bossRage'],
    },
    {
      name: '暗夜·暮蝠',
      enemy: { name: '暮蝠', attr: 'earth', hp: 1100, atk: 24, def: 7, skills: ['defBuff', 'healPct', 'convert'], avatar: 'stage_enemies/dusk_bat' },
      pet: 's7', weapon: null, exp: 260, repExp: 175, bs: 65, rating: { s: 8, a: 13 },
      ePet: 'm5', eWpn: 'w20', eExp: 330, eRepExp: 220, eBs: 75, eRating: { s: 10, a: 15 },
      eSkills: ['bossDrain'],
    },
    {
      name: '幽冥守关·灵木麒麟',
      enemy: { name: '灵木麒麟', attr: 'wood', hp: 1200, atk: 26, def: 8, skills: ['atkBuff', 'defBuff', 'healPct'], avatar: 'stage_enemies/wood_qilin_awakened', isBoss: true },
      pet: 'e6', weapon: 'w18', exp: 300, repExp: 200, bs: 80, rating: { s: 9, a: 14 },
      ePet: 'w5', eWpn: null, eExp: 400, eRepExp: 270, eBs: 80, eRating: { s: 11, a: 16 },
      eSkills: ['bossAnnihil'],
    },
  ],

  // ── 第三章：天劫雷域（Ch3: 16SR） ──
  3: [
    {
      name: '雷域·雷鹰',
      enemy: { name: '雷鹰', attr: 'metal', hp: 1400, atk: 28, def: 9, skills: ['atkBuff', 'defBuff'], avatar: 'stage_enemies/bolt_eagle' },
      pet: 'm6', weapon: 'w10', exp: 280, repExp: 190, bs: 60, rating: { s: 7, a: 11 },
      ePet: 'f4', eWpn: null, eExp: 350, eRepExp: 240, eBs: 70, eRating: { s: 9, a: 13 },
      eSkills: ['bossBlitz'],
    },
    {
      name: '赤焰·朱雀雏',
      enemy: { name: '朱雀雏', attr: 'fire', hp: 1750, atk: 31, def: 10, skills: ['atkBuff', 'convert', 'healPct'], avatar: 'stage_enemies/vermilion_chick' },
      pet: 'w6', weapon: null, exp: 300, repExp: 200, bs: 65, rating: { s: 7, a: 11 },
      ePet: 'e5', eWpn: 'w22', eExp: 380, eRepExp: 260, eBs: 75, eRating: { s: 9, a: 13 },
      eSkills: ['bossRage'],
    },
    {
      name: '翠林·云豹',
      enemy: { name: '云豹', attr: 'wood', hp: 2100, atk: 34, def: 11, skills: ['atkBuff', 'defBuff', 'convert'], avatar: 'stage_enemies/cloud_leopard' },
      pet: 's4', weapon: 'w21', exp: 320, repExp: 215, bs: 70, rating: { s: 8, a: 12 },
      ePet: 'm11', eWpn: null, eExp: 400, eRepExp: 270, eBs: 80, eRating: { s: 10, a: 14 },
      eSkills: ['bossWeaken'],
    },
    {
      name: '深渊·泡沫鱼',
      enemy: { name: '泡沫鱼', attr: 'water', hp: 2400, atk: 36, def: 13, skills: ['defBuff', 'healPct', 'convert'], avatar: 'stage_enemies/bubble_fish' },
      pet: 'f3', weapon: null, exp: 350, repExp: 235, bs: 75, rating: { s: 8, a: 12 },
      ePet: 'w12', eWpn: 'w25', eExp: 430, eRepExp: 290, eBs: 90, eRating: { s: 10, a: 14 },
      eSkills: ['bossDrain'],
    },
    {
      name: '厚土·重地甲兽',
      enemy: { name: '重地甲兽', attr: 'earth', hp: 2700, atk: 38, def: 14, skills: ['atkBuff', 'defBuff', 'healPct'], avatar: 'stage_enemies/golden_pangolin' },
      pet: 'e4', weapon: 'w23', exp: 380, repExp: 255, bs: 80, rating: { s: 8, a: 13 },
      ePet: 's8', eWpn: null, eExp: 460, eRepExp: 310, eBs: 95, eRating: { s: 10, a: 15 },
      eSkills: ['bossQuake'],
    },
    {
      name: '锋刃·玉猫',
      enemy: { name: '玉猫', attr: 'metal', hp: 3100, atk: 41, def: 15, skills: ['atkBuff', 'defBuff', 'bossWeaken'], avatar: 'stage_enemies/jade_cat' },
      pet: 'm9', weapon: null, exp: 400, repExp: 270, bs: 90, rating: { s: 9, a: 13 },
      ePet: 'f5', eWpn: 'w26', eExp: 500, eRepExp: 340, eBs: 100, eRating: { s: 11, a: 15 },
      eSkills: ['bossRage'],
    },
    {
      name: '炼火·炼火妖',
      enemy: { name: '炼火妖', attr: 'fire', hp: 3500, atk: 45, def: 17, skills: ['atkBuff', 'bossRage', 'convert'], avatar: 'enemies/mon_f_4' },
      pet: 'w7', weapon: 'w24', exp: 430, repExp: 290, bs: 100, rating: { s: 9, a: 14 },
      ePet: 'e8', eWpn: null, eExp: 550, eRepExp: 370, eBs: 110, eRating: { s: 11, a: 16 },
      eSkills: ['bossAnnihil'],
    },
    {
      name: '天劫守关·玄岩貔貅',
      enemy: { name: '玄岩貔貅', attr: 'earth', hp: 3800, atk: 48, def: 18, skills: ['atkBuff', 'defBuff', 'healPct', 'bossQuake'], avatar: 'stage_enemies/rock_pixiu_awakened', isBoss: true },
      pet: 's6', weapon: 'w29', exp: 500, repExp: 340, bs: 120, rating: { s: 10, a: 15 },
      ePet: 'f6', eWpn: 'w12', eExp: 650, eRepExp: 440, eBs: 120, eRating: { s: 12, a: 17 },
      eSkills: ['bossAnnihil', 'breakBead'],
    },
  ],

  // ── 第四章：仙灵古域（Ch4: 14SR + 2SSR） ──
  4: [
    {
      name: '仙域·碧海玄武',
      enemy: { name: '碧海玄武', attr: 'water', hp: 4000, atk: 50, def: 20, skills: ['defBuff', 'healPct', 'bossDrain'], avatar: 'stage_enemies/ocean_xuanwu_awakened', isBoss: true },
      pet: 'm13', weapon: 'w28', exp: 400, repExp: 270, bs: 80, rating: { s: 8, a: 12 },
      ePet: 'f8', eWpn: 'w31', eExp: 500, eRepExp: 340, eBs: 90, eRating: { s: 10, a: 14 },
      eSkills: ['bossWeaken', 'timeSqueeze'],
    },
    {
      name: '仙域·炽焰古龙',
      enemy: { name: '炽焰古龙', attr: 'fire', hp: 4500, atk: 52, def: 21, skills: ['atkBuff', 'defBuff', 'bossRage'], avatar: 'stage_enemies/inferno_dragon_awakened', isBoss: true },
      pet: 'w14', weapon: null, exp: 430, repExp: 290, bs: 85, rating: { s: 8, a: 12 },
      ePet: 'e11', eWpn: 'w34', eExp: 550, eRepExp: 370, eBs: 100, eRating: { s: 10, a: 14 },
      eSkills: ['bossInferno'],
    },
    {
      name: '仙域·雷虎',
      enemy: { name: '雷虎', attr: 'metal', hp: 5000, atk: 54, def: 22, skills: ['atkBuff', 'defBuff', 'bossBlitz'], avatar: 'stage_enemies/storm_tiger_awakened', isBoss: true },
      pet: 's11', weapon: 'w30', exp: 460, repExp: 310, bs: 90, rating: { s: 8, a: 13 },
      ePet: 'm15', eWpn: 'w33', eExp: 600, eRepExp: 400, eBs: 110, eRating: { s: 10, a: 15 },
      eSkills: ['bossWeaken', 'stun'],
    },
    {
      name: '仙域·磐牛',
      enemy: { name: '磐牛', attr: 'earth', hp: 5600, atk: 56, def: 23, skills: ['defBuff', 'healPct', 'bossQuake'], avatar: 'stage_enemies/boulder_ox_awakened', isBoss: true },
      pet: 'f7', weapon: null, exp: 500, repExp: 340, bs: 100, rating: { s: 9, a: 13 },
      ePet: 'w16', eWpn: 'w36', eExp: 650, eRepExp: 440, eBs: 120, eRating: { s: 11, a: 15 },
      eSkills: ['bossWeaken', 'breakBead'],
    },
    {
      name: '仙域·百花蟒仙',
      enemy: { name: '百花蟒仙', attr: 'wood', hp: 6200, atk: 58, def: 24, skills: ['atkBuff', 'healPct', 'bossDevour'], avatar: 'stage_enemies/flora_serpent_awakened', isBoss: true },
      pet: 'e9', weapon: 'w32', exp: 530, repExp: 360, bs: 110, rating: { s: 9, a: 14 },
      ePet: 's14', eWpn: 'w27', eExp: 700, eRepExp: 470, eBs: 130, eRating: { s: 11, a: 16 },
      eSkills: ['bossAnnihil'],
    },
    {
      name: '仙域·焰天狮王',
      enemy: { name: '焰天狮王', attr: 'fire', hp: 6800, atk: 60, def: 26, skills: ['atkBuff', 'defBuff', 'bossRage', 'bossInferno'], avatar: 'stage_enemies/inferno_lion_king_awakened', isBoss: true },
      pet: 'm14', weapon: null, exp: 560, repExp: 380, bs: 120, rating: { s: 9, a: 14 },
      ePet: 'f11', eWpn: 'w37', eExp: 750, eRepExp: 510, eBs: 135, eRating: { s: 11, a: 16 },
      eSkills: ['bossAnnihil'],
    },
    {
      name: '仙域·天罡白虎',
      enemy: { name: '天罡白虎', attr: 'metal', hp: 7400, atk: 63, def: 27, skills: ['atkBuff', 'defBuff', 'bossWeaken', 'bossBlitz'], avatar: 'stage_enemies/celestial_white_tiger_awakened', isBoss: true },
      pet: 'w15', weapon: 'w11', exp: 600, repExp: 400, bs: 130, rating: { s: 10, a: 15 },
      ePet: 'm10', eWpn: 'w38', eExp: 800, eRepExp: 540, eBs: 140, eRating: { s: 12, a: 17 },
      eSkills: ['stun', 'bossAnnihil'],
    },
    {
      name: '仙灵守关·万象龙神',
      enemy: { name: '万象龙神', attr: 'earth', hp: 8000, atk: 66, def: 28, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse'], avatar: 'stage_enemies/cosmos_dragon_awakened', isBoss: true },
      pet: 's12', weapon: 'w35', exp: 700, repExp: 470, bs: 150, rating: { s: 10, a: 16 },
      ePet: 's10', eWpn: 'w39', eExp: 950, eRepExp: 640, eBs: 150, eRating: { s: 12, a: 18 },
      eSkills: ['bossAnnihil', 'bossMirror'],
    },
  ],

  // ── 第五章：万妖禁地（Ch5: 14SR + 2SSR） ──
  5: [
    {
      name: '禁地·烈焰妖将',
      enemy: { name: '烈焰妖将', attr: 'fire', hp: 7500, atk: 60, def: 26, skills: ['atkBuff', 'defBuff', 'bossRage', 'bossBlitz'], avatar: 'enemies/mon_f_6' },
      pet: 'w17', weapon: null, exp: 550, repExp: 370, bs: 100, rating: { s: 9, a: 13 },
      ePet: 's18', eWpn: 'w41', eExp: 700, eRepExp: 470, eBs: 120, eRating: { s: 11, a: 15 },
      eSkills: ['bossAnnihil'],
    },
    {
      name: '禁地·山岳巨灵',
      enemy: { name: '山岳巨灵', attr: 'earth', hp: 8400, atk: 63, def: 27, skills: ['defBuff', 'healPct', 'bossQuake', 'bossWeaken'], avatar: 'enemies/mon_e_5' },
      pet: 's15', weapon: 'w40', exp: 600, repExp: 400, bs: 110, rating: { s: 9, a: 13 },
      ePet: 'e14', eWpn: null, eExp: 750, eRepExp: 510, eBs: 130, eRating: { s: 11, a: 15 },
      eSkills: ['breakBead'],
    },
    {
      name: '禁地·深渊蛟魔',
      enemy: { name: '深渊蛟魔', attr: 'water', hp: 9300, atk: 66, def: 28, skills: ['atkBuff', 'bossDrain', 'bossWeaken'], avatar: 'enemies/mon_s_6' },
      pet: 'f12', weapon: null, exp: 650, repExp: 440, bs: 120, rating: { s: 9, a: 14 },
      ePet: 'f15', eWpn: 'w42', eExp: 800, eRepExp: 540, eBs: 140, eRating: { s: 11, a: 16 },
      eSkills: ['timeSqueeze'],
    },
    {
      name: '禁地·金甲妖王',
      enemy: { name: '金甲妖王', attr: 'metal', hp: 10200, atk: 70, def: 30, skills: ['atkBuff', 'defBuff', 'bossBlitz', 'stun'], avatar: 'enemies/mon_m_6' },
      pet: 'e12', weapon: null, exp: 700, repExp: 470, bs: 140, rating: { s: 10, a: 14 },
      ePet: 'e15', eWpn: 'w44', eExp: 880, eRepExp: 590, eBs: 160, eRating: { s: 12, a: 16 },
      eSkills: ['bossAnnihil'],
    },
    {
      name: '禁地·花灵兔仙',
      enemy: { name: '花灵兔仙', attr: 'wood', hp: 11000, atk: 74, def: 31, skills: ['atkBuff', 'healPct', 'bossDevour', 'bossWeaken'], avatar: 'stage_enemies/blossom_bunny' },
      pet: 's16', weapon: 'w43', exp: 750, repExp: 510, bs: 150, rating: { s: 10, a: 15 },
      ePet: 'f18', eWpn: 'w45', eExp: 950, eRepExp: 640, eBs: 170, eRating: { s: 12, a: 17 },
      eSkills: ['bossRage'],
    },
    {
      name: '禁地·焚天魔凰',
      enemy: { name: '焚天魔凰', attr: 'fire', hp: 12000, atk: 78, def: 33, skills: ['atkBuff', 'defBuff', 'bossInferno', 'bossAnnihil'], avatar: 'enemies/mon_f_7' },
      pet: 'f13', weapon: null, exp: 800, repExp: 540, bs: 170, rating: { s: 10, a: 16 },
      ePet: 'e16', eWpn: null, eExp: 1000, eRepExp: 680, eBs: 180, eRating: { s: 12, a: 18 },
      eSkills: ['bossRage'],
    },
    {
      name: '禁地·九天妖皇',
      enemy: { name: '九天妖皇', attr: 'water', hp: 13000, atk: 82, def: 35, skills: ['atkBuff', 'defBuff', 'healPct', 'bossDrain', 'bossUltimate'], avatar: 'enemies/mon_s_7' },
      pet: 'e13', weapon: 'w46', exp: 880, repExp: 590, bs: 190, rating: { s: 11, a: 16 },
      ePet: 'f10', eWpn: 'w47', eExp: 1100, eRepExp: 740, eBs: 200, eRating: { s: 13, a: 19 },
      eSkills: ['sealColumn'],
    },
    {
      name: '终焉·万妖之主',
      enemy: { name: '万妖之主', attr: 'earth', hp: 14000, atk: 85, def: 36, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse', 'bossAnnihil'], avatar: 'enemies/boss_10', isBoss: true },
      pet: 'f14', weapon: null, exp: 1000, repExp: 680, bs: 220, rating: { s: 12, a: 18 },
      ePet: 'e10', eWpn: 'w50', eExp: 1300, eRepExp: 880, eBs: 220, eRating: { s: 14, a: 20 },
      eSkills: ['bossDevour', 'bossMirror'],
    },
  ],
}

// ===== 从 STAGE_SPECS 构建 STAGES 数组 =====
function buildAllStages() {
  const stages = []
  for (const ch of [1, 2, 3, 4, 5]) {
    const specs = STAGE_SPECS[ch]
    const mult = ELITE_MULTIPLIERS[ch]
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]
      const ord = i + 1

      // 普通关的前置关卡
      let prevStage = null
      if (ch === 1 && ord === 1) prevStage = null
      else if (ord === 1) prevStage = `stage_${ch - 1}_8`
      else prevStage = `stage_${ch}_${ord - 1}`

      // — 普通关 —
      const normalEnemy = { ...s.enemy }
      stages.push({
        id: `stage_${ch}_${ord}`,
        name: s.name,
        chapter: ch,
        order: ord,
        difficulty: 'normal',
        waves: [{ enemies: [normalEnemy] }],
        teamSize: s.teamSize || { min: 3, max: 5 },
        rating: s.rating,
        staminaCost: s.staminaCost !== undefined ? s.staminaCost : CHAPTER_STAMINA[ch].normal,
        rewards: mkRewards(ch, ord, 'normal', s.pet, s.weapon, s.exp, s.repExp),
        dailyLimit: 0,
        unlockCondition: { prevStage },
        battleSoulStone: s.bs,
      })

      // — 精英关 —
      const eliteEnemy = {
        name: '狂暴·' + s.enemy.name,
        attr: s.enemy.attr,
        hp: Math.round(s.enemy.hp * mult.hp),
        atk: Math.round(s.enemy.atk * mult.atk),
        def: Math.round(s.enemy.def * mult.def),
        skills: [...s.enemy.skills, ...(s.eSkills || [])],
        avatar: s.enemy.avatar,
      }
      if (s.enemy.isBoss) eliteEnemy.isBoss = true

      stages.push({
        id: `stage_${ch}_${ord}_elite`,
        name: '精英·' + s.name,
        chapter: ch,
        order: ord,
        difficulty: 'elite',
        waves: [{ enemies: [eliteEnemy] }],
        teamSize: { min: 3, max: 5 },
        rating: s.eRating,
        staminaCost: CHAPTER_STAMINA[ch].elite,
        rewards: mkRewards(ch, ord, 'elite', s.ePet, s.eWpn, s.eExp, s.eRepExp),
        dailyLimit: 0,
        unlockCondition: { normalStageS: `stage_${ch}_${ord}` },
        battleSoulStone: s.eBs,
      })
    }
  }
  return stages
}

const STAGES = buildAllStages()

// ===== 评价优先级 =====
const RATING_ORDER = { B: 1, A: 2, S: 3 }

// ===== 查询接口 =====

function getStageById(id) {
  return STAGES.find(s => s.id === id)
}

function getChapterStages(chapterId, difficulty) {
  return STAGES
    .filter(s => s.chapter === chapterId && (!difficulty || s.difficulty === difficulty))
    .sort((a, b) => a.order - b.order)
}

function isEliteStage(stageId) {
  return stageId.endsWith('_elite')
}

function getNormalStageId(eliteStageId) {
  return eliteStageId.replace(/_elite$/, '')
}

function getEliteStageId(normalStageId) {
  return normalStageId + '_elite'
}

function isChapterUnlocked(chapterId, poolCount, clearRecord) {
  const stages = getChapterStages(chapterId, 'normal')
  return stages.some(s => isStageUnlocked(s.id, clearRecord, poolCount))
}

/**
 * 判断关卡是否解锁
 * 普通关: 线性解锁（前置关卡通关）
 * 精英关: 顺序解锁 — 前置精英已通关 + 对应普通关 3 星(S)
 */
function isStageUnlocked(stageId, clearRecord, poolCount) {
  const stage = getStageById(stageId)
  if (!stage) return false

  if (isEliteStage(stageId)) {
    const normalId = getNormalStageId(stageId)
    const normalRec = clearRecord && clearRecord[normalId]
    if (!(normalRec && normalRec.bestRating === 'S')) return false
    const prevEliteId = _getPrevEliteId(stageId)
    if (!prevEliteId) return true
    const prevRec = clearRecord && clearRecord[prevEliteId]
    return !!(prevRec && prevRec.cleared)
  }

  if (!stage.unlockCondition || !stage.unlockCondition.prevStage) return true
  const prev = clearRecord && clearRecord[stage.unlockCondition.prevStage]
  return !!(prev && prev.cleared)
}

/**
 * 获取精英关锁定原因（用于 UI 提示）
 * @returns {string|null} null 表示已解锁
 */
function getEliteLockReason(stageId, clearRecord) {
  if (!isEliteStage(stageId)) return null
  const stage = getStageById(stageId)
  if (!stage) return null

  const prevEliteId = _getPrevEliteId(stageId)
  if (prevEliteId) {
    const prevRec = clearRecord && clearRecord[prevEliteId]
    if (!(prevRec && prevRec.cleared)) {
      const prev = getStageById(prevEliteId)
      return `需先通关精英 ${prev ? prev.chapter + '-' + prev.order : '前一关'}`
    }
  }

  const normalId = getNormalStageId(stageId)
  const normalRec = clearRecord && clearRecord[normalId]
  if (!(normalRec && normalRec.bestRating === 'S')) {
    const ns = getStageById(normalId)
    return `需普通 ${ns ? ns.chapter + '-' + ns.order : normalId} 达到3星`
  }

  return null
}

function _getPrevEliteId(eliteStageId) {
  const stage = getStageById(eliteStageId)
  if (!stage) return null
  const elites = STAGES
    .filter(s => s.difficulty === 'elite')
    .sort((a, b) => a.chapter !== b.chapter ? a.chapter - b.chapter : a.order - b.order)
  const idx = elites.findIndex(s => s.id === eliteStageId)
  return idx > 0 ? elites[idx - 1].id : null
}

function getStageAttr(stageId) {
  const stage = getStageById(stageId)
  if (!stage || !stage.waves.length) return null
  return (stage.waves[0].enemies[0] && stage.waves[0].enemies[0].attr) || null
}

/**
 * 获取下一关 ID（同章同难度 order+1，或下一章同难度第一关）
 */
function getNextStageId(stageId) {
  const cur = getStageById(stageId)
  if (!cur) return null
  const diff = cur.difficulty
  const sameCh = STAGES
    .filter(s => s.chapter === cur.chapter && s.difficulty === diff)
    .sort((a, b) => a.order - b.order)
  const idx = sameCh.findIndex(s => s.id === stageId)
  if (idx >= 0 && idx + 1 < sameCh.length) return sameCh[idx + 1].id
  const nextCh = CHAPTERS.find(ch => ch.id === cur.chapter + 1)
  if (!nextCh) return null
  const nextChStages = STAGES
    .filter(s => s.chapter === nextCh.id && s.difficulty === diff)
    .sort((a, b) => a.order - b.order)
  return nextChStages.length > 0 ? nextChStages[0].id : null
}

/**
 * 获取可浏览关卡列表（顺序展示，普通和精英统一逻辑）
 * 包含所有已解锁关卡 + 第一个未解锁关卡（用于显示锁定提示）
 * @param {object} clearRecord
 * @param {string} [difficulty='normal'] - 'normal' 或 'elite'
 */
function getBrowsableStages(clearRecord, difficulty) {
  const diff = difficulty || 'normal'
  const filtered = STAGES
    .filter(s => s.difficulty === diff)
    .sort((a, b) => a.chapter !== b.chapter ? a.chapter - b.chapter : a.order - b.order)

  const result = []
  for (const stage of filtered) {
    const unlocked = isStageUnlocked(stage.id, clearRecord, 0)
    result.push({ stage, unlocked })
    if (!unlocked) break
  }
  return result
}

/** 塔/通用怪关卡头像（与 stage_avatars 分包区分，避免预编译把 enemies/ 误代入 _avatar 路径） */
function getTowerEnemyPortraitPath(avatar) {
  if (!avatar || typeof avatar !== 'string') return null
  const id = avatar.replace(/^enemies\//, '').replace(/\.png$/i, '')
  if (!id || id.includes('/')) return null
  return 'assets/enemies/' + id + '.png'
}

/** 秘境定制怪头像（stage_enemies 表） */
function getStageEnemyPortraitPath(avatar) {
  if (!avatar || typeof avatar !== 'string') return null
  const slug = avatar.replace(/^stage_enemies\//, '')
  if (!slug || slug === avatar || slug.includes('/')) return null
  return 'assets/stage_avatars/' + slug + '_avatar.png'
}

/**
 * 关卡信息/选关等 UI 用：先分流再拼路径，减少微信开发者工具静态扫描误报 stage_avatars/enemies/...
 */
function getEnemyPortraitPath(avatar) {
  if (!avatar || typeof avatar !== 'string') return null
  if (avatar.startsWith('enemies/')) return getTowerEnemyPortraitPath(avatar)
  if (avatar.startsWith('stage_enemies/')) return getStageEnemyPortraitPath(avatar)
  return null
}

function getStageBossAvatar(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return null
  const lastWave = stage.waves[stage.waves.length - 1]
  const lastEnemy = lastWave.enemies[lastWave.enemies.length - 1]
  return lastEnemy ? `assets/${lastEnemy.avatar}.png` : null
}

function getStageBossName(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return ''
  const lastWave = stage.waves[stage.waves.length - 1]
  const lastEnemy = lastWave.enemies[lastWave.enemies.length - 1]
  return lastEnemy ? lastEnemy.name : ''
}

function getStageRewardDifficulty(stageId) {
  return isEliteStage(stageId) ? 'elite' : 'normal'
}

module.exports = {
  CHAPTERS,
  STAGES,
  CHAPTER_STAMINA,
  RATING_ORDER,
  getStageById,
  getChapterStages,
  isChapterUnlocked,
  isStageUnlocked,
  isEliteStage,
  getNormalStageId,
  getEliteStageId,
  getEliteLockReason,
  getStageAttr,
  getNextStageId,
  getBrowsableStages,
  getStageBossAvatar,
  getEnemyPortraitPath,
  getStageBossName,
  getStageRewardDifficulty,
}
