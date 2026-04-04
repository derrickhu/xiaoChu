/**
 * 教学引导覆盖层：故事卡、步骤引导、总结页
 */
const V = require('../env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY, ENEMY_SKILLS } = require('../../data/tower')
const { petHasSkill, getPetSkillDesc } = require('../../data/pets')
const tutorial = require('../../engine/tutorial')
const { drawPanel, drawRibbonIcon } = require('../uiComponents')

// ===== 教学引导覆盖层 =====
function drawTutorialOverlay(g) {
  if (!tutorial.isActive()) return
  const { ctx, R, TH, W, H, S } = V
  const data = tutorial.getGuideData()
  if (!data) return

  // ---- 总结页 ----
  if (data.isSummary) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H)
    const panelW = W * 0.82, panelH = 285*S
    const panelX = (W - panelW) / 2, panelY = (H - panelH) / 2
    R.drawInfoPanel(panelX, panelY, panelW, panelH)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#C07000'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('修仙要诀', W*0.5, panelY + 36*S)

    const tips = [
      '① 按住拖动灵珠，沿途交换排列三连消除',
      '② Combo越多，伤害越高',
      '③ 克制x2.5伤害，被克x0.5伤害',
      '④ 上划释放宠物技能',
      '⑤ 粉色心珠可回复生命',
      '⑥ 法宝自动生效，给你额外的战斗优势',
    ]
    ctx.fillStyle = '#3D2B1F'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    tips.forEach((t, i) => {
      ctx.fillText(t, W*0.5, panelY + 66*S + i * 24*S)
    })

    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    const pulse = 0.6 + 0.4 * Math.sin(g.af * 0.08)
    ctx.globalAlpha = pulse
    ctx.fillText('大道已明，开始通天之旅！', W*0.5, panelY + panelH - 30*S)
    ctx.globalAlpha = 1.0

    ctx.fillStyle = '#8B7B70'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.fillText('点击屏幕继续', W*0.5, panelY + panelH - 10*S)
    return
  }

  // ---- preIntro阶段：代入式故事卡 ----
  if (data.phase === 'preIntro') {
    const card = data.storyCards[data.storyPage]
    if (!card) return
    const alpha = data.storyAlpha
    ctx.save()
    // 全屏暗底
    ctx.globalAlpha = alpha * 0.75
    ctx.fillStyle = '#0a0814'
    ctx.fillRect(0, 0, W, H)

    // 面板
    const pw = W * 0.86, ph = 300 * S
    const px = (W - pw) / 2, py = (H - ph) / 2 - 20 * S
    ctx.globalAlpha = alpha
    const _ribbonH = 44 * S

    const { ribbonCY } = drawPanel(ctx, S, px, py, pw, ph, { ribbonH: _ribbonH })
    drawRibbonIcon(ctx, S, px, ribbonCY, card.icon || '★')

    // 标题
    ctx.fillStyle = '#3a1a00'
    ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(card.heading, W / 2 + 12 * S, ribbonCY)

    // 正文行
    const lineH = 28 * S
    const textStartY = py + _ribbonH + 28 * S
    ctx.fillStyle = '#4a3820'
    ctx.font = `${13 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ;(card.lines || []).forEach((line, i) => {
      ctx.fillText(line, W / 2, textStartY + i * lineH)
    })

    // 备注行
    if (card.note) {
      const noteY = textStartY + (card.lines || []).length * lineH + 16 * S
      ctx.fillStyle = '#b06010'
      ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
      ctx.fillText(card.note, W / 2, noteY)
    }

    // 翻页进度点
    const total = data.storyCards.length
    if (total > 1) {
      const dotR = 4 * S, dotGap = 14 * S
      const dotsW = total * dotGap
      const dotsX = W / 2 - dotsW / 2 + dotGap / 2
      const dotsY = py + ph - 38 * S
      for (let i = 0; i < total; i++) {
        ctx.beginPath()
        ctx.arc(dotsX + i * dotGap, dotsY, dotR, 0, Math.PI * 2)
        ctx.fillStyle = i === data.storyPage ? '#c07820' : 'rgba(160,120,40,0.3)'
        ctx.fill()
      }
    }

    // 点击继续提示
    const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.1)
    ctx.globalAlpha = alpha * (0.5 + 0.4 * pulse)
    ctx.fillStyle = '#8a6030'
    ctx.font = `${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const isLast = data.storyPage >= total - 1
    ctx.fillText(isLast ? '点击进入战斗' : '点击继续', W / 2, py + ph - 16 * S)

    ctx.restore()
    return
  }

  // ---- Intro阶段：步骤标题卡 ----
  if (data.phase === 'intro') {
    const alpha = Math.min(1, data.introTimer / 30)
    ctx.save()
    ctx.globalAlpha = alpha * 0.72
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = alpha

    // 面板
    const pw = W * 0.86, ph = data.round === 0 ? 220 * S : 120 * S
    const px = (W - pw) / 2, py = (H - ph) / 2 - 10 * S
    const ribbonH = 40 * S

    const { ribbonCY: _rcy } = drawPanel(ctx, S, px, py, pw, ph, { ribbonH })

    if (data.round === 0) {
      // 步骤首回合：完整标题卡
      // 课数标签（装饰条内左侧）
      ctx.fillStyle = '#5a3000'
      ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(`第${data.step + 1}课`, px + 20 * S, _rcy)

      // 步骤标题（装饰条内居中）
      ctx.fillStyle = '#3a1a00'
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(data.title, W * 0.5 + 16 * S, _rcy)

      // 说明文字
      const startMsg = data.msgs.find(m => m.timing === 'start')
      if (startMsg) {
        ctx.fillStyle = '#4a3820'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(startMsg.text, W * 0.5, py + ribbonH + (ph - ribbonH) * 0.42)
      }

      // 点击提示
      const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.1)
      ctx.globalAlpha = alpha * (0.45 + 0.45 * pulse)
      ctx.fillStyle = '#8a6030'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText('点击屏幕开始', W * 0.5, py + ph - 14 * S)
    } else {
      // 后续回合：轻量提示横幅
      const startMsg = data.msgs.find(m => m.timing === 'start')
      ctx.fillStyle = '#3a1a00'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      if (startMsg) ctx.fillText(startMsg.text, W * 0.5, _rcy)

      const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.1)
      ctx.globalAlpha = alpha * (0.45 + 0.45 * pulse)
      ctx.fillStyle = '#8a6030'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText('点击屏幕继续', W * 0.5, py + ph - 14 * S)
    }

    ctx.restore()
    return
  }

  // ---- Play阶段：引导箭头 + 提示文字 ----
  if (data.phase === 'play') {
    const cs = g.cellSize, bx = g.boardX, by = g.boardY

    // 步骤标签（左上角小标签）
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    const lblW = 80*S, lblH = 22*S, lblX = (W - lblW)/2, lblY = by - 32*S
    R.rr(lblX, lblY, lblW, lblH, 4*S); ctx.fill()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`教学 ${data.step + 1}/4`, lblX + lblW/2, lblY + lblH/2)
    ctx.restore()

    // 引导路径 + 动画（未完成引导时始终显示路径，拖动中也保留）
    if (data.guide && !data.guideDone && g.bState === 'playerTurn') {
      const guide = data.guide
      const path = guide.path
      const t = data.arrowTimer
      const isDragging = !!g.dragging

      // 计算拖动进度（当前珠子在路径中的位置索引）
      let dragIdx = 0
      if (isDragging) {
        dragIdx = path.findIndex(([pr, pc]) => pr === g.dragR && pc === g.dragC)
        if (dragIdx === -1) dragIdx = 0
      }

      // === 起始珠高亮（仅未拖动时） ===
      if (!isDragging) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.12)
        const startCX = bx + guide.fromC * cs + cs/2
        const startCY = by + guide.fromR * cs + cs/2
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = pulse * 0.5
        const startGlow = ctx.createRadialGradient(startCX, startCY, cs*0.2, startCX, startCY, cs*0.75)
        startGlow.addColorStop(0, '#ffee55')
        startGlow.addColorStop(0.5, '#ffd700aa')
        startGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = startGlow
        ctx.beginPath(); ctx.arc(startCX, startCY, cs*0.75, 0, Math.PI*2); ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 0.7 + pulse * 0.3
        ctx.strokeStyle = '#ffcc00'
        ctx.lineWidth = 3.5*S
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10*S
        ctx.strokeRect(bx + guide.fromC * cs + 1, by + guide.fromR * cs + 1, cs - 2, cs - 2)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 0.85
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3*S
        ctx.fillText('按住', startCX, by + guide.fromR * cs - 2*S)
        ctx.shadowBlur = 0
        ctx.restore()
      }

      // === 路径格子高亮（拖动时只显示尚未到达的格子） ===
      const startIdx = isDragging ? dragIdx + 1 : 1
      if (path.length > startIdx) {
        ctx.save()
        for (let pi = startIdx; pi < path.length; pi++) {
          const [pr, pc] = path[pi]
          const cellCX = bx + pc * cs + cs/2, cellCY = by + pr * cs + cs/2
          const cellX = bx + pc * cs, cellY = by + pr * cs
          const wavePhase = (t * 0.1 + pi * 1.2) % (Math.PI * 2)
          const waveAlpha = 0.25 + 0.2 * Math.sin(wavePhase)
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = waveAlpha * 0.6
          const cellGlow = ctx.createRadialGradient(cellCX, cellCY, 0, cellCX, cellCY, cs*0.5)
          cellGlow.addColorStop(0, '#ffffff')
          cellGlow.addColorStop(0.4, '#44ddff')
          cellGlow.addColorStop(1, 'transparent')
          ctx.fillStyle = cellGlow
          ctx.beginPath(); ctx.arc(cellCX, cellCY, cs*0.5, 0, Math.PI*2); ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
          ctx.globalAlpha = waveAlpha + 0.15
          ctx.strokeStyle = '#44ddff'
          ctx.lineWidth = 2*S
          ctx.strokeRect(cellX + 2, cellY + 2, cs - 4, cs - 4)
          // 序号（拖动时显示剩余步数，未拖动时显示路径序号）
          const label = isDragging ? `${pi - dragIdx}` : `${pi}`
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(wavePhase)
          ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
          ctx.strokeText(label, cellCX, cellCY)
          ctx.fillStyle = '#fff'
          ctx.fillText(label, cellCX, cellCY)
        }
        ctx.restore()
      }

      // === 路径线（拖动时从当前位置到终点，未拖动时全路径） ===
      const lineStartIdx = isDragging ? Math.max(0, dragIdx) : 0
      ctx.save()
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8*S
      ctx.strokeStyle = isDragging ? 'rgba(255,200,0,0.3)' : 'rgba(255,200,0,0.4)'
      ctx.lineWidth = 6*S
      ctx.beginPath()
      for (let i = lineStartIdx; i < path.length; i++) {
        const px = bx + path[i][1] * cs + cs/2
        const py = by + path[i][0] * cs + cs/2
        if (i === lineStartIdx) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.strokeStyle = isDragging ? 'rgba(255,230,100,0.45)' : 'rgba(255,230,100,0.65)'
      ctx.lineWidth = 3*S
      ctx.beginPath()
      for (let i = lineStartIdx; i < path.length; i++) {
        const px = bx + path[i][1] * cs + cs/2
        const py = by + path[i][0] * cs + cs/2
        if (i === lineStartIdx) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1.5*S
      ctx.setLineDash([5*S, 5*S])
      ctx.lineDashOffset = -t * 0.8
      ctx.beginPath()
      for (let i = lineStartIdx; i < path.length; i++) {
        const px = bx + path[i][1] * cs + cs/2
        const py = by + path[i][0] * cs + cs/2
        if (i === lineStartIdx) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([]); ctx.lineDashOffset = 0

      // === 终点标记 ===
      const lastP = path[path.length - 1]
      const endX = bx + lastP[1] * cs + cs/2
      const endY = by + lastP[0] * cs + cs/2
      const endPulse = 0.5 + 0.5 * Math.sin(t * 0.15)
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = endPulse * 0.4
      const endGlow = ctx.createRadialGradient(endX, endY, cs*0.1, endX, endY, cs*0.6)
      endGlow.addColorStop(0, '#ff6644')
      endGlow.addColorStop(0.5, '#ff440066')
      endGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = endGlow
      ctx.beginPath(); ctx.arc(endX, endY, cs*0.6, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 0.6 + endPulse * 0.4
      ctx.strokeStyle = '#ff6644'; ctx.lineWidth = 2.5*S
      ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 6*S
      ctx.beginPath(); ctx.arc(endX, endY, cs * 0.35, 0, Math.PI * 2); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 0.3 + endPulse * 0.3
      ctx.strokeStyle = '#ff8866'; ctx.lineWidth = 1.5*S
      ctx.beginPath(); ctx.arc(endX, endY, cs * 0.48, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // === 手指动画（仅未拖动时） ===
      if (!isDragging) {
        const fromX = bx + guide.fromC * cs + cs/2
        const fromY = by + guide.fromR * cs + cs/2
        const animDur = Math.max(150, path.length * 35)
        const progress = (t % animDur) / animDur
        let fingerCX, fingerCY
        if (path.length >= 2) {
          const totalSegs = path.length - 1
          const segFloat = progress * totalSegs
          const segIdx = Math.min(Math.floor(segFloat), totalSegs - 1)
          const segProg = segFloat - segIdx
          const [r1, c1] = path[segIdx]
          const [r2, c2] = path[Math.min(segIdx + 1, path.length - 1)]
          fingerCX = bx + (c1 + (c2 - c1) * segProg) * cs + cs/2
          fingerCY = by + (r1 + (r2 - r1) * segProg) * cs + cs/2
        } else {
          fingerCX = fromX; fingerCY = fromY
        }
        ctx.save()
        const fingerAlpha = progress < 0.08 ? progress / 0.08 : (progress > 0.88 ? (1 - progress) / 0.12 : 1)
        ctx.globalAlpha = fingerAlpha * 0.92
        if (progress > 0.05 && progress < 0.9) {
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = fingerAlpha * 0.25
          const trailGrd = ctx.createRadialGradient(fingerCX, fingerCY, 2*S, fingerCX, fingerCY, 22*S)
          trailGrd.addColorStop(0, '#ffd700')
          trailGrd.addColorStop(0.5, '#ffd70044')
          trailGrd.addColorStop(1, 'transparent')
          ctx.fillStyle = trailGrd
          ctx.beginPath(); ctx.arc(fingerCX, fingerCY, 22*S, 0, Math.PI*2); ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
        }
        ctx.globalAlpha = fingerAlpha * 0.92
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12*S
        ctx.fillStyle = 'rgba(255,215,0,0.35)'
        ctx.beginPath(); ctx.arc(fingerCX, fingerCY + 6*S, 20*S, 0, Math.PI*2); ctx.fill()
        ctx.shadowBlur = 0
        ctx.fillStyle = '#ffffffee'
        ctx.beginPath(); ctx.arc(fingerCX, fingerCY + 10*S, 10*S, 0, Math.PI*2); ctx.fill()
        ctx.beginPath()
        ctx.moveTo(fingerCX, fingerCY - 4*S)
        ctx.lineTo(fingerCX - 7*S, fingerCY + 10*S)
        ctx.lineTo(fingerCX + 7*S, fingerCY + 10*S)
        ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#ffd700'
        ctx.beginPath(); ctx.arc(fingerCX, fingerCY - 1*S, 3*S, 0, Math.PI*2); ctx.fill()
        ctx.restore()
      }
    }

    // === 目标说明文字（拖动前后始终显示） ===
    if (data.goalText && !data.guideDone && g.bState === 'playerTurn') {
      ctx.save()
      const goalW = W * 0.88, goalH = 28*S
      const goalX = (W - goalW) / 2, goalY = by - 56*S
      const goalGrd = ctx.createLinearGradient(goalX, goalY, goalX + goalW, goalY)
      goalGrd.addColorStop(0, 'rgba(20,60,100,0.85)')
      goalGrd.addColorStop(1, 'rgba(20,40,80,0.85)')
      ctx.fillStyle = goalGrd
      R.rr(goalX, goalY, goalW, goalH, 6*S); ctx.fill()
      ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = 1*S
      R.rr(goalX, goalY, goalW, goalH, 6*S); ctx.stroke()
      ctx.fillStyle = '#88ddff'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(data.goalText, W*0.5, goalY + goalH/2)
      ctx.restore()
    }

    // afterElim消息
    if (data.afterElimShown) {
      const afterMsg = data.msgs.find(m => m.timing === 'afterElim')
      if (afterMsg) {
        ctx.save()
        const msgW = W * 0.85, msgH = 30*S
        const msgX = (W - msgW) / 2, msgY = by - 60*S
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        R.rr(msgX, msgY, msgW, msgH, 6*S); ctx.fill()
        ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(afterMsg.text, W*0.5, msgY + msgH/2)
        ctx.restore()
      }
    }

    // skillReady提示（step 3）
    if (data.step === 3) {
      const readyPetIdx = g.pets.findIndex(p => petHasSkill(p) && p.currentCd <= 0)
      if (readyPetIdx >= 0 && g.bState === 'playerTurn' && !g.dragging) {
        const skillMsg = data.msgs.find(m => m.timing === 'skillReady')
        if (skillMsg && g._petBtnRects && g._petBtnRects[readyPetIdx]) {
          ctx.save()
          const [px, py, pw, ph] = g._petBtnRects[readyPetIdx]
          // 上方箭头
          const arrowX = px + pw/2
          const arrowY = py - 20*S - Math.sin(g.af * 0.1) * 5*S
          ctx.fillStyle = '#ffd700'
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(g.af * 0.08)
          ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8*S
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY)
          ctx.lineTo(arrowX - 8*S, arrowY - 12*S)
          ctx.lineTo(arrowX + 8*S, arrowY - 12*S)
          ctx.closePath(); ctx.fill()
          ctx.shadowBlur = 0
          // 文字提示
          const msgW = W * 0.78, msgH = 28*S
          const msgX = (W - msgW) / 2, msgY = py - 60*S
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.globalAlpha = 1
          R.rr(msgX, msgY, msgW, msgH, 6*S); ctx.fill()
          ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(skillMsg.text, W*0.5, msgY + msgH/2)
          ctx.restore()
        }
      }
    }

    // 教学中胜利提示（step 0-3，非最终步骤）
    if (g.bState === 'victory' && data.step < 3) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText('通过！', W*0.5, H*0.42)
      const stepMsgs = [
        '记住：拖珠与路上的珠子交换位置！',
        'Combo让你更强！心珠是你的生命线！',
        '克制属性造成2.5倍伤害，被克只有0.5倍！',
      ]
      ctx.fillStyle = '#fff'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
      ctx.fillText(stepMsgs[data.step], W*0.5, H*0.50)
      const pulseA = 0.5 + 0.5 * Math.sin(g.af * 0.08)
      ctx.globalAlpha = pulseA
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.fillText('点击继续', W*0.5, H*0.58)
      ctx.restore()
    }

  }
}

module.exports = { drawTutorialOverlay }
