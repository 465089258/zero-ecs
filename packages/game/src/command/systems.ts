import { defSystem } from "../runtime/system";
import { Update } from "../runtime/stage";
import { Commands } from "./command-service";

/** 在 Commands SystemSet 中执行普通命令并合并实体事务。 */
export const flushCommandsSystem = defSystem(Update.post, flushCommands, [Commands]);

function flushCommands(commands: Commands): void { commands.flush(); }
