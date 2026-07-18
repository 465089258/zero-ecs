import { ErrorHandlerService } from "../../context/error-handler-service";
import { defSystem, type Mut, Write } from "../../schedule/system";
import { InternalPost } from "../../schedule/internal-stage";
import { Command } from "./command";
import { CommandPoolService, CommandState } from "./command-service";

export const flushCommandSystem = defSystem(
    InternalPost.command,
    flushCommands,
    [Write(CommandState), CommandPoolService, ErrorHandlerService],
);

/** @internal 在内部 Post 阶段提交全部命令。 */
function flushCommands(commands: Mut<CommandState>, pool: CommandPoolService, errors: ErrorHandlerService): void {
    let batches = 0;
    while (commands.pendingUsed > 0 && batches++ < 1000) {
        const batch = commands.pending;
        const used = commands.pendingUsed;
        commands.pending = commands.processing;
        commands.pendingUsed = 0;
        commands.processing = batch;

        for (let i = 0; i < used; i++) executeAndRecycle(batch[i], pool, errors);
    }

    if (commands.pendingUsed > 0) {
        const used = commands.pendingUsed;
        commands.pendingUsed = 0;
        for (let i = 0; i < used; i++) {
            const command = commands.pending[i];
            try { command._recycle(); }
            finally { pool.recycle(command); }
        }
        errors.report(new Error("CommandService flush safety limit reached"), "command");
    }
}

function executeAndRecycle(command: Command, pool: CommandPoolService, errors: ErrorHandlerService): void {
    try {
        command._execute();
    } catch (error) {
        errors.report(error, "command", command);
    } finally {
        try { command._recycle(); }
        catch (error) { errors.report(error, "command", command); }
        finally { pool.recycle(command); }
    }
}
