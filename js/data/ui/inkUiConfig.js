/**
 * 水墨修仙 UI 配置
 *
 * 只放视觉语义和尺寸比例，页面逻辑不在这里分支。
 */

const INK = {
  colors: {
    paper: 'rgba(246,238,216,0.92)',
    paperDeep: 'rgba(224,205,166,0.72)',
    ink: '#3b2617',
    inkSoft: 'rgba(73,49,28,0.78)',
    gold: '#d5aa42',
    goldDeep: '#936622',
    cinnabar: '#a13c2a',
    jade: '#4f8b74',
    dim: 'rgba(84,70,52,0.58)',
  },
  dex: {
    statH: 34,
    tabH: 24,
    roleTabH: 22,
    gridCols: 3,
    cardGap: 8,
    cardRatio: 1.28,
  },
  tier: {
    unknown: {
      bg: 'rgba(58,50,38,0.28)',
      border: 'rgba(108,92,65,0.45)',
      name: 'rgba(87,68,45,0.62)',
      label: '未知',
    },
    discovered: {
      bg: 'rgba(243,231,203,0.80)',
      border: 'rgba(126,96,54,0.50)',
      name: '#5c4330',
      label: '发现',
    },
    collected: {
      bg: 'rgba(250,244,226,0.94)',
      border: 'rgba(178,135,55,0.58)',
      name: '#3a2f24',
      label: '收录',
    },
    mastered: {
      bg: 'rgba(252,240,202,0.96)',
      border: 'rgba(215,174,58,0.88)',
      name: '#4a3206',
      label: '精通',
    },
  },
}

module.exports = {
  INK,
}
