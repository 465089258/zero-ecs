# API 参考

## 包入口

```ts
import { World, Allocator } from "@zero-ecs/world";
import { Scheduler, ScheduleBuilder, Stage } from "@zero-ecs/scheduler";
import { GameBuilder, defSystem, Update } from "@zero-ecs/game";
```

底层诊断能力位于 `@zero-ecs/world/advanced` 和 `@zero-ecs/game/advanced`。Event、Time、
Timer、Random、Pool 也分别具有 Game 子路径入口。

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

### Component 与 Query

```ts
const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const queryType = QueryType.from(With(PositionType));
const query = world.query(queryType);
const iter = query.iter();
while (iter.next()) {
    const [count, entities, positions] = iter.current;
}
```

Query 按 Table 返回列视图并复用 `QueryIter/current`。不要跨结构变化保存迭代器结果或在
同一 Query 上嵌套迭代。

### WorldView 与 StructureWriter

```ts
interface WorldView {
    valid(entity: Entity): boolean;
    get(entity, component, field): number | null;
    has(entity, component): boolean;
}

interface StructureWriter {
    reserveEntity(): Entity;
    despawn(entity: Entity): boolean;
    createEntityCommand(entity: Entity): EntityCommand;
    applyEntityCommand(command: EntityCommand): boolean;
}
```

`getTypes()` 和 `getCompLocation()` 是会分配的诊断 API，不属于 `WorldView`。

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

### Resource、State、Service

- Resource：构建期提供、运行期间不替换的只读依赖或能力，可持有 DOM/Canvas/句柄；
- State：Game 持有的可变业务状态，未来只序列化显式标注字段；
- Service：方法、缓存、池、句柄和运行时协作对象，允许按实际需要持有字段。

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
| `@zero-ecs/game/timer` | TimerModule、TimerService、TimerConfig |
| `@zero-ecs/game/random` | RandomModule、RandomService |
| `@zero-ecs/game/pool` | ObjectPoolService、ObjectPool、definePool |

Module 可以只导出面向上层的 Service 与 Module 类，把具体 State、System 和池实现留在
包内部，以保持开放封闭边界。
