import { Service } from "@zero-ecs/game";

export class MetricsService extends Service {
    fps = 0;
    simulationMs = 0;
    renderMs = 0;
    fixedSteps = 0;

    private frameCount = 0;
    private fpsWindowStart = performance.now();

    recordSimulation(elapsedMs: number, steps: number): void {
        this.fixedSteps = steps;
        if (steps > 0) this.simulationMs = smooth(this.simulationMs, elapsedMs / steps);
    }

    recordRender(elapsedMs: number, now: number): void {
        this.renderMs = smooth(this.renderMs, elapsedMs);
        this.frameCount++;
        const duration = now - this.fpsWindowStart;
        if (duration < 500) return;
        this.fps = this.frameCount * 1000 / duration;
        this.frameCount = 0;
        this.fpsWindowStart = now;
    }
}

function smooth(previous: number, next: number): number {
    return previous === 0 ? next : previous * 0.9 + next * 0.1;
}
