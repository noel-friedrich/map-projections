import { MAP_CIRCLE_RADIUS, paintMapCircles } from './map-circles.js';

export const GRATICULE_SPACINGS = [5, 10, 15, 30, 60];

const radians = Math.PI / 180;

export function drawGraticule(context, spacing, showIndicatrices) {
    const { width, height } = context.canvas;
    const lastLatitude = Math.floor((90 - 1e-6) / spacing) * spacing;
    context.save();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.beginPath();
    for (let longitude = -180; longitude <= 180; longitude += spacing) {
        const x = (longitude + 180) / 360 * width;
        context.moveTo(x, 0);
        context.lineTo(x, height);
    }
    for (let latitude = -lastLatitude; latitude <= lastLatitude; latitude += spacing) {
        const y = (90 - latitude) / 180 * height;
        context.moveTo(0, y);
        context.lineTo(width, y);
    }
    context.stroke();

    if (showIndicatrices) {
        const centers = [];
        for (let latitude = -lastLatitude; latitude <= lastLatitude; latitude += spacing) {
            for (let longitude = -180; longitude < 180; longitude += spacing) {
                const lat = latitude * radians, lon = longitude * radians;
                centers.push({x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon)});
            }
        }
        paintMapCircles(context, centers, MAP_CIRCLE_RADIUS * Math.min(1, spacing / 30));
    }
    context.restore();
}
