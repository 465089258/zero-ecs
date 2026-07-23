# Zero ECS

Zero ECS 是一个面向游戏数据层的 TypeScript ECS workspace，由三个可独立安装的库组成：

- `@zero-ecs/world`：实体、组件、Archetype、Table、Query 与即时底层数据操作；
- `@zero-ecs/scheduler`：不知道 ECS 的通用静态调度器；
- `@zero-ecs/game`：组合 World、Scheduler、依赖注入、延迟结构变更、生命周期与标准功能模块。

依赖方向固定为 `game -> world + scheduler`，World 与 Scheduler 之间互不依赖。

## 快速开始

```ts
import {
    Commands,
    DefaultCoreModule,
    GameBuilder,
    INVALID_ENTITY,
    QueryType,
    Resource,
    Service,
    Startup,
    State,
    Types,
    Update,
    With,
    Write,
    defSystem,
    type Component,
    type Entity,
    type Mut,
    type QueryOf,
} from "@zero-ecs/game";

// enum 成员值同时是组件字段编号和 Query 返回列的下标。
const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Velocity { x, y }
class VelocityType implements Component<Velocity> {
    readonly [Velocity.x] = Types.F32;
    readonly [Velocity.y] = Types.F32;
}

const MovingQuery = QueryType.from(With(PositionType, VelocityType));

// Resource 是构建期传入、运行期间不替换的只读依赖。
class SimulationConfig extends Resource {
    constructor(readonly deltaSeconds: number) { super(); }
}

// State 是由 Game 创建和持有的可变状态；系统默认只能只读访问。
class MovementState extends State {
    readonly movedEntities = 0;
    readonly entity: Entity = INVALID_ENTITY;
}

// Service 提供可注入的方法与能力，不承担逐帧调度。
class MovementService extends Service {
    distance(velocity: number, deltaSeconds: number): number {
        return velocity * deltaSeconds;
    }
}

// System 只是普通函数；实际参数由 defSystem() 的参数声明按位置注入。
function moveEntities(
    query: QueryOf<typeof MovingQuery>,
    config: Readonly<SimulationConfig>,
    state: Mut<MovementState>,
    movement: MovementService,
): void {
    const iter = query.iter();
    const deltaSeconds = config.deltaSeconds;
    while (iter.next()) {
        const [count, , positions, velocities] = iter.current;
        const xs = positions[Position.x];
        const ys = positions[Position.y];
        const vxs = velocities[Velocity.x];
        const vys = velocities[Velocity.y];
        for (let row = 0; row < count; row++) {
            xs[row] += movement.distance(vxs[row], deltaSeconds);
            ys[row] += movement.distance(vys[row], deltaSeconds);
        }
        state.movedEntities += count;
    }
}

function spawnEntity(commands: Commands, state: Mut<MovementState>): void {
    const command = commands.spawn()
        .set(PositionType, Position.x, 10)
        .set(PositionType, Position.y, 20)
        .set(VelocityType, Velocity.x, 1)
        .set(VelocityType, Velocity.y, 2);
    state.entity = command.entity;
    command.submit();
}

const SpawnEntitySystem = defSystem(Startup, spawnEntity, [
    Commands,
    Write(MovementState),
]);

const MoveEntitiesSystem = defSystem(Update.fixed, moveEntities, [
    MovingQuery,          // QueryType -> 当前参数位置独享的 Query
    SimulationConfig,     // ResourceType -> Readonly<SimulationConfig>
    Write(MovementState), // 显式声明 State 写访问 -> Mut<MovementState>
    MovementService,      // ServiceType -> MovementService 实例
]);

const builder = new GameBuilder()
    .addModule(new DefaultCoreModule())
    .addResource(SimulationConfig, new SimulationConfig(0.5))
    .addState(MovementState)
    .addService(MovementService);
builder.addSystem(SpawnEntitySystem);
builder.addSystem(MoveEntitiesSystem);

const game = builder.build();
game.init();
game.start();

const entity = game.state(MovementState).entity;

// Startup 提交的结构变更在第一个 Update.post 应用，当前 Tick 的查询不会看到新实体。
game.update();
// 第二个 Tick 中 MovingQuery 已经能够遍历并更新它。
game.update();

console.log(game.world.get(entity, PositionType, Position.x)); // 10.5
console.log(game.world.get(entity, PositionType, Position.y)); // 21
console.log(game.state(MovementState).movedEntities);           // 1
game.dispose();
```

`defSystem(stage, method, params)` 将普通函数绑定到阶段和参数声明。`params` 与函数参数严格
按位置对应，Game 在启动时解析一次依赖，逐 Tick 直接调用已经准备好的参数：

| 参数声明 | 系统收到的值 | 访问语义 |
| --- | --- | --- |
| `QueryType` | 独立 `Query` 实例 | 可直接修改匹配实体的组件列 |
| `ResourceType` | `Readonly<Resource>` | 只读 |
| `StateType` | `Readonly<State>` | 默认只读 |
| `Write(StateType)` | `Mut<State>` | 显式可写 |
| `ServiceType` | 对应 `Service` 实例 | 调用服务能力 |
| `World` | 底层 `World` 内核 | 不安全扩展入口，调用方负责结构修改时序 |

除 System 参数注入外，State、Service 和 Command 等受 Game 管理的对象也可以声明属性依赖。
例如 Service 可以组合 Resource、State 和其他 Service：

```ts
class GameplayService extends Service {
    @Resource.inject(SimulationConfig)
    private readonly config!: SimulationConfig;

    @State.inject(MovementState)
    private readonly movementState!: MovementState;

    @Service.inject(MovementService)
    private readonly movement!: MovementService;
}
```

属性注入用于对象之间相对稳定的生命周期依赖；逐帧 System 更推荐使用显式参数列表，让所需
依赖和 State 读写权限直接体现在系统定义中。

### 为什么使用 const enum 定义组件字段

World 将一个组件的每个字段保存为独立 TypedArray 列，因此字段在运行时必须是从 `0` 开始
连续递增的数字下标：

```ts
const enum Position { x, y }

class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}
```

同一组成员可以同时用于 Schema、Query 列访问以及 `World.get/set`：

```ts
const xs = positions[Position.x];
xs[row] += 1;
game.world.get(entity, PositionType, Position.x);
```

使用 `const enum` 有三个目的：

- 用 `Position.x` 代替容易写错的裸数字，同时由 `Component<Position>` 检查字段是否完整；
- 在当前 Rslib/Rsbuild 构建配置下，成员会直接内联为 `0`、`1` 等数字，不保留普通
  enum 的运行时对象和反向映射；
- Schema 字段编号与热路径列下标天然一致，不需要字符串查找或额外字段映射。

`const enum` 决定的是字段编号；字段真正使用 `Float32Array`、`Uint32Array` 还是其他物理
存储，仍由对应的 `Types.*` 声明决定。

`DefaultCoreModule` 一次安装 Commands、Time、Timer、Event 与 Random。需要减小运行时组成时，
仍可只注册 `CommandModule`、`TimeModule` 等独立模块；Event、Time、Timer、Random、
Hierarchy 和 Pool 从各自 `@zero-ecs/game/*` 子路径导入。

Module 只负责构建期安装；运行时初始化、启停与释放由 Service 和
Startup/Shutdown System 管理。

World 也可以完全脱离 Game 使用：

```ts
import { Allocator, World } from "@zero-ecs/world";

const allocator = new Allocator();
const world = new World(allocator);
const entity = world.spawn();
world.valid(entity);
world.despawn(entity);
world.dispose();
allocator.clear();
```

## 开发命令

- `npm run typecheck`：分别检查三个包；
- `npm test`：运行源码行为测试；
- `npm run build`：按 world → scheduler → game 生成三个包；
- `npm run verify:release`：运行类型、行为、声明、包边界、no-JIT 与示例验证。

完整阅读入口见 [文档索引](./docs/000-导航-文档索引.md)。长期职责与评审准则见
[架构宪法](./docs/100-架构-架构宪法.md)，当前实现见
[三库架构](./docs/120-架构-三库架构.md)，公共 API 见
[API 参考](./docs/500-参考-API.md)。
