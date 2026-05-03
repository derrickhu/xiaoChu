'use strict'

const fs = require('fs')
const path = require('path')

const LOCAL_CONFIG = path.join(__dirname, 'config.local.json')
const EXAMPLE_CONFIG = path.join(__dirname, 'config.example.json')

function loadConfig() {
  const file = fs.existsSync(LOCAL_CONFIG) ? LOCAL_CONFIG : EXAMPLE_CONFIG
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!cfg.mysql) throw new Error('缺少 mysql 配置')
  return cfg
}

module.exports = { loadConfig, LOCAL_CONFIG, EXAMPLE_CONFIG }
