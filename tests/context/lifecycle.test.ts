import { expect, test } from "@rstest/core";
import {
    defSystem,
    ErrorHandlerService,
    GameBuilder,
    Inject,
    InjectionService,
    Write,
    type Mut,
    ObjectPoolService,
    definePool,
    Resource,
    Service,
    type ServiceActivateContext,
    type ServiceInitContext,
    Startup,
    State,
    Update,
    type WorldView,
} from "@zero-ecs/game";

interface PooledValue { value: number }
const ValuePool = definePool<PooledValue>({
    name: "value",
    maxRetained: 1,
    reset: value => { value.value = 0; },
    clear: value => { value.value = -1; },
});

test("Game provides a reusable token-keyed ObjectPoolService", () => {
    const game = new GameBuilder().build();
    const pools = game.service(ObjectPoolService);
    pools.bind(ValuePool, () => ({ value: 5 }));
    const first = pools.acquire(ValuePool);
    expect(first.value).toBe(0);
    first.value = 9;
    pools.release(ValuePool, first);
    expect(first.value).toBe(-1);
    expect(pools.acquire(ValuePool)).toBe(first);
    game.dispose();
});

class ConfigResource extends Resource {
    constructor(readonly value: number) { super(); }
}

const lifecycle: string[] = [];

class CounterState extends State {
    @Resource.inject(ConfigResource) readonly config!: ConfigResource;
    readonly count: number = 0;
    init(): void {
        (this as Mut<CounterState>).count = this.config.value;
        lifecycle.push("state:init");
    }
}

class CounterService extends Service {
    @Inject.world() readonly world!: WorldView;
    @Resource.inject(ConfigResource) readonly config!: ConfigResource;
    @State.inject(CounterState) readonly counter!: CounterState;
    initialized = false;
    init(): void {
        this.initialized = true;
        lifecycle.push("service:init");
    }
}

class ConstructedService extends Service {
    constructor(readonly source: string, readonly builtWorld?: WorldView) { super(); }
}

test("GameBuilder accepts Service instances and cold-path factories", () => {
    const existing = new ConstructedService("instance");
    const instanceGame = new GameBuilder()
        .setService(ConstructedService, existing)
        .build();
    expect(instanceGame.service(ConstructedService)).toBe(existing);
    instanceGame.dispose();

    let factoryCalls = 0;
    const factoryGame = new GameBuilder()
        .setServiceFactory(ConstructedService, context => {
            factoryCalls++;
            return new ConstructedService("factory", context.world);
        })
        .build();
    expect(factoryCalls).toBe(1);
    expect(factoryGame.service(ConstructedService).source).toBe("factory");
    expect(factoryGame.service(ConstructedService).builtWorld).toBe(factoryGame.world);
    factoryGame.dispose();
});

test("Game separates build, init, start and system updates", () => {
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
    const builder = new GameBuilder();
    builder.addResource(ConfigResource, config);
    builder.addState(CounterState);
    builder.addService(CounterService);
    builder.addSystem(defSystem(Startup, startup, [CounterService]));
    builder.addSystem(defSystem(Update.fixed, increment, [Write(CounterState)]));
    const ecs = builder.build();

    expect(lifecycle).toEqual([]);
    expect(() => ecs.start()).toThrow(/invalid during phase Built/);

    ecs.init();
    expect(lifecycle).toEqual(["state:init", "service:init"]);
    const service = ecs.service(CounterService);
    expect(service.world).toBe(ecs.world);
    expect(service.config).toBe(config);
    expect(service.counter).toBe(ecs.state(CounterState));

    ecs.start();
    ecs.update();
    expect(lifecycle).toEqual(["state:init", "service:init", "startup", "update"]);
    expect(ecs.state(CounterState).count).toBe(12);
    expect("resources" in ecs).toBe(false);
    expect("states" in ecs).toBe(false);
    expect("services" in ecs).toBe(false);
    expect("scheduler" in ecs).toBe(false);
});

class InvalidState extends State {
    @Inject.world() world!: WorldView;
}

test("State cannot inject World", () => {
    const builder = new GameBuilder();
    builder.addState(InvalidState);
    expect(() => builder.build()).toThrow(/cannot inject World/);
});

class RuntimeHelper {
    @Inject.world() readonly world!: WorldView;
    @Resource.inject(ConfigResource) readonly config!: ConfigResource;
    @State.inject(CounterState) readonly counter!: CounterState;
    @Service.inject(CounterService) readonly service!: CounterService;
}

function buildInjectionTestGame(value: number) {
    const builder = new GameBuilder();
    builder.addResource(ConfigResource, new ConfigResource(value));
    builder.addState(CounterState);
    builder.addService(CounterService);
    return builder.build();
}

test("InjectionService is the single dynamic injection entry", () => {
    const ecs = buildInjectionTestGame(21);
    const injection = ecs.service(InjectionService);
    const helper = new RuntimeHelper();

    expect("bind" in injection).toBe(false);

    expect(injection.inject(helper)).toBe(helper);
    expect(injection.inject(helper)).toBe(helper);
    expect(helper.world).toBe(ecs.world);
    expect(helper.config).toBe(ecs.resource(ConfigResource));
    expect(helper.counter).toBe(ecs.state(CounterState));
    expect(helper.service).toBe(ecs.service(CounterService));
    expect("inject" in ecs.world).toBe(false);

    ecs.dispose();
    expect(() => injection.inject(new RuntimeHelper())).toThrow(/disposed/);
});

test("InjectionService rejects objects already injected by another Game", () => {
    const first = buildInjectionTestGame(1);
    const second = buildInjectionTestGame(2);
    const helper = first.service(InjectionService).inject(new RuntimeHelper());

    expect(() => second.service(InjectionService).inject(helper)).toThrow(/another Game/);

    first.dispose();
    second.dispose();
});

const overrideLifecycle: string[] = [];

class CustomErrorHandlerService extends ErrorHandlerService {
    init(): void { overrideLifecycle.push("error:init"); }
}

class ErrorHandlerConsumerService extends Service {
    @Service.inject(ErrorHandlerService) readonly errors!: ErrorHandlerService;

    init(): void {
        expect(this.errors).toBeInstanceOf(CustomErrorHandlerService);
        overrideLifecycle.push("consumer:init");
    }
}

test("Service implementation types override a registration token", () => {
    overrideLifecycle.length = 0;
    const game = new GameBuilder()
        .addService(CustomErrorHandlerService)
        .addService(ErrorHandlerConsumerService)
        .build();

    expect(game.service(ErrorHandlerService)).toBeInstanceOf(CustomErrorHandlerService);
    expect(() => game.service(Service as unknown as typeof ErrorHandlerService)).toThrow(/Instance not found/);
    game.init();
    expect(overrideLifecycle).toEqual(["error:init", "consumer:init"]);
    game.dispose();
});

class BaseResource extends Resource {}
class CustomResource extends BaseResource {}
class BaseState extends State {}
class CustomState extends BaseState {}

test("containers expose subclass instances through parent tokens but exclude domain roots", () => {
    const resource = new CustomResource();
    const game = new GameBuilder()
        .addResource(CustomResource, resource)
        .addState(CustomState)
        .build();

    expect(game.resource(CustomResource)).toBe(resource);
    expect(game.resource(BaseResource)).toBe(resource);
    expect(game.state(CustomState)).toBeInstanceOf(CustomState);
    expect(game.state(BaseState)).toBe(game.state(CustomState));
    expect(() => game.resource(Resource as unknown as typeof BaseResource)).toThrow(/Instance not found/);
    expect(() => game.state(State as unknown as typeof BaseState)).toThrow(/Instance not found/);
    game.dispose();
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
    const ecs = new GameBuilder()
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

const phaseLifecycle: string[] = [];
let expiredInitContext: ServiceInitContext;
let expiredActivateContext: ServiceActivateContext;

class PhaseDependencyService extends Service {
    initialized = false;

    init(): void {
        this.initialized = true;
        phaseLifecycle.push("dependency:init");
    }

    activate(): void { phaseLifecycle.push("dependency:activate"); }
    start(): void { phaseLifecycle.push("dependency:start"); }
    stop(): void { phaseLifecycle.push("dependency:stop"); }
    dispose(): void { phaseLifecycle.push("dependency:dispose"); }
}

class PhaseConsumerService extends Service {
    init(context: ServiceInitContext): void {
        expiredInitContext = context;
        expect(context.resource(ConfigResource).value).toBe(7);
        expect(context.state(CounterState).count).toBe(7);
        phaseLifecycle.push("consumer:init");
    }

    activate(context: ServiceActivateContext): void {
        expiredActivateContext = context;
        expect(context.service(PhaseDependencyService).initialized).toBe(true);
        phaseLifecycle.push("consumer:activate");
    }

    start(): void { phaseLifecycle.push("consumer:start"); }
    stop(): void { phaseLifecycle.push("consumer:stop"); }
    dispose(): void { phaseLifecycle.push("consumer:dispose"); }
}

test("Service init, activate and start form barriers with scoped lookup contexts", () => {
    phaseLifecycle.length = 0;
    const builder = new GameBuilder()
        .addResource(ConfigResource, new ConfigResource(7))
        .addState(CounterState)
        .addService(PhaseConsumerService)
        .addService(PhaseDependencyService);
    builder.addSystem(defSystem(Startup, () => phaseLifecycle.push("startup"), []));
    const ecs = builder.build();

    ecs.init();
    expect(phaseLifecycle).toEqual([
        "consumer:init",
        "dependency:init",
        "consumer:activate",
        "dependency:activate",
    ]);
    expect(() => expiredInitContext.resource(ConfigResource)).toThrow(/no longer active/);
    expect(() => expiredActivateContext.service(PhaseDependencyService)).toThrow(/no longer active/);

    ecs.start();
    expect(phaseLifecycle.slice(4)).toEqual([
        "startup",
        "dependency:start",
        "consumer:start",
    ]);

    ecs.stop();
    ecs.dispose();
    expect(phaseLifecycle.slice(7)).toEqual([
        "consumer:stop",
        "dependency:stop",
        "consumer:dispose",
        "dependency:dispose",
    ]);
});
