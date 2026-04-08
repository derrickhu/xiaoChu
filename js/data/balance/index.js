/**
 * 核心数值统一入口
 * require('../data/balance') 一次拿到所有子模块
 */

const combat = require('./combat')
const enemy = require('./enemy')
const towerEvent = require('./towerEvent')
const petStar = require('./petStar')
const economy = require('./economy')
const cultivation = require('./cultivation')
const pool = require('./pool')
const petBase = require('./petBase')
const weaponBase = require('./weaponBase')
const stage = require('./stage')
const towerPacing = require('./towerPacing')
const dex = require('./dex')

module.exports = {
  ...combat,
  ...enemy,
  ...towerEvent,
  ...petStar,
  ...economy,
  ...cultivation,
  ...pool,
  ...petBase,
  ...weaponBase,
  ...stage,
  ...towerPacing,
  ...dex,
}
