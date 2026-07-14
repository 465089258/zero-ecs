import { UpdateStage } from "./stage";

/** Internal commit partitions. This module is intentionally absent from the public barrel. */
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
