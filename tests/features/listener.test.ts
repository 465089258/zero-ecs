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
});
