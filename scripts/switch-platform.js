/**
 * 平台配置切换脚本
 * 用法：node scripts/switch-platform.js wechat|douyin
 * 将对应平台的配置模板复制到项目根目录的 project.config.json
 */
const fs = require('fs')
const path = require('path')

const platform = process.argv[2]
if (!platform || !['wechat', 'douyin'].includes(platform)) {
  console.error('用法: node scripts/switch-platform.js wechat|douyin')
  process.exit(1)
}

const src = path.join(__dirname, '..', 'config', `${platform}.project.config.json`)
const dest = path.join(__dirname, '..', 'project.config.json')

if (!fs.existsSync(src)) {
  console.error(`配置模板不存在: ${src}`)
  process.exit(1)
}

fs.copyFileSync(src, dest)
console.log(`已切换到 ${platform} 平台配置 → project.config.json`)
