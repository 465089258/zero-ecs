import {
    ComponentService,
    Ecs,
    EcsBuilder,
    Resource,
    Service,
    State,
    Types,
    Update,
    Write,
    type Component,
    type ComponentDefinition,
    type Mut,
} from "../../dist/index.js";
// @ts-expect-error Scheduler is available only from the advanced entry.
import { Scheduler as RootScheduler } from "../../dist/index.js";
// @ts-expect-error EntityCommand construction is available only from the advanced entry.
import { EntityCommand as RootEntityCommand } from "../../dist/index.js";
import {
    EntityCommand,
    Scheduler,
    defineComponentMeta,
    getComponentMeta,
} from "../../dist/advanced.js";

const enum Position { x, y }

class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

// @ts-expect-error Every enum field must have a component column definition.
class IncompletePositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

declare const components: ComponentService;
const definition: ComponentDefinition<PositionType> = components.def(PositionType);
definition.layout;
// @ts-expect-error World-local IDs are not part of the stable definition.
definition.id;
// @ts-expect-error World-local Masks are not part of the stable definition.
definition.mask;

class ConfigResource extends Resource { value = 1; }
class CounterState extends State { count = 0; }
class ToolService extends Service { increment(value: number): number { return value + 1; } }

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

const builder = new EcsBuilder()
    .addResource(ConfigResource, new ConfigResource())
    .addState(CounterState)
    .addService(ToolService);
builder.addSystem(Update.fixed, readSystem, [ConfigResource, CounterState, ToolService]);
builder.addSystem(Update.fixed, writeSystem, [Write(CounterState)]);

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

void RootScheduler;
void RootEntityCommand;
void EntityCommand;
void Scheduler;
void defineComponentMeta;
void getComponentMeta;
void IncompletePositionType;
