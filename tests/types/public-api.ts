import {
    AllocatorService,
    Buffer,
    Commands,
    defaultAllocatorConfig,
    DefaultCoreModule,
    defSystem,
    ErrorHandlerService,
    Game,
    GameBuilder,
    Inject,
    ManualStage,
    Resource,
    Service,
    Startup,
    State,
    Types,
    INVALID_ENTITY,
    Update,
    Write,
    World,
    With,
    QueryType,
    type Component,
    type ComponentColumns,
    type ComponentDefinition,
    type Entity,
    type EntityCommand,
    type IAllocator,
    type AllocatorOptions,
    type Mut,
    type QueryProjection,
    type RuntimeErrorHandler,
    type RuntimeErrorSource,
    type SystemParamValue,
    type ServiceActivateContext,
    type ServiceInitContext,
    type ServiceToken,
    type ServiceType,
} from "@zero-ecs/game";
import {
    ChildOf,
    HierarchyModule,
    HierarchyService,
} from "@zero-ecs/game/hierarchy";
import { TimerConfigResource, TimerService } from "@zero-ecs/game/timer";
import {
    FlyingSwordModule,
    FlyingSwordQuery,
    FlyingSwordService,
    FlyingSwordView,
    type FlyingSwordViewData,
    type Vector3Out,
} from "@zero-ecs/flying-sword";
import {
    FlyingSwordSpatialService,
} from "@zero-ecs/flying-sword/integration";
import {
    Float2,
    Position2Type as MathPosition2Type,
    type Float2Columns,
} from "@zero-ecs/math/2d";
import {
    Float3,
    Position3Type as MathPosition3Type,
    type Float3Columns,
} from "@zero-ecs/math/3d";
import {
    ActiveCameraTag,
    CameraBasis3Type,
    CameraWorldAabb3Type,
    OrthographicCameraType,
    Projected2Type,
    ProjectionBounds3Type,
    TopDownCamera3Type,
    defineOrthographicProjectionSystem,
    orthographicProjectionSystem,
} from "@zero-ecs/math/projection";
// @ts-expect-error Scheduler is available only from the advanced entry.
import { Scheduler as RootScheduler } from "@zero-ecs/game";
// @ts-expect-error Optional Timer APIs are available only from the timer subpath.
import { TimerService as RootTimerService } from "@zero-ecs/game";
// @ts-expect-error Optional Hierarchy APIs are available only from the hierarchy subpath.
import { HierarchyModule as RootHierarchyModule } from "@zero-ecs/game";
// @ts-expect-error Pool APIs are available only from the pool subpath.
import { ObjectPoolService as RootObjectPoolService } from "@zero-ecs/game";
import { Scheduler } from "@zero-ecs/scheduler";
// @ts-expect-error Runtime scheduler storage is not part of the public API.
import type { RuntimeStage, RuntimeSystem } from "@zero-ecs/scheduler";

const enum Position { x, y }

class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Link { target }

class LinkType implements Component<Link> {
    readonly [Link.target] = Types.Entity;
}

// @ts-expect-error Every enum field must have a component column definition.
class IncompletePositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

declare const componentWorld: World;
declare const worldAllocator: IAllocator;
new World(worldAllocator);
// @ts-expect-error World never creates or owns an implicit Allocator.
new World();
const definition: ComponentDefinition<PositionType> = componentWorld.component(PositionType);
definition.layout;
// @ts-expect-error World-local IDs are not part of the stable definition.
definition.id;
// @ts-expect-error World-local Masks are not part of the stable definition.
definition.mask;

class ConfigResource extends Resource { value = 1; }
class CounterState extends State { count = 0; }
class ToolService extends Service { increment(value: number): number { return value + 1; } }
class CustomToolService extends ToolService { override increment(value: number): number { return value + 2; } }
abstract class AbstractToolService extends Service {
    abstract increment(value: number): number;
}
class ConcreteToolService extends AbstractToolService {
    increment(value: number): number { return value + 3; }
}

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
const abstractServiceToken: ServiceToken<AbstractToolService> = AbstractToolService;
const concreteServiceType: ServiceType<ConcreteToolService> = ConcreteToolService;
// @ts-expect-error Abstract Service tokens cannot be registered as constructible implementations.
const invalidConcreteServiceType: ServiceType<AbstractToolService> = AbstractToolService;
type WorldParamIsWorld = Assert<Equal<SystemParamValue<typeof World>, World>>;
const childProjection: QueryProjection = ChildOf;
componentWorld.query(QueryType.from(With(ChildOf)));
new GameBuilder().addModule(new HierarchyModule());
const flyingSwordProjection: QueryProjection<FlyingSwordViewData> = FlyingSwordView;
componentWorld.query(FlyingSwordQuery);
new GameBuilder().addModule(new FlyingSwordModule());
componentWorld.component(MathPosition2Type);
componentWorld.component(MathPosition3Type);
componentWorld.component(TopDownCamera3Type);
componentWorld.component(OrthographicCameraType);
componentWorld.component(CameraBasis3Type);
componentWorld.component(CameraWorldAabb3Type);
componentWorld.component(ActiveCameraTag);
componentWorld.component(ProjectionBounds3Type);
componentWorld.component(Projected2Type);
declare const mathPosition2Columns: ComponentColumns<MathPosition2Type>;
declare const mathPosition3Columns: ComponentColumns<MathPosition3Type>;
const float2Columns: Float2Columns = mathPosition2Columns;
const float3Columns: Float3Columns = mathPosition3Columns;
float2Columns[Float2.X];
float3Columns[Float3.Z];

class TestFlyingSwordSpatialService extends FlyingSwordSpatialService {
    readPosition(_entity: Entity, out: Vector3Out): boolean {
        out.x = 0;
        out.y = 0;
        out.z = 0;
        return true;
    }
}

new GameBuilder().addService(TestFlyingSwordSpatialService);
// @ts-expect-error Spatial adapter token is abstract and requires a concrete host implementation.
new GameBuilder().addService(FlyingSwordSpatialService);

class LifecycleService extends Service {
    init(context: ServiceInitContext): void {
        context.resource(ConfigResource).value;
        context.state(CounterState).count;
        // @ts-expect-error Service lookup is unavailable until every Service has completed init.
        context.service(ToolService);
    }

    activate(context: ServiceActivateContext): void {
        context.service(ToolService).increment(1);
    }
}

function readSystem(
    config: Readonly<ConfigResource>,
    state: Readonly<CounterState>,
    tool: ToolService,
): void {
    tool.increment(config.value + state.count);
    // @ts-expect-error A plain State parameter is shallow readonly.
    state.count++;
    // @ts-expect-error A Resource parameter is shallow readonly.
    config.value++;
}

function writeSystem(state: Mut<CounterState>): void {
    state.count++;
}

function plainSystem(): void {}

declare const entity: Entity;
declare const rawNumber: number;
declare const linkColumns: ComponentColumns<LinkType>;
const linkedEntity: Entity = linkColumns[Link.target][0];
linkColumns[Link.target][0] = entity;
// @ts-expect-error Entity reference columns reject unbranded numbers.
linkColumns[Link.target][0] = rawNumber;
const worldLinkedEntity = componentWorld.get(entity, LinkType, Link.target);
type WorldEntityFieldIsBranded = Assert<Equal<typeof worldLinkedEntity, Entity | null>>;
componentWorld.set(entity, LinkType, Link.target, entity);
// @ts-expect-error Entity reference fields reject unbranded numbers in direct writes.
componentWorld.set(entity, LinkType, Link.target, rawNumber);
const invalidEntity: Entity = INVALID_ENTITY;
function worldSystem(world: World): void {
    world.valid(entity);
    world.component(PositionType).id;
    world.findComponent(PositionType)?.mask;
    world.despawn(entity);
    // @ts-expect-error World no longer exposes Game dependency injection.
    world.service(ToolService);
}

function createInitialEntity(commands: Commands): void {
    commands.spawn()
        .set(PositionType, Position.x, 10)
        .set(PositionType, Position.y, 20)
        .submit();
}

class WorldHelper {
    @Inject.world() readonly world!: World;
    @Inject.resource(ConfigResource) readonly config!: ConfigResource;
    @Inject.state(CounterState) readonly counter!: CounterState;
    @Inject.service(AbstractToolService) readonly tool!: AbstractToolService;
}

// @ts-expect-error 属性注入只从统一的 Inject 入口声明。
Resource.inject(ConfigResource);
// @ts-expect-error 属性注入只从统一的 Inject 入口声明。
State.inject(CounterState);
// @ts-expect-error 属性注入只从统一的 Inject 入口声明。
Service.inject(ToolService);

const builder = new GameBuilder()
    .addResource(ConfigResource, new ConfigResource())
    .addState(CounterState)
    .addService(ToolService);
new GameBuilder().addModule(new DefaultCoreModule());
new GameBuilder().addModule(new DefaultCoreModule(
    undefined,
    new TimerConfigResource({ slotCount: 32, maxTaskPoolSize: 128 }),
));
new GameBuilder().addService(CustomToolService);
new GameBuilder().addService(ConcreteToolService);
new GameBuilder().setService(AbstractToolService, new ConcreteToolService());
new GameBuilder().setServiceFactory(AbstractToolService, () => new ConcreteToolService());
// @ts-expect-error addService requires a constructible implementation.
new GameBuilder().addService(AbstractToolService);
// @ts-expect-error Service overrides are expressed by subclass registration, not token/implementation pairs.
new GameBuilder().addService(ToolService, CustomToolService);
builder.addSystem(defSystem(Update.fixed, readSystem, [ConfigResource, CounterState, ToolService]));
builder.addSystem(defSystem(
    Update.fixed,
    (tool: AbstractToolService): void => { tool.increment(1); },
    [AbstractToolService],
));
builder.addSystem(defSystem(Update.fixed, writeSystem, [Write(CounterState)]));
builder.addSystem(defSystem(Update.fixed, worldSystem, [World]));
builder.addSystem(defSystem(Startup, createInitialEntity, [Commands]));
const optionalDependencySystem = defSystem(Update.post, () => {}, []);
const optionalPostSystem = defSystem(Update.post, () => {}, []);
builder.addSystem(optionalPostSystem, { afterIfPresent: optionalDependencySystem });
builder.addSystem(optionalDependencySystem);
const ManualRender = new ManualStage("render", 10);
builder.addSystem(defSystem(ManualRender, () => {}, []));
builder.addSystem(defineOrthographicProjectionSystem(ManualRender));
new GameBuilder().addSystem(orthographicProjectionSystem);
builder.addSystem(defSystem(Update.fixed, (_world: World) => {}, [World]));
// @ts-expect-error Only functions returned by defSystem can be registered.
builder.addSystem(plainSystem);

const ecs = builder.build();
ecs.resource(ConfigResource).value;
ecs.state(CounterState).count;
// @ts-expect-error Game exposes Resources as shallow readonly values.
ecs.resource(ConfigResource).value++;
// @ts-expect-error Game exposes States as shallow readonly values.
ecs.state(CounterState).count++;
// @ts-expect-error Containers are internal Game ownership details.
ecs.resources;
// @ts-expect-error Scheduler is not a stable Game property.
ecs.scheduler;

const game = new GameBuilder().build();
game.runStage(ManualRender);
// @ts-expect-error Module instances are build-time installers and are not retained by Game.
game.modules;
// @ts-expect-error Standard lifecycle stages cannot be invoked through the manual-stage API.
game.runStage(Update.fixed);
game.world.spawn();
// @ts-expect-error Entity transactions belong to Game Commands, not World.
game.world.createEntityCommand(entity);
game.world.query(QueryType.from(With(PositionType)));
game.service(AllocatorService).alloc;
game.service(AbstractToolService).increment(1);
const allocatorContract: IAllocator = game.service(AllocatorService);
const allocatorOptions: AllocatorOptions = defaultAllocatorConfig;
const allocated: Buffer = allocatorContract.alloc();
allocated.dispose();
const directBuffer = new Buffer(new ArrayBuffer(16));
directBuffer.dispose();
const customErrorSource: RuntimeErrorSource = "network.receive";
const runtimeErrorHandler: RuntimeErrorHandler = (_error, source) => {
    const diagnosticSource: string = source;
    void diagnosticSource;
};
game.service(ErrorHandlerService).setHandler(runtimeErrorHandler).report(
    new Error("network failure"),
    customErrorSource,
);
// @ts-expect-error Game is a composition root, not a SystemParam.
defSystem(Update.fixed, (_game: Game) => {}, [Game]);
// @ts-expect-error Game instances must be built by GameBuilder.
new Game();

void RootScheduler;
void RootTimerService;
void RootHierarchyModule;
void RootObjectPoolService;
void abstractServiceToken;
void concreteServiceType;
void invalidConcreteServiceType;
const entityCommand: EntityCommand = game.service(Commands).spawn();
entityCommand.set(LinkType, Link.target, entity);
// @ts-expect-error Hierarchy relations are readonly Query projections, not mutable ComponentType values.
entityCommand.add(ChildOf);
// @ts-expect-error Flying sword views are readonly projections, not mutable storage components.
entityCommand.add(FlyingSwordView);
// @ts-expect-error Game EntityCommand also rejects unbranded entity reference values.
entityCommand.set(LinkType, Link.target, rawNumber);
game.service(TimerService).once(1, entityCommand);
entityCommand.submit();
void Scheduler;
void linkedEntity;
void invalidEntity;
void IncompletePositionType;
void LifecycleService;
void WorldHelper;
void allocatorContract;
void worldAllocator;
void allocatorOptions;
void directBuffer;
void customErrorSource;
void runtimeErrorHandler;
void optionalDependencySystem;
void optionalPostSystem;
void entityCommand;
void childProjection;
void HierarchyService;
void flyingSwordProjection;
void FlyingSwordService;
void float2Columns;
void float3Columns;
