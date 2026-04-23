/**
 * 修炼系统数值 — 经验曲线、击杀经验、属性树、境界阈值
 * 调优时只改此文件
 */

// ===== 等级与经验曲线 =====
//   60 → 80：从化神·三重扩到化神·圆满（22 重的最后一重），新增 20 修炼点
//   配套见 _migrateCultV2（清掉满级溢出 exp）+ 境界祝福乘数（CULT_REALMS[*].blessing）
const CULT_MAX_LEVEL = 80
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
//   · type=percent：perLv 单位是"百分比"，最终值会再乘当前境界的 blessing 乘数（见 CULT_REALMS）
//   · type=flat   ：perLv 直接累加；spirit/wisdom 是离散值（心珠回复 / 秒），不参与境界乘数
//
//   v2 调整（Lv.60→Lv.80 扩容 + 百分比化）：
//     body  20→28（+8）  perLv 5→5      老 +5 HP 固定 → 新 +5% HP 上限（HERO_BASE_HP=100 时数字 1:1 对齐）
//     spirit 15→19（+4） perLv 1 不变    心珠回复仍为绝对值
//     wisdom 5 不变      perLv 0.15 不变 转珠时间，避免后期溢出
//     defense 10→14（+4）perLv 2→1      老 -2 固定 → 新 +1% 减伤（% 对高伤 hit 更值）
//     sense  8→12（+4）  perLv 8→2.5    老 +8 固定护盾 → 新 +2.5% HP 作护盾（2.5% 是为了"不叠一倍血"的克制调参）
//   累计 78 = Lv.1 起步 + 79 次升级共 80 点 → 还差 2 点（Lv.60 历史遗留的两个闲置点正好补上）
//
//   perLv 校准说明（为什么不是 0.6/1/1 那一版）：
//     HERO_BASE_HP 实际只有 100。若 body perLv=0.6%，老玩家 Lv.60 满（body 20 pts）
//     只能拿到 20 × 0.6 × 1.5 = 18% HP = +18 HP，被原版"+100 HP 固定"削穿 41%。
//     本版以"老 Lv.60 满保不缩水 + 新 Lv.80 再 +20~25%"为准，才有下面这组数。
const CULT_CONFIG = {
  body:    { name:'体魄', theme:'淬体', maxLv:28, perLv:5,    type:'percent', unit:'%HP',     desc:'队伍HP上限（全模式生效）' },
  spirit:  { name:'灵力', theme:'通脉', maxLv:19, perLv:1,    type:'flat',    unit:'心珠回复', desc:'心珠回复基数（全模式生效）' },
  wisdom:  { name:'悟性', theme:'感悟', maxLv:5,  perLv:0.15, type:'flat',    unit:'s转珠时间', desc:'转珠操作时间（全模式生效）' },
  defense: { name:'根骨', theme:'筑基', maxLv:14, perLv:1,    type:'percent', unit:'%减伤',   desc:'伤害减免百分比（全模式生效）' },
  sense:   { name:'神识', theme:'开窍', maxLv:12, perLv:2.5,  type:'percent', unit:'%护盾',   desc:'按队伍HP获得开局护盾（全模式生效）' },
}
const CULT_KEYS = ['body', 'spirit', 'wisdom', 'defense', 'sense']

// ===== 修炼境界 =====
//   · id        稳定标识（持久化用，绝不能改；兼容：旧记录 qi/foundation/... 直接映射到这里）
//   · name      大境界显示名（旧数据里带"期"字的已去掉，统一用"感气·三重"格式）
//   · minLv     进入该大境界的最低修炼等级
//   · maxLv     停留在该大境界的最高修炼等级（下一大境界 minLv - 1）
//   · stages    重阶数 = maxLv - minLv + 1（每 1 Lv 一重）；凡人无重阶
//   · motto     LING 在晋升仪式上的一句话（Phase A1 R4 会用到）
//
// 前 7 档沿用旧阈值（感气 Lv.1 / 炼气 Lv.5 / 筑基 Lv.15 / 金丹 Lv.30 / 元婴 Lv.45 / 化神 Lv.58），
// 避免老玩家"境界倒退"；后 10 档是容量扩展，支持 MAX_LEVEL 提升到 260+。
//
// blessing 字段（境界祝福乘数）：
//   · 仅作用于 type=percent 的修炼属性（body/defense/sense），是这些属性的全局倍率。
//   · 设计意图：玩家跨入大境界时即便不分修炼点，"有效加成"也会自动放大一波，
//     还原仙侠题材"境界跃迁就是变强"的爽点。具体计算见 cultivationConfig.effectValueWithBlessing。
//   · 化神之上（炼虚 80+）目前不开放（MAX_LEVEL=80 卡在化神圆满），blessing 暂沿用 1.50。
const CULT_REALMS = [
  { id: 'mortal',     name: '凡人', minLv: 0,   maxLv: 0,   stages: 1,   blessing: 1.00, color: '#9DA3AD', accent: '#3A3F48', motto: '主人呀，每一位大修也是从凡尘起步的～' },
  { id: 'qi_sense',   name: '感气', minLv: 1,   maxLv: 4,   stages: 4,   blessing: 1.00, color: '#86C5A3', accent: '#1E6B3C', motto: '天地灵气已能感应到主人啦！'           },
  { id: 'qi_refine',  name: '炼气', minLv: 5,   maxLv: 14,  stages: 10,  blessing: 1.05, color: '#5FA880', accent: '#14522A', motto: '炼气初成，灵力开始循环～'             },
  { id: 'foundation', name: '筑基', minLv: 15,  maxLv: 29,  stages: 15,  blessing: 1.10, color: '#6FB0D8', accent: '#14547F', motto: '筑基稳固，修途正式开启！'             },
  { id: 'core',       name: '金丹', minLv: 30,  maxLv: 44,  stages: 15,  blessing: 1.20, color: '#E5B55B', accent: '#7C4A0E', motto: '金丹凝成！主人的灵力已成气候。'        },
  { id: 'nascent',    name: '元婴', minLv: 45,  maxLv: 57,  stages: 13,  blessing: 1.35, color: '#C88AE2', accent: '#5A2685', motto: '元婴出窍，世间已少有匹敌～'           },
  { id: 'spirit',     name: '化神', minLv: 58,  maxLv: 79,  stages: 22,  blessing: 1.50, color: '#F08E58', accent: '#7A2A0C', motto: '化神一境，举手牵动风雷！'             },
  { id: 'void',       name: '炼虚', minLv: 80,  maxLv: 99,  stages: 20,  blessing: 1.50, color: '#EC6B9C', accent: '#7A1D45', motto: '虚空可炼，主人已窥天道一角。'         },
  { id: 'unity',      name: '合体', minLv: 100, maxLv: 119, stages: 20,  blessing: 1.50, color: '#D96F6F', accent: '#6A1616', motto: '神形合一，举手投足皆合天道～'         },
  { id: 'mahayana',   name: '大乘', minLv: 120, maxLv: 139, stages: 20,  blessing: 1.50, color: '#B25BD4', accent: '#4A1C70', motto: '大乘之境，主人已近仙途！'             },
  { id: 'trib',       name: '渡劫', minLv: 140, maxLv: 159, stages: 20,  blessing: 1.50, color: '#FFD66E', accent: '#8C5800', motto: '渡劫之境！主人的名将传于三界～'       },
  { id: 'ascend',     name: '飞升', minLv: 160, maxLv: 179, stages: 20,  blessing: 1.50, color: '#FFEFB0', accent: '#B28B2E', motto: '飞升在即，主人即将离凡入仙！'         },
  { id: 'true_imm',   name: '真仙', minLv: 180, maxLv: 199, stages: 20,  blessing: 1.50, color: '#C9E8FF', accent: '#2E6FA8', motto: '真仙之躯，已脱生死轮回～'             },
  { id: 'golden_imm', name: '金仙', minLv: 200, maxLv: 219, stages: 20,  blessing: 1.50, color: '#FFE98A', accent: '#A06A00', motto: '金仙不灭，主人已超凡入圣！'           },
  { id: 'supreme',    name: '太乙', minLv: 220, maxLv: 239, stages: 20,  blessing: 1.50, color: '#F5F5FF', accent: '#5A5A8C', motto: '太乙玄妙，万法归一～'                 },
  { id: 'great_luo',  name: '大罗', minLv: 240, maxLv: 259, stages: 20,  blessing: 1.50, color: '#FFB8D8', accent: '#8A2454', motto: '大罗金仙，主人的名将镌于星河！'       },
  { id: 'ancestor',   name: '道祖', minLv: 260, maxLv: 999, stages: 999, blessing: 1.50, color: '#FFFFFF', accent: '#B0A060', motto: '道祖之位，世间只此一人～'             },
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
