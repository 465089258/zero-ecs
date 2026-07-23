

const AssertDisposedMethod = Symbol("AssertDisposedMethod");
type AnyMethod = (this: any, ...args: any[]) => any;
function markAssertDisposedMethod(method: AnyMethod): void {
    Object.defineProperty(
        method,
        AssertDisposedMethod,
        {
            value: true,
            enumerable: false,
            configurable: false,
            writable: false,
        },
    );
}
type Method<This, Args extends unknown[], Result> = (this: This, ...args: Args) => Result;
type Context<This, Args extends unknown[], Result> = ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Result>;
function throwDisposed(this: object): never {
    const name = this.constructor?.name ?? "Object";
    throw new Error(`${name} has been disposed`);
}
export abstract class Disposable {
    private _disposed: boolean = false;
    /** 是否已经完成内核释放。 */
    get disposed(): boolean { return this._disposed; }
    /** 释放全部 Table；可重复调用。 */
    dispose(): void {
        if (this._disposed) return;
        this.doDispose?.();
        this._disposed = true;
        let prototype = Object.getPrototypeOf(this);
        while (prototype && prototype !== Object.prototype) {
            const keys = Reflect.ownKeys(prototype);
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                if (key === "constructor") continue;
                const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
                const method = descriptor?.value;
                if (typeof method !== "function" || method[AssertDisposedMethod] !== true) continue;
                Object.defineProperty(this, key, {
                    value: throwDisposed,
                    enumerable: false,
                    configurable: false,
                    writable: false,
                });
            }
            prototype = Object.getPrototypeOf(prototype);
        }

    }
    protected doDispose?(): void;
    static guard<This, Args extends unknown[], Result>(value: Method<This, Args, Result>, context: Context<This, Args, Result>): void {
        if (context.static) throw new TypeError("@assertDisposedMethod cannot decorate static methods");
        if (context.private) throw new TypeError("@assertDisposedMethod cannot decorate private methods");
        if (context.kind !== "method") throw new TypeError("@assertDisposedMethod can only decorate methods");
        markAssertDisposedMethod(value);
    }
}