import { latitudeProfile, goodeLobeCenter } from './pseudocylindrical.js';
import { createTetrahedralCoordinate, animateTetrahedral } from './tetrahedral.js';

export const MERCATOR_LIMIT = Math.atan(Math.sinh(Math.PI));
export const CLASSIC_LIMIT = Math.atan(Math.PI);

const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp01 = value => Math.max(0, Math.min(1, value));

export function getProjectionCheckpoints(type) {
  if (type === 'mercator') return [0, 1 / 3, 2 / 3, 1];
  if (type === 'goode') return [0, 0.25, 0.5, 0.75, 1];
  return ['sinusoidal', 'robinson', 'equal-earth', 'equirectangular', 'tetrahedral', 'lambert-azimuthal'].includes(type)
    ? [0, 0.5, 1] : [0, 0.7, 1];
}

export function getNextProjectionCheckpoint(type, progress) {
  // Half a percentage point also accepts rounded thirds such as 33% and 67%.
  return getProjectionCheckpoints(type).find(checkpoint => checkpoint > progress + 0.005) ?? 0;
}

export function getPreviousProjectionCheckpoint(type, progress) {
  return getProjectionCheckpoints(type).findLast(checkpoint => checkpoint < progress - 0.005) ?? 1;
}

export function getProjectionState(type, progress) {
  if (type === 'tetrahedral' || type === 'lambert-azimuthal') {
    return { type, progress, tetrahedral: type === 'tetrahedral', azimuthal: type === 'lambert-azimuthal',
      latitudeRange: Math.PI / 2 };
  }
  if (['sinusoidal', 'robinson', 'equal-earth', 'goode', 'equirectangular'].includes(type)) {
    const opening = type === 'goode' ? clamp01(progress * 2) : progress;
    const reshape = clamp01(opening * 2);
    const unroll = clamp01(opening * 2 - 1);
    return { type, progress, pseudo: true, reshape, unroll, curvature: 1 - unroll,
      homolosine: type === 'goode' ? clamp01(progress * 4 - 2) : 0,
      interrupt: type === 'goode' ? clamp01(progress * 4 - 3) : 0,
      latitudeRange: Math.PI / 2, profiles: new Map() };
  }
  const mercator = type === 'mercator';
  // Mercator: equal-height projection, unroll, then conformal vertical stretch.
  const project = mercator ? clamp01(progress * 3) : Math.min(progress / 0.7, 1);
  const stretch = mercator ? clamp01(progress * 3 - 2) : 1;
  const unroll = mercator ? clamp01(progress * 3 - 1) : Math.max((progress - 0.7) / 0.3, 0);
  const sameHeight = type === 'same-height';
  const classic = type === 'classic';
  // Use fixed latitude ranges from the globe stage onward, with no live cropping.
  const latitudeRange = sameHeight ? Math.PI / 2 : classic ? CLASSIC_LIMIT : MERCATOR_LIMIT;
  const guideHeight = sameHeight ? 1 : classic
    ? lerp(Math.sin(latitudeRange), Math.tan(latitudeRange), project)
    : lerp(Math.sin(latitudeRange), Math.PI, stretch);
  return { progress, project, stretch, unroll, curvature: 1 - unroll, mercator, sameHeight, classic,
    latitudeRange, guideHeight };
}

// Write into a reusable position object to avoid allocations for every vertex.
export function projectPoint(longitude, latitude, state, position, lobeCenter) {
  if (state.tetrahedral) {
    const direction = [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
    return animateTetrahedral(createTetrahedralCoordinate(direction), state.progress, position);
  }
  if (state.azimuthal) {
    const x = Math.cos(latitude) * Math.sin(longitude), y = Math.sin(latitude);
    const z = Math.cos(latitude) * Math.cos(longitude);
    const azimuth = Math.atan2(y, x);
    return projectAzimuthal(Math.acos(Math.max(-1, Math.min(1, z))), azimuth, state.progress, position);
  }
  if (state.pseudo) {
    let profile = state.profiles.get(latitude);
    if (!profile) {
      profile = latitudeProfile(state.type, latitude);
      state.profiles.set(latitude, profile);
    }
    // Goode first unfolds as Sinusoidal; only then do its polar regions change.
    const finalRadius = state.type === 'goode' ? Math.cos(latitude) : profile.radius;
    const finalHeight = state.type === 'goode' ? latitude : profile.height;
    const radius = lerp(Math.cos(latitude), finalRadius, state.reshape);
    position.y = lerp(Math.sin(latitude), finalHeight, state.reshape);
    const k = state.curvature;
    position.x = k < 1e-8 ? radius * longitude : radius * Math.sin(k * longitude) / k;
    position.z = lerp(radius, 1, state.unroll) - (k < 1e-8 ? 0 :
      2 * radius * Math.sin(k * longitude / 2) ** 2 / k);
    if (state.type === 'goode' && state.homolosine > 0) {
      const width = lerp(Math.cos(latitude), profile.radius, state.homolosine);
      const center = lobeCenter ?? goodeLobeCenter(longitude, latitude);
      position.x = longitude * width + state.interrupt * center * (1 - width);
      position.y = lerp(latitude, profile.height, state.homolosine);
      position.z = 1;
    }
    return position;
  }
  const sphereY = Math.sin(latitude);
  const mercatorLatitude = Math.max(-MERCATOR_LIMIT, Math.min(MERCATOR_LIMIT, latitude));
  const mercator = Math.log(Math.tan(Math.PI / 4 + mercatorLatitude / 2));
  // A ray from the origin reaches radius 1 at scale 1 / cos(latitude),
  // so its height is sin(latitude) / cos(latitude) = tan(latitude).
  const cylinderY = state.sameHeight ? sphereY : state.classic ? Math.tan(latitude) :
    lerp(sphereY, mercator, state.stretch);

  if (state.unroll === 0) {
    const radius = lerp(Math.cos(latitude), 1, state.project);
    position.x = radius * Math.sin(longitude);
    position.y = lerp(sphereY, cylinderY, state.project);
    position.z = radius * Math.cos(longitude);
  } else {
    // Preserve arc length while opening the cut at ±180°. The central meridian
    // stays at z=1; the stable sine expression also works near the flat endpoint.
    const curvature = state.curvature;
    position.x = curvature < 1e-6 ? longitude : Math.sin(curvature * longitude) / curvature;
    position.y = cylinderY;
    position.z = curvature < 1e-6 ? 1 :
      1 - 2 * Math.sin(curvature * longitude / 2) ** 2 / curvature;
  }
  return position;
}

export function projectAzimuthal(angle, azimuth, progress, position) {
  // Open the full sphere into a hemispherical bowl first, then flatten it.
  // The front center stays at z=1 and the antipode opens into the bowl's rim.
  const reshape = clamp01(progress * 2), flatten = clamp01(progress * 2 - 1);
  const bowlRadius = lerp(1, Math.SQRT2, reshape);
  const polarAngle = angle * (1 - reshape / 2);
  const radius = lerp(bowlRadius * Math.sin(polarAngle), 2 * Math.sin(angle / 2), flatten);
  position.x = radius * Math.cos(azimuth);
  position.y = radius * Math.sin(azimuth);
  position.z = lerp(1 + bowlRadius * (Math.cos(polarAngle) - 1), 1, flatten);
  return position;
}
