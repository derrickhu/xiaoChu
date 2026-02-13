/**
 * 龙珠战纪 - 关卡数据
 */
const LEVELS = [
  {
    levelId: 1,
    levelName: '森林试炼',
    enemy: {
      enemyId: 2001,
      enemyName: '小火龙',
      attr: '火',
      hp: 30000,
      atk: 2000,
      skill: {
        skillName: '火焰吐息',
        skillDesc: '对我方造成火属性伤害',
        triggerTurn: 3
      }
    },
    reward: { gold: 1000, charId: null },
    unlockCondition: { preLevelId: 0 }
  },
  {
    levelId: 2,
    levelName: '水之洞窟',
    enemy: {
      enemyId: 2002,
      enemyName: '水晶蟹',
      attr: '水',
      hp: 45000,
      atk: 2500,
      skill: {
        skillName: '水流冲击',
        skillDesc: '对我方造成水属性伤害',
        triggerTurn: 3
      }
    },
    reward: { gold: 1500, charId: 1002 },
    unlockCondition: { preLevelId: 1 }
  },
  {
    levelId: 3,
    levelName: '迷雾森林',
    enemy: {
      enemyId: 2003,
      enemyName: '毒藤怪',
      attr: '木',
      hp: 55000,
      atk: 2800,
      skill: {
        skillName: '藤蔓鞭打',
        skillDesc: '对我方造成木属性伤害',
        triggerTurn: 2
      }
    },
    reward: { gold: 2000, charId: 1003 },
    unlockCondition: { preLevelId: 2 }
  },
  {
    levelId: 4,
    levelName: '光明神殿',
    enemy: {
      enemyId: 2004,
      enemyName: '堕落圣骑',
      attr: '光',
      hp: 70000,
      atk: 3200,
      skill: {
        skillName: '圣光制裁',
        skillDesc: '对我方造成光属性伤害',
        triggerTurn: 3
      }
    },
    reward: { gold: 2500, charId: 1004 },
    unlockCondition: { preLevelId: 3 }
  },
  {
    levelId: 5,
    levelName: '暗影深渊',
    enemy: {
      enemyId: 2005,
      enemyName: '暗影领主',
      attr: '暗',
      hp: 90000,
      atk: 3800,
      skill: {
        skillName: '暗影吞噬',
        skillDesc: '对我方造成暗属性伤害',
        triggerTurn: 2
      }
    },
    reward: { gold: 3000, charId: 1005 },
    unlockCondition: { preLevelId: 4 }
  },
  {
    levelId: 6,
    levelName: '龙之巢穴',
    enemy: {
      enemyId: 2006,
      enemyName: '远古巨龙',
      attr: '火',
      hp: 120000,
      atk: 4500,
      skill: {
        skillName: '龙息',
        skillDesc: '对我方造成火属性伤害',
        triggerTurn: 2
      }
    },
    reward: { gold: 5000, charId: 1007 },
    unlockCondition: { preLevelId: 5 }
  }
]

module.exports = LEVELS
