import * as THREE from 'three';
import { createEnvironment } from '../js/scene.js';

export function createView(container, bodies) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f5f5f5');
  scene.fog = new THREE.Fog('#f5f5f5', 50, 200);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Click for first-person flight. Move the mouse to look, WASD to fly, Q/E down/up, Escape to release.');

  // Reuse the actual Mercator grid, floor, shadow receiver and light.
  const environment = createEnvironment(scene);
  Object.assign(environment.light.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25 });
  environment.light.shadow.camera.updateProjectionMatrix();

  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const planets = bodies.map(body => {
    const material = new THREE.MeshBasicMaterial({ color: body.color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.setScalar(body.radius);
    mesh.rotation.z = body.id === 'earth' ? 0.409 : body.id === 'mars' ? 0.44 : 0.117;
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
  });

  function reset(currentBodies) {
    const bounds = new THREE.Box3();
    for (const body of currentBodies) {
      const p = new THREE.Vector3().copy(body.position);
      bounds.expandByPoint(p.clone().addScalar(body.radius));
      bounds.expandByPoint(p.clone().addScalar(-body.radius));
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const halfSize = bounds.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const distance = Math.max(halfSize.x / camera.aspect, halfSize.y) * 1.15 /
      Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + halfSize.z;
    camera.position.copy(center).add(new THREE.Vector3(0, 1.4, distance));
    camera.lookAt(center);
    camera.updateMatrixWorld();
  }

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function render(currentBodies, seconds) {
    planets.forEach((planet, i) => {
      planet.position.copy(currentBodies[i].position);
      planet.rotation.y = seconds * currentBodies[i].spin;
    });
    environment.update(camera);
    renderer.render(scene, camera);
  }

  async function loadTextures() {
    const loader = new THREE.TextureLoader();
    const sources = [
      new URL('../assets/world-map-natural-earth.jpg', import.meta.url).href,
      new URL('./assets/moon.jpg', import.meta.url).href,
      new URL('./assets/mars.jpg', import.meta.url).href,
    ];
    const results = await Promise.allSettled(sources.map(async (url, i) => {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      planets[i].material.map = texture;
      planets[i].material.color.set('white');
      planets[i].material.needsUpdate = true;
    }));
    return results.flatMap((result, i) => result.status === 'rejected' ? [bodies[i].name] : []);
  }

  resize();
  reset(bodies);
  new ResizeObserver(resize).observe(container);
  return { scene, camera, renderer, environment, reset, render, loadTextures };
}
