import test from "node:test";
import assert from "node:assert/strict";
import {
    getProjectionState,
    projectPoint,
    projectAzimuthal,
    getProjectionCheckpoints,
    getNextProjectionCheckpoint,
    getPreviousProjectionCheckpoint,
} from "../js/projections.js";
import {
    TETRA_FACES,
    createTetrahedralCoordinate,
    animateTetrahedral,
} from "../js/tetrahedral.js";

const close = (a, b, tolerance = 1e-7) =>
    assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const unit = (a) => a.map((v) => v / Math.hypot(...a));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const point = (type, progress, longitude, latitude) =>
    projectPoint(longitude, latitude, getProjectionState(type, progress), {});
const coords = (p) => [p.x, p.y, p.z];

test("Equirectangular has a 2:1 rectangular extent and preserves meridian distances", () => {
    const p = point("equirectangular", 1, 1.7, 0.9);
    close(p.x, 1.7);
    close(p.y, 0.9);
    close(p.z, 1);
    close(point("equirectangular", 1, Math.PI, Math.PI / 2).x, Math.PI);
    close(point("equirectangular", 1, Math.PI, Math.PI / 2).y, Math.PI / 2);
    const cylinder = point("equirectangular", 0.5, 1.7, 0.9);
    close(Math.hypot(cylinder.x, cylinder.z), 1);
    close(cylinder.y, 0.9);
});

test("Lambert azimuthal preserves area and maps chord distances from its center", () => {
    const epsilon = 1e-6;
    for (const angle of [0.1, 0.5, 1, 2, 3]) {
        const p = projectAzimuthal(angle, 0.7, 1, {});
        const radius = Math.hypot(p.x, p.y);
        close(radius, Math.hypot(Math.sin(angle), Math.cos(angle) - 1));
        close(p.z, 1);
        const before = projectAzimuthal(angle - epsilon, 0, 1, {}).x;
        const after = projectAzimuthal(angle + epsilon, 0, 1, {}).x;
        close((radius * (after - before)) / (2 * epsilon), Math.sin(angle));
    }
    const rim = projectAzimuthal(Math.PI, 0, 0.5, {});
    close(rim.x, Math.SQRT2);
    close(rim.z, 1 - Math.SQRT2);
    for (const angle of [0, 0.5, 1, 2, Math.PI]) {
        const bowl = projectAzimuthal(angle, 0, 0.5, {});
        close(bowl.x ** 2 + (bowl.z - (1 - Math.SQRT2)) ** 2, 2);
    }
    const final = projectAzimuthal(Math.PI, 1, 1, {});
    close(Math.hypot(final.x, final.y), 2);
});

test("Lee maps each spherical corner exactly onto its tetrahedron vertex", () => {
    for (const face of TETRA_FACES) {
        for (const vertex of face.vertices) {
            const coordinate = createTetrahedralCoordinate(
                unit(vertex),
                face.id,
            );
            assert.ok(
                distance(coordinate.target, vertex) < 1e-6,
                `face ${face.id}: ${coordinate.target}`,
            );
        }
    }
});

test("the first tetrahedral stage projects onto a fixed surrounding tetrahedron without rotation", () => {
    for (const face of TETRA_FACES) {
        const center = createTetrahedralCoordinate(face.normal, face.id);
        const sample = createTetrahedralCoordinate(
            unit(face.normal.map((v, i) => v + face.right[i] * 0.2)),
            face.id,
        );
        for (const progress of [0, 0.1, 0.25, 0.4, 0.5]) {
            assert.ok(
                distance(
                    coords(animateTetrahedral(center, progress, {})),
                    face.normal,
                ) < 1e-7,
            );
            const expected = sample.direction.map(
                (v, i) => v + (sample.target[i] - v) * progress * 2,
            );
            assert.ok(
                distance(
                    coords(animateTetrahedral(sample, progress, {})),
                    expected,
                ) < 1e-7,
            );
        }
        close(dot(coords(animateTetrahedral(sample, 0.5, {})), face.normal), 1);
    }
});

test("Lee face mappings meet continuously along all six tetrahedral edges", () => {
    for (let i = 0; i < 4; i++)
        for (let j = i + 1; j < 4; j++) {
            const a = TETRA_FACES[i],
                b = TETRA_FACES[j];
            const shared = a.vertices.filter((v) => b.vertices.includes(v));
            assert.equal(shared.length, 2);
            for (const t of [0.01, 0.1, 0.3, 0.5, 0.8, 0.99]) {
                const direction = unit(
                    shared[0].map(
                        (v, axis) => v * (1 - t) + shared[1][axis] * t,
                    ),
                );
                const first = createTetrahedralCoordinate(direction, i).target;
                const second = createTetrahedralCoordinate(direction, j).target;
                assert.ok(
                    distance(first, second) < 1e-7,
                    `${i}/${j}/${t}: ${distance(first, second)}`,
                );
            }
        }
});

test("Lee preserves local angles and equal directional scale inside every face", () => {
    const epsilon = 1e-6;
    for (const face of TETRA_FACES) {
        const direction = unit(
            face.normal.map(
                (v, i) => v + face.right[i] * 0.25 + face.up[i] * 0.1,
            ),
        );
        const longitude = Math.atan2(direction[0], direction[2]),
            latitude = Math.asin(direction[1]);
        const map = (lon, lat) =>
            createTetrahedralCoordinate(
                [
                    Math.cos(lat) * Math.sin(lon),
                    Math.sin(lat),
                    Math.cos(lat) * Math.cos(lon),
                ],
                face.id,
            ).target;
        const left = map(longitude - epsilon, latitude),
            right = map(longitude + epsilon, latitude);
        const below = map(longitude, latitude - epsilon),
            above = map(longitude, latitude + epsilon);
        const horizontal = right.map(
            (v, i) => (v - left[i]) / (2 * epsilon * Math.cos(latitude)),
        );
        const vertical = above.map((v, i) => (v - below[i]) / (2 * epsilon));
        close(Math.hypot(...horizontal), Math.hypot(...vertical), 1e-5);
        close(dot(horizontal, vertical), 0, 1e-5);
    }
});

test("tetrahedral unfolding uses rigid faces, fixed hinges and a final flat net", () => {
    for (const face of TETRA_FACES) {
        const center = createTetrahedralCoordinate(face.normal, face.id);
        const corner = createTetrahedralCoordinate(
            unit(face.vertices[0]),
            face.id,
        );
        for (const progress of [0.5, 0.6, 0.75, 0.9, 1]) {
            const a = coords(animateTetrahedral(center, progress, {}));
            const b = coords(animateTetrahedral(corner, progress, {}));
            close(distance(a, b), distance(center.target, corner.target));
            if (progress === 1) {
                close(a[2], 1);
                close(b[2], 1);
            }
            if (face.id !== 0) {
                const direction = unit(face.hinge);
                const side = animateTetrahedral(
                    createTetrahedralCoordinate(direction, face.id),
                    progress,
                    {},
                );
                const root = animateTetrahedral(
                    createTetrahedralCoordinate(direction, 0),
                    progress,
                    {},
                );
                assert.ok(distance(coords(side), coords(root)) < 1e-6);
            }
        }
    }
});

test("all three animations start on a sphere and stay finite throughout", () => {
    for (const type of [
        "equirectangular",
        "tetrahedral",
        "lambert-azimuthal",
    ]) {
        for (let step = 0; step <= 100; step += 5) {
            for (const longitude of [-Math.PI, -1, 0, 1, Math.PI])
                for (const latitude of [-Math.PI / 2, -1, 0, 1, Math.PI / 2]) {
                    const p = point(type, step / 100, longitude, latitude);
                    assert.ok(Object.values(p).every(Number.isFinite));
                    if (step === 0) close(Math.hypot(...coords(p)), 1);
                    if (step === 100) close(p.z, 1);
                }
        }
        assert.deepEqual(getProjectionCheckpoints(type), [0, 0.5, 1]);
        close(getNextProjectionCheckpoint(type, 0), 0.5);
        close(getPreviousProjectionCheckpoint(type, 0), 1);
    }
});
