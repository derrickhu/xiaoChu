/**
 * 事件预览界面渲染：战斗/奇遇/商店/休息 事件详情
 * 战斗层：整合法宝切换 + 灵宠替换，支持点击快速交换，无需跳转prepare页面
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_BY, COUNTER_MAP } = require('../data/tower')
const { drawBackBtn } = require('./screens')
const { wrapText } = require('./prepareView')
const { getPetStarAtk, MAX_STAR, getPetAvatarPath } = require('../data/pets')

// ===== 滚动状态（挂在模块级，避免每帧重置） =====
let _scrollY = 0          // 当前滚动偏移
let _scrollTouchStartY = 0
let _scrollStart = 0
let _contentH = 0         // 内容总高度
let _viewH = 0            // 可视区高度
let _lastFloor = -1       // 用于检测楼层变化时重置滚动

function rEvent(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawRewardBg(g.af)
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

      ctx.fillStyle = TH.text; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText(ev.data.name, W*0.5, H*0.35)
      ctx.fillStyle = TH.sub; ctx.font = `${14*S}px "PingFang SC",sans-serif`
      ctx.fillText(ev.data.desc, W*0.5, H*0.43)
      ctx.fillStyle = TH.success; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.fillText('效果已生效！', W*0.5, H*0.52)
      const bx = W*0.3, by = H*0.65, bw = W*0.4, bh = 44*S
      R.drawBtn(bx, by, bw, bh, '继续', TH.accent, 16)
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
      ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText(`── 第 ${g.floor} 层 ──`, W*0.5, ty)
      ty += 22*S
      ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.fillText('神秘商店', W*0.5, ty)

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
      ctx.fillStyle = shopUsedCount >= 2 ? TH.dim : '#ffd700'; ctx.font = `${13*S}px "PingFang SC",sans-serif`
      ctx.fillText(hintText, W*0.5, safeTop + 90*S)

      const items = ev.data
      if (items && !g._shopSelectAttr && !g._shopSelectPet) {
        const cardW = W*0.84, cardH = 60*S, gap = 8*S, startY = safeTop + 100*S
        g._eventShopRects = []
        const RARITY_COLORS = { normal:'rgba(40,60,40,0.85)', rare:'rgba(40,40,80,0.85)', epic:'rgba(80,40,80,0.85)' }
        const RARITY_BORDERS = { normal:'rgba(100,200,100,0.4)', rare:'rgba(100,150,255,0.5)', epic:'rgba(220,100,255,0.6)' }
        const RARITY_LABELS = { normal:'', rare:'稀有', epic:'史诗' }
        items.forEach((item, i) => {
          const cy = startY + i*(cardH+gap)
          const isUsed = g._eventShopUsedItems && g._eventShopUsedItems.includes(i)
          const canBuy = !isUsed && shopUsedCount < 2
          ctx.fillStyle = isUsed ? 'rgba(30,30,30,0.6)' : (RARITY_COLORS[item.rarity] || TH.card)
          R.rr(W*0.08, cy, cardW, cardH, 8*S); ctx.fill()
          ctx.strokeStyle = isUsed ? 'rgba(80,80,80,0.3)' : (RARITY_BORDERS[item.rarity] || 'rgba(200,180,140,0.3)')
          ctx.lineWidth = 1*S
          R.rr(W*0.08, cy, cardW, cardH, 8*S); ctx.stroke()

          // 稀有度标签
          const rarityLabel = RARITY_LABELS[item.rarity]
          if (rarityLabel && !isUsed) {
            ctx.save()
            const tagW = ctx.measureText(rarityLabel).width + 12*S
            const tagH = 16*S
            const tagX = W*0.08 + 6*S, tagY = cy + 4*S
            ctx.fillStyle = item.rarity === 'epic' ? 'rgba(180,60,220,0.8)' : 'rgba(60,100,200,0.8)'
            R.rr(tagX, tagY, tagW, tagH, 3*S); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText(rarityLabel, tagX + tagW/2, tagY + tagH*0.65)
            ctx.restore()
          }

          // 名称和描述
          ctx.globalAlpha = isUsed ? 0.4 : 1
          ctx.fillStyle = isUsed ? TH.dim : '#fff'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
          ctx.fillText(item.name, W*0.08 + 14*S, cy + 24*S)
          ctx.fillStyle = isUsed ? TH.dim : TH.sub; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.fillText(item.desc, W*0.08 + 14*S, cy + 42*S)

          // 费用标签（右侧）
          ctx.textAlign = 'right'
          if (isUsed) {
            ctx.fillStyle = TH.dim; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
            ctx.fillText('已选', W*0.08 + cardW - 12*S, cy + 34*S)
          } else if (shopUsedCount === 0) {
            ctx.fillStyle = '#4dcc4d'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
            ctx.fillText('免费', W*0.08 + cardW - 12*S, cy + 34*S)
          } else if (shopUsedCount === 1) {
            ctx.fillStyle = '#ff6b6b'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
            ctx.fillText(`-${15}%血`, W*0.08 + cardW - 12*S, cy + 34*S)
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

      // === 属性选择面板（灵兽招募时弹出） ===
      if (g._shopSelectAttr) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H)
        const panelW = W*0.8, panelH = 160*S
        const panelX = (W - panelW)/2, panelY = H*0.35
        ctx.fillStyle = 'rgba(20,20,40,0.95)'
        R.rr(panelX, panelY, panelW, panelH, 10*S); ctx.fill()
        ctx.strokeStyle = 'rgba(200,180,140,0.5)'; ctx.lineWidth = 1*S
        R.rr(panelX, panelY, panelW, panelH, 10*S); ctx.stroke()

        ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
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
          ctx.fillStyle = ac ? ac.bg : '#222'
          R.rr(bx, btnY, btnW, btnH, 8*S); ctx.fill()
          ctx.strokeStyle = ac ? ac.main : '#666'; ctx.lineWidth = 1.5*S
          R.rr(bx, btnY, btnW, btnH, 8*S); ctx.stroke()
          // 属性球
          R.drawBead(bx + btnW/2, btnY + btnH*0.35, 10*S, attr, 0)
          ctx.fillStyle = ac ? ac.main : '#ccc'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'
          ctx.fillText(attrNames[attr], bx + btnW/2, btnY + btnH*0.82)
          g._shopAttrRects.push([bx, btnY, btnW, btnH, attr])
        })

        // 取消按钮
        const cancelY = btnY + btnH + 16*S
        const cancelW = 80*S, cancelH = 32*S
        R.drawBtn((W-cancelW)/2, cancelY, cancelW, cancelH, '取消', TH.dim, 12)
        g._shopAttrCancelRect = [(W-cancelW)/2, cancelY, cancelW, cancelH]
      }

      // === 灵兽选择面板（升星/强化/减CD时弹出） ===
      if (g._shopSelectPet) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H)
        const panelW = W*0.85, panelH = 200*S
        const panelX = (W - panelW)/2, panelY = H*0.3
        ctx.fillStyle = 'rgba(20,20,40,0.95)'
        R.rr(panelX, panelY, panelW, panelH, 10*S); ctx.fill()
        ctx.strokeStyle = 'rgba(200,180,140,0.5)'; ctx.lineWidth = 1*S
        R.rr(panelX, panelY, panelW, panelH, 10*S); ctx.stroke()

        const selectType = g._shopSelectPet.type  // 'starUp' | 'upgradePet' | 'cdReduce'
        const titleMap = { starUp:'选择灵兽升星', upgradePet:'选择灵兽强化', cdReduce:'选择灵兽减CD' }
        ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
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
          // 星级
          if ((p.star||1) > 1) {
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
          ctx.fillStyle = canSelect ? (ac2 ? ac2.main : '#ccc') : TH.dim
          ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          ctx.fillText(p.name.substring(0,4), px+petSlotSz/2, py2+petSlotSz+12*S)
          if (selectType === 'starUp') {
            ctx.fillStyle = canSelect ? '#ffd700' : TH.dim; ctx.font = `${7*S}px "PingFang SC",sans-serif`
            ctx.fillText(canSelect ? `★${p.star||1}→★${(p.star||1)+1}` : dimReason, px+petSlotSz/2, py2+petSlotSz+22*S)
          } else if (selectType === 'upgradePet') {
            ctx.fillStyle = '#ff9040'; ctx.font = `${7*S}px "PingFang SC",sans-serif`
            ctx.fillText(`ATK:${p.atk}→${Math.round(p.atk*1.25)}`, px+petSlotSz/2, py2+petSlotSz+22*S)
          } else if (selectType === 'cdReduce') {
            ctx.fillStyle = canSelect ? '#40ccff' : TH.dim; ctx.font = `${7*S}px "PingFang SC",sans-serif`
            ctx.fillText(canSelect ? `CD:${p.cd}→${p.cd-1}` : dimReason, px+petSlotSz/2, py2+petSlotSz+22*S)
          }

          if (canSelect) {
            g._shopPetRects.push([px, py2, petSlotSz, petSlotSz, i])
          }
        })

        // 取消按钮
        const cancelY2 = petRowY + petSlotSz + 36*S
        const cancelW2 = 80*S, cancelH2 = 32*S
        R.drawBtn((W-cancelW2)/2, cancelY2, cancelW2, cancelH2, '取消', TH.dim, 12)
        g._shopPetCancelRect = [(W-cancelW2)/2, cancelY2, cancelW2, cancelH2]
      }

      const bx = W*0.3, by = H*0.88, bw = W*0.4, bh = 40*S
      if (!g._shopSelectAttr && !g._shopSelectPet) {
        R.drawBtn(bx, by, bw, bh, '离开', TH.info, 14)
        g._eventBtnRect = [bx, by, bw, bh]
      } else {
        g._eventBtnRect = null
      }
      drawBackBtn(g)
      return
    }

    // === 休息：直接显示选项卡片 ===
    if (ev.type === 'rest') {
      R.drawBg(g.af)
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
  ctx.fillStyle = 'rgba(15,15,30,0.75)'
  R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.fill()
  ctx.strokeStyle = ac ? ac.main + '66' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
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
  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(e.name, infoX, infoY)
  infoY += 20*S
  // 属性文字
  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`${ATTR_NAME[e.attr]}属性`, infoX, infoY)
  // 弱点 & 抵抗（下一行，用属性球）
  infoY += 18*S
  const orbR2 = 6*S
  let bx = infoX
  const weakAttr = COUNTER_BY[e.attr]
  if (weakAttr) {
    ctx.fillStyle = '#aaa'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('弱:', bx, infoY)
    bx += ctx.measureText('弱:').width + 4*S
    R.drawBead(bx + orbR2, infoY - 3*S, orbR2, weakAttr, 0)
    bx += orbR2*2 + 10*S
  }
  const resistAttr = COUNTER_MAP[e.attr]
  if (resistAttr) {
    ctx.fillStyle = '#aaa'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('抗:', bx, infoY)
    bx += ctx.measureText('抗:').width + 4*S
    R.drawBead(bx + orbR2, infoY - 3*S, orbR2, resistAttr, 0)
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
  ctx.fillStyle = '#d0c0a0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.fillText('── 己方队伍 ──', W*0.5, curY)
  curY += 14*S

  // --- HP条 ---
  const hpBarH = 14*S
  R.drawHp(padX, curY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', null, true, '#4dcc4d', g.heroShield)
  curY += hpBarH + 10*S

  // ===== 全局增益buff横排显示 =====
  if (g.runBuffLog && g.runBuffLog.length > 0) {
    const BUFF_LABELS = {
      allAtkPct:'攻', allDmgPct:'伤', heartBoostPct:'回', weaponBoostPct:'武',
      extraTimeSec:'时', hpMaxPct:'血', comboDmgPct:'连', elim3DmgPct:'3消',
      elim4DmgPct:'4消', elim5DmgPct:'5消', counterDmgPct:'克', skillDmgPct:'技',
      skillCdReducePct:'CD', regenPerTurn:'生', dmgReducePct:'防', bonusCombo:'C+',
      stunDurBonus:'晕', enemyAtkReducePct:'弱攻', enemyHpReducePct:'弱血',
      enemyDefReducePct:'弱防', eliteAtkReducePct:'E攻', eliteHpReducePct:'E血',
      bossAtkReducePct:'B攻', bossHpReducePct:'B血',
      nextDmgReducePct:'减伤', postBattleHealPct:'战回', extraRevive:'复活',
    }
    const DEBUFF_KEYS = ['enemyAtkReducePct','enemyHpReducePct','enemyDefReducePct',
      'eliteAtkReducePct','eliteHpReducePct','bossAtkReducePct','bossHpReducePct']
    const merged = {}
    for (const entry of g.runBuffLog) {
      const k = entry.buff
      if (!merged[k]) merged[k] = { buff: k, val: 0, label: BUFF_LABELS[k] || k }
      merged[k].val += entry.val
    }
    const buffItems = Object.values(merged)
    if (buffItems.length > 0) {
      const iconSz = 22*S
      const gap = 4*S
      const maxPerRow = Math.floor((W - padX*2 + gap) / (iconSz + gap))
      const rows = Math.ceil(buffItems.length / maxPerRow)
      const totalW = Math.min(buffItems.length, maxPerRow) * (iconSz + gap) - gap
      const startX = (W - totalW) / 2
      for (let i = 0; i < buffItems.length; i++) {
        const row = Math.floor(i / maxPerRow)
        const col = i % maxPerRow
        const itemsInRow = (row < rows - 1) ? maxPerRow : buffItems.length - row * maxPerRow
        const rowW = itemsInRow * (iconSz + gap) - gap
        const rowStartX = (W - rowW) / 2
        const ix = rowStartX + col * (iconSz + gap)
        const iy = curY + row * (iconSz + gap)
        const it = buffItems[i]
        const isDebuff = DEBUFF_KEYS.includes(it.buff)
        ctx.fillStyle = isDebuff ? 'rgba(180,60,60,0.7)' : 'rgba(30,100,60,0.7)'
        R.rr(ix, iy, iconSz, iconSz, 4*S); ctx.fill()
        ctx.strokeStyle = isDebuff ? 'rgba(255,100,100,0.5)' : 'rgba(100,255,150,0.4)'
        ctx.lineWidth = 1*S
        R.rr(ix, iy, iconSz, iconSz, 4*S); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.font = `bold ${7*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(it.label, ix + iconSz/2, iy + iconSz*0.36)
        const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}` :
                       it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                       `${it.val > 0 ? '+' : ''}${it.val}%`
        ctx.fillStyle = '#ffd700'; ctx.font = `${5.5*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
        ctx.textBaseline = 'alphabetic'
        ctx.fillText(valTxt, ix + iconSz/2, iy + iconSz*0.8)
      }
      curY += rows * (iconSz + gap) + 4*S
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
  ctx.fillStyle = 'rgba(8,8,20,0.88)'
  R.rr(0, teamBarY, W, teamBarH, 6*S); ctx.fill()

  const frameWeapon = R.getImg('assets/ui/frame_weapon.png')
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
      ctx.fillStyle = g.weapon ? '#1a1510' : 'rgba(25,22,18,0.8)'
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
        ctx.fillStyle = 'rgba(80,70,60,0.3)'
        ctx.font = `${teamIconSize*0.26}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', cx, cy)
      }
      // 法宝边框（使用frame_weapon图片）
      if (frameWeapon && frameWeapon.width > 0) {
        const fSz = teamIconSize * frameScale, fOff2 = (fSz - teamIconSize) / 2
        ctx.drawImage(frameWeapon, ix - fOff2, teamIconY - fOff2, fSz, fSz)
      } else {
        ctx.strokeStyle = '#ffd70088'; ctx.lineWidth = 2*S
        ctx.strokeRect(ix - 1, teamIconY - 1, teamIconSize + 2, teamIconSize + 2)
      }
      g._eventWpnSlots.push({ rect: [ix, teamIconY, teamIconSize, teamIconSize], action: 'detail', type: 'equipped', index: 0 })
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
        if ((p.star || 1) > 1) {
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
      } else {
        ctx.fillStyle = 'rgba(18,18,30,0.6)'
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
  curY += 8*S

  // ===== 背包区 =====
  const bagCols = 6
  const bagGap = teamPetGap
  const bagSlotSize = teamIconSize
  const petSidePad = padX

  // --- 法宝背包 ---
  ctx.textAlign = 'center'
  ctx.fillStyle = '#d0c0a0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.fillText('── 法宝背包 ──', W*0.5, curY)
  curY += 14*S
  ctx.fillStyle = 'rgba(200,180,140,0.5)'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('点击可替换当前法宝', W*0.5, curY)
  curY += 10*S
  if (g.weaponBag.length > 0) {
    const wpnFrameScale2 = 1.12
    for (let i = 0; i < g.weaponBag.length; i++) {
      const col = i % bagCols
      const row = Math.floor(i / bagCols)
      const bx = teamSidePad + col*(bagSlotSize+bagGap)
      const by = curY + row*(bagSlotSize+bagGap)
      const wp = g.weaponBag[i]
      ctx.fillStyle = 'rgba(15,15,30,0.6)'
      ctx.fillRect(bx+1, by+1, bagSlotSize-2, bagSlotSize-2)
      const wImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
      if (wImg && wImg.width > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(bx+1, by+1, bagSlotSize-2, bagSlotSize-2); ctx.clip()
        const aw = wImg.width, ah = wImg.height
        const dw = bagSlotSize - 2, dh = dw * (ah / aw)
        ctx.drawImage(wImg, bx+1, by+1+(bagSlotSize-2-dh), dw, dh)
        ctx.restore()
      }
      if (frameWeapon && frameWeapon.width > 0) {
        const fSz = bagSlotSize * wpnFrameScale2, fOff2 = (fSz - bagSlotSize)/2
        ctx.drawImage(frameWeapon, bx - fOff2, by - fOff2, fSz, fSz)
      }
      g._eventWpnSlots.push({ rect: [bx, by, bagSlotSize, bagSlotSize], action: 'equip', type: 'bag', index: i })
    }
    const wpnRows = Math.ceil(g.weaponBag.length / bagCols)
    curY += wpnRows * (bagSlotSize + bagGap) + 6*S
  } else {
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(200,180,140,0.4)'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('空', W*0.5, curY + bagSlotSize*0.4)
    curY += bagSlotSize*0.8 + 6*S
  }

  // --- 灵宠背包 ---
  ctx.textAlign = 'center'
  ctx.fillStyle = '#d0c0a0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.fillText('── 灵宠背包 ──', W*0.5, curY)
  curY += 14*S
  ctx.fillStyle = 'rgba(200,180,140,0.5)'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
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
    ctx.fillStyle = 'rgba(200,180,140,0.4)'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('空', W*0.5, curY + bagSlotSize*0.4)
    curY += bagSlotSize*0.8
  }
  curY += 8*S

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

  // 灵宠详情弹窗
  if (g._eventPetDetail != null) {
    drawEventPetDetail(g)
  }
  // 法宝详情弹窗
  if (g._eventWpnDetail != null) {
    _drawWeaponDetailPopup(g)
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
    ctx.fillStyle = isEquipped ? TH.accent : '#ddd'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(weapon.name, textX, y + h*0.38)
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
  if ((pet.star || 1) > 1) {
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
  if ((pet.star || 1) > 1) {
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

// ===== 灵宠详情弹窗（明亮说明面板） =====
function drawEventPetDetail(g) {
  const { ctx, R, TH, W, H, S } = V
  const idx = g._eventPetDetail
  if (idx == null) return
  const p = g._eventPetDetailData || (idx >= 0 && idx < g.pets.length ? g.pets[idx] : null)
  if (!p) return
  const ac = ATTR_COLOR[p.attr]

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

  const cardW = W * 0.78
  const descLines = wrapText(p.skill.desc, cardW - 60*S, 10)
  const cardH = Math.max(170*S, 80*S + descLines.length * 14*S + 50*S)
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
  R.drawInfoPanel(cardX, cardY, cardW, cardH)

  // 头像
  const avSz = 40*S
  const avX = cardX + 24*S, avY = cardY + 24*S
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
  ctx.strokeStyle = ac ? ac.main : '#999'; ctx.lineWidth = 1.5*S
  R.rr(avX, avY, avSz, avSz, 6*S); ctx.stroke()

  // 右侧信息
  const infoX = avX + avSz + 16*S
  let iy = cardY + 40*S
  ctx.textAlign = 'left'
  ctx.fillStyle = ac ? ac.dk || ac.main : '#3D2B1F'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(p.name, infoX, iy)
  iy += 20*S
  const orbR = 6*S
  R.drawBead(infoX + orbR, iy - 3*S, orbR, p.attr, 0)
  const starAtk = getPetStarAtk(p)
  const atkDisplay = (p.star || 1) > 1 ? `ATK: ${p.atk}→${starAtk}` : `ATK: ${p.atk}`
  ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(atkDisplay, infoX + orbR*2 + 8*S, iy)

  // 星级显示
  const starText = '★'.repeat(p.star || 1) + ((p.star || 1) < MAX_STAR ? '☆'.repeat(MAX_STAR - (p.star || 1)) : '')
  iy += 16*S
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(starText, infoX, iy)

  // 技能区域
  iy = avY + avSz + 12*S
  ctx.textAlign = 'left'
  ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`技能：${p.skill.name}`, cardX + 28*S, iy)
  iy += 16*S
  ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  descLines.forEach(line => {
    ctx.fillText(line, cardX + 28*S, iy)
    iy += 14*S
  })
  iy += 2*S
  ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(`CD：${p.cd} 回合`, cardX + 28*S, iy)

  // 点击任意位置关闭（无关闭按钮）
  g._eventPetDetailCloseRect = [0, 0, W, H]
}

// ===== 法宝详情弹窗（明亮说明面板） =====
function _drawWeaponDetailPopup(g) {
  const { ctx, R, TH, W, H, S } = V
  const wp = g._eventWpnDetailData
  if (!wp) return

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

  const cardW = W * 0.72, cardH = 110*S
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
  R.drawInfoPanel(cardX, cardY, cardW, cardH)

  const iconSz = 48*S
  const iconX = cardX + 16*S, iconY = cardY + 16*S
  ctx.fillStyle = '#E8E0D8'
  R.rr(iconX, iconY, iconSz, iconSz, 6*S); ctx.fill()
  const wImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
  if (wImg && wImg.width > 0) {
    ctx.save(); R.rr(iconX, iconY, iconSz, iconSz, 6*S); ctx.clip()
    ctx.drawImage(wImg, iconX, iconY, iconSz, iconSz)
    ctx.restore()
  }

  const textX = iconX + iconSz + 14*S
  ctx.textAlign = 'left'
  ctx.fillStyle = '#8B6914'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(wp.name, textX, cardY + 36*S)
  ctx.fillStyle = '#4A3B30'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  const descLines = wrapText(wp.desc, cardW - iconSz - 50*S, 11)
  let dy = cardY + 56*S
  descLines.forEach(line => {
    ctx.fillText(line, textX, dy)
    dy += 16*S
  })

  // 点击任意位置关闭（无关闭按钮）
  g._eventWpnDetailCloseRect = [0, 0, W, H]
}

module.exports = { rEvent, drawEventPetDetail }
