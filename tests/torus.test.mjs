import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, projectPoint, getProjectionCheckpoints,
    getNextProjectionCheckpoint, getPreviousProjectionCheckpoint } from '../js/projections.js';
import { getProjectionSteps } from '../js/projection-steps.js';

const point = (progress, longitude, latitude) => {
    const p = projectPoint(longitude, latitude, getProjectionState('torus', progress), {});
    return [p.x, p.y, p.z];
};
const close = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const same = (a, b, tolerance) => a.forEach((value, i) => close(value, b[i], tolerance));

test('torus has the five requested stages, with forwards and backwards keyboard checkpoints', () => {
    const checkpoints = [0, 0.25, 0.5, 0.75, 1];
    assert.deepEqual(getProjectionCheckpoints('torus'), checkpoints);
    const steps = getProjectionSteps('torus');
    assert.match(steps[1].description, /Pinch.*poles/);
    assert.match(steps[2].description, /hole.*torus/);
    assert.match(steps[3].description, /Cut.*horizontal cylinder/);
    assert.match(steps[4].description, /back.*upward and downward.*rectangle/);
    for (let i = 0; i < checkpoints.length; i++) {
        close(getNextProjectionCheckpoint('torus', checkpoints[i]), checkpoints[(i + 1) % 5]);
        close(getPreviousProjectionCheckpoint('torus', checkpoints[i]), checkpoints[(i + 4) % 5]);
    }
});

test('the sphere starts unchanged, then both poles meet while the equator stays fixed', () => {
    for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
        for (const latitude of [-Math.PI / 2, -0.6, 0, 0.6, Math.PI / 2]) {
            same(point(0, longitude, latitude), [Math.cos(latitude) * Math.sin(longitude),
                Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)]);
        }
        for (const progress of [0, 0.1, 0.25]) {
            same(point(progress, longitude, 0), [Math.sin(longitude), 0, Math.cos(longitude)]);
            close(point(progress, longitude, Math.PI / 2)[1], 1 - progress * 4);
            close(point(progress, longitude, -Math.PI / 2)[1], -(1 - progress * 4));
        }
        same(point(0.25, longitude, Math.PI / 2), [0, 0, 0]);
        same(point(0.25, longitude, -Math.PI / 2), [0, 0, 0]);
    }
});

test('opening the pinch creates a genuine ring torus with a growing hole', () => {
    for (const progress of [0.25, 0.3, 0.4, 0.5]) {
        const major = 0.5 + 0.25 * (progress * 4 - 1);
        for (const longitude of [-2, 0, 2]) for (const latitude of [-Math.PI / 2, -0.6, 0, 0.6, Math.PI / 2]) {
            const [x, y, z] = point(progress, longitude, latitude);
            close((Math.hypot(x, z) - major) ** 2 + y * y, 0.25);
        }
        close(Math.hypot(...point(progress, 0, Math.PI / 2)), major - 0.5);
    }
});

test('the first cut opens the torus into a straight horizontal cylinder with a back polar seam', () => {
    for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
        for (const latitude of [-Math.PI / 2, -0.6, 0, 0.6, Math.PI / 2]) {
            const [x, y, z] = point(0.75, longitude, latitude);
            close(x, 0.75 * longitude);
            close(y * y + (z - 0.5) ** 2, 0.25);
        }
        same(point(0.75, longitude, Math.PI / 2), [0.75 * longitude, 0, 0]);
        same(point(0.75, longitude, -Math.PI / 2), [0.75 * longitude, 0, 0]);
    }
    for (const p of [0, 0.25, 0.5]) same(point(p, -Math.PI, 0.5), point(p, Math.PI, 0.5));
    assert.ok(point(0.6, Math.PI, 0.5)[0] - point(0.6, -Math.PI, 0.5)[0] > 0.5);
});

test('opening and straightening preserve tube orientation without tilt or rolling', () => {
    for (let step = 25; step <= 75; step++) {
        for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
            for (const latitude of [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2]) {
                close(point(step / 100, longitude, latitude)[1], 0.5 * Math.sin(2 * latitude));
            }
        }
        for (const latitude of [-Math.PI / 4, 0, Math.PI / 4]) {
            close(point(step / 100, 0, latitude)[0], 0);
        }
    }
});

test('unrolling keeps the front fixed while the north and south halves open symmetrically', () => {
    for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
        const previousHeights = new Map();
        for (let step = 75; step <= 100; step++) {
            const progress = step / 100;
            same(point(progress, longitude, 0), [0.75 * longitude, 0, 1]);
            for (const latitude of [Math.PI / 6, Math.PI / 4, Math.PI / 2]) {
                const north = point(progress, longitude, latitude);
                const south = point(progress, longitude, -latitude);
                close(north[0], 0.75 * longitude);
                same(south, [north[0], -north[1], north[2]]);
                assert.ok(north[1] >= (previousHeights.get(latitude) ?? 0) - 1e-9);
                previousHeights.set(latitude, north[1]);
            }
        }
    }
});

test('the smaller hole carries through to a north-up rectangle with narrower longitude spacing', () => {
    close(Math.hypot(...point(0.5, 0, Math.PI / 2)), 0.25);
    const west = point(1, -Math.PI, 0), east = point(1, Math.PI, 0);
    const top = point(1, 0, Math.PI / 2), bottom = point(1, 0, -Math.PI / 2);
    close((east[0] - west[0]) / (top[1] - bottom[1]), 1.5);
    const north = point(0.8, 0, Math.PI / 2), south = point(0.8, 0, -Math.PI / 2);
    assert.ok(Math.hypot(...north.map((value, i) => value - south[i])) > 0.5);
    for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
        for (const latitude of [-Math.PI / 2, -0.6, 0, 0.6, Math.PI / 2]) {
            same(point(1, longitude, latitude), [0.75 * longitude, latitude, 1]);
            const expected = projectPoint(longitude, latitude, getProjectionState('equirectangular', 1), {});
            same(point(1, longitude, latitude), [0.75 * expected.x, expected.y, expected.z]);
        }
    }
});

test('all stages are continuous, finite, and inside the camera framing envelope', () => {
    for (const progress of [0.25, 0.5, 0.75]) {
        for (const latitude of [-Math.PI / 2, -0.6, 0, 0.6, Math.PI / 2]) {
            same(point(progress - 1e-8, 1.2, latitude), point(progress + 1e-8, 1.2, latitude), 1e-6);
        }
    }
    for (let step = 0; step <= 100; step++) {
        const state = getProjectionState('torus', step / 100);
        for (let row = 0; row <= 20; row++) for (let column = 0; column <= 32; column++) {
            const p = projectPoint(-Math.PI + Math.PI * column / 16, -Math.PI / 2 + Math.PI * row / 20, state, {});
            assert.ok([p.x, p.y, p.z].every(Number.isFinite));
            // The sampled envelope includes a fit margin in the scene.
            assert.ok(Math.abs(p.x) <= state.frameExtent[0] * 1.05 + 1e-9);
            assert.ok(Math.abs(p.y) <= state.frameExtent[1] * 1.05 + 1e-9);
            assert.ok(p.z <= state.frameExtent[2] * 1.05 + 1e-9);
        }
    }
});
