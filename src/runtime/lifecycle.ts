/** ECS 实例的生命周期阶段。 */
export const enum EcsPhase {
    /** 已构建，尚未初始化。 */
    Built,
    /** 已初始化，尚未启动。 */
    Initialized,
    /** 正在运行，可调用 `update()`。 */
    Running,
    /** 已停止，可继续销毁。 */
    Stopped,
    /** 已完全销毁。 */
    Disposed,
}
