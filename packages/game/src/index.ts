// 常用 World 能力从 peer dependency 原样重导出，保持单份运行时身份。
export * from "@zero-ecs/world";
export { Stage, SystemSet } from "@zero-ecs/scheduler";
export type {
    SystemDependencyTarget,
    SystemHandle,
    SystemId,
    SystemOptions,
} from "@zero-ecs/scheduler";

export { Resource } from "./context/resource";
export type { ResourceType } from "./context/resource";
export { Service } from "./context/service";
export type {
    ServiceActivateContext,
    ServiceInitContext,
    ServiceType,
} from "./context/service";
export { State } from "./context/state";
export type { StateType } from "./context/state";
export { Inject } from "./context/injection/injection";
export { InjectionService } from "./context/injection/service";
export { ErrorHandlerService } from "./context/error-handler-service";
export type { RuntimeErrorHandler, RuntimeErrorSource } from "./context/error-handler-service";
export { AllocatorService } from "./memory/allocator-service";
export { ObjectPool, ObjectPoolService, definePool } from "./pool/object-pool-service";
export type { ObjectPoolOptions, ObjectPoolToken } from "./pool/object-pool-service";

export { Command } from "./command/command";
export type { ICommand } from "./command/command";
export { Commands, CommandService } from "./command/command-service";
export type { EntityCommand, ICommands, ICommandService } from "./command/command-service";
export { CommandModule } from "./command/module";

export { GameSystemSet, Shutdown, Startup, Update } from "./runtime/stage";
export { defSystem, Write } from "./runtime/system";
export type {
    BareSystemParam,
    DefinedSystem,
    Mut,
    MutParam,
    SystemArgs,
    SystemFunction,
    SystemParam,
    SystemParamValue,
} from "./runtime/system";
export { Game, GamePhase } from "./runtime/game";
/** @deprecated 使用 `Game`。 */
export { Game as Ecs } from "./runtime/game";
export { GameBuilder } from "./runtime/game-builder";
/** @deprecated 使用 `GameBuilder`。 */
export { GameBuilder as EcsBuilder } from "./runtime/game-builder";
/** @deprecated 使用 `GamePhase`。 */
export { GamePhase as EcsPhase } from "./runtime/lifecycle";
export type { ServiceBuildContext } from "./runtime/game-builder";
export type { Module } from "./runtime/module";
export { DefaultCoreModule } from "./features/default-core-module";
export * from "./features/event/index";
export * from "./features/time/index";
export * from "./features/timer/index";
export * from "./features/random/index";
