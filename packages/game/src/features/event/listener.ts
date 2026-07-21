type Method<T> = (args: T) => void;
type ErrorMethod = (error: unknown) => void;
type Entry<T> = { ctx?: any; fn: Method<T>; one: boolean; removed: boolean };

/** 支持派发期间增删与单次回调的低分配监听器集合。 */
export class Listener<T = any> {
    private _active: Array<Entry<T>> = [];
    private _snapshot: Array<Entry<T>> = [];
    private readonly _pending: Array<Entry<T>> = [];
    private _size = 0;
    private _pendingUsed = 0;
    private _dispatching = false;

    /** 添加持久监听器。 */
    on(fn: Method<T>, ctx?: any): void { this.add(false, fn, ctx); }

    /** 添加触发一次后自动移除的监听器。 */
    one(fn: Method<T>, ctx?: any): void { this.add(true, fn, ctx); }

    /**
     * 按注册顺序调用本次派发开始时的监听器快照。
     * 派发期间新增的监听器从下一次派发开始生效；不支持嵌套调用同一个 Listener。
     */
    call(args: T, onError?: ErrorMethod, errorContext?: unknown): void {
        if (this._dispatching) throw new Error("Listener does not support nested dispatch");
        this._dispatching = true;
        const active = this._active;
        const snapshot = this._snapshot;
        const size = this._size;
        let retained = 0;

        try {
            for (let i = 0; i < size; i++) {
                const entry = active[i];
                if (entry.removed) continue;
                if (entry.one) entry.removed = true;
                try { entry.fn.call(entry.ctx, args); }
                catch (error) {
                    if (!onError) throw error;
                    onError.call(errorContext, error);
                }
            }
        } finally {
            for (let i = 0; i < size; i++) {
                const entry = active[i];
                if (!entry.removed) {
                    writeEntry(snapshot, retained++, entry.fn, false, entry.ctx);
                }
                clearEntry(entry);
            }
            for (let i = 0; i < this._pendingUsed; i++) {
                const entry = this._pending[i];
                if (!entry.removed) {
                    writeEntry(snapshot, retained++, entry.fn, entry.one, entry.ctx);
                }
                clearEntry(entry);
            }
            this._pendingUsed = 0;
            this._snapshot = active;
            this._active = snapshot;
            this._size = retained;
            this._dispatching = false;
        }
    }

    /** 删除最后一个函数与上下文均匹配的监听器。 */
    off(fn: Method<T>, ctx?: any): void {
        if (this._dispatching) {
            if (markLast(this._pending, this._pendingUsed, fn, ctx)) return;
        }
        markLast(this._active, this._size, fn, ctx);
    }

    /** 清空全部监听器；可在回调执行期间安全调用。 */
    clear(): void {
        for (let i = 0; i < this._size; i++) this._active[i].removed = true;
        for (let i = 0; i < this._pendingUsed; i++) this._pending[i].removed = true;
        if (!this._dispatching) {
            for (let i = 0; i < this._size; i++) clearEntry(this._active[i]);
            this._size = 0;
        }
    }

    private add(one: boolean, fn: Method<T>, ctx?: any): void {
        if (typeof fn !== "function") throw new TypeError("Listener callback must be a function");
        if (this._dispatching) {
            writeEntry(this._pending, this._pendingUsed++, fn, one, ctx);
        } else {
            writeEntry(this._active, this._size++, fn, one, ctx);
        }
    }
}

function writeEntry<T>(entries: Entry<T>[], index: number, fn: Method<T>, one: boolean, ctx?: any): void {
    if (index < entries.length) {
        const entry = entries[index];
        entry.fn = fn;
        entry.ctx = ctx;
        entry.one = one;
        entry.removed = false;
    } else {
        entries.push({ fn, ctx, one, removed: false });
    }
}

function clearEntry<T>(entry: Entry<T>): void {
    entry.fn = undefined!;
    entry.ctx = undefined;
    entry.one = false;
    entry.removed = true;
}

function markLast<T>(entries: Entry<T>[], used: number, fn: Method<T>, ctx?: any): boolean {
    for (let i = used - 1; i >= 0; i--) {
        const entry = entries[i];
        if (!entry.removed && entry.fn === fn && entry.ctx === ctx) {
            entry.removed = true;
            return true;
        }
    }
    return false;
}
