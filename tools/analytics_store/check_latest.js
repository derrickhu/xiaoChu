#!/usr/bin/env node
'use strict'

const { createConnection } = require('./db')

async function main() {
  const conn = await createConnection()
  try {
    const [runs] = await conn.execute(`
      SELECT id, window_start, window_end, pulled_count, inserted_count, status, error_message, updated_at
      FROM log_pull_runs
      ORDER BY id DESC
      LIMIT 5
    `)
    if (!runs.length) {
      console.log('暂无日志拉取记录')
      return
    }
    runs.forEach((r) => {
      console.log(`#${r.id} ${r.window_start} ~ ${r.window_end} ${r.status} 拉取=${r.pulled_count} 新增=${r.inserted_count}`)
      if (r.error_message) console.log(`  错误: ${r.error_message}`)
    })
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('检查失败:', e.message || e)
  process.exit(1)
})
