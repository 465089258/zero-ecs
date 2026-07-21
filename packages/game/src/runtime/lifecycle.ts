/** Game 运行时实例的生命周期阶段。 */
export enum GamePhase {
    /** 已构建，尚未初始化。 */
    Built,
    /** 已初始化，尚未启动。 */
    Initialized,
    /** 正在运行，可调用 `update()`。 */
    Running,
    /** 已停止，可继续销毁。 */
    Stopped,
    /** 系统参数准备失败；只能继续销毁。 */
    StartFailed,
    /** 已完全销毁。 */
    Disposed,
}

/** @deprecated 使用 `GamePhase`。 */
export { GamePhase as EcsPhase };
