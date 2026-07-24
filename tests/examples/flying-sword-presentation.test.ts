import {
    expect,
    test,
} from "@rstest/core";
import {
    TopDownOrthographicCamera,
    degreesToRadians,
} from "../../examples/flying-sword/src/presentation/camera";
import {
    DemoRenderLayer,
    DepthRenderQueue,
} from "../../examples/flying-sword/src/presentation/render-queue";

test("flying sword example projection and painter sorting share camera-space depth", () => {
    const camera = new TopDownOrthographicCamera({
        viewportWidth: 960,
        viewportHeight: 640,
        elevation: degreesToRadians(50),
        yaw: degreesToRadians(45),
        zoom: 60,
        target: { x: 0, y: 0, z: 0 },
    });
    const ground = { x: 0, y: 0, depth: 0 };
    const airborne = { x: 0, y: 0, depth: 0 };
    camera.project(0, 0, 4, ground);
    camera.project(0, 2, 4, airborne);

    expect(airborne.y).toBeLessThan(ground.y);
    expect(airborne.depth).toBeLessThan(ground.depth);

    const xAxis = { x: 0, y: 0, depth: 0 };
    const zAxis = { x: 0, y: 0, depth: 0 };
    camera.project(1, 0, 0, xAxis);
    camera.project(0, 0, 1, zAxis);
    expect(xAxis.y).toBeCloseTo(zAxis.y, 5);
    expect(xAxis.x - 480).toBeCloseTo(-(zAxis.x - 480), 5);

    const roundTrip = { x: 0, y: 0, z: 0 };
    expect(camera.unprojectToHeight(ground.x, ground.y, 0, roundTrip)).toBe(true);
    expect(roundTrip.x).toBeCloseTo(0, 5);
    expect(roundTrip.z).toBeCloseTo(4, 5);

    const queue = new DepthRenderQueue(() => ({
        layer: DemoRenderLayer.World,
        depth: 0,
        subOrder: 0,
        stableId: 0,
        name: "",
    }));
    queue.begin();
    Object.assign(queue.acquire(), { depth: airborne.depth, stableId: 2, name: "near" });
    Object.assign(queue.acquire(), { depth: ground.depth, stableId: 1, name: "far" });
    queue.sort();
    expect(queue.items.map(item => item.name)).toEqual(["far", "near"]);
});
