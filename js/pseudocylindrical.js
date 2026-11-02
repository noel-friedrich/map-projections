// Unit-sphere projection equations. Sources are recorded in assets/projection-sources.txt.
const HALF_PI = Math.PI / 2;
export const GOODE_TRANSITION = 0.7109889596207567;
const GOODE_Y_OFFSET = 0.0528035274542;
const radians = degrees => degrees * Math.PI / 180;

// Separate patches share their edges until the interruptions open. The center
// belongs to the patch, so both sides of a cut retain their own edge vertices.
export const GOODE_LOBES = [
  [-180, -40, -100, 0, 90], [-40, 180, 30, 0, 90],
  [-180, -100, -160, -90, 0], [-100, -20, -60, -90, 0],
  [-20, 80, 20, -90, 0], [80, 180, 140, -90, 0],
].map(([west, east, center, south, north]) => ({
  west: radians(west), east: radians(east), center: radians(center),
  south: radians(south), north: radians(north),
}));

// Robinson's published 5-degree width/height table, with a reflected entry at
// -5 degrees for smooth interpolation at the equator.
const ROBINSON = [
  [0.9986, -0.062], [1, 0], [0.9986, 0.062], [0.9954, 0.124],
  [0.99, 0.186], [0.9822, 0.248], [0.973, 0.31], [0.96, 0.372],
  [0.9427, 0.434], [0.9216, 0.4958], [0.8962, 0.5571],
  [0.8679, 0.6176], [0.835, 0.6769], [0.7986, 0.7346],
  [0.7597, 0.7903], [0.7186, 0.8435], [0.6732, 0.8936],
  [0.6213, 0.9394], [0.5722, 0.9761], [0.5322, 1],
];

export function latitudeProfile(type, latitude) {
  if (type === 'equirectangular') return { radius: 1, height: latitude };
  if (type === 'robinson') {
    const row = Math.min(18, Math.abs(latitude) * 36 / Math.PI);
    const index = Math.floor(row);
    const t = row - index;
    const before = ROBINSON[index];
    const current = ROBINSON[index + 1];
    const after = ROBINSON[Math.min(19, index + 2)];
    const interpolate = axis => current[axis] + t * (after[axis] - before[axis]) / 2 +
      t * t * (after[axis] - 2 * current[axis] + before[axis]) / 2;
    return { radius: 0.8487 * interpolate(0), height: Math.sign(latitude) * 1.3523 * interpolate(1) };
  }
  if (type === 'equal-earth') {
    const m = Math.sqrt(3) / 2;
    const theta = Math.asin(m * Math.sin(latitude));
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    return {
      radius: Math.cos(theta) / (m * (1.340264 - 3 * 0.081106 * t2 + t6 * (7 * 0.000893 + 9 * 0.003796 * t2))),
      height: theta * (1.340264 - 0.081106 * t2 + t6 * (0.000893 + 0.003796 * t2)),
    };
  }
  if (type === 'goode' && Math.abs(latitude) > GOODE_TRANSITION) {
    let theta = latitude;
    if (Math.abs(latitude) >= HALF_PI - 1e-12) theta = Math.sign(latitude) * HALF_PI;
    else {
      for (let iteration = 0; iteration < 30; iteration++) {
        const correction = (2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(latitude)) /
          (2 + 2 * Math.cos(2 * theta));
        theta -= correction;
        if (Math.abs(correction) < 1e-12) break;
      }
    }
    return {
      radius: 2 * Math.SQRT2 / Math.PI * Math.cos(theta),
      height: Math.SQRT2 * Math.sin(theta) - Math.sign(latitude) * GOODE_Y_OFFSET,
    };
  }
  return { radius: Math.cos(latitude), height: latitude };
}

export function goodeLobeCenter(longitude, latitude) {
  return GOODE_LOBES.find(lobe => (latitude >= 0 ? lobe.north > 0 : lobe.south < 0) &&
    longitude >= lobe.west && longitude <= lobe.east)?.center ?? 0;
}
