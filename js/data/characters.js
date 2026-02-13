/**
 * 龙珠战纪 - 角色数据
 * 所有角色的基础数据，程序直接解析
 */
const CHARACTERS = [
  {
    charId: 1001,
    charName: '火焰龙',
    attr: '火',
    baseAtk: 1500,
    baseHp: 8000,
    activeSkill: {
      skillId: 2001,
      skillName: '火焰冲击',
      skillDesc: '将所有心珠转为火珠',
      cd: 6,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '心', toBead: '火' }
    },
    leaderSkill: {
      skillId: 3001,
      skillName: '炎之觉醒',
      skillDesc: '火属性角色攻击×3',
      effectRate: 3,
      attrLimit: '火'
    }
  },
  {
    charId: 1002,
    charName: '冰霜蛇',
    attr: '水',
    baseAtk: 1400,
    baseHp: 8500,
    activeSkill: {
      skillId: 2002,
      skillName: '冰冻波',
      skillDesc: '将所有火珠转为水珠',
      cd: 6,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '火', toBead: '水' }
    },
    leaderSkill: {
      skillId: 3002,
      skillName: '水之守护',
      skillDesc: '水属性角色攻击×3',
      effectRate: 3,
      attrLimit: '水'
    }
  },
  {
    charId: 1003,
    charName: '森之灵',
    attr: '木',
    baseAtk: 1300,
    baseHp: 9000,
    activeSkill: {
      skillId: 2003,
      skillName: '藤蔓缠绕',
      skillDesc: '将所有水珠转为木珠',
      cd: 5,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '水', toBead: '木' }
    },
    leaderSkill: {
      skillId: 3003,
      skillName: '森林之力',
      skillDesc: '木属性角色攻击×3',
      effectRate: 3,
      attrLimit: '木'
    }
  },
  {
    charId: 1004,
    charName: '圣光骑士',
    attr: '光',
    baseAtk: 1600,
    baseHp: 7500,
    activeSkill: {
      skillId: 2004,
      skillName: '圣光洗礼',
      skillDesc: '将所有暗珠转为光珠',
      cd: 7,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '暗', toBead: '光' }
    },
    leaderSkill: {
      skillId: 3004,
      skillName: '光之裁决',
      skillDesc: '光属性角色攻击×2.5',
      effectRate: 2.5,
      attrLimit: '光'
    }
  },
  {
    charId: 1005,
    charName: '暗影刺客',
    attr: '暗',
    baseAtk: 1700,
    baseHp: 7000,
    activeSkill: {
      skillId: 2005,
      skillName: '暗影突袭',
      skillDesc: '将所有光珠转为暗珠',
      cd: 7,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '光', toBead: '暗' }
    },
    leaderSkill: {
      skillId: 3005,
      skillName: '暗之支配',
      skillDesc: '暗属性角色攻击×2.5',
      effectRate: 2.5,
      attrLimit: '暗'
    }
  },
  {
    charId: 1006,
    charName: '治愈天使',
    attr: '心',
    baseAtk: 1000,
    baseHp: 12000,
    activeSkill: {
      skillId: 2006,
      skillName: '生命绽放',
      skillDesc: '将所有暗珠转为心珠',
      cd: 5,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '暗', toBead: '心' }
    },
    leaderSkill: {
      skillId: 3006,
      skillName: '生命祝福',
      skillDesc: '全属性HP×2',
      effectRate: 1,
      attrLimit: null
    }
  },
  {
    charId: 1007,
    charName: '炎魔将军',
    attr: '火',
    baseAtk: 1800,
    baseHp: 7200,
    activeSkill: {
      skillId: 2007,
      skillName: '烈焰风暴',
      skillDesc: '将所有木珠转为火珠',
      cd: 8,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '木', toBead: '火' }
    },
    leaderSkill: null
  },
  {
    charId: 1008,
    charName: '海神使者',
    attr: '水',
    baseAtk: 1350,
    baseHp: 9500,
    activeSkill: {
      skillId: 2008,
      skillName: '潮汐之力',
      skillDesc: '将所有心珠转为水珠',
      cd: 6,
      currentCd: 0,
      effectType: 'beadConvert',
      param: { fromBead: '心', toBead: '水' }
    },
    leaderSkill: null
  }
]

module.exports = CHARACTERS
