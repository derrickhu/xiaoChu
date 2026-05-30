module.exports = {
  // 旧微信云存储配置：保留用于回滚和 legacy-wechat 上传目标
  cloudEnv: 'cloud1-6g8y0x2i39e768eb',
  cloudBucket: '636c-cloud1-6g8y0x2i39e768eb-1405519553',
  filePrefix: 'assets_cdn',

  // 新统一 CloudBase CDN 配置：微信先切到该路径，抖音后续复用
  // 使用 CloudBase 云存储 COS 桶，路径前缀以 GameKey 开头做业务隔离
  cloudbaseEnv: 'rosa-env-d7grf78r5dbd37323',
  cloudbaseBucket: '726f-rosa-env-d7grf78r5dbd37323-1414200063',
  cloudbasePublicBaseUrl: 'https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la',
  cloudbaseFilePrefix: 'xiaochu/assets_cdn',
  cdnMode: 'cloudbase-https',

  cdnDirs: [
    'assets/pets',
    'assets/enemies',
    'assets/backgrounds',
    'assets/equipment',
    'assets/intro',
    'audio_bgm',
  ],
  bundledDirs: [
    'assets/ui',
    'assets/orbs',
    'assets/battle',
    'assets/hero',
    'assets/share',
    'audio',
  ],
  ignoreFiles: ['game.js', '.DS_Store', 'Thumbs.db'],
}
