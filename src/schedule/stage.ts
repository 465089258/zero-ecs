export class UpdateStage {
    constructor(readonly name: string, readonly order: number) { Object.freeze(this); }
}

export const Startup = new UpdateStage("startup", -100);

export class Update {
    static readonly first = new UpdateStage("first", 0);
    static readonly fixed = new UpdateStage("fixed", 1);
    static readonly last = new UpdateStage("last", 2);
    static readonly stages = Object.freeze([
        Update.first,
        Update.fixed,
        Update.last,
    ]);
}

export const Shutdown = new UpdateStage("shutdown", 100);
