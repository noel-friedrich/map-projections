import * as THREE from 'three';

export function createEarthControls(canvas, camera, orbitControls, onRotate) {
  const pressedKeys = new Set();
  const touchPointers = new Map();
  const rotationAxis = new THREE.Vector3();
  const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

  // Keep native one-finger camera rotation and two-finger pinch zoom/rotation.
  // OrbitControls ignores three-finger movement, which rotates the Earth instead.
  orbitControls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

  function rotateEarth(key, angle) {
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      rotationAxis.set(0, 1, 0);
    } else {
      // Camera's screen-right axis is perpendicular to its current viewpoint.
      camera.updateMatrixWorld();
      rotationAxis.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    }
    if (key === 'ArrowLeft' || key === 'ArrowUp') angle = -angle;
    onRotate(rotationAxis, angle);
  }

  function reset() {
    pressedKeys.clear();
    touchPointers.clear();
  }

  function touchCenter() {
    if (touchPointers.size !== 3) return null;
    let x = 0, y = 0;
    for (const pointer of touchPointers.values()) {
      x += pointer.x;
      y += pointer.y;
    }
    return { x: x / 3, y: y / 3 };
  }

  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Capture every finger, including when they leave the canvas.
    canvas.setPointerCapture(event.pointerId);
  }, { capture: true });

  canvas.addEventListener('pointermove', event => {
    if (!touchPointers.has(event.pointerId)) return;
    const previous = touchCenter();
    touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = touchCenter();
    if (!previous || !current) return;
    const radiansPerPixel = 2 * Math.PI / Math.max(1, canvas.clientHeight);
    // Share the exact keyboard axes: world-up yaw and camera-relative pitch.
    rotateEarth('ArrowRight', (current.x - previous.x) * radiansPerPixel);
    rotateEarth('ArrowDown', (current.y - previous.y) * radiansPerPixel);
  }, { capture: true });

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      const wasThreeFingers = touchPointers.size === 3;
      if (!touchPointers.delete(event.pointerId)) return;
      if (!wasThreeFingers || touchPointers.size !== 2 || type === 'lostpointercapture') return;
      // OrbitControls r180 only rebases to one finger on pointer-up. Rebase its
      // two-finger gesture after it removes the lifted pointer, avoiding a zoom jump.
      queueMicrotask(() => {
        if (touchPointers.size !== 2) return;
        const [pointerId, pointer] = touchPointers.entries().next().value;
        orbitControls._onTouchStart({ pointerId,
          pageX: pointer.x + window.scrollX, pageY: pointer.y + window.scrollY });
      });
    }, { capture: true });
  }

  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
  window.addEventListener('keydown', event => {
    if (!arrowKeys.includes(event.key)) return;
    // Keep native keyboard controls available for the slider and selector.
    if (event.target.closest('input, select, textarea, [contenteditable]')) return;
    event.preventDefault();
    pressedKeys.add(event.key);
    if (!event.repeat) rotateEarth(event.key, 0.04);
  });
  window.addEventListener('keyup', event => pressedKeys.delete(event.key));
  window.addEventListener('blur', reset);
  canvas.addEventListener('blur', reset);

  function update(deltaTime) {
    for (const key of pressedKeys) rotateEarth(key, deltaTime * 0.8);
  }

  return { update, reset };
}
