/** 飞剑示例本地领域运行时。 */
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
} from "../../../infrastructure/math";
import { MoveTowards3Type } from "../../../infrastructure/motion";
import { ReserveFlyingSwordTag } from "../types";
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
    SetFlyingSwordFormationTuningRequestStorage,
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

export const SetFlyingSwordFormationTuningRequestStorageQuery =
    QueryType.from(With(SetFlyingSwordFormationTuningRequestStorage));

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

export const FlyingSwordBaseStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordFlightStorage,
        Position3Type,
        PreviousPosition3Type,
        Velocity3Type,
        Direction3Type,
        FlyingSwordFormationGoal3Storage,
        MoveTowards3Type,
    ),
    Without(ReserveFlyingSwordTag),
));

export const AvailableFlyingSwordStorageQuery = QueryType.from(All(
    With(
        FlyingSwordMemberStorage,
        FlyingSwordFlightStorage,
        Position3Type,
        FlyingSwordFormationGoal3Storage,
        MoveTowards3Type,
    ),
    Without(
        FlyingSwordSkillActionStorage,
        ReserveFlyingSwordTag,
    ),
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
    Without(ReserveFlyingSwordTag),
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
    Without(ReserveFlyingSwordTag),
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
    Without(ReserveFlyingSwordTag),
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
    Without(ReserveFlyingSwordTag),
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
    Without(ReserveFlyingSwordTag),
    Optional(FlyingSwordContactWindowStorage),
));
