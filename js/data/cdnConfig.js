module.exports = {
  // 统一 CloudBase COS CDN 配置：路径前缀以 GameKey 开头做业务隔离
  cloudbaseEnv: 'rosa-env-d7grf78r5dbd37323',
  cloudbaseBucket: '726f-rosa-env-d7grf78r5dbd37323-1414200063',
  cloudbasePublicBaseUrl: 'https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la',
  cloudbaseFilePrefix: 'xiaochu/assets_cdn',

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
