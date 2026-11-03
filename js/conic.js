// Unit-sphere conic equations; references in assets/projection-sources.txt.
const radians = degrees => degrees * Math.PI / 180;
const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp = x => Math.max(0, Math.min(1, x));
export const CONIC_LATITUDE_MIN = 0;
export const CONIC_LATITUDE_MAX = radians(85);
export const CONIC_PARALLELS = [radians(30), radians(60)];
export const CONIC_TYPES = ['lambert-conic', 'albers'];

export function conicParameters(type) {
    const [a, b] = CONIC_PARALLELS;
    const tangent = latitude => Math.tan(Math.PI / 4 + latitude / 2);
    const n = type === 'lambert-conic'
        ? Math.log(Math.cos(a) / Math.cos(b)) / Math.log(tangent(b) / tangent(a))
        : (Math.sin(a) + Math.sin(b)) / 2;
    const c = Math.sqrt(1 - n * n);
    const f = Math.cos(a) * tangent(a) ** n / n;
    const constant = Math.cos(a) ** 2 + 2 * n * Math.sin(a);
    const rho = latitude => type === 'lambert-conic'
        ? f / tangent(latitude) ** n
        : Math.sqrt(Math.max(0, constant - 2 * n * Math.sin(latitude))) / n;
    // The intermediate perspective cone is illustrative. The last stage sets
    // the exact conformal/equal-area latitude spacing on its developed sector.
    const apex = Math.sin(a) + c * Math.cos(a) / n;
    const rawRho = latitude => apex * Math.cos(latitude) / (c * Math.cos(latitude) + n * Math.sin(latitude));
    return { n, c, apex, rho, rawRho };
}
const parameters = Object.fromEntries(CONIC_TYPES.map(type => [type, conicParameters(type)]));

export function createConicState(type, progress) {
    const params = parameters[type];
    const transfer = clamp(progress * 4);
    const cut = clamp((progress - 0.25) * 4);
    const flatten = clamp((progress - 0.5) * 4);
    const spacing = clamp((progress - 0.75) * 4);
    const opened = lerp(0.35 * cut, 1, flatten);
    const wrap = lerp(1, params.n, opened);
    const radiusScale = params.n / wrap;
    const heightScale = Math.sqrt(Math.max(0, 1 - radiusScale * radiusScale));
    const tilt = flatten * Math.PI / 2;
    const reference = Math.PI / 4;
    const rawReference = params.rawRho(reference);
    const referenceRho = lerp(rawReference, params.rho(reference), spacing);
    const maxRho = lerp(params.rawRho(CONIC_LATITUDE_MIN), params.rho(CONIC_LATITUDE_MIN), spacing);
    const centerY = referenceRho - maxRho * (1 + Math.cos(params.n * Math.PI)) / 2;
    return { type, progress, conic: true, latitudeRange: Math.PI / 2,
        latitudeMin: CONIC_LATITUDE_MIN, latitudeMax: CONIC_LATITUDE_MAX,
        params, transfer, cut, flatten, spacing, wrap, radiusScale, heightScale,
        tiltCos: Math.cos(tilt), tiltSin: Math.sin(tilt), referenceRho,
        anchorY: lerp(params.apex - params.c * rawReference, -centerY, flatten),
        anchorZ: lerp(params.n * rawReference, 1, flatten),
        profiles: new Map(), columns: new Map() };
}

export function projectConic(longitude, latitude, state, position) {
    let row = state.profiles.get(latitude);
    if (!row) {
        row = { rho: lerp(state.params.rawRho(latitude), state.params.rho(latitude), state.spacing),
            sin: Math.sin(latitude), cos: Math.cos(latitude) };
        state.profiles.set(latitude, row);
    }
    let column = state.columns.get(longitude);
    if (!column) {
        column = { sin: Math.sin(state.wrap * longitude), cos: Math.cos(state.wrap * longitude),
            globeSin: Math.sin(longitude), globeCos: Math.cos(longitude) };
        state.columns.set(longitude, column);
    }
    const x = state.radiusScale * row.rho * column.sin;
    const y = -state.heightScale * (row.rho - state.referenceRho);
    const z = state.radiusScale * (row.rho * column.cos - state.referenceRho);
    position.x = lerp(row.cos * column.globeSin, x, state.transfer);
    position.y = lerp(row.sin, y * state.tiltCos - z * state.tiltSin + state.anchorY, state.transfer);
    position.z = lerp(row.cos * column.globeCos, y * state.tiltSin + z * state.tiltCos + state.anchorZ, state.transfer);
    return position;
}
