/**
 * 龙珠战纪 - 关卡数据（8关 + 难度分层）
 * 按属性梯度递进：1-2火、3-4水/木、5-6光/暗、7-8混合
 */

// 难度倍率配置
const DIFFICULTY = {
  normal: {
    name: '普通', hpRate: 1, atkRate: 1, rewardRate: 1,
    enemyAI: null, // 无特殊AI
    unlockCondition: null // 默认解锁
  },
  hard: {
    name: '困难', hpRate: 1.8, atkRate: 1.8, rewardRate: 2,
    enemyAI: {
      skillInterval: 2, // 每2回合释放1次小技能
      skills: [
        { type: 'reduceHeal', desc: '减少我方50%回血', rate: 0.5 },
        { type: 'lockBead', desc: '封锁某类宝珠1回合', duration: 1 }
      ]
    },
    unlockCondition: 'normalAllClear' // 通关普通8关后解锁
  },
  extreme: {
    name: '极难', hpRate: 3, atkRate: 3, rewardRate: 3,
    enemyAI: {
      skillProb: 0.5, // 每回合50%概率释放强力技能
      skills: [
        { type: 'aoeAttack', desc: '全屏伤害', rate: 1.5 },
        { type: 'convertBead', desc: '将所有心珠转为暗珠', from: '心', to: '暗' }
      ]
    },
    unlockCondition: 'hardAllClear' // 通关困难8关后解锁
  }
}

// 基础8关数据
const BASE_LEVELS = [
  {
    levelId: 1,
    levelName: '火焰试炼',
    attr: '火',
    enemy: {
      enemyId: 2001, enemyName: '小火龙', attr: '火',
      hp: 30000, atk: 2000,
      skill: { skillName: '火焰吐息', skillDesc: '对我方造成火属性伤害', triggerTurn: 3 }
    },
    reward: { gold: 1000, charId: null },
    unlockCondition: { preLevelId: 0 }
  },
  {
    levelId: 2,
    levelName: '烈火深渊',
    attr: '火',
    enemy: {
      enemyId: 2002, enemyName: '火焰巨人', attr: '火',
      hp: 40000, atk: 2300,
      skill: { skillName: '熔岩爆发', skillDesc: '对我方造成火属性伤害', triggerTurn: 3 }
    },
    reward: { gold: 1200, charId: 1002 },
    unlockCondition: { preLevelId: 1 }
  },
  {
    levelId: 3,
    levelName: '水之洞窟',
    attr: '水',
    enemy: {
      enemyId: 2003, enemyName: '水晶蟹', attr: '水',
      hp: 50000, atk: 2500,
      skill: { skillName: '水流冲击', skillDesc: '对我方造成水属性伤害', triggerTurn: 3 }
    },
    reward: { gold: 1500, charId: 1003 },
    unlockCondition: { preLevelId: 2 }
  },
  {
    levelId: 4,
    levelName: '迷雾森林',
    attr: '木',
    enemy: {
      enemyId: 2004, enemyName: '毒藤怪', attr: '木',
      hp: 55000, atk: 2800,
      skill: { skillName: '藤蔓鞭打', skillDesc: '对我方造成木属性伤害', triggerTurn: 2 }
    },
    reward: { gold: 2000, charId: 1004 },
    unlockCondition: { preLevelId: 3 }
  },
  {
    levelId: 5,
    levelName: '光明神殿',
    attr: '光',
    enemy: {
      enemyId: 2005, enemyName: '堕落圣骑', attr: '光',
      hp: 70000, atk: 3200,
      skill: { skillName: '圣光制裁', skillDesc: '对我方造成光属性伤害', triggerTurn: 3 }
    },
    reward: { gold: 2500, charId: 1005 },
    unlockCondition: { preLevelId: 4 }
  },
  {
    levelId: 6,
    levelName: '暗影深渊',
    attr: '暗',
    enemy: {
      enemyId: 2006, enemyName: '暗影领主', attr: '暗',
      hp: 90000, atk: 3800,
      skill: { skillName: '暗影吞噬', skillDesc: '对我方造成暗属性伤害', triggerTurn: 2 }
    },
    reward: { gold: 3000, charId: 1007 },
    unlockCondition: { preLevelId: 5 }
  },
  {
    levelId: 7,
    levelName: '混沌战场',
    attr: '火',
    enemy: {
      enemyId: 2007, enemyName: '混沌魔龙', attr: '火',
      hp: 110000, atk: 4200,
      skill: { skillName: '混沌吐息', skillDesc: '火暗双属性伤害', triggerTurn: 2 }
    },
    reward: { gold: 4000, charId: 1008 },
    unlockCondition: { preLevelId: 6 }
  },
  {
    levelId: 8,
    levelName: '龙之巢穴',
    attr: '暗',
    enemy: {
      enemyId: 2008, enemyName: '远古巨龙', attr: '暗',
      hp: 140000, atk: 5000,
      skill: { skillName: '龙息毁灭', skillDesc: '全属性毁灭攻击', triggerTurn: 2 }
    },
    reward: { gold: 6000, charId: null },
    unlockCondition: { preLevelId: 7 }
  }
]

// 根据难度生成关卡数据
function getLevelData(levelId, difficulty) {
  const base = BASE_LEVELS.find(l => l.levelId === levelId)
  if (!base) return null
  const diff = DIFFICULTY[difficulty]
  if (!diff) return null
  return {
    ...base,
    difficulty: difficulty,
    difficultyName: diff.name,
    enemy: {
      ...base.enemy,
      hp: Math.floor(base.enemy.hp * diff.hpRate),
      atk: Math.floor(base.enemy.atk * diff.atkRate)
    },
    reward: {
      gold: Math.floor(base.reward.gold * diff.rewardRate),
      charId: base.reward.charId
    },
    enemyAI: diff.enemyAI
  }
}

module.exports = { BASE_LEVELS, DIFFICULTY, getLevelData }
