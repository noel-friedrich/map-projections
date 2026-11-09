import test from 'node:test';
import assert from 'node:assert/strict';
import {getProjectionState,projectPoint,getProjectionCheckpoints} from '../js/projections.js';
import {measureProjectionDistortion} from '../js/distortion.js';
const close=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const p=(t,lon,lat)=>projectPoint(lon,lat,getProjectionState('gall-peters',t),{});
test('Gall-Peters follows sphere, cylinder, Lambert rectangle and reciprocal scaling stages',()=>{
    assert.deepEqual(getProjectionCheckpoints('gall-peters'),[0,1/3,2/3,1]);
    for(const lon of [-Math.PI,-1,0,1,Math.PI]) for(const lat of [-Math.PI/2,-0.7,0,0.7,Math.PI/2]) {
        const sphere=p(0,lon,lat),cylinder=p(1/3,lon,lat),rectangle=p(2/3,lon,lat),final=p(1,lon,lat);
        close(sphere.x,Math.cos(lat)*Math.sin(lon));close(sphere.y,Math.sin(lat));close(sphere.z,Math.cos(lat)*Math.cos(lon));
        close(Math.hypot(cylinder.x,cylinder.z),1);close(cylinder.y,Math.sin(lat));
        close(rectangle.x,lon);close(rectangle.y,Math.sin(lat));close(rectangle.z,1);
        close(final.x,lon/Math.SQRT2);close(final.y,Math.SQRT2*Math.sin(lat));close(final.z,1);
        for(const t of [1/3,2/3]) {
            const a=p(t-1e-9,lon,lat),b=p(t+1e-9,lon,lat);
            close(a.x,b.x);close(a.y,b.y);close(a.z,b.z);
        }
    }
});
test('Gall-Peters preserves areas and has true horizontal and vertical scale at both standard parallels',()=>{
    assert.equal(measureProjectionDistortion('gall-peters',4096).areaDifference,0);
    for(const lat of [-Math.PI/4,Math.PI/4]) {
        const h=1e-6,a=p(1,0,lat-h),b=p(1,0,lat+h),c=p(1,-h,lat),d=p(1,h,lat);
        close((b.y-a.y)/(2*h),1);close((d.x-c.x)/(2*h*Math.cos(lat)),1);
    }
});
