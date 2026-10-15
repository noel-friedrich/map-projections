import * as THREE from 'three';
import { projectPoint } from './projections.js';
import { createMapMaterial } from './texture.js';

function createCylinderGuide() {
  const vertices = [];
  const segments = 96;
  for (const y of [-Math.PI, Math.PI]) {
    for (let j = 0; j < segments; j++) {
      for (const a of [j, j + 1]) {
        const angle = a / segments * Math.PI * 2;
        vertices.push(Math.sin(angle) * 1.005, y, Math.cos(angle) * 1.005);
      }
    }
  }
  for (let j = 0; j < 12; j++) {
    const angle = j / 12 * Math.PI * 2;
    for (const y of [-Math.PI, Math.PI]) {
      vertices.push(Math.sin(angle) * 1.005, y, Math.cos(angle) * 1.005);
    }
  }
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)),
    new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.3 })
  );
}

export function createModel() {
  const geometry = new THREE.PlaneGeometry(1, 1, 192, 128);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const sphereDirections = new THREE.BufferAttribute(new Float32Array(positions.count * 3), 3);
  sphereDirections.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('sphereDirection', sphereDirections);
  positions.setUsage(THREE.DynamicDrawUsage);
  const coordinates = [];
  for (let i = 0; i < positions.count; i++) {
    coordinates.push({ longitude: (uv.getX(i) - 0.5) * 2 * Math.PI,
      latitude: (uv.getY(i) - 0.5) * Math.PI });
  }

  const rotation = new THREE.Quaternion();
  const inverseRotation = new THREE.Matrix3();
  const rotationMatrix = new THREE.Matrix4();
  const rotationStep = new THREE.Quaternion();
  const material = createMapMaterial(inverseRotation);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  // The bounding volume changes as the geometry bends.
  mesh.frustumCulled = false;
  const guide = createCylinderGuide();
  const position = { x: 0, y: 0, z: 0 };

  function update(state) {
    for (let i = 0; i < coordinates.length; i++) {
      const { longitude, latitude: fullLatitude } = coordinates[i];
      const latitude = fullLatitude * state.latitudeRange / (Math.PI / 2);
      projectPoint(longitude, latitude, state, position);
      positions.setXYZ(i, position.x, position.y, position.z);
      uv.setY(i, (latitude + Math.PI / 2) / Math.PI);
      sphereDirections.setXYZ(i, Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude),
        Math.cos(latitude) * Math.cos(longitude));
    }
    positions.needsUpdate = true;
    sphereDirections.needsUpdate = true;
    uv.needsUpdate = true;
    guide.visible = state.project < 1;
    guide.material.opacity = 0.3 * (1 - state.project);
    guide.scale.y = state.guideHeight / Math.PI;
  }

  function rotate(axis, angle) {
    rotationStep.setFromAxisAngle(axis, angle);
    rotation.premultiply(rotationStep).normalize();
    inverseRotation.setFromMatrix4(rotationMatrix.makeRotationFromQuaternion(rotation).invert());
  }

  function resetRotation() {
    rotation.identity();
    inverseRotation.identity();
  }

  function setTexture(texture) {
    material.map = texture;
    material.color.set('white');
    material.needsUpdate = true;
  }

  return { mesh, guide, rotation, update, rotate, resetRotation, setTexture };
}
