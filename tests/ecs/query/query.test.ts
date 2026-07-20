import { describe, expect, test } from "@rstest/core";
import {
    All,
    Any,
    type Component,
    defineComponentMeta,
    GameBuilder,
    Optional,
    QueryType,
    Types,
    With,
    Without,
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

    test("rejects Optional inside Any", () => {
        const ecs = setup();
        const type = QueryType.from(Any(With(PositionType), Optional(PlayerType)));
        expect(() => ecs.world.query(type)).toThrow(/Optional cannot be used inside Any/);
    });
});
