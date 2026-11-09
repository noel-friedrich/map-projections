import {geoAirocean,geoRotation} from './vendor/projection-math.js';
import {dot,unit,add,sub,scale,cross,makeNet,createPolyhedralAnimation,animatePolyhedral} from './platonic.js';
import {containsTriangle} from './authagraph.js';
const deg=180/Math.PI;
const vector=([lon,lat])=>{lon/=deg;lat/=deg;return [Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];};
const lonlat=d=>[Math.atan2(d[0],d[2])*deg,Math.asin(Math.max(-1,Math.min(1,d[1])))*deg];
const projection=geoAirocean(),rotation=geoRotation(projection.rotate()),nodes=projection.faces;
const front=vector(nodes[0].site),right=unit(cross([0,1,0],front)),up=cross(front,right);
const toScene=d=>{const x=dot(d,right),y=dot(d,up);return [x/2+y*Math.sqrt(3)/2,-x*Math.sqrt(3)/2+y/2,dot(d,front)];};
const vertices=[];
const faces=nodes.map((node,id)=>{
    const normal=vector(node.site);
    const indices=node.face.map(ll=>{
        const d=vector(ll),p=toScene(scale(d,1/dot(d,normal)));
        let index=vertices.findIndex(v=>Math.hypot(...v.map((value,i)=>value-p[i]))<1e-6);
        if(index<0){index=vertices.length;vertices.push(p);}
        return index;
    });
    return {id,indices,vertices:indices.map(i=>vertices[i]),normal:toScene(normal),node,
        triangle:node.face.map(vector),projected:node.face.map(ll=>node.project(ll))};
});
const parents=Array(nodes.length).fill(-1);
for(const node of nodes)for(const child of node.children??[])parents[child.id]=node.id;
export const dymaxionSolid={vertices,faces};dymaxionSolid.net=makeNet(dymaxionSolid,parents);
export function dymaxionCoordinate(geography,faceId) {
    const ll=rotation(lonlat(geography)),base=vector(ll);
    const face=faceId===undefined?faces.find(f=>containsTriangle(base,f.triangle)):faces[faceId];
    if(!face)throw new Error('Dymaxion face not found');
    const [a,b,c]=face.projected,q=face.node.project(ll);
    const det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const v=((q[0]-a[0])*(c[1]-a[1])-(q[1]-a[1])*(c[0]-a[0]))/det;
    const w=((b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]))/det;
    const target=add(scale(face.vertices[0],1-v-w),add(scale(face.vertices[1],v),scale(face.vertices[2],w)));
    return {direction:toScene(base),geography,target,face,patchId:face.id};
}
export function dymaxionPatchCoordinate(direction,faceId) {
    const x=direction[0]/2-direction[1]*Math.sqrt(3)/2,y=direction[0]*Math.sqrt(3)/2+direction[1]/2;
    const base=add(add(scale(right,x),scale(up,y)),scale(front,direction[2]));
    return dymaxionCoordinate(vector(rotation.invert(lonlat(base))),faceId);
}
export const dymaxionAnimation=progress=>createPolyhedralAnimation(dymaxionSolid,progress);
export const animateDymaxion=(coordinate,animation,out)=>animatePolyhedral(coordinate,0,out,animation);
