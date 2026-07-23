import { expect, test } from "@rstest/core";
import {
    Allocator,
    defineQueryProjection,
    QueryType,
    Types,
    With,
    World,
    type Component,
    type ComponentTag,
    type Entity,
    type EntityAccess,
} from "@zero-ecs/world";

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

const enum Link { target }
class LinkType implements Component<Link> {
    readonly [Link.target] = Types.Entity;
}

class HiddenTagType implements ComponentTag {}
const VisibleTag = defineQueryProjection<ComponentTag>(HiddenTagType, "VisibleTag");

test("@zero-ecs/world runs immediate migration and queries without Game or Scheduler", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const entity = world.spawn();
    const position = world.component(PositionType);

    expect(world.migrate(entity, position.mask, [position], (archetype, row) => {
        archetype.setField(row, position.id, Position.x, 7);
    })).toBe(true);
    const query = world.query(QueryType.from(With(PositionType)));
    const iter = query.iter();
    expect(iter.next()).toBe(true);
    expect(iter.current[0]).toBe(1);
    expect(iter.next()).toBe(false);
    expect(world.get(entity, PositionType, Position.x)).toBe(7);
    const access: EntityAccess = { archetype: null, row: 0 as never };
    expect(world.resolve(entity, access)).toBe(true);
    expect(access.archetype).not.toBeNull();

    world.dispose();
    allocator.clear();
});

test("Types.Entity keeps Uint32 storage while exposing branded entity values", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const target = world.spawn();
    const source = world.spawn();
    const position = world.component(PositionType);
    const link = world.component(LinkType);
    world.migrate(target, position.mask, [position], () => {});
    world.migrate(source, link.mask, [link], (archetype, row) => {
        archetype.setField(row, link.id, Link.target, target);
    });

    const typedTarget: Entity | null = world.get(source, LinkType, Link.target);
    expect(typedTarget).toBe(target);

    const iter = world.query(QueryType.from(With(LinkType))).iter();
    expect(iter.next()).toBe(true);
    const [, , links] = iter.current;
    const queriedTarget: Entity = links[Link.target][0];
    expect(queriedTarget).toBe(target);
    expect(links[Link.target]).toBeInstanceOf(Uint32Array);

    world.dispose();
    allocator.clear();
});

test("QueryProjection resolves its hidden storage without a per-World registration", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const entity = world.spawn();
    const hidden = world.component(HiddenTagType);
    world.migrate(entity, hidden.mask, [hidden], () => {});

    const iter = world.query(QueryType.from(With(VisibleTag))).iter();
    expect(iter.next()).toBe(true);
    expect(iter.current[0]).toBe(1);

    world.dispose();
    allocator.clear();
});
