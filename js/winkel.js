const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp = x => Math.max(0, Math.min(1, x));

export function aitoff(longitude, latitude) {
    const cosLatitude = Math.cos(latitude);
    const alpha = Math.acos(Math.max(-1, Math.min(1, cosLatitude * Math.cos(longitude / 2))));
    const inverseSinc = alpha < 1e-7 ? 1 + alpha * alpha / 6 : alpha / Math.sin(alpha);
    return { x: 2 * cosLatitude * Math.sin(longitude / 2) * inverseSinc,
        y: Math.sin(latitude) * inverseSinc };
}

function hammer(longitude, latitude) {
    const scale = Math.sqrt(2 / (1 + Math.cos(latitude) * Math.cos(longitude / 2)));
    return { x: 2 * scale * Math.cos(latitude) * Math.sin(longitude / 2),
        y: scale * Math.sin(latitude) };
}

// Share the hemisphere, disk and horizontal expansion with Winkel Tripel.
export function projectAitoff(longitude, latitude, progress, position) {
    return projectEllipse(longitude, latitude, progress * 0.75, position);
}

export function projectHammer(longitude, latitude, progress, position) {
    return projectEllipse(longitude, latitude, progress * 0.75, position, true);
}

export function projectWinkel(longitude, latitude, progress, position) {
    return projectEllipse(longitude, latitude, progress, position);
}

function projectEllipse(longitude, latitude, progress, position, equalArea = false) {
    const cosLatitude = Math.cos(latitude), sinLatitude = Math.sin(latitude);
    if (progress <= 0.25) {
        const compressed = longitude * lerp(1, 0.5, clamp(progress * 4));
        position.x = cosLatitude * Math.sin(compressed);
        position.y = sinLatitude;
        position.z = cosLatitude * Math.cos(compressed);
        return position;
    }
    const ellipse = equalArea ? hammer(longitude, latitude) : aitoff(longitude, latitude);
    if (progress <= 0.5) {
        const flatten = clamp((progress - 0.25) * 4);
        position.x = lerp(cosLatitude * Math.sin(longitude / 2), ellipse.x / 2, flatten);
        position.y = lerp(sinLatitude, ellipse.y, flatten);
        position.z = lerp(cosLatitude * Math.cos(longitude / 2), 1, flatten);
    } else if (progress <= 0.75) {
        position.x = ellipse.x * lerp(0.5, 1, clamp((progress - 0.5) * 4));
        position.y = ellipse.y;
        position.z = 1;
    } else {
        // Winkel Tripel is the arithmetic mean of Aitoff and equirectangular
        // coordinates, using cos(standard parallel) = 2/pi.
        const rectangle = 0.5 * clamp((progress - 0.75) * 4);
        position.x = lerp(ellipse.x, longitude * 2 / Math.PI, rectangle);
        position.y = lerp(ellipse.y, latitude, rectangle);
        position.z = 1;
    }
    return position;
}
