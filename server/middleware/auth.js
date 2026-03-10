/**
 * 多平台身份认证中间件
 * 1. 抖音云生产环境：请求头自动带 x-tt-openid（免登录）
 * 2. 通过 /api/login 换取的 Bearer token
 * 3. 开发环境兜底：无认证时分配匿名身份（允许基本功能测试）
 */

function authMiddleware(req, res, next) {
  // 抖音云免登录：平台自动注入 openId
  const ttOpenId = req.headers['x-tt-openid']
  if (ttOpenId) {
    req.userPlatform = 'douyin'
    req.userOpenId = ttOpenId
    return next()
  }

  // Bearer token（前端通过 /api/login 换取）
  const auth = req.headers['authorization']
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = Buffer.from(auth.slice(7), 'base64').toString()
      const [platform, openId] = decoded.split(':')
      if (platform && openId) {
        req.userPlatform = platform
        req.userOpenId = openId
        return next()
      }
    } catch (e) {}
  }

  // 开发环境兜底：无认证时用匿名身份，方便开发者工具测试
  if (!process.env.REQUIRE_AUTH) {
    req.userPlatform = 'douyin'
    req.userOpenId = 'anonymous_dev_user'
    console.log('[Auth] 开发模式: 使用匿名身份')
    return next()
  }

  res.status(401).json({ code: -1, msg: 'unauthorized' })
}

module.exports = authMiddleware
