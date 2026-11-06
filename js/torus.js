const clamp01 = value => Math.max(0, Math.min(1, value));
const lerp = (a, b, t) => a + (b - a) * t;
const TUBE_RADIUS = 0.5;
const HOLE_RADIUS = 0.25;
const MAJOR_RADIUS = TUBE_RADIUS + HOLE_RADIUS;

export function createTorusState(progress) {
    const open = clamp01(progress * 4 - 1), straighten = clamp01(progress * 4 - 2);
    return {
        type: 'torus', progress, toroidal: true, latitudeRange: Math.PI / 2,
        pinch: clamp01(progress * 4),
        open, straighten,
        unroll: clamp01(progress * 4 - 3),
        profiles: new Map(), columns: new Map(),
    };
}

// sin(k*a)/k and (cos(k*a)-1)/k, including their flat limits.
function arc(angle, curvature) {
    return curvature < 1e-8
        ? { along: angle, bend: 0 }
        : { along: Math.sin(curvature * angle) / curvature,
            bend: -2 * Math.sin(curvature * angle / 2) ** 2 / curvature };
}

export function projectTorus(longitude, latitude, state, position) {
    let row = state.profiles.get(latitude);
    if (!row) {
        if (state.progress <= 0.25) {
            const cos = Math.cos(latitude), sin = Math.sin(latitude);
            // A sphere becomes a horn torus: both poles meet at the origin,
            // while the equator stays fixed. The polar singularity is intentional.
            row = { radius: lerp(cos, cos * cos, state.pinch),
                y: lerp(sin, sin * cos, state.pinch) };
        } else if (state.progress <= 0.5) {
            row = { radius: TUBE_RADIUS * (1 + Math.cos(2 * latitude)) + HOLE_RADIUS * state.open,
                y: TUBE_RADIUS * Math.sin(2 * latitude) };
        } else if (state.progress <= 0.75) {
            // Straighten only the major ring; preserve the tube's orientation.
            const angle = 2 * latitude;
            row = { radius: TUBE_RADIUS * Math.cos(angle), y: TUBE_RADIUS * Math.sin(angle) };
        } else {
            const k = 1 - state.unroll;
            const profile = arc(2 * latitude, k);
            // Open the back seam symmetrically upward and downward. The front
            // equator stays fixed as curvature decreases to a north-up sheet.
            row = { y: TUBE_RADIUS * profile.along,
                z: 1 + TUBE_RADIUS * profile.bend };
        }
        state.profiles.set(latitude, row);
    }
    let column = state.columns.get(longitude);
    if (!column) {
        const k = 1 - state.straighten;
        const curve = arc(longitude, k);
        column = { sin: Math.sin(k * longitude), cos: Math.cos(k * longitude),
            x: MAJOR_RADIUS * curve.along,
            z: MAJOR_RADIUS * curve.bend + lerp(MAJOR_RADIUS, 1 - TUBE_RADIUS, state.straighten) };
        state.columns.set(longitude, column);
    }
    if (state.progress <= 0.5) {
        position.x = row.radius * column.sin;
        position.y = row.y;
        position.z = row.radius * column.cos;
    } else if (state.progress <= 0.75) {
        position.x = column.x + row.radius * column.sin;
        position.y = row.y;
        position.z = column.z + row.radius * column.cos;
    } else {
        position.x = MAJOR_RADIUS * longitude;
        position.y = row.y;
        position.z = row.z;
    }
    return position;
}
