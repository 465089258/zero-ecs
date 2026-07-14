# zero-ecs-lib API 参考

本文档描述 2026-07-14 仓库中的实际 API。它记录当前行为，不代表尚未实现的目标设计。

## 1. 导入与最小启动

稳定公共入口为 `zero-ecs-lib`，提供 Runtime、Component、Entity、Query、Command、System 和可选 Module。Allocator、DataSet、Mask、Archetype、容器与 DevProfiler 位于不保证兼容的 `zero-ecs-lib/advanced`；内部 Post 和 EntityMigrationService 不从任何包入口导出。

```ts
import { EcsBuilder } from "zero-ecs-lib";

const ecs = new EcsBuilder().build();

ecs.init();
ecs.start();
ecs.update();
ecs.stop();
ecs.dispose();
```

`EcsBuilder` 构造时自动安装 `CoreEcsModule`，因此基础内存、组件、Archetype、Entity 和 Query 服务不需要手动注册。

## 2. Runtime

### `EcsBuilder`

ECS 的组合根。`build()` 后 Builder 锁定，不能继续注册内容。

```ts
class GameModule implements Module {
    build(builder: EcsBuilder): void {
        builder.addState(GameState);
        builder.addService(GameService);
    }

    init(ecs: Ecs): void {}
    start(ecs: Ecs): void {}
    stop(ecs: Ecs): void {}
    dispose(ecs: Ecs): void {}
}

const builder = new EcsBuilder()
    .setWorld(new World())
    .addResource(GameConfig, config)
    .addState(GameState)
    .addService(GameService)
    .addModule(new GameModule());
```

| API | 作用 |
| --- | --- |
| `setWorld(world)` | 替换默认 World，只能在 build 前调用 |
| `addResource(type, instance)` | 注册已实例化的静态资源 |
| `addState(type)` | 注册纯状态类型，由 Builder 实例化 |
| `addService(type)` | 注册功能服务类型，由 Builder 实例化 |
| `addSystem(stage, fn, params, options?)` | 注册系统并返回 `SystemHandle` |
| `before(system, target)` | 添加系统前置关系 |
| `after(system, target)` | 添加系统后置关系 |
| `chain(...systems)` | 按参数顺序建立依赖链 |
| `addModule(module)` | 保存 Module 实例并立即调用 `build(builder)` |
| `build()` | 创建容器、完成注入并生成 `Ecs` |

### `Ecs`

`Ecs` 持有同层级的 World、三个容器和 Scheduler。

| API | 当前行为 |
| --- | --- |
| `resource(Type)` | 获取 Resource 实例 |
| `state(Type)` | 返回 `Readonly<T>` 类型的 State |
| `service(Type)` | 获取 Service 实例 |
| `init()` | World → State → Service → Scheduler → Module.init 初始化 |
| `start()` | 运行 `Startup` 系统，再顺序调用 Module.start |
| `update()` | 依次运行 `Update.first/fixed/last`，然后运行内部 Post |
| `stop()` | 逆序调用 Module.stop，再运行 `Shutdown` 系统 |
| `dispose()` | 逆序 Module.dispose，再释放 Scheduler、Service、State、World 并清空 Resource 容器 |

生命周期状态为：

```ts
enum EcsPhase {
    Built,
    Initialized,
    Running,
    Stopped,
    Disposed,
}
```

`start()` 只能在 Initialized 调用，`update()` 只能在 Running 调用。

### `Module`

```ts
interface Module {
    build(builder: EcsBuilder): void;
    init?(ecs: Ecs): void;
    start?(ecs: Ecs): void;
    stop?(ecs: Ecs): void;
    dispose?(ecs: Ecs): void;
}
```

- `build()` 在添加到 Builder 时立即执行。
- `init()`、`start()` 按 Module 注册顺序执行。
- `stop()`、`dispose()` 按 Module 注册逆序执行。
- 同一个 Module 实例不能重复添加；同一类型的不同实例允许添加。
- Module hook 是同步方法。
- Module 适合管理 DOM 监听器、Worker、网络连接等容器外资源。
- 每帧行为仍应注册成 System，不给 Module 提供 update hook。
- `ecs.modules` 保存冻结后的 Module 顺序，其中第一个是自动安装的 `CoreEcsModule`。

## 3. Resource、State、Service 与 World

### 类型职责

```ts
abstract class Resource {}
abstract class State {
    init?(): void;
    dispose?(): void;
}
abstract class Service {
    init?(): void;
    dispose?(): void;
}
```

- Resource：上层在 build 前传入的实例，容器 build 后锁定。
- State：保存运行状态，可以参与系统读写权限声明。
- Service：工具方法集合，自身决定开放哪些修改能力，不参与 State 的 `Write` 权限规则。
- World：底层入口，只负责访问三个容器。
- InjectionService：给 Command 等运行时创建的辅助对象填充声明式依赖。
- ErrorHandlerService：统一接收 Command、Event、Timer 等延迟工作中可恢复的错误。

### 属性注入

```ts
class PhysicsService extends Service {
    @Resource.inject(GameConfig)
    private readonly config!: GameConfig;

    @State.inject(GameState)
    private readonly state!: GameState;

    @Service.inject(RandomService)
    private readonly random!: RandomService;

    @World.inject()
    private readonly world!: World;
}
```

同类别的 State 和 Service 初始化顺序会根据属性注入关系进行拓扑排序。循环依赖会在初始化时抛错。

dispose 使用实际初始化顺序的严格逆序；一个实例清理失败不会跳过其余实例，容器完成清理后重新抛出第一个错误。

```ts
ecs.service(ErrorHandlerService).setHandler((error, source, target) => {
    report(error, source, target);
});
```

同步 System 抛错仍直接返回给 `Ecs.update()` 调用方；ErrorHandlerService 只处理框架能够回收并继续清理的延迟工作错误。

### `World` 与动态注入

```ts
world.resource(GameConfig);
world.state(GameState);
world.service(PhysicsService);

const injection = ecs.service(InjectionService);
injection.inject(dynamicObject);
```

`InjectionService` 是唯一的动态注入入口，由基础运行时自动注册。它只填充依赖，不创建、不初始化、不保存，也不销毁目标对象。同一个对象在同一 Ecs 中重复注入是幂等操作；把已经注入的对象交给另一个 Ecs 会抛错。

动态注入主要用于池化 Command、EventArgs 和运行时辅助对象。系统的 Resource、State、Service 和 Query 依赖仍应显式登记在系统参数元组中，避免隐藏 Scheduler 未来需要分析的状态访问。

### 所有权与保存期限

| 对象 | 所有者 | 保存规则 |
|---|---|---|
| Resource | 上层调用方 | ECS 只保存引用且不会 dispose；实例在运行期不可替换 |
| State / Service | Ecs 容器 | 由 Ecs 创建和 dispose；Ecs.dispose 后不得继续使用 |
| World | Ecs 生命周期 | 可以由上层提供实例，但 bind/init/dispose 由 Ecs 驱动 |
| InjectionService | ServiceContainer | 绑定当前 Ecs 的内部 InjectionContext；Ecs.dispose 后拒绝继续注入 |
| 动态注入对象 | 创建该对象的调用方或对象池 | InjectionService 不接管生命周期；对象不得跨 Ecs 复用 |
| Query | QueryService / System 参数 | 绑定当前 Ecs；不得跨 Ecs 使用，Ecs.dispose 后失效 |
| QueryIter/current/组件列 | Query 缓存 | Iter 和 tuple 会复用；组件列只在当前结构版本下有效 |
| Command / EntityCommand | CommandService 对象池 | submit 前由调用方持有；submit 后不可修改，flush 后不可继续使用 |
| EventArgs | EventService 对象池 | post 后所有权转交 EventService；派发完成后不可继续使用 |
| Entity | 数值句柄 | 可以长期保存，但每次使用都应允许其版本已经失效 |

## 4. Component

### 定义组件

```ts
const enum Position {
    x,
    y,
}

class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

class PlayerTagType implements Component<never> {}
```

`Component<K>` 会在编译期要求实现枚举 `K` 的全部字段。字段必须从 0 开始连续排列；`ComponentService.def()` 会在运行时再次验证。

支持的列类型：

```ts
Types.I8
Types.U8
Types.U8C
Types.I16
Types.U16
Types.I32
Types.U32
Types.F32
```

### `ComponentService`

```ts
const components = ecs.service(ComponentService);

const position = components.def(PositionType);
const cached = components.get(PositionType);
const byId = components.getById(position.id);
```

| API | 当前语义 |
| --- | --- |
| `def(Type)` | 在当前 ECS 中首次定义组件，重复调用返回同一 Meta |
| `get(Type)` | 只查询，不注册，不消耗 ID |
| `getById(id)` | 供存储内部按当前 World 的 ID 查询 |

`ComponentMeta`：

```ts
type ComponentMeta<T> = Readonly<{
    id: ComponentId;
    name: string;
    mask: Mask;
    type: ComponentType<T>;
    layout: readonly Types[];
}>;
```

组件类是跨 World 的稳定标识；`ComponentId` 只在某个 `ComponentService` 实例中有效。

## 5. Entity

`Entity` 是带版本的无符号 32 位数字句柄。当前布局使用 20 位索引和 12 位版本。generation 到达 4095 后对应 slot 会永久退休，不会回绕并使旧句柄重新有效。

### `EntityService`

```ts
const entities = ecs.service(EntityService);
const entity = entities.spawn();

entities.valid(entity);
entities.has(entity, PositionType);
entities.get(entity, PositionType, Position.x);
entities.getTypes(entity);
```

主要 API：

| API | 返回值或行为 |
| --- | --- |
| `spawn()` | 分配 Entity 句柄，但不自动加入 Archetype |
| `valid(entity)` | 检查索引与版本 |
| `has(entity, Type)` | 未注册或实体没有组件时返回 false |
| `get(entity, Type, field)` | 返回字段数值；不可用时返回 null |
| `view(entity, Type)` | 返回实体所在 Table 的组件列视图；不可用时返回 null |
| `getTypes(entity)` | 返回当前 Archetype 中的组件类数组 |
| `getCompLocation(entity)` | 返回 `{ tableId, row }` 或 null |

`view()` 返回的是整个 Table 的 TypedArray 列，不是单实体对象。访问实体所在行时需要配合 location：

```ts
const location = entities.getCompLocation(entity);
const position = entities.view(entity, PositionType);

if (location && position) {
    const x = position[Position.x][location.row];
}
```

`migrate()`、`despawn()`、`getArchIdx()` 等方法目前仍公开，但主要用于 EntityCommand 和底层存储实现。普通系统应优先使用延迟命令。

## 6. EntityCommand

安装命令 Module：

```ts
const builder = new EcsBuilder()
    .addModule(new CommandModule());
```

取得单实体写入器：

```ts
const commands = ecs.service(CommandService);
const command = commands.entity(entity);

command
    .add(PositionType)
    .set(PositionType, Position.x, 30)
    .remove(PlayerTagType)
    .submit();
```

销毁实体：

```ts
commands.entity(entity).despawn().submit();
```

| API | 当前语义 |
| --- | --- |
| `CommandService.entity(entity)` | 为已有实体取得一个未提交的 EntityCommand |
| `CommandService.spawn()` | 立即预留 Entity ID 并返回未提交的 EntityCommand |
| `CommandService.flush()` | 内部执行并回收统一队列；结构结果随后由 Migration Post 提交 |
| `EntityCommand.add(Type)` | 幂等添加组件 |
| `EntityCommand.set(Type, field, value)` | 写入字段；组件不存在时自动添加 |
| `EntityCommand.remove(Type)` | 幂等移除组件 |
| `EntityCommand.has(Type)` | 读取实体初始结构与本事务指令合成后的存在状态 |
| `EntityCommand.get(Type, field)` | 读取实体初始值与本事务写入合成后的字段值 |
| `EntityCommand.despawn()` | 将本实体命令标记为销毁 |

规则：

- `entity()` 每次返回独立事务；需要 read-your-writes 的多 Service 组装必须共享同一个 EntityCommand/EntityMutator。
- EntityCommand 必须显式 `submit()`；未提交 Command 不会自动取消或回收。
- submit 后禁止继续修改；flush 后对象已回池，继续使用属于非法契约。
- 相同字段重复写入时，最后一次写入生效。
- Despawn 是终止状态，之后所有组件操作都会报错。
- `Remove → Add` 和 `Remove → Set` 会先清零全部字段，只应用 Remove 之后的 Set。
- 下层组装 Service 接收同一 `EntityMutator` 类型视图即可共享 read-your-writes；该视图没有 `submit/despawn` 能力且不创建运行时包装。
- EntityCommand 执行只合并内部 MigrationPlan；实际 Archetype 迁移发生在随后的 Migration Post。
- 同一 Post 周期内，一个 Entity 最多迁移一次；EntityMigrationService 不从公共入口导出。
- 只有 Set 且没有 pending MigrationPlan 时直接写入组件列，不触发 Archetype 迁移；写入前会先验证全部字段。
- `CommandModule` 在内部 Post flush 唯一的 CommandService。

## 7. 通用 Command

`CommandService` 是普通 Command 与 EntityCommand 共用的唯一对象池命令队列。

```ts
abstract class Command {
    submit(): void;
    clear?(): void;
    abstract execute(): void;
}

const command = commands.cmd(MyCommand);
command.set(...).submit();
```

Command 首次创建时会通过 `InjectionService.inject()` 注入属性，执行后调用 `clear()` 并回收到对应类型的池。池中复用时不重复注入。

## 8. Query

### QueryType 与 Filter AST

```ts
const movementQuery = QueryType.from(
    All(
        With(PositionType, VelocityType),
        Optional(PlayerType),
        Without(DeathTagType),
    ),
);
```

| 节点 | 作用 |
| --- | --- |
| `With(...Types)` | 必须存在，同时作为 Query 返回列 |
| `Without(...Types)` | 必须不存在，不返回列 |
| `Optional(...Types)` | 不影响匹配，返回列可能为 undefined |
| `All(...nodes)` | 所有子条件成立 |
| `Any(...nodes)` | 任一子条件成立，返回项会可选化 |

当前限制：

- `Optional` 不能放在 `Any` 内。
- 同一组件不能重复选择。
- Optional 组件不能同时被 With 或 Without 约束。
- DNF 展开最多允许 256 个子句。

`QueryType` 只保存静态 AST。`Query` 构造时才通过 `ComponentService.def()` 注册相关组件、展开 DNF 并编译 Mask。

### 系统中遍历 Query

```ts
type MovementQuery = QueryOf<typeof movementQuery>;

function movementSystem(query: MovementQuery): void {
    const iter = query.iter();

    while (iter.next()) {
        const [count, entities, positions, velocities, players] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];

        for (let i = 0; i < count; i++) {
            const entity = entities[i];
            const x = xs[i];
            const y = ys[i];
            const playerColumns = players;
        }
    }
}

builder.addSystem(Update.fixed, movementSystem, [movementQuery]);
```

每次 `next()` 返回 `true` 后，`current` 对应一个 Archetype Table：

- `count` 是当前有效行数。
- `entities` 是 Entity 的 `Uint32Array`。
- 后续元素按照 With/Optional 的定义顺序返回组件列。
- Optional 是 Table 级 `undefined`，因为同一个 Archetype 内组件集合相同。
- QueryIter 和 current tuple 会复用，不应长期保存；调用 `next()` 前以及其返回 `false` 后，不应读取 `current`。

## 9. System 与 Scheduler

### 阶段

```ts
Startup
Update.first
Update.fixed
Update.last
Internal Post（不公开）
Shutdown
```

`Ecs.update()` 固定运行三个公开 Update 阶段，随后运行内部 Post。Post 不从根入口导出，普通业务系统不能注册。

### 参数注册

```ts
function readSystem(config: GameConfig, state: GameState, service: GameService): void {}

function writeSystem(state: Mut<GameState>): void {
    state.frame++;
}

builder.addSystem(Update.fixed, readSystem, [GameConfig, GameState, GameService]);
builder.addSystem(Update.fixed, writeSystem, [Write(GameState)]);
```

支持参数：

- `World`
- Resource 类型
- State 类型
- `Write(StateType)`
- Service 类型
- QueryType 实例

当前访问记录语义：

- 普通 Resource 和 State 进入 `SystemAccess.reads`。
- `Write(StateType)` 进入 `SystemAccess.writes`。
- Service 自己决定开放能力，不进入读写集合。
- Query 权限尚未纳入访问集合。
- World 被记录为不透明全局访问。

注意：当前 `SystemParamValue` 尚未把普通 Resource/State 参数映射成 TypeScript `Readonly<T>`；只读目前主要体现在注册语义和 `Ecs.state()` 返回类型上。

### 依赖规则

```ts
const first = builder.addSystem(Update.fixed, firstSystem, []);
const second = builder.addSystem(Update.fixed, secondSystem, [], {
    after: first,
});

builder.before(first, second);
builder.after(second, first);
builder.chain(first, second);
```

依赖目标可以是唯一注册的函数或 `SystemHandle`。同一个函数注册多次时必须使用 Handle。跨阶段依赖不能逆转阶段顺序；同阶段依赖使用稳定拓扑排序，无显式依赖时保持注册顺序。

## 10. Advanced：内存与 DataSet

以下 API 从 `zero-ecs-lib/advanced` 导入：

```ts
import { ChunkAllocator, DataSet, Types } from "zero-ecs-lib/advanced";
```

### 固定内存模型

```ts
BLOCK_SIZE      // 2 MiB
CHUNK_SIZE      // 16 KiB
CHUNKS_PER_BLOCK // 128
```

### `ChunkAllocator`

| API | 作用 |
| --- | --- |
| `alloc()` | 从 free list 分配 16 KiB MemoryChunk |
| `free(handle)` | 通过 generation 校验后释放 |
| `resolve(handle)` | 句柄有效时返回 MemoryChunk，否则返回 null |
| `owns(handle)` | 检查句柄是否属于当前 allocator |
| `stats()` | 返回 block、chunk 和字节统计 |
| `trim()` | 回收完全空闲的大块 |
| `clear()` | 清空全部 Block |

### `DataSet` 与 `Table`

```ts
const data = new DataSet(allocator, [Types.U32, Types.F32] as const);
const row = data.insert();

data.set(row, 0, 1);
data.set(row, 1, 10.5);
```

- 一个 Table 对应一个 16 KiB Chunk。
- 每列是覆盖同一 Chunk 不同区域的 TypedArray。
- `createTableLayout()` 计算对齐、容量和剩余字节。
- `remove()` 使用尾行 swap-remove，并通过 `RemoveResult` 告知是否移动了尾行。
- `DataSet.version` 只在 Table 创建或释放时变化，用于 Query 缓存失效。
- `retainEmptyTables` 控制保留多少空 Table，默认 1。

## 11. Advanced：Archetype

每个 Archetype：

- 持有一组排序后的 `ComponentMeta`。
- 使用 Mask 表示组件集合。
- 使用一个 DataSet 存储 Entity 列和所有组件字段列。
- 每个 Table 都是固定 16 KiB。

`ArchetypeService` 按 Mask 查找或创建 Archetype，并维护版本号供 Query 检测。

`Archetype`、`ArchetypeService`、`Mask`、`ComponentId` 只从 `zero-ecs-lib/advanced` 导出，不属于稳定公共 API。

## 12. 可选功能 Module

| Module | 注册内容 | 系统阶段 |
| --- | --- | --- |
| `CommandModule` | CommandService | Internal Post flush |
| `EventModule` | EventService | Internal Post 最后 flush |
| `TimeModule` | FixedTimeResource、TimeState | Update.first tick |
| `TimerModule` | TimerService | Update.fixed advance |
| `RandomModule` | RandomService | 无系统 |

TimerService 依赖 FixedTimeResource 和 TimeState。实际使用计时器时应同时安装 `TimeModule` 和 `TimerModule`。

### EventService

```ts
class DamageEvent extends EventArgs {
    amount = 0;
    set(amount: number): this {
        this.assertMutable();
        this.amount = amount;
        return this;
    }
}

events.on(DamageEvent, onDamage);
events.event(DamageEvent).set(10).post();
```

EventService 使用双队列和对象池，在 flush 时派发；支持 `on()`、`one()` 和 `off()`。EventArgs 生命周期固定为 `Recycled → Mutable → Posted → Recycled`，同一实例只能 post 一次；事件子类的写方法应先调用 `assertMutable()`，从而拒绝 post 后或回池后的修改。

### FixedTimeResource、TimeState、TimerService、RandomService

- `FixedTimeResource.deltaSeconds`：构建前传入的不可变固定步长。
- `TimeState`：每 Tick 更新 `delta`、`elapsed` 和整数 `tick`，不读取 wall clock。
- `TimerService.once(delaySec, task)`：通过分层时间轮延迟调用 `task.submit()`。
- `RandomService`：确定性 sfc32 随机数，构造时使用确定默认种子，也可调用 `seed()` 重置；范围、数组和权重输入必须有效，权重必须是有限正数。

## 13. Advanced：DevProfiler

```ts
import { DevProfiler } from "zero-ecs-lib/advanced";

const profiler = new DevProfiler(ecs);

profiler.getMemoryReport();
profiler.getPerformanceReport();
profiler.startLogging(1000);
profiler.stopLogging();
profiler.dispose();
```

Profiler 会包装 Scheduler 的运行函数采样耗时，只应在开发阶段使用。

## 14. 已明确延期的 API

以下能力不属于当前纯运行时核心：

1. Query 组件读写权限与自动冲突图。
2. 并行 Scheduler 和自动批次。
3. Editor、Prefab、EntityTemplate 和新的批量实体模板能力。
4. Boolean 组件列与深层 Readonly 类型。
5. 渲染同步、插值和 wall-clock 追帧；这些由上层引擎负责。

内存与无 JIT 成本见[性能与分配模型](./performance.md)。
