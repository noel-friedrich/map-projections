import * as THREE from 'three';

const RADIUS = 1 / 15;
const COS_RADIUS = Math.cos(RADIUS);
const TAU = 2 * Math.PI;

export function createMapAnnotations(canvas, camera, model, texture) {
  const image = texture.image;
  const context = image.getContext('2d');
  const original = document.createElement('canvas');
  original.width = image.width;
  original.height = image.height;
  original.getContext('2d').drawImage(image, 0, 0);
  const centers = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let press = null;

  function paintCircle(center) {
    const { width, height } = image;
    const latitude = Math.asin(THREE.MathUtils.clamp(center.y, -1, 1));
    const longitude = Math.atan2(center.x, center.z);
    const pixelAngle = Math.PI / height;
    const extent = RADIUS + pixelAngle;
    const top = Math.max(0, Math.floor((0.5 - (latitude + extent) / Math.PI) * height));
    const bottom = Math.min(height, Math.ceil((0.5 - (latitude - extent) / Math.PI) * height));
    const longitudeExtent = Math.abs(latitude) + extent >= Math.PI / 2 ? Math.PI :
      Math.asin(Math.sin(extent) / Math.cos(latitude));
    const centerX = (longitude / TAU + 0.5) * width;
    const halfWidth = Math.ceil(longitudeExtent / TAU * width) + 1;
    const firstX = Math.floor(centerX - halfWidth);
    const lastX = Math.min(firstX + width - 1, Math.ceil(centerX + halfWidth));
    const pixels = context.getImageData(0, top, width, bottom - top);
    for (let y = top; y < bottom; y++) {
      const lat = (0.5 - (y + 0.5) / height) * Math.PI;
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);
      for (let unwrappedX = firstX; unwrappedX <= lastX; unwrappedX++) {
        const x = ((unwrappedX % width) + width) % width;
        const lon = ((x + 0.5) / width - 0.5) * TAU;
        const dot = center.x * cosLat * Math.sin(lon) + center.y * sinLat + center.z * cosLat * Math.cos(lon);
        const distance = Math.acos(THREE.MathUtils.clamp(dot, -1, 1));
        const coverage = THREE.MathUtils.clamp((RADIUS - distance) / pixelAngle + 0.5, 0, 1);
        if (coverage === 0) continue;
        const offset = ((y - top) * width + x) * 4;
        // Orange is composited into the map itself, beneath all projection work.
        for (let channel = 0; channel < 3; channel++) {
          const orange = [255, 140, 0][channel];
          pixels.data[offset + channel] = Math.round(pixels.data[offset + channel] * (1 - coverage) + orange * coverage);
        }
      }
    }
    context.putImageData(pixels, 0, top);
  }

  function edit(event, allowAdd) {
    const bounds = canvas.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    camera.updateMatrixWorld();
    model.mesh.updateWorldMatrix(true, false);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(model.mesh, false)[0];
    if (!hit) return;
    const direction = model.textureDirectionAt(hit);
    if (!direction) return;
    const existing = centers.findLastIndex(center => center.dot(direction) >= COS_RADIUS);
    if (existing >= 0) centers.splice(existing, 1);
    else if (allowAdd) centers.push(direction);
    else return;
    context.clearRect(0, 0, image.width, image.height);
    context.drawImage(original, 0, 0);
    centers.forEach(paintCircle);
    texture.needsUpdate = true;
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.pointerType === 'touch') { press = null; return; }
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, ctrl: event.ctrlKey, dragged: false };
    if (press.ctrl) {
      // Ctrl-drag would otherwise pan the camera before we can resolve the click.
      event.stopImmediatePropagation();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
    }
  }, { capture: true });
  canvas.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5) press.dragged = true;
  }, { capture: true });
  canvas.addEventListener('pointerup', event => {
    if (press?.id !== event.pointerId) return;
    const click = press;
    press = null;
    if (click.ctrl) event.stopImmediatePropagation();
    if (!click.dragged) edit(event, click.ctrl);
  }, { capture: true });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, () => { press = null; });
  }
}
