type Method<T> = (args: T) => void;
type Entry<T> = { ctx?: any; fn: Method<T>, one: boolean, removed: boolean };
export class Listener<T = any> {
    private _active: Array<Entry<T>> = [];
    private _snapshot: Array<Entry<T>> = [];
    private _size = 0;
    private add(one: boolean, fn: Method<T>, ctx?: any) {
        let item: Entry<T>;
        if (this._size < this._active.length) {
            item = this._active[this._size];
            item.ctx = ctx;
            item.fn = fn;
            item.one = one;
            item.removed = false;
        } else {
            item = { ctx, fn, one: one, removed: false };
            this._active.push(item);
        }
        this._size++;
    }
    /** 添加监听器 */
    on(fn: Method<T>, ctx?: any): void {
        this.add(false, fn, ctx);
    }
    /** 添加一次性监听器 */
    one(fn: Method<T>, ctx?: any): void {
        this.add(true, fn, ctx);
    }
    /** 调用所有监听器 */
    call(args: T, onError?: (error: unknown) => void): void {
        let count = 0;
        const { _active, _snapshot, _size } = this;
        for (let i = 0; i < _size; i++) {
            const entry = _active[i];
            const { fn, ctx, one, removed } = entry;
            if (removed) {
                entry.fn = null!;
                entry.ctx = undefined;
                entry.one = false;
                continue;
            }
            try {
                fn.call(ctx, args);
            } catch (err) {
                if (onError) onError(err);
                else throw err;
            }
            entry.fn = null!;
            entry.ctx = undefined;
            entry.one = false;
            // 如果是一次性监听或者在回调中清除了自己，则不保留到快照
            if (one || entry.removed) continue;
            // 确保快照容量足够（复用已有对象）
            if (count >= _snapshot.length) {
                _snapshot.push({ fn, ctx, one: false, removed: false });
            } else {
                const dst = _snapshot[count];
                dst.fn = fn;
                dst.ctx = ctx;
                dst.one = false;
                dst.removed = false;
            }
            count++;
        }
        this._snapshot = _active;
        this._active = _snapshot;
        this._size = count;
    }

    /** 删除监听器，只删除最后一个匹配项 */
    off(fn: Method<T>, ctx?: any): void {
        for (let i = this._size - 1; i >= 0; i--) {
            const e = this._active[i];
            if (e.fn === fn && e.ctx === ctx && !e.removed) {
                e.fn = null!;
                e.ctx = undefined;
                e.removed = true;
                return;
            }
        }
    }

    /** 清空所有监听器 */
    clear(): void {
        for (let i = 0; i < this._size; i++) {
            this._active[i].removed = true;
        }
        this._size = 0;
    }
}
