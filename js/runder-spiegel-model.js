import * as THREE from 'three';
import { MIRROR_HALF_HEIGHT } from './runder-spiegel.js';

// A small studio environment belongs only to the metal material. It leaves the
// viewer's white scene, floor and fog unchanged, and needs no downloaded assets.
function metalEnvironment() {
    const faces=Array.from({length:6},(_,face)=>{
        const canvas=document.createElement('canvas');
        canvas.width=canvas.height=128;
        const context=canvas.getContext('2d');
        const gradient=context.createLinearGradient(0,0,0,128);
        gradient.addColorStop(0,face===3?'#8c9299':'#ffffff');
        gradient.addColorStop(0.45,'#e4e8ed');
        gradient.addColorStop(0.55,'#7b838e');
        gradient.addColorStop(1,'#bfc5cd');
        context.fillStyle=gradient;
        context.fillRect(0,0,128,128);
        context.fillStyle=face%2?'#fafcff':'#ffffff';
        context.fillRect(18,8,22,92);
        context.fillStyle='#626b77';
        context.fillRect(87,12,12,116);
        return canvas;
    });
    const environment=new THREE.CubeTexture(faces);
    environment.colorSpace=THREE.SRGBColorSpace;
    environment.needsUpdate=true;
    return environment;
}

export function createRunderSpiegelConstruction() {
    const group=new THREE.Group();
    const metalMaterial=new THREE.MeshStandardMaterial({
        color:0xdde1e7,metalness:1,roughness:0.13,
        envMap:metalEnvironment(),envMapIntensity:1.1,transparent:true,
    });
    const cylinder=new THREE.Mesh(new THREE.CylinderGeometry(1,1,2*MIRROR_HALF_HEIGHT,128),metalMaterial);
    cylinder.castShadow=true;
    group.add(cylinder);
    return {group,update(state) {
        group.visible=Boolean(state.runderSpiegel);
        if(!group.visible) return;
        const visible=state.metalOpacity>0;
        cylinder.visible=visible;
        cylinder.scale.set(state.radius,1,state.radius);
        metalMaterial.opacity=state.metalOpacity;
        metalMaterial.depthWrite=state.metalOpacity>=1;
    }};
}
