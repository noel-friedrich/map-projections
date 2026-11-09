import test from 'node:test';
import assert from 'node:assert/strict';
import {getProjectionState,projectPoint,getProjectionCheckpoints} from '../js/projections.js';
import {projectOrthographic,GORES} from '../js/simple-projections.js';
import {measureProjectionDistortion} from '../js/distortion.js';
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const p=(type,t,lon,lat,branch)=>projectPoint(lon,lat,getProjectionState(type,t),{},branch);
const same=(a,b,e)=>['x','y','z'].forEach(axis=>close(a[axis],b[axis],e));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const types=['orthographic','azimuthal-equidistant','werner','collignon','gores'];

test('orthographic unfolds two rigid hemispheres before flattening into separate complete disks',()=>{
    for(const half of [1,-1]) {
        const a=[0,0,half], b=[0.6,0,half*0.8];
        for(const t of [0,0.15,0.3,0.5]) {
            const u=projectOrthographic(a,half,t,{}),v=projectOrthographic(b,half,t,{});
            close(distance(u,v),Math.hypot(...a.map((value,i)=>value-b[i])));
        }
        for(let row=0;row<=10;row++) for(let column=0;column<=12;column++) {
            const c=row/10*Math.PI/2,az=column/12*2*Math.PI;
            const d=[Math.sin(c)*Math.cos(az),Math.sin(c)*Math.sin(az),half*Math.cos(c)];
            const opened=projectOrthographic(d,half,0.5,{}),flat=projectOrthographic(d,half,1,{});
            close(opened.z,Math.cos(c));same(flat,{x:opened.x,y:opened.y,z:1});
            const center=half>0?-1:1;
            close((flat.x-center)**2+flat.y**2,Math.sin(c)**2);
        }
    }
    // The right tangent hinge remains shared as the halves open.
    for(const t of [0,0.2,0.5]) same(projectOrthographic([1,0,0],1,t,{}),projectOrthographic([1,0,0],-1,t,{}));
});

test('azimuthal equidistant preserves every radial great-circle distance, including its antipodal rim',()=>{
    const state=getProjectionState('azimuthal-equidistant',1);
    for(const c of [0,0.3,1,2,Math.PI]) for(const a of [0,0.8,2]) {
        const d=[Math.sin(c)*Math.cos(a),Math.sin(c)*Math.sin(a),Math.cos(c)];
        const v=projectPoint(Math.atan2(d[0],d[2]),Math.asin(d[1]),state,{});
        close(Math.hypot(v.x,v.y),c);close(v.z,1);
    }
});

test('Werner bends each sinusoidal parallel into an arc of unchanged length around the north pole',()=>{
    for(const lat of [-1,-0.4,0,0.5,1.4]) for(const lon of [-Math.PI,-0.7,0,0.7,Math.PI]) {
        same(p('werner',2/3,lon,lat),p('sinusoidal',1,lon,lat));
        const rho=Math.PI/2-lat,e=lon*Math.cos(lat)/rho,v=p('werner',1,lon,lat);
        close(v.x,rho*Math.sin(e));close(v.y,Math.PI/2-rho*Math.cos(e));
        close(Math.hypot(v.x,v.y-Math.PI/2),rho);
    }
    same(p('werner',1,1,Math.PI/2),{x:0,y:Math.PI/2,z:1});
});

test('Collignon ends as a triangle with a single north tip and a straight south base',()=>{
    const top=p('collignon',1,Math.PI,Math.PI/2);
    close(top.x,0);close(top.y,Math.sqrt(Math.PI));
    for(const lat of [-Math.PI/2,-1,0,1,Math.PI/2]) {
        const v=p('collignon',1,Math.PI,lat),alpha=Math.sqrt(1-Math.sin(lat));
        close(v.x,2*Math.sqrt(Math.PI)*alpha);close(v.y,Math.sqrt(Math.PI)*(1-alpha));
        same(p('collignon',2/3,0,lat),{x:0,y:v.y,z:1});
    }
});

test('twelve gores cover all longitudes, open their seams and retain the correct local sinusoidal geography',()=>{
    close(GORES[0].west,-Math.PI);close(GORES.at(-1).east,Math.PI);
    for(const [i,gore] of GORES.entries()) {
        if(i)close(gore.west,GORES[i-1].east);
        for(const lat of [-Math.PI/2,-0.7,0,0.7,Math.PI/2]) {
            for(const lon of [gore.west,gore.center,gore.east]) {
                const v=p('gores',1,lon,lat,gore.center);
                same(v,{x:gore.center+(lon-gore.center)*Math.cos(lat),y:lat,z:1});
            }
            if(i&&Math.abs(lat)>0.1) {
                const left=p('gores',1,gore.west,lat,GORES[i-1].center),right=p('gores',1,gore.west,lat,gore.center);
                assert.ok(right.x>left.x);
            }
        }
    }
});

test('Werner, Collignon and globe gores preserve relative areas numerically',()=>{
    for(const type of ['werner','collignon','gores']) assert.equal(measureProjectionDistortion(type,4096).areaDifference,0,type);
});

test('new projections start on the full sphere, stay finite and join their stages continuously',()=>{
    for(const type of types) {
        for(const lon of [-Math.PI,-1,0,1,Math.PI]) for(const lat of [-Math.PI/2,-0.5,0,0.5,Math.PI/2]) {
            same(p(type,0,lon,lat),{x:Math.cos(lat)*Math.sin(lon),y:Math.sin(lat),z:Math.cos(lat)*Math.cos(lon)});
            for(let frame=0;frame<=30;frame++) assert.ok(Object.values(p(type,frame/30,lon,lat)).every(Number.isFinite));
            for(const t of getProjectionCheckpoints(type).slice(1,-1)) same(p(type,t-1e-8,lon,lat),p(type,t+1e-8,lon,lat),1e-5);
            close(p(type,1,lon,lat).z,1);
        }
    }
});
