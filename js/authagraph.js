import {dot,unit,add,sub,scale,cross,makeNet,createPolyhedralAnimation,transformPoint} from './platonic.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const L=Math.sqrt(24), H=L*Math.sqrt(3)/2;
const vertices=[[-L/2,-H/3,1],[L/2,-H/3,1],[0,2*H/3,1],[0,0,-3]];
const faces=[[0,1,2],[1,3,2],[1,0,3],[0,2,3]].map((indices,id)=>({
    id,indices,vertices:indices.map(i=>vertices[i]),normal:unit(indices.map(i=>vertices[i]).reduce(add,[0,0,0])),
}));
const solid={vertices,faces};solid.net=makeNet(solid,[-1,0,1,2]);
// The paper's 1/24 domains are vertex-edge-center triangles. The final
// projection evaluates equations 2.22–2.23 (Narukawa, 2022), not Imago.
export const authagraphPatches=faces.flatMap(face=>face.indices.flatMap(a=>face.indices.filter(b=>b!==a).map(b=>{
    const V=vertices[a], E=scale(add(V,vertices[b]),0.5), F=scale(face.vertices.reduce(add,[0,0,0]),1/3);
    const pole=unit(V), meridian=unit(sub(unit(vertices[b]),scale(pole,dot(pole,unit(vertices[b])))));
    let east=cross(pole,meridian);if(dot(east,F)<0)east=scale(east,-1);
    const full=createPolyhedralAnimation(solid,1);
    const mean=transformPoint(full.transforms[face.id],scale(add(add(V,E),F),1/3));
    return {face,V,E,F,pole,meridian,east,triangle:[V,E,F],cut:mean[0]<L/2-1e-8};
})));

const rad=d=>d*Math.PI/180;
const dms=(d,m,s)=>rad(d+m/60+s/3600);
const geo=(lon,lat)=>[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];
// Published tetrahedron aspect: vertex near 76°53'N, 149°27'E.
const g0=geo(dms(149,27,3.56868),dms(76,52,51.82608));
const g1=geo(dms(97,21,25.2126),-dms(27,57,9.99792));
const s0=unit(vertices[0]),s1=unit(sub(unit(vertices[1]),scale(s0,dot(s0,unit(vertices[1])))));
const t1=unit(sub(g1,scale(g0,dot(g0,g1))));
const sourceBasis=[s0,s1,cross(s0,s1)], geoBasis=[g0,t1,cross(g0,t1)];
export const authagraphToGeo=d=>geoBasis.reduce((p,b,i)=>add(p,scale(b,dot(d,sourceBasis[i]))),[0,0,0]);
const toScene=d=>sourceBasis.reduce((p,b,i)=>add(p,scale(b,dot(d,geoBasis[i]))),[0,0,0]);

export function containsTriangle(direction,triangle) {
    const center=triangle.reduce(add,[0,0,0]);
    return triangle.every((a,i)=>{const n=cross(a,triangle[(i+1)%3]);return dot(n,direction)*Math.sign(dot(n,center))>=-1e-10;});
}
export function authagraphCoordinate(geography,patchId) {
    const direction=toScene(geography);
    const patch=patchId===undefined?authagraphPatches.find(p=>containsTriangle(direction,p.triangle)):authagraphPatches[patchId];
    if(!patch)throw new Error('AuthaGraph domain not found');
    const sinPhi=Math.max(-1,Math.min(1,dot(direction,patch.pole)));
    const cosPhi=Math.hypot(dot(direction,patch.meridian),dot(direction,patch.east));
    const lambda=Math.atan2(dot(direction,patch.east),dot(direction,patch.meridian));
    const c=(2+Math.cos(lambda))*cosPhi/(Math.SQRT2*cosPhi+sinPhi);
    const x=2/Math.PI*c*(lambda-Math.asin(Math.sin(lambda)/Math.sqrt(3)));
    const y=(Math.SQRT2-c)/Math.sqrt(3);
    const target=add(patch.E,add(scale(sub(patch.V,patch.E),y/Math.sqrt(2/3)),scale(sub(patch.F,patch.E),x/(Math.SQRT2/3))));
    return {direction,geography,target,patch,patchId:authagraphPatches.indexOf(patch)};
}
export function authagraphAnimation(progress) {
    const shape=clamp(progress*2),unfold=clamp(progress*4-2),reframe=clamp(progress*4-3);
    const base=createPolyhedralAnimation(solid,0.5+unfold/2);
    const offset=[-(solid.net.center[0]+(1.5*L-solid.net.center[0])*reframe)*unfold,-solid.net.center[1]*unfold,0];
    const extent=[1,1,1];
    for(const patch of authagraphPatches)for(const v of patch.triangle){
        const p=transformPoint(base.transforms[patch.face.id],v);
        p[0]+=offset[0]+(patch.cut?2*L*reframe:0);p[1]+=offset[1];
        p.forEach((value,axis)=>extent[axis]=Math.max(extent[axis],Math.abs(value)*shape+1-shape));
    }
    return {...base,shape,offset,reframe,extent};
}
export function animateAuthagraph(c,a,out) {
    const p=transformPoint(a.transforms[c.patch.face.id],c.target);
    p[0]+=a.offset[0]+(c.patch.cut?2*L*a.reframe:0);p[1]+=a.offset[1];
    out.x=-(c.direction[0]+(p[0]-c.direction[0])*a.shape);
    out.y=-(c.direction[1]+(p[1]-c.direction[1])*a.shape);
    out.z=c.direction[2]+(p[2]-c.direction[2])*a.shape;
    return out;
}
