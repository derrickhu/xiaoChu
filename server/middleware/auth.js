/**
 * 多平台身份认证中间件
 * 抖音云部署时：请求头自动带 x-tt-openid（免登录）
 * 微信端：前端先调 /api/login 换取 token，后续请求带 Authorization header
 */

function authMiddleware(req, res, next) {
  // 抖音云免登录：平台自动注入 openId
  const ttOpenId = req.headers['x-tt-openid']
  if (ttOpenId) {
    req.userPlatform = 'douyin'
    req.userOpenId = ttOpenId
    return next()
  }

  // 微信端：从 Authorization 中解析（简易 token = base64(platform:openid)）
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

  res.status(401).json({ code: -1, msg: 'unauthorized' })
}

module.exports = authMiddleware
