import { describe, expect, test } from "@rstest/core";
import {
    Allocator,
    INVALID_ENTITY,
    QueryType,
    With,
    World,
    type Entity,
} from "@zero-ecs/world";
import {
    CommandModule,
    Commands,
    ErrorHandlerService,
    GameBuilder,
} from "@zero-ecs/game";
import {
    ChildOf,
    HierarchyModule,
    HierarchyService,
    ParentOf,
} from "@zero-ecs/game/hierarchy";

function createGame() {
    const allocator = new Allocator();
    const world = new World(allocator);
    const game = new GameBuilder()
        .setWorld(world)
        .addModule(new CommandModule())
        .addModule(new HierarchyModule())
        .build();
    game.init();
    game.start();
    return { allocator, world, game };
}

function spawn(commands: Commands): Entity {
    const command = commands.spawn();
    const entity = command.entity;
    command.submit();
    return entity;
}

function queryEntities(world: World, type: typeof ChildOf | typeof ParentOf): Entity[] {
    const result: Entity[] = [];
    const iter = world.query(QueryType.from(With(type))).iter();
    while (iter.next()) {
        const [count, entities] = iter.current;
        for (let i = 0; i < count; i++) result.push(entities[i]);
    }
    return result;
}

describe("optional hierarchy module", () => {
    test("commits parent edges and exposes readonly ChildOf/ParentOf projections", () => {
        const { allocator, world, game } = createGame();
        const commands = game.service(Commands);
        const hierarchy = game.service(HierarchyService);
        const parent = spawn(commands);
        const first = spawn(commands);
        const second = spawn(commands);
        game.update();

        hierarchy.setParent(first, parent);
        hierarchy.setParent(second, parent);
        expect(hierarchy.parentOf(first)).toBe(INVALID_ENTITY);
        game.update();

        expect(hierarchy.parentOf(first)).toBe(parent);
        expect(hierarchy.parentOf(second)).toBe(parent);
        expect(hierarchy.firstChildOf(parent)).toBe(first);
        expect(hierarchy.lastChildOf(parent)).toBe(second);
        expect(hierarchy.nextSiblingOf(first)).toBe(second);
        expect(hierarchy.previousSiblingOf(second)).toBe(first);
        expect(queryEntities(world, ChildOf).sort()).toEqual([first, second].sort());
        expect(queryEntities(world, ParentOf)).toEqual([parent]);

        game.dispose();
        allocator.clear();
    });

    test("recursively despawns descendants by default", () => {
        const { allocator, world, game } = createGame();
        const commands = game.service(Commands);
        const hierarchy = game.service(HierarchyService);
        const root = spawn(commands);
        const child = spawn(commands);
        const grandchild = spawn(commands);
        game.update();
        hierarchy.setParent(child, root);
        hierarchy.setParent(grandchild, child);
        game.update();

        commands.entity(root).despawn().submit();
        game.update();

        expect(world.valid(root)).toBe(false);
        expect(world.valid(child)).toBe(false);
        expect(world.valid(grandchild)).toBe(false);
        game.dispose();
        allocator.clear();
    });

    test("removing or changing the parent before commit rescues a subtree", () => {
        const { allocator, world, game } = createGame();
        const commands = game.service(Commands);
        const hierarchy = game.service(HierarchyService);
        const oldParent = spawn(commands);
        const newParent = spawn(commands);
        const detached = spawn(commands);
        const reparented = spawn(commands);
        game.update();
        hierarchy.setParent(detached, oldParent);
        hierarchy.setParent(reparented, oldParent);
        game.update();

        hierarchy.removeParent(detached);
        hierarchy.setParent(reparented, newParent);
        commands.entity(oldParent).despawn().submit();
        game.update();

        expect(world.valid(oldParent)).toBe(false);
        expect(world.valid(detached)).toBe(true);
        expect(world.valid(reparented)).toBe(true);
        expect(hierarchy.parentOf(detached)).toBe(INVALID_ENTITY);
        expect(hierarchy.parentOf(reparented)).toBe(newParent);
        expect(queryEntities(world, ChildOf)).toEqual([reparented]);
        expect(queryEntities(world, ParentOf)).toEqual([newParent]);
        game.dispose();
        allocator.clear();
    });

    test("rejects cycles when queued relations are committed", () => {
        const { allocator, game } = createGame();
        const commands = game.service(Commands);
        const hierarchy = game.service(HierarchyService);
        const root = spawn(commands);
        const child = spawn(commands);
        game.update();
        hierarchy.setParent(child, root);
        game.update();
        hierarchy.setParent(root, child);
        game.service(ErrorHandlerService).setHandler(error => { throw error; });

        expect(() => game.update()).toThrow(/cycle/);
        game.dispose();
        allocator.clear();
    });
});
