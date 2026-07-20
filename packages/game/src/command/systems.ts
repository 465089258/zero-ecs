import { defSystem } from "../runtime/system";
import { Update } from "../runtime/stage";
import { Commands } from "./command-service";

/** 在 Commands SystemSet 中执行普通命令并合并实体事务。 */
export const flushCommandsSystem = defSystem(Update.post, flushCommands, [Commands]);

/** 在 Structure SystemSet 中应用每实体最终事务。 */
export const applyEntityCommandsSystem = defSystem(Update.post, applyEntityCommands, [Commands]);

function flushCommands(commands: Commands): void { commands.flush(); }
function applyEntityCommands(commands: Commands): void { commands.applyEntityCommands(); }
