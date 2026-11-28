// Observer O=(0,0,1), unit Earth, mirror cylinder x²+z²=r², vertical axis y.
// Rendering samples the visible mirror and traces reflected directions back to
// the Earth. This avoids forcing invisible portions of a finite mirror into view.
export const MIRROR_RADIUS = 0.35;
export const NEEDLE_RADIUS = 0.003;
export const MIRROR_HALF_HEIGHT = 1.3;
const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (a,b,t) => (1-t)*a+t*b;

export function createRunderSpiegelState(progress) {
    const phase = clamp(progress)*5;
    const reveal=clamp(phase), transfer=clamp(phase-1), flatten=clamp(phase-2);
    const shrink=clamp(phase-3), stretch=clamp(phase-4);
    const radius = phase<=3 ? MIRROR_RADIUS : phase<=4
        ? MIRROR_RADIUS*Math.exp(Math.log(NEEDLE_RADIUS/MIRROR_RADIUS)*shrink)
        : NEEDLE_RADIUS*(1-stretch);
    const globe = phase<=1;
    return {
        type:'runder-spiegel', progress, runderSpiegel:true, latitudeRange:Math.PI/2,
        reveal, transfer, shrink, flatten, stretch, radius, globe,
        globeOpacity: globe ? 1-0.78*reveal : 0,
        reflectionOpacity: lerp(0.22,1,transfer),
        metalOpacity: reveal*(1-0.85*flatten)*(1-stretch),
        imageHalfWidth: lerp(radius/Math.sqrt(1-radius*radius),1,stretch),
        frameExtent:[1,Math.max(1,
            lerp(Math.sqrt(1-radius*radius),Math.sqrt((1+radius)/(1-radius)),flatten),
            lerp(1,MIRROR_HALF_HEIGHT,reveal*(1-stretch))),1],
    };
}

// u is the perspective image's normalized horizontal coordinate; v is normalized
// height on the mirror. Work in normalized quantities even when r becomes zero.
export function mirrorSample(u,v,radius) {
    const root=Math.sqrt(Math.max(0,1-u*u));
    const height=Math.sqrt(1-radius*radius);
    const scaledX=u/height;
    // t=1-M.z, from the NEAR intersection of the observer's ray and the cylinder.
    const t=(1-radius*root)/(1+radius*radius*scaledX*scaledX);
    const sinTheta=t*scaledX;
    // Rationalized (1-t)/r; no division by a vanishing radius.
    const cosTheta=(root+radius*scaledX*scaledX)/(1+radius*radius*scaledX*scaledX);
    const x=radius*sinTheta, y=height*v, z=radius*cosTheta;
    const normalDot=cosTheta-radius;
    // Reflect O-M about the cylinder's outward normal, giving M -> Earth.
    const dx=2*normalDot*sinTheta+x, dy=y, dz=2*normalDot*cosTheta-t;
    const lengthSquared=dx*dx+dy*dy+dz*dz;
    const dot=x*dx+y*dy+z*dz;
    const inside=Math.max(0,(1-radius*radius)*(1-v*v));
    // Stable positive ray/sphere root, including points on the mirror/Earth rim.
    const distance=inside/(Math.sqrt(dot*dot+lengthSquared*inside)+dot);
    return {x,y,z,t,sinTheta,cosTheta,
        geography:[x+distance*dx,y+distance*dy,z+distance*dz]};
}

export function animateMirrorSample(sample,u,state,out) {
    if (state.transfer<1) {
        // Each source patch flies along its actual incident reflection path
        // from the Earth to the corresponding point on the metal cylinder.
        out.x=lerp(sample.geography[0],sample.x,state.transfer);
        out.y=lerp(sample.geography[1],sample.y,state.transfer);
        out.z=lerp(sample.geography[2],sample.z,state.transfer);
    } else {
        // Flatten the wide reflection first, then keep it planar during thinning.
        // The final horizontal magnification stays finite at radius zero.
        out.x=state.imageHalfWidth*u*lerp(sample.t,1,state.flatten);
        out.y=lerp(sample.y,sample.y/sample.t,state.flatten);
        out.z=(1-state.flatten)*sample.z;
    }
    return out;
}

// Forward mapping of an Earth point to a finite mirror. Some points really are
// invisible: the cylinder's interior polar caps and the hidden back wedge.
// Return null for those points rather than inventing a reflected image for them.
export function reflectSpherePoint(longitude,latitude,radius) {
    if (radius===0) {
        const u=Math.sin(longitude/2), v=Math.tan(latitude/2);
        return {u,v,...mirrorSample(u,v,0)};
    }
    const rho=Math.cos(latitude), angle=Math.abs(longitude);
    if (rho<radius-1e-12) return null;
    const observerTangent=Math.acos(radius);
    const sourceTangent=Math.acos(Math.min(1,radius/Math.max(radius,rho)));
    if (angle>observerTangent+sourceTangent+1e-12) return null;
    let lo=Math.max(0,angle-sourceTangent), hi=Math.min(angle,observerTangent);
    for (let i=0;i<52;i++) {
        const theta=(lo+hi)/2;
        const a=Math.hypot(rho*Math.sin(angle)-radius*Math.sin(theta),rho*Math.cos(angle)-radius*Math.cos(theta));
        const b=Math.sqrt(1+radius*radius-2*radius*Math.cos(theta));
        const f=rho*Math.sin(angle-theta)/Math.max(a,1e-15)-Math.sin(theta)/b;
        if (f>0) lo=theta; else hi=theta;
    }
    const theta=(lo+hi)/2;
    const a=Math.hypot(rho*Math.sin(angle)-radius*Math.sin(theta),rho*Math.cos(angle)-radius*Math.cos(theta));
    const b=Math.sqrt(1+radius*radius-2*radius*Math.cos(theta));
    const y=Math.sin(latitude)*b/(a+b);
    const sign=longitude<0?-1:1;
    const u=sign*Math.sin(theta)*Math.sqrt(1-radius*radius)/(1-radius*Math.cos(theta));
    const v=y/Math.sqrt(1-radius*radius);
    return {u,v,...mirrorSample(u,v,radius)};
}

export function projectRunderSpiegel(longitude,latitude,state,out) {
    if (state.globe) {
        out.x=Math.cos(latitude)*Math.sin(longitude);
        out.y=Math.sin(latitude);
        out.z=Math.cos(latitude)*Math.cos(longitude);
        return out;
    }
    if (state.stretch===1) {
        out.x=Math.sin(longitude/2);
        out.y=Math.tan(latitude/2);
        out.z=0;
        return out;
    }
    const reflection=reflectSpherePoint(longitude,latitude,state.radius);
    return reflection ? animateMirrorSample(reflection,reflection.u,state,out) : null;
}

// Sampling the limiting square at equal longitude/latitude intervals resolves
// geography much better than a uniform image grid near its square's outer edge.
export function createMirrorCoordinates(columns=192,rows=128) {
    const coordinates=[], indices=[];
    for(let row=0;row<=rows;row++) {
        const latitude=-Math.PI/2+Math.PI*row/rows, v=Math.tan(latitude/2);
        for(let col=0;col<=columns;col++) {
            const longitude=-Math.PI+2*Math.PI*col/columns, u=Math.sin(longitude/2);
            coordinates.push({longitude,latitude,u,v});
            if(row<rows&&col<columns) {
                const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;
                indices.push(a,b,c,b,d,c);
            }
        }
    }
    return {coordinates,indices};
}
