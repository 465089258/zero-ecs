import { describe, expect, test } from "@rstest/core";
import {
    All,
    Allocator,
    Any,
    type Component,
    type ComponentMeta,
    defineComponentMeta,
    GameBuilder,
    type IArchetypeSource,
    type IComponentResolver,
    Optional,
    Query,
    QueryType,
    Types,
    With,
    Without,
    World,
} from "@zero-ecs/game/advanced";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}
const enum Player { level }
class PlayerType implements Component<Player> { readonly [Player.level] = Types.U16; }
class DeathTagType implements Component<never> {}

function setup() {
    const ecs = new GameBuilder().build();
    ecs.init();
    return ecs;
}

describe("QueryType and QueryIter", () => {
    test("returns optional component columns as a table-level undefined", () => {
        const ecs = setup();
        const world = ecs.world;
        const position = defineComponentMeta(world, PositionType);
        const player = defineComponentMeta(world, PlayerType);
        const death = defineComponentMeta(world, DeathTagType);

        const queryType = QueryType.from(All(
            With(PositionType),
            Optional(PlayerType),
            Without(DeathTagType),
        ));
        const query = world.query(queryType);

        const positionArch = world.getOrCreateArchetype(position.mask, [position]);
        const first = positionArch.insert(1 as never);
        positionArch.setField(first, position.id, Position.x, 10);

        const playerMask = position.mask.or(player.mask);
        const playerArch = world.getOrCreateArchetype(playerMask, [position, player]);
        const second = playerArch.insert(2 as never);
        playerArch.setField(second, player.id, Player.level, 7);

        const deathMask = position.mask.or(death.mask);
        const deathArch = world.getOrCreateArchetype(deathMask, [position, death]);
        deathArch.insert(3 as never);

        const iter = query.iter();
        expect(iter.next()).toBe(true);
        let [count, entities, positions, players] = iter.current;
        expect(count).toBe(1);
        expect(entities[0]).toBe(1);
        expect(positions[Position.x][0]).toBe(10);
        expect(players).toBeUndefined();

        expect(iter.next()).toBe(true);
        [count, entities, positions, players] = iter.current;
        expect(entities[0]).toBe(2);
        expect(players?.[Player.level][0]).toBe(7);
        expect(iter.next()).toBe(false);
    });

    test("skips empty tables while advancing the reused current field", () => {
        const ecs = setup();
        const world = ecs.world;
        const position = defineComponentMeta(world, PositionType);
        const player = defineComponentMeta(world, PlayerType);

        const emptyArchetype = world.getOrCreateArchetype(position.mask, [position]);
        const emptyRow = emptyArchetype.insert(1 as never);
        emptyArchetype.remove(emptyRow);

        const populatedArchetype = world.getOrCreateArchetype(position.mask.or(player.mask), [position, player]);
        populatedArchetype.insert(2 as never);

        const iter = world.query(QueryType.from(With(PositionType))).iter();
        expect(iter.next()).toBe(true);
        expect(iter.current[0]).toBe(1);
        expect(iter.current[1][0]).toBe(2);
        expect(iter.next()).toBe(false);
    });

    test("keeps the stable iter path independent of matched Archetype count", () => {
        const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
        const world = new World(allocator);
        const position = defineComponentMeta(world, PositionType);
        const archetype = world.getOrCreateArchetype(position.mask, [position]);
        archetype.insert(1 as never);

        let archetypeReads = 0;
        let archetypeVersionReads = 0;
        const observed = new Proxy(archetype, {
            get(target, key, receiver) {
                if (key === "version") archetypeVersionReads++;
                return Reflect.get(target, key, receiver);
            },
        });
        const source: IArchetypeSource = {
            version: 1,
            layoutVersion: archetype.version,
            get archetypes() {
                archetypeReads++;
                return [observed];
            },
        };
        const resolver = {
            defQueryMeta: () => position as ComponentMeta<object>,
        } as IComponentResolver;
        const query = new Query(QueryType.from(With(PositionType)), resolver, source);

        archetypeReads = 0;
        archetypeVersionReads = 0;
        query.iter();
        query.iter();

        expect(archetypeReads).toBe(0);
        expect(archetypeVersionReads).toBe(0);
        world.dispose();
        allocator.clear();
    });

    test("incrementally releases and reuses Query Chunk entries", () => {
        const allocator = new Allocator({ bufferByteLength: 64, blockByteLength: 256 });
        const world = new World(allocator);
        const position = defineComponentMeta(world, PositionType);
        const archetype = world.getOrCreateArchetype(position.mask, [position]);
        const capacity = archetype.chunkCapacity;
        let count = 0;
        const insert = (): void => { archetype.insert(++count as never); };
        const removeLast = (): void => {
            const ordinal = --count;
            archetype.remove(archetype.locationAt(
                Math.floor(ordinal / capacity),
                ordinal % capacity,
            ));
        };

        insert();
        const query = world.query(QueryType.from(With(PositionType)));
        while (count < capacity * 2 + 1) insert();

        let iter = query.iter();
        const currents = [] as unknown[];
        while (iter.next()) currents.push(iter.current);
        expect(currents).toHaveLength(3);

        while (count > capacity) removeLast();
        iter = query.iter();
        expect(iter.next()).toBe(true);
        expect(iter.current[0]).toBe(capacity);
        expect(iter.next()).toBe(false);

        while (count < capacity * 2 + 1) insert();
        iter = query.iter();
        let chunkIndex = 0;
        while (iter.next()) {
            if (chunkIndex === 2) expect(iter.current).toBe(currents[2]);
            chunkIndex++;
        }
        expect(chunkIndex).toBe(3);

        world.dispose();
        allocator.clear();
    });

    test("rejects Optional inside Any", () => {
        const ecs = setup();
        const type = QueryType.from(Any(With(PositionType), Optional(PlayerType)));
        expect(() => ecs.world.query(type)).toThrow(/Optional cannot be used inside Any/);
    });
});
