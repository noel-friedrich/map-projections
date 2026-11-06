import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, projectPoint, getProjectionCheckpoints } from '../js/projections.js';
import { localDistortion, measureProjectionDistortion } from '../js/distortion.js';
import { projectionInfo } from '../js/projection-info.js';

const close = (a,b,tolerance=1e-7) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
const p = (type,t,lon,lat) => projectPoint(lon,lat,getProjectionState(type,t),{});
const same = (a,b,tolerance) => ['x','y','z'].forEach(axis=>close(a[axis],b[axis],tolerance));

test('Aitoff reuses the entire Winkel construction through its Aitoff checkpoint',()=>{
    assert.deepEqual(getProjectionCheckpoints('aitoff'),[0,1/3,2/3,1]);
    for (let frame=0;frame<=24;frame++) for(const lon of [-Math.PI,-1,0,1,Math.PI]) for(const lat of [-Math.PI/2,-0.7,0,0.7,Math.PI/2]) {
        same(p('aitoff',frame/24,lon,lat),p('winkel-tripel',frame/24*0.75,lon,lat));
    }
    close(p('aitoff',1,Math.PI,0).x,Math.PI);
    close(p('aitoff',1,0,Math.PI/2).y,Math.PI/2);
    assert.match(projectionInfo['winkel-tripel'].text,/constructs the Aitoff/);
});

test('Hammer shares the hemisphere step but uses a Lambert disk before doubling its width',()=>{
    assert.deepEqual(getProjectionCheckpoints('hammer'),[0,1/3,2/3,1]);
    for(const lon of [-Math.PI,-1,0,1,Math.PI]) for(const lat of [-Math.PI/2,-0.7,0,0.7,Math.PI/2]) {
        same(p('hammer',1/3,lon,lat),p('aitoff',1/3,lon,lat));
        const disk=p('hammer',2/3,lon,lat), ellipse=p('hammer',1,lon,lat);
        const c=Math.acos(Math.cos(lat)*Math.cos(lon/2));
        close(Math.hypot(disk.x,disk.y),2*Math.sin(c/2));
        close(ellipse.x,2*disk.x);close(ellipse.y,disk.y);close(ellipse.z,1);
    }
    close(p('hammer',1,Math.PI,0).x,2*Math.SQRT2);
    close(p('hammer',1,0,Math.PI/2).y,Math.SQRT2);
});

test('Mollweide uses the defining latitude equation and a full 2:1 elliptical boundary',()=>{
    assert.deepEqual(getProjectionCheckpoints('mollweide'),[0,1/3,2/3,1]);
    for(const lat of [-Math.PI/2,-1,-0.4,0,0.4,1,Math.PI/2]) {
        const center=p('mollweide',1,0,lat), edge=p('mollweide',1,Math.PI,lat);
        const theta=Math.asin(Math.max(-1,Math.min(1,center.y/Math.SQRT2)));
        close(2*theta+Math.sin(2*theta),Math.PI*Math.sin(lat));
        close((edge.x/(2*Math.SQRT2))**2+(edge.y/Math.SQRT2)**2,1);
        const ring=p('mollweide',1/3,Math.PI/2,lat);
        close(ring.y,center.y);close(ring.x,edge.x/Math.PI);
    }
});

for (const type of ['mollweide','robinson','equal-earth']) {
test(`${type} moves closed rings to the final plane before unrolling around fixed contact points`,()=>{
    assert.deepEqual(getProjectionCheckpoints(type),[0,1/3,2/3,1]);
    for (const lat of [-Math.PI/2,-1,-0.4,0,0.4,1,Math.PI/2]) {
        const egg=p(type,1/3,Math.PI/2,lat), radius=egg.x;
        const front=p(type,2/3,0,lat);
        const back=p(type,2/3,Math.PI,lat);
        same(front,{x:0,y:egg.y,z:1});
        close(back.x,0);close(back.z,1-2*radius);
        for(const lon of [-Math.PI,-1,0,1,Math.PI]) {
            const original=p(type,1/3,lon,lat);
            for(const t of [1/3,0.5,2/3]) {
                const v=p(type,t,lon,lat);
                close(v.x,original.x);close(v.y,original.y);
                close(v.x**2+(v.z-p(type,t,0,lat).z+radius)**2,radius**2);
                same(p(type,t,-Math.PI,lat),p(type,t,Math.PI,lat));
            }
            for(const t of [1/3,0.5,2/3,0.9,1]) {
                const v=p(type,t,lon,lat);
                close(v.y,egg.y);
                same(p(type,t,-lon,lat),{x:-v.x,y:v.y,z:v.z});
            }
        }
        for(const t of [2/3,0.75,0.9,1]) same(p(type,t,0,lat),front);
        if(radius>1e-8) assert.ok(p(type,0.8,Math.PI,lat).x>0);
    }
});
}

test('Hammer and Mollweide preserve local and global relative areas',()=>{
    for(const type of ['hammer','mollweide']) {
        const state=getProjectionState(type,1);
        for(const lon of [-2,0.3,2]) for(const lat of [-1,-0.4,0,0.4,1]) {
            const direction=[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];
            const result=localDistortion(d=>{
                const v=projectPoint(Math.atan2(d[0],d[2]),Math.asin(d[1]),state,{});
                return [v.x,v.y,v.z];
            },direction);
            close(result.area,1,1e-5);
        }
        assert.equal(measureProjectionDistortion(type,4096).areaDifference,0);
    }
    assert.ok(measureProjectionDistortion('aitoff',4096).areaDifference>0);
});

test('elliptical constructions start on the full sphere, remain finite and join continuously',()=>{
    for(const type of ['aitoff','hammer','mollweide']) {
        for(const lon of [-Math.PI,-1,0,1,Math.PI]) for(const lat of [-Math.PI/2,-0.7,0,0.7,Math.PI/2]) {
            same(p(type,0,lon,lat),{x:Math.cos(lat)*Math.sin(lon),y:Math.sin(lat),z:Math.cos(lat)*Math.cos(lon)});
            for(let i=0;i<=100;i++) assert.ok(Object.values(p(type,i/100,lon,lat)).every(Number.isFinite));
            for(const t of getProjectionCheckpoints(type).slice(1,-1)) same(p(type,t-1e-8,lon,lat),p(type,t+1e-8,lon,lat),1e-6);
            close(p(type,1,lon,lat).z,1);
        }
    }
});
