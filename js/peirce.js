import {geoPeirceQuincuncial} from './vendor/projection-math.js';
export const peirceProjection=geoPeirceQuincuncial().scale(1).translate([0,0]);
export const PEIRCE_HALF=2.238066115687872;
const deg=180/Math.PI, scale=2/PEIRCE_HALF;
const clamp=x=>Math.max(0,Math.min(1,x));
const quadrants=[[1,1],[-1,1],[-1,-1],[1,-1]];
export const peircePatches=[...quadrants.map(([sx,sy])=>[[0,0],[sx*2,0],[0,sy*2]]),
    ...quadrants.map(([sx,sy])=>[[sx*2,sy*2],[sx*2,0],[0,sy*2]])];
export function peirceCoordinate(geography,target,patchId) {
    const lon=Math.atan2(geography[0],geography[2]),lat=Math.asin(Math.max(-1,Math.min(1,geography[1])));
    const q=target??peirceProjection([lon*deg,lat*deg]).map(v=>v*scale);
    const x=q[0],y=-q[1],north=patchId===undefined?geography[1]>=0:patchId<4;
    const [sx,sy]=patchId===undefined?[Math.sign(x)||1,Math.sign(y)||1]:quadrants[patchId%4];
    // Reflect the southern target quarter back into a single hemisphere square,
    // then mirror x to match the rear hemisphere turned toward the viewer.
    const flat=north?[x,y]:[-(sx*2-sx*sy*y),sy*2-sx*sy*x];
    return {geography,direction:[geography[0],-geography[2],geography[1]],target:[x,y,1],north,sx,sy,flat,patchId};
}
export function peirceInverse(x,y) {
    const ll=peirceProjection.invert([x/scale,-y/scale]);
    const lon=ll[0]/deg,lat=ll[1]/deg;
    return [Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];
}
export function animatePeirce(c,progress,out) {
    const open=clamp(progress*3),square=clamp(progress*3-1),assemble=clamp(progress*3-2);
    const [x,y,z]=c.direction;
    if(progress<=1/3){
        const a=-Math.PI*open,cos=Math.cos(a),sin=Math.sin(a);
        out.x=(c.north?x:1+(x-1)*cos+z*sin)-open;
        out.y=y;out.z=c.north?z:-(x-1)*sin+z*cos;
    }else if(progress<=2/3){
        const localX=c.north?x:-x;
        out.x=(c.north?-1:1)*(1+1.2*square)+localX+(c.flat[0]-localX)*square;
        out.y=y+(c.flat[1]-y)*square;
        out.z=Math.abs(z)+(1-Math.abs(z))*square;
    }else if(c.north){
        out.x=c.target[0]-2.2*(1-assemble);out.y=c.target[1];out.z=1;
    }else{
        // Each southern quarter is a rigid right triangle. Quarter-turn it
        // while moving its south-pole corner to the corresponding outer corner.
        const a=c.sx*c.sy*Math.PI/2*assemble,cos=Math.cos(a),sin=Math.sin(a);
        out.x=2.2*(1-assemble)+c.sx*2*assemble+cos*c.flat[0]-sin*c.flat[1];
        out.y=c.sy*2*assemble+sin*c.flat[0]+cos*c.flat[1];
        out.z=1+0.45*Math.sin(Math.PI*assemble);
    }
    return out;
}

const frameSamples=[];
for(let lat=-90;lat<=90;lat+=15)for(let lon=-180;lon<180;lon+=15){
    const p=lat/deg,l=lon/deg;
    frameSamples.push(peirceCoordinate([Math.cos(p)*Math.sin(l),Math.sin(p),Math.cos(p)*Math.cos(l)]));
}
peircePatches.forEach((triangle,id)=>triangle.forEach(([x,y])=>{
    frameSamples.push(peirceCoordinate(peirceInverse(x*(1-1e-10),y*(1-1e-10)),[x,-y],id));
}));
export function peirceExtent(progress) {
    const extent=[1,1,1],position={};
    for(const c of frameSamples){animatePeirce(c,progress,position);[position.x,position.y,position.z].forEach((v,i)=>extent[i]=Math.max(extent[i],Math.abs(v)));}
    return extent.map(v=>v*1.03);
}
