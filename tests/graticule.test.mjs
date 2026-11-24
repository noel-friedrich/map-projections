import test from 'node:test';
import assert from 'node:assert/strict';
import { GRATICULE_SPACINGS, drawGraticule } from '../js/graticule.js';
import { MAP_CIRCLE_RADIUS, paintMapCircles } from '../js/map-circles.js';

const radians = Math.PI / 180;

const direction = (lon, lat) => ({x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon)});

function rasterContext(width = 720, height = 360) {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    return {
        canvas: {width, height}, data,
        save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
        getImageData(x, y, w, h) {
            assert.equal(x, 0); assert.equal(w, width);
            return {data: data.slice(y * width * 4, (y + h) * width * 4)};
        },
        putImageData(image, x, y) { data.set(image.data, y * width * 4); },
    };
}

test('shared circle painter preserves spherical radius and orange fill for markers and smaller indicatrices', () => {
    assert.equal(MAP_CIRCLE_RADIUS, 1 / 15);
    for (const radius of [MAP_CIRCLE_RADIUS, MAP_CIRCLE_RADIUS/2, MAP_CIRCLE_RADIUS/3, MAP_CIRCLE_RADIUS/6]) {
      for (const [lon, lat] of [[0,0], [-Math.PI,0], [0,85*radians], [1,Math.PI/2]]) {
        const context = rasterContext();
        const {width, height} = context.canvas;
        const center = direction(lon, lat);
        paintMapCircles(context, [center], radius);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const d = direction(((x + 0.5) / width - 0.5) * 2 * Math.PI, (0.5 - (y + 0.5) / height) * Math.PI);
            const distance = Math.acos(Math.max(-1, Math.min(1, center.x*d.x + center.y*d.y + center.z*d.z)));
            const coverage = Math.max(0, Math.min(1, (radius-distance)/(Math.PI/height)+0.5));
            const offset = (y * width + x) * 4;
            for (const [channel, orange] of [255,140,0].entries()) {
                assert.equal(context.data[offset+channel], Math.round(255*(1-coverage)+orange*coverage));
            }
        }
      }
    }
});

test('dense graticules scale down indicatrices while 30 and 60 degrees retain the Ctrl-click marker size', () => {
    assert.deepEqual(GRATICULE_SPACINGS, [5,10,15,30,60]);
    for (const [index, spacing] of GRATICULE_SPACINGS.entries()) {
        const actual = rasterContext(), expected = rasterContext();
        const lastLatitude = Math.floor((90-1e-6)/spacing)*spacing;
        const centers = [];
        for (let lat=-lastLatitude; lat<=lastLatitude; lat+=spacing) {
            for (let lon=-180; lon<180; lon+=spacing) centers.push(direction(lon*radians,lat*radians));
        }
        drawGraticule(actual, spacing, true);
        const scale = [1/6, 1/3, 1/2, 1, 1][index];
        paintMapCircles(expected, centers, MAP_CIRCLE_RADIUS * scale);
        assert.deepEqual(actual.data, expected.data);
        const off = rasterContext();
        drawGraticule(off, spacing, false);
        assert.ok(off.data.every(channel => channel===255), 'unchecked means no circles');
    }
});
