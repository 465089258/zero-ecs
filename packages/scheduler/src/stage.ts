/** 通用调度阶段标识；Scheduler 不解释名称或顺序的领域含义。 */
export class Stage {
    constructor(readonly name: string, readonly order: number) { Object.freeze(this); }
}

/** 仅在构建期展开的系统集合锚点，不形成运行时阶段。 */
export class SystemSet {
    constructor(readonly stage: Stage, readonly name: string) { Object.freeze(this); }
}
