import type { Stage, SystemSet } from "./stage";

declare const SystemIdBrand: unique symbol;

/** 当前 Schedule 内唯一的系统编号。 */
export type SystemId = number & { readonly [SystemIdBrand]: "SystemId" };

/** Scheduler 可调用的普通函数；参数含义由上层 Provider 决定。 */
export type SystemFunction = (...args: any[]) => void;

/** 注册系统后返回的稳定句柄。 */
export interface SystemHandle {
    readonly id: SystemId;
    readonly name: string;
    readonly stage: Stage;
}

/** Scheduler 编译前保存的领域无关系统定义。 */
export interface SystemDefinition<Param = unknown> {
    readonly handle: SystemHandle;
    readonly fn: SystemFunction;
    readonly params: readonly Param[];
    readonly sets: readonly SystemSet[];
    readonly registrationIndex: number;
}
