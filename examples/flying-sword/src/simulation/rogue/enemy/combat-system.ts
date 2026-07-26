import {
    Update,
    defSystem,
    type QueryOf,
} from "@zero-ecs/game";
import { MotionSystemSet } from "@zero-ecs/motion/3d";
import { EnemyCombat } from "../components";
import { RogueEnemyCombatResolveQuery } from "../queries";
import { RogueSystemSet } from "../systems";

type Enemies = QueryOf<typeof RogueEnemyCombatResolveQuery>;

export const resolveEnemyCombatSystem = defSystem(
    Update.fixed,
    resolveEnemyCombat,
    [RogueEnemyCombatResolveQuery],
);

export const EnemyCombatSystemOptions = Object.freeze({
    inSet: RogueSystemSet.EnemyResolve,
    after: RogueSystemSet.Intent,
    before: MotionSystemSet.Integrate3,
});

function resolveEnemyCombat(enemies: Enemies): void {
    const iter = enemies.iter();
    while (iter.next()) {
        const [count, , combats] = iter.current;
        const baseDamages =
            combats[EnemyCombat.BaseContactDamage];
        const damages = combats[EnemyCombat.ContactDamage];
        for (let row = 0; row < count; row++) {
            damages[row] = baseDamages[row];
        }
    }
}
