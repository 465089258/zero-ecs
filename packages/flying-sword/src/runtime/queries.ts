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
    FlyingSwordBehaviorStorage,
    FlyingSwordControlStorage,
    FlyingSwordFlightStorage,
    FlyingSwordFormationStorage,
    FlyingSwordFormationPlanStorage,
    FlyingSwordFormationGoal3Storage,
    FlyingSwordIdleDirection3Storage,
    FlyingSwordGroupCenter3Storage,
    FlyingSwordGroupStorage,
    FlyingSwordGroupTarget3Storage,
    FlyingSwordMemberStorage,
    FlyingSwordPendingSkillTarget3Storage,
    FlyingSwordSkillActionEntityStorage,
    FlyingSwordSkillAcquisitionStorage,
    FlyingSwordSkillActionStorage,
    FlyingSwordSkillProgressStorage,
    FlyingSwordSkillTarget3Storage,
    FlyingSwordSkillTimingStorage,
    FlyingSwordTaskStorage,
    FinishFlyingSwordTaskRequestStorage,
    StartFlyingSwordTaskRequestStorage,
    CancelFlyingSwordGroupTasksRequestStorage,
    SetFlyingSwordActiveFormationRequestStorage,
    SetFlyingSwordStanceRequestStorage,
    SetFlyingSwordCenterRequestStorage,
    SetFlyingSwordModeRequestStorage,
    SetFlyingSwordFormationSizeRequestStorage,
    SetFlyingSwordFormationPlanRequestStorage,
    SetFlyingSwordSkillTargetRequestStorage,
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
    FlyingSwordBehaviorStorage,
    FlyingSwordFormationPlanStorage,
));

export const SetFlyingSwordCenterRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordCenterRequestStorage));

export const FocusFlyingSwordRequestStorageQuery =
    QueryType.from(With(FocusFlyingSwordRequestStorage));

export const SetFlyingSwordModeRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordModeRequestStorage));

export const SetFlyingSwordFormationSizeRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordFormationSizeRequestStorage));

export const SetFlyingSwordFormationPlanRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordFormationPlanRequestStorage));

export const SetFlyingSwordStanceRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordStanceRequestStorage));

export const SetFlyingSwordActiveFormationRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordActiveFormationRequestStorage));

export const StartFlyingSwordTaskRequestStorageQuery =
    QueryType.from(With(StartFlyingSwordTaskRequestStorage));

export const FinishFlyingSwordTaskRequestStorageQuery =
    QueryType.from(With(FinishFlyingSwordTaskRequestStorage));

export const CancelFlyingSwordGroupTasksRequestStorageQuery =
    QueryType.from(With(CancelFlyingSwordGroupTasksRequestStorage));

export const CastFlyingSwordSkillRequestStorageQuery =
    QueryType.from(With(CastFlyingSwordSkillRequestStorage));

export const SetFlyingSwordSkillTargetRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordSkillTargetRequestStorage));

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
    Optional(
        FlyingSwordPendingSkillTarget3Storage,
        FlyingSwordTaskStorage,
        FlyingSwordContactWindowStorage,
    ),
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
    Optional(
        FlyingSwordContactWindowStorage,
        FlyingSwordPendingSkillTarget3Storage,
    ),
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
        FlyingSwordIdleDirection3Storage,
    ),
    Optional(
        FlyingSwordSkillActionStorage,
        FlyingSwordTaskStorage,
    ),
));

export const FlyingSwordTaskStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordFlightStorage,
        Position3Type,
        FlyingSwordFormationGoal3Storage,
        MoveTowards3Type,
        FlyingSwordTaskStorage,
    ),
    Optional(FlyingSwordContactWindowStorage),
));

export const ActiveFlyingSwordTaskStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordTaskStorage,
        PreviousPosition3Type,
        Position3Type,
        Direction3Type,
    ),
    Optional(FlyingSwordContactWindowStorage),
));
