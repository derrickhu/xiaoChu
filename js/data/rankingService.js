/**
 * 排行榜服务 — 灵宠消消塔
 * 从 Storage 中拆分出的排行榜提交/拉取/缓存逻辑
 */

const P = require('../platform')
const api = require('../api')
const cloudSync = require('./cloudSync')
const { RANK_CACHE_TTL_MS } = require('./constants')
const friendRanking = require('./friendRanking')
const { isCurrentUserGM } = require('./gmConfig')

class RankingService {
  /**
   * @param {object} deps
   * @param {() => object} deps.getContext - 返回排行榜所需的 Storage 上下文
   * @param {() => void} [deps.markDirty] - 状态变化时通知渲染系统刷新
   */
  constructor({ getContext, markDirty }) {
    this._getContext = getContext
    this._markDirty = markDirty || (() => {})

    this.rankStageList = []
    this.rankAllList = []
    this.rankAllWeeklyList = []
    this.rankDexList = []
    this.rankComboList = []
    this.rankStageMyRank = -1
    this.rankAllMyRank = -1
    this.rankAllWeeklyMyRank = -1
    this.rankDexMyRank = -1
    this.rankComboMyRank = -1
    // 周榜期号：云端返回 periodKey（形如 "2026-W16"），UI 需要时展示
    this.rankAllWeeklyPeriodKey = ''

    // ==== 同境界档位榜缓存：单独存，与全服榜并列，避免切 scope 时闪回旧数据 ====
    // scope = 'tier' 时的 list / myRank；切换 scope 走独立状态
    this.rankStageTierList = []
    this.rankAllTierList = []
    this.rankAllWeeklyTierList = []
    this.rankStageTierMyRank = -1
    this.rankAllTierMyRank = -1
    this.rankAllWeeklyTierMyRank = -1
    // 当前档位快照（用于 UI 展示"同境界（金丹）"）
    this.rankCurrentTier = ''
    this._rankLoading = false
    this.rankLoadingMsg = ''
    this.rankLastFetch = 0
    this.rankLastFetchTab = ''
    this._rankFetchSeq = 0
    this._rankInflight = 0

    // ==== D3 名次对比反馈：内存态保存上次拉到的 myRank（按 tab 区分），用于产生"上升/下降/进前 10"提示 ====
    // key = 'stage' | 'tower' | 'towerWeekly' | 'dex' | 'combo'
    this._prevRankByTab = Object.create(null)
    // 等待消费的反馈，由 UI 层（rRanking）读一次并清零
    this.pendingFeedback = null
  }

  /**
   * 纯函数：根据上一次名次 prev 与本次 curr 生成反馈事件列表
   *   - firstTime：之前没上过榜（prev<=0 或 null）
   *   - up / down：名次变化（>0 上升）
   *   - top1 / top3 / top10：当前所在段（和 up/down 叠加）
   */
  /**
   * fetchRanking / fetchRankingCombined 成功后统一调用，计算并落到 pendingFeedback。
   * 过滤规则：
   *   - 名次未变 → 无反馈
   *   - 仅 firstTime 且 prev==null（session 从未拉过此 tab）→ 不打扰
   *   - 其余事件保留，供 UI 消费
   */
  _emitFeedback(tab, curr) {
    const prev = this._prevRankByTab[tab]
    this._prevRankByTab[tab] = curr
    // 挂件动画：不走 pendingFeedback 消费机制，独立一份数据，每次拉到新名次就给结算页挂件一个数字滚动 + ↑N 徽章
    //   · 放在 pendingFeedback 之前，让 firstTime / no-event 场景也能尝试（内部会自己挡）
    //   · require 放函数内是避免循环依赖（rankWidget 目前不反向依赖 rankingService，不过留个稳妥）
    try {
      const rankWidget = require('../views/rankWidget')
      if (rankWidget && rankWidget.noteRankChange) {
        rankWidget.noteRankChange(tab, prev, curr)
      }
    } catch (_) { /* 容错：rankWidget 未加载时（比如单测）静默跳过 */ }
    const fb = this._computeFeedback(tab, prev, curr)
    if (!fb || !fb.events.length) return
    if (fb.events.length === 1 && fb.events[0] === 'firstTime' && prev == null) return
    this.pendingFeedback = fb
  }

  _computeFeedback(tab, prev, curr) {
    if (!curr || curr <= 0) return null
    // 名次没变 → 无反馈（避免反复刷新时重复触发）
    if (prev != null && prev === curr) return null
    const fb = { tab, curr, prev: prev || -1, delta: 0, events: [] }
    if (prev == null || prev <= 0) {
      fb.events.push('firstTime')
    } else {
      fb.delta = prev - curr
      if (fb.delta > 0) fb.events.push('up')
      else if (fb.delta < 0) fb.events.push('down')
    }
    if (curr === 1) fb.events.push('top1')
    else if (curr <= 3) fb.events.push('top3')
    else if (curr <= 10) fb.events.push('top10')
    else if (curr <= 50) fb.events.push('top50')
    return fb
  }

  get rankLoading() { return this._rankLoading }
  set rankLoading(v) {
    if (this._rankLoading !== v) {
      this._rankLoading = v
      this._markDirty()
    }
  }

  /** 取当前上下文快照：主要给外部（好友榜）主动上报分数用 */
  getContextSnapshot() {
    try { return this._getContext() } catch (_) { return null }
  }

  async _callRanking(data) {
    if (P.isWeChat) {
      const r = await P.cloud.callFunction({ name: 'ranking', data })
      return r.result
    }
    const { action, ...rest } = data
    if (action === 'submit' || action === 'submitDexCombo' || action === 'submitStage') {
      return api.submitRanking({ action, ...rest })
    }
    if (action === 'getAll') return api.getRankingList('all')
    if (action === 'getAllWeekly') return api.getRankingList('allWeekly')
    if (action === 'getStage') return api.getRankingList('stage')
    if (action === 'getDex') return api.getRankingList('dex')
    if (action === 'getCombo') return api.getRankingList('combo')
    if (action === 'submitAndGetAll') {
      await api.submitRanking({ action: 'submit', ...rest })
      return api.getRankingList('all')
    }
    return { code: -1, msg: 'unknown action' }
  }

  async submitScore(floor, pets, weapon, totalTurns) {
    // GM 账号不参与任何排行榜：客户端早退省云函数调用，云函数 GM_OPENIDS 做兜底
    if (isCurrentUserGM()) {
      console.log('[Ranking] GM 跳过提交通天塔')
      return
    }
    const ctx = this._getContext()
    if (!cloudSync.isReady()) {
      console.warn('[Ranking] 提交跳过: cloudReady=false')
      return
    }
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交分数: floor=', floor, 'turns=', totalTurns, 'tier=', ctx.realmTier)
      const result = await this._callRanking({
        action: 'submit',
        nickName: ctx.userInfo.nickName,
        avatarUrl: ctx.userInfo.avatarUrl,
        floor,
        pets: (pets || []).map(p => ({ name: p.name, attr: p.attr })),
        weapon: weapon ? { name: weapon.name } : null,
        totalTurns: totalTurns || 0,
        petDexCount: ctx.petDexCount,
        masteredCount: ctx.masteredCount,
        collectedCount: ctx.collectedCount,
        maxCombo: ctx.maxCombo,
        realmTier: ctx.realmTier,
      })
      console.log('[Ranking] 提交分数完成, 耗时', Date.now() - t0, 'ms, 结果:', JSON.stringify(result).slice(0, 400))
      // 单独把周榜写入结果打出来，方便定位"通天塔周榜无数据"这类问题
      if (result && result.weekly) {
        console.log('[Ranking] 周榜写入状态:', JSON.stringify(result.weekly))
      }
      this.rankLastFetch = 0
      // 顺便把四维度分数同步到 wx.setUserCloudStorage，供好友榜读取
      try { friendRanking.uploadScores(ctx) } catch (_) {}
    } catch(e) {
      console.error('[Ranking] 提交分数失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
  }

  async submitDexAndCombo() {
    if (isCurrentUserGM()) {
      console.log('[Ranking] GM 跳过提交图鉴/连击')
      return
    }
    const ctx = this._getContext()
    if (!cloudSync.isReady()) return
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交图鉴/连击: dex=', ctx.petDexCount, 'mastered=', ctx.masteredCount, 'combo=', ctx.maxCombo)
      await this._callRanking({
        action: 'submitDexCombo',
        nickName: ctx.userInfo.nickName,
        avatarUrl: ctx.userInfo.avatarUrl,
        petDexCount: ctx.petDexCount,
        masteredCount: ctx.masteredCount,
        collectedCount: ctx.collectedCount,
        maxCombo: ctx.maxCombo,
        realmTier: ctx.realmTier,
      })
      console.log('[Ranking] 提交图鉴/连击完成, 耗时', Date.now() - t0, 'ms')
      // 清掉缓存时间戳，下次切图鉴/连击榜强制重拉，避免"刚提交但列表还是旧的"
      this.rankLastFetch = 0
      try { friendRanking.uploadScores(ctx, { tabs: ['dex', 'combo'] }) } catch (_) {}
    } catch(e) {
      console.warn('[Ranking] 提交图鉴/连击失败, 耗时', Date.now() - t0, 'ms:', e)
    }
  }

  async submitStageRanking() {
    if (isCurrentUserGM()) {
      console.log('[Ranking] GM 跳过提交秘境')
      return
    }
    const ctx = this._getContext()
    if (!cloudSync.isReady()) return
    if (ctx.stageTotalStars <= 0 && ctx.stageClearCount <= 0) return
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交秘境: stars=', ctx.stageTotalStars, 'clear=', ctx.stageClearCount, 'elite=', ctx.stageEliteClearCount)
      await this._callRanking({
        action: 'submitStage',
        nickName: ctx.userInfo.nickName,
        avatarUrl: ctx.userInfo.avatarUrl,
        totalStars: ctx.stageTotalStars,
        clearCount: ctx.stageClearCount,
        eliteClearCount: ctx.stageEliteClearCount,
        farthestChapter: ctx.farthestChapter,
        farthestNormalChapter: ctx.farthestNormalChapter,
        farthestNormalOrder: ctx.farthestNormalOrder,
        farthestEliteChapter: ctx.farthestEliteChapter,
        farthestEliteOrder: ctx.farthestEliteOrder,
        realmTier: ctx.realmTier,
      })
      console.log('[Ranking] 提交秘境完成, 耗时', Date.now() - t0, 'ms')
      // 清掉缓存时间戳，下次切秘境榜强制重拉，避免"打完新关卡但榜单列表还是旧的"
      this.rankLastFetch = 0
      try { friendRanking.uploadScores(ctx, { tabs: ['stage'] }) } catch (_) {}
    } catch(e) {
      console.warn('[Ranking] 提交秘境失败, 耗时', Date.now() - t0, 'ms:', e)
    }
  }

  /**
   * 拉取排行榜
   * @param {string} tab 'stage' | 'tower' | 'towerWeekly' | 'dex' | 'combo'
   * @param {boolean} force 强制刷新
   * @param {string} [scope='all'] 'all' 全服 | 'tier' 同境界（仅 stage/tower/towerWeekly 支持）
   */
  async fetchRanking(tab, force, scope) {
    if (!cloudSync.isReady()) {
      console.warn('[Ranking] 云环境未就绪，2秒后重试')
      this.rankLoadingMsg = '等待云环境...'
      this.rankLoading = true
      await new Promise(r => setTimeout(r, 2000))
      this.rankLoading = false
      this.rankLoadingMsg = ''
      if (!cloudSync.isReady()) {
        console.warn('[Ranking] 云环境仍未就绪，放弃拉取')
        return
      }
    }
    // 仅秘境榜支持 tier 档位：通天塔后续走"仅限二星宠"平衡模式自身即均衡，不再按境界分档
    const useTier = scope === 'tier' && tab === 'stage'
    const ctx = this._getContext()
    const realmTier = ctx.realmTier
    this.rankCurrentTier = realmTier
    const now = Date.now()
    // 缓存键：区分 scope（all/tier），避免切档时看到上个档的旧数据
    const cacheTabKey = useTier ? `${tab}:tier:${realmTier}` : tab
    const listMap = useTier
      ? { stage: 'rankStageTierList', tower: 'rankAllTierList', towerWeekly: 'rankAllWeeklyTierList' }
      : { stage: 'rankStageList', tower: 'rankAllList', all: 'rankAllList', towerWeekly: 'rankAllWeeklyList', dex: 'rankDexList', combo: 'rankComboList' }
    const listKey = listMap[tab] || 'rankStageList'
    if (!force && now - this.rankLastFetch < RANK_CACHE_TTL_MS && this.rankLastFetchTab === cacheTabKey && this[listKey].length > 0) {
      console.log('[Ranking] 命中缓存, 跳过拉取:', cacheTabKey)
      return
    }
    const seq = ++this._rankFetchSeq
    this._rankInflight++
    this.rankLoading = true
    this.rankLoadingMsg = '拉取排行中...'
    const t0 = Date.now()
    try {
      const actionMap = { stage: 'getStage', tower: 'getAll', all: 'getAll', towerWeekly: 'getAllWeekly', dex: 'getDex', combo: 'getCombo' }
      const action = actionMap[tab] || 'getStage'
      const data = useTier ? { action, realmTier } : { action }
      console.log('[Ranking] 开始拉取:', action, useTier ? `(tier=${realmTier})` : '(all)')
      const result = await this._callRanking(data)
      const elapsed = Date.now() - t0
      if (seq !== this._rankFetchSeq) {
        console.log('[Ranking] 忽略过期的拉取结果:', cacheTabKey, 'seq=', seq)
        return
      }
      console.log('[Ranking] 拉取完成, 耗时', elapsed, 'ms, 结果:', JSON.stringify(result).slice(0, 800))
      if (result && result.debug) {
        console.log('[Ranking] DEBUG:', JSON.stringify(result.debug))
      }
      if (result && result.code === 0) {
        console.log('[Ranking] 获取到', (result.list || []).length, '条记录, myRank=', result.myRank, 'scope=', useTier ? 'tier' : 'all')
        this[listKey] = result.list || []
        const rankKey = listKey.replace('List', 'MyRank')
        this[rankKey] = result.myRank || -1
        // 周榜回传 periodKey，供 UI 展示"2026-W16 进行中"
        if (tab === 'towerWeekly' && result.periodKey) {
          this.rankAllWeeklyPeriodKey = result.periodKey
        }
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = cacheTabKey
        // 反馈键：同境界榜独立于全服榜（避免切 scope 误触发 up/down）
        this._emitFeedback(useTier ? `${tab}:tier` : tab, result.myRank || -1)
      } else {
        console.warn('[Ranking] 返回错误:', result)
      }
    } catch(e) {
      console.error('[Ranking] 拉取失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    } finally {
      this._rankInflight = Math.max(0, this._rankInflight - 1)
      if (this._rankInflight === 0) {
        this.rankLoading = false
        this.rankLoadingMsg = ''
      }
    }
  }

  async fetchRankingCombined(tab, needSubmit, scope) {
    if (!cloudSync.isReady()) {
      console.warn('[Ranking] 云环境未就绪，2秒后重试')
      this.rankLoading = true
      this.rankLoadingMsg = '等待云环境...'
      await new Promise(r => setTimeout(r, 2000))
      this.rankLoading = false
      this.rankLoadingMsg = ''
      if (!cloudSync.isReady()) { console.warn('[Ranking] 云环境仍未就绪'); return }
    }
    this.rankLoading = true
    this.rankLoadingMsg = needSubmit ? '提交并加载中...' : '加载排行中...'
    const t0 = Date.now()
    const useTier = scope === 'tier'
    const ctx = this._getContext()
    const realmTier = ctx.realmTier
    this.rankCurrentTier = realmTier
    try {
      if (tab === 'stage') {
        const canSubmit = needSubmit
        if (canSubmit && (ctx.stageTotalStars > 0 || ctx.stageClearCount > 0)) {
          await this._callRanking({
            action: 'submitStage',
            nickName: ctx.userInfo.nickName,
            avatarUrl: ctx.userInfo.avatarUrl,
            totalStars: ctx.stageTotalStars,
            clearCount: ctx.stageClearCount,
            eliteClearCount: ctx.stageEliteClearCount,
            farthestChapter: ctx.farthestChapter,
            farthestNormalChapter: ctx.farthestNormalChapter,
            farthestNormalOrder: ctx.farthestNormalOrder,
            farthestEliteChapter: ctx.farthestEliteChapter,
            farthestEliteOrder: ctx.farthestEliteOrder,
            realmTier: ctx.realmTier,
          })
        }
        const getData = useTier ? { action: 'getStage', realmTier } : { action: 'getStage' }
        const result = await this._callRanking(getData)
        if (result && result.code === 0) {
          if (useTier) {
            this.rankStageTierList = result.list || []
            this.rankStageTierMyRank = result.myRank || -1
          } else {
            this.rankStageList = result.list || []
            this.rankStageMyRank = result.myRank || -1
          }
          this.rankLastFetch = Date.now()
          this.rankLastFetchTab = useTier ? `stage:tier:${realmTier}` : 'stage'
          console.log('[Ranking] 秘境榜获取到', (result.list || []).length, '条记录, scope=', useTier ? 'tier' : 'all')
          this._emitFeedback(useTier ? 'stage:tier' : 'stage', result.myRank || -1)
        }
      } else {
        const doTowerSubmit = needSubmit
        let result
        if (doTowerSubmit) {
          const submitData = {
            action: 'submitAndGetAll',
            nickName: ctx.userInfo.nickName,
            avatarUrl: ctx.userInfo.avatarUrl,
            floor: ctx.bestFloor,
            pets: (ctx.bestFloorPets || []).map(p => ({ name: p.name, attr: p.attr })),
            weapon: ctx.bestFloorWeapon ? { name: ctx.bestFloorWeapon.name } : null,
            totalTurns: ctx.bestTotalTurns || 0,
            petDexCount: ctx.petDexCount,
            masteredCount: ctx.masteredCount,
            collectedCount: ctx.collectedCount,
            maxCombo: ctx.maxCombo,
            realmTier: ctx.realmTier,
          }
          if (useTier) submitData.queryRealmTier = realmTier
          result = await this._callRanking(submitData)
        } else {
          const getData = useTier ? { action: 'getAll', realmTier } : { action: 'getAll' }
          result = await this._callRanking(getData)
        }
        if (result && result.code === 0) {
          if (useTier) {
            this.rankAllTierList = result.list || []
            this.rankAllTierMyRank = result.myRank || -1
          } else {
            this.rankAllList = result.list || []
            this.rankAllMyRank = result.myRank || -1
          }
          this.rankLastFetch = Date.now()
          this.rankLastFetchTab = useTier ? `tower:tier:${realmTier}` : 'tower'
          console.log('[Ranking] 通天塔获取到', (result.list || []).length, '条记录, scope=', useTier ? 'tier' : 'all')
          this._emitFeedback(useTier ? 'tower:tier' : 'tower', result.myRank || -1)
        }
      }
    } catch(e) {
      console.error('[Ranking] 一体化调用失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
    this.rankLoading = false
    this.rankLoadingMsg = ''
  }

  async preheatRanking() {
    try {
      const t0 = Date.now()
      console.log('[Ranking] 预热: 后台静默拉取秘境榜...')
      const result = await this._callRanking({ action: 'getStage' })
      const elapsed = Date.now() - t0
      if (result && result.code === 0) {
        this.rankStageList = result.list || []
        this.rankStageMyRank = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = 'stage'
        console.log('[Ranking] 预热完成, 耗时', elapsed, 'ms, 记录数:', this.rankStageList.length)
      }
    } catch(e) {
      console.warn('[Ranking] 预热失败(不影响使用):', e.message || e)
    }
    // 预热时顺便把四维度分数同步到 wx.setUserCloudStorage：
    // 这样玩家就算从不点"好友榜"Tab，自己的分数也会出现在朋友的榜单里
    try {
      const ctx = this._getContext()
      if (ctx) friendRanking.uploadScores(ctx)
    } catch (_) {}
  }
}

module.exports = RankingService
