// ---------- 对象池 ----------
const RecycledSymbol = Symbol("Recycled");
export class ArrayPool {
    private _items: any[][] = [];
    spawn<T extends any[]>(): T {
        let arr = this._items.pop();
        if (!arr) return [] as unknown as T;
        arr.length = 0;
        return arr as unknown as T;
    }
    despawn<T extends any[]>(arr: T) {
        if (arr[0] === RecycledSymbol) return;
        arr.length = 1;
        // @ts-ignore
        arr[0] = RecycledSymbol;
        this._items.push(arr);
    }
    private static _curr?: ArrayPool;
    private static get curr() {
        let curr = this._curr;
        if (curr) return curr;
        curr = new ArrayPool();
        this._curr = curr;
        return curr;
    }
    static spawn<T extends any[]>(): T {
        return this.curr.spawn();
    }
    static despawn<T extends any[]>(arr: T): void {
        this.curr.despawn(arr);
    }
}