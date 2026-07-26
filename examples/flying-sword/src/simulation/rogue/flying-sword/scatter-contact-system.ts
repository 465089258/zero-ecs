import {
    INVALID_ENTITY,
    Update,
    World,
    defSystem,
    type Entity,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordMember,
    FlyingSwordService,
} from "@zero-ecs/flying-sword";
import { TimeState } from "@zero-ecs/game/time";
import {
    Float3,
    Position3Type,
} from "@zero-ecs/math/3d";
import {
    DamageKind,
    EnemyBody,
    EnemyBodyType,
    FlyingSwordCombat,
    Health,
    HealthType,
} from "../components";
import { RogueContentService } from "../content-service";
import { RogueFlyingSwordTaskContactQuery } from "../queries";
import { CombatScratchState } from "../state";
import {
    DEFAULT_REATTACK_DELAY_TICKS,
    DEFAULT_SWORD_DAMAGE,
    SWORD_HIT_RADIUS,
} from "./combat-constants";
import { squaredDistanceToSegment3 } from "./combat-spatial-index";

type SwordTaskContacts =
    QueryOf<typeof RogueFlyingSwordTaskContactQuery>;

export const collideScatterSwordContactsSystem = defSystem(
    Update.fixed,
    collideScatterSwordContacts,
    [
        World,
        FlyingSwordService,
        TimeState,
        RogueContentService,
        CombatScratchState,
        RogueFlyingSwordTaskContactQuery,
    ],
);

function collideScatterSwordContacts(
    world: World,
    flyingSwords: FlyingSwordService,
    time: Readonly<TimeState>,
    content: RogueContentService,
    scratch: Readonly<CombatScratchState>,
    contacts: SwordTaskContacts,
): void {
    const tick = time.tick;
    const iter = contacts.iter();
    while (iter.next()) {
        const [
            count,
            entities,
            members,
            ,
            ,
            previousPositions,
            positions,
            ,
            combat,
        ] = iter.current;
        const groupEntities = members[FlyingSwordMember.Group];
        const previousXs = previousPositions[Float3.X];
        const previousYs = previousPositions[Float3.Y];
        const previousZs = previousPositions[Float3.Z];
        const xs = positions[Float3.X];
        const ys = positions[Float3.Y];
        const zs = positions[Float3.Z];
        const targets = combat[FlyingSwordCombat.Target];
        const nextAttackTicks =
            combat[FlyingSwordCombat.NextAttackTick];
        for (let row = 0; row < count; row++) {
            const target = targets[row] as Entity;
            if (target === INVALID_ENTITY) continue;
            const health = world.get(target, HealthType, Health.Current);
            if (health === null || health <= 0) {
                finishTaskAttack(
                    flyingSwords,
                    entities[row],
                    targets,
                    nextAttackTicks,
                    row,
                    tick,
                    scratch.groupReattackDelays.get(
                        groupEntities[row],
                    ) ?? DEFAULT_REATTACK_DELAY_TICKS,
                );
                continue;
            }
            if (
                !swordSegmentHitsEntity(
                    world,
                    target,
                    previousXs[row],
                    previousYs[row],
                    previousZs[row],
                    xs[row],
                    ys[row],
                    zs[row],
                )
            ) {
                continue;
            }
            content.requestDamage(
                entities[row],
                target,
                scratch.groupDamages.get(groupEntities[row]) ??
                    DEFAULT_SWORD_DAMAGE,
                DamageKind.ScatterSword,
            );
            finishTaskAttack(
                flyingSwords,
                entities[row],
                targets,
                nextAttackTicks,
                row,
                tick,
                scratch.groupReattackDelays.get(
                    groupEntities[row],
                ) ?? DEFAULT_REATTACK_DELAY_TICKS,
            );
        }
    }
}

function finishTaskAttack(
    flyingSwords: FlyingSwordService,
    sword: Entity,
    targets: Uint32Array,
    nextAttackTicks: Uint32Array,
    row: number,
    tick: number,
    delayTicks: number,
): void {
    targets[row] = INVALID_ENTITY;
    nextAttackTicks[row] = tick + delayTicks;
    flyingSwords.finishAttack(sword);
}

function swordSegmentHitsEntity(
    world: World,
    enemy: Entity,
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
): boolean {
    const x = world.get(enemy, Position3Type, Float3.X);
    const y = world.get(enemy, Position3Type, Float3.Y);
    const z = world.get(enemy, Position3Type, Float3.Z);
    const radius = world.get(
        enemy,
        EnemyBodyType,
        EnemyBody.Radius,
    );
    const centerHeight = world.get(
        enemy,
        EnemyBodyType,
        EnemyBody.CenterHeight,
    );
    if (
        x === null || y === null || z === null ||
        radius === null || centerHeight === null
    ) {
        return false;
    }
    const hitRadius = radius + SWORD_HIT_RADIUS;
    return squaredDistanceToSegment3(
        x,
        y + centerHeight,
        z,
        startX,
        startY,
        startZ,
        endX,
        endY,
        endZ,
    ) <= hitRadius * hitRadius;
}
