export const MERCATOR_LIMIT = Math.atan(Math.sinh(Math.PI));
export const CLASSIC_LIMIT = Math.atan(Math.PI);

const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp01 = value => Math.max(0, Math.min(1, value));

export function getProjectionState(type, progress) {
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
export function projectPoint(longitude, latitude, state, position) {
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
