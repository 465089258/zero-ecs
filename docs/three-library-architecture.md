# World / Scheduler / Game 三库架构设计

> 状态：已实施。仓库已迁移为 `world`、`scheduler`、`game` 三个 workspace 包，旧单包
> `src/` 已删除。后续存储收敛已把行所有权从 DataSet 移到 Archetype/EntitySlots；
> Query 直接遍历 Archetype Chunk。

## 1. 最终结论

框架最终拆成三个独立库：

```text
@zero-ecs/world               @zero-ecs/scheduler
纯 ECS 数据内核               通用静态调度器
        \                       /
         \                     /
              @zero-ecs/game
       DI、生命周期与游戏逻辑组合层
```

依赖方向固定为：

```text
world      -> 无框架内部依赖
scheduler  -> 无框架内部依赖
game       -> world + scheduler
```

禁止 World 导入 Scheduler、Game、Service、State、Resource 或 Injection；禁止
Scheduler 导入 World、Query、Service、State、Resource 或 Game Stage；禁止 World
为 Game 的队列、对象池或生命周期提供特例。

三个包先采用锁步版本。`game` 将 `world` 和 `scheduler` 声明为匹配主版本的 peer
dependency，仓库内使用 workspace dependency，避免一个进程出现两份 `World`、
`Stage` 或参数 token，破坏类和对象身份。包名是当前建议；发布前可以整体替换 npm
scope，但不能改变依赖方向。

## 2. 共同原则

约束层级固定为：

```text
1. TypeScript 类型、readonly 视图、非导出实现和包导出边界
2. Builder/build/init/start 冷路径校验
3. 生命周期、实例归属和动态数据状态的必要运行时校验
4. 热路径运行时检查，仅在类型无法表达且基准证明成本可接受时使用
```

TypeScript 约束只阻止普通误用，不抵抗类型断言、反射或主动深路径绕过。
World 是显式底层入口；`Read/Write` 是类型能力，不创建运行时 wrapper。

性能规则：

- Scheduler 参数只在 `prepare()` 解析一次，Tick 中复用固定数组；
- 系统函数保留 0 到 8 参数固定调用分支，不引入每帧 DI；
- Query 缓存、迭代器和列访问算法不因拆包改变；
- World 字段读写、结构提交和批量迁移不增加权限 wrapper；
- Game 可以池化命令和内部索引，World 不持有命令池；
- 冷路径不为 Builder、prepare 临时数组或错误对象建池。

开放封闭规则：包根只导出稳定能力；存储内核、内部系统和合并协议通过未导出实现或
明确的 `advanced`/`game-bridge` 子路径隔离。Game Module 可以注册私有 State、
Service 和 System，只导出 Module 与面向上层的 Service。

## 3. `@zero-ecs/world`

### 3.1 定位与目录

World 是实体、组件、Archetype Chunk、Table、Query 和结构事务的物理所有者，可以脱离
Game 和 Scheduler 单独使用：

```ts
const allocator = new Allocator();
const world = new World(allocator);
const entity = world.spawn();
const command = world.createEntityCommand(entity);
command.add(Position).set(Position, Position.x, 10);
world.applyEntityCommand(command);
```

目标目录：

```text
packages/world/src/
├─ storage/{memory,data-set}/
├─ component/
├─ archetype/
├─ entity/
├─ query/
├─ command/{entity-command,entity-instruction}.ts
├─ world.ts
├─ index.ts
├─ advanced.ts
└─ game-bridge.ts
```

World 不提供 Resource、State、Service、Injection、Stage、System、Scheduler、update
循环、`Commands` 队列、提交回调、Game 提交阶段、错误处理策略或命令对象池。

稳定入口导出 World、Entity、组件、Query、EntityCommand 公共接口、Allocator、Buffer
和 Types。`advanced` 导出诊断与显式底层能力；`game-bridge` 是只供锁步版本 Game
使用的不稳定包间 SPI，不进入普通用户文档。

### 3.2 World API

```ts
export class World {
    component<T>(type: ComponentType<T>): ComponentDefinition<T>;
    query<T>(type: QueryType<T>): Query<T>;
    spawn(): Entity;
    ref(entity: Entity): EntityRef;
    valid(entity: Entity): boolean;
    get<T extends object, F extends ComponentFields<T>>(
        entity: Entity,
        type: ComponentType<T>,
        field: F,
    ): number | null;
    has<T extends object>(entity: Entity, type: ComponentType<T>): boolean;
    set(entity: Entity, type: ComponentType, field: number, value: number): boolean;
    despawn(entity: Entity): boolean;
    createEntityCommand(entity: Entity): EntityCommand;
    applyEntityCommand(command: EntityCommand): boolean;
}
```

Game 与系统参数直接交付同一个 World：

```text
System [World] 参数 -> World
game.world          -> World
advanced            -> 存储和诊断能力
```

World 独立使用时没有调度阶段，因此结构方法是直接能力，不检查“是否正在 update”。
Game 同样不包装或封闭 World；调用方必须自行保证结构修改时序安全。

`getTypes()`、`getCompLocation()` 是会分配对象的诊断 API。
后者返回 `{ chunkIdx, row }`。Archetype 的 `views[chunkIdx][componentId][fieldId]`、
`entities[chunkIdx]` 和 raw location 只进入 advanced；批量组件访问继续使用 Query。

`World.ref(entity)` 是显式分配的低频只读入口。EntityRef 只绑定 World 与带版本
句柄，不缓存物理位置、不参与 Query，也不提供结构写能力。

### 3.3 Allocator 所有权

```ts
new World(allocator);           // 参数必填，World 只借用 IAllocator
```

- Allocator 始终由 World 的构造方拥有；
- World 只归还自身申请的 Buffer，不清空整个分配器；
- GameBuilder 自建的默认 Allocator 由 Game 在 World 释放后清理；
- `createTableLayout` 必须显式接收 buffer byte length；
- 默认配置只在 Allocator 构造边界应用；
- `Buffer.dispose()` 是释放引用还是归还池，由具体 Buffer 实现决定。

Game 默认创建 Allocator，再用同一个 `IAllocator` 构造 World 与
`AllocatorService`。AllocatorService 是 Game 给上层提供的内存能力，不属于 World。

### 3.4 EntityCommand

`EntityCommand` 是单实体局部事务，不是 Game Command，也不继承 Game 的 `Command`：

```ts
export interface EntityCommand extends EntityMutator {
    readonly entity: Entity;
    despawn(): this;
}
```

公共语义：

- `has/get` 支持 read-your-writes；
- `add/remove/set/despawn` 只修改本地事务描述；
- `remove -> add` 创建零初始化的新组件实例；
- `set` 目标组件不存在时隐式添加；
- World 创建时校验实体，应用时校验命令归属和动态状态；
- 应用成功或失败后命令都离开可修改状态，不能重复应用。

World 工厂始终直接创建新对象，不查池、不保存空闲数组、不接受 `maxRetained`：

```ts
createEntityCommand(entity: Entity): EntityCommand {
    return new EntityCommandImplementation(internalToken, this, entity);
}
```

实现类和构造 token 不从稳定入口导出，创建路径封装在 World 内。

### 3.5 Game bridge 与零 wrapper

Game 需要在池命中时重置命令，并在提交时封存、批量时合并。`game-bridge` 只导出
编译期内部类型：

```ts
/** 只供匹配版本的 @zero-ecs/game 使用。 */
export interface InternalEntityCommand extends EntityCommand {
    _reset(entity: Entity): void;
    _seal(): void;
    _merge(source: InternalEntityCommand): void;
    _release(): void;
}
```

实际对象仍是 World 创建的命令；Game 只在内部收窄类型，不创建代理。`_merge` 在
World 包实现，因为只有内核知道组件 ID、Mask、零初始化和字段覆盖规则。Game 决定
何时、把哪些命令合并，但不读取私有指令数组。

### 3.6 World 生命周期

World 构造完成后立即可用，状态只有 `Alive -> Disposed`。World 不保存 Game owner
WeakMap；Game 的唯一占用规则由 Game 包在构建冷路径维护。

`World.dispose()` 是内核终结操作，不是用户生命周期钩子，也不鼓励继承 World；扩展
使用组合。传给 `GameBuilder` 的 World 默认转移给 Game，并由 Game 最终释放。

EntityCommand 生命周期由内核状态固定为：

```text
Mutable --seal--> Sealed --World.apply--> Applied --Game.release--> Recycled
    |                              |
    +-------- standalone apply ----+
```

World 独立调用 `applyEntityCommand()` 时可以自动 seal。`Applied` 命令不能继续修改或
再次应用；Game 在 finally 中执行内部 release 后才允许 reset。合并后的 source 不
执行应用，直接进入 Recycled。生命周期状态属于事务正确性，不表示 World 建立对象池。

## 4. `@zero-ecs/scheduler`

### 4.1 定位与 API

Scheduler 只知道 Stage token、系统函数、不透明参数描述、before/after 边和参数提供者。
它不知道 World、ECS、DI、Query、Resource、State、Service、Startup 或 Update。

```ts
export class Stage {
    constructor(readonly name: string, readonly order: number) {}
}

export class SystemSet {
    constructor(
        readonly stage: Stage,
        readonly name: string,
    ) {}
}

export interface SystemParamProvider<Param = unknown> {
    resolve(param: Param): unknown;
}

export class ScheduleBuilder<Param = unknown> {
    addSystem(
        stage: Stage,
        fn: (...args: any[]) => void,
        params: readonly Param[],
        options?: SystemOptions,
    ): SystemHandle;
    before(system: SystemHandle, target: SystemDependencyTarget): this;
    after(system: SystemHandle, target: SystemDependencyTarget): this;
    chain(...systems: readonly SystemHandle[]): this;
    build(): Schedule<Param>;
}

export class Scheduler<Param = unknown> {
    constructor(schedule: Schedule<Param>);
    init(): void;
    prepare(provider: SystemParamProvider<Param>): void;
    run(stage: Stage): void;
    dispose(): void;
}
```

依赖目标支持系统定义、注册后句柄和纯构建期 `SystemSet`。SystemSet 只用于把跨 Module
的系统加入同一依赖图，不形成运行时阶段或额外循环：

```ts
export interface SystemOptions {
    readonly inSet?: SystemSet | readonly SystemSet[];
    readonly before?: SystemDependencyTarget | readonly SystemDependencyTarget[];
    readonly after?: SystemDependencyTarget | readonly SystemDependencyTarget[];
}
```

ScheduleBuilder 在 build/init 冷路径把 set 依赖展开为系统边，Scheduler 热路径仍只有
排好序的系统数组。Game 可以公开稳定 SystemSet 作为扩展锚点，而不导出内部系统类。

通用 Provider 返回 `unknown`；Game resolver 用更精确的泛型方法实现参数和值的关系：

```ts
resolve<P extends GameSystemParam>(param: P): GameSystemParamValue<P>;
```

RuntimeSystem 仍保存 `readonly unknown[]`，运行时布局不变。

### 4.2 调度职责

- `init()`：校验句柄、阶段和依赖，按阶段稳定拓扑排序；
- `prepare()`：局部解析全部固定参数，全部成功后原子发布；
- `run()`：按已排序数组直接调用系统；
- `dispose()`：释放参数数组和索引引用。

跨 Stage 的 before/after 在冷路径报错，不能像当前实现一样静默忽略。`prepare()` 只
接受 Provider，绝不接受 World、Game 或上下文；失败进入终止性 `PrepareFailed`，不
发布部分 RuntimeStage，只允许 dispose。

以下内容属于 Game，不属于 Scheduler：标准 stages、`defSystem()`、`Write/Mut`、
Resource/State/World 访问分析、Query/Service 参数解析和 Game 生命周期回滚。未来并行
调度若需要冲突分析，应接收通用策略接口，不能反向识别 Game 参数。

## 5. `@zero-ecs/game`

### 5.1 定位

Game 是 World 与 Scheduler 的组合根和运行时实例，不声称自身是纯数据对象。它可以
持有 DOM、Canvas、设备句柄、Worker、渲染与输入能力；纯实体边界只要求 World 保持。

```text
Game
├─ World
├─ Scheduler<GameSystemParam>
├─ ResourceContainer
├─ StateContainer
├─ ServiceContainer
├─ GameSystemParamResolver
├─ Module[]
└─ Commands / Event / Time / Timer / Random / Pool
```

### 5.2 Resource、State、Service

| 类型 | 定位 | 默认序列化 |
| --- | --- | --- |
| Resource | 构建期提供、运行期间不替换的只读依赖或能力，可包含宿主句柄 | 否 |
| State | Game 持有的可变业务状态，行为尽量移出 | 未来只序列化显式标注字段 |
| Service | 方法、能力、缓存、池、句柄和非持久运行时协作对象 | 否 |

规则不是机械限制：错误处理函数直接保存在 `ErrorHandlerService`，Allocator 和对象池
保存在 Service；不为它们生造 State。需要逐 Tick 推进的逻辑注册为 System，不在
Service 上保留只做转发的 `update()`。

State 的 `Write()` 只是调度访问元数据和 TypeScript 可写映射，不是运行时隔离。未来
序列化装饰器选择 State 字段，而不是把所有 State 全部序列化。

### 5.3 系统定义与参数

Game 保留当前无 wrapper 的定义方式：

```ts
function update(
    fixed: Readonly<FixedTimeResource>,
    time: Mut<TimeState>,
): void {
    time.delta = fixed.deltaSeconds;
    time.elapsed += fixed.deltaSeconds;
    time.tick++;
}

export const advanceFixedTimeSystem = defSystem(
    Update.first,
    update,
    [FixedTimeResource, Write(TimeState)],
);
```

`defSystem()` 属于 Game，因为只有 Game 知道参数映射。元数据写到原函数自身，返回值
仍是原函数。Module 只注册系统定义；修改参数不需要跨文件改 Module。

```text
World                    -> World
QueryType                -> Query
ResourceType             -> Readonly<Resource>
StateType                -> Readonly<State>
Write(StateType)         -> Mut<State>
ServiceToken             -> Service
```

`Game` 不进入普通 SystemParam。完整 World 可以作为 `[World]` 参数；系统参数不自动注册
Resource、State 或 Service；Module/Builder 必须显式注册，缺失项在 start 的事务式
prepare 中失败。

### 5.4 标准阶段

Stage 类型来自 Scheduler，具体实例属于 Game：

```text
Startup
Update.first
Update.fixed
Update.last
Update.post
Shutdown
```

生命周期顺序固定为：启动时运行 Startup；每个 Tick 依次运行 `Update.first`、
`Update.fixed`、`Update.last`、`Update.post`；停止时运行 Shutdown。Game 明确调用这些
阶段，Scheduler 不拥有完整 Tick。

渲染、编辑器面板等与固定 Tick 不同频的上层能力可声明 `ManualStage`，由宿主在 Running
阶段调用 `game.runStage(stage)`。`ManualStage` 具有类型品牌，标准 Update、Startup 和
Shutdown 不能传入该入口；手动阶段也不会被 `Game.update()` 隐式执行。

`Update.post` 只是普通的 Tick 收尾阶段，不内建 Command、Migration、Event 或 Timer
顺序。命令提交、实体事务应用、事件分发、计时器触发等都注册为普通 System；同阶段
顺序完全由 `before/after/chain/SystemSet` 依赖图决定。Game.update 不直接调用任何
具体功能 Service，也不硬编码功能系统顺序。

Game 功能只公开稳定的排序锚点，不必公开具体实现系统：

```ts
export const GameSystemSet = Object.freeze({
    Commands: new SystemSet(Update.post, "commands"),
    Structure: new SystemSet(Update.post, "structure"),
    Events: new SystemSet(Update.post, "events"),
    TimerAdvance: new SystemSet(Update.fixed, "timer:advance"),
    TimerCallbacks: new SystemSet(Update.post, "timer:callbacks"),
});
```

SystemSet 自身没有隐含顺序，只是依赖图节点。每个 set 绑定一个 Stage；系统加入 set、
或依赖另一个 set 时，Stage 必须相同，否则 build 失败。默认功能顺序来自 Module 注册
的边，上层可以在这些锚点前后插入系统。

依赖图只允许约束同一 Stage。不同 Stage 已由生命周期顺序确定，跨 Stage 依赖在构建
冷路径报错。一个 Stage 运行期间新产生的工作不会使已经执行过的系统回跳；如确实
需要同 Tick 二次处理，应显式注册第二个 System，并在图中放到生产者之后。

### 5.5 Builder、容器与覆盖

构建顺序固定为：

1. 使用外部 World，或使用配置的 `IAllocator` 创建默认 World；
2. 在 Game 包 WeakMap 中 claim World，防止同时交给两个 Game；
3. 创建三个容器和 InjectionContext；
4. 直接 `set` 默认 InjectionService、ErrorHandlerService、AllocatorService、ObjectPoolService；
5. 按用户注册顺序写入 Resource、State、Service，后写入的子类别名可覆盖默认实现；
6. 锁定容器并执行属性注入；
7. 构造 Schedule、Scheduler 和 GameSystemParamResolver；
8. 创建 Game；失败时释放已创建对象并解除 claim。

容器沿实现类原型链注册 token，但在领域根类之前按结构停止，不硬编码
`Resource/State/Service/Object` 排除表。生命周期数组只保存唯一实例，别名不重复
init/dispose。

Service 类型区分查找 token 与具体实现：`ServiceToken<T>` 接受抽象父类，用于 System
参数、属性注入、`Game.service()` 和临时生命周期上下文；`ServiceType<T>` 只接受可
实例化类型，用于 `GameBuilder.addService()`。因此注册 `CanvasRenderService extends
RenderService` 后，通过两个类型取得的是同一个实例，不创建 wrapper 或转发层。

普通 Service 支持无参类型注册。需要构造参数或替换内建 Service 时提供冷路径工厂：

```ts
builder.addService(CustomService);
builder.setService(ServiceToken, existingInstance);
builder.setServiceFactory(ServiceToken, build =>
    new CustomAllocatorService(build.worldAllocator),
);
```

默认内建实例允许先创建后被覆盖；未分配实际内存的短命默认对象直接丢弃。工厂只是
Builder 能力，不进入 Service 或 System 热路径。

### 5.6 生命周期与临时依赖

```text
build
  -> State.init
  -> Service.init(resource/state)
  -> Service.activate(resource/state/service)
  -> Scheduler.init
  -> Module.init
start
  -> Scheduler.prepare
  -> Startup systems
  -> Service.start
  -> Module.start
update
  -> Update.first
  -> Update.fixed
  -> Update.last
  -> Update.post
stop
  -> Module.stop (reverse)
  -> Service.stop (reverse)
  -> Shutdown systems
dispose
  -> Module.dispose (reverse)
  -> Scheduler.dispose
  -> Service.dispose (dependency reverse)
  -> State.dispose (dependency reverse)
  -> World.dispose
  -> clear Resources / release claim
```

`init` 上下文只读 Resource/State；所有 Service 完成 init 后，`activate` 才允许临时
取得其他 Service，并记录生命周期依赖。上下文在钩子返回后失效，不把完整
InjectionContext 长期放进 Service 基类，也不增加任意时刻的 Service Locator。

### 5.7 World 注入和能力

`@Inject.world()` 属于 Game，运行时注入同一个 World，不创建视图对象。字段声明
为 `World`：

```ts
class Helper {
    @Inject.world()
    readonly world!: World;
}
```

World 是主动选择的底层能力，不增加运行时检查。State 禁止注入 World 或 Service。

Game 公开完整 World：

```ts
game.world; // World
```

宿主只在安全点使用即时结构方法；在活跃 Query 迭代期间修改相关结构属于协议违反。
Framework v1 不增加 executing 状态和逐结构操作检查。

Game 包维护 World claim，只防止同一个 World 同时属于多个 Game。World 自身不知道
Game。`setWorld(world)` 表示把释放责任转移给 Game；若未来需要借用，再新增名称明确
的 `borrowWorld`，不让一个 API 同时具有两种所有权语义。

## 6. Commands 与 EntityCommand

### 6.1 职责边界

```text
World.EntityCommand
  单实体事务、组件语义、合并算法、最终应用
  不含 submit、队列、池、DI、Stage、ErrorHandler

Game.Commands
  创建 Game.EntityCommand、延迟队列、对象池、批次分组、错误报告、System 注册

Game.EntityCommand extends Command
  组合 World.EntityCommand，并提供统一 submit 生命周期
```

Game 公开 `Commands extends Service`。普通自定义
`Command` 仍属于 Game，因为它依赖提交回调、DI 和延迟执行生命周期。

### 6.2 使用方式

World 独立使用：

```ts
const entity = world.spawn();
const command = world.createEntityCommand(entity);
command.add(Position).set(Position, Position.x, 1);
world.applyEntityCommand(command);
```

Game 延迟使用：

```ts
const command = commands.entity(entity);
command.add(Position).set(Position, Position.x, 1);
command.submit();
```

Game EntityCommand 继承 Command，因此与普通命令一样直接 `.submit()`；它在 execute 时
把内部 RawEntityCommand 交给 Commands。World EntityCommand 本身仍不包含提交回调，
独立 World 继续通过 `applyEntityCommand()` 应用。

### 6.3 Game 侧池化

```ts
entity(entity: Entity): EntityCommand {
    const raw = acquireRawEntityCommand(entity);
    const command = this.cmd(EntityCommand);
    command.bind(raw);
    return command;
}
```

- Game EntityCommand 包装对象进入普通 Command 构造类型池；
- RawEntityCommand 使用 Commands 的内核事务池，pool miss 必须走 World 工厂；
- recycle 清除实体引用、有效指令计数和 Mask，数组保留高水位；
- `trimPools()` 只在无待提交命令的空闲边界执行；
- World.dispose 不知道 Game 池，Game 必须先释放 Commands/Service。

通用 `ObjectPoolService` 可以作为 Game 上层能力，但 World 不依赖它。Game
EntityCommand 与普通 Command 统一按构造类型池化；RawEntityCommand 因为由 World 工厂
创建和回收，保留 Commands 内部专用池。池属于 Service，不属于 State。

### 6.4 延迟提交与合并

保留“同一 `Update.post` 提交周期、同一实体最多一次实际 Archetype 迁移”。这不是
Game 生命周期中的硬编码流程，而是 CommandModule 注册的默认系统依赖图：

```text
flushCommandsSystem [Update.post, GameSystemSet.Commands]
  1. 按提交顺序执行普通 Command
  2. 收集 EntityCommand
  3. 同一实体后续命令合并到首个 accumulator
  4. 被合并的 source 释放并回池

applyEntityCommandsSystem [Update.post, GameSystemSet.Structure]
  after GameSystemSet.Commands
  1. 按首次出现顺序应用 accumulator
  2. 每实体至多一次 migrate/despawn
  3. 无结构变化时走字段直写
  4. 最终命令释放并回池

dispatchEventsSystem [Update.post, GameSystemSet.Events]
  after GameSystemSet.Structure
  分发事件
```

上述边只由对应 Module 注册，不由 `Game.update()` 特判。TimerModule 可以把时间推进
系统放在 `Update.fixed`，把延迟回调系统放在 `Update.post`，并用依赖声明决定它位于
Commands 或 Events 的前后。上层模块也可以借助公开 SystemSet 插入自己的系统。

TimerService 只接受 ITimerTask，不依赖 EntityCommand 或 Commands。Game EntityCommand
继承 Command 后天然满足最小 `submit()` 协议；TimerCallbacks 到期后直接提交它，再进入
Commands 与 Structure。World 的 RawEntityCommand 仍不包含 Game 回调。

Game 根入口提供 `DefaultCoreModule`，一次组合 CommandModule、TimeModule、TimerModule、
EventModule 与 RandomModule，并允许传入 FixedTimeResource。它只是便捷组合，不改变这些
模块的独立性；需要裁剪或替换功能时继续按需注册独立 Module。Injection、错误处理、
Allocator 门面和对象池属于 GameBuilder 必需运行时能力，仍由 Builder 自动提供。

Game 维护 `Entity -> accumulator index` 的稀疏分页索引和 accumulator 数组；它们是
Commands 私有缓存，不是 State。World 的 `_merge` 按源命令顺序重放语义，Game 不
读取指令数组。

可见性规则明确为：

- 所有 EntityCommand 修改，包括纯字段写和 despawn，都在默认的
  `applyEntityCommandsSystem` 执行时统一可见；
- 同一实体多个命令按提交顺序合并；
- despawn 是终止操作，之前组件修改被丢弃，其后同实体命令报告无效事务；
- 一个 flush 内普通 Command 可继续提交新 Command，受固定批次安全上限约束；
- 如果 Event System 位于 Command System 之后，它产生的命令不会回跳已经执行的
  Command System，默认留到下一 Tick；若需要同 Tick 处理，Module 必须显式注册后置
  的第二个提交 System。

统一可见性会替代当前“纯字段可能在命令收集 System 中提前直写”的隐式差异，属于
需要迁移说明和测试固定的有意语义收口。

### 6.5 错误和回收

- 单个 Command/EntityCommand 失败通过 ErrorHandlerService 报告，来源为开放字符串；
- 回收放在 `finally`，错误处理器再次抛错时保留第一错误并继续释放其余对象；
- World 应用前完成可预检校验，避免可恢复错误留下半应用事务；
- 错误处理函数直接保存在 ErrorHandlerService，不建立 ErrorHandlerState。

## 7. 序列化边界

序列化格式本轮不设计，但所有权边界固定：

```text
WorldSnapshot
  Entity / Component / Archetype 数据及必要注册映射

GameSnapshot
  WorldSnapshot
  + 显式声明可序列化的 State 字段
  + 模块自定义扩展段
```

Resource 不序列化；Service、池、Query 缓存、Scheduler runtime args、Command/Event
队列默认不序列化；State 身份不表示全部字段可序列化；DOM、函数、Allocator 和设备
句柄保持运行时能力。

## 8. 包导出与兼容

建议出口：

```text
@zero-ecs/world
@zero-ecs/world/advanced
@zero-ecs/world/game-bridge     只供同版本 Game

@zero-ecs/scheduler

@zero-ecs/game
@zero-ecs/game/advanced
@zero-ecs/game/event
@zero-ecs/game/time
@zero-ecs/game/timer
@zero-ecs/game/random
```

Game 根可以重导出常用 World/Scheduler 类型，方便只安装 Game 的用户，但必须来自
peer dependency 的同一运行时模块，不能复制或 bundle 一份实现。

三包拆分与以下变化属于 major：

- 包名和导入路径变化；
- Scheduler 的 Stage/SystemParam 泛化；
- `defSystem/Write/Update` 从 Scheduler 概念移动到 Game；
- World EntityCommand 不再继承 Game Command，也不具有 `.submit()`；Game 提供继承
  Command 的同名组合包装；
- 命令服务唯一名称为 `Commands`；
- EntityCommand 的修改统一在实体事务应用 System 执行时可见；
- Game 直接暴露完整 World。

项目尚未正式发布，不提供旧名称或旧能力接口的兼容层。

## 9. 已完成的源码迁移映射

| 当前路径 | 目标包 | 处理 |
| --- | --- | --- |
| `src/storage/**` | world | 原样迁移，保持算法 |
| `src/ecs/component/**` | world | 原样迁移 |
| `src/ecs/archetype/**` | world | 原样迁移 |
| `src/ecs/entity/**` | world | 原样迁移 |
| `src/ecs/query/**` | world | 原样迁移 |
| `src/ecs/world.ts` | world | 删除 Game binding，保留物理所有权 |
| `src/ecs/command/entity-command.ts` | world | 去除 Command/DI/Service/Migration 依赖 |
| `src/ecs/command/command.ts` | game | 普通延迟命令基类 |
| `src/ecs/command/command-service.ts` | game | 重构为 Commands，队列与池进入私有字段 |
| `src/ecs/migration/**` | game + world | Game 留分组索引；合并/应用进入 EntityCommand |
| `src/schedule/scheduler.ts` | scheduler | 泛型 Param，保持热路径 |
| `src/schedule/schedule.ts` | scheduler | 移除 Game access 分析 |
| `src/schedule/stage.ts` | scheduler + game | Stage 留 scheduler，标准实例移 game |
| `src/schedule/internal-stage.ts` | game | 删除，以 `Update.post` 和依赖图替代 |
| `src/schedule/system.ts` | game | Game 参数类型、Write、defSystem |
| `src/context/**` | game | DI/Resource/State/Service |
| `src/runtime/**` | game | Game/GameBuilder/Module/lifecycle |
| `src/features/**` | game | 独立 feature 子路径 |
| `src/ecs/memory/allocator-service.ts` | game | Game 内存门面 |
| `src/dev/**` | game/advanced | 面向组合运行时的诊断能力 |

## 10. 已完成的实施顺序

### Phase 0：冻结基线（完成）

- 保留全量测试、no-JIT smoke 和 package-boundary 测试；
- 增加当前 Command 合并、可见时点和错误回收测试；
- 记录拆包前 bundle、启动、空 Tick、Query 和结构批次基准。

### Phase 1：Scheduler 依赖倒置（完成）

1. 把 `Stage` 与标准 Game stages 分开；
2. 把 Scheduler/Schedule 泛化为不透明 Param；
3. 将 SystemAccess 和 `defSystem/Write` 移到 Game 适配层；
4. 增加只用字符串参数和普通对象 Provider 的独立测试；
5. 确认 Scheduler 源码零 World/Context 导入。

### Phase 2：World 命令内核化（完成）

1. 从 World 删除 claim/finalize/structureWriterOf 的 Game 所有权逻辑；
2. World EntityCommand 去除 `extends Command`、装饰器和 MigrationService；
3. 增加 World 工厂、应用和内部 merge/reset/seal/release；
4. 用 World 单测覆盖事务语义和跨 World 拒绝；
5. 保持 Query/Archetype/DataSet 实现不变。

### Phase 3：Game Commands 重构（完成）

1. 新建 Commands，Game EntityCommand 包装进入普通 Command 池，RawEntityCommand 使用
   内核事务池；
2. EntityPlanIndex/accumulator 管理留在 Game；
3. 删除 CommandState、EntityMigrationState 和仅为池化存在的 Service；
4. 将提交、结构应用、Event、Timer 注册到标准 Stage，并声明 System 依赖图；
5. 删除 InternalPost，固定“不回跳已执行 System”的可见性语义。

### Phase 4：物理拆包（完成）

1. 建立 npm workspaces 和三个 package；
2. 先移动 world、scheduler，再移动 game；
3. 为每包建立独立 Rslib 入口、类型检查和包边界测试；
4. Game 使用 workspace peer 依赖并验证单份类身份；
5. 更新示例和导入路径；
6. 最后删除单包内部兼容路径。

### Phase 5：发布验证（代码与本地验证完成）

- World 文档只讲纯 ECS；
- Scheduler 文档使用非 ECS 示例；
- Game 文档讲 DI、Module、系统参数和标准功能；
- 发布前运行三包 build/test/type/package/no-JIT 和集成示例；
- Table 策略若改变，必须先独立落地并重建基线，不能和拆包 candidate 混测。

## 11. 验收标准

依赖边界：

- World 和 Scheduler 可各自在空项目独立安装、构建和运行；
- World/Scheduler 生产依赖图不存在 Game；
- Scheduler 源码不出现 World、Query、Resource、State、Service；
- World 源码不出现 Scheduler、Stage、System、DI 或 Game Command；
- Game 集成运行时只有一份 World 和 Stage 类身份。

行为：

- World 独立完成实体创建、组件事务、Query 和释放；
- Scheduler 用非 ECS Provider 完成 init/prepare/run；
- Game 生命周期只运行 Startup、四个 Update Stage 和 Shutdown；
- 改变 Command/Event/Timer 的依赖边即可改变同阶段顺序，`Game.update()` 无功能特判；
- SystemSet 的跨 Stage 使用和普通跨 Stage 依赖都会在 build 冷路径失败；
- `[World]` 系统参数在类型测试中是完整 World；
- 系统参数不自动注册容器对象；
- RawEntityCommand pool miss 走 World 工厂，World 不保留命令池；
- 同实体同批次只执行一次实际迁移；
- 命令提交、合并、失败和 dispose 后对象都能释放；
- Game 销毁时 Service Buffer 先归还，再销毁 World；仅清理 Builder 自建的默认 Allocator。

性能：

- Scheduler 空 Tick、1/4/8 参数系统不超过拆分前 A/A 噪声带；
- Query 和 World `valid/get/has` 不显著回退；
- EntityCommand 稳定高水位后 Game 池命中不分配新命令；
- 同实体多命令场景仍只迁移一次；
- Game EntityCommand 的一层组合转发必须通过 JIT/no-JIT 性能门槛，不再增加其他 wrapper；
- 包拆分基准与 Table 策略实验分开归因。

## 12. 本轮明确不做

- 并行 Scheduler；
- 新 Query 迭代模型；
- Component/State 序列化格式和装饰器；
- Table 回收策略切换；
- 运行时权限沙箱；
- World 继承扩展体系；
- 为所有 Service 强制无字段，或为所有字段强制创建 State。

完成拆分后，World 是可独立使用的 ECS 数据内核，Scheduler 是可独立使用的通用
调度器，Game 只负责把二者与 DI、生命周期和上层游戏能力组合起来。这一边界是后续
序列化、并行调度、宿主适配和功能模块扩展的稳定基础。
