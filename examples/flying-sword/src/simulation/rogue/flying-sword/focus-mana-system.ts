import {
    Commands,
    INVALID_ENTITY,
    Update,
    defSystem,
    type QueryOf,
} from "@zero-ecs/game";
import {
    FlyingSwordSkillAction,
    FlyingSwordSkillActionQuery,
} from "../../../domain/flying-sword";
import {
    FocusCastPower,
    FocusCastPowerType,
    PendingFocusCast,
} from "../components";
import {
    RoguePendingFocusCastQuery,
} from "../queries";

type PendingCasts = QueryOf<typeof RoguePendingFocusCastQuery>;
type SkillActions = QueryOf<typeof FlyingSwordSkillActionQuery>;

/**
 * 将输入层的法力快照附着到领域生成的技能 Action。
 *
 * Pending 实体跨越输入请求与领域 Action 创建的时间边界；绑定完成后即销毁。
 */
export const bindFocusCastPowerSystem = defSystem(
    Update.fixed,
    bindFocusCastPower,
    [
        Commands,
        RoguePendingFocusCastQuery,
        FlyingSwordSkillActionQuery,
    ],
);

function bindFocusCastPower(
    commands: Commands,
    pendingCasts: PendingCasts,
    actions: SkillActions,
): void {
    const pendingIter = pendingCasts.iter();
    while (pendingIter.next()) {
        const [pendingCount, pendingEntities, pending] =
            pendingIter.current;
        const pendingGroups = pending[PendingFocusCast.Group];
        const manaSpent = pending[PendingFocusCast.ManaSpent];
        const damageMultipliers =
            pending[PendingFocusCast.DamageMultiplier];
        for (let pendingRow = 0; pendingRow < pendingCount; pendingRow++) {
            const group = pendingGroups[pendingRow];
            let actionEntity = INVALID_ENTITY;
            const actionIter = actions.iter();
            while (actionIter.next()) {
                const [actionCount, actionEntities, identities] =
                    actionIter.current;
                const actionGroups =
                    identities[FlyingSwordSkillAction.Group];
                for (let actionRow = 0; actionRow < actionCount; actionRow++) {
                    if (actionGroups[actionRow] !== group) continue;
                    actionEntity = actionEntities[actionRow];
                    break;
                }
                if (actionEntity !== INVALID_ENTITY) break;
            }
            if (actionEntity === INVALID_ENTITY) continue;
            commands
                .entity(actionEntity)
                .add(FocusCastPowerType)
                .set(
                    FocusCastPowerType,
                    FocusCastPower.ManaSpent,
                    manaSpent[pendingRow],
                )
                .set(
                    FocusCastPowerType,
                    FocusCastPower.DamageMultiplier,
                    damageMultipliers[pendingRow],
                )
                .submit();
            commands
                .entity(pendingEntities[pendingRow])
                .despawn()
                .submit();
        }
    }
}
