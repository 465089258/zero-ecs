import { Commands, defSystem, Update, type Entity, type QueryOf } from "@zero-ecs/game";
import { AttributeChangeRequest, Health } from "./components";
import { AttributeChangeRequestQuery, HealthQuery } from "./queries";

type Changes = QueryOf<typeof AttributeChangeRequestQuery>;
type HealthValues = QueryOf<typeof HealthQuery>;

export const applyAttributeChangesSystem = defSystem(Update.fixed, applyAttributeChanges, [
    Commands, AttributeChangeRequestQuery, HealthQuery,
]);

function applyAttributeChanges(commands: Commands, changes: Changes, healthValues: HealthValues): void {
    const changeIter = changes.iter();
    while (changeIter.next()) {
        const [count, requestEntities, data] = changeIter.current;
        const targets = data[AttributeChangeRequest.target];
        const amounts = data[AttributeChangeRequest.amount];
        for (let i = 0; i < count; i++) {
            applyToTarget(targets[i] as Entity, amounts[i], healthValues);
            commands.entity(requestEntities[i] as Entity).despawn().submit();
        }
    }
}

function applyToTarget(target: Entity, amount: number, healthValues: HealthValues): void {
    const iter = healthValues.iter();
    while (iter.next()) {
        const [count, entities, health] = iter.current;
        for (let i = 0; i < count; i++) {
            if (entities[i] !== target) continue;
            const max = health[Health.max][i];
            health[Health.current][i] = Math.max(0, Math.min(max, health[Health.current][i] + amount));
            return;
        }
    }
}
