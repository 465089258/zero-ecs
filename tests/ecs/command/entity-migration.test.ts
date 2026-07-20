import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    CommandModule,
    Commands,
    GameBuilder,
    ErrorHandlerService,
    Types,
    World,
} from "@zero-ecs/game";
import { getComponentMeta } from "@zero-ecs/game/advanced";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

const enum Velocity { x }
class VelocityType implements Component<Velocity> {
    readonly [Velocity.x] = Types.F32;
}

class PlayerTagType implements Component<never> {}

function setup() {
    const ecs = new GameBuilder().addModule(new CommandModule()).build();
    ecs.init();
    ecs.start();
    return ecs;
}

describe("Game EntityCommand batching", () => {
    test("merges multiple commands for one Entity into one migration", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const create = commands.spawn();
        const entity = create.entity;
        create
            .set(PositionType, Position.x, 10)
            .set(PositionType, Position.y, 20);
        create.submit();
        ecs.update();

        let migrationCount = 0;
        const migrate = entities.migrate.bind(entities);
        entities.migrate = (...args: Parameters<World["migrate"]>): boolean => {
            migrationCount++;
            return migrate(...args);
        };

        // Both commands see the initial Archetype. The merger re-evaluates the
        // second Set after the first Remove and therefore performs an implicit Add.
        commands.entity(entity).remove(PositionType).submit();
        commands.entity(entity).set(PositionType, Position.x, 5).submit();
        ecs.update();

        expect(migrationCount).toBe(1);
        expect(entities.get(entity, PositionType, Position.x)).toBe(5);
        expect(entities.get(entity, PositionType, Position.y)).toBe(0);
    });

    test("applies idempotent Add/Remove in cross-command execution order", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const create = commands.spawn();
        const entity = create.entity;

        // The Remove command locally sees no Position, but the type has been
        // registered by the prior command and its intent is merged after Add.
        commands.entity(entity).set(PositionType, Position.x, 1).submit();
        commands.entity(entity).remove(PositionType).submit();
        ecs.update();
        expect(entities.has(entity, PositionType)).toBe(false);

        const initial = commands.entity(entity);
        initial
            .set(PositionType, Position.x, 2)
            .set(PositionType, Position.y, 3);
        initial.submit();
        ecs.update();

        // The Add command locally sees Position, but after the pending Remove it
        // creates a new zeroed instance.
        commands.entity(entity).remove(PositionType).submit();
        commands.entity(entity).add(PositionType).submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(0);
        expect(entities.get(entity, PositionType, Position.y)).toBe(0);
    });

    test("keeps the last field Set and cancels a pending plan on Despawn", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const first = commands.spawn();
        const entity = first.entity;
        first.set(PositionType, Position.x, 1);
        first.submit();
        commands.entity(entity).set(PositionType, Position.x, 2).submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(2);

        let migrationCount = 0;
        const migrate = entities.migrate.bind(entities);
        entities.migrate = (...args: Parameters<World["migrate"]>): boolean => {
            migrationCount++;
            return migrate(...args);
        };
        commands.entity(entity).set(PositionType, Position.x, 3).submit();
        commands.entity(entity).despawn().submit();
        ecs.update();

        expect(entities.valid(entity)).toBe(false);
        expect(migrationCount).toBe(0);
    });

    test("reuses flushed plan slots in later Post cycles", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const first = commands.spawn();
        const firstEntity = first.entity;
        first.set(PositionType, Position.x, 1);
        first.submit();
        ecs.update();
        const second = commands.spawn();
        const secondEntity = second.entity;
        second.set(PositionType, Position.y, 2);
        second.submit();
        ecs.update();

        expect(entities.get(firstEntity, PositionType, Position.x)).toBe(1);
        expect(entities.get(secondEntity, PositionType, Position.y)).toBe(2);
    });

    test("writes pure Set commands directly without Archetype migration", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const create = commands.spawn();
        const entity = create.entity;
        create.set(PositionType, Position.x, 1);
        create.submit();
        ecs.update();

        let migrationCount = 0;
        const migrate = entities.migrate.bind(entities);
        entities.migrate = (...args: Parameters<World["migrate"]>): boolean => {
            migrationCount++;
            return migrate(...args);
        };
        commands.entity(entity).set(PositionType, Position.x, 9).submit();
        ecs.update();

        expect(migrationCount).toBe(0);
        expect(entities.get(entity, PositionType, Position.x)).toBe(9);
    });

    test("merges a pure Set after a structural command and preserves a Set before one", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const create = commands.spawn();
        const entity = create.entity;
        create.set(PositionType, Position.x, 1);
        create.submit();
        ecs.update();

        commands.entity(entity).add(PlayerTagType).submit();
        commands.entity(entity).set(PositionType, Position.x, 2).submit();
        ecs.update();
        expect(entities.has(entity, PlayerTagType)).toBe(true);
        expect(entities.get(entity, PositionType, Position.x)).toBe(2);

        commands.entity(entity).set(PositionType, Position.x, 3).submit();
        commands.entity(entity).remove(PlayerTagType).submit();
        ecs.update();
        expect(entities.has(entity, PlayerTagType)).toBe(false);
        expect(entities.get(entity, PositionType, Position.x)).toBe(3);
    });

    test("validates every pure Set before writing any field", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.structureWriter() as World;
        const create = commands.spawn();
        const entity = create.entity;
        create
            .set(PositionType, Position.x, 1)
            .set(VelocityType, Velocity.x, 2);
        create.submit();
        ecs.update();

        const command = commands.entity(entity)
            .set(PositionType, Position.x, 10)
            .set(VelocityType, Velocity.x, 20);
        const position = getComponentMeta(entities, PositionType)!;
        entities.migrate(entity, position.mask, [position], () => {});
        const errors: unknown[] = [];
        ecs.service(ErrorHandlerService).setHandler((error, source) => {
            expect(source).toBe("entity-command");
            errors.push(error);
        });
        command.submit();
        ecs.update();

        expect(errors).toHaveLength(1);
        expect(entities.get(entity, PositionType, Position.x)).toBe(1);
        expect(entities.has(entity, VelocityType)).toBe(false);
    });
});
