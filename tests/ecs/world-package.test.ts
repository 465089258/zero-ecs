import { expect, test } from "@rstest/core";
import {
    Allocator,
    EntityRef,
    QueryType,
    Types,
    With,
    World,
    type Component,
    type Entity,
} from "@zero-ecs/world";

const enum Position { x }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
}

const enum Link { target }
class LinkType implements Component<Link> {
    readonly [Link.target] = Types.Entity;
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

test("EntityRef is a World-bound low-frequency read view without structural capabilities", () => {
    const allocator = new Allocator();
    const otherAllocator = new Allocator();
    const world = new World(allocator);
    const otherWorld = new World(otherAllocator);
    const entity = world.reserveEntity();
    const otherEntity = otherWorld.reserveEntity();
    world.applyEntityCommand(
        world.createEntityCommand(entity).set(PositionType, Position.x, 12),
    );

    const ref = world.ref(entity);
    const same = world.ref(entity);
    const other = otherWorld.ref(otherEntity);
    expect(ref).toBeInstanceOf(EntityRef);
    expect(ref.entity).toBe(entity);
    expect(ref.valid).toBe(true);
    expect(ref.has(PositionType)).toBe(true);
    expect(ref.get(PositionType, Position.x)).toBe(12);
    expect(ref.equals(same)).toBe(true);
    expect(ref.equals(other)).toBe(false);
    expect("despawn" in ref).toBe(false);
    expect("set" in ref).toBe(false);

    expect(world.despawn(entity)).toBe(true);
    expect(ref.valid).toBe(false);
    expect(ref.has(PositionType)).toBe(false);
    expect(ref.get(PositionType, Position.x)).toBeNull();
    expect(ref.equals(same)).toBe(true);

    world.dispose();
    otherWorld.dispose();
    allocator.clear();
    otherAllocator.clear();
});

test("Types.Entity keeps Uint32 storage while exposing branded entity values", () => {
    const allocator = new Allocator();
    const world = new World(allocator);
    const target = world.reserveEntity();
    const source = world.reserveEntity();
    world.applyEntityCommand(world.createEntityCommand(target).add(PositionType));
    world.applyEntityCommand(
        world.createEntityCommand(source).set(LinkType, Link.target, target),
    );

    const typedTarget: Entity | null = world.get(source, LinkType, Link.target);
    expect(typedTarget).toBe(target);
    expect(world.ref(source).get(LinkType, Link.target)).toBe(target);

    const iter = world.query(QueryType.from(With(LinkType))).iter();
    expect(iter.next()).toBe(true);
    const [, , links] = iter.current;
    const queriedTarget: Entity = links[Link.target][0];
    expect(queriedTarget).toBe(target);
    expect(links[Link.target]).toBeInstanceOf(Uint32Array);

    world.dispose();
    allocator.clear();
});
