import { EventService } from "./event-service";

export function flushEventsSystem(events: EventService): void {
    events.flush();
}
