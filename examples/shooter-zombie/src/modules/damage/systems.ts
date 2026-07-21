import { Commands, defSystem, Update, type QueryOf } from "@zero-ecs/game";
import { DamageRequest, DamageRequestType, DamageResult, DamageResultType } from "./components";
import { DamageRequestQuery } from "./queries";

type Requests = QueryOf<typeof DamageRequestQuery>;

export const resolveDamageSystem = defSystem(Update.fixed, resolveDamage, [Commands, DamageRequestQuery]);

function resolveDamage(commands: Commands, requests: Requests): void {
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        const sources = data[DamageRequest.source];
        const targets = data[DamageRequest.target];
        const amounts = data[DamageRequest.amount];
        const xs = data[DamageRequest.x];
        const ys = data[DamageRequest.y];
        for (let i = 0; i < count; i++) {
            const amount = Math.max(0, amounts[i]);
            commands.spawn()
                .add(DamageResultType)
                .set(DamageResultType, DamageResult.source, sources[i])
                .set(DamageResultType, DamageResult.target, targets[i])
                .set(DamageResultType, DamageResult.requested, amount)
                .set(DamageResultType, DamageResult.final, amount)
                .set(DamageResultType, DamageResult.x, xs[i])
                .set(DamageResultType, DamageResult.y, ys[i])
                .submit();
            commands.entity(entities[i]).despawn()
                .submit();
        }
    }
}
