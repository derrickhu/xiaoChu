# CloudBase 统一后端说明（GameKey = `xiaochu`）

## 标准约束

- 后端只保留一个 CloudBase 云函数：`xiaochu-api`。
- `xiaochu-api` 承载微信/抖音登录、存档、排行榜、礼包、邀请和平台回调。
- `GAME_KEY` 固定为 `xiaochu`，所有命名同步使用：
  - 集合前缀：`xiaochu_*`
  - 环境变量前缀：`XIAOCHU_*`
  - CDN 路径前缀：`xiaochu/assets_cdn/`
- 旧微信云开发独立函数、旧云数据库导出/备份/迁移工具、旧 `cloud://` 资源回退均已删除。
- 微信好友榜继续保留 `wx.setUserCloudStorage` / 开放数据域，这是微信小游戏原生能力，不属于旧后台链路。

## 集合清单

```text
xiaochu_playerData       玩家存档（schemaVersion + payload）
xiaochu_rankAll          全服爬塔总榜
xiaochu_rankAllWeekly    全服爬塔周榜（含 periodKey）
xiaochu_rankStage        关卡通关榜（totalStars / eliteClearCount / clearCount）
xiaochu_rankDex          图鉴榜
xiaochu_rankCombo        最大连击榜
xiaochu_weeklyReward     周榜奖励领取记录（uid + periodKey）
xiaochu_pendingGifts     平台礼包待发货/已发货记录（orderId 唯一）
xiaochu_inviteRecords    邀请记录（newUser 唯一）
```

## 云函数目录

```text
cloudfunctions/xiaochu-api/
├── index.js
├── package.json
└── lib/
    ├── auth.js     微信/抖音 code2session + JWT 签发与校验
    ├── config.js   GameKey 派生：集合名、JWT secret、平台凭据、CDN 配置
    ├── db.js       CloudBase Node SDK 集合获取
    ├── http.js     SCF event 解析、路径前缀剥离、CORS
    ├── save.js     /save/pull、/save/push
    ├── ranking.js  /ranking/submit、/ranking/list、/ranking/action（含周榜领奖）
    ├── gift.js     /gift/queryPending、/gift/markGranted、/gift/callback
    └── share.js    /share/recordInvite、/share/claimInvites
```

## 必需环境变量

```text
GAME_KEY=xiaochu
TCB_ENV=rosa-env-d7grf78r5dbd37323
XIAOCHU_JWT_SECRET=<强随机密钥>
XIAOCHU_WX_APPID=<微信小游戏 AppID>
XIAOCHU_WX_SECRET=<微信小游戏 AppSecret>
XIAOCHU_TT_APPID=tt64d6126bfab7cc5502
XIAOCHU_TT_SECRET=<抖音小游戏 secret>
XIAOCHU_GIFT_TOKEN=<微信平台礼包回调签名 token>
XIAOCHU_TOKEN_TTL_SEC=604800
XIAOCHU_SAVE_MAX_BYTES=1048576
XIAOCHU_CDN_PUBLIC_BASE_URL=https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la
XIAOCHU_CDN_FILE_PREFIX=xiaochu/assets_cdn
```

说明：

- `XIAOCHU_JWT_SECRET`、`XIAOCHU_WX_SECRET`、`XIAOCHU_TT_SECRET`、`XIAOCHU_GIFT_TOKEN` 仅放函数环境变量或本地一次性环境变量，禁止入仓。
- JWT 内置 `gk` 字段，服务端校验 `gk === GAME_KEY`，避免跨游戏 token 复用。
- 迁移期 `/admin/*` 接口已下线，运行期不再需要 `XIAOCHU_ADMIN_KEY`。

## HTTP 路由

所有路由通过 CloudBase HTTP 访问服务进入 `xiaochu-api` 函数，路径前缀 `/xiaochu-api`：

```text
GET/POST /xiaochu-api/health
POST     /xiaochu-api/login
POST     /xiaochu-api/save/pull
POST     /xiaochu-api/save/push
POST     /xiaochu-api/ranking/submit
POST     /xiaochu-api/ranking/list
GET      /xiaochu-api/ranking/list
POST     /xiaochu-api/ranking/action
POST     /xiaochu-api/gift/queryPending
POST     /xiaochu-api/gift/markGranted
GET/POST /xiaochu-api/gift/callback
GET/POST /xiaochu-api/giftDeliver       兼容微信 MP 后台已配置的回调 URL
POST     /xiaochu-api/share/recordInvite
POST     /xiaochu-api/share/claimInvites
```

> CloudBase HTTP 网关对路径中包含下划线的函数会被错误识别为 SCF_HTTP 上游导致 400，因此函数和路径名都使用连字符 `xiaochu-api`，不要使用下划线版本。

## 客户端配置

`js/api.js`：

```js
const GAME_KEY = 'xiaochu'
const API_PREFIX = '/' + GAME_KEY + '-api'
const BASE_URL = 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com'
```

`js/data/cdnConfig.js`：

```js
cloudbasePublicBaseUrl: 'https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la',
cloudbaseFilePrefix: 'xiaochu/assets_cdn',
```

客户端资源下载只走 HTTPS CDN URL，不再保留旧 `cloud://` fileID 或 `wx.cloud.downloadFile` 回退。

## 部署步骤

1. 在 CloudBase 控制台或 MCP 中创建/更新 `cloudfunctions/xiaochu-api/`，运行时 `Nodejs18.15`，配齐上方环境变量。
2. CloudBase HTTP 访问服务保留 1 条记录：
   - Path：`/xiaochu-api`
   - Type：`1`（SCF）
   - PathTransmission：`2`（透传子路径）
   - 绑定函数：`xiaochu-api`
3. 数据集合与索引通过 CloudBase 控制台/MCP 管理；运行期不暴露迁移管理接口。
4. 健康检查：`curl https://<env>.service.tcloudbase.com/xiaochu-api/health` 应返回 `gameKey: "xiaochu"`。

## 集合索引清单

```text
xiaochu_playerData       uniq(userId)
xiaochu_rankAll          uniq(uid)、score(floor desc, totalTurns asc, timestamp desc)
xiaochu_rankAllWeekly    uniq(uid + periodKey)、period_score(periodKey, floor desc, totalTurns asc)
xiaochu_rankStage        uniq(uid)、score(totalStars desc, eliteClearCount desc, clearCount desc)
xiaochu_rankDex          uniq(uid)、score(masteredCount desc, collectedCount desc, petDexCount desc)
xiaochu_rankCombo        uniq(uid)、score(maxCombo desc, timestamp desc)
xiaochu_weeklyReward     uniq(uid + periodKey)
xiaochu_pendingGifts     uniq(orderId)、user_status(userId, status, createdAt)
xiaochu_inviteRecords    uniq(newUser)、inviter_granted(inviter, granted, createdAt)
```

## CDN 上传

```bash
# 仅列出本地资源清单 / 差异
node scripts/upload_cdn.js --dry-run

# 增量上传到 CloudBase COS CDN
TENCENTCLOUD_SECRET_ID=<SecretId> \
TENCENTCLOUD_SECRET_KEY=<SecretKey> \
node scripts/upload_cdn.js
```

资源访问前缀：`https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la/xiaochu/assets_cdn/`。

## 验收清单

- CloudBase 函数列表中只保留 `xiaochu-api` 作为业务后端。
- `GET /xiaochu-api/health` 返回 `gameKey: "xiaochu"`。
- 微信/抖音登录均通过 `/xiaochu-api/login` 换取用户身份并签发 JWT。
- 存档读写只使用 `xiaochu_playerData`。
- 排行榜写入：`xiaochu_rankAll`、`xiaochu_rankAllWeekly`、`xiaochu_rankStage`、`xiaochu_rankDex`、`xiaochu_rankCombo`。
- 周榜奖励写入 `xiaochu_weeklyReward`，礼包写入 `xiaochu_pendingGifts`，邀请写入 `xiaochu_inviteRecords`。
- 微信好友榜仍走原生 `wx.setUserCloudStorage` / `wx.getFriendCloudStorage`，key 使用 `xiaochu_*` 命名空间。
- 微信端已配置 request/downloadFile 合法域名：
  - `https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com`
  - `https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la`
