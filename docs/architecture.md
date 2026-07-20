# 当前架构

仓库由三个锁步版本的 npm workspace 包组成：

```text
@zero-ecs/world          @zero-ecs/scheduler
纯 ECS 数据内核          通用静态调度器
          \              /
             @zero-ecs/game
       DI、生命周期与标准功能
```

`world` 和 `scheduler` 没有框架内部依赖；`game` 通过 peer dependency 使用两者。
Game 根入口的 World 与 Stage 都是 peer 包的原对象，不复制类或 token。

## World

`World` 构造时必须接收 `IAllocator`，并物理拥有：

- World-local ComponentRegistry；
- ArchetypeStore、Table 和组件列；
- Entity slot、版本与位置；
- Query 的数据源；
- EntityCommand 的组件事务语义。

Allocator 始终由构造方拥有。World 释放自己申请的 Buffer，但不会清空整个 Allocator。
GameBuilder 自建默认 Allocator 时，Game 会在 Service 和 World 释放后清理它；外部传入
Allocator 则继续由外部管理。

World 对外提供三层能力类型，运行时都是同一个对象：

```text
WorldView        valid/get/has
StructureWriter  reserve/despawn/createEntityCommand/applyEntityCommand
World            完整独立内核与 advanced 能力
```

`EntityCommand` 是 World-local 单实体事务，不是 Game Command，没有 `.submit()`、DI、
队列或对象池。它支持 read-your-writes、remove→add 零初始化、隐式 add、despawn 终止、
跨 World 拒绝和单次应用生命周期。

## Scheduler

Scheduler 只认识：

- `Stage` 与构建期 `SystemSet`；
- 系统函数和不透明 `Param`；
- before/after/chain 依赖；
- `SystemParamProvider<Param>`。

`ScheduleBuilder.build()` 展开 SystemSet 并拒绝跨 Stage 依赖。`Scheduler.init()` 做稳定
拓扑排序；`prepare()` 在局部数组解析全部参数，成功后原子发布；`run()` 使用固定参数
数组和 0～8 参数直接调用分支。prepare 失败是终止状态，只能 dispose。

Scheduler 源码不导入 World、Query、Resource、State、Service 或 Game 标准阶段。

## Game

Game 是组合根，不是纯数据对象。它持有：

```text
World
Scheduler<GameSystemParam>
ResourceContainer / StateContainer / ServiceContainer
GameSystemParamResolver
Module[]
```

`GameBuilder` 支持：

- 外部 World，或用外部/默认 Allocator 创建 World；
- Resource 实例、State 无参类型；
- Service 无参类型、已有实例和冷路径工厂；
- Module 与 `defSystem()` 系统定义。

Game 对外的 `world` 被收窄为 `WorldView`；即时结构能力通过
`game.structureWriter()` 显式取得。Game 包用 WeakMap 在构建冷路径防止同一个 World
同时属于多个 Game，World 本身不知道 Game。

系统参数映射为：

```text
World                    -> WorldView
QueryType                -> Query
ResourceType             -> Readonly<Resource>
StateType                -> Readonly<State>
Write(StateType)         -> Mut<State>
ServiceType              -> Service
```

参数只在 start/prepare 解析一次。`Write` 是调度元数据与 TypeScript 可写映射，不是运行
时权限沙箱。系统参数不会自动注册容器对象，缺失依赖在 prepare 阶段失败。

## 生命周期与阶段

```text
build
  -> State.init
  -> Service.init
  -> Service.activate
  -> Scheduler.init
  -> Module.init
start
  -> Scheduler.prepare
  -> Startup
  -> Service.start
  -> Module.start
update
  -> Update.first -> Update.fixed -> Update.last -> Update.post
stop
  -> Module.stop(reverse) -> Service.stop(reverse) -> Shutdown
dispose
  -> Module -> Scheduler -> Service -> State -> World -> owned Allocator -> Resource
```

`Service.init` 只能临时读取 Resource/State；所有 Service 完成 init 后，`activate` 才能
临时取得其他 Service，并记录释放依赖。生命周期上下文返回后立即失效。

## Commands 与标准功能

`Commands` 是 Game Service。Game EntityCommand 继承普通 Command，并组合 World 的原始
EntityCommand；外层包装复用普通 Command 池，原始事务使用内核专用池。Commands 还拥有
提交队列、稀疏 Entity 索引和 accumulator。默认依赖图是：

```text
flushCommandsSystem          [Update.post, Commands]
applyEntityCommandsSystem    [Update.post, Structure] after Commands
dispatchEventsSystem         [Update.post, Events]    after Structure
```

同一批次、同一 Entity 的多个事务按提交顺序由 World bridge 合并，实际最多 migrate 或
despawn 一次。所有字段写和结构写都在 Structure System 统一可见。一个 Stage 不会回跳
已经执行过的 System；后续 Event 产生的命令默认进入下一 Tick。

Timer 分成 `Update.fixed` 的时间轮推进与 `Update.post` 的 callback 提交。具体顺序来自
Module 注册的 `GameSystemSet` 依赖，不写死在 `Game.update()`。
TimerService 只依赖 `submit()` 任务协议。Game EntityCommand 继承 Command 后天然满足该
协议，因此可以直接延迟到目标 Tick，同时 Timer 不依赖 EntityCommand 或 Commands。

`DefaultCoreModule` 是 Commands、Time、Timer、Event 与 Random 的便捷组合；各独立
Module 仍可单独注册。通用 `ObjectPoolService` 是默认 Game Service，支持直接池和 `definePool()` token；它不
进入 World。错误处理函数、Allocator 引用和对象池直接保存在 Service，不生造 State。

## 包边界

```text
@zero-ecs/world
@zero-ecs/world/advanced
@zero-ecs/world/game-bridge
@zero-ecs/scheduler
@zero-ecs/game
@zero-ecs/game/advanced
@zero-ecs/game/{event,time,timer,random,pool}
```

`game-bridge` 是锁步版本内部 SPI。实现文件虽然生成到 dist 供包内相对导入使用，但
package exports 禁止外部深路径访问。旧单包 `src/`、InternalPost、CommandState、
EntityMigrationState/Service/Pool 均已删除。
