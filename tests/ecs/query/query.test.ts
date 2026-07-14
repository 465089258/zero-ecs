import { describe, expect, test } from "@rstest/core";
import {
    All,
    Any,
    ArchetypeService,
    type Component,
    ComponentService,
    defineComponentMeta,
    EcsBuilder,
    Optional,
    QueryService,
    QueryType,
    Types,
    With,
    Without,
} from "../../../src/advanced";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}
const enum Player { level }
class PlayerType implements Component<Player> { readonly [Player.level] = Types.U16; }
class DeathTagType implements Component<never> {}

function setup() {
    const ecs = new EcsBuilder().build();
    ecs.init();
    return ecs;
}

describe("QueryType and QueryIter", () => {
    test("returns optional component columns as a table-level undefined", () => {
        const ecs = setup();
        const components = ecs.service(ComponentService);
        const archetypes = ecs.service(ArchetypeService);
        const position = defineComponentMeta(components, PositionType);
        const player = defineComponentMeta(components, PlayerType);
        const death = defineComponentMeta(components, DeathTagType);

        const queryType = QueryType.from(All(
            With(PositionType),
            Optional(PlayerType),
            Without(DeathTagType),
        ));
        const query = ecs.service(QueryService).create(queryType);

        const positionArch = archetypes.getOrNewAtMask(position.mask, [position]);
        const first = positionArch.insert(1 as never);
        positionArch.setField(first, position.id, Position.x, 10);

        const playerMask = position.mask.or(player.mask);
        const playerArch = archetypes.getOrNewAtMask(playerMask, [position, player]);
        const second = playerArch.insert(2 as never);
        playerArch.setField(second, player.id, Player.level, 7);

        const deathMask = position.mask.or(death.mask);
        const deathArch = archetypes.getOrNewAtMask(deathMask, [position, death]);
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
        const components = ecs.service(ComponentService);
        const archetypes = ecs.service(ArchetypeService);
        const position = defineComponentMeta(components, PositionType);
        const player = defineComponentMeta(components, PlayerType);

        const emptyArchetype = archetypes.getOrNewAtMask(position.mask, [position]);
        const emptyRow = emptyArchetype.insert(1 as never);
        emptyArchetype.remove(emptyRow);

        const populatedArchetype = archetypes.getOrNewAtMask(position.mask.or(player.mask), [position, player]);
        populatedArchetype.insert(2 as never);

        const iter = ecs.service(QueryService).create(QueryType.from(With(PositionType))).iter();
        expect(iter.next()).toBe(true);
        expect(iter.current[0]).toBe(1);
        expect(iter.current[1][0]).toBe(2);
        expect(iter.next()).toBe(false);
    });

    test("rejects Optional inside Any", () => {
        const ecs = setup();
        const type = QueryType.from(Any(With(PositionType), Optional(PlayerType)));
        expect(() => ecs.service(QueryService).create(type)).toThrow(/Optional cannot be used inside Any/);
    });
});
