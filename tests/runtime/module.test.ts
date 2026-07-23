import { describe, expect, test } from "@rstest/core";
import {
    GameBuilder,
    type Module,
} from "@zero-ecs/game";

class RecordingModule implements Module {
    constructor(
        private readonly name: string,
        private readonly order: string[],
    ) {}

    build(): void { this.order.push(`${this.name}:build`); }
}

describe("Module composition", () => {
    test("executes build immediately and does not retain Modules in Game", () => {
        const order: string[] = [];
        const first = new RecordingModule("first", order);
        const second = new RecordingModule("second", order);
        const builder = new GameBuilder();

        builder.addModule(first).addModule(second);
        expect(order).toEqual(["first:build", "second:build"]);

        const game = builder.build();
        expect("modules" in game).toBe(false);

        game.init();
        game.start();
        game.stop();
        game.dispose();
        expect(order).toEqual(["first:build", "second:build"]);
    });

    test("rejects registering the same Module instance twice", () => {
        const module = new RecordingModule("single", []);
        const builder = new GameBuilder().addModule(module);

        expect(() => builder.addModule(module)).toThrow(/already registered/);
    });

    test("makes a Builder terminal after a Module build error", () => {
        const builder = new GameBuilder();
        const broken: Module = {
            build(): void { throw new Error("expected module build failure"); },
        };

        expect(() => builder.addModule(broken)).toThrow(/expected module build failure/);
        expect(() => builder.build()).toThrow(/cannot be reused after a build error/);
        expect(() => builder.addModule(new RecordingModule("later", []))).toThrow(
            /cannot be reused after a build error/,
        );
    });
});
