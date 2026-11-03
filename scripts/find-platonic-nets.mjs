// Offline deterministic search. Runtime only loads the chosen hinge trees.
import { writeFile } from 'node:fs/promises';
import { PLATONIC_SOLIDS, hingeFor, hingeTransform, compose, transformPoint } from '../js/platonic.js';

// Convex separating-axis test; touching edges/vertices are allowed.
export function polygonsOverlap(a,b) {
    for(const polygon of [a,b]) for(let i=0;i<polygon.length;i++) {
        const p=polygon[i], q=polygon[(i+1)%polygon.length], axis=[q[1]-p[1],p[0]-q[0]];
        const project=poly=>poly.map(v=>v[0]*axis[0]+v[1]*axis[1]);
        const x=project(a),y=project(b);
        if(Math.min(Math.max(...x),Math.max(...y))-Math.max(Math.min(...x),Math.min(...y))<1e-7) return false;
    }
    return true;
}
let seed=642107;
const random=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);
const selected={};
for(const [type,solid] of Object.entries(PLATONIC_SOLIDS)) {
    let best=null;
    const local=solid.faces.map(face=>Object.fromEntries(face.neighbors.map(id=>{
        const {a,b,angle}=hingeFor(solid,face.id,id);
        return [id,hingeTransform(a,b,angle)];
    })));
    for(let trial=0;trial<2500;trial++) {
        const parents=Array(solid.faces.length).fill(null), transforms=[], polygons=[];
        parents[0]=-1;transforms[0]={r:[1,0,0,0,1,0,0,0,1],t:[0,0,0]};polygons[0]=solid.faces[0].vertices;
        const candidates=solid.faces[0].neighbors.map(child=>[0,child]);let count=1;
        while(candidates.length) {
            const i=Math.floor(random()*candidates.length),[parent,child]=candidates.splice(i,1)[0];
            if(parents[child]!==null) continue;
            const transform=compose(transforms[parent],local[parent][child]);
            const polygon=solid.faces[child].vertices.map(p=>transformPoint(transform,p));
            if(polygons.some(p=>p&&polygonsOverlap(p,polygon))) continue;
            parents[child]=parent;transforms[child]=transform;polygons[child]=polygon;count++;
            for(const next of solid.faces[child].neighbors) if(parents[next]===null) candidates.push([child,next]);
        }
        if(count!==solid.faces.length) continue;
        const points=polygons.flat();
        const width=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
        const height=Math.max(...points.map(p=>p[1]))-Math.min(...points.map(p=>p[1]));
        const aspect=width/height;
        if(aspect<0.85||aspect>2.2) continue;
        const score=width*height*(1+0.4*Math.abs(Math.log(aspect/1.4)));
        if(!best||score<best.score-1e-6) best={parents,score,width,height};
    }
    if(!best) throw new Error(`No compact net for ${type}`);
    // The tetrahedron uses the compact triangular star, not a four-face strip.
    selected[type]=type === "tetrahedron" ? [-1,0,0,0]
        : type === "cube" ? [-1,0,0,2,0,0] : best.parents;
    console.log(type,{...best,parents:selected[type]});
}
await writeFile(new URL('../js/platonic-nets.js',import.meta.url),'// Compact non-overlapping nets selected by scripts/find-platonic-nets.mjs.\nexport const platonicNetParents = '+JSON.stringify(selected,null,2)+';\n');
