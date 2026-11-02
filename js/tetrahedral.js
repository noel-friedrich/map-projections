// Lee's conformal tetrahedral mapping: stereographic coordinates followed by
// integral (1 - z^3)^(-1/2) dz. See assets/projection-sources.txt.
const SQRT2 = Math.SQRT2;
const FACE_RADIUS = Math.sqrt(8);
const LEE_VERTEX = 1.4021821053254548;
const OPEN_ANGLE = -Math.acos(-1 / 3);
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, k) => a.map(v => v * k);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = a => scale(a, 1 / Math.hypot(...a));
const multiply = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const clamp01 = t => Math.max(0, Math.min(1, t));

export const TETRA_VERTICES = [
  [0, FACE_RADIUS, 1], [-Math.sqrt(6), -SQRT2, 1],
  [Math.sqrt(6), -SQRT2, 1], [0, 0, -3],
];
export const TETRA_FACES = [[0, 1, 2], [3, 2, 1], [3, 0, 2], [3, 1, 0]].map((indices, id) => {
  const vertices = indices.map(index => TETRA_VERTICES[index]);
  const normal = normalize(vertices.reduce(add, [0, 0, 0]));
  const right = normalize(sub(vertices[0], normal));
  const up = cross(normal, right);
  const edge = id === 0 ? [0, 1] : [[1, 2], [2, 0], [0, 1]][id - 1];
  const hinge = TETRA_VERTICES[edge[0]];
  return { id, vertices, normal, right, up, hinge,
    axis: normalize(sub(TETRA_VERTICES[edge[1]], hinge)) };
});

// Two convergent series for the same integral. Expanding around the nearest
// corner avoids slow convergence at the three square-root singularities.
const centerCoefficients = [];
const cornerCoefficients = [];
let binomial = 1, previous = 0, current = 1;
for (let n = 0; n < 40; n++) {
  centerCoefficients.push(binomial / (3 * n + 1));
  cornerCoefficients.push(2 * current / (Math.sqrt(3) * (2 * n + 1)));
  binomial *= (2 * n + 1) / (2 * n + 2);
  const next = ((n + 0.5) * current - n / 3 * previous) / (n + 1);
  previous = current;
  current = next;
}
function polynomial(coefficients, z) {
  let value = [0, 0];
  for (let i = coefficients.length - 1; i >= 0; i--) {
    value = multiply(value, z);
    value[0] += coefficients[i];
  }
  return value;
}

export function leeIntegral(z) {
  if (Math.hypot(...z) <= 0.6) return multiply(z, polynomial(centerCoefficients, multiply(multiply(z, z), z)));
  const rotations = [[1, 0], [-0.5, Math.sqrt(3) / 2], [-0.5, -Math.sqrt(3) / 2]];
  const rotation = rotations.reduce((best, r) => multiply(z, r)[0] > multiply(z, best)[0] ? r : best);
  const rotated = multiply(z, rotation);
  const y = [1 - rotated[0], -rotated[1]];
  const magnitude = Math.hypot(...y);
  const root = [Math.sqrt(Math.max(0, (magnitude + y[0]) / 2)),
    Math.sign(y[1]) * Math.sqrt(Math.max(0, (magnitude - y[0]) / 2))];
  const correction = multiply(root, polynomial(cornerCoefficients, y));
  return multiply([LEE_VERTEX - correction[0], -correction[1]], [rotation[0], -rotation[1]]);
}

export function createTetrahedralCoordinate(direction, faceId) {
  const face = faceId === undefined ? TETRA_FACES.reduce((best, candidate) =>
    dot(direction, candidate.normal) > dot(direction, best.normal) ? candidate : best) : TETRA_FACES[faceId];
  const denominator = 1 + dot(direction, face.normal);
  const z = [SQRT2 * dot(direction, face.right) / denominator, SQRT2 * dot(direction, face.up) / denominator];
  const mapped = leeIntegral(z);
  const target = add(face.normal, add(scale(face.right, mapped[0] * FACE_RADIUS / LEE_VERTEX),
    scale(face.up, mapped[1] * FACE_RADIUS / LEE_VERTEX)));
  return { direction, target, face };
}

export function animateTetrahedral(coordinate, progress, position) {
  const shape = clamp01(progress * 2), unfold = clamp01(progress * 2 - 1);
  const { direction, target, face } = coordinate;
  let point = target;
  if (unfold > 0 && face.id !== 0) {
    const relative = sub(target, face.hinge);
    const cosine = Math.cos(OPEN_ANGLE * unfold), sine = Math.sin(OPEN_ANGLE * unfold);
    point = add(face.hinge, add(add(scale(relative, cosine), scale(cross(face.axis, relative), sine)),
      scale(face.axis, dot(face.axis, relative) * (1 - cosine))));
  }
  position.x = direction[0] + (point[0] - direction[0]) * shape;
  position.y = direction[1] + (point[1] - direction[1]) * shape + SQRT2 * unfold;
  position.z = direction[2] + (point[2] - direction[2]) * shape;
  // Present the closed solid obliquely so its side faces are visible. This is a
  // rigid rotation of the whole assembly, settling back to the plane as it opens.
  const tilt = shape * (1 - unfold);
  const yaw = tilt * Math.PI / 4, pitch = tilt * Math.PI / 6;
  const x = position.x * Math.cos(yaw) + position.z * Math.sin(yaw);
  const z = -position.x * Math.sin(yaw) + position.z * Math.cos(yaw);
  const y = position.y * Math.cos(pitch) - z * Math.sin(pitch);
  position.z = position.y * Math.sin(pitch) + z * Math.cos(pitch);
  position.x = x;
  position.y = y;
  return position;
}
