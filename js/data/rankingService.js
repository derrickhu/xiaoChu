/**
 * 排行榜服务 — 灵宠消消塔
 * 从 Storage 中拆分出的排行榜提交/拉取/缓存逻辑
 */

const P = require('../platform')
const api = require('../api')
const cloudSync = require('./cloudSync')
const { RANK_CACHE_TTL_MS } = require('./constants')

class RankingService {
  /**
   * @param {object} deps
   * @param {() => object} deps.getContext - 返回排行榜所需的 Storage 上下文
   * @param {() => void} [deps.markDirty] - 状态变化时通知渲染系统刷新
   */
  constructor({ getContext, markDirty }) {
    this._getContext = getContext
    this._markDirty = markDirty || (() => {})

    this.rankAllList = []
    this.rankDexList = []
    this.rankComboList = []
    this.rankAllMyRank = -1
    this.rankDexMyRank = -1
    this.rankComboMyRank = -1
    this._rankLoading = false
    this.rankLoadingMsg = ''
    this.rankLastFetch = 0
    this.rankLastFetchTab = ''
  }

  get rankLoading() { return this._rankLoading }
  set rankLoading(v) {
    if (this._rankLoading !== v) {
      this._rankLoading = v
      this._markDirty()
    }
  }

  async _callRanking(data) {
    if (P.isWeChat) {
      const r = await P.cloud.callFunction({ name: 'ranking', data })
      return r.result
    }
    const { action, ...rest } = data
    if (action === 'submit' || action === 'submitDexCombo') {
      return api.submitRanking({ action, ...rest })
    }
    if (action === 'getAll') return api.getRankingList('all')
    if (action === 'getDex') return api.getRankingList('dex')
    if (action === 'getCombo') return api.getRankingList('combo')
    if (action === 'submitAndGetAll') {
      await api.submitRanking({ action: 'submit', ...rest })
      return api.getRankingList('all')
    }
    return { code: -1, msg: 'unknown action' }
  }

  async submitScore(floor, pets, weapon, totalTurns) {
    const ctx = this._getContext()
    if (!cloudSync.isReady() || !ctx.userAuthorized) {
      console.warn('[Ranking] 提交跳过: cloudReady=', cloudSync.isReady(), 'authorized=', ctx.userAuthorized)
      return
    }
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交分数: floor=', floor, 'turns=', totalTurns)
      const result = await this._callRanking({
        action: 'submit',
        nickName: ctx.userInfo.nickName,
        avatarUrl: ctx.userInfo.avatarUrl,
        floor,
        pets: (pets || []).map(p => ({ name: p.name, attr: p.attr })),
        weapon: weapon ? { name: weapon.name } : null,
        totalTurns: totalTurns || 0,
        petDexCount: ctx.petDexCount,
        maxCombo: ctx.maxCombo,
      })
      console.log('[Ranking] 提交分数完成, 耗时', Date.now() - t0, 'ms, 结果:', JSON.stringify(result).slice(0, 200))
      this.rankLastFetch = 0
    } catch(e) {
      console.error('[Ranking] 提交分数失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
  }

  async submitDexAndCombo() {
    const ctx = this._getContext()
    if (!cloudSync.isReady() || !ctx.userAuthorized) return
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交图鉴/连击: dex=', ctx.petDexCount, 'combo=', ctx.maxCombo)
      await this._callRanking({
        action: 'submitDexCombo',
        nickName: ctx.userInfo.nickName,
        avatarUrl: ctx.userInfo.avatarUrl,
        petDexCount: ctx.petDexCount,
        maxCombo: ctx.maxCombo,
      })
      console.log('[Ranking] 提交图鉴/连击完成, 耗时', Date.now() - t0, 'ms')
    } catch(e) {
      console.warn('[Ranking] 提交图鉴/连击失败, 耗时', Date.now() - t0, 'ms:', e)
    }
  }

  async fetchRanking(tab, force) {
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
    const now = Date.now()
    const listMap = { all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const listKey = listMap[tab] || 'rankAllList'
    if (!force && now - this.rankLastFetch < RANK_CACHE_TTL_MS && this.rankLastFetchTab === tab && this[listKey].length > 0) {
      console.log('[Ranking] 命中缓存, 跳过拉取:', tab)
      return
    }
    if (this.rankLoading) return
    this.rankLoading = true
    this.rankLoadingMsg = '拉取排行中...'
    const t0 = Date.now()
    try {
      const actionMap = { all: 'getAll', dex: 'getDex', combo: 'getCombo' }
      const action = actionMap[tab] || 'getAll'
      console.log('[Ranking] 开始拉取:', action)
      const result = await this._callRanking({ action })
      const elapsed = Date.now() - t0
      console.log('[Ranking] 拉取完成, 耗时', elapsed, 'ms, 结果:', JSON.stringify(result).slice(0, 800))
      if (result && result.debug) {
        console.log('[Ranking] DEBUG:', JSON.stringify(result.debug))
      }
      if (result && result.code === 0) {
        console.log('[Ranking] 获取到', (result.list || []).length, '条记录, myRank=', result.myRank)
        this[listKey] = result.list || []
        const rankKey = listKey.replace('List', 'MyRank')
        this[rankKey] = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = tab
      } else {
        console.warn('[Ranking] 返回错误:', result)
      }
    } catch(e) {
      console.error('[Ranking] 拉取失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
    this.rankLoading = false
    this.rankLoadingMsg = ''
  }

  async fetchRankingCombined(tab, needSubmit) {
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
    try {
      const data = { action: 'submitAndGetAll' }
      if (needSubmit) {
        const ctx = this._getContext()
        if (ctx.userAuthorized) {
          data.nickName = ctx.userInfo.nickName
          data.avatarUrl = ctx.userInfo.avatarUrl
          data.floor = ctx.bestFloor
          data.pets = (ctx.bestFloorPets || []).map(p => ({ name: p.name, attr: p.attr }))
          data.weapon = ctx.bestFloorWeapon ? { name: ctx.bestFloorWeapon.name } : null
          data.totalTurns = ctx.bestTotalTurns || 0
          data.petDexCount = ctx.petDexCount
          data.maxCombo = ctx.maxCombo
        }
      }
      console.log('[Ranking] 一体化调用, needSubmit=', needSubmit)
      const result = await this._callRanking(data)
      const elapsed = Date.now() - t0
      console.log('[Ranking] 一体化完成, 耗时', elapsed, 'ms')
      if (result && result.debug) {
        console.log('[Ranking] DEBUG:', JSON.stringify(result.debug))
      }
      if (result && result.code === 0) {
        this.rankAllList = result.list || []
        this.rankAllMyRank = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = 'all'
        console.log('[Ranking] 获取到', this.rankAllList.length, '条记录, myRank=', this.rankAllMyRank)
      } else {
        console.warn('[Ranking] 返回错误:', result)
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
      console.log('[Ranking] 预热: 后台静默拉取排行榜...')
      const result = await this._callRanking({ action: 'getAll' })
      const elapsed = Date.now() - t0
      if (result && result.code === 0) {
        this.rankAllList = result.list || []
        this.rankAllMyRank = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = 'all'
        console.log('[Ranking] 预热完成, 耗时', elapsed, 'ms, 记录数:', this.rankAllList.length)
      }
    } catch(e) {
      console.warn('[Ranking] 预热失败(不影响使用):', e.message || e)
    }
  }
}

module.exports = RankingService
