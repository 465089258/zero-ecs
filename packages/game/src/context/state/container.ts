import { Container } from "../container";
import { InjectionKeys } from "../injection/metadata";
import type { State } from "./types";

/** 创建并保存 State，按注入依赖顺序管理其生命周期。 */
export class StateContainer extends Container<State> {
    constructor() {
        super(InjectionKeys.state);
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
}
