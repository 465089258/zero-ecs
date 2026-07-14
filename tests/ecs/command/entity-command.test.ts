import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    Command,
    CommandModule,
    CommandService,
    ComponentService,
    EcsBuilder,
    type EntityMutator,
    EntityService,
    Types,
} from "../../../src";

const enum Position { x, y }
class PositionType implements Component<Position> {
    readonly [Position.x] = Types.F32;
    readonly [Position.y] = Types.F32;
}

class PlayerTagType implements Component<never> {}

class CountCommand extends Command {
    static total = 0;
    private _value = 0;

    set(value: number): this {
        this.assertMutable();
        this._value = value;
        return this;
    }

    execute(): void { CountCommand.total += this._value; }
    protected clear(): void { this._value = 0; }
}

class ThrowCommand extends Command {
    execute(): void { throw new Error("expected command error"); }
}

function setup() {
    const ecs = new EcsBuilder().addModule(new CommandModule()).build();
    ecs.init();
    ecs.start();
    return ecs;
}

describe("unified CommandService", () => {
    test("pools ordinary commands and enforces their lifecycle", () => {
        CountCommand.total = 0;
        const ecs = setup();
        const commands = ecs.service(CommandService);
        const command = commands.cmd(CountCommand);
        command.set(3).submit();

        expect(() => command.submit()).toThrow(/already been submitted/);
        expect(() => command.set(4)).toThrow(/already been submitted/);
        ecs.update();
        expect(CountCommand.total).toBe(3);
        expect(() => command.set(4)).toThrow(/already been recycled/);

        const reused = commands.cmd(CountCommand);
        expect(reused).toBe(command);
        reused.set(2).submit();
        ecs.update();
        expect(CountCommand.total).toBe(5);
    });

    test("recycles a command even when execute throws", () => {
        const ecs = setup();
        const commands = ecs.service(CommandService);
        const errors: unknown[] = [];
        (commands as unknown as { onError(error: unknown): void }).onError = error => { errors.push(error); };
        const command = commands.cmd(ThrowCommand);
        command.submit();
        ecs.update();

        expect(errors).toHaveLength(1);
        expect(commands.cmd(ThrowCommand)).toBe(command);
    });

    test("reserves spawn IDs immediately and executes EntityCommand in the same queue", () => {
        const ecs = setup();
        const entities = ecs.service(EntityService);
        const commands = ecs.service(CommandService);
        const components = ecs.service(ComponentService);
        const command = commands.spawn();
        const entity = command.entity;

        expect(entities.valid(entity)).toBe(true);
        expect(components.get(PositionType)).toBeUndefined();
        command
            .add(PositionType)
            .set(PositionType, Position.x, 10)
            .set(PositionType, Position.y, 20)
            .add(PlayerTagType)
            .submit();
        expect(() => command.remove(PlayerTagType)).toThrow(/already been submitted/);
        ecs.update();

        expect(entities.has(entity, PositionType)).toBe(true);
        expect(entities.has(entity, PlayerTagType)).toBe(true);
        expect(entities.get(entity, PositionType, Position.x)).toBe(10);
        expect(entities.get(entity, PositionType, Position.y)).toBe(20);

        commands.entity(entity).remove(PlayerTagType).submit();
        ecs.update();
        expect(entities.has(entity, PlayerTagType)).toBe(false);
    });

    test("keeps unsubmitted EntityCommand alive and makes despawn terminal", () => {
        const ecs = setup();
        const entities = ecs.service(EntityService);
        const commands = ecs.service(CommandService);
        const command = commands.spawn();
        const entity = command.entity;
        const other = commands.entity(entity);

        expect(other).not.toBe(command);
        ecs.update();
        expect(entities.valid(entity)).toBe(true);

        command.add(PositionType).submit();
        ecs.update();
        expect(entities.has(entity, PositionType)).toBe(true);

        const despawn = commands.entity(entity).despawn();
        expect(() => despawn.add(PlayerTagType)).toThrow(/marked for despawn/);
        despawn.submit();
        ecs.update();
        expect(entities.valid(entity)).toBe(false);
    });

    test("read access does not register an unseen component", () => {
        const ecs = setup();
        const entities = ecs.service(EntityService);
        const components = ecs.service(ComponentService);
        const entity = entities.spawn();

        expect(entities.has(entity, PositionType)).toBe(false);
        expect(entities.get(entity, PositionType, Position.x)).toBeNull();
        expect(entities.view(entity, PositionType)).toBeNull();
        expect(components.get(PositionType)).toBeUndefined();
    });

    test("uses idempotent Add/Remove and Set implicitly adds a zeroed component", () => {
        const ecs = setup();
        const entities = ecs.service(EntityService);
        const commands = ecs.service(CommandService);
        const components = ecs.service(ComponentService);
        const create = commands.spawn();
        const entity = create.entity;
        create
            .set(PositionType, Position.x, 12)
            .add(PositionType)
            .remove(PlayerTagType)
            .submit();
        ecs.update();

        expect(entities.get(entity, PositionType, Position.x)).toBe(12);
        expect(entities.get(entity, PositionType, Position.y)).toBe(0);
        expect(components.get(PlayerTagType)).toBeUndefined();

        commands.entity(entity)
            .add(PositionType)
            .set(PositionType, Position.y, 8)
            .submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(12);
        expect(entities.get(entity, PositionType, Position.y)).toBe(8);
    });

    test("treats Remove then Add or Set as a fresh zeroed component", () => {
        const ecs = setup();
        const entities = ecs.service(EntityService);
        const commands = ecs.service(CommandService);
        const create = commands.spawn();
        const entity = create.entity;
        create
            .set(PositionType, Position.x, 1)
            .set(PositionType, Position.y, 2)
            .submit();
        ecs.update();

        commands.entity(entity)
            .set(PositionType, Position.x, 99)
            .remove(PositionType)
            .add(PositionType)
            .set(PositionType, Position.y, 7)
            .submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(0);
        expect(entities.get(entity, PositionType, Position.y)).toBe(7);

        commands.entity(entity)
            .remove(PositionType)
            .set(PositionType, Position.x, 5)
            .submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(5);
        expect(entities.get(entity, PositionType, Position.y)).toBe(0);
    });

    test("provides read-your-writes through a shared zero-wrapper EntityMutator view", () => {
        const ecs = setup();
        const commands = ecs.service(CommandService);
        const entities = ecs.service(EntityService);
        const command = commands.spawn();
        const entity = command.entity;

        function configurePosition(mutator: EntityMutator): EntityMutator {
            expect(mutator.has(PositionType)).toBe(false);
            expect(mutator.get(PositionType, Position.x)).toBeNull();
            mutator.set(PositionType, Position.x, 3);
            expect(mutator.has(PositionType)).toBe(true);
            expect(mutator.get(PositionType, Position.x)).toBe(3);
            expect(mutator.get(PositionType, Position.y)).toBe(0);
            mutator.remove(PositionType);
            expect(mutator.has(PositionType)).toBe(false);
            mutator.add(PositionType).set(PositionType, Position.y, 4);
            expect(mutator.get(PositionType, Position.x)).toBe(0);
            expect(mutator.get(PositionType, Position.y)).toBe(4);
            return mutator;
        }

        expect(configurePosition(command)).toBe(command);
        command.submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(0);
        expect(entities.get(entity, PositionType, Position.y)).toBe(4);
    });

    test("keeps Add-to-Remove and Set-to-Remove entities without the component", () => {
        const ecs = setup();
        const commands = ecs.service(CommandService);
        const entities = ecs.service(EntityService);
        const added = commands.spawn();
        const addedEntity = added.entity;
        added.add(PositionType).remove(PositionType).submit();
        const set = commands.spawn();
        const setEntity = set.entity;
        set.set(PositionType, Position.x, 1).remove(PositionType).submit();
        ecs.update();

        expect(entities.has(addedEntity, PositionType)).toBe(false);
        expect(entities.has(setEntity, PositionType)).toBe(false);
    });
});
