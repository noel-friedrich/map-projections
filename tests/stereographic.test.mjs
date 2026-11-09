import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, projectPoint, getProjectionCheckpoints } from '../js/projections.js';
import { projectStereographic, stereographicRowAngle, STEREOGRAPHIC_LIMIT, STEREOGRAPHIC_RADIUS } from '../js/stereographic.js';
import { localDistortion, measureProjectionDistortion } from '../js/distortion.js';

const close=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('stereographic projects from the back antipode onto the front tangent plane',()=>{
    assert.deepEqual(getProjectionCheckpoints('stereographic'),[0,1]);
    for(const c of [0,0.4,Math.PI/2,1.8,STEREOGRAPHIC_LIMIT]) for(const a of [0,0.8,Math.PI]) {
        const sphere=projectStereographic(c,a,0,{}), flat=projectStereographic(c,a,1,{});
        close(Math.hypot(sphere.x,sphere.y,sphere.z),1);
        close(flat.z,1);close(Math.hypot(flat.x,flat.y),2*Math.tan(c/2));
        for(const t of [0.2,0.5,0.8]) {
            const v=projectStereographic(c,a,t,{});
            // Cross product of rays measured from (0,0,-1) vanishes.
            close(v.x*(sphere.z+1)-(v.z+1)*sphere.x,0);
            close(v.y*(sphere.z+1)-(v.z+1)*sphere.y,0);
        }
    }
});

test('the same cropped region is used on the starting globe and final circular map',()=>{
    let previous=-1;
    for(let i=0;i<=256;i++) {
        const c=stereographicRowAngle(i/256);
        assert.ok(c>previous&&c<Math.PI);previous=c;
        const v=projectStereographic(c,0,1,{});
        assert.ok(Object.values(v).every(Number.isFinite));
        const start=projectStereographic(c,0,0,{});
        assert.ok(start.z>=-0.5-1e-9);
    }
    close(previous,STEREOGRAPHIC_LIMIT);
    close(projectStereographic(previous,0,1,{}).x,STEREOGRAPHIC_RADIUS);
    close(STEREOGRAPHIC_LIMIT,2*Math.PI/3);
    for(const a of [0,0.6,1.4,3,5]) {
        const start=projectStereographic(previous,a,0,{}), flat=projectStereographic(previous,a,1,{});
        close(start.z,-0.5);close(start.x**2+start.y**2,0.75);
        close(flat.x**2+flat.y**2,12);close(flat.z,1);
    }
});

test('stereographic preserves local angles and the expected radial scale',()=>{
    const state=getProjectionState('stereographic',1);
    for(const lon of [-2,-0.5,0,0.5,2]) for(const lat of [-1,0,1]) {
        const d=[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];
        const distortion=localDistortion(point=>{
            const v=projectPoint(Math.atan2(point[0],point[2]),Math.asin(point[1]),state,{});
            return [v.x,v.y,v.z];
        },d);
        close(distortion.angle,0,1e-4);
        close(distortion.area,(2/(1+d[2]))**2,1e-5);
    }
    const score=measureProjectionDistortion('stereographic',4096);
    assert.equal(score.angleError,0);
    close(score.areaDifference,200/3,1);
});

test('stereographic stays finite at exact poles and the excluded antipode',()=>{
    for(const t of [0,0.25,0.5,0.75,1]) for(const lon of [-Math.PI,0,Math.PI]) for(const lat of [-Math.PI/2,0,Math.PI/2]) {
        const v=projectPoint(lon,lat,getProjectionState('stereographic',t),{});
        assert.ok(Object.values(v).every(Number.isFinite));
    }
});
