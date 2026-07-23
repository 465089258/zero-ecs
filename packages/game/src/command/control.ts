import type { Entity } from "@zero-ecs/world";
import type { Commands, ICommands } from "./command-service";

/**
 * Commands 提交扩展可见的最小包内上下文。
 *
 * 扩展只能读取当前 Migrations 收集批次并通过稳定 ICommands 追加命令，不能自行触发 flush。
 * @internal
 */
export interface CommandFlushContext {
    readonly commands: ICommands;
    pendingEntityCommandCount(): number;
    pendingEntityAt(index: number): Entity;
    pendingEntityWillDespawnAt(index: number): boolean;
}

/** Commands 提交边界上的包内扩展协议。 @internal */
export interface CommandFlushExtension {
    /** 普通 Command 已执行、实体事务尚未合并时调用。 */
    flushCommands(context: CommandFlushContext): void;
}

/** @internal 仅供内建提交 System 触发 Commands flush。 */
export const COMMANDS_FLUSH: unique symbol = Symbol("Commands.flush");

/** @internal 仅供包内可选模块注册提交扩展。 */
export const COMMANDS_ADD_FLUSH_EXTENSION: unique symbol =
    Symbol("Commands.addFlushExtension");

/** @internal 仅供包内可选模块移除提交扩展。 */
export const COMMANDS_REMOVE_FLUSH_EXTENSION: unique symbol =
    Symbol("Commands.removeFlushExtension");

/** @internal Commands 的包内提交控制协议。 */
export interface CommandsControl {
    [COMMANDS_FLUSH](): void;
    [COMMANDS_ADD_FLUSH_EXTENSION](extension: CommandFlushExtension): void;
    [COMMANDS_REMOVE_FLUSH_EXTENSION](extension: CommandFlushExtension): void;
}

/** 在包内把 Commands 收窄为提交控制协议。 @internal */
export function commandsControl(commands: Commands): CommandsControl {
    return commands as Commands & CommandsControl;
}
