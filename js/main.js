import { createScene } from './scene.js?v=zoom-controls-3';
import { createModel } from './model.js';
import { getProjectionState, getProjectionCheckpoints, getNextProjectionCheckpoint, getPreviousProjectionCheckpoint } from './projections.js';
import { loadMapTexture } from './texture.js';
import { createEarthControls } from './controls.js';
import { createMapAnnotations } from './annotations.js';
import { distortionScores } from './distortion-data.js';

const container = document.getElementById('view');
const slider = document.getElementById('progress');
const projection = document.getElementById('projection');
const status = document.getElementById('status');
const propertyTags = document.getElementById('projection-properties');
const distortionChart = document.getElementById('distortion-chart');
const distortionToggle = document.getElementById('distortion-toggle');
const distortionMaximums = {
  area: Math.max(...Object.values(distortionScores).map(score => score.areaDifference)),
  angle: Math.max(...Object.values(distortionScores).map(score => score.angleError)),
};

function setDistortionChartVisible(visible) {
  distortionChart.hidden = !visible;
  distortionToggle.setAttribute('aria-expanded', String(visible));
  const label = `${visible ? 'Hide' : 'Show'} distortion chart`;
  distortionToggle.setAttribute('aria-label', label);
  distortionToggle.title = `${label} (C)`;
}

distortionToggle.addEventListener('click', () => setDistortionChartVisible(distortionChart.hidden));
// Keep simulation precision independent of range-input stepping and URL formatting.
let currentProgress = Number(slider.value);
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
document.getElementById('zoom-in').addEventListener('click', () => view.zoom(-300));
document.getElementById('zoom-out').addEventListener('click', () => view.zoom(300));
const model = createModel();
view.scene.add(model.mesh, model.guide);
const earthControls = createEarthControls(view.renderer.domElement, view.camera,
  view.controls, model.rotate);
let progressAnimation = null;

function setGuessingMode(enabled) {
  projection.hidden = enabled;
  propertyTags.hidden = enabled;
}

function updateProjectionProperties() {
  updateDistortionChart();
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

function updateDistortionChart() {
  const { areaDifference, angleError } = distortionScores[projection.value];
  for (const [id, value, maximum, unit] of [
    ['area', areaDifference, distortionMaximums.area, '%'],
    ['angle', angleError, distortionMaximums.angle, '°'],
  ]) {
    document.getElementById(`${id}-distortion-value`).textContent = `${value.toFixed(1)}${unit}`;
    document.getElementById(`${id}-distortion-fill`).style.height = `${maximum > 0 ? value / maximum * 100 : 0}%`;
    const roughStep = maximum > 0 ? maximum / 5 : 1;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const step = [1, 2, 5, 10].find(value => value * magnitude >= roughStep) * magnitude;
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    const tickValues = Array.from({ length: Math.floor(maximum / step) + 1 }, (_, index) => index * step);
    document.getElementById(`${id}-distortion-ticks`).replaceChildren(...tickValues.map(value => {
      const tick = document.createElement('span');
      tick.className = 'distortion-tick';
      tick.style.bottom = `${maximum > 0 ? value / maximum * 100 : 0}%`;
      tick.textContent = value.toFixed(decimals);
      return tick;
    }));
  }
}

function loadUrlState() {
  const params = new URL(window.location.href).searchParams;
  const savedProjection = params.get('projection');
  projection.value = [...projection.options].some(option => option.value === savedProjection)
    ? savedProjection : projection.options[0].value;
  const savedProgress = params.get('progress');
  const progress = savedProgress !== null && savedProgress.trim() !== '' ? Number(savedProgress) : NaN;
  currentProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : Number(slider.defaultValue);
  slider.value = currentProgress;
  updateProjectionProperties();
}

function saveUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set('projection', projection.value);
  url.searchParams.set('progress', String(Math.round(currentProgress)));
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, '', url);
}

function updateProgressTrack() {
  const checkpoints = getProjectionCheckpoints(projection.value);
  const progress = currentProgress / 100;
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
  const state = getProjectionState(projection.value, currentProgress / 100);
  model.update(state);
  view.frame(state);
  slider.style.setProperty('--progress', `${currentProgress}%`);
  updateProgressTrack();
  saveUrlState();
}
window.addEventListener('popstate', () => {
  progressAnimation = null;
  setGuessingMode(false);
  loadUrlState();
  updateProjection();
});
slider.addEventListener('pointerdown', () => { progressAnimation = null; });
slider.addEventListener('input', () => {
  progressAnimation = null;
  currentProgress = Number(slider.value);
  updateProjection();
});
projection.addEventListener('change', () => {
  progressAnimation = null;
  updateProjectionProperties();
  updateProjection();
});
window.addEventListener('keydown', event => {
  // The tenth projection uses 0, matching its position after 1–9 on the keyboard.
  const numberKey = /^(?:Digit|Numpad)([0-9])$/.exec(event.code);
  if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && numberKey) {
    if (event.repeat || event.target.closest('textarea, [contenteditable], input:not([type="range"])')) return;
    event.preventDefault();
    setDistortionChartVisible(false);
    progressAnimation = null;
    earthControls.reset();
    model.resetRotation();
    view.reset();
    projection.selectedIndex = (Number(numberKey[1]) || 10) - 1;
    setGuessingMode(true);
    updateProjectionProperties();
    currentProgress = 100;
    slider.value = currentProgress;
    updateProjection();
    lastFrameTime = performance.now();
    // Do not leave keyboard focus on a control that has just been hidden.
    view.renderer.domElement.focus({ preventScroll: true });
    return;
  }
  if (!['KeyN', 'KeyB', 'KeyC'].includes(event.code) || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.closest('select, textarea, [contenteditable], input:not([type="range"])')) return;
  event.preventDefault();
  if (event.code === 'KeyC') {
    setDistortionChartVisible(distortionChart.hidden);
    return;
  }
  const from = currentProgress;
  const checkpoint = event.code === 'KeyB' ? getPreviousProjectionCheckpoint : getNextProjectionCheckpoint;
  const to = checkpoint(projection.value, (progressAnimation?.to ?? from) / 100) * 100;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    progressAnimation = null;
    currentProgress = to;
    slider.value = currentProgress;
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
  setGuessingMode(false);
  earthControls.reset();
  model.resetRotation();
  currentProgress = 0;
  slider.value = currentProgress;
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
    currentProgress = from + (to - from) * eased;
    slider.value = currentProgress;
    if (fraction === 1) progressAnimation = null;
    updateProjection();
  }
  view.update();
  earthControls.update(deltaTime);
  view.render();
});
