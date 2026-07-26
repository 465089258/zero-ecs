import {
    INVALID_ENTITY,
    State,
    type Entity,
} from "@zero-ecs/game";
import {
    FlyingSwordFormationPlanId,
    FlyingSwordMode,
    FlyingSwordStance,
    type FlyingSwordMode as FlyingSwordModeValue,
    type FlyingSwordStance as FlyingSwordStanceValue,
} from "@zero-ecs/flying-sword";

export class DemoSceneState extends State {
    cultivator: Entity = INVALID_ENTITY;
    swordGroup: Entity = INVALID_ENTITY;
    moveTargetX = 0;
    moveTargetY = 0;
    moveTargetZ = 0;
    hasMoveTarget = false;
    targetX = 0;
    targetY = 0;
    targetZ = 5;
    mode: FlyingSwordModeValue = FlyingSwordMode.Orbit;
    stance: FlyingSwordStanceValue = FlyingSwordStance.Scatter;
    formationPlan: number = FlyingSwordFormationPlanId.EightGates;
}
