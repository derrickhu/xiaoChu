# CloudBase 统一后端部署与迁移说明（GameKey = `xiaochu`）

## 标准约束

- 后端只使用一个 CloudBase 云函数：`xiaochu-api`。
- `xiaochu-api` 内部集中承载微信/抖音的登录、存档、排行榜、礼包、邀请和迁移管理路由，不再拆分独立云函数。
- `GAME_KEY` 固定为 `xiaochu`，所有命名同步使用：
  - 集合前缀：`xiaochu_*`
  - 环境变量前缀：`XIAOCHU_*`
  - CDN 路径前缀：`xiaochu/assets_cdn/`
  - admin 接口请求头：`x-xiaochu-admin-key`
- 迁移顺序：微信端先切到统一后端和 `xiaochu_*` 集合；抖音端后续复用同一套协议（仅补 TT 凭据和合法域名）。
- 微信好友榜继续保留 `wx.setUserCloudStorage` / 开放数据域，不迁到 CloudBase 全服榜集合。

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
    ├── config.js   GameKey 派生：集合名、JWT secret、平台凭据、admin/CDN 配置
    ├── db.js       CloudBase Node SDK 集合获取
    ├── http.js     SCF event 解析、路径前缀剥离、CORS
    ├── save.js     /save/pull、/save/push
    ├── ranking.js  /ranking/submit、/ranking/list、/ranking/action（含周榜领奖）
    ├── gift.js     /gift/queryPending、/gift/markGranted、/gift/callback
    ├── share.js    /share/recordInvite、/share/claimInvites
    └── admin.js    /admin/initCollections、/admin/importBatch（受 ADMIN_KEY 保护）
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
XIAOCHU_ADMIN_KEY=<迁移管理临时密钥>
XIAOCHU_GIFT_TOKEN=<微信平台礼包回调签名 token>
XIAOCHU_TOKEN_TTL_SEC=604800
XIAOCHU_SAVE_MAX_BYTES=1048576
XIAOCHU_CDN_PUBLIC_BASE_URL=https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la
XIAOCHU_CDN_FILE_PREFIX=xiaochu/assets_cdn
```

说明：

- `XIAOCHU_JWT_SECRET`、`XIAOCHU_WX_SECRET`、`XIAOCHU_TT_SECRET`、`XIAOCHU_ADMIN_KEY`、`XIAOCHU_GIFT_TOKEN` 仅放函数环境变量或本地一次性环境变量，禁止入仓。
- JWT 内置 `gk` 字段，服务端校验 `gk === GAME_KEY`，避免跨游戏 token 复用。
- `XIAOCHU_ADMIN_KEY` 仅迁移期使用，迁移完成后建议在 CloudBase 控制台移除或轮换。

## HTTP 路由

所有路由通过 CloudBase HTTP 访问服务进入 `xiaochu-api` 函数，路径前缀 `/xiaochu-api`：

```text
GET/POST /xiaochu-api/health
POST     /xiaochu-api/login
POST     /xiaochu-api/save/pull
POST     /xiaochu-api/save/push
POST     /xiaochu-api/ranking/submit
POST     /xiaochu-api/ranking/list
POST     /xiaochu-api/ranking/action
POST     /xiaochu-api/gift/queryPending
POST     /xiaochu-api/gift/markGranted
GET/POST /xiaochu-api/gift/callback
GET/POST /xiaochu-api/giftDeliver       兼容旧微信 MP 后台已配置的回调 URL
POST     /xiaochu-api/share/recordInvite
POST     /xiaochu-api/share/claimInvites
POST     /xiaochu-api/admin/initCollections
POST     /xiaochu-api/admin/importBatch
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
cloudbaseFilePrefix: 'xiaochu/assets_cdn',
```

绑定自定义域名后，只需替换 `BASE_URL` 根域名；客户端会自动拼接 `/xiaochu-api`。

## 部署步骤

1. **创建函数**：在 CloudBase 控制台或 MCP 中用 `cloudfunctions/xiaochu-api/` 创建 `xiaochu-api`，运行时 `Nodejs18.15`，配齐上方环境变量。
2. **创建网关 API 路径**：CloudBase HTTP 访问服务新建 1 条记录
   - Path：`/xiaochu-api`
   - Type：`1`（SCF）
   - PathTransmission：`2`（透传子路径）
   - 绑定函数：`xiaochu-api`
3. **创建集合 + 索引**：用 `/admin/initCollections` 一次性建好上方 9 个集合，再单独配索引（见下文索引清单）。
4. **健康检查**：`curl https://<env>.service.tcloudbase.com/xiaochu-api/health` 应返回 `gameKey: "xiaochu"` 且 `x-cloudbase-upstream-type: Tencent-SCF`（不是 SCF_HTTP）。

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

## 微信数据迁移

数据来源：`tools/backup/data/<日期>/`（由 `tools/backup/daily.js` 每天自动备份微信旧云开发数据库）。

### 单账号迁移（先验证基础流程）

```bash
# dry-run：只解析、不写入
node scripts/migrate_single_account_to_xiaochu.js \
  --openid=oEnZR3XFkSkBvflm37cinC3qYSCY --dry-run

# 正式导入（XIAOCHU_ADMIN_KEY 必须与函数环境变量一致）
XIAOCHU_ADMIN_KEY=<管理密钥> node scripts/migrate_single_account_to_xiaochu.js \
  --openid=oEnZR3XFkSkBvflm37cinC3qYSCY
```

可选：`--src-dir=tools/backup/data/2026-05-25` 指定快照日期，默认取最新备份。

### 批量迁移（基础链路验证完毕后再做）

```bash
# dry-run
node scripts/migrate_batch_to_xiaochu.js --src-dir=tools/backup/data/2026-05-25 --dry-run

# 正式导入
XIAOCHU_ADMIN_KEY=<管理密钥> node scripts/migrate_batch_to_xiaochu.js \
  --src-dir=tools/backup/data/2026-05-25
```

参数：

- `--src-dir=<path>` 备份目录，默认取 `tools/backup/data/` 下最新一天
- `--dry-run` 只导出和转换，不写入
- 环境变量 `MIGRATE_BATCH_SIZE`、`MIGRATE_MAX_BATCH_BYTES` 控制每批最大条数和字节数（默认 50 条 / 200KB）

转换结果会写入 `tools/migration/data/<runId>/<集合>.converted.json`，以及 `migration-report.json` 汇总。

## CDN 上传

```bash
# 上传到新 CloudBase CDN
WX_SECRET=<旧微信 AppSecret，仅 legacy 模式需要> node scripts/upload_cdn.js --target=cloudbase

# 迁移期双写旧微信云存储和新 CloudBase CDN
WX_SECRET=<旧微信 AppSecret> node scripts/upload_cdn.js --target=both
```

新资源访问前缀：`https://726f-rosa-env-d7grf78r5dbd37323-1414200063.tcb.qcloud.la/xiaochu/assets_cdn/`。

## 验收清单

- CloudBase 函数列表中只有 `xiaochu-api`，不创建其他拆分函数。
- `GET /xiaochu-api/health` 返回 `gameKey: "xiaochu"`，且 `x-cloudbase-upstream-type: Tencent-SCF`。
- 微信端 `wx.login` 后端换取 openid 成功并签发 JWT。
- 单账号迁移成功后：客户端用同一个微信号登录，能拉到迁移过来的玩家存档（`payload` 字段还原原微信存档结构），排行榜里能看到自己的旧记录。
- 排行榜写入：`xiaochu_rankAll`、`xiaochu_rankAllWeekly`、`xiaochu_rankStage`、`xiaochu_rankDex`、`xiaochu_rankCombo`。
- 周榜奖励写入 `xiaochu_weeklyReward`，礼包写入 `xiaochu_pendingGifts`，邀请写入 `xiaochu_inviteRecords`。
- 微信好友榜仍走原生 `wx.setUserCloudStorage` / `wx.getFriendCloudStorage`。
- 微信端已配置 request/downloadFile 合法域名；如默认 CloudBase 域名不可用，绑定自定义域名后再更新 `js/api.js` 和 `js/data/cdnConfig.js`。
- 抖音后续补齐 `XIAOCHU_TT_APPID`、`XIAOCHU_TT_SECRET` 和合法域名后复用同一链路。
