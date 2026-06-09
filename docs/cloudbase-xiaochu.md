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
xiaochu_servers          滚服配置（serverId / 状态 / 推荐 / Zone 映射）
xiaochu_playerData       玩家存档（serverId + schemaVersion + payload）
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
    ├── server.js   /server/list、serverId 校验、Zone 映射、兜底服列表
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
GET/POST /xiaochu-api/server/list
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

## 滚服管理

- 服务器列表以 `xiaochu_servers` 为权威来源，客户端启动后先请求 `/xiaochu-api/server/list`。
- 客户端仅保留 `js/data/serverConfig.js` 中的 `s1` / `s2` / `s3` 兜底配置，避免网络异常时无法进服。
- 当前规则：`s1` 为老玩家默认服，旧本地 `wxtower_v1` 和旧云端无 `serverId` 存档均视为一服；`s2`、`s3` 为独立新服。
- 业务集合不按服拆分，均通过 `serverId` 字段逻辑隔离：存档、排行榜、周榜奖励、礼包和邀请查询/写入都必须携带 `serverId`。
- 开新服：运行 `node scripts/open_server.js <区号>`（详见脚本头部注释）；或在 CloudBase 控制台向 `xiaochu_servers` 新增文档。
- 维护服务器：将对应文档 `status` 改为 `maintenance` 并填写 `notice`，选服页展示但禁止进入。

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

## 微信平台礼包（原生福利半屏）

### MP 后台

- 入口：**运营功能管理 → 游戏礼包道具 → 小游戏礼包管理**
- 需先配置并发布**道具**，再配置**礼包**（每日登录、周末福利等）。
- **通用配置**页只有「发货频率限制」，没有 openlink；这是正常的。
- 消息推送回调 URL 指向 `/xiaochu-api/gift/callback`（或已配置的 `/giftDeliver` 兼容路径），`XIAOCHU_GIFT_TOKEN` 与 MP 一致。

### 客户端 openlink

| 常量 | 来源 | 用途 |
|------|------|------|
| `TITLE_HOME.giftOpenlink` | 微信文档固定常量（全平台相同） | `PageManager` 打开「游戏福利 / 道具领取」半屏 |
| `TITLE_HOME.gameClubOpenlink` | MP 游戏圈帖子跳转 | 打开指定游戏圈帖子 |

`giftOpenlink` 不识别游戏；游戏身份由**运行时 AppID** + MP 礼包配置决定。玩家在福利页领取后，微信推送 `minigame_deliver_goods`，`GiftId` 对应 MP 礼包列表中的 ID。

文档：[给朋友送道具](https://developers.weixin.qq.com/minigame/dev/guide/open-ability/share-gift.html)

### 客户端链路（`js/engine/platformWelfare.js`）

1. 冷启动离开 loading 进入任意场景：`tryAutoShowOnLaunch` 弹原生福利半屏（每 session 一次，不限关卡/是否在主页）。
2. 玩家在微信福利页点领取 → 微信异步回调 → `xiaochu_pendingGifts` 写入 pending。
3. 福利页 `destroy` / 游戏 `onShow` / 启动时：`syncAndGrantPendingGifts` 自动入账 + 轻 toast。
4. 鸿蒙微信不支持 `createPageManager`：不 auto-show，入口降级为原生 `GameClubButton`；回调到账仍 silent grant。


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
xiaochu_servers          uniq(serverId)、sort(sort asc)
xiaochu_playerData       uniq(userId + serverId)
xiaochu_rankAll          uniq(uid + serverId)、score(serverId, floor desc, totalTurns asc, timestamp desc)
xiaochu_rankAllWeekly    uniq(uid + serverId + periodKey)、period_score(serverId, periodKey, floor desc, totalTurns asc)
xiaochu_rankStage        uniq(uid + serverId)、score(serverId, totalStars desc, eliteClearCount desc, clearCount desc)
xiaochu_rankDex          uniq(uid + serverId)、score(serverId, masteredCount desc, collectedCount desc, petDexCount desc)
xiaochu_rankCombo        uniq(uid + serverId)、score(serverId, maxCombo desc, timestamp desc)
xiaochu_weeklyReward     uniq(uid + serverId + periodKey)
xiaochu_pendingGifts     uniq(orderId)、user_status(userId, serverId, status, createdAt)
xiaochu_inviteRecords    uniq(newUser + serverId)、inviter_granted(inviter, serverId, granted, createdAt)
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
- `GET/POST /xiaochu-api/server/list` 返回 `xiaochu_servers` 中的 `s1`、`s2`，集合为空时返回内置兜底。
- 微信/抖音登录均通过 `/xiaochu-api/login` 换取用户身份并签发 JWT。
- 存档读写只使用 `xiaochu_playerData`，同账号不同服以 `serverId` 独立保存。
- 排行榜写入：`xiaochu_rankAll`、`xiaochu_rankAllWeekly`、`xiaochu_rankStage`、`xiaochu_rankDex`、`xiaochu_rankCombo`。
- 周榜奖励写入 `xiaochu_weeklyReward`，礼包写入 `xiaochu_pendingGifts`，邀请写入 `xiaochu_inviteRecords`。
- 微信端冷启动进主页可弹原生「游戏福利」半屏；领取后自动 sync 入账（见上文「微信平台礼包」）。
- 微信好友榜仍走原生 `wx.setUserCloudStorage` / `wx.getFriendCloudStorage`，一服兼容旧 `xiaochu_*` key，二服及后续新服使用 `xiaochu_sN_*` key。
- 微信端已配置 request/downloadFile 合法域名：
  - `https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com`
  - `https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la`
