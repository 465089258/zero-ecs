import { CommandService } from "./command-service";

export function flushCommandSystem(commands: CommandService): void {
    commands.flush();
}
