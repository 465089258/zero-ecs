import { ErrorHandlerService } from "../../context/error-handler-service";
import { defSystem, type Mut, Write } from "../../runtime/system";
import { Update } from "../../runtime/stage";
import { EventArgs, EventPoolService, EventState } from "./event-service";

export const flushEventsSystem = defSystem(
    Update.post,
    flushEvents,
    [Write(EventState), EventPoolService, ErrorHandlerService],
);

/** 在 Update.post 阶段分发当前事件队列。 */
function flushEvents(events: Mut<EventState>, pool: EventPoolService, errors: ErrorHandlerService): void {
    if (events.disposed) throw new Error("EventService has been disposed");
    const queue = events.backQueue;
    events.backQueue = events.frontQueue;
    events.frontQueue = queue;
    let firstError: unknown;
    for (let i = 0; i < queue.length; i++) {
        const args = queue[i];
        try {
            events.events.get(args.constructor as new () => EventArgs)?.call(
                args,
                reportListenerError,
                errors,
            );
        } catch (error) {
            firstError ??= error;
        } finally {
            try { args._recycle(); }
            catch (error) {
                const handlerError = reportEventError(errors, error, args);
                firstError ??= handlerError;
            }
            finally {
                try { pool.recycle(args); }
                catch (error) { firstError ??= error; }
            }
        }
    }
    queue.length = 0;
    if (firstError !== undefined) throw firstError;
}

function reportListenerError(this: ErrorHandlerService, error: unknown): void {
    this.report(error, "event");
}

function reportEventError(
    errors: ErrorHandlerService,
    error: unknown,
    target: object,
): unknown {
    try {
        errors.report(error, "event", target);
        return undefined;
    } catch (handlerError) {
        return handlerError;
    }
}
