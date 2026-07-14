import { CommandService } from "./command-service";

/** @internal 在内部 Post 阶段提交全部命令。 */
export function flushCommandSystem(commands: CommandService): void {
    commands.flush();
}
