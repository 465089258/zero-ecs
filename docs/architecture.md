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
- ArchetypeStore；每个 Archetype 自己管理密集行、Chunk 数量和结构版本；
- EntitySlots；独立管理句柄版本以及 `Archetype/chunkIdx/row` 位置；
- 仅负责连续 Table `push/pop` 的 DataSet，以及只负责列数据操作的 Table；
- Query 的数据源；
- EntityCommand 的组件事务语义。

Allocator 始终由构造方拥有。World 释放自己申请的 Buffer，但不会清空整个 Allocator。
GameBuilder 自建默认 Allocator 时，Game 会在 Service 和 World 释放后清理它；外部传入
Allocator 则继续由外部管理。

World 对外提供三层能力类型，运行时都是同一个对象：

```text
WorldView        valid/get/has，以及显式分配的低频 ref
StructureWriter  reserve/despawn/createEntityCommand/applyEntityCommand
World            完整独立内核与 advanced 能力
```

`EntityRef` 只是绑定 `WorldView + Entity` 的只读便利对象，不是新的实体表示。它不缓存
物理位置、不参与 Query、不提供结构写能力；数字 Entity 仍是存储和热路径中的唯一实体值。

`EntityCommand` 是 World-local 单实体事务，不是 Game Command，没有 `.submit()`、DI、
队列或对象池。它支持 read-your-writes、remove→add 零初始化、隐式 add、despawn 终止、
跨 World 拒绝和单次应用生命周期。

存储层职责固定为：

```text
DataSet       连续 Table 数组；push 创建尾表，pop 删除尾表
Table         固定容量 TypedArray 列；get/set/clear/copy，不记录逻辑行
Archetype     组件实体密集行、Chunk 生命周期、swap-remove、组件列缓存
EntitySlots   Entity 版本和 Archetype/chunkIdx/row 映射
```

`Archetype.views[chunkIdx][componentId][fieldId]` 和
`Archetype.entities[chunkIdx]` 在 Chunk 创建时一次建立。Query 只保存
`Archetype + chunkIdx`，直接借用这些缓存列；不存在 DenseRows、WeakMap 组件视图或
Query 自己的组件列适配数组。

World 还提供通用 `QueryProjection` 协议：组合层可以在构建冷路径把一个不可构造的只读
Query token 映射到隐藏存储组件。Query 创建时只解析一次实际 ComponentMeta，Chunk 迭代
仍直接读取原列，不创建 wrapper。投影不能传给 EntityCommand，因此上层模块可以开放
查询能力而不开放组件增删能力。

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
ServiceToken             -> Service
```

`ServiceToken<T>` 允许抽象父类，供 System、注入和查询使用；只有
`GameBuilder.addService()` 接收的 `ServiceType<T>` 必须是可实例化实现。注册具体子类后，
容器通过既有原型链别名让父类 token 解析到同一个实例。

参数只在 start/prepare 解析一次。`Write` 是调度元数据与 TypeScript 可写映射，不是运行
时权限沙箱。系统参数不会自动注册容器对象，缺失依赖在 prepare 阶段失败。

模块可用 `ManualStage` 定义宿主显式驱动且不属于固定 Tick 的阶段，并通过
`game.runStage(stage)` 执行。该入口只接受带类型品牌的 `ManualStage`，不能用来单独运行
`Update.post` 等标准生命周期阶段；参数仍在 start 时一次性解析。

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

`HierarchyModule` 是不进入 DefaultCoreModule 的可选能力。它在 Game 层公开只读
`ChildOf`/`ParentOf` QueryProjection，把真正的 marker ComponentType 和关系分页存储封闭
在模块内部，并通过 Commands 通用提交扩展参与结构事务。普通关系变更由
`HierarchyService.setParent/removeParent` 延迟提交；父实体的 despawn 默认展开为整棵子树
递归 despawn。若子树需要存活，调用方必须在同一提交边界前先移除或更换其根节点的 parent。
独立 World、Commands 和 Scheduler 均不知道 Hierarchy。

## 包边界

```text
@zero-ecs/world
@zero-ecs/world/advanced
@zero-ecs/world/game-bridge
@zero-ecs/scheduler
@zero-ecs/game
@zero-ecs/game/advanced
@zero-ecs/game/{event,time,timer,random,pool,hierarchy}
```

`game-bridge` 是锁步版本内部 SPI。实现文件虽然生成到 dist 供包内相对导入使用，但
package exports 禁止外部深路径访问。旧单包 `src/`、InternalPost、CommandState、
EntityMigrationState/Service/Pool 均已删除。
