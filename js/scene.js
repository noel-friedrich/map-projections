import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createGridMaterial } from './grid.js';

export function createEnvironment(scene) {
  const floorY = -6;
  const geometry = new THREE.PlaneGeometry(2000, 2000);
  geometry.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(geometry, createGridMaterial());
  floor.position.y = floorY;
  // Draw the background first without depth writes, so its shadow cannot z-fight it.
  floor.renderOrder = -1;
  floor.material.depthWrite = false;
  const shadowFloor = new THREE.Mesh(geometry, new THREE.ShadowMaterial({
    opacity: 0.2, depthWrite: false
  }));
  shadowFloor.position.y = floorY;
  shadowFloor.receiveShadow = true;
  scene.add(floor, shadowFloor);

  const light = new THREE.DirectionalLight('white', 1);
  light.position.set(6, 12, 30);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 80 });
  light.shadow.normalBias = 0.02;
  light.shadow.bias = -0.0005;
  scene.add(light);

  function update(camera) {
    // Whole-unit movement keeps the world grid anchored and its edges invisible.
    for (const ground of [floor, shadowFloor]) {
      ground.position.x = Math.round(camera.position.x);
      ground.position.z = Math.round(camera.position.z);
    }
  }
  return { floorY, floor, shadowFloor, light, update };
}

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f5f5f5');
  scene.fog = new THREE.Fog('#f5f5f5', 50, 200);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
  const sphereDistance = 4.5;
  camera.position.set(0, 0, sphereDistance);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.2;
  controls.maxDistance = 40;
  const environment = createEnvironment(scene);
  let previousCameraScale = 1;

  function keepCameraAboveFloor() {
    const { floorY } = environment;
    const panCorrection = Math.max(0, floorY + 1 - controls.target.y);
    controls.target.y += panCorrection;
    camera.position.y += panCorrection;
    camera.position.y = Math.max(camera.position.y, floorY + 0.4);
    camera.lookAt(controls.target);
    const radius = camera.position.distanceTo(controls.target);
    controls.maxPolarAngle = Math.acos(THREE.MathUtils.clamp(
      (floorY + 0.4 - controls.target.y) / radius, -1, 1));
  }
  controls.addEventListener('change', keepCameraAboveFloor);

  function frame(state) {
    const flatFit = 1 + Math.PI / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
      Math.max(1, camera.aspect));
    // Mercator finishes zooming out during unrolling, before the flat map stretches.
    let cameraScale = state.sameHeight
      ? THREE.MathUtils.lerp(1, Math.max(1, flatFit * 1.1 / sphereDistance), state.unroll)
      : THREE.MathUtils.lerp(1, 2.05, state.mercator ? state.unroll : state.project);
    if (state.pseudo) {
      const fitDistance = 1 + 1.15 * Math.max(Math.PI / camera.aspect, Math.PI / 2) /
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fitScale = Math.max(1, fitDistance / (sphereDistance * Math.max(1, 1 / camera.aspect)));
      const spread = 1 - (1 - state.reshape * 0.35) * (1 - state.unroll);
      cameraScale = THREE.MathUtils.lerp(1, fitScale, spread);
    }
    if (state.tetrahedral || state.azimuthal) {
      const unfold = Math.max(0, state.progress * 2 - 1);
      // Frame the whole stationary tetrahedron from the start, including its guide.
      const halfWidth = state.tetrahedral ? Math.sqrt(6) * (1 + unfold) : 2;
      const halfHeight = state.tetrahedral ? Math.sqrt(8) + Math.SQRT2 * unfold : 2;
      const fitDistance = 1 + 1.15 * Math.max(halfWidth / camera.aspect, halfHeight) /
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const fitScale = Math.max(1, fitDistance / (sphereDistance * Math.max(1, 1 / camera.aspect)));
      cameraScale = state.azimuthal ? THREE.MathUtils.lerp(1, fitScale, state.progress) : fitScale;
    }
    camera.position.sub(controls.target)
      .multiplyScalar(cameraScale / previousCameraScale).add(controls.target);
    previousCameraScale = cameraScale;
    controls.update();
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return false;
    const oldAspect = camera.aspect;
    camera.aspect = width / height;
    camera.position.sub(controls.target)
      .multiplyScalar(Math.max(1, 1 / camera.aspect) / Math.max(1, 1 / oldAspect))
      .add(controls.target);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    return true;
  }

  function reset() {
    previousCameraScale = 1;
    // Flush drag inertia before restoring the initial view for this screen size.
    controls.enableDamping = false;
    controls.update();
    controls.position0.set(0, 0, sphereDistance * Math.max(1, 1 / camera.aspect));
    controls.reset();
    controls.enableDamping = true;
  }

  function update() {
    controls.update();
    keepCameraAboveFloor();
    environment.update(camera);
  }

  return { scene, camera, renderer, controls, environment, frame, resize, reset, update,
    render: () => renderer.render(scene, camera) };
}
