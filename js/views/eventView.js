/**
 * 事件预览界面渲染：战斗/奇遇/商店/休息 事件详情
 * 战斗层：整合法宝切换 + 灵宠替换，支持点击快速交换，无需跳转prepare页面
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_BY, COUNTER_MAP } = require('../data/tower')
const { drawBackBtn } = require('./screens')
const { wrapText } = require('./prepareView')
const { getPetStarAtk, MAX_STAR, getPetAvatarPath, getPetSkillDesc, petHasSkill } = require('../data/pets')

// ===== 滚动状态（挂在模块级，避免每帧重置） =====
let _scrollY = 0          // 当前滚动偏移
let _scrollTouchStartY = 0
let _scrollStart = 0
let _contentH = 0         // 内容总高度
let _viewH = 0            // 可视区高度
let _lastFloor = -1       // 用于检测楼层变化时重置滚动

// ===== NEW / UP 角标绘制 =====
function _drawBadge(ctx, S, x, y, size, text, bgColor) {
  const bW = text.length > 2 ? 20*S : 16*S
  const bH = 10*S
  const bX = x + size - bW - 1*S
  const bY = y + 1*S
  ctx.save()
  ctx.fillStyle = bgColor
  ctx.beginPath()
  const r = 3*S
  ctx.moveTo(bX + r, bY); ctx.lineTo(bX + bW - r, bY)
  ctx.arcTo(bX + bW, bY, bX + bW, bY + r, r)
  ctx.lineTo(bX + bW, bY + bH - r)
  ctx.arcTo(bX + bW, bY + bH, bX + bW - r, bY + bH, r)
  ctx.lineTo(bX + r, bY + bH)
  ctx.arcTo(bX, bY + bH, bX, bY + bH - r, r)
  ctx.lineTo(bX, bY + r)
  ctx.arcTo(bX, bY, bX + r, bY, r)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${7*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, bX + bW/2, bY + bH/2)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

function rEvent(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawEventBg(g.af)
  const ev = g.curEvent
  if (!ev) return
  const padX = 12*S
  const isBattle = ev.type === 'battle' || ev.type === 'elite' || ev.type === 'boss'
  const typeName = { battle:'普通战斗', elite:'精英战斗', boss:'BOSS挑战', adventure:'奇遇', shop:'神秘商店', rest:'休息之地' }

  // 楼层切换时重置滚动
  if (g.floor !== _lastFloor) { _scrollY = 0; _lastFloor = g.floor }

  // ===== 固定顶部区域：层数标签（复用floor_label_bg） =====
  let curY = safeTop + 32*S
  ctx.textAlign = 'center'
  const floorLabelImg = R.getImg('assets/ui/floor_label_bg.png')
  const flLabelW = W * 0.45, flLabelH = flLabelW / 4
  const flLabelX = (W - flLabelW) / 2, flLabelY = curY - flLabelH * 0.7
  if (floorLabelImg && floorLabelImg.width > 0) {
    ctx.drawImage(floorLabelImg, flLabelX, flLabelY, flLabelW, flLabelH)
  }
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  ctx.fillText(`第 ${g.floor} 层`, W*0.5, curY)
  ctx.restore()
  curY += 28*S
  const evLabel = typeName[ev.type] || '未知事件'
  if (ev.type === 'boss') {
    const tagW = 140*S, tagH = 28*S, tagX = (W - tagW)/2, tagY = curY - 17*S
    ctx.fillStyle = 'rgba(180,30,30,0.85)'; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.fill()
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5*S; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.stroke()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
    ctx.fillText('⚠ ' + evLabel + ' ⚠', W*0.5, curY)
  } else if (ev.type === 'elite') {
    const tagW = 120*S, tagH = 26*S, tagX = (W - tagW)/2, tagY = curY - 16*S
    ctx.fillStyle = 'rgba(120,50,180,0.8)'; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(200,150,255,0.6)'; ctx.lineWidth = 1; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.stroke()
    ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.fillText('★ ' + evLabel, W*0.5, curY)
  } else {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3*S
    ctx.fillStyle = '#e8d8b8'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(evLabel, W*0.5, curY)
    ctx.restore()
  }
  curY += 18*S

  // 境界提升提示已移除，直接清除数据
  if (g._realmUpInfo) g._realmUpInfo = null

  // 过层经验汇总飘字（短暂显示后淡出）
  if (g._floorExpSummary && g._floorExpSummary.timer > 0) {
    const fs = g._floorExpSummary
    const fadePct = fs.timer < 30 ? fs.timer / 30 : 1
    ctx.save()
    ctx.globalAlpha = fadePct * 0.9
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#FFD700'
    ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4*S
    ctx.fillText(`上层获得经验 +${fs.amount}`, W*0.5, curY - 4*S)
    ctx.shadowBlur = 0
    ctx.restore()
  }

  // ===== 非战斗层保持原逻辑 =====
  g._eventPetRects = []
  g._eventEditPetRect = null
  g._eventEditWpnRect = null
  g._eventWpnSlots = []        // 法宝点击区域 [{rect, type:'equipped'|'bag', index}]
  g._eventPetSlots = []        // 灵宠点击区域 [{rect, type:'team'|'bag', index}]
  g._eventBagPetRects = []     // 背包灵宠区域

  if (!isBattle) {
    // === 奇遇：直接显示背景+效果+继续按钮 ===
    if (ev.type === 'adventure') {
      // 自动应用效果（仅首次）
      if (!g._adventureApplied) {
        g._applyAdventure(ev.data)
        g._adventureApplied = true
      }
      R.drawAdventureBg(g.af)
      // 重绘顶部信息（被背景覆盖）
      let ty = safeTop + 32*S
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText(`── 第 ${g.floor} 层 ──`, W*0.5, ty)
      ty += 22*S
      ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.fillText('奇遇', W*0.5, ty)

      // 文字区半透明底板，提升可读性
      const txtPanelW = W * 0.78, txtPanelH = 130*S
      const txtPanelX = (W - txtPanelW) / 2, txtPanelY = H*0.28
      ctx.save()
      ctx.fillStyle = 'rgba(20,15,10,0.55)'
      R.rr(txtPanelX, txtPanelY, txtPanelW, txtPanelH, 12*S); ctx.fill()
      ctx.restore()

      ctx.save()
      ctx.textAlign = 'center'
      // 奇遇名称 — 加粗描边增强清晰度
      ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3*S
      ctx.strokeText(ev.data.name, W*0.5, H*0.35)
      ctx.fillStyle = '#fff'
      ctx.fillText(ev.data.name, W*0.5, H*0.35)
      // 描述文字 — 增大字号并加描边
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
      ctx.strokeText(ev.data.desc, W*0.5, H*0.42)
      ctx.fillStyle = '#f0e8d8'
      ctx.fillText(ev.data.desc, W*0.5, H*0.42)
      // 显示具体获得结果（法宝名/灵兽名等）
      if (g._adventureResult) {
        ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
        ctx.strokeText(g._adventureResult, W*0.5, H*0.49)
        ctx.fillStyle = '#ffd54f'
        ctx.fillText(g._adventureResult, W*0.5, H*0.49)
      }
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
      const effectY = g._adventureResult ? H*0.56 : H*0.50
      ctx.strokeText('效果已生效！', W*0.5, effectY)
      ctx.fillStyle = '#5ddd5d'
      ctx.fillText('效果已生效！', W*0.5, effectY)
      ctx.restore()

      // 使用事件页面的按钮图片资源
      const bw = W*0.5, bh = bw / 4
      const bx = (W - bw)/2, by = H*0.65
      const btnImg = R.getImg('assets/ui/btn_start.png')
      if (btnImg && btnImg.width > 0) {
        ctx.drawImage(btnImg, bx, by, bw, bh)
      } else {
        R.drawBtn(bx, by, bw, bh, '继续', TH.accent, 16)
      }
      ctx.save()
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4*S
      ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      ctx.fillText('继续', W*0.5, by + bh*0.5)
      ctx.restore()
      g._eventBtnRect = [bx, by, bw, bh]
      drawBackBtn(g)
      return
    }

    // === 商店：4件展示，免费选1件，第2件消耗15%血量 ===
    if (ev.type === 'shop') {
      R.drawShopBg(g.af)
      // 重绘顶部
      let ty = safeTop + 32*S
      ctx.textAlign = 'center'
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3*S
      ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText(`── 第 ${g.floor} 层 ──`, W*0.5, ty)
      ctx.restore()
      ty += 22*S
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 2*S
      ctx.fillStyle = '#e8d0a0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.fillText('神秘商店', W*0.5, ty)
      ctx.restore()

      // 状态提示
      const shopUsedCount = g._eventShopUsedCount || 0
      const maxFree = 1
      let hintText = ''
      if (g._shopSelectAttr) {
        hintText = '请选择属性'
      } else if (g._shopSelectPet) {
        hintText = '请选择目标灵兽'
      } else if (shopUsedCount === 0) {
        hintText = '免费选择一件'
      } else if (shopUsedCount === 1) {
        hintText = `再选一件需消耗${15}%当前血量`
      } else {
        hintText = '已选完'
      }
      // 提示文字加底板，避免被背景装饰遮挡
      const hintY = safeTop + 116*S
      ctx.save()
      const hintW = ctx.measureText(hintText).width || W*0.5
      const hintPadX = 16*S, hintPadY = 8*S
      ctx.fillStyle = 'rgba(255,245,225,0.75)'
      R.rr(W*0.5 - hintW/2 - hintPadX, hintY - 13*S - hintPadY, hintW + hintPadX*2, 18*S + hintPadY*2, 8*S); ctx.fill()
      ctx.restore()
      ctx.fillStyle = shopUsedCount >= 2 ? 'rgba(140,120,90,0.7)' : '#5C3A1E'
      ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.fillText(hintText, W*0.5, hintY)

      // 商店UI复用奖励页素材：卷轴卡片 + 确认按钮
      const shopScrollBg = R.getImg('assets/ui/reward_card_bg.png')
      const useShopScroll = !!(shopScrollBg && shopScrollBg.width > 0)
      const rewardConfirmBtn = R.getImg('assets/ui/btn_reward_confirm.png')
      const drawShopConfirmBtn = (bx, by, bw, bh, label, disabled) => {
        const canUseImgBtn = rewardConfirmBtn && rewardConfirmBtn.width > 0
        if (canUseImgBtn) {
          ctx.save()
          if (disabled) ctx.globalAlpha = 0.55
          ctx.drawImage(rewardConfirmBtn, bx, by, bw, bh)
          ctx.fillStyle = '#4A2020'
          ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(label, bx + bw*0.5, by + bh*0.48)
          ctx.textBaseline = 'alphabetic'
          ctx.restore()
        } else {
          R.drawBtn(bx, by, bw, bh, label, disabled ? '#8f8f8f' : '#b08840', 12)
        }
      }

      const items = ev.data
      if (items && !g._shopSelectAttr && !g._shopSelectPet) {
        const cardW = W*0.84, cardH = 62*S, gap = 8*S, startY = safeTop + 156*S
        g._eventShopRects = []
        // 暖色系卡片配色（与古风背景协调）
        const RARITY_COLORS = { normal:'rgba(60,45,30,0.82)', rare:'rgba(50,40,55,0.85)', epic:'rgba(70,35,45,0.85)' }
        const RARITY_BORDERS = { normal:'rgba(200,170,110,0.45)', rare:'rgba(180,160,220,0.5)', epic:'rgba(220,140,160,0.55)' }
        const RARITY_LABELS = { normal:'', rare:'稀有', epic:'史诗' }
        items.forEach((item, i) => {
          const cy = startY + i*(cardH+gap)
          const isUsed = g._eventShopUsedItems && g._eventShopUsedItems.includes(i)
          const canBuy = !isUsed && shopUsedCount < 2
          if (useShopScroll) {
            const scrollPadX = 6*S
            const scrollX = W*0.08 - scrollPadX
            const scrollW = cardW + scrollPadX*2
            ctx.save()
            if (isUsed) ctx.globalAlpha = 0.58
            ctx.shadowColor = 'rgba(60,40,15,0.28)'
            ctx.shadowBlur = 8*S
            ctx.shadowOffsetY = 2*S
            ctx.drawImage(shopScrollBg, scrollX, cy, scrollW, cardH)
            ctx.restore()
          } else {
            ctx.fillStyle = isUsed ? 'rgba(50,40,30,0.6)' : (RARITY_COLORS[item.rarity] || 'rgba(60,45,30,0.82)')
            R.rr(W*0.08, cy, cardW, cardH, 8*S); ctx.fill()
            ctx.strokeStyle = isUsed ? 'rgba(120,100,70,0.25)' : (RARITY_BORDERS[item.rarity] || 'rgba(200,170,110,0.4)')
            ctx.lineWidth = 1*S
            R.rr(W*0.08, cy, cardW, cardH, 8*S); ctx.stroke()
          }

          // 稀有度标签（卡片左侧外挂角标，不与名称重叠）
          const rarityLabel = RARITY_LABELS[item.rarity]
          const hasTag = !!rarityLabel && !isUsed
          const nameIndent = W*0.08 + 14*S  // 默认名称起点
          let nameX = nameIndent
          if (hasTag) {
            ctx.save()
            ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
            const tagText = rarityLabel
            const tagW = ctx.measureText(tagText).width + 14*S
            const tagH = 18*S
            const tagX = W*0.08, tagY = cy
            // 左上角标签条（圆角左上+右下）
            ctx.beginPath()
            ctx.moveTo(tagX + 8*S, tagY)
            ctx.lineTo(tagX + tagW, tagY)
            ctx.lineTo(tagX + tagW, tagY + tagH - 4*S)
            ctx.quadraticCurveTo(tagX + tagW, tagY + tagH, tagX + tagW - 4*S, tagY + tagH)
            ctx.lineTo(tagX + 8*S, tagY + tagH)
            ctx.lineTo(tagX + 8*S, tagY)
            ctx.closePath()
            ctx.fillStyle = item.rarity === 'epic' ? 'rgba(180,60,90,0.92)' : 'rgba(80,70,160,0.92)'
            ctx.fill()
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
            ctx.fillText(tagText, tagX + 8*S + (tagW - 8*S)/2, tagY + tagH*0.68)
            ctx.restore()
            nameX = tagX + tagW + 6*S  // 名称右移，避开标签
          }

          // 名称和描述
          ctx.globalAlpha = isUsed ? 0.4 : 1
          ctx.fillStyle = isUsed ? 'rgba(95,78,58,0.5)' : (useShopScroll ? '#2F2117' : '#f5e6c8')
          ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
          ctx.fillText(item.name, nameX, cy + 24*S)
          ctx.fillStyle = isUsed ? 'rgba(110,95,75,0.45)' : (useShopScroll ? '#4A3A2E' : 'rgba(220,200,170,0.75)')
          ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.fillText(item.desc, nameIndent, cy + 42*S)

          // 费用标签（右侧，留出卷轴边框空间）
          const costX = W*0.08 + cardW - 28*S
          ctx.textAlign = 'right'
          if (isUsed) {
            ctx.fillStyle = useShopScroll ? 'rgba(110,95,75,0.7)' : 'rgba(180,160,130,0.5)'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
            ctx.fillText('已选', costX, cy + 34*S)
          } else if (shopUsedCount === 0) {
            ctx.fillStyle = useShopScroll ? '#9B6A00' : '#e0c060'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
            ctx.fillText('免费', costX, cy + 34*S)
          } else if (shopUsedCount === 1) {
            ctx.fillStyle = useShopScroll ? '#B14A2C' : '#e07050'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
            ctx.fillText(`-${15}%血`, costX, cy + 34*S)
          }
          ctx.globalAlpha = 1
          ctx.textAlign = 'center'

          if (canBuy) {
            g._eventShopRects.push([W*0.08, cy, cardW, cardH])
          } else {
            g._eventShopRects.push(null)  // 占位
          }
        })
      }

      // === 属性选择面板（灵兽招募时弹出，点击选中+确认流程） ===
      if (g._shopSelectAttr) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H)
        const selectedAttr = g._shopAttrSelectedVal  // 当前选中的属性（undefined=未选）
        const hasAttrSelected = !!selectedAttr
        const panelW = W*0.8, panelH = hasAttrSelected ? 190*S : 160*S
        const panelX = (W - panelW)/2, panelY = H*0.33
        R.drawInfoPanel(panelX, panelY, panelW, panelH)

        ctx.fillStyle = '#5C3A1E'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('选择灵兽属性', W*0.5, panelY + 28*S)

        const attrs = ['metal','wood','water','fire','earth']
        const attrNames = { metal:'金', wood:'木', water:'水', fire:'火', earth:'土' }
        const btnW = 48*S, btnH = 48*S, btnGap = 8*S
        const totalBtnW = attrs.length * btnW + (attrs.length - 1) * btnGap
        const btnStartX = (W - totalBtnW) / 2
        const btnY = panelY + 52*S
        g._shopAttrRects = []
        attrs.forEach((attr, i) => {
          const bx = btnStartX + i * (btnW + btnGap)
          const ac = ATTR_COLOR[attr]
          const isAttrSel = (selectedAttr === attr)
          ctx.fillStyle = isAttrSel ? 'rgba(255,245,220,0.85)' : 'rgba(245,235,215,0.6)'
          R.rr(bx, btnY, btnW, btnH, 8*S); ctx.fill()
          if (isAttrSel) {
            ctx.save()
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3*S
            ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8*S
            R.rr(bx, btnY, btnW, btnH, 8*S); ctx.stroke()
            ctx.restore()
          } else {
            ctx.strokeStyle = ac ? ac.main : '#999'; ctx.lineWidth = 1.5*S
            R.rr(bx, btnY, btnW, btnH, 8*S); ctx.stroke()
          }
          // 属性球
          R.drawBead(bx + btnW/2, btnY + btnH*0.35, 10*S, attr, 0)
          ctx.fillStyle = ac ? ac.dk : '#666'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(attrNames[attr], bx + btnW/2, btnY + btnH*0.82)
          g._shopAttrRects.push([bx, btnY, btnW, btnH, attr])
        })

        // 按钮区：取消 + 确认（选中后才显示确认）
        const attrBtnAreaY = btnY + btnH + 16*S
        if (hasAttrSelected) {
          const confirmW = 80*S, confirmH = 32*S, cancelW = 80*S, cancelH = 32*S, btnGapX = 20*S
          const totalBW = confirmW + cancelW + btnGapX
          const startBX = (W - totalBW) / 2
          R.drawBtn(startBX, attrBtnAreaY, cancelW, cancelH, '取消', '#a0896a', 12)
          g._shopAttrCancelRect = [startBX, attrBtnAreaY, cancelW, cancelH]
          drawShopConfirmBtn(startBX + cancelW + btnGapX, attrBtnAreaY, confirmW, confirmH, '确定', false)
          g._shopAttrConfirmRect = [startBX + cancelW + btnGapX, attrBtnAreaY, confirmW, confirmH]
        } else {
          const cancelW = 80*S, cancelH = 32*S
          R.drawBtn((W-cancelW)/2, attrBtnAreaY, cancelW, cancelH, '取消', '#a0896a', 12)
          g._shopAttrCancelRect = [(W-cancelW)/2, attrBtnAreaY, cancelW, cancelH]
          g._shopAttrConfirmRect = null
        }
      }

      // === 灵兽选择面板（升星/强化/减CD时弹出，点击选中+确认流程） ===
      if (g._shopSelectPet) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H)
        const selectedIdx = g._shopPetSelectedIdx  // 当前选中的灵兽index（undefined=未选）
        const hasSelected = selectedIdx != null
        // 面板高度动态计算：标题28 + 间距20 + 灵兽行(48+24) + 间距 + [详情56] + 按钮36 + 底部间距
        const panelW = W*0.85
        const basePanelH = hasSelected ? (48*S + 48*S + 24*S + 30*S + 56*S + 40*S + 20*S) : (48*S + 48*S + 24*S + 30*S + 40*S + 16*S)
        const panelX = (W - panelW)/2, panelY = H*0.22
        R.drawInfoPanel(panelX, panelY, panelW, basePanelH)

        const selectType = g._shopSelectPet.type  // 'starUp' | 'upgradePet' | 'cdReduce'
        const titleMap = { starUp:'选择灵兽升星', upgradePet:'选择灵兽强化', cdReduce:'选择灵兽减CD' }
        ctx.fillStyle = '#5C3A1E'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(titleMap[selectType] || '选择灵兽', W*0.5, panelY + 28*S)

        const petSlotSz = 48*S, petGap2 = 10*S
        const petsPerRow = Math.min(g.pets.length, 5)
        const totalPetW = petsPerRow * petSlotSz + (petsPerRow - 1) * petGap2
        const petStartX = (W - totalPetW) / 2
        const petRowY = panelY + 48*S
        g._shopPetRects = []
        const framePetMap2 = {
          metal: R.getImg('assets/ui/frame_pet_metal.png'),
          wood:  R.getImg('assets/ui/frame_pet_wood.png'),
          water: R.getImg('assets/ui/frame_pet_water.png'),
          fire:  R.getImg('assets/ui/frame_pet_fire.png'),
          earth: R.getImg('assets/ui/frame_pet_earth.png'),
        }
        g.pets.forEach((p, i) => {
          const px = petStartX + i * (petSlotSz + petGap2)
          const py2 = petRowY
          const ac2 = ATTR_COLOR[p.attr]

          // 判断能否选择
          let canSelect = true
          let dimReason = ''
          if (selectType === 'starUp' && (p.star || 1) >= 3) { canSelect = false; dimReason = '已满星' }
          if (selectType === 'cdReduce' && p.cd <= 2) { canSelect = false; dimReason = 'CD已最低' }

          const isSelected = (selectedIdx === i)

          ctx.globalAlpha = canSelect ? 1 : 0.4
          ctx.fillStyle = ac2 ? ac2.bg : '#1a1a2e'
          ctx.fillRect(px, py2, petSlotSz, petSlotSz)
          const petAvatar = R.getImg(getPetAvatarPath(p))
          if (petAvatar && petAvatar.width > 0) {
            ctx.save()
            ctx.beginPath(); ctx.rect(px+1, py2+1, petSlotSz-2, petSlotSz-2); ctx.clip()
            const aw = petAvatar.width, ah = petAvatar.height
            const dw = petSlotSz-2, dh = dw*(ah/aw)
            ctx.drawImage(petAvatar, px+1, py2+1+(petSlotSz-2-dh), dw, dh)
            ctx.restore()
          }
          const pf = framePetMap2[p.attr]
          if (pf && pf.width > 0) {
            const fs = petSlotSz*1.12, fo = (fs-petSlotSz)/2
            ctx.drawImage(pf, px-fo, py2-fo, fs, fs)
          }
          // 选中高亮边框
          if (isSelected) {
            ctx.save()
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3*S
            ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8*S
            R.rr(px-2*S, py2-2*S, petSlotSz+4*S, petSlotSz+4*S, 4*S); ctx.stroke()
            ctx.restore()
          }
          // 星级
          if ((p.star||1) >= 1) {
            ctx.save()
            ctx.font = `bold ${petSlotSz*0.14}px "PingFang SC",sans-serif`
            ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
            ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
            ctx.strokeText('★'.repeat(p.star), px+2*S, py2+petSlotSz-2*S)
            ctx.fillStyle = '#ffd700'
            ctx.fillText('★'.repeat(p.star), px+2*S, py2+petSlotSz-2*S)
            ctx.textBaseline = 'alphabetic'
            ctx.restore()
          }
          ctx.globalAlpha = 1

          // 名字和信息
          ctx.fillStyle = canSelect ? (ac2 ? ac2.main : '#8B6914') : 'rgba(180,160,130,0.5)'
          ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          ctx.fillText(p.name.substring(0,4), px+petSlotSz/2, py2+petSlotSz+12*S)
          if (selectType === 'starUp') {
            ctx.fillStyle = canSelect ? '#c09830' : 'rgba(180,160,130,0.5)'; ctx.font = `${7*S}px "PingFang SC",sans-serif`
            ctx.fillText(canSelect ? `★${p.star||1}→★${(p.star||1)+1}` : dimReason, px+petSlotSz/2, py2+petSlotSz+22*S)
          } else if (selectType === 'upgradePet') {
            ctx.fillStyle = '#c07030'; ctx.font = `${7*S}px "PingFang SC",sans-serif`
            ctx.fillText(`ATK:${p.atk}→${Math.round(p.atk*1.25)}`, px+petSlotSz/2, py2+petSlotSz+22*S)
          } else if (selectType === 'cdReduce') {
            ctx.fillStyle = canSelect ? '#508090' : 'rgba(180,160,130,0.5)'; ctx.font = `${7*S}px "PingFang SC",sans-serif`
            ctx.fillText(canSelect ? `CD:${p.cd}→${p.cd-1}` : dimReason, px+petSlotSz/2, py2+petSlotSz+22*S)
          }

          if (canSelect) {
            g._shopPetRects.push([px, py2, petSlotSz, petSlotSz, i])
          }
        })

        // 选中后显示详情描述区
        let bottomY = petRowY + petSlotSz + 30*S
        if (hasSelected && g.pets[selectedIdx]) {
          const sp = g.pets[selectedIdx]
          const descY = petRowY + petSlotSz + 30*S
          ctx.save()
          ctx.fillStyle = 'rgba(92,58,30,0.12)'
          R.rr(panelX + 12*S, descY, panelW - 24*S, 48*S, 6*S); ctx.fill()
          ctx.restore()
          ctx.textAlign = 'center'
          ctx.fillStyle = '#5C3A1E'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
          let detailText = sp.name
          if (selectType === 'starUp') detailText += `  ★${sp.star||1} → ★${(sp.star||1)+1}`
          else if (selectType === 'upgradePet') detailText += `  ATK ${sp.atk} → ${Math.round(sp.atk*1.25)}`
          else if (selectType === 'cdReduce') detailText += `  CD ${sp.cd} → ${sp.cd-1}`
          ctx.fillText(detailText, W*0.5, descY + 18*S)
          ctx.fillStyle = 'rgba(92,58,30,0.6)'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
          const skillDesc = sp.skillDesc || (sp.skill && sp.skill.desc) || ''
          ctx.fillText(String(skillDesc).substring(0, 30), W*0.5, descY + 35*S)
          bottomY = descY + 56*S
        }

        // 按钮区：取消 + 确认（选中后才显示确认）
        const btnAreaY = bottomY + 4*S
        if (hasSelected) {
          const confirmW = 80*S, confirmH = 32*S, cancelW2 = 80*S, cancelH2 = 32*S, btnGapX = 20*S
          const totalW = confirmW + cancelW2 + btnGapX
          const startBtnX = (W - totalW) / 2
          R.drawBtn(startBtnX, btnAreaY, cancelW2, cancelH2, '取消', '#a0896a', 12)
          g._shopPetCancelRect = [startBtnX, btnAreaY, cancelW2, cancelH2]
          drawShopConfirmBtn(startBtnX + cancelW2 + btnGapX, btnAreaY, confirmW, confirmH, '确定', false)
          g._shopPetConfirmRect = [startBtnX + cancelW2 + btnGapX, btnAreaY, confirmW, confirmH]
        } else {
          const cancelW2 = 80*S, cancelH2 = 32*S
          R.drawBtn((W-cancelW2)/2, btnAreaY, cancelW2, cancelH2, '取消', '#a0896a', 12)
          g._shopPetCancelRect = [(W-cancelW2)/2, btnAreaY, cancelW2, cancelH2]
          g._shopPetConfirmRect = null
        }
      }

      const bx = W*0.3, by = H*0.88, bw = W*0.4, bh = 40*S
      if (!g._shopSelectAttr && !g._shopSelectPet) {
        drawShopConfirmBtn(bx, by, bw, bh, '离开', false)
        g._eventBtnRect = [bx, by, bw, bh]
      } else {
        g._eventBtnRect = null
      }
      drawBackBtn(g)
      return
    }

    // === 休息：直接显示选项卡片 ===
    if (ev.type === 'rest') {
      R.drawRestBg(g.af)
      // 重绘顶部
      let ty = safeTop + 32*S
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText(`── 第 ${g.floor} 层 ──`, W*0.5, ty)
      ty += 22*S
      ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.fillText('休息之地', W*0.5, ty)

      const opts = ev.data
      if (opts) {
        const cardW = W*0.7, cardH = 65*S, gap = 16*S, startY = H*0.3
        g._eventRestRects = []
        opts.forEach((opt, i) => {
          const cy = startY + i*(cardH+gap)
          ctx.fillStyle = TH.card; R.rr(W*0.15, cy, cardW, cardH, 8*S); ctx.fill()
          ctx.fillStyle = TH.text; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          ctx.fillText(opt.name, W*0.5, cy + 28*S)
          ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`
          ctx.fillText(opt.desc, W*0.5, cy + 48*S)
          g._eventRestRects.push([W*0.15, cy, cardW, cardH])
        })
      }
      g._eventBtnRect = null
      drawBackBtn(g)
      return
    }

    // 其他未知非战斗事件（fallback）
    const goBtnW = W*0.55, goBtnH = 44*S
    const goBtnX = (W - goBtnW)/2, goBtnY = curY
    R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '进入', TH.accent, 16)
    g._eventBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]
    drawBackBtn(g)
    return
  }

  // ===== 战斗层：新的一体化界面 =====
  const e = ev.data
  const ac = ATTR_COLOR[e.attr]

  // --- 敌人信息卡（紧凑版） ---
  const cardX = padX, cardW = W - padX*2, cardTop = curY, cardH = 90*S
  ctx.fillStyle = 'rgba(45,30,18,0.85)'
  R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.fill()
  ctx.strokeStyle = ac ? ac.main + '55' : 'rgba(180,150,90,0.3)'; ctx.lineWidth = 1.5*S
  R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.stroke()

  const avatarSize = 60*S
  const avatarX = cardX + 12*S
  const avatarY = cardTop + (cardH - avatarSize) / 2
  ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
  R.rr(avatarX, avatarY, avatarSize, avatarSize, 6*S); ctx.fill()
  const avatarPath = e.avatar ? e.avatar + '.png' : null
  const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
  if (enemyImg && enemyImg.width > 0) {
    ctx.save()
    ctx.beginPath(); R.rr(avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2, 5*S); ctx.clip()
    // 保持原图比例居中绘制（contain模式）
    const iRatio = enemyImg.width / enemyImg.height
    const boxW = avatarSize - 2, boxH = avatarSize - 2
    let dw, dh
    if (iRatio > 1) { dw = boxW; dh = boxW / iRatio }
    else { dh = boxH; dw = boxH * iRatio }
    const dx = avatarX + 1 + (boxW - dw) / 2
    const dy = avatarY + 1 + (boxH - dh) / 2
    ctx.drawImage(enemyImg, dx, dy, dw, dh)
    ctx.restore()
  }
  ctx.strokeStyle = ac ? ac.main : '#666'; ctx.lineWidth = 1.5*S
  R.rr(avatarX, avatarY, avatarSize, avatarSize, 6*S); ctx.stroke()

  const infoX = avatarX + avatarSize + 12*S
  let infoY = cardTop + 24*S
  ctx.textAlign = 'left'
  ctx.fillStyle = '#FFF2D0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(e.name, infoX, infoY)
  infoY += 20*S
  // 属性文字
  ctx.fillStyle = 'rgba(230,215,180,0.85)'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`${ATTR_NAME[e.attr]}属性`, infoX, infoY)
  // 弱点 & 抵抗（下一行，用属性球，增大显示）
  infoY += 22*S
  const orbR2 = 8*S
  let bx = infoX
  const weakAttr = COUNTER_BY[e.attr]
  if (weakAttr) {
    ctx.fillStyle = 'rgba(220,200,160,0.85)'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.fillText('弱点:', bx, infoY)
    bx += ctx.measureText('弱点:').width + 5*S
    // 弱点球发光特效
    ctx.save()
    const _af = g.af || 0
    const glowAlpha = 0.4 + 0.3 * Math.sin(_af * 0.08)
    ctx.shadowColor = (ATTR_COLOR[weakAttr] && ATTR_COLOR[weakAttr].main) || '#fff'
    ctx.shadowBlur = 10*S * glowAlpha
    R.drawBead(bx + orbR2, infoY - 4*S, orbR2, weakAttr, 0)
    ctx.shadowBlur = 0
    // 外圈脉冲光环
    ctx.globalAlpha = glowAlpha * 0.5
    ctx.strokeStyle = (ATTR_COLOR[weakAttr] && ATTR_COLOR[weakAttr].lt) || '#fff'
    ctx.lineWidth = 1.5*S
    ctx.beginPath(); ctx.arc(bx + orbR2, infoY - 4*S, orbR2 + 3*S, 0, Math.PI*2); ctx.stroke()
    ctx.restore()
    bx += orbR2*2 + 14*S
  }
  const resistAttr = COUNTER_MAP[e.attr]
  if (resistAttr) {
    ctx.fillStyle = 'rgba(190,175,145,0.7)'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.fillText('抵抗:', bx, infoY)
    bx += ctx.measureText('抵抗:').width + 5*S
    R.drawBead(bx + orbR2, infoY - 4*S, orbR2, resistAttr, 0)
  }
  curY = cardTop + cardH + 8*S

  // ===== 怪物区与己方区域分界线 =====
  ctx.save()
  const divLineY = curY
  const divGrad = ctx.createLinearGradient(padX, 0, W - padX, 0)
  divGrad.addColorStop(0, 'rgba(180,160,120,0)')
  divGrad.addColorStop(0.2, 'rgba(180,160,120,0.5)')
  divGrad.addColorStop(0.5, 'rgba(220,200,160,0.6)')
  divGrad.addColorStop(0.8, 'rgba(180,160,120,0.5)')
  divGrad.addColorStop(1, 'rgba(180,160,120,0)')
  ctx.strokeStyle = divGrad
  ctx.lineWidth = 1.5*S
  ctx.beginPath()
  ctx.moveTo(padX, divLineY)
  ctx.lineTo(W - padX, divLineY)
  ctx.stroke()
  ctx.restore()
  curY += 16*S

  // ===== 己方队伍标题 =====
  ctx.textAlign = 'center'
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(25,14,10,0.85)'
  ctx.lineWidth = 3 * S
  ctx.fillStyle = '#EED6AE'
  ctx.strokeText('── 己方队伍 ──', W*0.5, curY)
  ctx.fillText('── 己方队伍 ──', W*0.5, curY)
  curY += 14*S

  // --- HP条 ---
  const hpBarH = 14*S
  R.drawHp(padX, curY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', null, true, '#4dcc4d', g.heroShield)
  curY += hpBarH + 10*S

  // ===== 全局增益buff文字描述 =====
  if (g.runBuffLog && g.runBuffLog.length > 0) {
    const BUFF_FULL_LABELS = {
      allAtkPct:'全队攻击', allDmgPct:'全属性伤害', heartBoostPct:'心珠回复', weaponBoostPct:'法宝效果',
      extraTimeSec:'转珠时间', hpMaxPct:'血量上限', comboDmgPct:'Combo伤害', elim3DmgPct:'3消伤害',
      elim4DmgPct:'4消伤害', elim5DmgPct:'5消伤害', counterDmgPct:'克制伤害', skillDmgPct:'技能伤害',
      skillCdReducePct:'技能CD缩短', regenPerTurn:'每回合回血', dmgReducePct:'受伤减少',
      bonusCombo:'额外连击', stunDurBonus:'眩晕延长', enemyAtkReducePct:'怪物攻击降低',
      enemyHpReducePct:'怪物血量降低', enemyDefReducePct:'怪物防御降低',
      eliteAtkReducePct:'精英攻击降低', eliteHpReducePct:'精英血量降低',
      bossAtkReducePct:'BOSS攻击降低', bossHpReducePct:'BOSS血量降低',
      nextDmgReducePct:'下场受伤减少', postBattleHealPct:'战后回血', extraRevive:'额外复活',
    }
    const DEBUFF_KEYS = ['enemyAtkReducePct','enemyHpReducePct','enemyDefReducePct',
      'eliteAtkReducePct','eliteHpReducePct','bossAtkReducePct','bossHpReducePct']
    const merged = {}
    for (const entry of g.runBuffLog) {
      const k = entry.buff
      if (!merged[k]) merged[k] = { buff: k, val: 0 }
      merged[k].val += entry.val
    }
    const buffItems = Object.values(merged)
    if (buffItems.length > 0) {
      const texts = buffItems.map(it => {
        const name = BUFF_FULL_LABELS[it.buff] || it.buff
        const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}s` :
                       it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                       `${it.val > 0 ? '+' : ''}${it.val}%`
        return { text: `${name}${valTxt}`, isDebuff: DEBUFF_KEYS.includes(it.buff) }
      })
      const fontSize = 8*S
      ctx.font = `bold ${fontSize}px "PingFang SC",sans-serif`
      const sep = '  '
      const sepW = ctx.measureText(sep).width
      const rowH = fontSize + 8*S
      const maxW = W - padX * 2
      const rows = []
      let row = []
      let rowW = 0
      for (const t of texts) {
        const tw = ctx.measureText(t.text).width
        const needed = row.length > 0 ? sepW + tw : tw
        if (row.length > 0 && rowW + needed > maxW) {
          rows.push(row)
          row = [t]
          rowW = tw
        } else {
          row.push(t)
          rowW += needed
        }
      }
      if (row.length > 0) rows.push(row)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let r = 0; r < rows.length; r++) {
        const items = rows[r]
        const lineText = items.map(t => t.text).join(sep)
        const lineW = ctx.measureText(lineText).width
        let dx = (W - lineW) / 2
        const dy = curY + r * rowH + rowH / 2
        for (let i = 0; i < items.length; i++) {
          if (i > 0) dx += ctx.measureText(sep).width
          const tw = ctx.measureText(items[i].text).width
          ctx.fillStyle = items[i].isDebuff ? '#C0392B' : '#27864A'
          ctx.textAlign = 'left'
          ctx.fillText(items[i].text, dx, dy)
          dx += tw
        }
      }
      ctx.textAlign = 'center'
      curY += rows.length * rowH + 2*S
    }
  }

  // ===== 当前队伍：法宝 + 灵宠（一行，参考战斗界面 drawTeamBar 布局） =====
  const drag = g._eventDragPet
  const teamSlots = 6
  const teamSidePad = 8*S
  const teamPetGap = 8*S
  const teamWpnGap = 12*S
  const teamTotalGapW = teamWpnGap + teamPetGap * 4 + teamSidePad * 2
  const teamIconSize = (W - teamTotalGapW) / teamSlots
  const teamBarH = teamIconSize + 6*S
  const teamBarY = curY
  const teamIconY = teamBarY + (teamBarH - teamIconSize) / 2

  // 队伍栏背景
  ctx.fillStyle = 'rgba(40,28,15,0.82)'
  R.rr(0, teamBarY, W, teamBarH, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(180,150,90,0.25)'; ctx.lineWidth = 1*S
  R.rr(0, teamBarY, W, teamBarH, 6*S); ctx.stroke()

  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }
  const frameScale = 1.12
  const frameSize = teamIconSize * frameScale
  const frameOff = (frameSize - teamIconSize) / 2

  for (let i = 0; i < teamSlots; i++) {
    let ix
    if (i === 0) {
      ix = teamSidePad
    } else {
      ix = teamSidePad + teamIconSize + teamWpnGap + (i - 1) * (teamIconSize + teamPetGap)
    }
    const cx = ix + teamIconSize * 0.5
    const cy = teamIconY + teamIconSize * 0.5

    if (i === 0) {
      // === 法宝槽 ===
      const isWpnDragSrc = g._eventDragWpn && g._eventDragWpn.source === 'equipped'
      if (isWpnDragSrc) ctx.globalAlpha = 0.3
      ctx.fillStyle = g.weapon ? 'rgba(60,45,25,0.9)' : 'rgba(50,38,20,0.7)'
      ctx.fillRect(ix + 1, teamIconY + 1, teamIconSize - 2, teamIconSize - 2)
      if (g.weapon) {
        const wpnImg = R.getImg(`assets/equipment/fabao_${g.weapon.id}.png`)
        ctx.save()
        ctx.beginPath(); ctx.rect(ix + 1, teamIconY + 1, teamIconSize - 2, teamIconSize - 2); ctx.clip()
        if (wpnImg && wpnImg.width > 0) {
          ctx.drawImage(wpnImg, ix + 1, teamIconY + 1, teamIconSize - 2, teamIconSize - 2)
        }
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(140,120,80,0.4)'
        ctx.font = `${teamIconSize*0.26}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', cx, cy)
      }
      // 法宝金色边框
      R.drawWeaponFrame(ix, teamIconY, teamIconSize)
      // NEW 角标：本次奖励获得的新法宝
      if (g._lastRewardInfo && g._lastRewardInfo.type === 'newWeapon' && g.weapon && g.weapon.id === g._lastRewardInfo.weaponId) {
        _drawBadge(ctx, S, ix, teamIconY, teamIconSize, 'NEW', '#e04040')
      }
      g._eventWpnSlots.push({ rect: [ix, teamIconY, teamIconSize, teamIconSize], action: 'detail', type: 'equipped', index: 0 })
      if (isWpnDragSrc) ctx.globalAlpha = 1
    } else {
      // === 宠物槽 ===
      const petIdx = i - 1
      const petFrame = petIdx < g.pets.length
        ? (framePetMap[g.pets[petIdx].attr] || framePetMap.metal)
        : framePetMap.metal
      if (petIdx < g.pets.length) {
        const p = g.pets[petIdx]
        const ac2 = ATTR_COLOR[p.attr]
        ctx.fillStyle = ac2 ? ac2.bg : '#1a1a2e'
        ctx.fillRect(ix + 1, teamIconY + 1, teamIconSize - 2, teamIconSize - 2)
        const petAvatar = R.getImg(getPetAvatarPath(p))
        if (petAvatar && petAvatar.width > 0) {
          const aw = petAvatar.width, ah = petAvatar.height
          const drawW = teamIconSize - 2, drawH = drawW * (ah / aw)
          const dy = teamIconY + 1 + (teamIconSize - 2) - drawH
          ctx.save()
          ctx.beginPath(); ctx.rect(ix + 1, teamIconY + 1, teamIconSize - 2, teamIconSize - 2); ctx.clip()
          ctx.drawImage(petAvatar, ix + 1, dy, drawW, drawH)
          ctx.restore()
        }
        if (petFrame && petFrame.width > 0) {
          ctx.drawImage(petFrame, ix - frameOff, teamIconY - frameOff, frameSize, frameSize)
        }
        // 星级标记（左下角）
        if ((p.star || 1) >= 1) {
          const starText = '★'.repeat(p.star || 1)
          ctx.save()
          ctx.font = `bold ${teamIconSize * 0.14}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
          ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
          ctx.strokeText(starText, ix + 2*S, teamIconY + teamIconSize - 2*S)
          ctx.fillStyle = '#ffd700'
          ctx.fillText(starText, ix + 2*S, teamIconY + teamIconSize - 2*S)
          ctx.textBaseline = 'alphabetic'
          ctx.restore()
        }
        // NEW / UP 角标
        const ri = g._lastRewardInfo
        if (ri && ri.petId === p.id) {
          if (ri.type === 'newPet') _drawBadge(ctx, S, ix, teamIconY, teamIconSize, 'NEW', '#e04040')
          else if (ri.type === 'starUp') _drawBadge(ctx, S, ix, teamIconY, teamIconSize, 'UP', '#30b050')
        }
        // 弱点属性高亮：敌人弱点对应属性的宠物闪烁边框提醒
        const _weakAttr = COUNTER_BY[e.attr]
        if (_weakAttr && p.attr === _weakAttr) {
          const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.08)
          const wac = ATTR_COLOR[_weakAttr]
          ctx.save()
          ctx.strokeStyle = wac ? wac.main : '#4dff4d'
          ctx.lineWidth = 2.5*S
          ctx.globalAlpha = 0.4 + 0.6 * pulse
          ctx.strokeRect(ix - 1, teamIconY - 1, teamIconSize + 2, teamIconSize + 2)
          ctx.restore()
        }
      } else {
        ctx.fillStyle = 'rgba(50,38,20,0.5)'
        ctx.fillRect(ix + 1, teamIconY + 1, teamIconSize - 2, teamIconSize - 2)
        if (petFrame && petFrame.width > 0) {
          ctx.save(); ctx.globalAlpha = 0.35
          ctx.drawImage(petFrame, ix - frameOff, teamIconY - frameOff, frameSize, frameSize)
          ctx.restore()
        }
      }
      g._eventPetSlots.push({ rect: [ix, teamIconY, teamIconSize, teamIconSize], type: 'team', index: petIdx })
      g._eventPetRects.push([ix, teamIconY, teamIconSize, teamIconSize])
      // 拖拽悬停高亮：当从背包拖到队伍上时
      if (drag && drag.source === 'bag') {
        if (g._hitRect && g._hitRect(drag.x, drag.y, ix, teamIconY, teamIconSize, teamIconSize)) {
          ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
          ctx.strokeRect(ix - 1, teamIconY - 1, teamIconSize + 2, teamIconSize + 2)
        }
      }
    }
  }
  curY = teamBarY + teamBarH + 8*S

  // ===== 队伍与背包分界线 =====
  ctx.save()
  const bagDivY = curY
  const bagDivGrad = ctx.createLinearGradient(padX, 0, W - padX, 0)
  bagDivGrad.addColorStop(0, 'rgba(180,160,120,0)')
  bagDivGrad.addColorStop(0.2, 'rgba(180,160,120,0.35)')
  bagDivGrad.addColorStop(0.5, 'rgba(200,180,140,0.4)')
  bagDivGrad.addColorStop(0.8, 'rgba(180,160,120,0.35)')
  bagDivGrad.addColorStop(1, 'rgba(180,160,120,0)')
  ctx.strokeStyle = bagDivGrad
  ctx.lineWidth = 1*S
  ctx.beginPath()
  ctx.moveTo(padX, bagDivY)
  ctx.lineTo(W - padX, bagDivY)
  ctx.stroke()
  ctx.restore()
  // 拉开队伍区与背包区间距，避免视觉拥挤
  curY += 18*S

  // ===== 背包区 =====
  const bagCols = 6
  const bagGap = teamPetGap
  const bagSlotSize = teamIconSize
  const petSidePad = padX

  // --- 法宝背包 ---
  ctx.textAlign = 'center'
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(25,14,10,0.85)'
  ctx.lineWidth = 3 * S
  ctx.fillStyle = '#EED6AE'
  ctx.strokeText('── 法宝背包 ──', W*0.5, curY)
  ctx.fillText('── 法宝背包 ──', W*0.5, curY)
  curY += 14*S
  ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(20,12,8,0.8)'
  ctx.lineWidth = 2 * S
  ctx.fillStyle = '#DCC39A'
  ctx.strokeText('拖动到上方可替换装备', W*0.5, curY)
  ctx.fillText('拖动到上方可替换装备', W*0.5, curY)
  curY += 10*S
  if (g.weaponBag.length > 0) {
    for (let i = 0; i < g.weaponBag.length; i++) {
      const col = i % bagCols
      const row = Math.floor(i / bagCols)
      const bx = teamSidePad + col*(bagSlotSize+bagGap)
      const by = curY + row*(bagSlotSize+bagGap)
      const wp = g.weaponBag[i]
      const isWBDragSrc = g._eventDragWpn && g._eventDragWpn.source === 'bag' && g._eventDragWpn.index === i
      if (isWBDragSrc) ctx.globalAlpha = 0.3
      ctx.fillStyle = 'rgba(55,40,22,0.7)'
      ctx.fillRect(bx+1, by+1, bagSlotSize-2, bagSlotSize-2)
      const wImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
      if (wImg && wImg.width > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(bx+1, by+1, bagSlotSize-2, bagSlotSize-2); ctx.clip()
        const aw = wImg.width, ah = wImg.height
        const dw = bagSlotSize - 2, dh = dw * (ah / aw)
        ctx.drawImage(wImg, bx+1, by+1+(bagSlotSize-2-dh), dw, dh)
        ctx.restore()
      }
      R.drawWeaponFrame(bx, by, bagSlotSize)
      // NEW 角标：本次奖励获得的新法宝
      if (g._lastRewardInfo && g._lastRewardInfo.type === 'newWeapon' && wp.id === g._lastRewardInfo.weaponId) {
        _drawBadge(ctx, S, bx, by, bagSlotSize, 'NEW', '#e04040')
      }
      if (isWBDragSrc) ctx.globalAlpha = 1
      g._eventWpnSlots.push({ rect: [bx, by, bagSlotSize, bagSlotSize], action: 'equip', type: 'bag', index: i })
    }
    const wpnRows = Math.ceil(g.weaponBag.length / bagCols)
    curY += wpnRows * (bagSlotSize + bagGap) + 6*S
  } else {
    ctx.textAlign = 'center'
    ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.strokeStyle = 'rgba(20,12,8,0.8)'
    ctx.lineWidth = 2 * S
    ctx.fillStyle = '#D2B48A'
    ctx.strokeText('空', W*0.5, curY + bagSlotSize*0.4)
    ctx.fillText('空', W*0.5, curY + bagSlotSize*0.4)
    curY += bagSlotSize*0.8 + 6*S
  }

  // --- 灵宠背包 ---
  ctx.textAlign = 'center'
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(25,14,10,0.85)'
  ctx.lineWidth = 3 * S
  ctx.fillStyle = '#EED6AE'
  ctx.strokeText('── 灵宠背包 ──', W*0.5, curY)
  ctx.fillText('── 灵宠背包 ──', W*0.5, curY)
  curY += 14*S
  ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(20,12,8,0.8)'
  ctx.lineWidth = 2 * S
  ctx.fillStyle = '#DCC39A'
  ctx.strokeText('拖动到上方队伍可交换', W*0.5, curY)
  ctx.fillText('拖动到上方队伍可交换', W*0.5, curY)
  curY += 10*S
  if (g.petBag.length > 0) {
    const bagIconSize = bagSlotSize
    const bagFrameSize = bagIconSize * frameScale
    const bagFrameOff = (bagFrameSize - bagIconSize) / 2
    for (let i = 0; i < g.petBag.length; i++) {
      const col = i % bagCols
      const row = Math.floor(i / bagCols)
      const bx = teamSidePad + col * (bagIconSize + bagGap)
      const by = curY + row * (bagIconSize + bagGap)
      g._eventPetSlots.push({ rect: [bx, by, bagIconSize, bagIconSize], type: 'bag', index: i })
      g._eventBagPetRects.push([bx, by, bagIconSize, bagIconSize])
      const isDragSource = drag && drag.source === 'bag' && drag.index === i
      if (isDragSource) ctx.globalAlpha = 0.3
      _drawPetIconCompact(ctx, R, TH, S, bx, by, bagIconSize, g.petBag[i], framePetMap, bagFrameSize, bagFrameOff, false)
      if (isDragSource) ctx.globalAlpha = 1
      // NEW / UP 角标
      const bPet = g.petBag[i]
      const bri = g._lastRewardInfo
      if (bri && bri.petId === bPet.id) {
        if (bri.type === 'newPet') _drawBadge(ctx, S, bx, by, bagIconSize, 'NEW', '#e04040')
        else if (bri.type === 'starUp') _drawBadge(ctx, S, bx, by, bagIconSize, 'UP', '#30b050')
      }
      // 弱点属性高亮
      const _bWeakAttr = COUNTER_BY[e.attr]
      if (_bWeakAttr && bPet.attr === _bWeakAttr) {
        const bPulse = 0.5 + 0.5 * Math.sin(g.af * 0.08)
        const bwac = ATTR_COLOR[_bWeakAttr]
        ctx.save()
        ctx.strokeStyle = bwac ? bwac.main : '#4dff4d'
        ctx.lineWidth = 2.5*S
        ctx.globalAlpha = 0.4 + 0.6 * bPulse
        ctx.strokeRect(bx - 1, by - 1, bagIconSize + 2, bagIconSize + 2)
        ctx.restore()
      }
      if (drag && drag.source === 'team') {
        if (g._hitRect && g._hitRect(drag.x, drag.y, bx, by, bagIconSize, bagIconSize)) {
          ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
          ctx.strokeRect(bx - 1, by - 1, bagIconSize + 2, bagIconSize + 2)
        }
      }
    }
    const bagRows = Math.ceil(g.petBag.length / bagCols)
    curY += bagRows * (bagIconSize + bagGap)
  } else {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(120,105,80,0.45)'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('空', W*0.5, curY + bagSlotSize*0.4)
    curY += bagSlotSize*0.8
  }
  curY += 8*S

  // ===== 新手教学后第1层说明提示 =====
  if (g._tutorialJustDone && g.floor === 1) {
    const hintW = W * 0.88, hintX = (W - hintW) / 2
    const hintY = curY
    ctx.fillStyle = 'rgba(45,30,18,0.88)'
    R.rr(hintX, hintY, hintW, 56*S, 8*S); ctx.fill()
    ctx.strokeStyle = 'rgba(180,150,90,0.3)'; ctx.lineWidth = 1
    R.rr(hintX, hintY, hintW, 56*S, 8*S); ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = '#E8C060'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('💡 冒险开始', W*0.5, hintY + 14*S)
    ctx.fillStyle = 'rgba(220,205,170,0.85)'; ctx.font = `${9.5*S}px "PingFang SC",sans-serif`
    ctx.fillText('正式冒险初始携带4只灵兽和1件基础法宝', W*0.5, hintY + 30*S)
    ctx.fillText('击败怪物可获得新灵兽或法宝，通关30层即为胜利！', W*0.5, hintY + 44*S)
    curY += 64*S
  }

  // ===== 进入战斗按钮（固定在页面底部） =====
  const goBtnW = W*0.6, goBtnH = goBtnW / 4
  const goBtnX = (W - goBtnW)/2, goBtnY = H - goBtnH - 28*S
  const btnStartImg = R.getImg('assets/ui/btn_start.png')
  if (btnStartImg && btnStartImg.width > 0) {
    ctx.drawImage(btnStartImg, goBtnX, goBtnY, goBtnW, goBtnH)
  } else {
    R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '进入战斗', TH.accent, 16)
  }
  ctx.save()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
  ctx.fillText('进入战斗', W*0.5, goBtnY + goBtnH*0.5)
  ctx.restore()
  g._eventBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]
  curY += goBtnH + 20*S

  // 返回首页按钮（古风暖色风格）
  {
    const btnW = 60*S, btnH = 30*S
    const bbx = 8*S, bby = safeTop + 6*S
    ctx.fillStyle = 'rgba(60,40,20,0.6)'
    R.rr(bbx, bby, btnW, btnH, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(200,170,120,0.4)'; ctx.lineWidth = 1
    R.rr(bbx, bby, btnW, btnH, 6*S); ctx.stroke()
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('< 首页', bbx + btnW*0.5, bby + btnH*0.5)
    ctx.textBaseline = 'alphabetic'
    g._backBtnRect = [bbx, bby, btnW, btnH]
  }

  // 拖拽中的灵宠跟随手指绘制
  if (drag && drag.pet) {
    const dragSz = teamIconSize * 0.9
    const dragFSz = dragSz * frameScale
    const dragFOff = (dragFSz - dragSz) / 2
    ctx.globalAlpha = 0.85
    _drawPetIcon(ctx, R, TH, S, drag.x - dragSz/2, drag.y - dragSz/2, dragSz, drag.pet, framePetMap, dragFSz, dragFOff, false)
    ctx.globalAlpha = 1
  }

  // 拖拽中的法宝跟随手指绘制
  const wpnDrag = g._eventDragWpn
  if (wpnDrag && wpnDrag.weapon) {
    const dragSz = teamIconSize * 0.9
    ctx.globalAlpha = 0.85
    const dx = wpnDrag.x - dragSz/2, dy = wpnDrag.y - dragSz/2
    ctx.fillStyle = '#1a1510'
    ctx.fillRect(dx+1, dy+1, dragSz-2, dragSz-2)
    const wImg = R.getImg(`assets/equipment/fabao_${wpnDrag.weapon.id}.png`)
    if (wImg && wImg.width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(dx+1, dy+1, dragSz-2, dragSz-2); ctx.clip()
      ctx.drawImage(wImg, dx+1, dy+1, dragSz-2, dragSz-2)
      ctx.restore()
    }
    R.drawWeaponFrame(dx, dy, dragSz)
    ctx.globalAlpha = 1
  }

  // 灵宠详情弹窗
  if (g._eventPetDetail != null) {
    drawEventPetDetail(g)
  }
  // 法宝详情弹窗
  if (g._eventWpnDetail != null) {
    _drawWeaponDetailPopup(g)
  }
  // 商店灵兽获得弹窗
  if (g._shopPetObtained) {
    drawPetObtainedPopup(g, g._shopPetObtained)
  }
}

// ===== 法宝卡片绘制 =====
function _drawWeaponCard(ctx, R, TH, S, x, y, w, h, weapon, isEquipped, slotsArr, slotType, index) {
  ctx.fillStyle = isEquipped ? 'rgba(30,25,18,0.85)' : 'rgba(15,15,30,0.6)'
  R.rr(x, y, w, h, 6*S); ctx.fill()
  if (isEquipped) {
    ctx.strokeStyle = '#ffd70066'; ctx.lineWidth = 1*S
    R.rr(x, y, w, h, 6*S); ctx.stroke()
  }

  if (weapon) {
    const iconSz = 30*S
    const iconX = x + 8*S
    const iconY = y + (h - iconSz)/2
    ctx.fillStyle = '#1a1510'
    R.rr(iconX, iconY, iconSz, iconSz, 4*S); ctx.fill()
    const wImg = R.getImg(`assets/equipment/fabao_${weapon.id}.png`)
    if (wImg && wImg.width > 0) {
      ctx.save(); R.rr(iconX, iconY, iconSz, iconSz, 4*S); ctx.clip()
      ctx.drawImage(wImg, iconX, iconY, iconSz, iconSz)
      ctx.restore()
    }
    if (isEquipped) {
      ctx.save()
      const fPad = 1*S
      const fX = iconX - fPad, fY = iconY - fPad, fSz = iconSz + fPad*2, fRd = 5*S
      const wGrd = ctx.createLinearGradient(fX, fY, fX + fSz, fY + fSz)
      wGrd.addColorStop(0, '#ffd700'); wGrd.addColorStop(0.5, '#ffec80'); wGrd.addColorStop(1, '#c8a200')
      ctx.strokeStyle = wGrd; ctx.lineWidth = 2*S
      R.rr(fX, fY, fSz, fSz, fRd); ctx.stroke()
      ctx.restore()
    }
    ctx.textAlign = 'left'
    const textX = iconX + iconSz + 8*S
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    const _evPfx = '法宝·'
    ctx.fillStyle = '#e0a020'
    ctx.fillText(_evPfx, textX, y + h*0.38)
    const _evPfxW = ctx.measureText(_evPfx).width
    ctx.fillStyle = isEquipped ? TH.accent : '#ddd'
    ctx.fillText(weapon.name, textX + _evPfxW, y + h*0.38)
    ctx.fillStyle = TH.sub; ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(weapon.desc, textX, y + h*0.7)

    if (!isEquipped) {
      const eqBtnW = 44*S, eqBtnH = 22*S
      const eqBtnX = x + w - eqBtnW - 6*S, eqBtnY = y + (h - eqBtnH)/2
      R.drawBtn(eqBtnX, eqBtnY, eqBtnW, eqBtnH, '装备', TH.info, 10)
      slotsArr.push({ rect: [eqBtnX, eqBtnY, eqBtnW, eqBtnH], type: slotType, index: index, action: 'equip' })
    }
    // 整个卡片也可点击查看详情
    slotsArr.push({ rect: [x, y, w, h], type: slotType, index: index, action: 'detail' })
  } else {
    ctx.textAlign = 'center'; ctx.fillStyle = TH.dim; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(isEquipped ? '未装备法宝' : '空', x + w/2, y + h*0.58)
    slotsArr.push({ rect: [x, y, w, h], type: slotType, index: index, action: 'detail' })
  }
}

// ===== 灵宠图标绘制（紧凑版，无文字说明） =====
function _drawPetIconCompact(ctx, R, TH, S, px, py, size, pet, framePetMap, frameSize, frameOff, isSelected) {
  const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
  const ac = ATTR_COLOR[pet.attr]
  const cxP = px + size/2
  const cyP = py + size/2

  ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
  ctx.fillRect(px, py, size, size)
  ctx.save()
  const grd = ctx.createRadialGradient(cxP, cyP - size*0.06, 0, cxP, cyP - size*0.06, size*0.38)
  grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.fillRect(px, py, size, size)
  ctx.restore()

  const petAvatar = R.getImg(getPetAvatarPath(pet))
  if (petAvatar && petAvatar.width > 0) {
    const aw = petAvatar.width, ah = petAvatar.height
    const drawW = size - 2, drawH = drawW * (ah / aw)
    const dy = py + (size - 2) - drawH
    ctx.save()
    ctx.beginPath(); ctx.rect(px + 1, py + 1, size - 2, size - 2); ctx.clip()
    ctx.drawImage(petAvatar, px + 1, dy, drawW, drawH)
    ctx.restore()
  } else {
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${size*0.35}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(ATTR_NAME[pet.attr] || '', cxP, cyP)
    ctx.textBaseline = 'alphabetic'
  }

  const petFrame = framePetMap[pet.attr] || framePetMap.metal
  if (petFrame && petFrame.width > 0) {
    ctx.drawImage(petFrame, px - frameOff, py - frameOff, frameSize, frameSize)
  }

  // 星级标记（左下角）
  if ((pet.star || 1) >= 1) {
    const starText = '★'.repeat(pet.star || 1)
    ctx.save()
    ctx.font = `bold ${size * 0.14}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
    ctx.strokeText(starText, px + 2*S, py + size - 2*S)
    ctx.fillStyle = '#ffd700'
    ctx.fillText(starText, px + 2*S, py + size - 2*S)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }

  if (isSelected) {
    ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
    ctx.strokeRect(px - 1, py - 1, size + 2, size + 2)
  }
}

// ===== 灵宠图标绘制 =====
function _drawPetIcon(ctx, R, TH, S, px, py, size, pet, framePetMap, frameSize, frameOff, isSelected) {
  const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
  const ac = ATTR_COLOR[pet.attr]
  const cxP = px + size/2
  const cyP = py + size/2

  ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
  ctx.fillRect(px, py, size, size)
  ctx.save()
  const grd = ctx.createRadialGradient(cxP, cyP - size*0.06, 0, cxP, cyP - size*0.06, size*0.38)
  grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.fillRect(px, py, size, size)
  ctx.restore()

  const petAvatar = R.getImg(getPetAvatarPath(pet))
  if (petAvatar && petAvatar.width > 0) {
    const aw = petAvatar.width, ah = petAvatar.height
    const drawW = size - 2, drawH = drawW * (ah / aw)
    const dy = py + (size - 2) - drawH
    ctx.save()
    ctx.beginPath(); ctx.rect(px + 1, py + 1, size - 2, size - 2); ctx.clip()
    ctx.drawImage(petAvatar, px + 1, dy, drawW, drawH)
    ctx.restore()
  } else {
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${size*0.35}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(ATTR_NAME[pet.attr] || '', cxP, cyP)
    ctx.textBaseline = 'alphabetic'
  }

  const petFrame = framePetMap[pet.attr] || framePetMap.metal
  if (petFrame && petFrame.width > 0) {
    ctx.drawImage(petFrame, px - frameOff, py - frameOff, frameSize, frameSize)
  }

  // 星级标记（左下角）
  if ((pet.star || 1) >= 1) {
    const starText = '★'.repeat(pet.star || 1)
    ctx.save()
    ctx.font = `bold ${size * 0.14}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
    ctx.strokeText(starText, px + 2*S, py + size - 2*S)
    ctx.fillStyle = '#ffd700'
    ctx.fillText(starText, px + 2*S, py + size - 2*S)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }

  // 选中高亮
  if (isSelected) {
    ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
    ctx.strokeRect(px - 1, py - 1, size + 2, size + 2)
  }

  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(pet.name.substring(0,4), cxP, py + size + 10*S)
  const starAtk = getPetStarAtk(pet)
  const atkDisplay = (pet.star || 1) > 1 ? `ATK:${pet.atk}→${starAtk}` : `ATK:${pet.atk}`
  ctx.fillStyle = TH.dim; ctx.font = `${7*S}px "PingFang SC",sans-serif`
  ctx.fillText(atkDisplay, cxP, py + size + 19*S)
}

// ===== 灵宠详情弹窗（程序绘制浅色面板） =====
function drawEventPetDetail(g) {
  const { ctx, R, TH, W, H, S } = V
  const idx = g._eventPetDetail
  if (idx == null) return
  const p = g._eventPetDetailData || (idx >= 0 && idx < g.pets.length ? g.pets[idx] : null)
  if (!p) return
  const ac = ATTR_COLOR[p.attr]
  const curStar = p.star || 1
  const isMaxStar = curStar >= MAX_STAR
  const curAtk = getPetStarAtk(p)

  const cardW = W * 0.82
  const padX = 16*S, padY = 14*S
  const maxTextW = cardW - padX * 2
  const lineH = 14*S
  const skillDesc = petHasSkill(p) ? (getPetSkillDesc(p) || (p.skill ? p.skill.desc : '')) : ''
  const descLines = skillDesc ? wrapText(skillDesc, maxTextW - 4*S, 9) : []

  // 下一级数据
  let nextAtk = 0, nextSkillDesc = '', nextDescLines = []
  if (!isMaxStar) {
    const nextPet = { ...p, star: curStar + 1 }
    nextAtk = getPetStarAtk(nextPet)
    nextSkillDesc = petHasSkill(nextPet) ? (getPetSkillDesc(nextPet) || (p.skill ? p.skill.desc : '')) : ''
    nextDescLines = nextSkillDesc ? wrapText(nextSkillDesc, maxTextW - 4*S, 9) : []
  }

  // 头像尺寸
  const avSz = 36*S, avPad = 12*S

  // 预计算卡片高度
  let cardH = padY * 2
  const headerH = Math.max(avSz, 16*S + 16*S) + 4*S  // 名称行+ATK行 vs 头像
  cardH += headerH
  cardH += 6*S                          // 间距
  cardH += lineH                        // 技能标题+CD
  cardH += descLines.length * (lineH - 1*S)  // 技能描述
  if (!isMaxStar) {
    cardH += 10*S                       // 分割线上间距
    cardH += 2*S                        // 分割线
    cardH += 10*S                       // 分割线下间距
    cardH += lineH                      // 下一级标题
    cardH += lineH                      // 下一级ATK
    cardH += lineH                      // 下一级技能标题
    cardH += nextDescLines.length * (lineH - 1*S)  // 下一级技能描述
  }
  cardH = Math.max(cardH, 120*S)

  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
  const rad = 14*S

  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H)
  R.drawInfoPanel(cardX, cardY, cardW, cardH)

  // 裁剪防溢出
  ctx.save()
  ctx.beginPath(); R.rr(cardX, cardY, cardW, cardH, rad); ctx.clip()

  let iy = cardY + padY
  const lx = cardX + padX

  // === 头像 ===
  const avX = lx, avY = iy
  ctx.fillStyle = ac ? ac.bg : '#E8E0D8'
  R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()
  const petAvatar = R.getImg(getPetAvatarPath(p))
  if (petAvatar && petAvatar.width > 0) {
    ctx.save()
    ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
    const aw = petAvatar.width, ah = petAvatar.height
    const dw = avSz - 2, dh = dw * (ah/aw)
    ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
    ctx.restore()
  }

  // === 名称 + 星星（头像右侧同一行） ===
  const txL = avX + avSz + avPad
  iy += 14*S
  ctx.textAlign = 'left'
  ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(p.name, txL, iy)
  const nameW = ctx.measureText(p.name).width
  const starStr = '★'.repeat(curStar) + (curStar < MAX_STAR ? '☆'.repeat(MAX_STAR - curStar) : '')
  ctx.fillStyle = '#C89510'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(starStr, txL + nameW + 6*S, iy)

  // === 属性珠 + ATK（仅当前值，数值高亮） ===
  iy += 16*S
  const orbR = 5*S
  R.drawBead(txL + orbR, iy - 3*S, orbR, p.attr, 0)
  const atkLabel = ' ATK：'
  ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(atkLabel, txL + orbR*2 + 4*S, iy)
  const atkLabelW = ctx.measureText(atkLabel).width
  ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(String(curAtk), txL + orbR*2 + 4*S + atkLabelW, iy)

  // 跳过头像区域
  iy = Math.max(iy, avY + avSz)

  // === 间距 ===
  iy += 6*S

  // === 技能标题 + CD 高亮 ===
  iy += lineH
  if (petHasSkill(p)) {
    const skillTitle = `技能：${p.skill.name}`
    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(skillTitle, lx, iy)
    const skillTitleW = ctx.measureText(skillTitle).width
    const cdText = `CD ${p.cd}`
    ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(cdText, lx + skillTitleW + 6*S, iy)
    // === 技能描述（数值高亮） ===
    descLines.forEach(line => {
      iy += lineH - 1*S
      _drawHighlightLine(ctx, line, lx + 4*S, iy, 10*S, S)
    })
  } else {
    ctx.fillStyle = '#8B7B70'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('技能：升至★2解锁', lx, iy)
  }

  // === 下一级数据（非满星时，仅变化内容用醒目颜色） ===
  if (!isMaxStar) {
    iy += 10*S
    // 分割线
    ctx.strokeStyle = 'rgba(160,140,100,0.3)'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.moveTo(lx, iy); ctx.lineTo(cardX + cardW - padX, iy); ctx.stroke()
    iy += 2*S + 10*S

    // "下一级 ★X" 标题
    iy += lineH
    const nextStarLabel = `下一级 ${'★'.repeat(curStar + 1)}`
    ctx.fillStyle = '#8B6E4E'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(nextStarLabel, lx, iy)

    // 下一级ATK（ATK总是变化，用醒目色）
    iy += lineH
    const nAtkLabel = 'ATK：'
    const atkChanged = nextAtk !== curAtk
    ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(nAtkLabel, lx, iy)
    const nAtkLabelW = ctx.measureText(nAtkLabel).width
    ctx.fillStyle = atkChanged ? '#c06020' : '#4A3B30'
    ctx.font = atkChanged ? `bold ${11*S}px "PingFang SC",sans-serif` : `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(String(nextAtk), lx + nAtkLabelW, iy)

    // 下一级技能
    const nextPetFake = { ...p, star: curStar + 1 }
    const nextHasSkill = petHasSkill(nextPetFake)
    const curHasSkill = petHasSkill(p)
    if (nextHasSkill && !curHasSkill) {
      // ★1→★2：新解锁技能，用高亮醒目色
      iy += lineH
      const nextSkillTitle = `解锁技能：${p.skill.name}`
      ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(nextSkillTitle, lx, iy)
      const nextSkillTitleW = ctx.measureText(nextSkillTitle).width
      const nextCdText = `CD ${p.cd}`
      ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(nextCdText, lx + nextSkillTitleW + 6*S, iy)
      // 技能描述用高亮
      nextDescLines.forEach(line => {
        iy += lineH - 1*S
        _drawHighlightLine(ctx, line, lx + 4*S, iy, 10*S, S, '#c06020')
      })
    } else if (nextHasSkill) {
      // ★2→★3：技能名和CD不变，用普通色
      iy += lineH
      const nextSkillTitle = `技能：${p.skill ? p.skill.name : '无'}`
      ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(nextSkillTitle, lx, iy)
      const nextSkillTitleW = ctx.measureText(nextSkillTitle).width
      const nextCdText = `CD ${p.cd}`
      ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(nextCdText, lx + nextSkillTitleW + 6*S, iy)
      // 下一级技能描述（仅描述变化时用高亮，否则普通色）
      const descChanged = nextSkillDesc !== skillDesc
      nextDescLines.forEach(line => {
        iy += lineH - 1*S
        if (descChanged) {
          _drawHighlightLine(ctx, line, lx + 4*S, iy, 10*S, S, '#c06020')
        } else {
          ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'
          ctx.fillText(line, lx + 4*S, iy)
        }
      })
    }
  }

  ctx.restore() // 结束裁剪

  g._eventPetDetailCloseRect = [0, 0, W, H]
}

// ===== 灵兽获得弹窗（通用：商店/奖励等场景均可调用） =====
function drawPetObtainedPopup(g, info) {
  if (!info) info = g._shopPetObtained
  const { ctx, R, TH, W, H, S } = V
  if (!info || !info.pet) return
  const p = info.pet
  const ac = ATTR_COLOR[p.attr]
  const curStar = p.star || 1
  const curAtk = getPetStarAtk(p)
  const skillDesc = petHasSkill(p) ? (getPetSkillDesc(p) || (p.skill ? p.skill.desc : '')) : ''

  const cardW = W * 0.78
  const padX = 16*S, padY = 14*S
  const maxTextW = cardW - padX * 2
  const lineH = 14*S
  const avSz = 48*S
  const avPad = 10*S
  const descLines = skillDesc ? wrapText(skillDesc, maxTextW - 4*S, 9) : []

  // 计算高度
  const headerTextH = lineH * 2
  const headerH = Math.max(avSz, headerTextH) + 4*S
  let totalH = padY * 2
  totalH += 20*S            // 标题行
  totalH += 10*S            // 标题下间距
  totalH += headerH         // 头像+名称+ATK
  totalH += 6*S
  totalH += lineH           // 技能标题
  totalH += descLines.length * lineH
  totalH += 20*S            // 底部提示
  totalH = Math.max(totalH, 140*S)

  const cardX = (W - cardW) / 2
  const cardY = (H - totalH) / 2
  const rad = 14*S

  // 半透明遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)

  R.drawInfoPanel(cardX, cardY, cardW, totalH)

  ctx.save()
  ctx.beginPath(); R.rr(cardX, cardY, cardW, totalH, rad); ctx.clip()

  let iy = cardY + padY
  const lx = cardX + padX

  // === 标题（获得提示） ===
  ctx.textAlign = 'center'
  let titleText = '获得新灵兽！'
  let titleColor = '#8B6914'
  if (info.type === 'starUp') {
    titleText = '灵兽升星！'
    titleColor = '#c06020'
  } else if (info.type === 'maxed') {
    titleText = '灵兽已满星'
    titleColor = '#8B7B70'
  }
  ctx.fillStyle = titleColor; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(titleText, W * 0.5, iy + 12*S)
  iy += 20*S + 10*S

  // === 头像 ===
  const avX = lx, avY = iy
  ctx.fillStyle = ac ? ac.bg : '#E8E0D8'
  R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()
  const petImg = R.getImg(getPetAvatarPath(p))
  if (petImg && petImg.width > 0) {
    ctx.save()
    ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
    const aw = petImg.width, ah = petImg.height
    const dw = avSz - 2, dh = dw * (ah/aw)
    ctx.drawImage(petImg, avX+1, avY+1+(avSz-2-dh), dw, dh)
    ctx.restore()
  }

  // === 名称 + 星星 ===
  const txL = avX + avSz + avPad
  iy += lineH
  ctx.textAlign = 'left'
  ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(p.name, txL, iy)
  const nameW = ctx.measureText(p.name).width
  const starStr = '★'.repeat(curStar) + (curStar < MAX_STAR ? '☆'.repeat(MAX_STAR - curStar) : '')
  ctx.fillStyle = '#C89510'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(starStr, txL + nameW + 6*S, iy)

  // === 属性珠 + ATK ===
  iy += lineH
  const orbR = 5*S
  R.drawBead(txL + orbR, iy - 3*S, orbR, p.attr, 0)
  const atkLabel = ' ATK：'
  ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(atkLabel, txL + orbR*2 + 4*S, iy)
  const atkLabelW = ctx.measureText(atkLabel).width
  ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(String(curAtk), txL + orbR*2 + 4*S + atkLabelW, iy)

  // 跳过头像区域
  iy = Math.max(iy, avY + avSz)
  iy += 6*S

  // === 技能 ===
  iy += lineH
  if (petHasSkill(p)) {
    const skillTitle = `技能：${p.skill.name}`
    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(skillTitle, lx, iy)
    const skillTitleW = ctx.measureText(skillTitle).width
    ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`CD ${p.cd}`, lx + skillTitleW + 6*S, iy)
    descLines.forEach(line => {
      iy += lineH
      _drawHighlightLine(ctx, line, lx + 4*S, iy, 10*S, S)
    })
  } else {
    ctx.fillStyle = '#8B7B70'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('技能：升至★2解锁', lx, iy)
  }

  ctx.restore() // 结束裁剪

  // 底部提示
  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, cardY + totalH + 14*S)

  ctx.restore()
}

// 绘制带数值高亮的单行文本（数字用橙色粗体）
function _drawHighlightLine(ctx, text, x, y, fontSize, S) {
  const normalColor = '#4A3B30'
  const highlightColor = '#c06020'
  const font = `${fontSize}px "PingFang SC",sans-serif`
  const boldFont = `bold ${fontSize}px "PingFang SC",sans-serif`
  const numRe = /(\d+[\d.]*%?倍?)/g

  ctx.textAlign = 'left'
  let cx = x, lastIdx = 0, match
  numRe.lastIndex = 0
  while ((match = numRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const before = text.substring(lastIdx, match.index)
      ctx.fillStyle = normalColor; ctx.font = font
      ctx.fillText(before, cx, y)
      cx += ctx.measureText(before).width
    }
    ctx.fillStyle = highlightColor; ctx.font = boldFont
    ctx.fillText(match[0], cx, y)
    cx += ctx.measureText(match[0]).width
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    ctx.fillStyle = normalColor; ctx.font = font
    ctx.fillText(text.substring(lastIdx), cx, y)
  }
  if (lastIdx === 0) {
    ctx.fillStyle = normalColor; ctx.font = font
    ctx.fillText(text, x, y)
  }
}

// ===== 法宝详情弹窗（程序绘制浅色面板） =====
function _drawWeaponDetailPopup(g) {
  const { ctx, R, TH, W, H, S } = V
  const wp = g._eventWpnDetailData
  if (!wp) return

  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H)

  const cardW = W * 0.76
  const padX = 16*S, padY = 14*S
  const maxTextW = cardW - 48*S - padX * 2 - 10*S
  const descLines = wrapText(wp.desc, maxTextW, 10)
  const cardH = Math.max(90*S, padY * 2 + descLines.length * 14*S + 40*S)
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
  const rad = 14*S
  R.drawInfoPanel(cardX, cardY, cardW, cardH)

  ctx.save()
  ctx.beginPath(); R.rr(cardX, cardY, cardW, cardH, rad); ctx.clip()

  const iconSz = 42*S
  const iconX = cardX + padX, iconY = cardY + padY
  ctx.fillStyle = '#E8E0D8'
  R.rr(iconX, iconY, iconSz, iconSz, 6*S); ctx.fill()
  const wImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
  if (wImg && wImg.width > 0) {
    ctx.save(); R.rr(iconX, iconY, iconSz, iconSz, 6*S); ctx.clip()
    ctx.drawImage(wImg, iconX, iconY, iconSz, iconSz)
    ctx.restore()
  }

  const textX = iconX + iconSz + 10*S
  ctx.textAlign = 'left'
  ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  const _dtPfx = '法宝·'
  ctx.fillStyle = '#e0a020'
  ctx.fillText(_dtPfx, textX, cardY + padY + 14*S)
  const _dtPfxW = ctx.measureText(_dtPfx).width
  ctx.fillStyle = '#8B6914'
  ctx.fillText(wp.name, textX + _dtPfxW, cardY + padY + 14*S)
  ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  let dy = cardY + padY + 32*S
  descLines.forEach(line => {
    ctx.fillText(line, textX, dy)
    dy += 14*S
  })

  ctx.restore() // 结束裁剪

  g._eventWpnDetailCloseRect = [0, 0, W, H]
}

module.exports = { rEvent, drawEventPetDetail, drawPetObtainedPopup }
