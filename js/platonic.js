import { platonicNetParents } from './platonic-nets.js';

const EPS = 1e-8;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, k) => a.map(v => v * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
export const unit = a => scale(a, 1 / Math.hypot(...a));
const identity = () => ({ r: [1,0,0, 0,1,0, 0,0,1], t: [0,0,0] });
const multiply = (r, p) => [0,1,2].map(i => r[i*3]*p[0] + r[i*3+1]*p[1] + r[i*3+2]*p[2]);
export const transformPoint = (transform, point) => add(multiply(transform.r, point), transform.t);
export function compose(a, b) {
    const r = Array.from({ length: 9 }, (_, index) => {
        const i = Math.floor(index / 3), j = index % 3;
        return [0,1,2].reduce((sum, k) => sum + a.r[i*3+k] * b.r[k*3+j], 0);
    });
    return { r, t: transformPoint(a, b.t) };
}
export function hingeTransform(a, b, angle) {
    const [x,y,z] = unit(sub(b,a)), c = Math.cos(angle), s = Math.sin(angle), q = 1-c;
    const r = [c+x*x*q, x*y*q-z*s, x*z*q+y*s,
        y*x*q+z*s, c+y*y*q, y*z*q-x*s,
        z*x*q-y*s, z*y*q+x*s, c+z*z*q];
    return { r, t: sub(a, multiply(r,a)) };
}

// Find the supporting planes, merging coplanar triangles into regular polygons.
function convexFaces(vertices) {
    const found = new Map();
    for (let a=0;a<vertices.length;a++) for (let b=a+1;b<vertices.length;b++) for (let c=b+1;c<vertices.length;c++) {
        let normal = cross(sub(vertices[b],vertices[a]), sub(vertices[c],vertices[a]));
        if (Math.hypot(...normal)<EPS) continue;
        normal = unit(normal);
        let distance = dot(normal,vertices[a]);
        if (distance<0) { normal=scale(normal,-1); distance=-distance; }
        if (vertices.some(p => dot(normal,p)>distance+EPS)) continue;
        const indices = vertices.flatMap((p,i) => Math.abs(dot(normal,p)-distance)<EPS ? [i] : []);
        const key = indices.join(',');
        if (found.has(key)) continue;
        const center=scale(normal,distance), right=unit(sub(vertices[indices[0]],center)), up=cross(normal,right);
        indices.sort((i,j) => Math.atan2(dot(sub(vertices[i],center),up),dot(sub(vertices[i],center),right)) - Math.atan2(dot(sub(vertices[j],center),up),dot(sub(vertices[j],center),right)));
        found.set(key,{indices,normal,distance});
    }
    return [...found.values()];
}

export function hingeFor(solid, parentId, childId) {
    const parent=solid.faces[parentId], child=solid.faces[childId];
    const shared=parent.indices.filter(i=>child.indices.includes(i));
    if (shared.length!==2) throw new Error('Hinges must join adjacent faces');
    const [a,b]=shared.map(i=>solid.vertices[i]);
    const axis=unit(sub(b,a));
    const angle=Math.atan2(dot(axis,cross(child.normal,parent.normal)),dot(child.normal,parent.normal));
    return {a,b,angle};
}
export function makeNet(solid, parents) {
    const order=[0], hinges=[];
    for(let i=0;i<order.length;i++) {
        const parent=order[i];
        for(let child=1;child<parents.length;child++) if(parents[child]===parent) {
            hinges[child]=hingeFor(solid,parent,child);
            order.push(child);
        }
    }
    if(order.length!==solid.faces.length) throw new Error('Net must be a connected tree');
    const net={ parents,order,hinges,center:[0,0,0] };
    const transforms=netTransforms(net,1);
    const points=solid.faces.flatMap(face=>face.vertices.map(p=>transformPoint(transforms[face.id],p)));
    net.center=[0,1].map(axis=>(Math.min(...points.map(p=>p[axis]))+Math.max(...points.map(p=>p[axis])))/2);
    return net;
}
function netTransforms(net, amount) {
    const transforms=[identity()];
    for(const id of net.order.slice(1)) {
        const {a,b,angle}=net.hinges[id];
        transforms[id]=compose(transforms[net.parents[id]],hingeTransform(a,b,angle*amount));
    }
    return transforms;
}
function buildSolid(rawVertices, type) {
    const rawFaces=convexFaces(rawVertices);
    const root=rawFaces.reduce((best,face)=>face.normal[2]>best.normal[2]+EPS?face:best);
    const right=unit(sub(rawVertices[root.indices[1]],rawVertices[root.indices[0]])), up=cross(root.normal,right);
    const vertices=rawVertices.map(p=>[dot(p,right)/root.distance,dot(p,up)/root.distance,dot(p,root.normal)/root.distance]);
    const faces=[root,...rawFaces.filter(face=>face!==root)].map((face,id)=>({id,indices:face.indices,
        vertices:face.indices.map(i=>vertices[i]),normal:[dot(face.normal,right),dot(face.normal,up),dot(face.normal,root.normal)]}));
    const solid={type,vertices,faces};
    for(const face of faces) face.neighbors=faces.filter(other=>other!==face&&face.indices.filter(i=>other.indices.includes(i)).length===2).map(other=>other.id);
    let parents=platonicNetParents[type];
    if(!parents) {
        parents=Array(faces.length).fill(null); parents[0]=-1; const queue=[0];
        for(let i=0;i<queue.length;i++) for(const child of faces[queue[i]].neighbors) if(parents[child]===null) {parents[child]=queue[i];queue.push(child);}
    }
    solid.net=makeNet(solid,parents);
    return solid;
}
const phi=(1+Math.sqrt(5))/2;
const cube=[],octa=[],dodeca=[],icosa=[];
for(const x of [-1,1]) for(const y of [-1,1]) for(const z of [-1,1]) cube.push([x,y,z]);
for(let axis=0;axis<3;axis++) for(const sign of [-1,1]) octa.push([0,1,2].map(i=>i===axis?sign:0));
dodeca.push(...cube);
for(const a of [-1,1]) for(const b of [-1,1]) {
    dodeca.push([0,a/phi,b*phi],[a/phi,b*phi,0],[a*phi,0,b/phi]);
    icosa.push([0,a,b*phi],[a,b*phi,0],[a*phi,0,b]);
}
export const PLATONIC_SOLIDS = Object.fromEntries(Object.entries({
    tetrahedron:[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]],cube,octahedron:octa,dodecahedron:dodeca,icosahedron:icosa,
}).map(([type,vertices])=>[type,buildSolid(vertices,type)]));

export function createPolyhedralCoordinate(type, direction, faceId) {
    const solid=PLATONIC_SOLIDS[type];
    const face=faceId===undefined ? solid.faces.reduce((best,f)=>dot(direction,f.normal)>dot(direction,best.normal)?f:best) : solid.faces[faceId];
    // Central (gnomonic) projection onto a face tangent to the unit sphere.
    return {direction,target:scale(direction,1/dot(direction,face.normal)),face};
}
export function createPolyhedralAnimation(solid, progress) {
    const shape=Math.min(1,Math.max(0,progress*2)), unfold=Math.min(1,Math.max(0,progress*2-1));
    const transforms=netTransforms(solid.net,unfold);
    const offset=[-solid.net.center[0]*unfold,-solid.net.center[1]*unfold,0];
    const points=solid.faces.flatMap(face=>face.vertices.map(p=>add(transformPoint(transforms[face.id],p),offset)));
    const extent=[0,1,2].map(axis=>Math.max(1,...points.map(p=>Math.abs(p[axis]))));
    return {shape,unfold,transforms,offset,extent};
}
export function animatePolyhedral(coordinate, progress, position, animation) {
    const {shape,transforms,offset}=animation;
    const p=add(transformPoint(transforms[coordinate.face.id],coordinate.target),offset);
    position.x=coordinate.direction[0]+(p[0]-coordinate.direction[0])*shape;
    position.y=coordinate.direction[1]+(p[1]-coordinate.direction[1])*shape;
    position.z=coordinate.direction[2]+(p[2]-coordinate.direction[2])*shape;
    return position;
}
