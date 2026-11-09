import test from 'node:test';
import assert from 'node:assert/strict';
import {authagraphPatches,authagraphToGeo,authagraphCoordinate,containsTriangle} from '../js/authagraph.js';
import {dymaxionSolid,dymaxionPatchCoordinate} from '../js/dymaxion.js';
import {peirceCoordinate,peirceInverse,animatePeirce,peircePatches} from '../js/peirce.js';
import {advancedSurface,advancedState,animateAdvanced} from '../js/advanced-projections.js';
import {getProjectionCheckpoints} from '../js/projections.js';
import {measureProjectionDistortion} from '../js/distortion.js';
import {dot,cross,unit,add} from '../js/platonic.js';
const close=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const area=tri=>{const [a,b,c]=tri.map(unit);return 2*Math.atan2(Math.abs(dot(a,cross(b,c))),1+dot(a,b)+dot(b,c)+dot(c,a));};

test('AuthaGraph 24 paper domains cover the globe once and meet continuously on the closed tetrahedron',()=>{
    assert.equal(authagraphPatches.length,24);
    close(authagraphPatches.reduce((s,p)=>s+area(p.triangle),0),4*Math.PI);
    for(const patch of authagraphPatches) for(let i=0;i<3;i++) {
        const d=unit(add(patch.triangle[i],patch.triangle[(i+1)%3]));
        const matches=authagraphPatches.map((p,id)=>containsTriangle(d,p.triangle)?authagraphCoordinate(authagraphToGeo(d),id):null).filter(Boolean);
        assert.ok(matches.length>=2);
        for(const match of matches) match.target.forEach((value,axis)=>close(value,matches[0].target[axis]));
    }
});

test('AuthaGraph evaluates the paper equations at each vertex, edge midpoint and face center',()=>{
    for(const [id,patch] of authagraphPatches.entries()) for(const v of patch.triangle) {
        const c=authagraphCoordinate(authagraphToGeo(unit(v)),id);
        c.target.forEach((value,axis)=>close(value,v[axis]));
    }
    const pole=authagraphCoordinate(authagraphToGeo(unit(authagraphPatches[0].V)),0);
    pole.target.forEach((value,axis)=>close(value,authagraphPatches[0].V[axis]));
});

test('AuthaGraph rearranges its complete tetrahedral surface into a 4:sqrt(3) rectangle',()=>{
    const surface=advancedSurface('authagraph'),state=advancedState('authagraph',1);
    let totalArea=0;
    const points=surface.coordinates.map(c=>animateAdvanced(c.advanced,state,{}));
    for(let i=0;i<surface.indices.length;i+=3) {
        const [a,b,c]=surface.indices.slice(i,i+3).map(index=>points[index]);
        totalArea+=Math.abs((b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y))/2;
    }
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
    close(width/height,4/Math.sqrt(3));close(totalArea,width*height,1e-5);
});

test('Dymaxion uses the 24-piece AirOcean split-face topology and covers the full sphere',()=>{
    assert.equal(dymaxionSolid.faces.length,24);assert.equal(dymaxionSolid.vertices.length,14);
    close(dymaxionSolid.faces.reduce((sum,f)=>sum+area(f.vertices),0),4*Math.PI);
    assert.equal(dymaxionSolid.net.order.length,24);
    assert.ok(measureProjectionDistortion('dymaxion',4096).areaDifference<4);
});

test('Peirce maps the north pole to the center, and its square inverse agrees with the forward projection',()=>{
    const north=peirceCoordinate([0,1,0]);close(north.target[0],0);close(north.target[1],0);
    for(const x of [-1.8,-0.7,0,0.7,1.8]) for(const y of [-1.8,-0.7,0,0.7,1.8]) {
        const d=peirceInverse(x,y),c=peirceCoordinate(d);
        close(c.target[0],x,1e-5);close(c.target[1],y,1e-5);
    }
    assert.equal(measureProjectionDistortion('peirce',4096).angleError,0);
    for(const x of [-1,1])for(const y of [-1,1])close(peirceInverse(x*2*(1-1e-9),y*2*(1-1e-9))[1],-1);
});

test('Peirce opens two hemispheres into separate squares and rearranges rigid southern quarters',()=>{
    assert.deepEqual(getProjectionCheckpoints('peirce'),[0,1/3,2/3,1]);
    const north=peirceCoordinate([0,1,0]),south=peirceCoordinate([0,-1,0]);
    close(animatePeirce(north,2/3,{}).x,-2.2);close(animatePeirce(south,2/3,{}).x,2.2);
    close(animatePeirce(north,1,{}).x,0);
    peircePatches.forEach((triangle,id)=>{
        const coordinates=triangle.map(([x,y])=>peirceCoordinate(peirceInverse(x*(1-1e-10),y*(1-1e-10)),[x,-y],id));
        for(const c of coordinates){
            const open=animatePeirce(c,1/3,{}),square=animatePeirce(c,2/3,{}),final=animatePeirce(c,1,{});
            assert.ok(open.z>=-1e-8);close(square.z,1);
            assert.ok(Math.abs(square.x-(id<4?-2.2:2.2))+Math.abs(square.y)<=2+1e-7);
            c.target.forEach((value,axis)=>close(value,[final.x,final.y,final.z][axis]));
            if(id>=4){const corner=coordinates[0],v=animatePeirce(c,2/3,{}),u=animatePeirce(corner,2/3,{});
                const distance=Math.hypot(v.x-u.x,v.y-u.y,v.z-u.z);
                for(const t of [0.7,0.8,0.9,1]){const a=animatePeirce(c,t,{}),b=animatePeirce(corner,t,{});close(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),distance);}
            }
        }
        if(id>=4){const p=animatePeirce(coordinates[0],1,{});close(Math.abs(p.x),2);close(Math.abs(p.y),2);}
    });
});

test('Fuller coordinates meet continuously along all shared Dymaxion edges before unfolding',()=>{
    const {faces,vertices}=dymaxionSolid;
    for(const a of faces)for(const b of faces)if(a.id<b.id){
        const shared=a.indices.filter(i=>b.indices.includes(i));
        if(shared.length!==2)continue;
        for(const t of [0.3,0.5,0.7]){
            const d=unit(vertices[shared[0]].map((value,i)=>value*(1-t)+vertices[shared[1]][i]*t));
            const u=dymaxionPatchCoordinate(d,a.id).target,v=dymaxionPatchCoordinate(d,b.id).target;
            u.forEach((value,i)=>close(value,v[i],1e-5));
        }
    }
});

test('advanced mesh stages remain finite, preserve fixed geography and finish in one plane',()=>{
    for(const type of ['authagraph','dymaxion','peirce']) {
        const mesh=advancedSurface(type);
        for(let i=0;i<mesh.coordinates.length;i+=43) {
            const c=mesh.coordinates[i].advanced;
            close(Math.hypot(...c.geography),1);close(Math.hypot(...c.direction),1);
            for(const progress of [0,0.25,0.5,0.75,1]) {
                const p=animateAdvanced(c,advancedState(type,progress),{});
                assert.ok(Object.values(p).every(Number.isFinite),`${type}/${i}/${progress}`);
                if(progress===0)close(Math.hypot(p.x,p.y,p.z),1);
                if(progress===1)close(p.z,1);
            }
            for(const t of getProjectionCheckpoints(type).slice(1,-1)) {
                const a=animateAdvanced(c,advancedState(type,t-1e-8),{}),b=animateAdvanced(c,advancedState(type,t+1e-8),{});
                close(a.x,b.x,1e-5);close(a.y,b.y,1e-5);close(a.z,b.z,1e-5);
            }
        }
    }
});
