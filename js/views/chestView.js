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
const MusicMgr = require('../runtime/music')

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
    _claimCurrent(g, true)  // 延迟音效，等宝箱打开声先播完
  }
}

function hasMore() {
  return _qIdx < _queue.length
}

function _claimCurrent(g, delaySound = false) {
  const id = _queue[_qIdx]
  if (!id) { _curMilestone = null; _curRewards = null; return }
  _curMilestone = CHEST_MILESTONES.find(m => m.id === id) || null
  const result = g.storage.claimChestReward(id)
  _curRewards = Array.isArray(result) ? result : []

  // 播放奖励音效，取首个奖励类型决定音色
  const primaryType = (_curRewards[0] || {}).type
  if (primaryType) {
    if (delaySound) {
      // 首次展示：等宝箱打开音效完成后再播放
      setTimeout(() => MusicMgr.playChestReward(primaryType), 420)
    } else {
      MusicMgr.playChestReward(primaryType)
    }
  }
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
  const bannerBottom = _drawBanner(c, R, W, H, S)

  // ── 故事描述 ──
  if (_curMilestone.desc) {
    _drawDesc(c, W, S, _curMilestone.desc, bannerBottom)
  }

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

  return bannerY + bannerH
}

function _drawDesc(c, W, S, text, topY) {
  const { H } = V
  const maxW = W * 0.78
  const lineH = 18 * S
  const fontSize = 12 * S

  c.save()
  c.font = `${fontSize}px "PingFang SC", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'top'

  // 手动换行：按字符宽度切割
  const chars = text.split('')
  const lines = []
  let cur = ''
  for (const ch of chars) {
    const testW = c.measureText(cur + ch).width
    if (testW > maxW && cur.length > 0) {
      lines.push(cur)
      cur = ch
    } else {
      cur += ch
    }
  }
  if (cur) lines.push(cur)

  const totalH = lines.length * lineH
  // 垂直居中于横幅底部与奖励区顶部之间
  const rewardTop = H * 0.48
  const startY = topY + Math.max(8 * S, (rewardTop - topY - totalH) / 2)

  // 淡金色描边 + 暖白主文字
  lines.forEach((line, i) => {
    const y = startY + i * lineH
    c.strokeStyle = 'rgba(80,40,0,0.6)'
    c.lineWidth = 3 * S
    c.strokeText(line, W / 2, y)
    c.fillStyle = 'rgba(255,240,190,0.92)'
    c.fillText(line, W / 2, y)
  })

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

    case 'soulStone': {
      const img = R.getImg('assets/ui/icon_soul_stone.png')
      _drawIconBox(c, R, S, img, ix, iy, sz, '🔮', 'rgba(100,40,160,0.7)')
      break
    }

    case 'avatar': {
      // 新修炼形象：显示立绘图 + 金色边框
      const CHAR_SIT = {
        boy1: 'assets/hero/char_boy1.png', girl1: 'assets/hero/char_girl1.png',
        boy2: 'assets/hero/char_boy2.png', girl2: 'assets/hero/char_girl2.png',
        boy3: 'assets/hero/char_boy3.png', girl3: 'assets/hero/char_girl3.png',
      }
      const sitPath = CHAR_SIT[r.avatarId]
      const sitImg = sitPath ? R.getImg(sitPath) : null
      if (sitImg && sitImg.width > 0) {
        c.save()
        R.rr(ix, iy, sz, sz, 8 * S)
        c.clip()
        // 裁正方形（取顶部居中）
        const cropSz = Math.min(sitImg.width, sitImg.height * 0.65)
        const srcX = (sitImg.width - cropSz) / 2
        c.drawImage(sitImg, srcX, 0, cropSz, cropSz, ix, iy, sz, sz)
        c.restore()
        // 金色外框
        c.strokeStyle = '#ffe066'; c.lineWidth = 2.5 * S
        R.rr(ix, iy, sz, sz, 8 * S); c.stroke()
        // 顶部"新形象"标签
        const tagH = 18 * S, tagW = sz * 0.7
        const tagX = ix + (sz - tagW) / 2, tagY = iy + sz - tagH
        c.fillStyle = 'rgba(180,130,10,0.88)'
        R.rr(tagX, tagY, tagW, tagH, tagH / 2); c.fill()
        c.fillStyle = '#fff8cc'; c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText('新形象', ix + sz / 2, tagY + tagH / 2)
      } else {
        _drawCircleBg(c, ix, iy, sz, 'rgba(180,130,20,0.7)')
        c.fillStyle = '#fff'; c.font = `${sz * 0.4}px sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText('🧙', ix + sz / 2, iy + sz / 2)
      }
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

const _AVATAR_LABEL = {
  boy1: '修仙少年', girl1: '灵木仙子',
  boy2: '剑灵少侠', girl2: '星月仙子',
  boy3: '天罡道童', girl3: '花灵仙子',
}

function _rewardLabel(r) {
  switch (r.type) {
    case 'fragment': {
      const pet = getPetById(r.petId)
      return pet ? pet.name : (r.petName || '')
    }
    case 'pet':    return r.petName || (r.petId && (getPetById(r.petId) || {}).name) || '新灵宠'
    case 'exp':    return `+${r.amount}`
    case 'soulStone': return `+${r.amount}`
    case 'stamina':return `+${r.amount}`
    case 'avatar': return _AVATAR_LABEL[r.avatarId] || r.avatarId
    default:       return ''
  }
}

function _rewardTypeName(r) {
  switch (r.type) {
    case 'fragment': return '宠物碎片'
    case 'pet':      return '新灵宠'
    case 'exp':      return '修炼经验'
    case 'soulStone':   return '灵石'
    case 'stamina':  return '体力'
    case 'avatar':   return '修炼形象'
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
