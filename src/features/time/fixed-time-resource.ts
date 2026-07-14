import { Resource } from "../../context/types";

/** Immutable fixed-step configuration supplied before Ecs.build(). */
export class FixedTimeResource extends Resource {
    constructor(readonly deltaSeconds = 0.02) {
        super();
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
            throw new RangeError(`Fixed delta must be a finite positive number, received ${deltaSeconds}`);
        }
    }
}
