# @zero-ecs/game

World 与 Scheduler 的组合运行时，提供 Resource、State、Service、依赖注入、Module、
标准阶段、Commands、Event、Time、Timer、Random 与通用对象池。

`DefaultCoreModule` 可一次安装 Commands、Time、Timer、Event 与 Random；需要裁剪能力时，
仍可分别注册各功能 Module。

Game 根入口原样重导出常用 World 与 Scheduler token，运行时不会复制 peer dependency。
功能也可从 `@zero-ecs/game/event`、`time`、`timer`、`random`、`pool` 独立导入。
