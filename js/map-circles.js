export const MAP_CIRCLE_RADIUS = 1 / 15;
const ORANGE = [255, 140, 0];
const TAU = 2 * Math.PI;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
let samples;

// Both user markers and Tissot indicatrices use this exact spherical-cap painter.
// Batch the pixel read/write so dense graticules don't copy the texture per circle.
export function paintMapCircles(context, centers, radius = MAP_CIRCLE_RADIUS) {
    if (!centers.length) return;
    const { width, height } = context.canvas;
    const pixelAngle = Math.PI / height;
    const extent = radius + pixelAngle;
    const bounds = centers.map(center => {
        const latitude = Math.asin(clamp(center.y, -1, 1));
        const longitude = Math.atan2(center.x, center.z);
        const longitudeExtent = Math.abs(latitude) + extent >= Math.PI / 2
            ? Math.PI : Math.asin(Math.sin(extent) / Math.cos(latitude));
        const centerX = (longitude / TAU + 0.5) * width;
        const halfWidth = Math.ceil(longitudeExtent / TAU * width) + 1;
        const firstX = Math.floor(centerX - halfWidth);
        return {
            center,
            top: Math.max(0, Math.floor((0.5 - (latitude + extent) / Math.PI) * height)),
            bottom: Math.min(height, Math.ceil((0.5 - (latitude - extent) / Math.PI) * height)),
            firstX,
            lastX: Math.min(firstX + width - 1, Math.ceil(centerX + halfWidth)),
        };
    });
    const top = Math.min(...bounds.map(b => b.top));
    const bottom = Math.max(...bounds.map(b => b.bottom));
    const pixels = context.getImageData(0, top, width, bottom - top);
    if (samples?.width !== width || samples?.height !== height) {
        samples = { width, height,
            sinLon: Float64Array.from({length: width}, (_, x) => Math.sin(((x + 0.5) / width - 0.5) * TAU)),
            cosLon: Float64Array.from({length: width}, (_, x) => Math.cos(((x + 0.5) / width - 0.5) * TAU)),
            sinLat: Float64Array.from({length: height}, (_, y) => Math.sin((0.5 - (y + 0.5) / height) * Math.PI)),
            cosLat: Float64Array.from({length: height}, (_, y) => Math.cos((0.5 - (y + 0.5) / height) * Math.PI)),
        };
    }
    for (const bound of bounds) {
        const { center } = bound;
        for (let y = bound.top; y < bound.bottom; y++) {
            const cx = center.x * samples.cosLat[y], cy = center.y * samples.sinLat[y], cz = center.z * samples.cosLat[y];
            for (let unwrappedX = bound.firstX; unwrappedX <= bound.lastX; unwrappedX++) {
                const x = ((unwrappedX % width) + width) % width;
                const dot = cx * samples.sinLon[x] + cy + cz * samples.cosLon[x];
                const coverage = clamp((radius - Math.acos(clamp(dot, -1, 1))) / pixelAngle + 0.5, 0, 1);
                if (coverage === 0) continue;
                const offset = ((y - top) * width + x) * 4;
                for (let channel = 0; channel < 3; channel++) {
                    pixels.data[offset + channel] = Math.round(
                        pixels.data[offset + channel] * (1 - coverage) + ORANGE[channel] * coverage,
                    );
                }
            }
        }
    }
    context.putImageData(pixels, 0, top);
}
