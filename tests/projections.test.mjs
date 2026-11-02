import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, getProjectionCheckpoints, getNextProjectionCheckpoint, getPreviousProjectionCheckpoint, projectPoint } from '../js/projections.js';
import { GOODE_LOBES, GOODE_TRANSITION, latitudeProfile } from '../js/pseudocylindrical.js';

const types = ['sinusoidal', 'robinson', 'equal-earth', 'goode'];
const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const point = (type, progress, longitude, latitude, center) => projectPoint(longitude, latitude,
  getProjectionState(type, progress), {}, center);

test('all new projections start on the full sphere and finish on one plane', () => {
  for (const type of types) {
    for (const latitude of [-Math.PI / 2, -1, 0, 1, Math.PI / 2]) {
      for (const longitude of [-Math.PI, -1, 0, 1, Math.PI]) {
        const globe = point(type, 0, longitude, latitude);
        close(globe.x, Math.cos(latitude) * Math.sin(longitude));
        close(globe.y, Math.sin(latitude));
        close(globe.z, Math.cos(latitude) * Math.cos(longitude));
        close(point(type, 1, longitude, latitude).z, 1);
      }
    }
  }
});

test('every animation stage remains finite, including poles and cut edges', () => {
  for (const type of types) {
    for (let step = 0; step <= 100; step++) {
      const state = getProjectionState(type, step / 100);
      for (const lobe of GOODE_LOBES) {
        for (const latitude of [lobe.south, (lobe.south + lobe.north) / 2, lobe.north]) {
          for (const longitude of [lobe.west, lobe.center, lobe.east]) {
            const p = projectPoint(longitude, latitude, state, {}, lobe.center);
            assert.ok(Object.values(p).every(Number.isFinite), `${type}/${step}: ${JSON.stringify(p)}`);
          }
        }
      }
    }
  }
});

test('Sinusoidal final coordinates and first-stage latitude heights are exact', () => {
  const p = point('sinusoidal', 1, 1.2, 0.8);
  close(p.x, 1.2 * Math.cos(0.8)); close(p.y, 0.8);
  const prepared = point('sinusoidal', 0.5, 1.2, 0.8);
  close(Math.hypot(prepared.x, prepared.z), Math.cos(0.8));
  close(prepared.y, 0.8);
});

test('Robinson matches published table anchors and retains its straight polar edges', () => {
  for (const [degrees, width, height] of [[0, 1, 0], [30, 0.96, 0.372], [60, 0.7986, 0.7346], [90, 0.5322, 1]]) {
    const p = point('robinson', 1, 1, degrees * Math.PI / 180);
    close(p.x, 0.8487 * width); close(p.y, 1.3523 * height);
  }
  assert.ok(point('robinson', 1, Math.PI, Math.PI / 2).x > 1);
});

test('Equal Earth agrees with the PROJ unit-sphere example', () => {
  const p = point('equal-earth', 1, 122 * Math.PI / 180, 47 * Math.PI / 180);
  close(p.x, 1.55, 0.005); close(p.y, 0.89, 0.005);
});

test('equal-area projections preserve the unit sphere area element', () => {
  const epsilon = 1e-6;
  for (const type of ['sinusoidal', 'equal-earth', 'goode']) {
    for (const latitude of [-1.3, -1, -0.5, 0, 0.5, 1, 1.3]) {
      const before = latitudeProfile(type, latitude - epsilon);
      const after = latitudeProfile(type, latitude + epsilon);
      const profile = latitudeProfile(type, latitude);
      const area = profile.radius * (after.height - before.height) / (2 * epsilon);
      close(area, Math.cos(latitude), 1e-7);
    }
  }
});

test('Goode has continuous Sinusoidal/Mollweide joins and the proposed checkpoints', () => {
  for (const sign of [-1, 1]) {
    const lower = latitudeProfile('goode', sign * (GOODE_TRANSITION - 1e-9));
    const upper = latitudeProfile('goode', sign * (GOODE_TRANSITION + 1e-9));
    close(lower.radius, upper.radius, 1e-7); close(lower.height, upper.height, 1e-7);
  }
  for (const latitude of [-1.3, -0.5, 0.5, 1.3]) {
    assert.deepEqual(point('goode', 0.25, 1, latitude), point('sinusoidal', 0.5, 1, latitude));
    const flat = point('goode', 0.5, 1, latitude);
    close(flat.x, Math.cos(latitude)); close(flat.y, latitude); close(flat.z, 1);
    const uncut = point('goode', 0.75, 1, latitude);
    const profile = latitudeProfile('goode', latitude);
    close(uncut.x, profile.radius); close(uncut.y, profile.height);
  }
});

test('Goode separates cut edges, keeps the equator connected, and collapses each lobe at its own pole', () => {
  for (const lobe of GOODE_LOBES) {
    const latitude = lobe.north > 0 ? 1 : -1;
    const p = point('goode', 1, lobe.center + 0.2, latitude, lobe.center);
    close(p.x, lobe.center + 0.2 * latitudeProfile('goode', latitude).radius);
    close(point('goode', 1, lobe.west, 0, lobe.center).x, lobe.west);
    close(point('goode', 1, lobe.west, Math.sign(latitude) * Math.PI / 2, lobe.center).x, lobe.center);
  }
  const boundary = GOODE_LOBES[0].east;
  const left = point('goode', 1, boundary, 1, GOODE_LOBES[0].center);
  const right = point('goode', 1, boundary, 1, GOODE_LOBES[1].center);
  assert.ok(right.x - left.x > 0.5);
});

test('N checkpoints match the added stage structures and tolerate rounded thirds', () => {
  for (const type of types) {
    assert.deepEqual(getProjectionCheckpoints(type), type === 'goode' ? [0, 0.25, 0.5, 0.75, 1] : [0, 0.5, 1]);
    close(getNextProjectionCheckpoint(type, 1), 0);
  }
  close(getNextProjectionCheckpoint('mercator', 0.333), 2 / 3);
  close(getNextProjectionCheckpoint('goode', 0.25), 0.5);
  close(getNextProjectionCheckpoint('robinson', 0.25), 0.5);
});

test('backward checkpoints reverse every stage sequence, wrap, and tolerate rounded values', () => {
  for (const type of ['mercator', 'same-height', 'classic', ...types]) {
    const stages = getProjectionCheckpoints(type);
    close(getPreviousProjectionCheckpoint(type, 0), 1);
    for (let i = 1; i < stages.length; i++) {
      close(getPreviousProjectionCheckpoint(type, stages[i]), stages[i - 1]);
      close(getPreviousProjectionCheckpoint(type, (stages[i] + stages[i - 1]) / 2), stages[i - 1]);
    }
  }
  close(getPreviousProjectionCheckpoint('mercator', 0.33), 0);
  close(getPreviousProjectionCheckpoint('goode', 0.67), 0.5);
});
