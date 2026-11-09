// The tangent plane is z=1 and the projection source is its antipode (0,0,-1).
// Keep the same region at every stage: 120 degrees from the front center.
// This removes the rear 60-degree cap and retains three quarters of the globe.
export const STEREOGRAPHIC_LIMIT = 2 * Math.PI / 3;
export const STEREOGRAPHIC_RADIUS = 2 * Math.tan(STEREOGRAPHIC_LIMIT / 2);

export function stereographicRowAngle(fraction) {
    return fraction * STEREOGRAPHIC_LIMIT;
}

export function projectStereographic(angle, azimuth, progress, position) {
    const projectedRadius = 2 * Math.tan(Math.min(angle, STEREOGRAPHIC_LIMIT) / 2);
    const radius = (1 - progress) * Math.sin(angle) + progress * projectedRadius;
    position.x = radius * Math.cos(azimuth);
    position.y = radius * Math.sin(azimuth);
    position.z = (1 - progress) * Math.cos(angle) + progress;
    return position;
}
