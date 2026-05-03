#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { createConnection } = require('./db')

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  const conn = await createConnection({ withoutDatabase: true, multipleStatements: true })
  try {
    await conn.query(schema)
    console.log('✓ MySQL 分析仓库初始化完成')
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('初始化失败:', e.message || e)
  process.exit(1)
})
