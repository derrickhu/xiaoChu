'use strict'

const { loadConfig } = require('./config')

async function createConnection(options) {
  let mysql
  try {
    mysql = require('mysql2/promise')
  } catch (e) {
    throw new Error('缺少依赖 mysql2，请先运行：npm install')
  }
  const cfg = loadConfig().mysql
  return mysql.createConnection({
    host: cfg.host || '127.0.0.1',
    port: cfg.port || 3306,
    user: cfg.user || 'root',
    password: cfg.password || '',
    database: options && options.withoutDatabase ? undefined : (cfg.database || 'xiao_chu_analytics'),
    multipleStatements: !!(options && options.multipleStatements),
    dateStrings: true,
  })
}

function toMysqlDate(msOrDate) {
  const d = msOrDate instanceof Date ? msOrDate : new Date(msOrDate)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

module.exports = { createConnection, toMysqlDate }
