/**
 * 修炼系统数值 — 经验曲线、击杀经验、属性树、境界阈值
 * 调优时只改此文件
 */

// ===== 等级与经验曲线 =====
const CULT_MAX_LEVEL = 60
const CULT_EXP_BASE = 400
const CULT_EXP_LINEAR = 100
const CULT_EXP_POW_EXP = 1.6
const CULT_EXP_POW_COEFF = 6

// 前 3 级经验折扣（让新手快速体验修炼加成）
const CULT_NEWBIE_EXP_DISCOUNT = [0.25, 0.3, 0.4]

// ===== 击杀经验 =====
const CULT_KILL_BOSS_BASE = 30
const CULT_KILL_BOSS_FLOOR_COEFF = 4
const CULT_KILL_ELITE_BASE = 15
const CULT_KILL_ELITE_FLOOR_COEFF = 3
const CULT_KILL_NORMAL_BASE = 5
const CULT_KILL_NORMAL_FLOOR_COEFF = 2

// ===== 修炼树配置（加点制）=====
const CULT_CONFIG = {
  body:    { name:'体魄', theme:'淬体', maxLv:20, perLv:5,    unit:'HP上限',   desc:'队伍HP上限（全模式生效）' },
  spirit:  { name:'灵力', theme:'通脉', maxLv:15, perLv:1,    unit:'心珠回复', desc:'心珠回复基数（全模式生效）' },
  wisdom:  { name:'悟性', theme:'感悟', maxLv:5,  perLv:0.15, unit:'s转珠时间', desc:'转珠操作时间（全模式生效）' },
  defense: { name:'根骨', theme:'筑基', maxLv:10, perLv:2,    unit:'减伤',     desc:'每次受伤减免固定值（全模式生效）' },
  sense:   { name:'神识', theme:'开窍', maxLv:8,  perLv:8,    unit:'护盾',     desc:'开局获得护盾（全模式生效）' },
}
const CULT_KEYS = ['body', 'spirit', 'wisdom', 'defense', 'sense']

// ===== 修炼境界 =====
const CULT_REALMS = [
  { minLv: 0,  name: '凡人' },
  { minLv: 1,  name: '感气期' },
  { minLv: 5,  name: '练气期' },
  { minLv: 15, name: '筑基期' },
  { minLv: 30, name: '金丹期' },
  { minLv: 45, name: '元婴期' },
  { minLv: 58, name: '化神期' },
]

module.exports = {
  CULT_MAX_LEVEL,
  CULT_EXP_BASE,
  CULT_EXP_LINEAR,
  CULT_EXP_POW_EXP,
  CULT_EXP_POW_COEFF,
  CULT_NEWBIE_EXP_DISCOUNT,
  CULT_KILL_BOSS_BASE,
  CULT_KILL_BOSS_FLOOR_COEFF,
  CULT_KILL_ELITE_BASE,
  CULT_KILL_ELITE_FLOOR_COEFF,
  CULT_KILL_NORMAL_BASE,
  CULT_KILL_NORMAL_FLOOR_COEFF,
  CULT_CONFIG,
  CULT_KEYS,
  CULT_REALMS,
}
