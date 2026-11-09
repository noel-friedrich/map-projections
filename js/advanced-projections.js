import {unit,add,scale} from './platonic.js';
import {authagraphPatches,authagraphToGeo,authagraphCoordinate,authagraphAnimation,animateAuthagraph} from './authagraph.js';
import {dymaxionSolid,dymaxionCoordinate,dymaxionPatchCoordinate,dymaxionAnimation,animateDymaxion} from './dymaxion.js';
import {peirceCoordinate,peirceInverse,animatePeirce,peircePatches,peirceExtent} from './peirce.js';
export const ADVANCED_TYPES=['authagraph','dymaxion','peirce'];
export function advancedCoordinate(type,geography,patchId) {
    return type==='authagraph'?authagraphCoordinate(geography,patchId):type==='dymaxion'?dymaxionCoordinate(geography,patchId):peirceCoordinate(geography,undefined,patchId);
}
export function advancedState(type,progress) {
    const animation=type==='authagraph'?authagraphAnimation(progress):type==='dymaxion'?dymaxionAnimation(progress):{extent:peirceExtent(progress)};
    return {type,progress,advanced:true,animation,frameExtent:animation.extent,latitudeRange:Math.PI/2};
}
export function animateAdvanced(c,state,out) {
    return state.type==='authagraph'?animateAuthagraph(c,state.animation,out):state.type==='dymaxion'?animateDymaxion(c,state.animation,out):animatePeirce(c,state.progress,out);
}
function metadata(c) {
    const d=c.geography;
    return {advanced:c,geography:d,longitude:Math.atan2(d[0],d[2]),latitude:Math.asin(Math.max(-1,Math.min(1,d[1])))};
}
export function advancedSurface(type) {
    const coordinates=[],indices=[];
    if(type==='peirce') {
        const n=96;
        peircePatches.forEach((triangle,id)=>{
            const offset=coordinates.length,index=(row,col)=>offset+row*(n+1)-row*(row-1)/2+col;
            for(let row=0;row<=n;row++)for(let col=0;col<=n-row;col++){
                const w=[1-(row+col)/n,row/n,col/n];
                const [x,y]=[0,1].map(axis=>triangle.reduce((sum,p,i)=>sum+p[axis]*w[i],0));
                const d=peirceInverse(x*(1-1e-10),y*(1-1e-10));
                coordinates.push(metadata(peirceCoordinate(d,[x,-y],id)));
                if(row<n&&col<n-row){const a=index(row,col),b=index(row,col+1),c=index(row+1,col);indices.push(a,b,c);if(col<n-row-1)indices.push(b,index(row+1,col+1),c);}
            }
        });
    } else {
        const patches=type==='authagraph'?authagraphPatches:dymaxionSolid.faces,n=36;
        patches.forEach((patch,patchId)=>{
            const triangle=patch.triangle&&type==='authagraph'?patch.triangle:patch.vertices,offset=coordinates.length;
            const index=(row,col)=>offset+row*(n+1)-row*(row-1)/2+col;
            for(let row=0;row<=n;row++)for(let col=0;col<=n-row;col++){
                const weights=[1-(row+col)/n,row/n,col/n];
                const d=unit(triangle.reduce((p,v,i)=>add(p,scale(v,weights[i])),[0,0,0]));
                const c=type==='authagraph'?authagraphCoordinate(authagraphToGeo(d),patchId):dymaxionPatchCoordinate(d,patchId);
                coordinates.push(metadata(c));
                if(row<n&&col<n-row){const a=index(row,col),b=index(row,col+1),c=index(row+1,col);indices.push(a,b,c);if(col<n-row-1)indices.push(b,index(row+1,col+1),c);}
            }
        });
    }
    return {coordinates,indices};
}
