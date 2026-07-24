import { SystemSet, Update } from "@zero-ecs/game";

/** 宿主可用于插入集成逻辑的稳定飞剑系统锚点。 */
export const FlyingSwordSystemSet = Object.freeze({
    Request: new SystemSet(Update.fixed, "flying-sword:request"),
    Control: new SystemSet(Update.fixed, "flying-sword:control"),
    Skill: new SystemSet(Update.fixed, "flying-sword:skill"),
    Formation: new SystemSet(Update.fixed, "flying-sword:formation"),
    Guidance: new SystemSet(Update.fixed, "flying-sword:guidance"),
    Motion: new SystemSet(Update.fixed, "flying-sword:motion"),
    Contact: new SystemSet(Update.fixed, "flying-sword:contact"),
    Cleanup: new SystemSet(Update.fixed, "flying-sword:cleanup"),
});
