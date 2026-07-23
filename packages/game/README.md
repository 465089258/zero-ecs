# @zero-ecs/game

World 与 Scheduler 的组合运行时，提供 Resource、State、Service、依赖注入、Module、
标准阶段、Commands、Event、Time、Timer、Random 与通用对象池。

World、Resource、State 与 Service 的属性依赖统一通过根入口的
`Inject.world/resource/state/service` 声明。

`DefaultCoreModule` 可一次安装 Commands、Time、Timer、Event 与 Random；需要裁剪能力时，
仍可分别注册各功能 Module。

Module 是纯构建期安装器；运行时生命周期由其注册的 Service 与 Startup/Shutdown System
承担。全部 Service 启动后执行 Startup，Shutdown 完成后再逆序停止 Service。

Game 根入口原样重导出常用 World 与 Scheduler token，运行时不会复制 peer dependency。
可选功能只从 `@zero-ecs/game/event`、`time`、`timer`、`random`、`pool`、`hierarchy`
独立导入。
