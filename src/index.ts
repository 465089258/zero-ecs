// Component schemas need only the enum and typed-array result types.
export { Types } from "./storage/typed-array";
export type { TypedArray, TypedArrayFor } from "./storage/typed-array";

export { Resource, Service, State } from "./context/types";
export type {
    ResourceType,
    ServiceType,
    StateType,
} from "./context/types";
export { World } from "./context/world";
export { InjectionService } from "./context/injection-service";

export type {
    Component,
    ComponentColumns,
    ComponentFields,
    ComponentType,
} from "./ecs/component/component";
export { ComponentService } from "./ecs/component/component-registry";
export type { Entity } from "./ecs/entity/entity";
export { EntityService } from "./ecs/entity/entity-service";

export {
    All,
    Any,
    Optional,
    QueryNodeKind,
    With,
    Without,
} from "./ecs/query/filter";
export type {
    AllNode,
    AnyNode,
    OptionalNode,
    QueryComponentsOf,
    QueryComponentTuple,
    QueryTypeNode,
    WithNode,
    WithoutNode,
} from "./ecs/query/filter";
export { QueryType } from "./ecs/query/query-type";
export { Query, QueryIter } from "./ecs/query/query";
export type {
    IQuery,
    QueryComponentView,
    QueryCurrent,
    QueryOf,
} from "./ecs/query/query";

export { Command } from "./ecs/command/command";
export type {
    CommandSubmit,
    CommandType,
    ICommand,
} from "./ecs/command/command";
export { CommandService } from "./ecs/command/command-service";
export type { ICommandService } from "./ecs/command/command-service";
export { EntityCommand } from "./ecs/command/entity-command";
export type { EntityMutator } from "./ecs/command/entity-command";
export { CommandModule } from "./ecs/command/module";

export { Shutdown, Startup, Update } from "./schedule/stage";
export { Write } from "./schedule/system";
export type {
    BareSystemParam,
    Mut,
    MutParam,
    SystemAccess,
    SystemArgs,
    SystemDefinition,
    SystemFunction,
    SystemHandle,
    SystemId,
    SystemParam,
    SystemParamValue,
} from "./schedule/system";
export type {
    SystemDependencyTarget,
    SystemOptions,
} from "./schedule/schedule";
export { Scheduler } from "./schedule/scheduler";

export { Ecs, EcsPhase } from "./runtime/ecs";
export { EcsBuilder } from "./runtime/ecs-builder";
export type { Module } from "./runtime/module";

export { EventArgs, EventService } from "./features/event/event-service";
export type { IEventService } from "./features/event/event-service";
export { EntityDespawnEvent } from "./features/event/entity-events";
export { DespawnEntityCommand } from "./features/event/entity-commands";
export { EventModule } from "./features/event/module";

export { FixedTimeResource } from "./features/time/fixed-time-resource";
export { TimeState } from "./features/time/time-state";
export { TimeModule } from "./features/time/module";

export { TimerConfig, TimerService } from "./features/timer/timer-service";
export type { ITimer, ITimerTask } from "./features/timer/timer-service";
export { TimerModule } from "./features/timer/module";

export { RandomService } from "./features/random/random-service";
export { RandomModule } from "./features/random/module";
