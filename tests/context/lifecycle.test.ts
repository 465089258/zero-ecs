import { expect, test } from "@rstest/core";
import {
    EcsBuilder,
    InjectionService,
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
    expect("resources" in ecs).toBe(false);
    expect("states" in ecs).toBe(false);
    expect("services" in ecs).toBe(false);
    expect("scheduler" in ecs).toBe(false);
});

class InvalidState extends State {
    @World.inject() world!: World;
}

test("State cannot inject World", () => {
    const builder = new EcsBuilder();
    builder.addState(InvalidState);
    expect(() => builder.build()).toThrow(/cannot inject World/);
});

class RuntimeHelper {
    @World.inject() readonly world!: World;
    @Resource.inject(ConfigResource) readonly config!: ConfigResource;
    @State.inject(CounterState) readonly counter!: CounterState;
    @Service.inject(CounterService) readonly service!: CounterService;
}

function buildInjectionTestEcs(value: number) {
    const builder = new EcsBuilder();
    builder.addResource(ConfigResource, new ConfigResource(value));
    builder.addState(CounterState);
    builder.addService(CounterService);
    return builder.build();
}

test("InjectionService is the single dynamic injection entry", () => {
    const ecs = buildInjectionTestEcs(21);
    const injection = ecs.service(InjectionService);
    const helper = new RuntimeHelper();

    expect(injection.inject(helper)).toBe(helper);
    expect(injection.inject(helper)).toBe(helper);
    expect(helper.world).toBe(ecs.world);
    expect(helper.config).toBe(ecs.resource(ConfigResource));
    expect(helper.counter).toBe(ecs.state(CounterState));
    expect(helper.service).toBe(ecs.service(CounterService));
    expect("inject" in ecs.world).toBe(false);

    ecs.dispose();
    expect(() => injection.inject(new RuntimeHelper())).toThrow(/has not been bound/);
});

test("InjectionService rejects objects already injected by another Ecs", () => {
    const first = buildInjectionTestEcs(1);
    const second = buildInjectionTestEcs(2);
    const helper = first.service(InjectionService).inject(new RuntimeHelper());

    expect(() => second.service(InjectionService).inject(helper)).toThrow(/another Ecs/);

    first.dispose();
    second.dispose();
});

const dependencyLifecycle: string[] = [];

class DependencyService extends Service {
    init(): void { dependencyLifecycle.push("dependency:init"); }
    dispose(): void { dependencyLifecycle.push("dependency:dispose"); }
}

class DependentService extends Service {
    @Service.inject(DependencyService) readonly dependency!: DependencyService;
    init(): void { dependencyLifecycle.push("dependent:init"); }
    dispose(): void { dependencyLifecycle.push("dependent:dispose"); }
}

class ThrowingDisposeService extends Service {
    dispose(): void {
        dependencyLifecycle.push("throwing:dispose");
        throw new Error("expected dispose failure");
    }
}

test("Services dispose in reverse dependency order and continue after an error", () => {
    dependencyLifecycle.length = 0;
    const ecs = new EcsBuilder()
        .addService(DependentService)
        .addService(DependencyService)
        .addService(ThrowingDisposeService)
        .build();
    ecs.init();

    expect(() => ecs.dispose()).toThrow(/expected dispose failure/);
    expect(dependencyLifecycle).toEqual([
        "dependency:init",
        "dependent:init",
        "throwing:dispose",
        "dependent:dispose",
        "dependency:dispose",
    ]);
});
