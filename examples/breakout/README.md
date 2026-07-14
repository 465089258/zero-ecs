# Splitstorm Breakout

经典打砖块的零依赖 Canvas 示例，用于同时演示 zero-ecs-lib 的运行时 API 和高实体数量场景。

## 运行

```bash
npm run example:breakout
```

浏览器打开 Rsbuild 输出的地址（默认 `http://localhost:3100`）。生产构建：

```bash
npm run example:breakout:build
```

## ECS 映射

- Component：Position、Velocity、Ball、Paddle、Brick、PowerUp 和 GameEntity tag。
- Resource：固定场地配置与 Canvas/DOM 引用。
- State：分数、生命、实体统计和游戏阶段。
- Service：输入、实体生成、性能采样和表现层渲染桥。
- Query：系统直接遍历复用的 TypedArray 列。
- EntityCommand：砖块销毁、掉落物、球分裂和重开均在内部 Post 统一提交。

模拟以 120 Hz 固定 Tick 运行。`Startup` 系统只把 Query 实例交给 RendererService，之后 Canvas 在浏览器 RAF 中独立渲染，不进入 ECS 固定更新时序。

砖块区由 `28 × 18`、共 504 个小型正方形组成。外围装甲环每块有 8 点耐久，内部砖块有 2～4 点耐久；球打穿外环后会在内部砖块和装甲之间自行反弹。耐久以砖块亮度和底部状态条显示。

接住砖块掉落的青色 `×2` 能力会分裂全部现存球。右侧“注入 1000 球”可以快速提升实体数量；上限为 10,000 球，面板会显示 FPS、单 Tick 模拟耗时、渲染耗时和实体统计。
