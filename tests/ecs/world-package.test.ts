import { expect, test } from "@rstest/core";
import {
    Allocator,
    QueryType,
    Types,
    With,
    World,
    type Component,
} from "@zero-ecs/world";

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

test("@zero-ecs/world runs transactions and queries without Game or Scheduler", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const entity = world.reserveEntity();
    const command = world.createEntityCommand(entity)
        .set(PositionType, Position.x, 7);

    expect(world.applyEntityCommand(command)).toBe(true);
    const query = world.query(QueryType.from(With(PositionType)));
    const iter = query.iter();
    expect(iter.next()).toBe(true);
    expect(iter.current[0]).toBe(1);
    expect(iter.next()).toBe(false);
    expect(world.get(entity, PositionType, Position.x)).toBe(7);

    world.dispose();
    allocator.clear();
});
