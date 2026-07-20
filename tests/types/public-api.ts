import {
    AllocatorService,
    Buffer,
    Commands,
    defaultAllocatorConfig,
    DefaultCoreModule,
    defSystem,
    Ecs,
    EcsBuilder,
    ErrorHandlerService,
    Game,
    GameBuilder,
    Inject,
    Resource,
    Service,
    State,
    TimerService,
    Types,
    Update,
    Write,
    World,
    type Component,
    type ComponentDefinition,
    type EntityCommand,
    type IAllocator,
    type AllocatorOptions,
    type Mut,
    type RuntimeErrorHandler,
    type RuntimeErrorSource,
    type StructureWriter,
    type SystemParamValue,
    type WorldView,
    type ServiceActivateContext,
    type ServiceInitContext,
} from "@zero-ecs/game";
// @ts-expect-error Scheduler is available only from the advanced entry.
import { Scheduler as RootScheduler } from "@zero-ecs/game";
// @ts-expect-error unsafe structure access is available only from the advanced entry.
import { unsafeStructureWriter as rootUnsafeStructureWriter } from "@zero-ecs/game";
import {
    defineComponentMeta,
    getComponentMeta,
    unsafeStructureWriter,
} from "@zero-ecs/game/advanced";
import { Scheduler } from "@zero-ecs/scheduler";
import type { EntityCommand as RawEntityCommand } from "@zero-ecs/world";

const enum Position { x, y }

class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
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
const definition: ComponentDefinition<PositionType> = componentWorld.defineComponent(PositionType);
definition.layout;
// @ts-expect-error World-local IDs are not part of the stable definition.
definition.id;
// @ts-expect-error World-local Masks are not part of the stable definition.
definition.mask;

class ConfigResource extends Resource { value = 1; }
class CounterState extends State { count = 0; }
class ToolService extends Service { increment(value: number): number { return value + 1; } }
class CustomToolService extends ToolService { override increment(value: number): number { return value + 2; } }

type Equal<A, B> =
    (<T>() => T extends A ? 1 : 2) extends
    (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
type WorldParamIsView = Assert<Equal<SystemParamValue<typeof World>, WorldView>>;

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

declare const entity: import("@zero-ecs/world").Entity;
function worldSystem(world: WorldView): void {
    world.valid(entity);
    // @ts-expect-error WorldView intentionally excludes immediate structure changes.
    world.despawn(entity);
    // @ts-expect-error World no longer exposes Game dependency injection.
    world.service(ToolService);
}

class WorldHelper {
    @Inject.world() readonly world!: WorldView;
}

// Decorator metadata cannot enforce the exact field declaration; this is an explicit escape hatch.
class FullWorldHelper {
    @Inject.world() readonly world!: World;
}

const builder = new EcsBuilder()
    .addResource(ConfigResource, new ConfigResource())
    .addState(CounterState)
    .addService(ToolService);
new GameBuilder().addModule(new DefaultCoreModule());
new GameBuilder().addService(CustomToolService);
// @ts-expect-error Service overrides are expressed by subclass registration, not token/implementation pairs.
new GameBuilder().addService(ToolService, CustomToolService);
builder.addSystem(defSystem(Update.fixed, readSystem, [ConfigResource, CounterState, ToolService]));
builder.addSystem(defSystem(Update.fixed, writeSystem, [Write(CounterState)]));
builder.addSystem(defSystem(Update.fixed, worldSystem, [World]));
const optionalDependencySystem = defSystem(Update.post, () => {}, []);
const optionalPostSystem = defSystem(Update.post, () => {}, []);
builder.addSystem(optionalPostSystem, { afterIfPresent: optionalDependencySystem });
builder.addSystem(optionalDependencySystem);
// @ts-expect-error [World] supplies WorldView, not the nominal full World type.
builder.addSystem(defSystem(Update.fixed, (_world: World) => {}, [World]));
// @ts-expect-error Only functions returned by defSystem can be registered.
builder.addSystem(plainSystem);

const ecs = builder.build();
ecs.resource(ConfigResource).value;
ecs.state(CounterState).count;
// @ts-expect-error Ecs exposes Resources as shallow readonly values.
ecs.resource(ConfigResource).value++;
// @ts-expect-error Ecs exposes States as shallow readonly values.
ecs.state(CounterState).count++;
// @ts-expect-error Containers are internal Ecs ownership details.
ecs.resources;
// @ts-expect-error Scheduler is not a stable Ecs property.
ecs.scheduler;
// @ts-expect-error Ecs instances must be built by EcsBuilder.
new Ecs();

const game = new GameBuilder().build();
const writer: StructureWriter = game.structureWriter();
writer.reserveEntity();
writer.createEntityCommand(entity);
// @ts-expect-error Game exposes only the non-structural WorldView by default.
game.world.query;
game.service(AllocatorService).alloc;
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
unsafeStructureWriter(componentWorld).despawn(entity);
// @ts-expect-error Game is a composition root, not a SystemParam.
defSystem(Update.fixed, (_game: Game) => {}, [Game]);
// @ts-expect-error Game instances must be built by GameBuilder.
new Game();

void RootScheduler;
void rootUnsafeStructureWriter;
const entityCommand: EntityCommand = game.service(Commands).spawn();
game.service(TimerService).once(1, entityCommand);
entityCommand.submit();
declare const rawEntityCommand: RawEntityCommand;
// @ts-expect-error Timer depends only on the submit task protocol, not RawEntityCommand.
game.service(TimerService).once(1, rawEntityCommand);
// @ts-expect-error World EntityCommand has no Game submit callback.
rawEntityCommand.submit();
void Scheduler;
void defineComponentMeta;
void getComponentMeta;
void IncompletePositionType;
void LifecycleService;
void WorldHelper;
void FullWorldHelper;
void allocatorContract;
void worldAllocator;
void allocatorOptions;
void directBuffer;
void customErrorSource;
void runtimeErrorHandler;
void optionalDependencySystem;
void optionalPostSystem;
void entityCommand;
void rawEntityCommand;
