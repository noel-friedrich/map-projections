import { createScene } from './scene.js';
import { createModel } from './model.js';
import { getProjectionState } from './projections.js';
import { loadMapTexture } from './texture.js';
import { createEarthControls } from './controls.js';

const container = document.getElementById('view');
const slider = document.getElementById('progress');
const projection = document.getElementById('projection');
const status = document.getElementById('status');
const view = createScene(container);
const model = createModel();
view.scene.add(model.mesh, model.guide);
const earthControls = createEarthControls(view.renderer.domElement, view.camera,
  view.controls, model.rotate);

function updateProjection() {
  const state = getProjectionState(projection.value, Number(slider.value) / 100);
  model.update(state);
  view.frame(state);
  slider.style.setProperty('--progress', `${Number(slider.value)}%`);
}
slider.addEventListener('input', updateProjection);
projection.addEventListener('change', updateProjection);
updateProjection();

function resize() {
  if (view.resize()) updateProjection();
}
new ResizeObserver(resize).observe(container);
resize();

let lastFrameTime = performance.now();
document.getElementById('reset').addEventListener('click', () => {
  earthControls.reset();
  model.resetRotation();
  slider.value = 0;
  view.reset();
  updateProjection();
  lastFrameTime = performance.now();
  view.renderer.domElement.focus({ preventScroll: true });
});

loadMapTexture(view.renderer).then(texture => {
  model.setTexture(texture);
  status.textContent = '';
}).catch(error => {
  status.textContent = error.message;
  status.hidden = false;
});

view.renderer.setAnimationLoop(time => {
  const deltaTime = Math.max(0, Math.min(0.05, (time - lastFrameTime) / 1000));
  lastFrameTime = time;
  view.update();
  earthControls.update(deltaTime);
  view.render();
});
