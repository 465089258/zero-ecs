/** 飞剑示例本地领域入口，不作为框架公共 API 发布。 */
export { FlyingSwordModule } from "./module";
export { FlyingSwordService } from "./service";
export {
    EightGatesFormationPlan,
    FlyingSwordFormationCatalog,
    LotusFormationPlan,
} from "./formation-catalog";
export {
    FlyingSwordSkillCatalog,
    PiercingCloudSkillPlan,
} from "./skill-catalog";
export { FlyingSwordSkillService } from "./skill-service";
export { FlyingSwordSystemSet } from "./system-set";
export {
    FlyingSwordActionQuery,
    FlyingSwordActionView,
    FlyingSwordContactQuery,
    FlyingSwordContactWindow,
    FlyingSwordControlView,
    FlyingSwordBehaviorView,
    FlyingSwordDirection3View,
    FlyingSwordFormationView,
    FlyingSwordFormationPlanView,
    FlyingSwordGroupCenter3View,
    FlyingSwordGroupQuery,
    FlyingSwordGroupTarget3View,
    FlyingSwordGroupView,
    FlyingSwordPosition3View,
    FlyingSwordPreviousPosition3View,
    FlyingSwordQuery,
    FlyingSwordTaskContactQuery,
    FlyingSwordTaskQuery,
    FlyingSwordTaskView,
    FlyingSwordSkillActionQuery,
    FlyingSwordSkillActionView,
    FlyingSwordSkillProgressView,
    FlyingSwordSkillTarget3View,
    FlyingSwordSkillTimingView,
    FlyingSwordView,
} from "./views";
export {
    ControlledFlyingSwordTag,
    ReserveFlyingSwordTag,
    PendingFlyingSwordRetireTag,
    FlyingSwordControlAssignment,
    FlyingSwordControlAssignmentType,
    FlyingSwordAction,
    FlyingSwordActiveFormation,
    FlyingSwordBehavior,
    FlyingSwordControl,
    FlyingSwordFormation,
    FlyingSwordFormationPlan,
    FlyingSwordGroup,
    FlyingSwordMember,
    FlyingSwordMode,
    FlyingSwordStance,
    FlyingSwordTask,
    FlyingSwordTaskPhase,
    FlyingSwordSkillAction,
    FlyingSwordSkillProgress,
    FlyingSwordSkillTiming,
} from "./types";
export {
    FlyingSwordFormationPlanId,
    FlyingSwordFormationPrimitive,
} from "./formation-types";
export type {
    CompiledFlyingSwordFormationPlan,
    FlyingSwordFormationPlanDefinition,
    FlyingSwordFormationPlanId as FlyingSwordFormationPlanIdValue,
    FlyingSwordFormationPrimitive as FlyingSwordFormationPrimitiveValue,
    FlyingSwordFormationRouteDefinition,
    FlyingSwordFormationRouteSample,
    FlyingSwordFormationSlotSample,
} from "./formation-types";
export {
    FlyingSwordSkillPhase,
    FlyingSwordSkillPlanId,
} from "./skill-types";
export type {
    CreateFlyingSwordGroupOptions,
    CreateFlyingSwordOptions,
    FlyingSwordControlViewData,
    FlyingSwordBehaviorViewData,
    FlyingSwordFormationViewData,
    FlyingSwordFormationPlanViewData,
    FlyingSwordGroupViewData,
    FlyingSwordActionViewData,
    FlyingSwordMemberViewData,
    FlyingSwordSkillActionViewData,
    FlyingSwordSkillProgressViewData,
    FlyingSwordSkillTimingViewData,
    FlyingSwordVector3ViewData,
    FlyingSwordTaskViewData,
    ReadonlyVector3,
} from "./types";
export type {
    ActivateFlyingSwordSkillOptions,
    CompiledFlyingSwordSkillPlan,
    FlyingSwordSkillPhase as FlyingSwordSkillPhaseValue,
    FlyingSwordSkillPlanId as FlyingSwordSkillPlanIdValue,
} from "./skill-types";
