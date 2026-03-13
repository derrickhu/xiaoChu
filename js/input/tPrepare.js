/**
 * 触摸处理：准备 (prepare) 场景
 */
const { hasSameIdOnTeam } = require('../data/pets')
const { prepBagScrollStart, prepBagScrollMove, prepBagScrollEnd } = require('../views/prepareView')

let _prepScrolling = false
let _prepScrollMoved = false
let _prepDragWpn = null

function tPrepare(g, type, x, y) {
  if (type === 'start') {
    _prepScrollMoved = false
    if (g.prepareTab === 'weapon') {
      if (g.weapon && g._prepCurWpnRect && g._hitRect(x,y,...g._prepCurWpnRect)) {
        _prepDragWpn = { source:'equipped', index:0, weapon:g.weapon, x, y, startX:x, startY:y, moved:false }
        g._prepDragWpn = _prepDragWpn
        return
      }
      if (g._prepWpnBagRects) {
        for (let i = 0; i < g._prepWpnBagRects.length; i++) {
          const [bx,by,bw,bh] = g._prepWpnBagRects[i]
          if (g._hitRect(x,y,bx,by,bw,bh) && g.weaponBag[i]) {
            _prepDragWpn = { source:'bag', index:i, weapon:g.weaponBag[i], x, y, startX:x, startY:y, moved:false }
            g._prepDragWpn = _prepDragWpn
            return
          }
        }
      }
    }
    _prepScrolling = prepBagScrollStart(g, y)
    return
  }
  if (type === 'move') {
    if (_prepDragWpn) {
      _prepDragWpn.x = x; _prepDragWpn.y = y
      const dx = x - _prepDragWpn.startX, dy = y - _prepDragWpn.startY
      if (dx*dx + dy*dy > 100) _prepDragWpn.moved = true
      return
    }
    if (_prepScrolling) {
      prepBagScrollMove(y)
      _prepScrollMoved = true
    }
    return
  }
  // type === 'end'
  if (_prepDragWpn) {
    const drag = _prepDragWpn
    _prepDragWpn = null
    g._prepDragWpn = null
    if (drag.moved) {
      if (drag.source === 'bag') {
        if (g._prepCurWpnRect && g._hitRect(x,y,...g._prepCurWpnRect)) {
          const old = g.weapon
          g.weapon = g.weaponBag[drag.index]
          if (old) { g.weaponBag[drag.index] = old }
          else { g.weaponBag.splice(drag.index, 1) }
        }
      } else {
        if (g._prepWpnBagRects) {
          for (let i = 0; i < g._prepWpnBagRects.length; i++) {
            const [bx,by,bw,bh] = g._prepWpnBagRects[i]
            if (g._hitRect(x,y,bx,by,bw,bh) && g.weaponBag[i]) {
              const old = g.weapon
              g.weapon = g.weaponBag[i]
              if (old) { g.weaponBag[i] = old }
              return
            }
          }
        }
      }
    } else {
      if (drag.source === 'equipped') {
        g.prepareTip = { type:'weapon', data: drag.weapon, x, y }
      } else {
        g.prepareTip = { type:'weapon', data: drag.weapon, x, y }
      }
    }
    return
  }
  if (_prepScrolling) {
    prepBagScrollEnd()
    _prepScrolling = false
    if (_prepScrollMoved) return
  }

  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g.setScene('event'); return }
  if (g.prepareTip) { g.prepareTip = null; return }
  if (g._prepPetTabRect && g._hitRect(x,y,...g._prepPetTabRect)) { g.prepareTab = 'pets'; g.prepareSelBagIdx = -1; g.prepareSelSlotIdx = -1; g.prepareTip = null; return }
  if (g._prepWpnTabRect && g._hitRect(x,y,...g._prepWpnTabRect)) { g.prepareTab = 'weapon'; g.prepareTip = null; return }

  if (g.prepareTab === 'pets') {
    if (g._prepSlotRects) {
      for (let i = 0; i < g._prepSlotRects.length; i++) {
        if (g._hitRect(x,y,...g._prepSlotRects[i])) {
          if (g.prepareSelSlotIdx === i && g.pets[i]) {
            g.prepareTip = { type:'pet', data: g.pets[i], x, y }; return
          }
          g.prepareSelSlotIdx = i; return
        }
      }
    }
    if (g._prepBagRects) {
      for (let i = 0; i < g._prepBagRects.length; i++) {
        if (g._hitRect(x,y,...g._prepBagRects[i]) && g.petBag[i]) {
          if (g.prepareSelBagIdx === i) {
            g.prepareTip = { type:'pet', data: g.petBag[i], x, y }; return
          }
          g.prepareSelBagIdx = i; return
        }
      }
    }
    if (g._prepSwapBtnRect && g._hitRect(x,y,...g._prepSwapBtnRect)) {
      const si = g.prepareSelSlotIdx, bi = g.prepareSelBagIdx
      if (si >= 0 && bi >= 0 && g.petBag[bi]) {
        if (hasSameIdOnTeam(g.pets, g.petBag[bi].id, si)) return
        const tmp = g.pets[si]
        g.pets[si] = g.petBag[bi]
        g.pets[si].currentCd = 0
        if (tmp) { g.petBag[bi] = tmp }
        else { g.petBag.splice(bi, 1) }
        g.prepareSelSlotIdx = -1; g.prepareSelBagIdx = -1
      }
      return
    }
  }
  if (g._prepGoBtnRect && g._hitRect(x,y,...g._prepGoBtnRect)) {
    g._enterEvent(); return
  }
}

module.exports = tPrepare
