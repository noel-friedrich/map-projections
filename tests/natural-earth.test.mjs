import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, getProjectionCheckpoints, projectPoint } from '../js/projections.js';

const radians = Math.PI / 180;
const close = (a,b,tolerance=1e-11) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
const point = (type,progress,lon,lat) => projectPoint(lon,lat,getProjectionState(type,progress),{});

// Independent reference coordinates from PROJ via pyproj 3.7.2, R=1.
const coordinates = {
    'natural-earth-1': [[2.735384723480633,0], [1.2319937779929162,0.7930513944125289], [1.3874895078905731,1.337035371414347], [1.5055563920169703,1.422390506730596]],
    'natural-earth-2': [[2.661525880194737,0], [1.2025164228320386,0.7928840913773239], [1.1476061760482519,1.3370909559985198], [0.601457888203057,1.4242291687559827]],
};
const sites = [[180,0],[90,45],[135,80],[180,90]];

for (const type of Object.keys(coordinates)) {
    test(`${type} matches independent PROJ coordinates, including its finite pole lines`, () => {
        for (const [i,[lon,lat]] of sites.entries()) {
            const p = point(type,1,lon*radians,lat*radians);
            close(p.x,coordinates[type][i][0]); close(p.y,coordinates[type][i][1]); close(p.z,1);
            const opposite = point(type,1,-lon*radians,-lat*radians);
            close(opposite.x,-p.x); close(opposite.y,-p.y);
        }
    });

    test(`${type} starts on the full sphere and remains continuous and finite through all four stages`, () => {
        assert.deepEqual(getProjectionCheckpoints(type),[0,1/3,2/3,1]);
        for (const lon of [-Math.PI,-1,0,1,Math.PI]) for (const lat of [-Math.PI/2,-1,0,1,Math.PI/2]) {
            const globe = point(type,0,lon,lat);
            close(globe.x,Math.cos(lat)*Math.sin(lon)); close(globe.y,Math.sin(lat)); close(globe.z,Math.cos(lat)*Math.cos(lon));
            for (let frame=0; frame<=60; frame++) assert.ok(Object.values(point(type,frame/60,lon,lat)).every(Number.isFinite));
            for (const step of [1/3,2/3]) {
                const before = point(type,step-1e-9,lon,lat), after = point(type,step+1e-9,lon,lat);
                for (const axis of ['x','y','z']) close(before[axis],after[axis],1e-7);
            }
        }
    });
}
