import test from 'node:test';
import assert from 'node:assert/strict';
import { PLATONIC_SOLIDS, createPolyhedralCoordinate, createPolyhedralAnimation, animatePolyhedral, add, sub, scale, dot, cross, unit } from '../js/platonic.js';
import { getProjectionState, getProjectionCheckpoints, getNextProjectionCheckpoint, getPreviousProjectionCheckpoint, projectPoint } from '../js/projections.js';
import { localDistortion, measureProjectionDistortion } from '../js/distortion.js';
import { distortionScores } from '../js/distortion-data.js';
import { projectionInfo } from '../js/projection-info.js';
import { projectionCatalog } from '../js/projection-catalog.js';

const distance=(a,b)=>Math.hypot(...sub(a,b));
const close=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const position=(coordinate,progress,animation)=>{
    const p=animatePolyhedral(coordinate,progress,{},animation);
    return [p.x,p.y,p.z];
};
function overlaps(a,b) {
    for(const polygon of [a,b]) for(let i=0;i<polygon.length;i++) {
        const p=polygon[i],q=polygon[(i+1)%polygon.length],axis=[q[1]-p[1],p[0]-q[0]];
        const project=poly=>poly.map(v=>v[0]*axis[0]+v[1]*axis[1]);
        const x=project(a),y=project(b);
        if(Math.min(Math.max(...x),Math.max(...y))-Math.max(Math.min(...x),Math.min(...y))<1e-7) return false;
    }
    return true;
}
const counts={tetrahedron:[4,4,3],cube:[8,6,4],octahedron:[6,8,3],dodecahedron:[20,12,5],icosahedron:[12,20,3]};
for(const [type,solid] of Object.entries(PLATONIC_SOLIDS)) {
    test(`${type}: regular solid with correct topology, unit inradius and complete face coverage`,()=>{
        const [vertices,faces,sides]=counts[type];
        assert.equal(solid.vertices.length,vertices);assert.equal(solid.faces.length,faces);
        const edges=new Set();let area=0;
        for(const face of solid.faces) {
            assert.equal(face.vertices.length,sides);
            const edgeLength=distance(face.vertices[0],face.vertices[1]);
            for(let i=0;i<sides;i++) {
                close(dot(face.vertices[i],face.normal),1);
                close(distance(face.vertices[i],face.vertices[(i+1)%sides]),edgeLength);
                edges.add([face.indices[i],face.indices[(i+1)%sides]].sort((a,b)=>a-b).join(','));
                // Solid angle of each center/edge spherical triangle.
                const [a,b,c]=[face.normal,unit(face.vertices[i]),unit(face.vertices[(i+1)%sides])];
                area+=2*Math.atan2(Math.abs(dot(a,cross(b,c))),1+dot(a,b)+dot(b,c)+dot(c,a));
            }
        }
        assert.equal(vertices-edges.size+faces,2);
        close(area,4*Math.PI);
    });
    test(`${type}: sphere → solid → planar, compact, non-overlapping net`,()=>{
        const polygons=[];
        for(const progress of [0,0.2,0.5,0.65,0.8,1]) {
            const animation=createPolyhedralAnimation(solid,progress);
            for(const face of solid.faces) {
                const center=createPolyhedralCoordinate(type,face.normal,face.id);
                const a=createPolyhedralCoordinate(type,unit(face.vertices[0]),face.id);
                const b=createPolyhedralCoordinate(type,unit(face.vertices[1]),face.id);
                const p=position(a,progress,animation);
                assert.ok(p.every(Number.isFinite));
                if(progress===0) close(Math.hypot(...p),1);
                if(progress===0.5) close(dot(p,face.normal),1);
                if(progress>=0.5) {
                    close(distance(p,position(b,progress,animation)),distance(a.target,b.target));
                    close(distance(p,position(center,progress,animation)),distance(a.target,center.target));
                }
                if(progress===1) {
                    const polygon=face.vertices.map(v=>position(createPolyhedralCoordinate(type,unit(v),face.id),progress,animation));
                    polygon.forEach(v=>close(v[2],1));polygons.push(polygon);
                }
            }
        }
        for(let i=0;i<polygons.length;i++) for(let j=i+1;j<polygons.length;j++) assert.equal(overlaps(polygons[i],polygons[j]),false,`faces ${i}/${j} overlap`);
        const points=polygons.flat();
        const width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
        const height=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
        assert.ok(width/height>=0.85&&width/height<=2.2,`compact aspect ratio: ${width/height}`);
        close(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])),0);
        close(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])),0);
    });
    test(`${type}: hinges stay connected throughout unfolding`,()=>{
        for(const progress of [0.5,0.6,0.75,0.9,1]) {
            const animation=createPolyhedralAnimation(solid,progress);
            for(const face of solid.faces.slice(1)) {
                const parent=solid.faces[solid.net.parents[face.id]];
                const shared=face.indices.filter(i=>parent.indices.includes(i));
                assert.equal(shared.length,2);
                for(const i of shared) {
                    const direction=unit(solid.vertices[i]);
                    close(distance(position(createPolyhedralCoordinate(type,direction,face.id),progress,animation),position(createPolyhedralCoordinate(type,direction,parent.id),progress,animation)),0);
                }
            }
        }
    });
    test(`${type}: measured distortion agrees with gnomonic stretch factors`,()=>{
        const face=solid.faces[0],tangent=unit(sub(face.vertices[0],face.normal));
        const direction=unit(add(face.normal,scale(tangent,0.3)));
        const animation=createPolyhedralAnimation(solid,1);
        const project=p=>position(createPolyhedralCoordinate(type,p,face.id),1,animation);
        const result=localDistortion(project,direction);
        const cosine=dot(direction,face.normal);
        close(result.area,1/cosine**3);
        close(result.angle,2*Math.asin((1-cosine)/(1+cosine))*180/Math.PI);
        const measured=measureProjectionDistortion(type,4096);
        assert.ok(measured.areaDifference>0&&measured.angleError>0);
        assert.ok(distortionScores[type].areaDifference>0&&distortionScores[type].angleError>0);
    });
    test(`${type}: integrated projection, stages, chooser and Wikipedia entry`,()=>{
        assert.ok(projectionCatalog.find(item=>item.id===type&&item.title===`${type[0].toUpperCase()+type.slice(1)} unfolding`));
        assert.equal(projectionInfo[type].article,type[0].toUpperCase()+type.slice(1));
        assert.ok(projectionInfo[type].text.length>0);
        assert.deepEqual(getProjectionCheckpoints(type),[0,0.5,1]);
        close(getNextProjectionCheckpoint(type,0),0.5);close(getPreviousProjectionCheckpoint(type,1),0.5);
        for(const progress of [0,0.5,1]) {
            const state=getProjectionState(type,progress);
            const p=projectPoint(0.3,0.4,state,{});
            assert.ok([p.x,p.y,p.z].every(Number.isFinite));
            if(progress===0) close(Math.hypot(p.x,p.y,p.z),1);
            if(progress===1) close(p.z,1);
        }
    });
}
