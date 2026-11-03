import { getProjectionState, projectPoint } from "./projections.js";
import { goodeLobeCenter } from "./pseudocylindrical.js";
import {
    createTetrahedralCoordinate,
    animateTetrahedral,
} from "./tetrahedral.js";

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

// Derivatives in two orthonormal tangent directions, independent of the camera.
// `project` must use the same continuous branch for all four nearby points.
export function localDistortion(project, direction, step = 1e-7) {
    const [x, y, z] = direction;
    const horizontal = Math.hypot(x, z);
    const east =
        horizontal > 1e-12 ? [z / horizontal, 0, -x / horizontal] : [1, 0, 0];
    const north = [y * east[2], z * east[0] - x * east[2], -y * east[0]];
    const derivative = (tangent) => {
        const sample = (sign) =>
            project(
                direction.map(
                    (value, i) =>
                        value * Math.cos(step) +
                        sign * tangent[i] * Math.sin(step),
                ),
            );
        const before = sample(-1),
            after = sample(1);
        return after.map((value, i) => (value - before[i]) / (2 * step));
    };
    const u = derivative(east),
        v = derivative(north);
    const area = Math.hypot(
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
    );
    const trace = dot(u, u) + dot(v, v);
    // (a-b)/(a+b) from the two singular values of the surface derivative.
    const ratio = Math.sqrt(
        Math.max(0, Math.min(1, (trace - 2 * area) / (trace + 2 * area))),
    );
    return { area, angle: (2 * Math.asin(ratio) * 180) / Math.PI };
}

export function measureProjectionDistortion(type, sampleCount = 524288) {
    if (!Number.isInteger(sampleCount) || sampleCount < 2)
        throw new RangeError("At least two samples required");
    const state = getProjectionState(type, 1);
    const limit = Math.sin(state.latitudeRange);
    const areas = [];
    let angleSum = 0;
    for (let i = 0; i < sampleCount; i++) {
        // Fibonacci sphere, restricted to the latitude range actually rendered.
        const y = limit * (1 - (2 * (i + 0.5)) / sampleCount);
        const longitude =
            ((i * GOLDEN_ANGLE + Math.PI) % (2 * Math.PI)) - Math.PI;
        const radius = Math.sqrt(1 - y * y);
        const direction = [
            radius * Math.sin(longitude),
            y,
            radius * Math.cos(longitude),
        ];
        const lobe =
            type === "goode"
                ? goodeLobeCenter(longitude, Math.asin(y))
                : undefined;
        const face = state.tetrahedral
            ? createTetrahedralCoordinate(direction).face.id
            : undefined;
        const project = (point) => {
            // Stay on this side of the date-line cut when differentiating.
            let sampleLongitude = Math.atan2(point[0], point[2]);
            if (sampleLongitude - longitude > Math.PI)
                sampleLongitude -= 2 * Math.PI;
            if (sampleLongitude - longitude < -Math.PI)
                sampleLongitude += 2 * Math.PI;
            const result = state.tetrahedral
                ? animateTetrahedral(
                      createTetrahedralCoordinate(point, face),
                      1,
                      {},
                  )
                : projectPoint(
                      sampleLongitude,
                      Math.asin(point[1]),
                      state,
                      {},
                      lobe,
                  );
            return [result.x, result.y, result.z];
        };
        const { area, angle } = localDistortion(project, direction);
        if (!Number.isFinite(area) || !Number.isFinite(angle) || area <= 0) {
            throw new Error(`Invalid distortion sample for ${type} at ${i}`);
        }
        areas.push(area);
        angleSum += angle;
        // Projection caches are useful to the renderer, but not to unique samples.
        state.profiles?.clear();
        state.columns?.clear();
    }
    const meanArea = areas.reduce((sum, value) => sum + value, 0) / sampleCount;
    const areaDifference =
        (100 *
            areas.reduce(
                (sum, value) => sum + Math.abs(value / meanArea - 1),
                0,
            )) /
        sampleCount;
    const angleError = angleSum / sampleCount;
    // Suppress finite-difference roundoff, without assigning zeros by projection name.
    const clean = (value) => (value < 1e-4 ? 0 : Number(value.toFixed(6)));
    return {
        areaDifference: clean(areaDifference),
        angleError: clean(angleError),
    };
}
