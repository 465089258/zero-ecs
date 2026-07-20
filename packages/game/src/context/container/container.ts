import { BasicContainer } from "./basic";
import { ClassType } from "./types";


export class Container<T> extends BasicContainer<T> {
    /** 使用无参构造函数创建并注册实例。 */
    add<I extends T>(type: ClassType<I>): T {
        const value = new type();
        this.set(type, value);
        return value;
    }
}

