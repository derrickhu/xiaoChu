/**
 * 通过微信 HTTP API 导出云数据库（分析用）
 * 复用 tools/lib/wxCloudExport 通用模块
 */
'use strict'
const path = require('path')
const { exportAll } = require('../lib/wxCloudExport')

const DATA_DIR = path.join(__dirname, 'data')

async function main() {
  console.log('===== 开始导出（分析用）=====')
  const results = await exportAll(DATA_DIR)
  console.log('')
  console.log('===== 导出完成 =====')
  console.log('接下来运行: python analyze.py')
}

main().catch(e => { console.error('失败:', e); process.exit(1) })
