import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectionCatalog } from "../js/projection-catalog.js";
import {
    localDistortion,
    measureProjectionDistortion,
} from "../js/distortion.js";
import { distortionScores } from "../js/distortion-data.js";

const close = (actual, expected, tolerance = 1e-4) =>
    assert.ok(
        Math.abs(actual - expected) < tolerance,
        `${actual} != ${expected}`,
    );

test("local distortion recovers known area and angle errors from perpendicular stretches", () => {
    const result = localDistortion(([x, y]) => [2 * x, 3 * y, 0], [0, 0, 1]);
    close(result.area, 6);
    close(result.angle, (2 * Math.asin(1 / 5) * 180) / Math.PI);
});

test("angle error is unchanged by uniform scaling, while area scales quadratically", () => {
    const direction = [0.3, 0.4, Math.sqrt(0.75)];
    const original = localDistortion(([x, y, z]) => [x, 2 * y, z], direction);
    const scaled = localDistortion(
        ([x, y, z]) => [7 * x, 14 * y, 7 * z],
        direction,
    );
    close(scaled.area, original.area * 49);
    close(scaled.angle, original.angle);
});

test("an undistorted sphere has unit area scale and zero angular error", () => {
    const result = localDistortion(
        (point) => point,
        [0.3, 0.4, Math.sqrt(0.75)],
    );
    close(result.area, 1);
    close(result.angle, 0);
});

test("numerical measurements recover equal-area projections without hardcoded property scores", () => {
    for (const type of [
        "same-height",
        "sinusoidal",
        "equal-earth",
        "goode",
        "lambert-azimuthal",
    ]) {
        const score = measureProjectionDistortion(type, 4096);
        assert.equal(score.areaDifference, 0, type);
        assert.ok(score.angleError > 0, type);
        assert.equal(distortionScores[type].areaDifference, 0, type);
    }
});

test("numerical measurements recover conformal projections, including tetrahedral cuts", () => {
    for (const type of ["mercator", "tetrahedral"]) {
        const score = measureProjectionDistortion(type, 4096);
        assert.equal(score.angleError, 0, type);
        assert.ok(score.areaDifference > 0, type);
        assert.equal(distortionScores[type].angleError, 0, type);
    }
});

test("generated scores cover every selectable projection and respect the fixed bar scales", () => {
    const types = projectionCatalog.map(item => item.id);
    assert.deepEqual(Object.keys(distortionScores).sort(), types.sort());
    for (const score of Object.values(distortionScores)) {
        assert.ok(
            Number.isFinite(score.areaDifference) &&
                score.areaDifference >= 0 &&
                score.areaDifference <= 200,
        );
        assert.ok(
            Number.isFinite(score.angleError) &&
                score.angleError >= 0 &&
                score.angleError <= 180,
        );
    }
    for (const type of ["classic", "equirectangular", "robinson"]) {
        assert.ok(distortionScores[type].areaDifference > 0);
        assert.ok(distortionScores[type].angleError > 0);
    }
});

test("every projection has a generated 640 by 400 PNG preview", () => {
    for (const { id } of projectionCatalog) {
        const png = readFileSync(new URL(`../assets/projections/${id}.png`, import.meta.url));
        assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', id);
        assert.equal(png.readUInt32BE(16), 640, id);
        assert.equal(png.readUInt32BE(20), 400, id);
    }
});
