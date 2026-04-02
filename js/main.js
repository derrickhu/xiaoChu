/**
 * 灵宠消消塔 - 主游戏逻辑
 * Roguelike爬塔 + 智龙迷城式拖拽转珠 + 五行克制
 * 无局外养成，死亡即重开，仅记录最高层数
 */
const P = require('./platform')
const { Render, TH } = require('./render')
const Storage = require('./data/storage')
const { generateRewards, MAX_FLOOR } = require('./data/tower')
const { getMaxedPetIds } = require('./data/pets')
const MusicMgr = require('./runtime/music')
const TinyEmitter = require('./libs/tinyemitter')
const ViewEnv = require('./views/env')
const screens = require('./views/screens')
const cultView = require('./views/cultivationView')
const petPoolView = require('./views/petPoolView')
const petDetailView = require('./views/petDetailView')
const stageInfoView = require('./views/stageInfoView')
const stageTeamView = require('./views/stageTeamView')
const stageResultView = require('./views/stageResultView')
const idleView = require('./views/idleView')
const titleView = require('./views/titleView')
const prepareView = require('./views/prepareView')
const eventView = require('./views/eventView')
const battleView = require('./views/battleView')
const dialogs = require('./views/dialogs')
const touchH = require('./input/touchHandlers')
const battleEngine = require('./engine/battle')
const skillEngine = require('./engine/skills')
const anim = require('./engine/animations')
const runMgr = require('./engine/runManager')
const tutorial = require('./engine/tutorial')
const { initState } = require('./gameState')
const introView = require('./views/introView')
const guideOverlay = require('./views/guideOverlay')
const guideMgr = require('./engine/guideManager')
const bh = require('./battleHelpers')
const wxBtns = require('./wxButtons')
const share = require('./share')
const TweenMgr = require('./engine/tween')
const Particles = require('./engine/particles')
const stageMgr = require('./engine/stageManager')

// 复用 game.js 创建的主Canvas（第一个createCanvas是屏幕Canvas，再创建就是离屏的了）
const canvas = GameGlobal.__mainCanvas || P.createCanvas()
const ctx = canvas.getContext('2d')
const _winInfo = P.getWindowInfo()
const _devInfo = P.getDeviceInfo()
const dpr = _winInfo.pixelRatio || 2
canvas.width = _winInfo.windowWidth * dpr
canvas.height = _winInfo.windowHeight * dpr
const W = canvas.width, H = canvas.height
const S = W / 375
console.log(`[Canvas] ${W}x${H}, dpr=${dpr}, S=${S.toFixed(2)}, platform=${_devInfo.platform}`)
const safeTop = ((_winInfo.safeArea && _winInfo.safeArea.top) || 20) * dpr

const COLS = 6, ROWS = 5
const R = new Render(ctx, W, H, S, safeTop)
ViewEnv.init(ctx, R, TH, W, H, S, safeTop, COLS, ROWS, P)

class Main {
  constructor() {
    this.storage = new Storage()
    this.scene = 'loading'
    this.af = 0

    // 邀请系统：检查 onShow query 中的 inviter 参数
    if (GameGlobal.__inviterId) {
      this.storage.processInvite(GameGlobal.__inviterId)
      GameGlobal.__inviterId = null
    }

    // 事件总线：新增/修改模块优先使用 g.events 解耦通信
    this.events = new TinyEmitter()
    this.storage._eventBus = this.events

    // 排行榜异步加载状态变化时，标记需要重绘
    this.events.on('ranking:dirty', () => { this._dirty = true })

    // 云同步恢复老玩家数据时，跳过新手漫画/教学（修复清除缓存后重进的问题）
    this.events.on('cloud:veteranRestored', () => {
      if (this.scene === 'intro') {
        console.log('[Main] 云端已恢复老玩家数据，跳过开场漫画')
        this.setScene('title'); MusicMgr.playBgm()
      } else if (this.scene === 'battle' && tutorial.isActive()) {
        console.log('[Main] 云端已恢复老玩家数据，跳过战斗教学')
        // 不调用 tutorial.finish() —— 它会触发 nextFloor 进入正式局
        // 仅清理教学激活状态，然后安全回到首页
        tutorial._forceDeactivate && tutorial._forceDeactivate()
        this.bState = 'none'
        this.setScene('title'); MusicMgr.playBgm()
      }
    })

    initState(this)
    // 从存档恢复BGM音量设置
    const savedBgmVol = this.storage.settings.bgmVolume
    MusicMgr.setBgmVolume((savedBgmVol != null ? savedBgmVol : 50) / 100)
    R._onImageLoad = () => { this._dirty = true }

    this.events.on('scene:change', (newScene, oldScene) => {
      if (newScene === 'petPool') {
        guideMgr.trigger(this, 'pet_pool_intro')
        // 从派遣返回灵宠池时引导继续战斗
        if (oldScene === 'idle' && this.storage.isGuideShown('pet_pool_intro')) {
          guideMgr.trigger(this, 'newbie_after_dispatch')
        }
      }
      // 灵宠派遣页：在走完灵宠池介绍后再提示点击空位（与高亮槽位、手指一致）
      if (newScene === 'idle' && this.storage.isGuideShown('pet_pool_intro')) {
        guideMgr.trigger(this, 'idle_intro')
      }
      // 回归奖励检测 & 活跃日期更新
      if (newScene === 'title') {
        this.storage.updateActiveDate()
        if (!this._comebackChecked) {
          this._comebackChecked = true
          const comeback = this.storage.checkComeback()
          if (comeback) P.showGameToast('欢迎回来！体力已回满，灵石+300')
        }
      }

      // 从灵宠池/修炼返回主页时触发后续引导
      if (newScene === 'title' && !this._pendingGuide) {
        // 1-1 已通、1-2 未通 → 引导继续 1-2（需等开始按钮渲染后触发）
        if (this.storage.isGuideShown('newbie_stage_continue') && !this.storage.isStageCleared('stage_1_2')) {
          this._stageIdxInitialized = false
          this._pendingGuide = 'newbie_continue_1_2'
        }
        // 1-2 已通、1-3 未通 → 引导继续 1-3
        else if (this.storage.isStageCleared('stage_1_2') && !this.storage.isStageCleared('stage_1_3')
            && this.storage.petPoolCount < 5) {
          this._stageIdxInitialized = false
          this._pendingGuide = 'newbie_continue_1_3'
        }
        // 五行集齐后从修炼返回 → 新手引导完成
        else if (this.storage.isGuideShown('newbie_team_ready')) {
          guideMgr.trigger(this, 'newbie_after_cult')
        }
      }
    })

    this.events.on('petPool:add', ({ petId, count }) => {
      // 新手引导流程中（1-1 送 3 宠），petPool_unlock / stage_unlock 由专用引导替代
      const inNewbieFlow = !this.storage.isGuideShown('newbie_team_ready')
        && (this._isNewbieStage || this.storage.isGuideShown('newbie_stage_continue')
            || this.storage.isStageCleared('stage_1_1'))

      if (count === 1 && !this.storage.isGuideShown('petPool_unlock')) {
        if (inNewbieFlow) {
          this.storage.markGuideShown('petPool_unlock')
        } else {
          this._pendingGuide = 'petPool_unlock'
        }
      }
      if (count === 5) {
        if (inNewbieFlow) {
          this.storage.markGuideShown('stage_unlock')
        } else {
          this._pendingGuide = 'stage_unlock'
        }
      }
    })

    // 触摸事件注册
    if (typeof canvas.addEventListener === 'function') {
      canvas.addEventListener('touchstart', e => this.onTouch('start', e))
      canvas.addEventListener('touchmove', e => this.onTouch('move', e))
      canvas.addEventListener('touchend', e => this.onTouch('end', e))
    } else {
      P.onTouchStart(e => this.onTouch('start', e))
      P.onTouchMove(e => this.onTouch('move', e))
      P.onTouchEnd(e => this.onTouch('end', e))
    }

    this.dt = 0; this.timeScale = 1.0
    let _lastTime = 0
    const loop = (now) => {
      if (_lastTime === 0) _lastTime = now
      const rawDt = Math.min((now - _lastTime) / 1000, 0.05)
      _lastTime = now
      this.dt = rawDt * this.timeScale
      this.af++
      try {
        if (this._hitStopFrames > 0) { this._hitStopFrames--; TweenMgr.updateTweens(this.dt); Particles.update(); this.render(); requestAnimationFrame(loop); return }
        this.update(); this.render()
        this._loopErrorCount = 0
      } catch(e) {
        console.error('[GameLoop]', e)
        this._loopErrorCount = (this._loopErrorCount || 0) + 1
        if (this._loopErrorCount >= 3 && this.scene !== 'title') {
          console.error('[GameLoop] 连续异常，回退到首页')
          this._loopErrorCount = 0
          try { this.setScene('title') } catch (_) {}
          try { P.showGameToast('游戏遇到问题，已返回首页') } catch (_) {}
        }
      }
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    // 注册分享能力（平台适配）
    P.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
    P.onShareAppMessage(() => share.getShareData(this.storage))

    this._criticalImages = [
      'assets/backgrounds/loading_bg.jpg',
      'assets/backgrounds/home_bg.jpg',
      'assets/ui/title_logo.png',
      'assets/ui/btn_start.png',
      'assets/ui/btn_continue.png',
      'assets/ui/btn_rank.png',
      'assets/ui/btn_bg.png',
      'assets/ui/btn_mode_switch.png',
      'assets/ui/lock.png',
      'assets/ui/tower_rogue.png',
      // 底部导航栏图标及背景
      'assets/ui/nav_bar_bg.png',
      'assets/ui/nav_hero.png',
      'assets/ui/nav_icons.png',
      'assets/ui/nav_battle.png',
      'assets/ui/nav_dex.png',
      'assets/ui/nav_rank.png',
      'assets/ui/nav_stats.png',
      'assets/ui/nav_more.png',
      // 开场漫画
      'assets/intro/intro_1.jpg',
      'assets/intro/intro_2.jpg',
      'assets/ui/icon_stamina.png',
      'assets/ui/icon_cult_exp.png',
      'assets/ui/icon_pet_exp.png',
      'assets/ui/icon_soul_stone.png',
      // 角色形象（首页头像立即显示，不延迟）
      'assets/hero/char_boy1.png',
      'assets/hero/char_girl1.png',
      'assets/hero/char_boy2.png',
      'assets/hero/char_girl2.png',
      'assets/hero/char_boy3.png',
      'assets/hero/char_girl3.png',
      'assets/ui/frame_avatar.png',
      'assets/ui/name_bg.png',
      'assets/ui/btn_back.png',
    ]
    R.setKeepPaths(this._criticalImages)
    R.preloadImages(this._criticalImages, (loaded, total) => {
      this._loadPct = loaded / total
    }).then(() => {
      console.log('[Preload] critical images ready')
      this._loadReady = true
    })
  }

  // ===== Run管理（委托到 runManager）=====
  _startRun(petIds) { runMgr.startRun(this, petIds) }
  _nextFloor() { runMgr.nextFloor(this) }
  _restoreBattleHpMax() { runMgr.restoreBattleHpMax(this) }
  _endRun() { runMgr.endRun(this) }
  _saveAndExit() { runMgr.saveAndExit(this) }
  _resumeRun() { runMgr.resumeRun(this) }

  // ===== 更新 =====
  update() {
    TweenMgr.updateTweens(this.dt)
    Particles.update()
    anim.updateAnimations(this)
    if (tutorial.isActive()) {
      tutorial.update(this)
      if (this.bState === 'victory') {
        if (tutorial.onVictory(this)) return
      }
    }
    // 波间过渡倒计时（固定关卡）
    if (this.bState === 'waveTransition' && this._waveTransTimer != null) {
      this._waveTransTimer--
      if (this._waveTransTimer <= 0) {
        stageMgr.advanceWave(this)
      }
    }
    // victory 状态下懒生成奖励（仅肉鸽模式）
    if (this.bState === 'victory' && !this.rewards && !tutorial.isActive() && this.floor < MAX_FLOOR && this.battleMode !== 'stage') {
      const ownedWpnIds = new Set()
      if (this.weapon) ownedWpnIds.add(this.weapon.id)
      if (this.weaponBag) this.weaponBag.forEach(w => ownedWpnIds.add(w.id))
      const ownedPetIds = new Set()
      if (this.pets) this.pets.forEach(p => { if (p) ownedPetIds.add(p.id) })
      if (this.petBag) this.petBag.forEach(p => { if (p) ownedPetIds.add(p.id) })
      const maxedPetIds = getMaxedPetIds(this)
      this.rewards = generateRewards(this.floor, this.curEvent ? this.curEvent.type : 'battle', this.lastSpeedKill, ownedWpnIds, this.sessionPetPool, ownedPetIds, maxedPetIds)
      this.selectedReward = -1
      this._rewardDetailShow = null
    }
    if (this.scene === 'loading') {
      const elapsed = Date.now() - this._loadStart
      if (this._loadReady && elapsed > 500) {
        if (!P.getStorageSync('introDone')) {
          introView.init()
          this.setScene('intro')
        } else {
          this.setScene('title'); MusicMgr.playBgm()
        }
      }
    }
    if (this.scene === 'intro') {
      introView.update(this)
    }
    // 待定功能解锁引导（从肉鸽/宝箱返回 title 后触发）
    if (this.scene === 'title' && this._pendingGuide) {
      const pg = this._pendingGuide
      // 需要高亮"开始游戏"按钮的引导，等按钮矩形就绪后再触发
      const needStartBtn = pg === 'newbie_stage_start'
        || pg === 'newbie_continue_1_2' || pg === 'newbie_continue_1_3'
      if (needStartBtn && this._startBtnRect) {
        this._pendingGuide = null
        const [bx, by, bw, bh] = this._startBtnRect
        guideMgr.trigger(this, pg, { x: bx, y: by, w: bw, h: bh })
      } else if (!needStartBtn) {
        this._pendingGuide = null
        guideMgr.trigger(this, pg)
      }
    }
    // 宝箱奖励不再自动弹出，玩家需主动点击右上角宝箱按钮领取
    if (this.bState === 'elimAnim') battleEngine.processElim(this)
    if (this.bState === 'dropping') battleEngine.processDropAnim(this)
    if (this.dragging && this.bState === 'playerTurn') {
      this.dragTimer++
      if (this.dragTimer >= this.dragTimeLimit) {
        this.dragging = false; this.dragAttr = null; this.dragTimer = 0
        MusicMgr.playDragEnd()
        this._checkAndElim()
      }
    }
    if (this._pendingEnemyAtk && this.bState === 'playerTurn') {
      this._pendingEnemyAtk.timer++
      if (this._pendingEnemyAtk.timer >= this._pendingEnemyAtk.delay) {
        this._pendingEnemyAtk = null
        battleEngine.enemyTurn(this)
        if (this.bState === 'enemyTurn') {
          const stunIdx = this.heroBuffs.findIndex(b => b.type === 'heroStun')
          if (stunIdx >= 0) {
            this.heroBuffs.splice(stunIdx, 1)
            this.skillEffects.push({ x:ViewEnv.W*0.5, y:ViewEnv.H*0.5, text:'被眩晕！跳过操作', color:'#ff4444', t:0, alpha:1 })
            this._pendingEnemyAtk = { timer: 0, delay: 24 }
          }
          this.bState = 'playerTurn'
          if (tutorial.isActive()) tutorial.onEnemyTurnEnd(this)
        }
      }
    }
    if (this.bState === 'petAtkShow') {
      this._stateTimer++
      if (this._stateTimer >= 10) { this._stateTimer = 0; this.bState = 'preAttack' }
    }
    if (this.bState === 'preAttack') {
      this._stateTimer++; if (this._stateTimer >= 12) { this._stateTimer = 0; battleEngine.executeAttack(this) }
    }
    if (this.bState === 'preEnemy') {
      this._stateTimer++; if (this._stateTimer >= 30) { this._stateTimer = 0; battleEngine.enemyTurn(this) }
    }
    if (this.bState === 'enemyTurn' && this._enemyTurnWait) {
      this._stateTimer++
      if (this._stateTimer >= 30) {
        this._stateTimer = 0; this._enemyTurnWait = false
        const stunIdx = this.heroBuffs.findIndex(b => b.type === 'heroStun')
        if (stunIdx >= 0) {
          this.heroBuffs.splice(stunIdx, 1)
          this.skillEffects.push({ x:ViewEnv.W*0.5, y:ViewEnv.H*0.5, text:'被眩晕！跳过操作', color:'#ff4444', t:0, alpha:1 })
          this.bState = 'preEnemy'; this._stateTimer = 0
        } else {
          battleEngine.onPlayerTurnStart(this)
          this.bState = 'playerTurn'; this.dragTimer = 0
          if (tutorial.isActive()) tutorial.onEnemyTurnEnd(this)
        }
      }
    }
    anim.updateSwapAnim(this)
    anim.updateBattleAnims(this)
    anim.updateHpAnims(this)
    anim.updateSkillPreview(this)
    if (this.scene === 'ranking' && this.af % 7200 === 0) {
      this.storage.fetchRanking(this.rankTab, true)
    }
    guideOverlay.update()
    wxBtns.updateAuthBtn(this, dpr)
    wxBtns.updateFeedbackBtn(this, dpr)
  }

  setScene(name) {
    const old = this.scene
    if (old === name) return
    this._dirty = true
    this.scene = name
    if (name === 'stageTeam') {
      this._showWeaponPicker = false
      this._weaponPickerPreviewId = null
    }

    // --- 场景切换时资源清理 ---
    // 离开战斗场景：清理粒子、悬挂定时器
    if (old === 'battle') {
      Particles.clear()
      if (this._petLongPressTimer) {
        clearTimeout(this._petLongPressTimer)
        this._petLongPressTimer = null
      }
    }
    // 返回首页时做一次全量清理（仅保留白名单）
    if (name === 'title') {
      R.clearDynamicCache()
      Particles.clearTexCache()
      MusicMgr.destroyBossBgm()
    }
    this.events.emit('scene:change', name, old)
  }

  markDirty() { this._dirty = true }

  // ===== 渲染入口 =====
  render() {
    if (this.scene !== this._lastRenderedScene) { this._dirty = true; this._lastRenderedScene = this.scene }
    const isStatic = (this.scene === 'title' || this.scene === 'stats' ||
      this.scene === 'ranking' || this.scene === 'dex' ||
      this.scene === 'stageInfo')
    if (isStatic && !this._dirty && !this.showSidebarPanel && !this.showMorePanel) return
    this._dirty = false
    ctx.clearRect(0, 0, W, H)
    let sx = 0, sy = 0
    if (this.shakeT > 0) {
      // 方向性震屏 + 指数衰减
      const decay = Math.pow(this.shakeDecay || 0.85, (1 - this.shakeT / (this.shakeT + 1)))
      const intensity = this.shakeI * S * decay
      sx = Math.sin(this.shakeT * 7.3) * intensity
      sy = Math.cos(this.shakeT * 5.9) * intensity * 0.7
    }
    ctx.save(); ctx.translate(sx, sy)
    switch(this.scene) {
      case 'loading': screens.rLoading(this); break
      case 'intro': introView.render(this); break
      case 'title': titleView.rTitle(this); break
      case 'prepare': prepareView.rPrepare(this); break
      case 'event': eventView.rEvent(this); break
      case 'battle': battleView.rBattle(this); break
      case 'reward': screens.rReward(this); break
      case 'shop': screens.rShop(this); break
      case 'rest': screens.rRest(this); break
      case 'adventure': screens.rAdventure(this); break
      case 'gameover': screens.rGameover(this); break
      case 'ranking': screens.rRanking(this); break
      case 'stats': screens.rStats(this); break
      case 'dex': screens.rDex(this); break
      case 'cultivation': cultView.rCultivation(this); break
      case 'petPool': petPoolView.rPetPool(this); break
      case 'petDetail': petDetailView.rPetDetail(this); break
      case 'stageInfo': stageInfoView.rStageInfo(this); break
      case 'stageTeam': stageTeamView.rStageTeam(this); break
      case 'stageResult': stageResultView.rStageResult(this); break
      case 'idle': idleView.rIdle(this); break
    }
    // 粒子系统绘制
    Particles.draw(ctx)
    this.dmgFloats.forEach(f => R.drawDmgFloat(f))
    this.skillEffects.forEach(e => R.drawSkillEffect(e))
    if (this.skillCastAnim.active) R.drawSkillCast(this.skillCastAnim)
    // 屏幕闪白（伤害反馈）
    if (this._screenFlash > 0) {
      const flashAlpha = this._screenFlash / this._screenFlashMax * 0.35
      ctx.save(); ctx.globalAlpha = flashAlpha
      ctx.fillStyle = this._screenFlashColor || '#fff'
      ctx.fillRect(0, 0, W, H)
      ctx.restore()
      this._screenFlash--
    }
    if (tutorial.isActive() && this.scene === 'battle') {
      battleView.drawTutorialOverlay(this)
    }
    if (this._rogueIntro) {
      eventView.drawRogueIntro(this)
    }
    if (this._newbiePetIntro) {
      eventView.drawNewbiePetIntro(this)
    }
    if (this._petObtainedPopup) {
      eventView.drawPetObtainedPopup(this, this._petObtainedPopup)
    }
    if (this._star3Celebration) {
      dialogs.drawStar3Celebration(this)
    }
    if (this._petPoolEntryPopup) {
      dialogs.drawPetPoolEntryPopup(this)
    }
    if (this._fragmentObtainedPopup) {
      dialogs.drawFragmentPopup(this)
    }
    guideOverlay.draw(this)
    ctx.restore()
  }

  // ===== 触摸入口 =====
  onTouch(type, e) {
    this._dirty = true
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const x = t.clientX * dpr, y = t.clientY * dpr
    // 指引覆盖层拦截（restrictToHighlight 模式下高亮区域点击可穿透到底层按钮）
    if (guideMgr.isActive()) {
      if (guideOverlay.onTouch(this, type, x, y)) return
    }
    switch(this.scene) {
      case 'intro': introView.onTouch(this, type, x, y); break
      case 'title': touchH.tTitle(this,type,x,y); break
      case 'prepare': touchH.tPrepare(this,type,x,y); break
      case 'event': touchH.tEvent(this,type,x,y); break
      case 'battle': touchH.tBattle(this,type,x,y); break
      case 'reward': touchH.tReward(this,type,x,y); break
      case 'shop': touchH.tShop(this,type,x,y); break
      case 'rest': touchH.tRest(this,type,x,y); break
      case 'adventure': touchH.tAdventure(this,type,x,y); break
      case 'gameover': touchH.tGameover(this,type,x,y); break
      case 'ranking': touchH.tRanking(this,type,x,y); break
      case 'stats': touchH.tStats(this,type,x,y); break
      case 'dex': touchH.tDex(this,type,x,y); break
      case 'cultivation': cultView.tCultivation(this,x,y,type); break
      case 'petPool': petPoolView.tPetPool(this,x,y,type); break
      case 'petDetail': petDetailView.tPetDetail(this,x,y,type); break
      case 'stageInfo': stageInfoView.tStageInfo(this,x,y,type); break
      case 'stageTeam': stageTeamView.tStageTeam(this,x,y,type); break
      case 'stageResult': stageResultView.tStageResult(this,x,y,type); break
      case 'idle': idleView.tIdle(this,type,x,y); break
    }
  }

  // ===== 视图委托（仅保留被 battleView.js 等外部模块调用的方法）=====
  _drawExitDialog() { dialogs.drawExitDialog(this) }
  _drawRunBuffDetailDialog() { dialogs.drawRunBuffDetailDialog(this) }
  _drawEnemyDetailDialog() { dialogs.drawEnemyDetailDialog(this) }
  _drawWeaponDetailDialog() { dialogs.drawWeaponDetailDialog(this) }
  _drawBattlePetDetailDialog() { dialogs.drawBattlePetDetailDialog(this) }

  _handleBackToTitle() {
    if (this.scene === 'gameover' || this.scene === 'ranking' || this.scene === 'stats') {
      this.setScene('title')
      this.showMorePanel = false
      this.showTitleStartDialog = false
    } else {
      this._saveAndExit()
    }
  }

  async _openRanking() {
    const t0 = Date.now()
    console.log('[Ranking] 打开排行榜, authorized=', this.storage.userAuthorized, 'bestFloor=', this.storage.bestFloor)
    this.storage.destroyUserInfoBtn()
    if (P.isDouyin && this.storage.userInfo && this.storage.userInfo.nickName === '冒险者') {
      this.storage.requestDouyinUserInfo((ok, info) => {
        if (ok) console.log('[Ranking] 抖音授权成功:', info.nickName)
      })
    }
    this.rankTab = 'all'
    this.rankScrollY = 0
    this.setScene('ranking')
    const needSubmit = this.storage.userAuthorized && this.storage.bestFloor > 0
    await this.storage.fetchRankingCombined('all', needSubmit)
    console.log('[Ranking] 排行榜加载完成, 总耗时', Date.now() - t0, 'ms')
  }

  _enterEvent() {
    this._eventPetDetail = null; this._eventPetDetailData = null
    this._eventWpnDetail = null; this._eventWpnDetailData = null
    this._eventDragPet = null; this._eventShopUsedCount = 0
    this._eventShopUsedItems = null; this._shopSelectAttr = false; this._shopSelectPet = null
    this.setScene('event')
    if (this.curEvent) {
      const t = this.curEvent.type
      if (t === 'adventure') guideMgr.trigger(this, 'event_adventure')
      else if (t === 'rest') guideMgr.trigger(this, 'event_rest')
      else if (t === 'shop') guideMgr.trigger(this, 'event_shop')
      else if (t === 'elite') guideMgr.trigger(this, 'elite_first')
      else if (t === 'boss') guideMgr.trigger(this, 'boss_first')
    }
  }

  // ===== 战斗布局 & 动画（委托到 battleHelpers）=====
  _getBattleLayout() { return bh.getBattleLayout() }
  _getEnemyCenterY() { return bh.getEnemyCenterY() }
  _playHeroAttack(skillName, attr, type) { bh.playHeroAttack(this, skillName, attr, type) }
  _playEnemyAttack() { bh.playEnemyAttack(this) }
  _playHealEffect() { bh.playHealEffect(this) }
  _addShield(val) { bh.addShield(this, val) }
  _dealDmgToHero(dmg) { bh.dealDmgToHero(this, dmg) }

  // ===== 战斗引擎委托（仅保留被外部模块通过 g._xxx() 调用的方法）=====
  _showSkillPreview(pet, index) { skillEngine.showSkillPreview(this, pet, index) }
  _enterBattle(enemyData) { battleEngine.enterBattle(this, enemyData) }
  _checkAndElim() {
    if (this._pendingEnemyAtk) {
      this._pendingEnemyAtk = null
      battleEngine.enemyTurn(this)
      if (this.bState !== 'playerTurn' && this.bState !== 'enemyTurn') return
      if (this.bState === 'enemyTurn') {
        const stunIdx = this.heroBuffs.findIndex(b => b.type === 'heroStun')
        if (stunIdx >= 0) {
          this.heroBuffs.splice(stunIdx, 1)
          this.skillEffects.push({ x:ViewEnv.W*0.5, y:ViewEnv.H*0.5, text:'被眩晕！跳过操作', color:'#ff4444', t:0, alpha:1 })
          this._pendingEnemyAtk = { timer: 0, delay: 24 }
        }
        this.bState = 'playerTurn'
        if (tutorial.isActive()) tutorial.onEnemyTurnEnd(this)
      }
    }
    battleEngine.checkAndElim(this)
  }
  _onDefeat() { runMgr.onDefeat(this, W, H) }
  _doAdRevive() { runMgr.doAdRevive(this, W, H) }

  // ===== 宠物技能与奖励（被 touchHandlers / eventView 调用）=====
  _triggerPetSkill(pet, idx) { skillEngine.triggerPetSkill(this, pet, idx) }
  _applyReward(rw) { skillEngine.applyReward(this, rw) }
  _applyShopItem(item) { skillEngine.applyShopItem(this, item) }
  _applyShopPetByAttr(attr) { skillEngine.applyShopPetByAttr(this, attr) }
  _applyShopStarUp(petIdx) { return skillEngine.applyShopStarUp(this, petIdx) }
  _applyShopUpgradePet(petIdx, pct) { return skillEngine.applyShopUpgradePet(this, petIdx, pct) }
  _applyShopCdReduce(petIdx) { return skillEngine.applyShopCdReduce(this, petIdx) }
  _applyRestOption(opt) { skillEngine.applyRestOption(this, opt) }
  _applyAdventure(adv) { skillEngine.applyAdventure(this, adv) }
  _shareStats() { share.shareStats(this.storage) }
  _hitRect(x,y,rx,ry,rw,rh) { return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh }
}

new Main()
