import { describe, expect, test } from "@rstest/core";
import { Listener } from "@zero-ecs/game/event";

describe("Listener retention", () => {
    test("clear removes remaining callbacks during a re-entrant dispatch", () => {
        const listener = new Listener<number>();
        const calls: number[] = [];
        listener.on(value => {
            calls.push(value);
            listener.clear();
        });
        listener.on(value => calls.push(value + 10));

        listener.call(1);
        listener.call(2);
        expect(calls).toEqual([1]);

        listener.on(value => calls.push(value));
        listener.call(3);
        expect(calls).toEqual([1, 3]);
    });

    test("defers listeners added during dispatch until the next call", () => {
        const listener = new Listener<number>();
        const calls: string[] = [];
        const added = (value: number): void => { calls.push(`added:${value}`); };
        listener.on(value => {
            calls.push(`first:${value}`);
            listener.on(added);
        });

        listener.call(1);
        expect(calls).toEqual(["first:1"]);
        listener.call(2);
        expect(calls).toEqual(["first:1", "first:2", "added:2"]);
    });

    test("supports one/off during dispatch and finalizes after an error handler throws", () => {
        const listener = new Listener<number>();
        const calls: string[] = [];
        const removed = (): void => { calls.push("removed"); };
        listener.one(() => {
            calls.push("one");
            listener.off(removed);
            throw new Error("listener failed");
        });
        listener.on(removed);
        listener.on(() => calls.push("tail"));

        expect(() => listener.call(1, () => { throw new Error("handler failed"); })).toThrow(/handler failed/);
        listener.call(2);
        expect(calls).toEqual(["one", "tail"]);
    });
});
