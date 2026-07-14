import { Service } from "./types";

export type RuntimeErrorSource = "command" | "event" | "timer";
export type RuntimeErrorHandler = (
    error: unknown,
    source: RuntimeErrorSource,
    target?: object,
) => void;

/** Handles recoverable errors from deferred runtime work. */
export class ErrorHandlerService extends Service {
    private _handler: RuntimeErrorHandler = defaultErrorHandler;

    setHandler(handler: RuntimeErrorHandler): this {
        this._handler = handler;
        return this;
    }

    report(error: unknown, source: RuntimeErrorSource, target?: object): void {
        this._handler(error, source, target);
    }
}

function defaultErrorHandler(error: unknown, source: RuntimeErrorSource): void {
    console.error(`[zero-ecs:${source}]`, error);
}
