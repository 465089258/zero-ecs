import { Service } from "./service";

/**
 * 可恢复运行时错误的开放来源标签。
 *
 * 内建标签保留编辑器自动补全；上层模块可以直接使用自己的字符串标签，无需修改底层联合类型。
 */
export type RuntimeErrorSource =
    | "command"
    | "event"
    | "timer"
    | (string & {});
/** 可恢复运行时错误处理函数。 */
export type RuntimeErrorHandler = (
    error: unknown,
    source: RuntimeErrorSource,
    target?: object,
) => void;

/** 集中处理框架及上层延迟工作中的可恢复错误。 */
export class ErrorHandlerService extends Service {
    private handler: RuntimeErrorHandler = defaultErrorHandler;

    /** 替换当前错误处理函数。 */
    setHandler(handler: RuntimeErrorHandler): this {
        this.handler = handler;
        return this;
    }

    /** 向已注册的处理函数报告错误。 */
    report(error: unknown, source: RuntimeErrorSource, target?: object): void {
        this.handler(error, source, target);
    }
}

function defaultErrorHandler(error: unknown, source: RuntimeErrorSource): void {
    console.error(`[zero-ecs:${source}]`, error);
}
