/**
 * 局内攻略分页面板与入口按钮
 */
const V = require('../env')
const { ATTRS, ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY, COUNTER_MUL } = require('../../data/tower')
const { BATTLE_HELP_BTN_BELOW_SAFE_TOP_PT } = require('../../data/constants')
const { getHelpPageData } = require('../../engine/strategyAdvisor')

function buildHelpPages() {
  const d = getHelpPageData()
  const counterMul = d.counterMul
  const counteredMul = d.counteredMul
  const elimMul4 = d.elimMul4
  const elimMul5 = d.elimMul5
  const comboRate = Math.round(d.comboDmgRates[0] * 100)
  const starMulEntries = Object.entries(d.starAtkMul).map(([s, m]) => `★${s}:×${m}`).join('  ')

  return [
    {
      title: '当前队伍',
      render: function (ctx, cx, cy, w, h, S, g) {
        if (!g || !g.pets) return
        const pets = g.pets || []
        const enemy = g.enemy
        const startY = cy - h * 0.36
        let y = startY
        const lineH = 20 * S
        const leftX = cx - w * 0.42
        const rightX = cx + w * 0.42

        // 敌人信息
        if (enemy) {
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
          const eColor = (ATTR_COLOR[enemy.attr] || {}).main || '#ccc'
          ctx.fillStyle = eColor; ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(`敌：${enemy.name}`, leftX, y)
          ctx.fillStyle = '#d0c8a8'; ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          const counterAttr = COUNTER_BY[enemy.attr]
          const counterName = counterAttr ? ATTR_NAME[counterAttr] : '?'
          ctx.fillText(`弱点：${counterName}属性 (×${counterMul})`, leftX + 120 * S, y)
          y += lineH + 4 * S

          ctx.strokeStyle = 'rgba(200,170,80,0.2)'; ctx.lineWidth = 1 * S
          ctx.beginPath(); ctx.moveTo(leftX, y); ctx.lineTo(rightX, y); ctx.stroke()
          y += 6 * S
        }

        // 队伍宠物列表
        ctx.textAlign = 'left'
        ctx.fillStyle = '#ffe8a0'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
        ctx.fillText('宠物', leftX, y)
        ctx.textAlign = 'center'
        ctx.fillText('属性', cx - 10 * S, y)
        ctx.fillText('ATK', cx + 50 * S, y)
        ctx.fillText('克制', rightX - 20 * S, y)
        y += lineH

        let totalAtk = 0
        const attrSet = new Set()
        for (const p of pets) {
          const pColor = (ATTR_COLOR[p.attr] || {}).main || '#ccc'
          const attrName = ATTR_NAME[p.attr] || '?'
          const isCounter = enemy && p.attr === COUNTER_BY[enemy.attr]
          const isCountered = enemy && COUNTER_MAP[p.attr] === enemy.attr

          ctx.textAlign = 'left'
          ctx.fillStyle = pColor; ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(`${p.name}`, leftX, y)

          ctx.textAlign = 'center'
          ctx.fillStyle = pColor
          ctx.fillText(attrName, cx - 10 * S, y)
          ctx.fillStyle = '#e0d8c0'
          ctx.fillText(`${p.atk}`, cx + 50 * S, y)

          if (isCounter) {
            ctx.fillStyle = '#60DD60'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
            ctx.fillText('✓克制', rightX - 20 * S, y)
          } else if (isCountered) {
            ctx.fillStyle = '#DD6060'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
            ctx.fillText('✗被克', rightX - 20 * S, y)
          } else {
            ctx.fillStyle = '#888'; ctx.font = `${11 * S}px "PingFang SC",sans-serif`
            ctx.fillText('—', rightX - 20 * S, y)
          }
          totalAtk += p.atk || 0
          attrSet.add(p.attr)
          y += lineH
        }

        // 汇总
        y += 4 * S
        ctx.strokeStyle = 'rgba(200,170,80,0.2)'; ctx.lineWidth = 1 * S
        ctx.beginPath(); ctx.moveTo(leftX, y); ctx.lineTo(rightX, y); ctx.stroke()
        y += 10 * S

        ctx.textAlign = 'left'; ctx.fillStyle = '#ffe8a0'
        ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
        ctx.fillText(`总攻击：${totalAtk}`, leftX, y)
        ctx.fillStyle = '#c8b880'; ctx.font = `${11 * S}px "PingFang SC",sans-serif`
        ctx.fillText(`属性覆盖：${attrSet.size}/5`, cx, y)
        y += lineH + 2 * S

        // 属性覆盖可视化
        const dotR = 8 * S, dotGap = 12 * S
        const dotTotalW = ATTRS.length * (dotR * 2 + dotGap) - dotGap
        let dotX = cx - dotTotalW / 2 + dotR
        ctx.textBaseline = 'middle'
        for (const a of ATTRS) {
          const has = attrSet.has(a)
          const ac = (ATTR_COLOR[a] || {}).main || '#666'
          ctx.fillStyle = has ? ac : 'rgba(80,70,50,0.5)'
          ctx.globalAlpha = has ? 1 : 0.4
          ctx.beginPath(); ctx.arc(dotX, y + dotR, dotR, 0, Math.PI * 2); ctx.fill()
          ctx.globalAlpha = 1
          ctx.fillStyle = has ? '#fff' : '#666'
          ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(ATTR_NAME[a], dotX, y + dotR)
          dotX += dotR * 2 + dotGap
        }

        // 修炼加成摘要
        if (g.storage) {
          const cult = g.storage.cultivation || {}
          const lv = cult.level || 0
          if (lv > 0) {
            y += dotR * 2 + 12 * S
            ctx.fillStyle = '#b0a080'; ctx.font = `${10 * S}px "PingFang SC",sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText(`修炼 Lv.${lv}`, cx, y)
          }
        }
      },
    },
    {
      title: '五行克制',
      render: function (ctx, cx, cy, w, h, S) {
        const attrs = ['metal', 'wood', 'earth', 'water', 'fire']
        const names = ['金', '木', '土', '水', '火']
        const colors = ['#ffd700', '#4dcc4d', '#d4a056', '#4dabff', '#ff4d4d']
        const icons = ['⚔️', '🌿', '🪨', '💧', '🔥']
        const r = Math.min(w, h) * 0.26
        const pts = attrs.map((_, i) => {
          const a = -Math.PI / 2 + i * (Math.PI * 2 / 5)
          return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.95 }
        })

        ctx.lineWidth = 2 * S
        for (let i = 0; i < 5; i++) {
          const from = pts[i], to = pts[(i + 1) % 5]
          const dx = to.x - from.x, dy = to.y - from.y
          const len = Math.sqrt(dx * dx + dy * dy)
          const ux = dx / len, uy = dy / len
          const startX = from.x + ux * 18 * S, startY = from.y + uy * 18 * S
          const endX = to.x - ux * 18 * S, endY = to.y - uy * 18 * S

          ctx.strokeStyle = colors[i]; ctx.globalAlpha = 0.6
          ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(endX, endY); ctx.stroke()
          const arrowLen = 6 * S
          ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.8
          ctx.beginPath()
          ctx.moveTo(endX, endY)
          ctx.lineTo(endX - ux * arrowLen - uy * arrowLen * 0.5, endY - uy * arrowLen + ux * arrowLen * 0.5)
          ctx.lineTo(endX - ux * arrowLen + uy * arrowLen * 0.5, endY - uy * arrowLen - ux * arrowLen * 0.5)
          ctx.closePath(); ctx.fill()
        }
        ctx.globalAlpha = 1

        for (let i = 0; i < 5; i++) {
          const p = pts[i]
          ctx.fillStyle = 'rgba(20,15,8,0.85)'
          ctx.beginPath(); ctx.arc(p.x, p.y, 16 * S, 0, Math.PI * 2); ctx.fill()
          ctx.strokeStyle = colors[i]; ctx.lineWidth = 1.5 * S
          ctx.beginPath(); ctx.arc(p.x, p.y, 16 * S, 0, Math.PI * 2); ctx.stroke()
          ctx.fillStyle = '#fff'
          ctx.font = `${14 * S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(icons[i], p.x, p.y - 1 * S)
          ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
          ctx.fillStyle = colors[i]
          ctx.fillText(names[i], p.x, p.y + 13 * S)
        }

        ctx.fillStyle = '#e8d8b0'
        ctx.font = `${11 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(`克制：伤害 ×${counterMul}  |  被克：伤害 ×${counteredMul}`, cx, cy + r + 36 * S)
        ctx.fillText(d.counterChain, cx, cy + r + 52 * S)
      },
    },
    {
      title: '转珠与伤害',
      render: function (ctx, cx, cy, w, h, S) {
        const startY = cy - h * 0.32
        let y = startY
        const lineH = 22 * S
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const leftX = cx - w * 0.38
        const _row = (label, desc, color) => {
          ctx.fillStyle = color || '#ffe8a0'
          ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(label, leftX, y)
          ctx.fillStyle = '#d0c8a8'
          ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
          y += lineH
        }
        _row('🔮 消珠攻击', '消除 3+ 同色珠 → 对应属性宠物攻击')
        _row('✨ 4 颗消除', `伤害 ×${elimMul4}`)
        _row('💥 5 颗消除', `伤害 ×${elimMul5} + 眩晕敌人 1 回合`)
        y += 6 * S
        _row('🔥 Combo', `连续消除不同颜色，每段 +${comboRate}% 伤害`, '#ff9966')
        _row('❤️ 心珠', '消除粉色心珠可回复生命值', '#ff88aa')
        y += 6 * S
        _row('⚡ 残血爆发', 'HP≤30% 伤害 ×1.5，HP≤15% 伤害 ×2.0', '#ff6060')
        y += 6 * S
        ctx.fillStyle = '#a0a0a0'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('拖动灵珠会与路径上的珠子交换位置', cx, y)
        y += lineH * 0.7
        ctx.fillText('松手后自动检测并消除所有 3 连及以上的组合', cx, y)
      },
    },
    {
      title: '宠物与技能',
      render: function (ctx, cx, cy, w, h, S) {
        const startY = cy - h * 0.28
        let y = startY
        const lineH = 22 * S
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const leftX = cx - w * 0.38
        const _row = (label, desc, color) => {
          ctx.fillStyle = color || '#ffe8a0'
          ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(label, leftX, y)
          ctx.fillStyle = '#d0c8a8'
          ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
          y += lineH
        }
        _row('🐾 属性关联', '宠物属性 = 消除的珠子颜色')
        _row('⬆️ 星级升级', '强化宠物提升攻击力')
        _row('🎯 主动技能', '★2+宠物拥有技能，上滑头像释放')
        y += 6 * S
        ctx.fillStyle = '#a0a0a0'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('技能有冷却时间，就绪时头像发光提示', cx, y)
        y += lineH * 0.8
        ctx.fillText('长按宠物头像可预览技能效果', cx, y)
        y += lineH
        ctx.fillStyle = '#c8b880'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(`升星倍率：${starMulEntries}`, cx, y)
      },
    },
    {
      title: '珠子与攻击',
      render: function (ctx, cx, cy, w, h, S) {
        const startY = cy - h * 0.32
        let y = startY
        const lineH = 22 * S
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const leftX = cx - w * 0.38
        const _row = (label, desc, color) => {
          ctx.fillStyle = color || '#ffe8a0'
          ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(label, leftX, y)
          ctx.fillStyle = '#d0c8a8'
          ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
          y += lineH
        }
        _row('⚔ 有效珠', '匹配队伍宠物属性的珠子，带⚔标记')
        _row('🔆 亮珠消除', '→ 对应属性宠物发动攻击', '#ffd700')
        y += 4 * S
        _row('⬛ 暗淡珠', '队伍中无该属性宠物')
        _row('❌ 消除无伤害', '但仍可触发 Combo 增加连击倍率', '#999')
        y += 4 * S
        _row('❤ 心珠', '始终有效，消除回复生命值', '#ff88aa')
        y += 8 * S
        ctx.fillStyle = '#a0a0a0'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('宠物栏下方的属性条可查看当前覆盖情况', cx, y)
        y += lineH * 0.7
        ctx.fillText('编队时尽量覆盖更多属性以提高伤害', cx, y)
      },
    },
    {
      title: '法宝系统',
      render: function (ctx, cx, cy, w, h, S) {
        const startY = cy - h * 0.32
        let y = startY
        const lineH = 22 * S
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const leftX = cx - w * 0.38
        const _row = (label, desc, color) => {
          ctx.fillStyle = color || '#ffe8a0'
          ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(label, leftX, y)
          ctx.fillStyle = '#d0c8a8'
          ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
          y += lineH
        }
        _row('🏺 装备法宝', '主角仅装备 1 件，全局被动生效')
        _row('⚔ 攻击增伤', '提升属性伤害 / 全队攻击 / Combo', '#ffd700')
        _row('🛡 防御减伤', '减少受到的伤害 / 反弹伤害')
        _row('💊 回血治疗', '消珠回血 / 击杀回血 / 每回合回血', '#ff88aa')
        _row('🔮 暴击强化', '提升暴击率 / 暴击伤害', '#ff9966')
        _row('🌀 珠率提升', '指定属性珠出现概率大幅提升')
        _row('🔰 特殊效果', '免疫异常 / 斩杀 / 破防等')
        y += 8 * S
        ctx.fillStyle = '#a0a0a0'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('法宝通关秘境关卡首通获得', cx, y)
        y += lineH * 0.7
        ctx.fillText('通天塔中也可以获得法宝', cx, y)
      },
    },
    {
      title: '修炼体系',
      render: function (ctx, cx, cy, w, h, S) {
        const startY = cy - h * 0.32
        let y = startY
        const lineH = 22 * S
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const leftX = cx - w * 0.38
        const _row = (label, desc, color) => {
          ctx.fillStyle = color || '#ffe8a0'
          ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(label, leftX, y)
          ctx.fillStyle = '#d0c8a8'
          ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
          y += lineH
        }
        for (const c of d.cultConfig) {
          const icon = c.key === 'body' ? '💪' : c.key === 'spirit' ? '🔮' : c.key === 'wisdom' ? '🧠' : c.key === 'defense' ? '🛡' : '👁'
          _row(`${icon} ${c.name}`, `每级 +${c.perLv} ${c.unit}（满${c.maxLv}级）`)
        }
        y += 8 * S
        ctx.fillStyle = '#a0a0a0'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('打关卡和通天塔获得修炼经验', cx, y)
        y += lineH * 0.7
        ctx.fillText('升级后获得修炼点，分配到各属性加成', cx, y)
      },
    },
    {
      title: '战斗技巧',
      render: function (ctx, cx, cy, w, h, S) {
        const startY = cy - h * 0.32
        let y = startY
        const lineH = 22 * S
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        const leftX = cx - w * 0.38
        const _row = (label, desc, color) => {
          ctx.fillStyle = color || '#ffe8a0'
          ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
          ctx.fillText(label, leftX, y)
          ctx.fillStyle = '#d0c8a8'
          ctx.font = `${11 * S}px "PingFang SC",sans-serif`
          ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
          y += lineH
        }
        _row('🎯 优先克制', `克制珠优先消除（伤害 ×${counterMul}）`)
        _row('🔗 长路径', '拖动路径越长，交换排列越多')
        _row('💎 多Combo', `每多一段 Combo +${comboRate}% 伤害`, '#ff9966')
        _row('⏰ 转珠时间', '注意倒计时，修炼可延长时间')
        y += 6 * S
        _row('📈 修炼加成', '消耗经验强化攻击/防御/血量等', '#80ccff')
        _row('⭐ 宠物升星', '收集碎片升星大幅提升攻击力')
        _row('🐾 派遣修行', '离线自动产出碎片和经验')
        y += 8 * S
        ctx.fillStyle = '#a0a0a0'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('卡关时回去升星宠物、强化修炼再来挑战', cx, y)
      },
    },
  ]
}

let _helpPagesCache = null
function getHelpPages() {
  if (!_helpPagesCache) _helpPagesCache = buildHelpPages()
  return _helpPagesCache
}

function drawHelpButton(g, safeTop) {
  const { ctx, R, S, W } = V
  const btnW = 52 * S, btnH = 26 * S
  const bx = W - btnW - 10 * S
  const by = safeTop + BATTLE_HELP_BTN_BELOW_SAFE_TOP_PT * S
  g._helpBtnRect = [bx, by, btnW, btnH]

  ctx.save()
  const br = btnH / 2
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 6 * S
  ctx.shadowOffsetY = 2 * S
  ctx.fillStyle = 'rgba(28,22,14,0.92)'
  R.rr(bx, by, btnW, btnH, br); ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.strokeStyle = 'rgba(255,220,120,0.95)'; ctx.lineWidth = 2 * S
  R.rr(bx, by, btnW, btnH, br); ctx.stroke()

  const cx = bx + btnW / 2, cy = by + btnH / 2
  ctx.fillStyle = '#fff3c8'
  ctx.font = `bold ${12.5 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 2.5 * S
  ctx.strokeText('📖攻略', cx, cy)
  ctx.fillText('📖攻略', cx, cy)
  ctx.restore()
}


function drawBattleHelpPanel(g) {
  const { ctx, R, W, H, S, safeTop } = V
  if (!g._battleHelpPage) g._battleHelpPage = 0
  const pages = getHelpPages()
  const page = Math.min(g._battleHelpPage, pages.length - 1)
  const pageData = pages[page]

  ctx.save()
  // 全屏半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.78)'
  ctx.fillRect(0, 0, W, H)

  // 面板
  const panelW = W * 0.88, panelH = H * 0.62
  const panelX = (W - panelW) / 2
  const panelY = safeTop + (H - safeTop - panelH) * 0.4
  const br = 14 * S

  // 面板背景
  const grd = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  grd.addColorStop(0, 'rgba(45,35,20,0.97)')
  grd.addColorStop(1, 'rgba(30,22,12,0.97)')
  R.rr(panelX, panelY, panelW, panelH, br); ctx.fillStyle = grd; ctx.fill()
  // 边框
  ctx.strokeStyle = 'rgba(200,170,80,0.5)'; ctx.lineWidth = 1.5 * S
  R.rr(panelX, panelY, panelW, panelH, br); ctx.stroke()

  // 标题
  ctx.fillStyle = '#ffe8a0'
  ctx.font = `bold ${18 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(pageData.title, W / 2, panelY + 28 * S)

  // 分页指示器
  const dotY = panelY + panelH - 22 * S
  const dotCount = pages.length
  const dotSpacing = 16 * S
  const dotStartX = W / 2 - (dotCount - 1) * dotSpacing / 2
  for (let i = 0; i < dotCount; i++) {
    ctx.fillStyle = i === page ? '#ffe8a0' : 'rgba(200,180,120,0.3)'
    ctx.beginPath(); ctx.arc(dotStartX + i * dotSpacing, dotY, 4 * S, 0, Math.PI * 2); ctx.fill()
  }

  // 页面内容区域
  const contentCx = W / 2
  const contentCy = panelY + panelH * 0.48
  pageData.render(ctx, contentCx, contentCy, panelW, panelH, S, g)

  // 翻页箭头
  if (page > 0) {
    ctx.fillStyle = '#ffe8a0'; ctx.globalAlpha = 0.7
    ctx.font = `bold ${22 * S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('‹', panelX + 18 * S, panelY + panelH / 2)
    ctx.globalAlpha = 1
  }
  if (page < pages.length - 1) {
    ctx.fillStyle = '#ffe8a0'; ctx.globalAlpha = 0.7
    ctx.font = `bold ${22 * S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('›', panelX + panelW - 18 * S, panelY + panelH / 2)
    ctx.globalAlpha = 1
  }

  // 关闭按钮
  const closeSz = 28 * S
  const closeX = panelX + panelW - closeSz - 6 * S
  const closeY = panelY + 6 * S
  ctx.fillStyle = 'rgba(180,80,60,0.8)'
  ctx.beginPath(); ctx.arc(closeX + closeSz / 2, closeY + closeSz / 2, closeSz / 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = `bold ${14 * S}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✕', closeX + closeSz / 2, closeY + closeSz / 2)

  // 底部提示
  ctx.fillStyle = '#8a7a60'; ctx.globalAlpha = 0.6
  ctx.font = `${10 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('左右滑动翻页 · 点击空白关闭', W / 2, panelY + panelH + 20 * S)
  ctx.globalAlpha = 1

  // 存储面板区域供触摸使用
  g._helpPanelRect = [panelX, panelY, panelW, panelH]
  g._helpCloseRect = [closeX, closeY, closeSz, closeSz]
  ctx.restore()
}

module.exports = {
  drawHelpButton,
  drawBattleHelpPanel,
  get HELP_PAGE_COUNT() { return getHelpPages().length },
}
