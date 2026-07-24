import {
    All,
    Optional,
    QueryType,
    With,
    Without,
} from "@zero-ecs/game";
import {
    Direction3Type,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
} from "@zero-ecs/math/3d";
import { MoveTowards3Type } from "@zero-ecs/motion/3d";
import {
    FlyingSwordContactWindowStorage,
    FlyingSwordFlightStorage,
    FlyingSwordFormationGoal3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordMemberStorage,
    FlyingSwordSkillActionStorage,
} from "./storage";

export const FlyingSwordGroupStorageQuery =
    QueryType.from(With(FlyingSwordGroupStorage));

export const FlyingSwordBaseStorageQuery = QueryType.from(With(
    FlyingSwordMemberStorage,
    FlyingSwordFlightStorage,
    Position3Type,
    PreviousPosition3Type,
    Velocity3Type,
    Direction3Type,
    FlyingSwordFormationGoal3Storage,
    MoveTowards3Type,
));

export const AvailableFlyingSwordStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordFlightStorage,
        Position3Type,
        FlyingSwordFormationGoal3Storage,
        MoveTowards3Type,
    ),
    Without(FlyingSwordSkillActionStorage),
));

export const ActiveFlyingSwordSkillStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordFlightStorage,
        Position3Type,
        FlyingSwordFormationGoal3Storage,
        MoveTowards3Type,
        FlyingSwordSkillActionStorage,
    ),
    Optional(FlyingSwordContactWindowStorage),
));

export const FlyingSwordGuidanceStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordFlightStorage,
        Position3Type,
        FlyingSwordFormationGoal3Storage,
        MoveTowards3Type,
    ),
    Optional(
        FlyingSwordSkillActionStorage,
        FlyingSwordContactWindowStorage,
    ),
));
