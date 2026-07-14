import { State } from "../../context/types";

/** Deterministic simulation time advanced exactly once per Ecs.update(). */
export class TimeState extends State {
    readonly delta: number = 0;
    readonly elapsed: number = 0;
    readonly tick: number = 0;
}
