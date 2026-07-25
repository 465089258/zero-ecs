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
    FlyingSwordControlStorage,
    FlyingSwordFlightStorage,
    FlyingSwordFormationStorage,
    FlyingSwordFormationGoal3Storage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordGroupTarget3Storage,
    FlyingSwordMemberStorage,
    FlyingSwordSkillActionEntityStorage,
    FlyingSwordSkillAcquisitionStorage,
    FlyingSwordSkillActionStorage,
    FlyingSwordSkillProgressStorage,
    FlyingSwordSkillTarget3Storage,
    FlyingSwordSkillTimingStorage,
    SetFlyingSwordCenterRequestStorage,
    SetFlyingSwordModeRequestStorage,
    FocusFlyingSwordRequestStorage,
    CastFlyingSwordSkillRequestStorage,
    CancelFlyingSwordSkillRequestStorage,
} from "./storage";

export const FlyingSwordGroupStorageQuery = QueryType.from(With(
    FlyingSwordGroupStorage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupTarget3Storage,
    FlyingSwordFormationStorage,
    FlyingSwordControlStorage,
));

export const SetFlyingSwordCenterRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordCenterRequestStorage));

export const FocusFlyingSwordRequestStorageQuery =
    QueryType.from(With(FocusFlyingSwordRequestStorage));

export const SetFlyingSwordModeRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordModeRequestStorage));

export const CastFlyingSwordSkillRequestStorageQuery =
    QueryType.from(With(CastFlyingSwordSkillRequestStorage));

export const CancelFlyingSwordSkillRequestStorageQuery =
    QueryType.from(With(CancelFlyingSwordSkillRequestStorage));

export const FlyingSwordSkillActionEntityStorageQuery =
    QueryType.from(With(
        FlyingSwordSkillActionEntityStorage,
        FlyingSwordSkillTarget3Storage,
        FlyingSwordSkillTimingStorage,
        FlyingSwordSkillAcquisitionStorage,
        FlyingSwordSkillProgressStorage,
    ));

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

export const FlyingSwordOrientationStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        Direction3Type,
    ),
    Optional(FlyingSwordSkillActionStorage),
));
