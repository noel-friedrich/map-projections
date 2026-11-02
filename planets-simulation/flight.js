import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { collideCamera } from './physics.js';

export function createFlight(view) {
  const { camera, renderer, environment } = view;
  const canvas = renderer.domElement;
  const controls = new PointerLockControls(camera, canvas);
  const hint = document.getElementById('help');
  const keys = new Set();
  const pointers = new Map();
  const touchMovement = new THREE.Vector2();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const look = new THREE.Euler(0, 0, 0, 'YXZ');
  const flightKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyF', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight'];
  const desktopHint = hint.textContent;
  const touchHint = 'Drag right to look · Drag left to fly';
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  let dragFallback = false;

  function updateHint() {
    hint.textContent = coarsePointer.matches ? touchHint : desktopHint;
    hint.hidden = document.pointerLockElement === canvas || pointers.size > 0;
  }

  function clear() {
    keys.clear();
    pointers.clear();
    touchMovement.set(0, 0);
    updateHint();
  }

  // Pointer lock rotates only the camera, around the viewer's own position.
  canvas.addEventListener('click', event => {
    if (event.pointerType === 'touch' || coarsePointer.matches || dragFallback) return;
    canvas.focus({ preventScroll: true });
    controls.lock();
  });
  controls.addEventListener('lock', updateHint);
  controls.addEventListener('unlock', clear);
  document.addEventListener('pointerlockerror', () => {
    dragFallback = true;
    hint.textContent = 'Drag to look · WASD move · Q/E down/up · Shift boost · F friction';
    hint.hidden = false;
  });
  coarsePointer.addEventListener('change', updateHint);

  window.addEventListener('keydown', event => {
    if (!flightKeys.includes(event.code) || event.metaKey || event.altKey) return;
    if (event.code === 'KeyF') {
      if (event.ctrlKey || event.target.closest('input, select, textarea, [contenteditable]')) return;
    } else if (!controls.isLocked && !(dragFallback && document.activeElement === canvas)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { clear(); controls.unlock(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clear(); controls.unlock(); }
  });

  // Touch uses movement on the left and look on the right without extra overlays.
  canvas.addEventListener('pointerdown', event => {
    canvas.focus({ preventScroll: true });
    if (event.pointerType !== 'touch' && !dragFallback) return;
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {
      mode: event.pointerType === 'touch' && event.clientX < canvas.clientWidth / 2 ? 'move' : 'look',
      originX: event.clientX, originY: event.clientY, x: event.clientX, y: event.clientY,
    });
    updateHint();
  });
  canvas.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (pointer.mode === 'look') {
      look.setFromQuaternion(camera.quaternion);
      look.y -= (event.clientX - pointer.x) * 0.003;
      look.x = THREE.MathUtils.clamp(look.x - (event.clientY - pointer.y) * 0.003, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
      camera.quaternion.setFromEuler(look);
    } else {
      touchMovement.set((event.clientX - pointer.originX) / 70, (event.clientY - pointer.originY) / 70).clampLength(0, 1);
    }
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, event => {
      if (pointers.get(event.pointerId)?.mode === 'move') touchMovement.set(0, 0);
      pointers.delete(event.pointerId);
      updateHint();
    });
  }

  function update(seconds, bodies) {
    camera.getWorldDirection(forward);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    movement.set(0, 0, 0);
    movement.addScaledVector(forward, Number(keys.has('KeyW')) - Number(keys.has('KeyS')) - touchMovement.y);
    movement.addScaledVector(right, Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touchMovement.x);
    movement.y += Number(keys.has('KeyE') || keys.has('Space')) - Number(keys.has('KeyQ') || keys.has('ControlLeft') || keys.has('ControlRight'));
    if (movement.lengthSq() > 0) {
      const altitude = Math.min(...bodies.map(body => camera.position.distanceTo(body.position) - body.radius));
      const speed = THREE.MathUtils.clamp(altitude * 1.2, 0.35, 5);
      const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5 : 1;
      movement.clampLength(0, 1).multiplyScalar(speed * boost * seconds);
      camera.position.add(movement);
    }
  }

  function collide(start, bodies, previousPositions) {
    camera.position.copy(collideCamera(start, camera.position, bodies, previousPositions));
    camera.position.y = Math.max(camera.position.y, environment.floorY + 0.4);
  }

  updateHint();
  return { update, collide, clear, controls,
    get friction() { return keys.has('KeyF') ? 0.01 : 0; },
  };
}
