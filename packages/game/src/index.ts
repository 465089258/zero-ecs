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
    ServiceToken,
    ServiceType,
} from "./context/service";
export { State } from "./context/state";
export type { StateType } from "./context/state";
export { Inject } from "./context/injection/injection";
export { InjectionService } from "./context/injection/service";
export { ErrorHandlerService } from "./context/error-handler-service";
export type { RuntimeErrorHandler, RuntimeErrorSource } from "./context/error-handler-service";
export { AllocatorService } from "./memory/allocator-service";

export { Command } from "./command/command";
export type { ICommand } from "./command/command";
export { Commands } from "./command/command-service";
export type { EntityCommand, ICommands } from "./command/command-service";
export type { EntityMutator } from "./migration/entity-transaction";
export { CommandModule } from "./command/module";

export { GameSystemSet, ManualStage, Shutdown, Startup, Update } from "./runtime/stage";
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
export { GameBuilder } from "./runtime/game-builder";
export type { ServiceBuildContext } from "./runtime/game-builder";
export type { Module } from "./runtime/module";
export { DefaultCoreModule } from "./features/default-core-module";
