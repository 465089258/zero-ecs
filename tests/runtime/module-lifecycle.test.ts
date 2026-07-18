import { describe, expect, test } from "@rstest/core";
import {
    defSystem,
    Ecs,
    EcsBuilder,
    type Module,
    Shutdown,
    Startup,
} from "../../src";

class LifecycleModule implements Module {
    constructor(
        private readonly name: string,
        private readonly order: string[],
    ) {}

    build(): void { this.order.push(`${this.name}:build`); }
    init(ecs: Ecs): void {
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
        const builder = new EcsBuilder();

        builder.addSystem(defSystem(Startup, () => order.push("system:startup"), []));
        builder.addSystem(defSystem(Shutdown, () => order.push("system:shutdown"), []));
        builder.addModule(first).addModule(second);
        const ecs = builder.build();

        expect(order).toEqual(["first:build", "second:build"]);
        expect(ecs.modules.slice(1)).toEqual([first, second]);

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
        const builder = new EcsBuilder().addModule(module);

        expect(() => builder.addModule(module)).toThrow(/already registered/);
    });
});
