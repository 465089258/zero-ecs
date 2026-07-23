# 三库架构

> 三个包的长期职责、禁止依赖和新增功能归属规则，以
> [Zero ECS 架构宪法](./architecture-constitution.md) 为准。本文描述当前三库实现结构。

## 1. 依赖方向

```text
@zero-ecs/world          @zero-ecs/scheduler
纯 ECS 数据内核          通用静态调度器
          \              /
             @zero-ecs/game
       DI、生命周期、命令与标准功能
```

`world` 和 `scheduler` 相互独立，也不依赖 Game。Game 通过 peer dependency 组合二者，
一个进程中必须保持单份 `World` 与 `Stage` 运行时身份。

## 2. World

World 是即时、底层、不提供业务时序保护的数据存储内核。它直接持有：

- Component 注册数据；
- Archetype 数组、Mask 索引和布局版本；
- Entity slot、版本、压缩位置、空闲链表和版本耗尽隔离链表；
- Archetype Table、密集行和组件列；
- Query 数据源。

稳定接口集中为：

```ts
class World {
    component<T>(type: ComponentType<T>): ComponentDefinition<T>;
    query<T>(type: QueryType<T>): Query<T>;

    spawn(): Entity;
    valid(entity: Entity): boolean;
    has<T>(entity: Entity, type: ComponentType<T>): boolean;
    get<T, F>(entity: Entity, type: ComponentType<T>, field: F): Value | null;
    set<T, F>(entity: Entity, type: ComponentType<T>, field: F, value: Value): boolean;

    migrate<Ctx>(
        entity: Entity,
        mask: Mask,
        types: readonly ComponentMeta[],
        callback: (this: Ctx, archetype: Archetype, row: ArchetypeRow) => void,
        ctx?: Ctx,
    ): boolean;

    despawn(entity: Entity): boolean;
    dispose(): void;
}
```

`component(type)` 使用即注册。`spawn()` 立即分配有效 Entity 身份，但第一次 migrate 前
不属于任何 Archetype，Query 看不到它。

World 不提供 `add/remove` 和 EntityCommand。事务、合并、延迟提交、清零策略和对象池都
属于 Game。World 在迁移和删除时不主动清理废弃行；目标行复用后的初始化由调用者决定。

### 2.1 Entity slot

Entity 使用 20 位索引和独立 12 位版本。slot 位置使用一个 U32：

```text
31                    20 19                     0
┌──────────────────────┬────────────────────────┐
│ Archetype index: 12  │ ArchetypeRow: 20       │
└──────────────────────┴────────────────────────┘
```

版本达到上限的 slot 进入隔离链表，不立即回绕。只有全部实体索引都已经使用后才允许从
隔离链表取槽并把版本回绕到 1，避免正常容量范围内的陈旧句柄复活。

### 2.2 Query

World 版本只表达 Archetype 集合变化，每个 Archetype 的版本只表达自己的物理 Chunk
集合变化。稳定 `Query.iter()` 为 O(1)；QueryIter 首次进入匹配 Archetype 时比较局部版本，
只同步发生变化的连续尾 Chunk。

一个 Query 复用一个内置 QueryIter，因此同一实例不可重入。Game 允许系统参数重复声明
相同 QueryType，并为每个参数位置创建独立 Query，嵌套同型查询使用两个参数即可。

### 2.3 底层扩展入口

World 本身就是底层 ECS 内核，不再为 Game 设置专用 bridge。Game 与其他扩展直接使用
`component/findComponent/componentById/resolve/migrate`，其中 `resolve(entity, out)`
允许调用者复用位置对象并在批量字段操作中只校验实体一次。只读 QueryProjection 在定义时
绑定隐藏存储组件，不需要 GameBuilder 为每个 World 注册映射。

## 3. Scheduler

Scheduler 只认识：

- Stage 与 SystemSet；
- 系统函数和不透明参数 token；
- before/after 依赖；
- `SystemParamProvider`。

Game 在 start/prepare 冷路径解析参数，Scheduler 将结果编译为 0～8 参数专用 runner；
更多参数复用冻结数组执行 `apply`。运行阶段不再判断参数数量。Scheduler 不导入 World、
Query、Resource、State、Service 或 Game 生命周期。

## 4. Game

Game 是组合根，持有：

```text
World
Scheduler<SystemParam>
ResourceContainer
StateContainer
ServiceContainer
Module[]
```

`game.world`、`[World]` 系统参数和 `@Inject.world()` 都直接返回同一个完整 World，不创建
WorldView 或权限 wrapper。直接调用即时结构 API 时，调用方负责避开活跃 Query 迭代。
普通业务结构修改应使用 Commands。

系统参数映射为：

```text
World                    -> World
QueryType                -> Query
ResourceType             -> Readonly<Resource>
StateType                -> Readonly<State>
Write(StateType)         -> Mut<State>
ServiceToken             -> Service
```

## 5. Commands 与 Migrations

实体事务现在完整属于 Game：

```text
Commands.entity()/spawn()
        ↓
Game EntityCommand
        ↓ 记录 Add / Remove / Set / Despawn
EntityTransaction
        ↓ submit + Commands flush
Migrations pending queue
        ↓ 按 Entity 合并
Migrations accumulator
        ↓ Update.post / Structure
World.migrate() / set() / despawn()
```

职责边界：

```text
Commands
  普通 Command 队列、Command 对象池、提交扩展

EntityCommand
  面向业务的可提交命令，组合一个局部 EntityTransaction

EntityTransaction
  当前局部事务内的 read-your-writes、目标 Mask、字段写、清零集合和合并状态机

Migrations
  事务池、待处理队列、Entity→accumulator 稀疏索引、最终应用

World
  立即执行底层数据修改
```

### 5.1 合并语义

- `add → remove`：最终不存在该组件；
- `remove → add`：视为新组件，Game 在应用写入前清零全部字段；
- `set`：组件不存在时隐式 add；
- 同一字段多次 set：最后一次覆盖；
- despawn：该实体当前批次的终止结果；
- 同一提交批次内的同一实体多条命令：最终最多执行一次结构迁移；
- 目标 Archetype 未变化：跳过 migrate，只执行字段直写。

EntityTransaction 和分页稀疏索引都采用高水位复用。稳定工作集下，命令记录、合并和应用
不产生逐实体临时对象。

### 5.2 扩展边界

Hierarchy 等可选模块通过 `CommandFlushExtension` 在事务合并前观察当前 pending
EntityCommand，并可追加普通命令或关系操作。所有扩展完成后才统一 collect，确保同一提交
批次仍按 Entity 合并。

直接调用 World 不经过这一边界，因此不会自动获得 Hierarchy 递归 despawn 等 Game 语义。

## 6. 生命周期

```text
build
  创建或接管 World
  注册 Resource / State / Service / Module

init
  State.init
  Service.init / activate
  Scheduler.init
  Module.init

start
  Scheduler.prepare
  Startup
  Service.start
  Module.start

update
  Update.first
  Update.fixed
  Update.last
  Update.post
    Commands
    Structure / Migrations
    Event 等依赖系统

dispose
  Module
  Scheduler
  Service
  State
  World
  Game 自建 Allocator
  Resource
```

## 7. 公共命名

框架尚未发布，不保留旧接口兼容层。唯一正式名称包括：

- `Game`、`GameBuilder`、`GamePhase`；
- `Commands`；
- `World.spawn()`；
- `World.component()`；
- `Archetype.chunks`。

已删除的接口和别名不会以 deprecated 形式继续存在。
