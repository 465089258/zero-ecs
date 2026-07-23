# Game / World 内核架构

> 状态：已实施。World 已从 Service/State facade 迁移为独立实体内核；组件、Archetype、
> EntitySlots 和 Query 数据源由 World 物理持有。存储又进一步完成行所有权收敛：
> DataSet 只管理连续 Table，逻辑行属于 Archetype/EntitySlots。
>
> 当前代码已进一步拆为相互独立的 World、Scheduler、Game 三个库，完整边界与
> 实施结果见 [three-library-architecture.md](./three-library-architecture.md)。本文保留
> 已实施的 Game/World 内核迁移记录，不再作为最终包依赖图。

## 1. 定位

`World` 是纯实体数据集合与基础实体算法；`Game` 是组合根和运行时实例；
`Scheduler` 是应用于 World 的执行器；依赖注入是 Game 的能力，不属于 World。

```text
Game
├─ World                         实体内核
│  ├─ ComponentRegistry         普通对象，World-local ID
│  ├─ ArchetypeStore            普通对象，Mask 索引与版本
│  ├─ EntitySlots               句柄版本和 Archetype/chunkIdx/row
│  ├─ Archetype Chunks          密集行、结构版本和组件列缓存
│  ├─ DataSet / Table           连续表生命周期与固定列数据操作
│  └─ Query data source         Query 直接绑定上述对象
├─ ResourceContainer
├─ StateContainer
├─ ServiceContainer
│  └─ AllocatorService          借用构建 World 时使用的 IAllocator
├─ SystemParamProvider
├─ Scheduler
└─ Module[]
```

World 不拥有以下能力：

- Resource、State 或 Service 查找；
- InjectionContext 或属性注入；
- Scheduler、Stage 或 Game 生命周期；
- Module、Event、Timer、Command 队列。

## 2. World 物理所有权

World 构造完成后立即可用，不存在 attach/backend 阶段：

```ts
const allocator = new Allocator();
const world = new World(allocator);
const entity = world.spawn();
world.valid(entity);
world.query(QueryType.from(With(Position)));
```

以下原来的容器对象已经删除：

| 旧对象 | 当前归属 |
| --- | --- |
| `ComponentRegistryState` / `ComponentService` | World 私有 `ComponentRegistry` |
| `ArchetypeState` / `ArchetypeService` | World 私有 `ArchetypeStore` |
| `EntityState` / `EntityService` | World 字段与直接实体方法 |
| `QueryService` | `World.query()` |
| `CoreEcsModule` | 删除；内核不通过 Module 安装 |
| `EcsMemoryService` | `AllocatorService`，只作为 Game 侧门面 |

`ComponentRegistry` 与 `ArchetypeStore` 是普通 TypeScript 对象，不继承 State 或
Service，也不进入依赖注入容器。这个拆分只负责 World 内部可维护性，不形成新的
运行时转发层。

## 3. Allocator 归属

### 3.1 构造方拥有分配器

```ts
const allocator = new Allocator();
const world = new World(allocator);
```

`World` 的 `IAllocator` 构造参数不可省略。Allocator 由构造方创建并保留所有权，
World 只借用它。`world.dispose()` 的顺序是：

1. 释放实体 slot DataSet 的 Buffer；
2. 释放全部 Archetype/DataSet 的 Buffer；

World 不调用 `trim()` 或 `clear()`。构造方应在所有借用方释放后决定保留、裁剪或
清空分配器；调用 `clear()` 时若仍有 Buffer 未归还，它会抛错并暴露泄漏。

默认 Allocator 使用 `defaultAllocatorConfig`（16 KiB Buffer、2 MiB Block、每 Block
128 个 Buffer）。具体 Allocator 构造函数可接收 `bufferByteLength/blockByteLength`，
每 Block 数量由二者计算；配置只属于该 Allocator 实例，不是全局可变状态。

### 3.2 自定义分配器

```ts
const allocator = new Allocator();
const world = new World(allocator);
```

World 释放时归还自己的 Buffer，但不会 `trim` 或 `clear` 分配器；构造方负责其最终
生命周期。接口只要求 `alloc()` 与 `stats()`，
不要求外部实现具有 concrete Allocator 的清理方法。

### 3.3 GameBuilder 默认模型

```ts
new GameBuilder().build();                    // Game 创建并拥有默认 Allocator，再构造 World
new GameBuilder().setAllocator(allocator);    // 使用外部分配器构造默认 World，不接管 Allocator
new GameBuilder().setWorld(world);            // 接管 World 的释放，不接管其 Allocator
```

`setAllocator()` 与 `setWorld()` 互斥，避免两个分配器来源产生歧义。默认 World 在
`build()` 时才创建，而不是在 Builder 构造时提前占用内存。默认路径创建的 Allocator
由 Game 在 Service、State 和 World 全部释放后执行 `trim()/clear()`。

## 4. AllocatorService

`AllocatorService` 是 Game 向 Module 和上层 Service 提供的通用内存能力：

```ts
class RuntimeCacheService extends Service {
    @Service.inject(AllocatorService)
    private readonly memory!: AllocatorService;

    init(): void {
        const buffer = this.memory.alloc();
        // Service 自己保存并最终 dispose Buffer
    }
}
```

它实现 `IAllocator` 并暴露 `allocator`，实际对象就是 World 使用的同一个原始
IAllocator。AllocatorService：

- 由 GameBuilder 使用 World 的 IAllocator 构造，并通过 `ServiceContainer.set()` 注册；
- 不创建 Allocator；
- 不拥有或清空 Allocator；
- 不暴露二阶段 `bindAllocator()`；
- `dispose()` 只解除对借用分配器的引用；
- 不追踪每次分配，也不包装 Buffer。

因此 World、Service 和上层工具使用一致的内存模型，同时所有权仍然唯一。

## 5. World 底层能力

Game 与 System 直接取得完整 World，不创建能力 wrapper：

```ts
const system = defSystem(Update.fixed, (world: World) => {
    world.valid(entity);
}, [World]);
```

World 是底层不安全入口，框架不为业务层时序增加热路径分支。调用方必须避免在活跃
Query 迭代期间执行即时迁移或 despawn；普通业务修改优先通过 Game Commands 延迟提交。

## 6. Component、Entity 与 Query

稳定组件入口位于 World：

```ts
world.component(Position);
```

advanced 的 `defineComponentMeta(world, Type)` 与 `getComponentMeta(world, Type)`
用于取得 World-local ComponentId 和 Mask。

实体方法直接在 World 上执行，不经过 Service：

```ts
const entity = world.spawn();
world.valid(entity);
world.has(entity, Position);
world.get(entity, Position, PositionField.x);
world.ref(entity); // 低频只读便利对象；每次调用都会分配
world.despawn(entity);
```

`spawn()` 只分配有效句柄，不物化 Archetype 行。Command 提交的组件集合仍在
`Update.post` 中通过 MigrationPlan 物化或迁移。`view()`、`getTypes()` 与
`getCompLocation()` 是完整 World 的 advanced/诊断便利能力；后两者成功时会分配结果对象或数组。
`World.ref()` 同样属于明确分配的低频边界；返回的 EntityRef 不缓存
Archetype/chunkIdx/row，也不提供结构写能力。

`World.query(type)` 直接构造 Query，并把 World 私有 ComponentRegistry 与
ArchetypeStore 作为 `IComponentResolver` / `IArchetypeSource`。QueryIter/current tuple
继续复用；Query entry 现在只记录 `Archetype + chunkIdx`，并直接引用
`archetype.entities[chunkIdx]` 与 `archetype.views[chunkIdx][componentId]`。Chunk 集合变化由
Archetype 版本触发 rebuild，没有 QueryHandle、QueryPlan、DenseRows 或 Query 私有组件列适配层。

## 7. Command 与迁移

Command、Event 和 Timer 仍是 Game Service/State/System 功能，不进入 World 内核。

```text
Commands.spawn
→ World.spawn                             句柄立即有效
→ flushCommandSystem                     Update.post
→ EntityMigrationService.record
→ flushEntityMigrationSystem             after flushCommandSystem
→ MigrationPlan.flush(World)             实际物化/迁移
```

内建 Command、EntityCommand、EntityMigrationService 和 MigrationPlan 通过
`@Inject.world()` 取得完整 World。`InternalStructureAccess` 只是编译期 Pick 接口，
实际对象就是 World；没有 token、capability 对象、wrapper 或额外热路径转发。

## 8. Game 生命周期

World 在构造时已经可用，因此 Game 不再调用 World.init，也不执行 attach/detach。

```text
build
  claim World owner
  create/lock containers
  construct AllocatorService(World allocator)
  construct InjectionService(injection capability)
  construct ErrorHandlerService
  register built-in instances through ServiceContainer.set
  construct/register upper Service types; subclass prototype aliases replace matching defaults
  inject State and Service

init
  State.init
  Service.init barrier
  Service.activate barrier
  Scheduler.init
  Module.init

dispose
  Module.dispose
  Scheduler.dispose
  Service.dispose
  State.dispose
  World.dispose
  ResourceContainer.dispose
```

Service 在 init、activate 和 dispose 中都可以使用注入的 World。Service 必须在
dispose 返回前归还通过 AllocatorService 申请的 Buffer。World 随后归还内核 Buffer；
若 Allocator 由 GameBuilder 默认创建，Game 最后再清理它。

World 仍由 build 冷路径 claim，防止同一个实体内核同时交给两个 Game；Game dispose
或 build 失败后 World 进入终态，不可再次被 Game 采用。这个归属校验不进入 World
实体方法热路径。

## 9. Scheduler 与参数解析

Scheduler 只依赖 `SystemParamProvider`。Game 的 Resolver 在 start/prepare 冷路径解析
参数一次：

```ts
interface SystemParamProvider {
    resolve<P extends SystemParam>(param: P): SystemParamValue<P>;
}

scheduler.prepare(provider);
```

Provider 自己持有解析所需的 Game 上下文；World 不作为 `prepare()` 或 `resolve()` 的
额外参数传入。Scheduler 因而不导入、不保存也不识别 World，替换参数来源不要求改变
调度器。

| 参数 | 解析值 |
| --- | --- |
| `World` | 同一个完整 World |
| QueryType | `world.query(type)` |
| Resource / State / Write(State) / Service | 对应 Game 容器实例 |

运行阶段只复用固定参数数组，不每 Tick 查询容器。State Read/Write 仍是类型映射和
调度元数据，不是运行时访问控制。

## 10. 公共 API 与兼容性

本次迁移是明确的内核级 breaking change：

- 删除 ComponentService、ArchetypeService、EntityService、QueryService、
  EcsMemoryService 和 CoreEcsModule 的导出与实现；
- 使用 `World.component/query` 及直接实体 API；
- 新增稳定 Allocator 配置类型、默认配置、`IAllocator`、`Buffer` 与 `AllocatorService`；具体 `Allocator` 保持 advanced；
- advanced 元数据函数从接收 ComponentService 改为接收 World；
- Game 的 Module 列表不再隐含首个 CoreEcsModule。

不保留旧 Service adapter，以免重新形成双重所有权、额外转发和可绕过的 facade。

## 11. 验收不变量

- World 可以脱离 Game/DI 独立构造并立即执行实体操作。
- World、AllocatorService 使用同一个 IAllocator 对象。
- World 永远只归还自身 Buffer；Game 只清理 GameBuilder 创建的默认 Allocator。
- Service 先于 World dispose。
- Query 与 Command/Migration 算法行为保持不变。
- `[World]` 编译期映射为完整 World，运行时零 wrapper。
- Scheduler/Query/字段访问/批量迁移没有新增权限分支或 capability 分配。
- 旧核心 Service 不出现在 root 或 advanced 包入口。
- 正常 JIT、`--jitless`、声明类型与示例构建全部通过。

当前 Archetype 保留一个额外空 Chunk，并只从连续尾部释放更多空 Chunk；DataSet 不参与
行数、版本或回收策略。若未来要切换为完全 high-water retain 或增加显式 trim，应作为独立
存储性能变更评审，不能与 World facade 或 Scheduler candidate 混测。
