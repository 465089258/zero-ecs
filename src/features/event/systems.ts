import { EventService } from "./event-service";

/** @internal 在内部 Post 阶段分发当前事件队列。 */
export function flushEventsSystem(events: EventService): void {
    events.flush();
}
