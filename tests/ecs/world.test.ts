import { expect, test } from "@rstest/core";
import {
    type Component,
    defSystem,
    GameBuilder,
    GamePhase,
    Inject,
    Service,
    Shutdown,
    Startup,
    State,
    Types,
    Update,
    With,
    World,
    type WorldView,
    QueryType,
} from "@zero-ecs/game";
import {
    Allocator,
    AllocatorService,
    unsafeStructureWriter,
} from "@zero-ecs/game/advanced";
import type { Entity } from "@zero-ecs/game";

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

test("World requires its owner to provide an Allocator", () => {
    expect(() => new World(undefined as never)).toThrow(/requires an IAllocator/);
});

test("World applies standalone EntityCommands and rejects cross-World reuse", () => {
    const firstAllocator = new Allocator();
    const secondAllocator = new Allocator();
    const first = new World(firstAllocator);
    const second = new World(secondAllocator);
    const entity = first.reserveEntity();
    const command = first.createEntityCommand(entity)
        .set(PositionType, Position.x, 12);

    expect(command.get(PositionType, Position.x)).toBe(12);
    expect(() => second.applyEntityCommand(command)).toThrow(/another World/);
    expect(first.applyEntityCommand(command)).toBe(true);
    expect(first.get(entity, PositionType, Position.x)).toBe(12);
    expect(() => command.set(PositionType, Position.x, 13)).toThrow(/already been applied/);
    expect(() => first.applyEntityCommand(command)).toThrow(/already been applied/);

    first.dispose();
    second.dispose();
    firstAllocator.clear();
    secondAllocator.clear();
});

test("World is an immediately usable entity kernel and writer views reuse it", () => {
    const game = new GameBuilder().build();
    expect(game.world.valid(0 as Entity)).toBe(false);
    expect(game.structureWriter()).toBe(game.world);
    expect(unsafeStructureWriter(game.world)).toBe(game.world);

    const entity = game.world.reserveEntity();
    expect(game.world.valid(entity)).toBe(true);
    expect(game.world.despawn(entity)).toBe(true);
    expect(game.world.valid(entity)).toBe(false);
    game.dispose();
});

class WorldAwareService extends Service {
    @Inject.world() readonly world!: WorldView;
    initialized = false;
    activated = false;

    init(): void { this.initialized = this.world.valid(0 as Entity) === false; }
    activate(): void { this.activated = this.world.valid(0 as Entity) === false; }
}

test("World is usable throughout Service init and activate", () => {
    const game = new GameBuilder().addService(WorldAwareService).build();
    game.init();
    const service = game.service(WorldAwareService);
    expect(service.initialized).toBe(true);
    expect(service.activated).toBe(true);
    game.dispose();
});

test("AllocatorService exposes the exact allocator used by the default World", () => {
    const game = new GameBuilder().build();
    const memory = game.service(AllocatorService);
    const allocator = memory.allocator;
    expect("bindAllocator" in memory).toBe(false);
    expect(allocator).toBe(game.world.allocator);
    expect(allocator.stats().allocatedBuffers).toBeGreaterThan(0);
    game.dispose();
    expect(allocator.stats().allocatedBuffers).toBe(0);
    expect(allocator.stats().blockCount).toBe(0);
});

test("an externally supplied allocator is borrowed and remains usable after World disposal", () => {
    const allocator = new Allocator({
        bufferByteLength: 8 * 1024,
        blockByteLength: 512 * 1024,
    });
    const game = new GameBuilder().setAllocator(allocator).build();
    expect(game.world.allocator).toBe(allocator);
    expect(game.service(AllocatorService).allocator).toBe(allocator);
    expect(game.service(AllocatorService).config).toBe(allocator.config);
    game.dispose();

    expect(allocator.stats().allocatedBuffers).toBe(0);
    expect(allocator.stats().blockCount).toBeGreaterThan(0);
    const buffer = allocator.alloc();
    buffer.dispose();
    allocator.trim();
    allocator.clear();
});

test("a custom World and a Builder allocator are mutually exclusive", () => {
    const allocator = new Allocator();
    const firstWorld = new World(allocator);
    const secondWorld = new World(allocator);
    expect(() => new GameBuilder().setWorld(firstWorld).setAllocator(allocator)).toThrow(/after setting a World/);
    expect(() => new GameBuilder().setAllocator(allocator).setWorld(secondWorld)).toThrow(/after configuring an allocator/);
    firstWorld.dispose();
    secondWorld.dispose();
    allocator.clear();
});

test("a claimed or disposed World cannot be adopted by another Game", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const first = new GameBuilder().setWorld(world).build();
    expect(() => new GameBuilder().setWorld(world).build()).toThrow(/another Game/);
    first.dispose();
    expect(() => new GameBuilder().setWorld(world).build()).toThrow(/disposed/);
    expect(allocator.stats().allocatedBuffers).toBe(0);
    expect(allocator.stats().blockCount).toBeGreaterThan(0);
    allocator.clear();
});

class InvalidWorldState extends State {
    @Inject.world() readonly world!: WorldView;
}

test("a build failure after World claim disposes the kernel", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const builder = new GameBuilder().setWorld(world).addState(InvalidWorldState);
    expect(() => builder.build()).toThrow(/cannot inject World/);
    expect(() => new GameBuilder().setWorld(world).build()).toThrow(/disposed/);
    expect(allocator.stats().allocatedBuffers).toBe(0);
    allocator.clear();
});

class DisposeWorldService extends Service {
    @Inject.world() readonly world!: WorldView;
    sawLiveWorld = false;
    dispose(): void { this.sawLiveWorld = this.world.valid(0 as Entity) === false; }
}

test("Services dispose before the World kernel", () => {
    const game = new GameBuilder().addService(DisposeWorldService).build();
    game.init();
    const service = game.service(DisposeWorldService);
    game.dispose();
    expect(service.sawLiveWorld).toBe(true);
});

test("prepare failure enters StartFailed without Startup, Shutdown or stop rollback", () => {
    const calls: string[] = [];
    const query = QueryType.from(With(PositionType));
    const builder = new GameBuilder();
    builder.addSystem(defSystem(Startup, () => calls.push("startup"), []));
    builder.addSystem(defSystem(Update.fixed, () => {}, [query]));
    builder.addSystem(defSystem(Shutdown, () => calls.push("shutdown"), []));
    const game = builder.build();
    game.init();

    game.world.query = (() => { throw new Error("expected query prepare failure"); }) as typeof game.world.query;
    expect(() => game.start()).toThrow(/query prepare failure/);
    expect(game.phase).toBe(GamePhase.StartFailed);
    expect(calls).toEqual([]);
    expect(() => game.update()).toThrow(/StartFailed/);
    game.dispose();
    expect(calls).toEqual([]);
});
