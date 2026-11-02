import test from 'node:test';
import assert from 'node:assert/strict';
import { createBodies, createSimulation, stepPhysics, collideCamera, GRAVITY, TICK_SECONDS } from './physics.js';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(
  Math.abs(actual - expected) < tolerance, `${actual} should be close to ${expected}`);
const momentum = bodies => ['x', 'y', 'z'].map(axis => bodies.reduce((sum, body) => sum + body.velocity[axis] * body.mass, 0));
const energy = bodies => {
  let total = bodies.reduce((sum, b) => sum + b.mass *
    (b.velocity.x ** 2 + b.velocity.y ** 2 + b.velocity.z ** 2) / 2, 0);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const distance = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
      total -= GRAVITY * a.mass * b.mass / Math.sqrt(distance ** 2 + 0.0004);
    }
  }
  return total;
};
const body = (x, vx, mass = 1) => ({ mass, radius: 0.5, position: { x, y: 0, z: 0 }, velocity: { x: vx, y: 0, z: 0 } });

test('three moving bodies start with no centre-of-mass drift', () => {
  const bodies = createBodies();
  assert.deepEqual(bodies.map(b => b.id), ['earth', 'moon', 'mars']);
  for (const p of momentum(bodies)) close(p, 0);
  for (const axis of ['x', 'y', 'z']) close(bodies.reduce((sum, b) => sum + b.mass * b.position[axis], 0), 0);
  assert.ok(bodies.every(b => Math.hypot(...Object.values(b.velocity)) > 0));
});

test('zero ticks per second freezes all physics, including fractional ticks', () => {
  const simulation = createSimulation();
  simulation.advance(0.003, 120);
  const before = structuredClone(simulation.bodies);
  simulation.advance(600, 0);
  assert.deepEqual(simulation.bodies, before);
  assert.equal(simulation.ticks, 0);
  simulation.advance(1 - 0.003, 120);
  assert.equal(simulation.ticks, 120);
});

test('tick rate scales simulation time independently of frame rate', () => {
  const once = createSimulation();
  const frames = createSimulation();
  once.advance(1, 240);
  for (let i = 0; i < 144; i++) frames.advance(1 / 144, 240);
  assert.equal(once.ticks, 240);
  assert.equal(frames.ticks, 240);
  assert.deepEqual(once.bodies, frames.bodies);
});

test('all bodies attract one another and total momentum is conserved', () => {
  const bodies = [body(-3, 0, 1), body(2, 0, 0.1), body(5, 0, 0.01)];
  stepPhysics(bodies);
  assert.ok(bodies[0].velocity.x > 0);
  assert.ok(bodies[2].velocity.x < 0);
  for (const p of momentum(bodies)) close(p, 0);
  const withThirdBody = bodies[0].velocity.x;
  const pair = [body(-3, 0, 1), body(2, 0, 0.1)];
  stepPhysics(pair);
  assert.ok(withThirdBody > pair[0].velocity.x);
});

test('friction damps all velocity axes by 1% per tick and stops when released', () => {
  const bodies = [body(0, 100)];
  bodies[0].velocity.y = -50;
  bodies[0].velocity.z = 25;
  for (let i = 0; i < 120; i++) stepPhysics(bodies, TICK_SECONDS, { gravity: 0, friction: 0.01 });
  close(bodies[0].velocity.x, 100 * 0.99 ** 120);
  close(bodies[0].velocity.y, -50 * 0.99 ** 120);
  close(bodies[0].velocity.z, 25 * 0.99 ** 120);
  const released = { ...bodies[0].velocity };
  stepPhysics(bodies, TICK_SECONDS, { gravity: 0 });
  assert.deepEqual(bodies[0].velocity, released);
});

test('simulation applies friction per tick, independently of render rate, and respects pause', () => {
  const once = createSimulation();
  const frames = createSimulation();
  once.advance(1, 120, { friction: 0.01 });
  for (let i = 0; i < 60; i++) frames.advance(1 / 60, 120, { friction: 0.01 });
  assert.deepEqual(once.bodies, frames.bodies);
  const paused = structuredClone(once.bodies);
  once.advance(10, 0, { friction: 0.01 });
  assert.deepEqual(once.bodies, paused);
  const normal = createSimulation();
  normal.advance(1, 120);
  assert.ok(energy(once.bodies) < energy(normal.bodies));
});

test('default system stays bound with stable energy for ten simulated minutes', () => {
  const bodies = createBodies();
  const initial = energy(bodies);
  let collisions = 0;
  for (let i = 0; i < 600 / TICK_SECONDS; i++) collisions += stepPhysics(bodies);
  assert.equal(collisions, 0);
  assert.ok(Math.abs((energy(bodies) - initial) / initial) < 0.0001);
  for (const b of bodies) assert.ok(Math.hypot(...Object.values(b.position)) < 20);
  for (const p of momentum(bodies)) close(p, 0, 1e-10);
});

test('fast head-on impacts cannot tunnel and conserve momentum', () => {
  const bodies = [body(-3, 1000, 2), body(3, -500, 1)];
  const before = momentum(bodies);
  const hits = stepPhysics(bodies, TICK_SECONDS, { gravity: 0, restitution: 0.8 });
  assert.equal(hits, 1);
  assert.ok(bodies[0].position.x < bodies[1].position.x);
  assert.ok(bodies[0].velocity.x < bodies[1].velocity.x);
  momentum(bodies).forEach((p, i) => close(p, before[i]));
  close(bodies[1].velocity.x - bodies[0].velocity.x, 1500 * 0.8);
});

test('initial overlaps, including coincident centres, resolve without NaNs', () => {
  const bodies = [body(0, 0, 2), body(0, 0, 1), body(4, 0)];
  stepPhysics(bodies, TICK_SECONDS, { gravity: 0 });
  assert.ok(bodies[1].position.x - bodies[0].position.x >= 1);
  assert.ok(bodies.every(b => Object.values(b.position).every(Number.isFinite)));
});

test('camera cannot fly straight through a planet, even while paused', () => {
  const planets = [body(0, 0)];
  const safe = collideCamera({ x: -4, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, planets);
  assert.ok(safe.x <= -0.58);
  assert.ok(Number.isFinite(safe.x));
});

test('a moving planet cannot pass through the camera', () => {
  const planets = [body(3, 0)];
  const camera = { x: 0, y: 0, z: 0 };
  const safe = collideCamera(camera, camera, planets, [{ x: -3, y: 0, z: 0 }]);
  assert.ok(safe.x >= 3.58);
});

test('camera recovers from starting inside a planet', () => {
  const safe = collideCamera({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, [body(0, 0)]);
  assert.ok(Math.hypot(...Object.values(safe)) >= 0.58);
});

test('reset restores positions, velocities, collision count, and tick clock', () => {
  const simulation = createSimulation();
  simulation.advance(20, 480);
  simulation.reset();
  assert.deepEqual(simulation.bodies, createBodies());
  assert.equal(simulation.ticks, 0);
  assert.equal(simulation.collisions, 0);
  simulation.advance(1, 120);
  assert.equal(simulation.ticks, 120);
});
