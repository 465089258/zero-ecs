import { BasicContainer } from "./basic-container";
import { ClassType } from "./types";


export class Container<T> extends BasicContainer<T> {
    /** 创建并注册 State；重复注册或容器锁定后会抛出错误。 */
    add<I extends T>(type: ClassType<I>): T {
        if (this.sealed) throw new Error("States are locked");
        if (this.items.has(type)) throw new Error(`State already registered: ${type.name}`);
        const value = new type();
        this.items.set(type, value);
        this.order.push(value);
        return value;
    }
}

