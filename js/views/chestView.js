/**
 * 宝箱奖励弹窗 — 里程碑逐条弹出式全屏遮罩
 *
 * 流程：
 *   initChestQueue(g)   → 收集未领取里程碑，立即领取第一条
 *   drawChestOverlay(g) → 渲染全屏遮罩（横幅 + 奖励图标 + 提示）
 *   tChestOverlay(g,…)  → 任意处点击：领取下一条或关闭
 *
 * 对外导出：
 *   initChestQueue, hasMore, drawChestOverlay, tChestOverlay
 */
const V = require('./env')
const { CHEST_MILESTONES, getUnclaimedChests } = require('../data/chestConfig')
const { getPetById, getPetAvatarPath } = require('../data/pets')

// ===== 队列状态 =====
let _queue = []       // 待展示的里程碑 id 数组
let _qIdx = 0         // 当前展示位置
let _curMilestone = null  // 当前里程碑定义
let _curRewards = null    // 当前领取后的已解析奖励数组

// ===== 公共 API =====

/**
 * 构建未领取队列，立即领取并缓存第一条奖励
 * 由宝箱按钮点击 / 自动触发时调用
 */
function initChestQueue(g) {
  const unclaimed = getUnclaimedChests(g.storage)
  _queue = unclaimed.map(m => m.id)
  _qIdx = 0
  _curMilestone = null
  _curRewards = null
  if (_queue.length > 0) {
    _claimCurrent(g)
  }
}

function hasMore() {
  return _qIdx < _queue.length
}

function _claimCurrent(g) {
  const id = _queue[_qIdx]
  if (!id) { _curMilestone = null; _curRewards = null; return }
  _curMilestone = CHEST_MILESTONES.find(m => m.id === id) || null
  const result = g.storage.claimChestReward(id)
  _curRewards = Array.isArray(result) ? result : []
}

// ===== 渲染 =====

function drawChestOverlay(g) {
  if (!g.showChestPanel || !hasMore()) return

  const { ctx: c, R, W, H, S } = V
  if (!_curMilestone) return

  c.save()

  // ── 全屏暗色遮罩 ──
  c.fillStyle = 'rgba(10,5,25,0.82)'
  c.fillRect(0, 0, W, H)

  // ── 光晕装饰（中心软发光） ──
  const glowGrad = c.createRadialGradient(W / 2, H * 0.52, 0, W / 2, H * 0.52, W * 0.55)
  glowGrad.addColorStop(0, 'rgba(200,160,60,0.12)')
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = glowGrad
  c.fillRect(0, 0, W, H)

  // ── 横幅 ──
  _drawBanner(c, R, W, H, S)

  // ── 奖励图标 ──
  if (_curRewards && _curRewards.length > 0) {
    _drawRewardRow(c, R, W, H, S, g, _curRewards)
  }

  // ── 底部点击提示 ──
  const hasNext = _qIdx + 1 < _queue.length
  c.globalAlpha = 0.6
  c.fillStyle = '#fff'
  c.font = `${11 * S}px "PingFang SC", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'bottom'
  c.fillText(hasNext ? '点击任意处领取下一个奖励' : '点击任意处关闭', W / 2, H - 36 * S)
  c.globalAlpha = 1

  c.restore()
}

function _drawBanner(c, R, W, H, S) {
  const bannerW = Math.min(W * 0.86, 520 * S)
  const bannerH = bannerW * (160 / 640)
  const bannerX = (W - bannerW) / 2
  const bannerY = H * 0.20

  const bannerImg = R.getImg('assets/ui/banner_reward.png')
  if (bannerImg && bannerImg.width > 0) {
    c.drawImage(bannerImg, bannerX, bannerY, bannerW, bannerH)
  } else {
    // fallback：渐变横幅
    const g2 = c.createLinearGradient(bannerX, 0, bannerX + bannerW, 0)
    g2.addColorStop(0, 'rgba(100,70,10,0)')
    g2.addColorStop(0.12, '#b07820')
    g2.addColorStop(0.5, '#f5d060')
    g2.addColorStop(0.88, '#b07820')
    g2.addColorStop(1, 'rgba(100,70,10,0)')
    c.fillStyle = g2
    R.rr(bannerX, bannerY, bannerW, bannerH, 8 * S)
    c.fill()
  }

  // 里程碑名称文字叠加在横幅中心
  c.save()
  c.fillStyle = '#3a1500'
  c.font = `bold ${15 * S}px "PingFang SC", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.shadowColor = 'rgba(255,220,100,0.8)'
  c.shadowBlur = 5 * S
  c.fillText(_curMilestone.name, W / 2, bannerY + bannerH / 2)
  c.restore()
}

function _drawRewardRow(c, R, W, H, S, g, rewards) {
  const iconSz = 72 * S
  const gap = 20 * S
  const labelH = 22 * S
  const total = rewards.length
  const rowW = total * iconSz + (total - 1) * gap
  const startX = (W - rowW) / 2
  const iconY = H * 0.48

  for (let i = 0; i < total; i++) {
    const r = rewards[i]
    const ix = startX + i * (iconSz + gap)
    _drawSingleIcon(c, R, S, g, r, ix, iconY, iconSz)

    // 数量/数值标签
    const label = _rewardLabel(r)
    if (label) {
      c.save()
      c.fillStyle = '#ffe8a0'
      c.font = `bold ${12 * S}px "PingFang SC", sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.shadowColor = 'rgba(0,0,0,0.6)'
      c.shadowBlur = 3 * S
      c.fillText(label, ix + iconSz / 2, iconY + iconSz + 6 * S)
      c.restore()
    }

    // 奖励类型小标签
    const typeName = _rewardTypeName(r)
    if (typeName) {
      c.save()
      c.fillStyle = 'rgba(255,255,255,0.5)'
      c.font = `${9 * S}px "PingFang SC", sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.fillText(typeName, ix + iconSz / 2, iconY + iconSz + 6 * S + labelH)
      c.restore()
    }
  }
}

function _drawSingleIcon(c, R, S, g, r, ix, iy, sz) {
  c.save()
  switch (r.type) {
    case 'fragment': {
      // 宠物头像 + 破碎框叠加
      const basePet = getPetById(r.petId)
      if (basePet) {
        const avatarPath = getPetAvatarPath({ ...basePet, star: 1 })
        const avatarImg = R.getImg(avatarPath)
        if (avatarImg && avatarImg.width > 0) {
          c.save()
          R.rr(ix, iy, sz, sz, 8 * S)
          c.clip()
          const aw = avatarImg.width, ah = avatarImg.height
          const scale = Math.max(sz / aw, sz / ah)
          const dw = aw * scale, dh = ah * scale
          c.drawImage(avatarImg, ix + (sz - dw) / 2, iy + (sz - dh) / 2, dw, dh)
          c.restore()
        } else {
          _drawCircleBg(c, ix, iy, sz, 'rgba(80,60,120,0.7)')
        }
      } else {
        _drawCircleBg(c, ix, iy, sz, 'rgba(80,60,120,0.7)')
      }

      // 破碎框叠加
      const frameImg = R.getImg('assets/ui/frame_fragment.png')
      if (frameImg && frameImg.width > 0) {
        c.drawImage(frameImg, ix, iy, sz, sz)
      } else {
        // fallback：虚线角标
        c.strokeStyle = '#3ABBA0'
        c.lineWidth = 2 * S
        c.setLineDash([4 * S, 4 * S])
        c.strokeRect(ix + S, iy + S, sz - 2 * S, sz - 2 * S)
        c.setLineDash([])
      }

      // 碎片数量角标
      const cnt = r.count || 1
      const badgeR = 12 * S
      c.fillStyle = '#c88830'
      c.beginPath()
      c.arc(ix + sz - badgeR, iy + sz - badgeR, badgeR, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#fff'
      c.font = `bold ${9 * S}px sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(`×${cnt}`, ix + sz - badgeR, iy + sz - badgeR)
      break
    }

    case 'stamina': {
      const img = R.getImg('assets/ui/icon_stamina.png')
      _drawIconBox(c, R, S, img, ix, iy, sz, '⚡', 'rgba(40,80,160,0.7)')
      break
    }

    case 'exp': {
      const img = R.getImg('assets/ui/icon_cult_exp.png')
      _drawIconBox(c, R, S, img, ix, iy, sz, '✨', 'rgba(160,120,20,0.7)')
      break
    }

    case 'petExp': {
      const img = R.getImg('assets/ui/icon_pet_exp.png')
      _drawIconBox(c, R, S, img, ix, iy, sz, '🔮', 'rgba(100,40,160,0.7)')
      break
    }

    case 'pet': {
      const basePet = r.petId ? getPetById(r.petId) : null
      if (basePet) {
        const avatarPath = getPetAvatarPath({ ...basePet, star: 1 })
        const img = R.getImg(avatarPath)
        if (img && img.width > 0) {
          c.save()
          R.rr(ix, iy, sz, sz, 8 * S)
          c.clip()
          const scale = Math.max(sz / img.width, sz / img.height)
          const dw = img.width * scale, dh = img.height * scale
          c.drawImage(img, ix + (sz - dw) / 2, iy + (sz - dh) / 2, dw, dh)
          c.restore()
          // 金色完整边框
          c.strokeStyle = '#ffe066'
          c.lineWidth = 2.5 * S
          R.rr(ix, iy, sz, sz, 8 * S)
          c.stroke()
        } else {
          _drawCircleBg(c, ix, iy, sz, 'rgba(60,120,60,0.7)')
          c.font = `${sz * 0.5}px sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText('🐾', ix + sz / 2, iy + sz / 2)
        }
      } else {
        _drawIconBox(c, R, S, null, ix, iy, sz, '🐾', 'rgba(60,120,60,0.7)')
      }
      break
    }

    default: {
      _drawIconBox(c, R, S, null, ix, iy, sz, '📦', 'rgba(80,80,80,0.7)')
      break
    }
  }
  c.restore()
}

function _drawCircleBg(c, ix, iy, sz, color) {
  c.fillStyle = color
  c.beginPath()
  c.arc(ix + sz / 2, iy + sz / 2, sz / 2, 0, Math.PI * 2)
  c.fill()
}

function _drawIconBox(c, R, S, img, ix, iy, sz, emoji, bgColor) {
  if (img && img.width > 0) {
    c.drawImage(img, ix, iy, sz, sz)
  } else {
    _drawCircleBg(c, ix, iy, sz, bgColor)
    c.fillStyle = '#fff'
    c.font = `${sz * 0.5}px sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(emoji, ix + sz / 2, iy + sz / 2)
  }
}

function _rewardLabel(r) {
  switch (r.type) {
    case 'fragment': {
      const pet = getPetById(r.petId)
      return pet ? pet.name : (r.petName || '')
    }
    case 'pet':    return r.petName || (r.petId && (getPetById(r.petId) || {}).name) || '新灵宠'
    case 'exp':    return `+${r.amount}`
    case 'petExp': return `+${r.amount}`
    case 'stamina':return `+${r.amount}`
    default:       return ''
  }
}

function _rewardTypeName(r) {
  switch (r.type) {
    case 'fragment': return '宠物碎片'
    case 'pet':      return '新灵宠'
    case 'exp':      return '修炼经验'
    case 'petExp':   return '宠物经验'
    case 'stamina':  return '体力'
    default:         return ''
  }
}

// ===== 触摸处理 =====

function tChestOverlay(g, type, x, y) {
  if (!g.showChestPanel) return false
  if (type !== 'end') return true  // 消费所有触摸，防止穿透

  // 任意点击：前进到下一条或关闭遮罩
  _qIdx++
  if (_qIdx < _queue.length) {
    _claimCurrent(g)
  } else {
    g.showChestPanel = false
    _queue = []
    _qIdx = 0
    _curMilestone = null
    _curRewards = null
  }
  return true
}

module.exports = { initChestQueue, hasMore, drawChestOverlay, tChestOverlay }
