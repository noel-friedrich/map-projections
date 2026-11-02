import { createScene } from './scene.js';
import { createModel } from './model.js';
import { getProjectionState, getProjectionCheckpoints, getNextProjectionCheckpoint, getPreviousProjectionCheckpoint } from './projections.js';
import { loadMapTexture } from './texture.js';
import { createEarthControls } from './controls.js';
import { createMapAnnotations } from './annotations.js';

const container = document.getElementById('view');
const slider = document.getElementById('progress');
const projection = document.getElementById('projection');
const status = document.getElementById('status');
const propertyTags = document.getElementById('projection-properties');
// Properties column: https://en.wikipedia.org/wiki/List_of_map_projections
// Central cylindrical is classified as Perspective, outside these four tags.
const projectionProperties = {
  mercator: ['Conformal (Equal Angles)'],
  'same-height': ['Equal-Area'],
  classic: [],
  sinusoidal: ['Equal-Area', 'Equidistant'],
  robinson: ['Compromise'],
  'equal-earth': ['Equal-Area'],
  goode: ['Equal-Area'],
  equirectangular: ['Equidistant'],
  tetrahedral: ['Conformal (Equal Angles)'],
  'lambert-azimuthal': ['Equal-Area'],
};
loadUrlState();
const view = createScene(container);
const model = createModel();
view.scene.add(model.mesh, model.guide);
const earthControls = createEarthControls(view.renderer.domElement, view.camera,
  view.controls, model.rotate);
let progressAnimation = null;

function updateProjectionProperties() {
  propertyTags.replaceChildren(...projectionProperties[projection.value].map(label => {
    const tag = document.createElement('a');
    tag.className = 'projection-tag';
    tag.textContent = label;
    tag.href = 'https://en.wikipedia.org/wiki/List_of_map_projections#Table_of_projections';
    tag.target = '_blank';
    tag.rel = 'noopener noreferrer';
    tag.title = label === 'Equidistant'
      ? (projection.value === 'sinusoidal' ? 'Sinusoidal preserves distances along parallels. Source: Wikipedia.'
        : 'Equirectangular preserves distances along meridians. Source: Wikipedia.')
      : 'Property of the completed projection. Source: Wikipedia.';
    return tag;
  }));
}

function loadUrlState() {
  const params = new URL(window.location.href).searchParams;
  const savedProjection = params.get('projection');
  projection.value = [...projection.options].some(option => option.value === savedProjection)
    ? savedProjection : projection.options[0].value;
  const savedProgress = params.get('progress');
  const progress = savedProgress !== null && savedProgress.trim() !== '' ? Number(savedProgress) : NaN;
  slider.value = Number.isFinite(progress) ? Math.round(Math.max(0, Math.min(100, progress))) : slider.defaultValue;
  updateProjectionProperties();
}

function saveUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set('projection', projection.value);
  url.searchParams.set('progress', String(Math.round(Number(slider.value))));
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

function updateProgressTrack() {
  const checkpoints = getProjectionCheckpoints(projection.value);
  const progress = Number(slider.value) / 100;
  const stops = [];
  for (let i = 0; i < checkpoints.length - 1; i++) {
    const start = checkpoints[i] * 100;
    const end = checkpoints[i + 1] * 100;
    const completed = Math.max(start, Math.min(end, progress * 100));
    const blue = i % 2 === 0 ? '#9cb4c5' : '#718b9e';
    const grey = i % 2 === 0 ? '#d5dce0' : '#bfc8ce';
    stops.push(`${blue} ${start}%`, `${blue} ${completed}%`,
      `${grey} ${completed}%`, `${grey} ${end}%`);
  }
  slider.style.setProperty('--stage-track', `linear-gradient(to right, ${stops.join(', ')})`);
}

function updateProjection() {
  const state = getProjectionState(projection.value, Number(slider.value) / 100);
  model.update(state);
  view.frame(state);
  slider.style.setProperty('--progress', `${Number(slider.value)}%`);
  updateProgressTrack();
  saveUrlState();
}
window.addEventListener('popstate', () => {
  progressAnimation = null;
  loadUrlState();
  updateProjection();
});
slider.addEventListener('pointerdown', () => { progressAnimation = null; });
slider.addEventListener('input', () => {
  progressAnimation = null;
  updateProjection();
});
projection.addEventListener('change', () => {
  progressAnimation = null;
  updateProjectionProperties();
  updateProjection();
});
window.addEventListener('keydown', event => {
  if (!['KeyN', 'KeyB'].includes(event.code) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('select, textarea, [contenteditable], input:not([type="range"])')) return;
  event.preventDefault();
  const from = Number(slider.value);
  const checkpoint = event.code === 'KeyB' ? getPreviousProjectionCheckpoint : getNextProjectionCheckpoint;
  const to = checkpoint(projection.value, (progressAnimation?.to ?? from) / 100) * 100;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    progressAnimation = null;
    slider.value = to;
    updateProjection();
  } else {
    progressAnimation = { from, to, start: performance.now() };
  }
});
updateProjection();

function resize() {
  if (view.resize()) updateProjection();
}
new ResizeObserver(resize).observe(container);
resize();

let lastFrameTime = performance.now();
document.getElementById('reset').addEventListener('click', () => {
  progressAnimation = null;
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
  createMapAnnotations(view.renderer.domElement, view.camera, model, texture);
  status.textContent = '';
}).catch(error => {
  status.textContent = error.message;
  status.hidden = false;
});

view.renderer.setAnimationLoop(time => {
  const deltaTime = Math.max(0, Math.min(0.05, (time - lastFrameTime) / 1000));
  lastFrameTime = time;
  if (progressAnimation) {
    const { from, to, start } = progressAnimation;
    const fraction = Math.max(0, Math.min(1, (time - start) / 650));
    const eased = fraction * fraction * (3 - 2 * fraction);
    slider.value = from + (to - from) * eased;
    if (fraction === 1) progressAnimation = null;
    updateProjection();
  }
  view.update();
  earthControls.update(deltaTime);
  view.render();
});
