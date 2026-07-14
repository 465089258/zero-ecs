/** 不可变的系统执行阶段标识。 */
export class UpdateStage {
    /** 创建指定名称和排序值的阶段标识。 */
    constructor(readonly name: string, readonly order: number) { Object.freeze(this); }
}

/** ECS 启动时执行一次的阶段。 */
export const Startup = new UpdateStage("startup", -100);

/** 固定 Tick 内可注册业务系统的标准阶段。 */
export class Update {
    /** Tick 开始阶段。 */
    static readonly first = new UpdateStage("first", 0);
    /** 固定数据更新阶段。 */
    static readonly fixed = new UpdateStage("fixed", 1);
    /** Tick 结束阶段。 */
    static readonly last = new UpdateStage("last", 2);
    /** 按执行顺序排列的业务更新阶段。 */
    static readonly stages = Object.freeze([
        Update.first,
        Update.fixed,
        Update.last,
    ]);
}

/** ECS 停止时执行一次的阶段。 */
export const Shutdown = new UpdateStage("shutdown", 100);
