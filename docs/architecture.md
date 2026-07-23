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

## World

`World` 是数据导向的底层 ECS 内核。它直接持有：

- World-local 组件注册数据；
- Archetype 数组、Mask 索引和 Chunk 布局版本；
- Entity slot 的版本、位置、空闲链表与 ABA 隔离链表；
- Query 数据源；
- 每个 Archetype 的密集行、Table 与组件列。

`ArchetypeStore` 和 `EntitySlots` 不再是独立对象，相关热路径状态已经收敛到 World。
Entity slot 使用独立 12 位版本和一个 32 位压缩位置；位置由 12 位 Archetype 索引与
20 位 ArchetypeRow 组成。版本耗尽的 slot 先进入隔离链表，只有全部实体索引都使用过后
才允许回绕到版本 1，以约 6 MiB 的最坏额外 slot 空间换取更强的 ABA 防护。

Allocator 由构造方拥有。World 只借用分配器，并在释放时归还自己申请的 Buffer。

World 只有一个公开能力层：

```text
World
├─ component/query
├─ spawn/valid/has/get/set
├─ migrate/despawn
└─ ref 与诊断、扩展底层 API
```

`component(type)` 使用即注册，不存在独立 `defineComponent()`。`spawn()` 立即创建有效
Entity 身份，但第一次 `migrate()` 前不属于任何 Archetype，因此 Query 不可见。
Archetype 删除行后不清理旧数据，目标行复用时也不自动清零；初始化或覆盖策略由上层决定。

World 不提供业务层结构修改时序保证。直接访问它等同于使用底层不安全能力：调用方必须
自行避免在活跃 Query 迭代期间迁移或销毁相关实体。框架不为此增加热路径权限检查。

`EntityRef` 是绑定 `World + Entity` 的低频只读便利对象，不缓存物理位置、不参与 Query，
数字 Entity 仍是存储和热路径中的唯一实体值。

## Query

Query 按 Archetype Chunk 返回缓存列视图，并复用自身 QueryIter。World 维护 Archetype
集合版本和全局 Chunk 布局版本；稳定布局检查为 O(1)，版本变化时 Query 才增量匹配新
Archetype 或同步受影响 Chunk。

同一个 Query 实例的内置 iterator 不可重入。Game 在同一个 System 参数列表中允许重复
声明同一个 QueryType，每个参数位置会构建独立 Query 实例，因此嵌套同型查询应显式声明
两个相同 Query 参数。

## Scheduler

Scheduler 只认识 Stage、SystemSet、系统函数、不透明参数与依赖图。参数由 Game 在
prepare 阶段解析一次，运行阶段复用固定参数数组。

## Game

Game 是组合根，持有 World、Scheduler、Resource/State/Service 容器与 Module。
`game.world` 和 `[World]` 系统参数都返回同一个完整 World，不创建 WorldView wrapper。
业务代码通常使用 Service 与延迟 Commands；直接访问 World 是保留给底层扩展的可选入口。

系统参数映射为：

```text
World                    -> World
QueryType                -> Query
ResourceType             -> Readonly<Resource>
StateType                -> Readonly<State>
Write(StateType)         -> Mut<State>
ServiceToken             -> Service
```

重复的 QueryType 参数按声明位置解析为独立 Query；重复的其他参数仍拒绝。

`Commands` 是 Game Service。Game EntityCommand 进入统一队列，在 `Update.post` 合并同一
Entity 的修改并延迟应用结构变化。直接 World 修改不会自动获得 Hierarchy 等 Game 模块语义。

## 生命周期

```text
build
  -> init: State -> Service -> Scheduler -> Module
  -> start: prepare -> Startup -> Service -> Module
  -> update: first -> fixed -> last -> post
  -> stop: Module(reverse) -> Service(reverse) -> Shutdown
  -> dispose: Module -> Scheduler -> Service -> State -> World -> owned Allocator -> Resource
```

## 包边界

稳定入口不保留未发布时期的旧名称兼容层：`Game`、`GameBuilder`、`GamePhase`、`Commands`、
`World.spawn()` 和 `Archetype.chunks` 是唯一名称。底层诊断与存储能力位于
`@zero-ecs/world/advanced` 和 `@zero-ecs/game/advanced`。
