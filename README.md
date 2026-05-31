# 示例游戏

示例相关说明查阅[新手教程](https://developers.weixin.qq.com/minigame/dev/guide/develop/start.html)

## CloudBase 统一后端迁移

微信/抖音统一接入 CloudBase 后端 `xiaochu-api`，路由 `/xiaochu-api/login`、`/server/list`、`/save/*`、`/ranking/*`、`/gift/*`、`/share/*`；旧微信云开发独立函数、旧数据库导出/迁移工具和旧 CDN 回退链路已移除。`GAME_KEY = xiaochu`，集合统一使用 `xiaochu_*` 前缀，环境变量统一使用 `XIAOCHU_*` 前缀。

滚服架构已接入：`xiaochu_servers` 集合权威管理服务器列表、状态、推荐与 Zone 映射；玩家存档、排行榜、邀请和礼包继续复用现有业务集合，并通过 `serverId` 字段做逻辑隔离。当前 `s1` 为老玩家默认服，`s2` 为新服。详细部署、CDN 和验收清单见 `docs/cloudbase-xiaochu.md`。

## 源码目录介绍

```
├── audio                                      // 音频资源
├── images                                     // 图片资源
├── js
│   ├── base
│   │   ├── animatoin.js                       // 帧动画的简易实现
│   │   ├── pool.js                            // 对象池的简易实现
│   │   └── sprite.js                          // 游戏基本元素精灵类
│   ├── libs
│   │   └── tinyemitter.js                     // 事件监听和触发
│   ├── npc
│   │   └── enemy.js                           // 敌机类
│   ├── player
│   │   ├── bullet.js                          // 子弹类
│   │   └── index.js                           // 玩家类
│   ├── runtime
│   │   ├── background.js                      // 背景类
│   │   ├── gameinfo.js                        // 用于展示分数和结算界面
│   │   └── music.js                           // 全局音效管理器
│   ├── databus.js                             // 管控游戏状态
│   ├── main.js                                // 游戏入口主函数
│   └── render.js                              // 基础渲染信息
├── .eslintrc.js                               // 代码规范
├── game.js                                    // 游戏逻辑主入口
├── game.json                                  // 游戏运行时配置
├── project.config.json                        // 项目配置
└── project.private.config.json                // 项目个人配置
```
