import { Service } from "./types";

/** 可恢复运行时错误的来源。 */
export type RuntimeErrorSource = "command" | "event" | "timer";
/** 可恢复运行时错误处理函数。 */
export type RuntimeErrorHandler = (
    error: unknown,
    source: RuntimeErrorSource,
    target?: object,
) => void;

/** 集中处理 Command、Event 和 Timer 延迟执行期间的可恢复错误。 */
export class ErrorHandlerService extends Service {
    private _handler: RuntimeErrorHandler = defaultErrorHandler;

    /** 替换当前错误处理函数。 */
    setHandler(handler: RuntimeErrorHandler): this {
        this._handler = handler;
        return this;
    }

    /** 向已注册的处理函数报告错误。 */
    report(error: unknown, source: RuntimeErrorSource, target?: object): void {
        this._handler(error, source, target);
    }
}

function defaultErrorHandler(error: unknown, source: RuntimeErrorSource): void {
    console.error(`[zero-ecs:${source}]`, error);
}
