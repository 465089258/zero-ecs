import { describe, expect, test } from "@rstest/core";
import {
    defSystem,
    Game,
    GameBuilder,
    type Module,
    Shutdown,
    Startup,
} from "@zero-ecs/game";

class LifecycleModule implements Module {
    constructor(
        private readonly name: string,
        private readonly order: string[],
    ) {}

    build(): void { this.order.push(`${this.name}:build`); }
    init(ecs: Game): void {
        expect(ecs.modules).toContain(this);
        this.order.push(`${this.name}:init`);
    }
    start(): void { this.order.push(`${this.name}:start`); }
    stop(): void { this.order.push(`${this.name}:stop`); }
    dispose(): void { this.order.push(`${this.name}:dispose`); }
}

describe("Module lifecycle", () => {
    test("runs forward init/start and reverse stop/dispose around lifecycle systems", () => {
        const order: string[] = [];
        const first = new LifecycleModule("first", order);
        const second = new LifecycleModule("second", order);
        const builder = new GameBuilder();

        builder.addSystem(defSystem(Startup, () => order.push("system:startup"), []));
        builder.addSystem(defSystem(Shutdown, () => order.push("system:shutdown"), []));
        builder.addModule(first).addModule(second);
        const ecs = builder.build();

        expect(order).toEqual(["first:build", "second:build"]);
        expect(ecs.modules).toEqual([first, second]);

        ecs.init();
        ecs.start();
        ecs.stop();
        ecs.dispose();
        ecs.dispose();

        expect(order).toEqual([
            "first:build",
            "second:build",
            "first:init",
            "second:init",
            "system:startup",
            "first:start",
            "second:start",
            "second:stop",
            "first:stop",
            "system:shutdown",
            "second:dispose",
            "first:dispose",
        ]);
    });

    test("rejects registering the same Module instance twice", () => {
        const module = new LifecycleModule("single", []);
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
        expect(() => builder.addModule(new LifecycleModule("later", []))).toThrow(
            /cannot be reused after a build error/,
        );
    });
});
