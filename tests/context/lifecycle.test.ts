import { expect, test } from "@rstest/core";
import {
    EcsBuilder,
    Write,
    type Mut,
    Resource,
    Service,
    Startup,
    State,
    Update,
    World,
} from "../../src";

class ConfigResource extends Resource {
    constructor(readonly value: number) { super(); }
}

const lifecycle: string[] = [];

class TestWorld extends World {
    override init(): void { lifecycle.push("world:init"); }
}

class CounterState extends State {
    @Resource.inject(ConfigResource) readonly config!: ConfigResource;
    readonly count: number = 0;
    init(): void {
        (this as Mut<CounterState>).count = this.config.value;
        lifecycle.push("state:init");
    }
}

class CounterService extends Service {
    @World.inject() readonly world!: World;
    @Resource.inject(ConfigResource) readonly config!: ConfigResource;
    @State.inject(CounterState) readonly counter!: CounterState;
    initialized = false;
    init(): void {
        this.initialized = true;
        lifecycle.push("service:init");
    }
}

test("Ecs separates build, init, start and system updates", () => {
    lifecycle.length = 0;
    function startup(service: CounterService): void {
        expect(service.initialized).toBe(true);
        lifecycle.push("startup");
    }
    function increment(counter: Mut<CounterState>): void {
        counter.count += 2;
        lifecycle.push("update");
    }

    const config = new ConfigResource(10);
    const builder = new EcsBuilder();
    builder.setWorld(new TestWorld());
    builder.addResource(ConfigResource, config);
    builder.addSystem(Startup, startup, [CounterService]);
    builder.addSystem(Update.fixed, increment, [Write(CounterState)]);
    const ecs = builder.build();

    expect(lifecycle).toEqual([]);
    expect(() => ecs.start()).toThrow(/invalid during phase Built/);

    ecs.init();
    expect(lifecycle).toEqual(["world:init", "state:init", "service:init"]);
    const service = ecs.service(CounterService);
    expect(service.world).toBe(ecs.world);
    expect(service.config).toBe(config);
    expect(service.counter).toBe(ecs.state(CounterState));

    ecs.start();
    ecs.update();
    expect(lifecycle).toEqual(["world:init", "state:init", "service:init", "startup", "update"]);
    expect(ecs.state(CounterState).count).toBe(12);
    expect(() => ecs.resources.add(ConfigResource, config)).toThrow(/locked/);
});

class InvalidState extends State {
    @World.inject() world!: World;
}

test("State cannot inject World", () => {
    const builder = new EcsBuilder();
    builder.addState(InvalidState);
    expect(() => builder.build()).toThrow(/cannot inject World/);
});
