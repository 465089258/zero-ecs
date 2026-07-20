import { Commands, defSystem, Update, type Entity, type QueryOf } from "@zero-ecs/game";
import { DamageRequest, DamageRequestType, DamageResult, DamageResultType } from "./components";
import { DamageRequestQuery } from "./queries";

type Requests = QueryOf<typeof DamageRequestQuery>;

export const resolveDamageSystem = defSystem(Update.fixed, resolveDamage, [Commands, DamageRequestQuery]);

function resolveDamage(commands: Commands, requests: Requests): void {
    const iter = requests.iter();
    while (iter.next()) {
        const [count, entities, data] = iter.current;
        for (let i = 0; i < count; i++) {
            const amount = Math.max(0, data[DamageRequest.amount][i]);
            commands.spawn()
                .add(DamageResultType)
                .set(DamageResultType, DamageResult.source, data[DamageRequest.source][i])
                .set(DamageResultType, DamageResult.target, data[DamageRequest.target][i])
                .set(DamageResultType, DamageResult.requested, amount)
                .set(DamageResultType, DamageResult.final, amount)
                .set(DamageResultType, DamageResult.x, data[DamageRequest.x][i])
                .set(DamageResultType, DamageResult.y, data[DamageRequest.y][i]).submit();
            commands.entity(entities[i] as Entity).despawn().submit();
        }
    }
}
