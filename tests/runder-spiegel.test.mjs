import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectionState, getProjectionCheckpoints, getNextProjectionCheckpoint, getPreviousProjectionCheckpoint, projectPoint } from '../js/projections.js';
import { MIRROR_RADIUS, NEEDLE_RADIUS, mirrorSample, animateMirrorSample, reflectSpherePoint, createMirrorCoordinates } from '../js/runder-spiegel.js';

const close=(a,b,tolerance=1e-11)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const same=(a,b,tolerance)=>['x','y','z'].forEach(axis=>close(a[axis],b[axis],tolerance));
const dot=(a,b)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
const unit=a=>{const length=Math.hypot(...a);return a.map(n=>n/length);};
const state=p=>getProjectionState('runder-spiegel',p);

test('Runder-Spiegel flattens before thinning across six reversible keyboard checkpoints',()=>{
    const stops=[0,.2,.4,.6,.8,1];
    assert.deepEqual(getProjectionCheckpoints('runder-spiegel'),stops);
    for(let i=0;i<stops.length;i++) {
        close(getNextProjectionCheckpoint('runder-spiegel',stops[i]),stops[(i+1)%stops.length]);
        close(getPreviousProjectionCheckpoint('runder-spiegel',stops[i]),stops[(i+stops.length-1)%stops.length]);
    }
    close(state(0).globeOpacity,1); close(state(.2).globeOpacity,.22);
    close(state(.4).globeOpacity,0); close(state(.4).reflectionOpacity,1);
    close(state(.6).radius,MIRROR_RADIUS); close(state(.8).radius,NEEDLE_RADIUS);
    close(state(.6).flatten,1); close(state(.6).shrink,0);
    close(state(.8).flatten,1); close(state(.8).stretch,0);
    close(state(1).flatten,1); close(state(1).radius,0);
    const before=state(.2-1e-10),after=state(.2+1e-10);
    assert.equal(before.globe,true);assert.equal(after.globe,false);
    close(before.globeOpacity,after.reflectionOpacity,1e-8);
    close(after.globeOpacity,0);
});

test('finite mirror samples satisfy the cylinder, sphere and exact specular reflection law',()=>{
    for(const radius of [MIRROR_RADIUS,.1,NEEDLE_RADIUS]) {
        for(const u of [-1,-.99,-.4,0,.4,.99,1]) for(const v of [-.99,-.5,0,.5,.99]) {
            const m=mirrorSample(u,v,radius), g=m.geography;
            close(m.x*m.x+m.z*m.z,radius*radius);
            close(dot(g,g),1);
            const normal=[m.sinTheta,0,m.cosTheta];
            const outgoing=unit([-m.x,-m.y,1-m.z]);
            const incoming=unit([g[0]-m.x,g[1]-m.y,g[2]-m.z]);
            const reflected=outgoing.map((n,i)=>2*dot(normal,outgoing)*normal[i]-n);
            incoming.forEach((n,i)=>close(n,reflected[i],1e-10));
            assert.ok(dot(normal,outgoing)>-1e-12,'observer sees the front of the mirror');
            assert.ok(dot(normal,incoming)>-1e-12,'source lies outside the reflecting surface');
            if(Math.abs(u)<.999) {
                const inverse=reflectSpherePoint(Math.atan2(g[0],g[2]),Math.asin(g[1]),radius);
                assert.ok(inverse);close(inverse.u,u,1e-9);close(inverse.v,v,1e-9);
            }
        }
    }
    assert.equal(reflectSpherePoint(Math.PI,0,MIRROR_RADIUS),null,'finite mirrors cannot see the back wedge');
    assert.equal(reflectSpherePoint(0,Math.PI/2,MIRROR_RADIUS),null,'finite cylinder excludes the polar caps');
});

test('Earth patches travel to the cylinder along their incident reflection paths while fading in',()=>{
    for(const u of [-1,-.5,0,.5,1]) for(const v of [-.9,-.5,0,.5,.9]) {
        const sample=mirrorSample(u,v,MIRROR_RADIUS);
        const start=animateMirrorSample(sample,u,state(.2),{});
        same(start,{x:sample.geography[0],y:sample.geography[1],z:sample.geography[2]});
        for(const p of [.2,.25,.3,.35,.4]) {
            const s=state(p), actual=animateMirrorSample(sample,u,s,{}), t=s.transfer;
            ['x','y','z'].forEach((axis,i)=>close(actual[axis],(1-t)*sample.geography[i]+t*sample[axis]));
            close(s.reflectionOpacity,.22+.78*t);
            if(p>.2) close(s.globeOpacity,0);
            close(s.radius,MIRROR_RADIUS);
        }
        same(animateMirrorSample(sample,u,state(.4),{}),sample);
        assert.ok(Math.hypot(start.x-sample.x,start.y-sample.y,start.z-sample.z)>.01,'transfer includes visible motion');
    }
});

test('the wide reflection flattens along perspective rays before any thinning or magnification',()=>{
    for(const u of [-1,-.5,0,.5,1]) for(const v of [-1,-.5,0,.5,1]) {
        const sample=mirrorSample(u,v,MIRROR_RADIUS);
        for(const p of [.4,.45,.5,.55,.6]) {
            const s=state(p), point=animateMirrorSample(sample,u,s,{});
            close(point.x/(1-point.z),sample.x/sample.t);
            close(point.y/(1-point.z),sample.y/sample.t);
            close(s.radius,MIRROR_RADIUS);close(s.shrink,0);close(s.stretch,0);
        }
        const flat=animateMirrorSample(sample,u,state(.6),{});
        same(flat,{x:sample.x/sample.t,y:sample.y/sample.t,z:0});
    }
});

test('thinning narrows an already-flat perspective image without horizontal magnification',()=>{
    for(const u of [-1,-.5,0,.5,1]) for(const v of [-1,-.5,0,.5,1]) {
        let previousRadius=Infinity;
        for(const p of [.6,.65,.7,.75,.8]) {
            const s=state(p), sample=mirrorSample(u,v,s.radius), point=animateMirrorSample(sample,u,s,{});
            same(point,{x:sample.x/sample.t,y:sample.y/sample.t,z:0});
            close(s.flatten,1);close(s.stretch,0);
            close(point.x,u*s.radius/Math.sqrt(1-s.radius*s.radius));
            assert.ok(s.radius<previousRadius,'cylinder continues shrinking');
            assert.ok(s.metalOpacity>0,'faint cylinder stays visible as it shrinks');
            previousRadius=s.radius;
        }
    }
});

test('the final stretch magnifies the planar perspective image into the exact square',()=>{
    for(const u of [-1,-.5,0,.5,1]) for(const v of [-1,-.5,0,.5,1]) {
        for(const p of [.8,.85,.9,.95]) {
            const s=state(p), sample=mirrorSample(u,v,s.radius), point=animateMirrorSample(sample,u,s,{});
            close(point.x,u*s.imageHalfWidth);
            close(point.y,sample.y/sample.t);
            close(point.z,0);close(s.flatten,1);
        }
        const s=state(1), flat=animateMirrorSample(mirrorSample(u,v,s.radius),u,s,{});
        same(flat,{x:u,y:v,z:0});
    }
});

test('the shrinking mirror converges to the requested map and is finite at radius zero',()=>{
    const {coordinates}=createMirrorCoordinates(40,24);
    for(const {u,v,longitude,latitude} of coordinates) {
        const limit=mirrorSample(u,v,0);
        const globe=[Math.cos(latitude)*Math.sin(longitude),Math.sin(latitude),Math.cos(latitude)*Math.cos(longitude)];
        limit.geography.forEach((n,i)=>close(n,globe[i],1e-10));
        for(const radius of [1e-6,1e-12,1e-20,0]) {
            const sample=mirrorSample(u,v,radius);
            assert.ok([sample.x,sample.y,sample.z,sample.t,...sample.geography].every(Number.isFinite));
            close(sample.y/sample.t,v,2e-6);
            sample.geography.forEach((n,i)=>close(n,globe[i],1e-5));
        }
        const final=projectPoint(longitude,latitude,state(1),{});
        same(final,{x:Math.sin(longitude/2),y:Math.tan(latitude/2),z:0});
        same(animateMirrorSample(limit,u,state(1),{}),final);
    }
});

test('reflection geometry and geography join continuously and stay inside the framing bounds',()=>{
    for(const u of [-1,-.7,0,.7,1]) for(const v of [-1,-.7,0,.7,1]) {
        for(const checkpoint of [.4,.6,.8,1]) {
            const before=state(checkpoint-1e-9),after=state(Math.min(1,checkpoint+1e-9));
            const a=mirrorSample(u,v,before.radius),b=mirrorSample(u,v,after.radius);
            same(animateMirrorSample(a,u,before,{}),animateMirrorSample(b,u,after,{}),1e-6);
            a.geography.forEach((n,i)=>close(n,b.geography[i],1e-6));
        }
        for(let i=21;i<=100;i++) {
            const s=state(i/100), sample=mirrorSample(u,v,s.radius), p=animateMirrorSample(sample,u,s,{});
            assert.ok([p.x,p.y,p.z,...sample.geography].every(Number.isFinite));
            [p.x,p.y,p.z].forEach((n,axis)=>assert.ok(Math.abs(n)<=s.frameExtent[axis]+1e-10));
        }
    }
    for(const lon of [-Math.PI,-1,0,1,Math.PI]) for(const lat of [-Math.PI/2,-1,0,1,Math.PI/2]) {
        same(projectPoint(lon,lat,state(0),{}),{x:Math.cos(lat)*Math.sin(lon),y:Math.sin(lat),z:Math.cos(lat)*Math.cos(lon)});
    }
});
