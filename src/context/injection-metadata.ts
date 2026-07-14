export const enum InjectionKind { World, Resource, State, Service }

export interface InjectionEntry {
    readonly kind: InjectionKind;
    readonly property: string | symbol;
    readonly type?: Function;
}

const metadata = new WeakMap<Function, InjectionEntry[]>();

function register(owner: Function, entry: InjectionEntry): void {
    let entries = metadata.get(owner);
    if (!entries) {
        entries = [];
        metadata.set(owner, entries);
    }
    if (!entries.some(item =>
        item.kind === entry.kind &&
        item.property === entry.property &&
        item.type === entry.type
    )) entries.push(entry);
}

export function injectionEntries(owner: Function): readonly InjectionEntry[] | undefined {
    return metadata.get(owner);
}

export function createInjectDecorator(kind: InjectionKind, type?: Function) {
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
                register(this.constructor, { kind, property: context.name, type });
            });
            return;
        }
        register(target!.constructor, {
            kind,
            property: property as string | symbol,
            type,
        });
    };
}
