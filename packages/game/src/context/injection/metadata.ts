/** @internal Game 属性注入类别对应的共享元数据键。 */
export const InjectionKeys = Object.freeze({
    world: Symbol("WorldMetadata"),
    resource: Symbol("ResourceMetadata"),
    state: Symbol("StateMetadata"),
    service: Symbol("ServiceMetadata"),
});
/** @internal 单个属性的注入元数据。 */
export interface InjectionEntry {
    readonly property: string | symbol;
    readonly type?: Function;
}

function getMetadata(owner: any, key: symbol): InjectionEntry[] {
    let entries: InjectionEntry[] | undefined = Object.prototype.hasOwnProperty.call(owner, key)
        ? owner[key]
        : undefined;
    if (!entries) {
        entries = [];
        owner[key] = entries;
    }
    return entries;
}

function register(owner: Function, key: symbol, entry: InjectionEntry): void {
    let entries = getMetadata(owner, key);
    if (!entries.some(item =>
        item.property === entry.property &&
        item.type === entry.type
    )) entries.push(entry);
}

/** @internal 读取类自身声明的注入元数据。 */
export function injectionEntries(owner: Function, key: symbol): readonly InjectionEntry[] | undefined {
    return Object.prototype.hasOwnProperty.call(owner, key)
        ? (owner as any)[key]
        : undefined;
}

/** @internal 创建兼容传统装饰器与 Stage 3 装饰器的属性注入函数。 */
export function createInjectDecorator(key: symbol, type?: Function) {
    return function (
        target: Object | undefined,
        property: string | symbol | {
            readonly name: string | symbol;
            addInitializer(fn: (this: any) => void): void;
        },
    ): void {
        if (target === undefined && typeof property === "object") {
            const context = property;
            context.addInitializer(function () {
                register(this.constructor, key, { property: context.name, type });
            });
            return;
        }
        register(target!.constructor, key, {
            property: property as string | symbol,
            type,
        });
    };
}
