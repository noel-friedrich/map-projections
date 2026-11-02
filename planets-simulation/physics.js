// Earth radii and Earth masses; time and distances are compressed for exploration.
export const TICK_SECONDS = 1 / 120;
export const GRAVITY = 10;
const AXES = ['x', 'y', 'z'];
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export function createBodies() {
  const moonSpeed = Math.sqrt(GRAVITY * (1 + 0.0123) / 3.6);
  const marsSpeed = Math.sqrt(GRAVITY * (1 + 0.0123 + 0.1074) / 11);
  const bodies = [
    { id: 'earth', name: 'Earth', mass: 1, radius: 1, color: '#8db5cb',
      position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, spin: 0.12 },
    { id: 'moon', name: 'Moon', mass: 0.0123, radius: 0.2727, color: '#d5d2ca',
      position: { x: 3.6, y: 0, z: 0 },
      velocity: { x: 0, y: moonSpeed * Math.sin(0.15), z: moonSpeed * Math.cos(0.15) }, spin: 0.035 },
    { id: 'mars', name: 'Mars', mass: 0.1074, radius: 0.532, color: '#da9273',
      position: { x: -11, y: 0, z: 0 },
      velocity: { x: 0, y: marsSpeed * Math.sin(0.08), z: -marsSpeed * Math.cos(0.08) }, spin: 0.116 },
  ];
  // Build a hierarchical initial orbit, then move into the centre-of-mass frame.
  for (const axis of AXES) {
    const innerVelocity = bodies[1].velocity[axis] * bodies[1].mass / (1 + bodies[1].mass);
    bodies[0].velocity[axis] -= innerVelocity;
    bodies[1].velocity[axis] -= innerVelocity;
    const totalMass = bodies.reduce((sum, body) => sum + body.mass, 0);
    const center = bodies.reduce((sum, body) => sum + body.position[axis] * body.mass, 0) / totalMass;
    const drift = bodies.reduce((sum, body) => sum + body.velocity[axis] * body.mass, 0) / totalMass;
    for (const body of bodies) {
      body.position[axis] -= center;
      body.velocity[axis] -= drift;
    }
  }
  return bodies;
}

function accelerations(bodies, gravity) {
  const values = bodies.map(() => ({ x: 0, y: 0, z: 0 }));
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const difference = subtract(bodies[j].position, bodies[i].position);
      const force = gravity / (dot(difference, difference) + 0.0004) ** 1.5;
      for (const axis of AXES) {
        values[i][axis] += difference[axis] * force * bodies[j].mass;
        values[j][axis] -= difference[axis] * force * bodies[i].mass;
      }
    }
  }
  return values;
}

// First intersection of a moving point with a sphere centred on the origin.
// Testing the whole segment prevents fast bodies or the camera tunnelling through.
export function sphereHit(start, displacement, radius) {
  const c = dot(start, start) - radius * radius;
  if (c < -1e-10) return 0;
  const a = dot(displacement, displacement);
  const b = dot(start, displacement);
  if (a < 1e-20 || b >= 0) return null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / a;
  return time >= -1e-10 && time <= 1 ? Math.max(0, time) : null;
}

function resolveContact(a, b, restitution) {
  const normal = subtract(b.position, a.position);
  const distance = Math.hypot(normal.x, normal.y, normal.z);
  if (distance < 1e-12) Object.assign(normal, { x: 1, y: 0, z: 0 });
  else for (const axis of AXES) normal[axis] /= distance;
  const inverseMass = 1 / a.mass + 1 / b.mass;
  const overlap = Math.max(0, a.radius + b.radius - distance) + 1e-8;
  const closingSpeed = dot(subtract(b.velocity, a.velocity), normal);
  const impulse = closingSpeed < 0 ? -(1 + restitution) * closingSpeed / inverseMass : 0;
  for (const axis of AXES) {
    a.position[axis] -= normal[axis] * overlap / (a.mass * inverseMass);
    b.position[axis] += normal[axis] * overlap / (b.mass * inverseMass);
    a.velocity[axis] -= impulse * normal[axis] / a.mass;
    b.velocity[axis] += impulse * normal[axis] / b.mass;
  }
  return impulse > 0;
}

export function stepPhysics(bodies, dt = TICK_SECONDS, { gravity = GRAVITY, restitution = 0.8, friction = 0 } = {}) {
  const before = accelerations(bodies, gravity);
  for (let i = 0; i < bodies.length; i++) {
    for (const axis of AXES) bodies[i].velocity[axis] += before[i][axis] * dt / 2;
  }
  let remaining = dt;
  let collisions = 0;
  // Resolve impacts in chronological order within the tick.
  for (let iteration = 0; iteration < 24 && remaining > 1e-12; iteration++) {
    let impact = null;
    let fraction = 1;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const relativeVelocity = subtract(bodies[j].velocity, bodies[i].velocity);
        for (const axis of AXES) relativeVelocity[axis] *= remaining;
        const time = sphereHit(subtract(bodies[j].position, bodies[i].position),
          relativeVelocity, bodies[i].radius + bodies[j].radius);
        if (time !== null && time <= fraction) {
          fraction = time;
          impact = [bodies[i], bodies[j]];
        }
      }
    }
    for (const body of bodies) {
      for (const axis of AXES) body.position[axis] += body.velocity[axis] * remaining * fraction;
    }
    remaining *= 1 - fraction;
    if (impact && resolveContact(...impact, restitution)) collisions++;
    if (!impact) break;
    // If simultaneous contacts exhaust the loop, leave the unused time unapplied.
  }
  const after = accelerations(bodies, gravity);
  const retention = 1 - friction;
  for (let i = 0; i < bodies.length; i++) {
    for (const axis of AXES) {
      bodies[i].velocity[axis] = (bodies[i].velocity[axis] + after[i][axis] * dt / 2) * retention;
    }
  }
  return collisions;
}

export function createSimulation() {
  let bodies = createBodies();
  let tickRemainder = 0;
  let ticks = 0;
  let collisions = 0;
  return {
    get bodies() { return bodies; },
    get ticks() { return ticks; },
    get collisions() { return collisions; },
    advance(realSeconds, ticksPerSecond, { friction = 0 } = {}) {
      if (ticksPerSecond <= 0 || realSeconds <= 0) return;
      tickRemainder += realSeconds * ticksPerSecond;
      const count = Math.floor(tickRemainder + 1e-10);
      tickRemainder = Math.max(0, tickRemainder - count);
      for (let i = 0; i < count; i++) {
        collisions += stepPhysics(bodies, TICK_SECONDS, { friction });
        ticks++;
      }
    },
    reset() {
      bodies = createBodies();
      tickRemainder = ticks = collisions = 0;
    },
  };
}

export function collideCamera(start, end, bodies, previousPositions = bodies.map(body => body.position), padding = 0.08) {
  const result = { ...end };
  // Work relative to each moving planet, then slide along its surface.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const relativeStart = subtract(start, previousPositions[i]);
      const relativeEnd = subtract(result, body.position);
      const movement = subtract(relativeEnd, relativeStart);
      const radius = body.radius + padding;
      const time = sphereHit(relativeStart, movement, radius);
      if (time !== null) {
        const normal = { ...relativeStart };
        for (const axis of AXES) normal[axis] += movement[axis] * time;
        const length = Math.hypot(normal.x, normal.y, normal.z);
        if (length < 1e-12) Object.assign(normal, { x: 1, y: 0, z: 0 });
        else for (const axis of AXES) normal[axis] /= length;
        const inward = Math.min(0, dot(movement, normal));
        for (const axis of AXES) {
          result[axis] = body.position[axis] + normal[axis] * (radius + 1e-6) +
            (movement[axis] - normal[axis] * inward) * (1 - time);
        }
      }
      const offset = subtract(result, body.position);
      const distance = Math.hypot(offset.x, offset.y, offset.z);
      if (distance < radius) {
        if (distance < 1e-12) Object.assign(offset, { x: 1, y: 0, z: 0 });
        const scale = (radius + 1e-6) / (distance || 1);
        for (const axis of AXES) result[axis] = body.position[axis] + offset[axis] * scale;
      }
    }
  }
  return result;
}
