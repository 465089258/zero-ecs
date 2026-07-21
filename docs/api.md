# API 参考

## 包入口

```ts
import { World, Allocator } from "@zero-ecs/world";
import { Scheduler, ScheduleBuilder, Stage } from "@zero-ecs/scheduler";
import { GameBuilder, defSystem, Update } from "@zero-ecs/game";
```

底层诊断能力位于 `@zero-ecs/world/advanced` 和 `@zero-ecs/game/advanced`。Event、Time、
Timer、Random、Pool、Hierarchy 也分别具有 Game 子路径入口。

## @zero-ecs/world

### Allocator

```ts
const allocator = new Allocator({
    bufferByteLength: 16 * 1024,
    blockByteLength: 2 * 1024 * 1024,
});
```

配置会在构造边界校验并归一化。`World` 参数必填，World 只借用分配器：

```ts
const world = new World(allocator);
world.dispose();
allocator.clear();
```

`createTableLayout(types, bufferByteLength)` 位于 advanced，buffer 大小没有隐式默认值。

默认 Allocator 第一次增长会保留一个 2 MiB Block。大量小型 World 不应各自无条件使用默认
配置：可以让多个 World 借用同一个外部 Allocator，或为小 World 使用较小的
`blockByteLength`。共享分配器仍由构造方统一清理，任一 World 都只归还自己的 Buffer。

### Component 与 Query

```ts
const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Target { entity }
class TargetType implements Component<Target> {
    readonly [Target.entity] = Types.Entity;
}

const queryType = QueryType.from(With(PositionType));
const query = world.query(queryType);
const iter = query.iter();
while (iter.next()) {
    const [count, entities, positions] = iter.current;
    const xs = positions[Position.x];
    const ys = positions[Position.y];
    for (let row = 0; row < count; row++) {
        xs[row] += 1;
        consume(entities[row], xs[row], ys[row]);
    }
}
```

Query 按 Archetype Chunk 返回列视图并复用 `QueryIter/current`。不要跨结构变化保存迭代器结果或在
同一 Query 上嵌套迭代。逐行循环前应把需要的字段列缓存为局部变量，不在循环中重复写
`positions[Position.x][row]` 这样的两级访问。

只读 `QueryProjection<T>` 也可以参与 `With/Without/Optional`。它由组合层映射到隐藏
ComponentType，只在 Query 创建冷路径解析，运行时不创建视图包装；投影本身不是
ComponentType，不能传给 EntityCommand 的 `add/remove/set`。

实体引用字段使用 `Types.Entity`，不要使用 `Types.U32` 后再由业务层断言：

```ts
const target: Entity = targets[Target.entity][row];
commands.entity(target);
```

它的物理存储仍是 `Uint32Array`，不会产生包装或运行时转换；区别只存在于 TypeScript
类型层。`World.get()`、`EntityRef.get()`、Query 组件列以及 EntityCommand 的 `get/set`
都会把该字段推导为 `Entity`。`Types.U32` 继续表示普通无符号整数。需要表达“无实体”时使用
`INVALID_ENTITY`，不要在业务代码中写 `0 as Entity`。

advanced 代码需要直接遍历 Archetype 时，使用连续 `chunkIdx`，而不是保存 Table 或
DataSet：

```ts
for (let chunkIdx = 0; chunkIdx < archetype.chunkCount; chunkIdx++) {
    const count = archetype.chunkRowCount(chunkIdx);
    const entities = archetype.entities[chunkIdx];
    const positions = archetype.views[chunkIdx][positionId];
}
```

`views` 的形状固定为 `[chunkIdx][componentId][fieldId]`；ComponentId 这一层是稀疏索引。
这些列属于 Archetype/Chunk 生命周期，结构变化后不得长期保留。底层 `DataSet` 只管理
Table 的 `push/pop`，Table 本身不提供行分配、删除、计数或版本 API。

### WorldView 与 StructureWriter

```ts
interface WorldView {
    ref(entity: Entity): EntityRef;
    valid(entity: Entity): boolean;
    get(entity, component, field): ComponentFieldValue<Component, Field> | null;
    has(entity, component): boolean;
}

interface StructureWriter {
    reserveEntity(): Entity;
    despawn(entity: Entity): boolean;
    createEntityCommand(entity: Entity): EntityCommand;
    applyEntityCommand(command: EntityCommand): boolean;
}
```

`getTypes()` 和 `getCompLocation()` 是会分配的诊断 API，不属于 `WorldView`；后者返回
`{ chunkIdx, row }`。

### EntityRef

`world.ref(entity)` 每次创建一个低频只读便利对象：

```ts
const player = world.ref(playerEntity);
if (player.valid && player.has(HealthType)) {
    const health = player.get(HealthType, Health.value);
}
```

EntityRef 只保存 `WorldView + Entity`，不缓存 Archetype、Chunk、row 或组件列，也不会
钉住实体。实体销毁后既有引用的 `valid` 变为 `false`，`has()` 返回 `false`，`get()`
返回 `null`。`equals()` 同时比较 World 身份与带版本 Entity 句柄。

EntityRef 是明确允许分配的低频 API，不应在 Query 的逐实体循环中创建；它不提供
`set/add/remove/despawn`。结构修改继续使用 EntityCommand 或 StructureWriter。

### EntityCommand

```ts
const entity = world.reserveEntity();
const command = world.createEntityCommand(entity);
command
    .add(PositionType)
    .set(PositionType, Position.x, 10);
world.applyEntityCommand(command);
```

命令应用后不可修改或重复应用。它没有 `.submit()`；延迟提交属于 Game Commands。

## @zero-ecs/scheduler

```ts
const stage = new Stage("simulation", 0);
const set = new SystemSet(stage, "physics");
const builder = new ScheduleBuilder<string>();
builder.addSystem(stage, update, ["time"], { inSet: set });
const scheduler = new Scheduler(builder.build());
scheduler.init();
scheduler.prepare({ resolve: param => values[param] });
scheduler.run(stage);
scheduler.dispose();
```

依赖目标支持 SystemHandle、唯一函数和 SystemSet。before/after 只能连接同一 Stage；
`beforeIfPresent/afterIfPresent` 允许可选系统函数。参数在 prepare 解析一次。

## @zero-ecs/game

### 可选 Hierarchy

Hierarchy 不属于默认基础设施，使用时显式安装，并同时安装 Commands：

```ts
const game = new GameBuilder()
    .addModule(new CommandModule())
    .addModule(new HierarchyModule())
    .build();

const hierarchy = game.service(HierarchyService);
hierarchy.setParent(child, parent); // 在 Commands 提交边界生效
```

`ChildOf` 和 `ParentOf` 是只读 QueryProjection：

```ts
const children = QueryType.from(With(ChildOf));
const parents = QueryType.from(With(ParentOf));
```

它们只表示“有父节点”和“有至少一个子节点”。具体边由
`parentOf/firstChildOf/lastChildOf/previousSiblingOf/nextSiblingOf` 读取；没有关系时返回
`INVALID_ENTITY`。内部 marker 类型不导出，因此外部不能通过 `command.add/remove` 绕过
HierarchyService。

父节点通过 Game Commands despawn 时，Hierarchy 默认递归 despawn 全部后代。如果希望
某个子树保留，必须先调用 `removeParent(root)` 或 `setParent(root, anotherParent)`；同一
Commands flush 中关系变更先于递归展开。直接使用低层 World/StructureWriter 属于显式
逃生口，不承诺触发 Game 层级语义。

### Resource、State、Service

- Resource：构建期提供、运行期间不替换的只读依赖或能力，可持有 DOM/Canvas/句柄；
- State：Game 持有的可变业务状态，未来只序列化显式标注字段；
- Service：方法、缓存、池、句柄和运行时协作对象，允许按实际需要持有字段。

Service 的 `ServiceToken<T>` 可以是抽象父类，供 System 参数、注入和查询使用；
`ServiceType<T>` 表示 Builder 能直接实例化的具体实现。注册子类会自动建立父类 token
别名。

```ts
const builder = new GameBuilder()
    .addResource(Config, new Config())
    .addState(SessionState)
    .addService(SimpleService)
    .setService(ServiceToken, existing)
    .setServiceFactory(AllocatorAdapter, build =>
        new AllocatorAdapter(build.worldAllocator),
    );
```

### System

```ts
function update(
    fixed: Readonly<FixedTimeResource>,
    time: Mut<TimeState>,
): void {
    time.tick++;
}

export const updateSystem = defSystem(
    Update.fixed,
    update,
    [FixedTimeResource, Write(TimeState)],
);
```

`defSystem` 把 stage/params 元数据写在函数自身，Module 只注册该定义。标准阶段是
Startup、Update.first/fixed/last/post、Shutdown。

### Game 生命周期

```ts
const game = builder.build();
game.init();
game.start();
game.update();
game.stop();
game.dispose();
```

`game.world` 是 `WorldView`；`game.structureWriter()` 返回同一 World 的结构能力。完整
World 不进入普通 SystemParam。

### Commands

```ts
const commands = game.service(Commands);
const command = commands.spawn().set(PositionType, Position.x, 1);
command.submit();
```

普通自定义 Command 和 Game EntityCommand 都调用自身 `.submit()`。Game EntityCommand
继承 Command，内部组合 `@zero-ecs/world` 的原始 EntityCommand；Commands/Structure 两个
Post System 按 Entity 合并后统一应用。`CommandService` 仅保留为 `Commands` 的 deprecated
类型别名。根入口只导出 Game EntityCommand 的类型，不导出其构造器；实例必须由
`Commands.spawn()/entity()` 创建。

### DefaultCoreModule

```ts
const game = new GameBuilder()
    .addModule(new DefaultCoreModule(new FixedTimeResource(1 / 60)))
    .build();
```

该组合模块安装 Commands、Time、Timer、Event 与 Random 默认基础设施。需要裁剪功能或替换
其中某个模块时，应继续按需注册独立 Module。

### Timer 延迟命令

`TimerService.once()` 只依赖带 `submit()` 的 `ITimerTask`。普通 Game Command 与 Game
EntityCommand 都实现这个协议，Timer 不依赖任何 ECS 命令类型：

```ts
const commands = game.service(Commands);
const timer = game.service(TimerService);
const command = commands.spawn().set(PositionType, Position.x, 10);
timer.once(0.5, command);
```

到期时直接调用继承自 Command 的 `.submit()`，并利用
`TimerCallbacks -> Commands -> Structure` 依赖在同一 Tick 应用。传入 Timer 后，命令的
使用权按协议移交给 Timer，调用方不得继续修改、提交或重复安排。

### ObjectPoolService

```ts
const BulletPool = definePool<Bullet>({
    name: "Bullet",
    maxRetained: 2048,
    reset: bullet => bullet.reset(),
    clear: bullet => bullet.clear(),
});

const pools = game.service(ObjectPoolService);
pools.bind(BulletPool, () => new Bullet());
const bullet = pools.acquire(BulletPool);
pools.release(BulletPool, bullet);
```

也可用 `pools.create(factory, options)` 取得独立 `ObjectPool<T>`。池属于 Service，不参与
State 序列化。

### 标准功能入口

| 子路径 | 主要 API |
| --- | --- |
| `@zero-ecs/game/event` | EventModule、EventService、EventArgs、Listener |
| `@zero-ecs/game/time` | TimeModule、FixedTimeResource、TimeState |
| `@zero-ecs/game/timer` | TimerModule、TimerService、TimerConfigResource |
| `@zero-ecs/game/random` | RandomModule、RandomService |
| `@zero-ecs/game/pool` | ObjectPoolService、ObjectPool、definePool |
| `@zero-ecs/game/hierarchy` | HierarchyModule、HierarchyService、ChildOf、ParentOf |

Module 可以只导出面向上层的 Service 与 Module 类，把具体 State、System 和池实现留在
包内部，以保持开放封闭边界。
