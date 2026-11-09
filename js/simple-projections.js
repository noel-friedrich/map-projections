const clamp = value => Math.max(0, Math.min(1, value));
const lerp = (a,b,t) => a+(b-a)*t;
export const GORE_COUNT = 12;
const width = 2*Math.PI/GORE_COUNT;
export const GORES = Array.from({length:GORE_COUNT},(_,i)=>({
    west:-Math.PI+i*width, east:-Math.PI+(i+1)*width,
    center:-Math.PI+(i+0.5)*width, south:-Math.PI/2, north:Math.PI/2,
}));
export function goreCenter(longitude) {
    return GORES[Math.max(0,Math.min(GORE_COUNT-1,Math.floor((longitude+Math.PI)/width)))].center;
}
function arc(angle,k) {
    return k<1e-8 ? [angle,0] : [Math.sin(k*angle)/k,-2*Math.sin(k*angle/2)**2/k];
}

export function projectOrthographic(direction, half, progress, out) {
    const open=clamp(progress*2), flatten=clamp(progress*2-1);
    let [x,y,z]=direction;
    if(half<0) {
        // Open the rear hemisphere around the right-hand tangent hinge.
        const angle=-Math.PI*open, cos=Math.cos(angle), sin=Math.sin(angle);
        const relative=x-1;
        x=1+relative*cos+z*sin;
        z=-relative*sin+z*cos;
    }
    out.x=x-open;
    out.y=y;
    out.z=lerp(z,1,flatten);
    return out;
}

export function projectWerner(longitude,latitude,progress,out) {
    const bend=clamp(progress*3-2), rho=Math.PI/2-latitude;
    const distance=longitude*Math.cos(latitude);
    if(rho<1e-10) {out.x=0;out.y=Math.PI/2;out.z=1;return out;}
    const [x,y]=arc(distance/rho,bend);
    out.x=rho*x;
    out.y=latitude-rho*y;
    out.z=1;
    return out;
}

export function projectGores(longitude,latitude,progress,out,center=goreCenter(longitude)) {
    const open=clamp(progress*2), flatten=clamp(progress*2-1);
    const radius=Math.cos(latitude), delta=longitude-center;
    if(progress<=0.5) {
        const k=1-open, angle=k*center, [along,bend]=arc(center,k);
        const localX=radius*Math.sin(delta), localZ=radius*(Math.cos(delta)-1);
        out.x=lerp(radius,1,open)*along+localX*Math.cos(angle)+localZ*Math.sin(angle);
        out.y=lerp(Math.sin(latitude),latitude,open);
        out.z=radius*(1+bend)-localX*Math.sin(angle)+localZ*Math.cos(angle);
    } else {
        const [along,bend]=arc(delta,1-flatten);
        out.x=center+radius*along;
        out.y=latitude;
        out.z=lerp(radius,1,flatten)+radius*bend;
    }
    return out;
}
