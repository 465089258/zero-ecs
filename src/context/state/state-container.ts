
import { Container } from "../container";
import { createInjectDecorator } from "../injection-metadata";
import type { State, StateType } from "./types";
const StateSymob = Symbol("StateMetadata");
/** 创建并保存 State，按注入依赖顺序管理其生命周期。 */
export class StateContainer extends Container<State> {
    constructor() {
        super(StateSymob);
    }
    protected doInit(order: State[]): void {
        for (const value of order) {
            value.init?.();
        }
    }
    protected doDispose(order: State[]) {
        let firstError: unknown;
        for (let i = order.length - 1; i >= 0; i--) {
            try { order[i].dispose?.(); }
            catch (error) { firstError ??= error; }
        }
        if (firstError !== undefined) throw firstError;
    }
    static inject<T extends State>(type: StateType<T>) {
        return createInjectDecorator(StateSymob, type);
    }
}