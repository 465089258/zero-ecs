import { describe, expect, test } from "@rstest/core";
import {
    type Component,
    Command,
    CommandModule,
    Commands,
    GameBuilder,
    ErrorHandlerService,
    type Entity,
    type EntityMutator,
    Types,
    World,
} from "@zero-ecs/game";

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
    const ecs = new GameBuilder().addModule(new CommandModule()).build();
    ecs.init();
    ecs.start();
    return ecs;
}

describe("unified Commands", () => {
    test("pools EntityCommand through the ordinary Command channel", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const firstCommand = commands.spawn().set(PositionType, Position.x, 3);
        const firstEntity = firstCommand.entity;

        firstCommand.submit();
        expect(() => firstCommand.submit()).toThrow(/already been submitted/);
        ecs.update();
        expect(ecs.world.get(firstEntity, PositionType, Position.x)).toBe(3);

        const secondCommand = commands.spawn().set(PositionType, Position.x, 5);
        const secondEntity = secondCommand.entity;
        expect(secondCommand).toBe(firstCommand);
        secondCommand.submit();
        ecs.update();
        expect(ecs.world.get(secondEntity, PositionType, Position.x)).toBe(5);
        ecs.dispose();
    });

    test("pools ordinary commands and enforces their lifecycle", () => {
        CountCommand.total = 0;
        const ecs = setup();
        const commands = ecs.service(Commands);
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

    test("trims command and migration pools only at an idle boundary", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const first = commands.cmd(CountCommand);
        const second = commands.cmd(CountCommand);
        first.submit();
        expect(() => commands.trimPools()).toThrow(/pending/);
        second.submit();
        ecs.update();

        commands.trimPools(1, 0);
        const retained = commands.cmd(CountCommand);
        const created = commands.cmd(CountCommand);
        expect(retained).toBe(first);
        expect(created).not.toBe(first);
        expect(created).not.toBe(second);
        retained.submit();
        created.submit();
        ecs.update();
    });

    test("recycles a command even when execute throws", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const errors: unknown[] = [];
        ecs.service(ErrorHandlerService).setHandler((error, source) => {
            expect(source).toBe("command");
            errors.push(error);
        });
        const command = commands.cmd(ThrowCommand);
        command.submit();
        ecs.update();

        expect(errors).toHaveLength(1);
        expect(commands.cmd(ThrowCommand)).toBe(command);
    });

    test("reserves spawn IDs immediately and executes EntityCommand in the same queue", () => {
        const ecs = setup();
        const entities = ecs.world;
        const commands = ecs.service(Commands);
        const command = commands.spawn();
        const entity = command.entity;

        expect(entities.valid(entity)).toBe(true);
        expect(entities.findComponent(PositionType)).toBeUndefined();
        command
            .add(PositionType)
            .set(PositionType, Position.x, 10)
            .set(PositionType, Position.y, 20)
            .add(PlayerTagType);
        command.submit();
        expect(() => command.remove(PlayerTagType)).toThrow(/already been submitted/);
        ecs.update();

        expect(entities.has(entity, PositionType)).toBe(true);
        expect(entities.has(entity, PlayerTagType)).toBe(true);
        expect(entities.get(entity, PositionType, Position.x)).toBe(10);
        expect(entities.get(entity, PositionType, Position.y)).toBe(20);

        const removeTag = commands.entity(entity).remove(PlayerTagType);
        removeTag.submit();
        ecs.update();
        expect(entities.has(entity, PlayerTagType)).toBe(false);
    });

    test("batch despawns across retained empty Tables and can immediately reuse Entity slots", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.world;
        const errors: unknown[] = [];
        ecs.service(ErrorHandlerService).setHandler(error => errors.push(error));
        const original: Entity[] = [];

        // Position rows span more than one 16 KiB Archetype Table.
        for (let i = 0; i < 1600; i++) {
            const command = commands.spawn()
                .set(PositionType, Position.x, i)
                .set(PositionType, Position.y, -i);
            original.push(command.entity);
            command.submit();
        }
        ecs.update();

        for (let i = 0; i < original.length; i++) {
            commands.entity(original[i]).despawn().submit();
        }
        ecs.update();

        expect(errors).toEqual([]);
        for (let i = 0; i < original.length; i++) expect(entities.valid(original[i])).toBe(false);

        const replacement = commands.spawn().set(PositionType, Position.x, 42);
        const replacementEntity = replacement.entity;
        replacement.submit();
        ecs.update();
        expect(errors).toEqual([]);
        expect(entities.valid(replacementEntity)).toBe(true);
        expect(entities.get(replacementEntity, PositionType, Position.x)).toBe(42);
    });

    test("keeps unsubmitted EntityCommand alive and makes despawn terminal", () => {
        const ecs = setup();
        const entities = ecs.world;
        const commands = ecs.service(Commands);
        const command = commands.spawn();
        const entity = command.entity;
        const other = commands.entity(entity);

        expect(other).not.toBe(command);
        ecs.update();
        expect(entities.valid(entity)).toBe(true);

        command.add(PositionType);
        command.submit();
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
        const entities = ecs.world;
        const entity = entities.spawn();

        expect(entities.has(entity, PositionType)).toBe(false);
        expect(entities.get(entity, PositionType, Position.x)).toBeNull();
        expect(entities.view(entity, PositionType)).toBeNull();
        expect(entities.findComponent(PositionType)).toBeUndefined();
    });

    test("uses idempotent Add/Remove and Set implicitly adds a zeroed component", () => {
        const ecs = setup();
        const entities = ecs.world;
        const commands = ecs.service(Commands);
        const create = commands.spawn();
        const entity = create.entity;
        create
            .set(PositionType, Position.x, 12)
            .add(PositionType)
            .remove(PlayerTagType);
        expect(create.get(PositionType, Position.x)).toBe(12);
        expect(create.get(PositionType, Position.y)).toBe(0);
        create.submit();
        ecs.update();

        expect(entities.get(entity, PositionType, Position.x)).toBe(12);
        expect(entities.get(entity, PositionType, Position.y)).toBe(0);
        expect(entities.findComponent(PlayerTagType)).toBeUndefined();

        const update = commands.entity(entity)
            .add(PositionType)
            .set(PositionType, Position.y, 8);
        update.submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(12);
        expect(entities.get(entity, PositionType, Position.y)).toBe(8);
    });

    test("does not enter the structural path for idempotent Add/Remove", () => {
        const ecs = setup();
        const entities = ecs.world;
        const commands = ecs.service(Commands);
        const create = commands.spawn().set(PositionType, Position.x, 1);
        const entity = create.entity;
        create.submit();
        ecs.update();
        entities.component(PlayerTagType);

        let migrations = 0;
        const migrate = entities.migrate.bind(entities);
        entities.migrate = ((...args: Parameters<World["migrate"]>) => {
            migrations++;
            return migrate(...args);
        }) as World["migrate"];
        commands.entity(entity)
            .add(PositionType)
            .remove(PlayerTagType)
            .set(PositionType, Position.y, 2)
            .submit();
        ecs.update();

        expect(migrations).toBe(0);
        expect(entities.get(entity, PositionType, Position.y)).toBe(2);
        ecs.dispose();
    });

    test("treats Remove then Add or Set as a fresh zeroed component", () => {
        const ecs = setup();
        const entities = ecs.world;
        const commands = ecs.service(Commands);
        const create = commands.spawn();
        const entity = create.entity;
        create
            .set(PositionType, Position.x, 1)
            .set(PositionType, Position.y, 2);
        create.submit();
        ecs.update();

        const reset = commands.entity(entity)
            .set(PositionType, Position.x, 99)
            .remove(PositionType)
            .add(PositionType)
            .set(PositionType, Position.y, 7);
        reset.submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(0);
        expect(entities.get(entity, PositionType, Position.y)).toBe(7);

        const replace = commands.entity(entity)
            .remove(PositionType)
            .set(PositionType, Position.x, 5);
        replace.submit();
        ecs.update();
        expect(entities.get(entity, PositionType, Position.x)).toBe(5);
        expect(entities.get(entity, PositionType, Position.y)).toBe(0);
    });

    test("provides read-your-writes through a shared zero-wrapper EntityMutator view", () => {
        const ecs = setup();
        const commands = ecs.service(Commands);
        const entities = ecs.world;
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
        const commands = ecs.service(Commands);
        const entities = ecs.world;
        const added = commands.spawn();
        const addedEntity = added.entity;
        added.add(PositionType).remove(PositionType);
        added.submit();
        const set = commands.spawn();
        const setEntity = set.entity;
        set.set(PositionType, Position.x, 1).remove(PositionType);
        set.submit();
        ecs.update();

        expect(entities.has(addedEntity, PositionType)).toBe(false);
        expect(entities.has(setEntity, PositionType)).toBe(false);
    });
});
