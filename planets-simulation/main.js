import * as THREE from 'three';
import { createSimulation, TICK_SECONDS } from './physics.js';
import { createView } from './view.js';
import { createFlight } from './flight.js';

const simulation = createSimulation();
const container = document.getElementById('view');
const status = document.getElementById('status');
const slider = document.getElementById('progress');
let view;
try {
  view = createView(container, simulation.bodies);
} catch (error) {
  status.textContent = 'The 3D view could not start. Please enable WebGL and reload.';
  status.hidden = false;
  throw error;
}

const flight = createFlight(view);
const start = new THREE.Vector3();

function updateSpeed() {
  const speed = Number(slider.value);
  const description = speed === 0 ? 'Paused — 0 ticks per second' : `${speed} ticks per second`;
  slider.setAttribute('aria-valuetext', description);
  slider.title = description;
  slider.style.setProperty('--progress', `${speed / Number(slider.max) * 100}%`);
}
slider.addEventListener('input', updateSpeed);
updateSpeed();

let lastTime = performance.now();
document.getElementById('reset').addEventListener('click', () => {
  simulation.reset();
  flight.clear();
  view.reset(simulation.bodies);
  slider.value = 120;
  updateSpeed();
  lastTime = performance.now();
});

document.addEventListener('visibilitychange', () => { lastTime = performance.now(); });

view.loadTextures().then(failed => {
  status.hidden = failed.length === 0;
  status.textContent = failed.length ? `Could not load ${failed.join(', ')} textures. Reload to retry.` : '';
}).catch(() => {
  status.textContent = 'Planet textures could not load. Reload to retry.';
  status.hidden = false;
});

view.renderer.setAnimationLoop(time => {
  const seconds = document.hidden ? 0 : Math.max(0, Math.min(0.1, (time - lastTime) / 1000));
  lastTime = time;
  start.copy(view.camera.position);
  const previousPositions = simulation.bodies.map(body => ({ ...body.position }));
  simulation.advance(seconds, Number(slider.value), { friction: flight.friction });
  flight.update(seconds, simulation.bodies);
  flight.collide(start, simulation.bodies, previousPositions);
  view.render(simulation.bodies, simulation.ticks * TICK_SECONDS);
});
