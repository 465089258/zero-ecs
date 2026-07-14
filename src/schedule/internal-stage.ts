import { UpdateStage } from "./stage";

/** @internal 内部提交阶段；普通业务系统不可注册。 */
export class InternalPost {
    static readonly command = new UpdateStage("post:command", 10);
    static readonly migration = new UpdateStage("post:migration", 11);
    static readonly event = new UpdateStage("post:event", 12);
    static readonly stages = Object.freeze([
        InternalPost.command,
        InternalPost.migration,
        InternalPost.event,
    ]);
}
