/**
 * Buff 数据配置 — 图标映射、类别、描述、颜色等
 * 所有 buff 相关的纯数据集中管理，渲染代码只读取
 */

const BUFF_ICON_IMG_MAP = {
  allAtkPct:       'assets/ui/battle/buff_icon_atk.png',
  allDmgPct:       'assets/ui/battle/buff_icon_atk.png',
  counterDmgPct:   'assets/ui/battle/buff_icon_atk.png',
  skillDmgPct:     'assets/ui/battle/buff_icon_atk.png',
  healNow:         'assets/ui/battle/buff_icon_heal.png',
  postBattleHeal:  'assets/ui/battle/buff_icon_heal.png',
  regenPerTurn:    'assets/ui/battle/buff_icon_heal.png',
  dmgReducePct:    'assets/ui/battle/buff_icon_def.png',
  nextDmgReduce:   'assets/ui/battle/buff_icon_def.png',
  grantShield:     'assets/ui/battle/buff_icon_def.png',
  immuneOnce:      'assets/ui/battle/buff_icon_def.png',
  comboDmgPct:     'assets/ui/battle/buff_icon_elim.png',
  elim3DmgPct:     'assets/ui/battle/buff_icon_elim.png',
  elim4DmgPct:     'assets/ui/battle/buff_icon_elim.png',
  elim5DmgPct:     'assets/ui/battle/buff_icon_elim.png',
  bonusCombo:      'assets/ui/battle/buff_icon_elim.png',
  extraTimeSec:    'assets/ui/battle/buff_icon_time.png',
  skillCdReducePct:'assets/ui/battle/buff_icon_time.png',
  resetAllCd:      'assets/ui/battle/buff_icon_time.png',
  hpMaxPct:        'assets/ui/battle/buff_icon_hp.png',
  enemyAtkReducePct:'assets/ui/battle/buff_icon_weaken.png',
  enemyHpReducePct:'assets/ui/battle/buff_icon_weaken.png',
  enemyDefReducePct:'assets/ui/battle/buff_icon_weaken.png',
  eliteAtkReducePct:'assets/ui/battle/buff_icon_weaken.png',
  eliteHpReducePct:'assets/ui/battle/buff_icon_weaken.png',
  bossAtkReducePct:'assets/ui/battle/buff_icon_weaken.png',
  bossHpReducePct: 'assets/ui/battle/buff_icon_weaken.png',
  nextStunEnemy:   'assets/ui/battle/buff_icon_weaken.png',
  stunDurBonus:    'assets/ui/battle/buff_icon_weaken.png',
  extraRevive:     'assets/ui/battle/buff_icon_special.png',
  skipNextBattle:  'assets/ui/battle/buff_icon_special.png',
  nextFirstTurnDouble:'assets/ui/battle/buff_icon_special.png',
  heartBoostPct:   'assets/ui/battle/buff_icon_special.png',
  hpMaxPct:        'assets/ui/battle/buff_icon_hp.png',
}

const BUFF_ICON_EMOJI = {
  allAtkPct:       '\u2694\uFE0F', allDmgPct:       '\u2694\uFE0F',
  heartBoostPct:   '\uD83D\uDC97', comboDmgPct:     '\uD83D\uDD25',
  elim3DmgPct:     '\u2462', elim4DmgPct:     '\u2463', elim5DmgPct:     '\u2464',
  extraTimeSec:    '\u23F1\uFE0F', regenPerTurn:    '\uD83D\uDC9A', dmgReducePct:    '\uD83D\uDEE1\uFE0F',
  enemyAtkReducePct:'\uD83D\uDC79', enemyHpReducePct:'\uD83D\uDC79', enemyDefReducePct:'\uD83D\uDC79',
  healNow:         '\u2764\uFE0F\u200D\uD83E\uDE79', postBattleHeal:  '\uD83D\uDC8A',
  counterDmgPct:   '\u26A1', skillDmgPct:     '\u2728', skillCdReducePct:'\u23F3',
  bonusCombo:      '\uD83D\uDD25', stunDurBonus:    '\uD83D\uDCAB',
  eliteAtkReducePct:'\uD83D\uDC80', eliteHpReducePct:'\uD83D\uDC80',
  bossAtkReducePct:'\uD83D\uDC51', bossHpReducePct: '\uD83D\uDC51',
  nextDmgReduce:   '\uD83D\uDEE1\uFE0F', extraRevive:     '\u267B\uFE0F',
  grantShield:     '\uD83D\uDEE1\uFE0F', resetAllCd:      '\u23F3', skipNextBattle:  '\uD83D\uDEAB',
  immuneOnce:      '\u2728', nextFirstTurnDouble:'\u2694\uFE0F', nextStunEnemy:   '\uD83D\uDCAB',
}

const BUFF_CATEGORY = {
  allAtkPct:'\u653B\u51FB\u5F3A\u5316', allDmgPct:'\u653B\u51FB\u5F3A\u5316', counterDmgPct:'\u653B\u51FB\u5F3A\u5316', skillDmgPct:'\u653B\u51FB\u5F3A\u5316',
  healNow:'\u751F\u547D\u56DE\u590D', postBattleHeal:'\u751F\u547D\u56DE\u590D', regenPerTurn:'\u751F\u547D\u56DE\u590D',
  dmgReducePct:'\u9632\u5FA1\u51CF\u4F24', nextDmgReduce:'\u9632\u5FA1\u51CF\u4F24', grantShield:'\u9632\u5FA1\u51CF\u4F24', immuneOnce:'\u9632\u5FA1\u51CF\u4F24',
  comboDmgPct:'\u6D88\u9664\u589E\u5E45', elim3DmgPct:'\u6D88\u9664\u589E\u5E45', elim4DmgPct:'\u6D88\u9664\u589E\u5E45', elim5DmgPct:'\u6D88\u9664\u589E\u5E45', bonusCombo:'\u6D88\u9664\u589E\u5E45',
  extraTimeSec:'\u65F6\u95F4\u64CD\u63A7', skillCdReducePct:'\u65F6\u95F4\u64CD\u63A7', resetAllCd:'\u65F6\u95F4\u64CD\u63A7',
  hpMaxPct:'\u8840\u91CF\u5F3A\u5316',
  enemyAtkReducePct:'\u524A\u5F31\u654C\u4EBA', enemyHpReducePct:'\u524A\u5F31\u654C\u4EBA', eliteAtkReducePct:'\u524A\u5F31\u654C\u4EBA',
  eliteHpReducePct:'\u524A\u5F31\u654C\u4EBA', bossAtkReducePct:'\u524A\u5F31\u654C\u4EBA', bossHpReducePct:'\u524A\u5F31\u654C\u4EBA',
  nextStunEnemy:'\u524A\u5F31\u654C\u4EBA', stunDurBonus:'\u524A\u5F31\u654C\u4EBA',
  extraRevive:'\u7279\u6B8A\u6548\u679C', skipNextBattle:'\u7279\u6B8A\u6548\u679C', nextFirstTurnDouble:'\u7279\u6B8A\u6548\u679C', heartBoostPct:'\u7279\u6B8A\u6548\u679C',
}

const BUFF_CATEGORY_COLORS = {
  '\u653B\u51FB\u5F3A\u5316':'#c06020', '\u751F\u547D\u56DE\u590D':'#2d8a4e', '\u9632\u5FA1\u51CF\u4F24':'#3a6aaa',
  '\u6D88\u9664\u589E\u5E45':'#b88a20', '\u65F6\u95F4\u64CD\u63A7':'#7a5aaa', '\u8840\u91CF\u5F3A\u5316':'#2d8a4e',
  '\u524A\u5F31\u654C\u4EBA':'#7a4aaa', '\u7279\u6B8A\u6548\u679C':'#b8881e',
}

const BUFF_DESC = {
  allAtkPct:'\u5168\u961F\u6D88\u9664\u653B\u51FB\u4F24\u5BB3\u6309\u767E\u5206\u6BD4\u63D0\u5347', allDmgPct:'\u5168\u961F\u6240\u6709\u4F24\u5BB3\u6309\u767E\u5206\u6BD4\u63D0\u5347',
  counterDmgPct:'\u4E94\u884C\u514B\u5236\u989D\u5916\u4F24\u5BB3\u63D0\u5347', skillDmgPct:'\u7075\u517D\u6280\u80FD\u4F24\u5BB3\u63D0\u5347',
  healNow:'\u7ACB\u5373\u56DE\u590D\u5F53\u524D\u6700\u5927\u8840\u91CF\u7684\u4E00\u5B9A\u6BD4\u4F8B', postBattleHeal:'\u6BCF\u573A\u6218\u6597\u80DC\u5229\u540E\u56DE\u590D\u4E00\u5B9A\u6BD4\u4F8B\u8840\u91CF',
  regenPerTurn:'\u6BCF\u56DE\u5408\u7ED3\u7B97\u540E\u81EA\u52A8\u56DE\u590D\u56FA\u5B9A\u751F\u547D\u503C',
  dmgReducePct:'\u53D7\u5230\u6240\u6709\u4F24\u5BB3\u964D\u4F4E\uFF08\u6C38\u4E45\u751F\u6548\uFF09', nextDmgReduce:'\u4E0B\u4E00\u573A\u6218\u6597\u53D7\u5230\u4F24\u5BB3\u964D\u4F4E\uFF08\u5355\u573A\uFF09',
  grantShield:'\u7ACB\u5373\u83B7\u5F97\u62A4\u76FE\uFF0C\u5438\u6536\u7B49\u91CF\u4F24\u5BB3', immuneOnce:'\u514D\u75AB\u4E0B\u4E00\u6B21\u654C\u65B9\u63A7\u5236\u6280\u80FD',
  comboDmgPct:'Combo\u8FDE\u51FB\u500D\u7387\u989D\u5916\u52A0\u6210', elim3DmgPct:'3\u6D88\u57FA\u7840\u4F24\u5BB3\u500D\u7387\u63D0\u5347',
  elim4DmgPct:'4\u6D88\u4F24\u5BB3\u500D\u7387\u63D0\u5347', elim5DmgPct:'5\u6D88\u4F24\u5BB3\u500D\u7387\u63D0\u5347',
  bonusCombo:'\u6BCF\u56DE\u5408\u9996\u6B21\u6D88\u9664\u989D\u5916\u589E\u52A0\u8FDE\u51FB\u6570',
  extraTimeSec:'\u8F6C\u73E0\u64CD\u4F5C\u65F6\u95F4\u589E\u52A0', skillCdReducePct:'\u7075\u517D\u6280\u80FD\u51B7\u5374\u56DE\u5408\u7F29\u77ED',
  resetAllCd:'\u7ACB\u5373\u91CD\u7F6E\u6240\u6709\u7075\u517D\u6280\u80FD\u51B7\u5374',
  hpMaxPct:'\u4E3B\u89D2\u6700\u5927\u8840\u91CF\u6309\u767E\u5206\u6BD4\u63D0\u5347\uFF08\u7ACB\u5373\u751F\u6548\uFF09',
  enemyAtkReducePct:'\u6240\u6709\u602A\u7269\u653B\u51FB\u529B\u964D\u4F4E', enemyHpReducePct:'\u6240\u6709\u602A\u7269\u8840\u91CF\u964D\u4F4E',
  eliteAtkReducePct:'\u7CBE\u82F1\u602A\u653B\u51FB\u529B\u964D\u4F4E', eliteHpReducePct:'\u7CBE\u82F1\u602A\u8840\u91CF\u964D\u4F4E',
  bossAtkReducePct:'BOSS\u653B\u51FB\u529B\u964D\u4F4E', bossHpReducePct:'BOSS\u8840\u91CF\u964D\u4F4E',
  nextStunEnemy:'\u4E0B\u4E00\u573A\u6218\u6597\u654C\u4EBA\u5F00\u5C40\u7729\u6655', stunDurBonus:'\u5BF9\u654C\u65B9\u7729\u6655\u6301\u7EED\u65F6\u95F4\u5EF6\u957F\u56DE\u5408\u6570',
  extraRevive:'\u83B7\u5F97\u989D\u5916\u590D\u6D3B\u673A\u4F1A', skipNextBattle:'\u76F4\u63A5\u8DF3\u8FC7\u4E0B\u4E00\u573A\u666E\u901A\u6218\u6597',
  nextFirstTurnDouble:'\u4E0B\u573A\u6218\u6597\u9996\u56DE\u5408\u4F24\u5BB3\u7FFB\u500D', heartBoostPct:'\u5FC3\u73E0\u56DE\u590D\u6548\u679C\u63D0\u5347',
}

const BUFF_LABELS = {
  allAtkPct: '\u653B\u51FB', allDmgPct: '\u4F24\u5BB3', counterDmgPct: '\u514B\u5236',
  skillDmgPct: '\u6280\u80FD', comboDmgPct: '\u8FDE\u51FB', elim3DmgPct: '3\u6D88',
  elim4DmgPct: '4\u6D88', elim5DmgPct: '5\u6D88', bonusCombo: '+\u8FDE',
  extraTimeSec: '\u65F6\u95F4', regenPerTurn: '\u56DE\u8840', dmgReducePct: '\u51CF\u4F24',
  hpMaxPct: '\u8840\u4E0A', heartBoostPct: '\u5FC3\u73E0',
  nextDmgReduce: '\u4E0B\u51CF', grantShield: '\u62A4\u76FE', immuneOnce: '\u514D\u63A7',
  skillCdReducePct: 'CD\u51CF', resetAllCd: '\u91CDcd',
  enemyAtkReducePct: '\u602A\u653B\u2193', enemyHpReducePct: '\u602A\u8840\u2193', enemyDefReducePct: '\u602A\u9632\u2193',
  eliteAtkReducePct: '\u7CBE\u653B\u2193', eliteHpReducePct: '\u7CBE\u8840\u2193',
  bossAtkReducePct: 'B\u653B\u2193', bossHpReducePct: 'B\u8840\u2193',
  stunDurBonus: '\u7729\u65F6', nextStunEnemy: '\u5148\u7729',
  extraRevive: '\u590D\u6D3B', skipNextBattle: '\u8DF3\u6218',
  nextFirstTurnDouble: '\u9996\u56DE\u00D7', healNow: '\u6CBB\u7597', postBattleHeal: '\u6218\u540E',
}

const DEBUFF_KEYS = [
  'enemyAtkReducePct','enemyHpReducePct','enemyDefReducePct',
  'eliteAtkReducePct','eliteHpReducePct',
  'bossAtkReducePct','bossHpReducePct',
  'nextStunEnemy','stunDurBonus',
]

function getBuffIcon(R, buffKey) {
  const imgPath = BUFF_ICON_IMG_MAP[buffKey]
  if (imgPath) {
    const img = R.getImg(imgPath)
    if (img && img.width > 0) return { type: 'img', img }
  }
  return { type: 'emoji', emoji: BUFF_ICON_EMOJI[buffKey] || '\u2726' }
}

function shortBuffLabel(label) {
  return label
    .replace(/^\[\u901F\u901A\]\s*/, '')
    .replace(/\u5168\u961F/g, '')
    .replace(/\u6301\u7EED\u672C\u5C40/g, '')
    .replace(/\u6C38\u4E45/g, '')
}

function formatBuffValue(buffKey, val) {
  if (buffKey === 'extraTimeSec') return `+${val.toFixed ? val.toFixed(1) : val} \u79D2`
  if (['bonusCombo','stunDurBonus','extraRevive','regenPerTurn'].includes(buffKey)) return `+${val}`
  if (['healNow','postBattleHeal','grantShield'].includes(buffKey)) return `${val}${buffKey === 'grantShield' ? ' \u70B9\u62A4\u76FE' : '% \u8840\u91CF'}`
  if (['skipNextBattle','resetAllCd','immuneOnce','nextFirstTurnDouble','nextStunEnemy'].includes(buffKey)) return '\u4E00\u6B21\u6027\u6548\u679C'
  return `+${val}%`
}

module.exports = {
  BUFF_ICON_IMG_MAP,
  BUFF_ICON_EMOJI,
  BUFF_CATEGORY,
  BUFF_CATEGORY_COLORS,
  BUFF_DESC,
  BUFF_LABELS,
  DEBUFF_KEYS,
  getBuffIcon,
  shortBuffLabel,
  formatBuffValue,
}
