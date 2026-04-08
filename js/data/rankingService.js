/**
 * 排行榜服务 — 灵宠消消塔
 * 从 Storage 中拆分出的排行榜提交/拉取/缓存逻辑
 */

const P = require('../platform')
const api = require('../api')
const cloudSync = require('./cloudSync')
const { RANK_CACHE_TTL_MS } = require('./constants')
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
    this.rankDexList = []
    this.rankComboList = []
    this.rankStageMyRank = -1
    this.rankAllMyRank = -1
    this.rankDexMyRank = -1
    this.rankComboMyRank = -1
    this._rankLoading = false
    this.rankLoadingMsg = ''
    this.rankLastFetch = 0
    this.rankLastFetchTab = ''
    this._rankFetchSeq = 0
    this._rankInflight = 0
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
    if (action === 'submit' || action === 'submitDexCombo' || action === 'submitStage') {
      return api.submitRanking({ action, ...rest })
    }
    if (action === 'getAll') return api.getRankingList('all')
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
    if (isCurrentUserGM()) {
      console.warn('[Ranking] GM 账号跳过提交通天塔成绩')
      return
    }
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
        masteredCount: ctx.masteredCount,
        collectedCount: ctx.collectedCount,
        maxCombo: ctx.maxCombo,
      })
      console.log('[Ranking] 提交分数完成, 耗时', Date.now() - t0, 'ms, 结果:', JSON.stringify(result).slice(0, 200))
      this.rankLastFetch = 0
    } catch(e) {
      console.error('[Ranking] 提交分数失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
  }

  async submitDexAndCombo() {
    if (isCurrentUserGM()) {
      console.warn('[Ranking] GM 账号跳过提交图鉴/连击榜')
      return
    }
    const ctx = this._getContext()
    if (!cloudSync.isReady() || !ctx.userAuthorized) return
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
      })
      console.log('[Ranking] 提交图鉴/连击完成, 耗时', Date.now() - t0, 'ms')
    } catch(e) {
      console.warn('[Ranking] 提交图鉴/连击失败, 耗时', Date.now() - t0, 'ms:', e)
    }
  }

  async submitStageRanking() {
    if (isCurrentUserGM()) {
      console.warn('[Ranking] GM 账号跳过提交秘境榜')
      return
    }
    const ctx = this._getContext()
    if (!cloudSync.isReady() || !ctx.userAuthorized) return
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
      })
      console.log('[Ranking] 提交秘境完成, 耗时', Date.now() - t0, 'ms')
    } catch(e) {
      console.warn('[Ranking] 提交秘境失败, 耗时', Date.now() - t0, 'ms:', e)
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
    const listMap = { stage: 'rankStageList', tower: 'rankAllList', all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const listKey = listMap[tab] || 'rankStageList'
    if (!force && now - this.rankLastFetch < RANK_CACHE_TTL_MS && this.rankLastFetchTab === tab && this[listKey].length > 0) {
      console.log('[Ranking] 命中缓存, 跳过拉取:', tab)
      return
    }
    const seq = ++this._rankFetchSeq
    this._rankInflight++
    this.rankLoading = true
    this.rankLoadingMsg = '拉取排行中...'
    const t0 = Date.now()
    try {
      const actionMap = { stage: 'getStage', tower: 'getAll', all: 'getAll', dex: 'getDex', combo: 'getCombo' }
      const action = actionMap[tab] || 'getStage'
      console.log('[Ranking] 开始拉取:', action)
      const result = await this._callRanking({ action })
      const elapsed = Date.now() - t0
      if (seq !== this._rankFetchSeq) {
        console.log('[Ranking] 忽略过期的拉取结果:', tab, 'seq=', seq)
        return
      }
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
    } finally {
      this._rankInflight = Math.max(0, this._rankInflight - 1)
      if (this._rankInflight === 0) {
        this.rankLoading = false
        this.rankLoadingMsg = ''
      }
    }
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
      if (tab === 'stage') {
        const ctx = this._getContext()
        const canSubmit = needSubmit && ctx.userAuthorized && !isCurrentUserGM()
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
          })
        }
        const result = await this._callRanking({ action: 'getStage' })
        if (result && result.code === 0) {
          this.rankStageList = result.list || []
          this.rankStageMyRank = result.myRank || -1
          this.rankLastFetch = Date.now()
          this.rankLastFetchTab = 'stage'
          console.log('[Ranking] 秘境榜获取到', this.rankStageList.length, '条记录')
        }
      } else {
        const ctx = this._getContext()
        const doTowerSubmit =
          needSubmit && ctx.userAuthorized && !isCurrentUserGM()
        let result
        if (doTowerSubmit) {
          result = await this._callRanking({
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
          })
        } else {
          if (needSubmit && isCurrentUserGM()) {
            console.warn('[Ranking] GM 账号仅拉取通天塔榜，不上传')
          }
          result = await this._callRanking({ action: 'getAll' })
        }
        if (result && result.code === 0) {
          this.rankAllList = result.list || []
          this.rankAllMyRank = result.myRank || -1
          this.rankLastFetch = Date.now()
          this.rankLastFetchTab = 'tower'
          console.log('[Ranking] 通天塔获取到', this.rankAllList.length, '条记录')
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
  }
}

module.exports = RankingService
