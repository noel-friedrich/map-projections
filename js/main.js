import { createScene } from "./scene.js?v=conic-winkel-1";
import { createModel } from "./model.js";
import {
    getProjectionState,
    getProjectionCheckpoints,
    getNextProjectionCheckpoint,
    getPreviousProjectionCheckpoint,
} from "./projections.js";
import { loadMapTexture } from "./texture.js";
import { createEarthControls } from "./controls.js";
import { createMapAnnotations } from "./annotations.js";
import { projectionInfo } from "./projection-info.js";
import { projectionCatalog } from "./projection-catalog.js";
import { createProjectionChooser } from "./projection-chooser.js";
import { distortionScores } from "./distortion-data.js";
import { createProjectionStepList } from './projection-steps.js';

const container = document.getElementById("view");
const slider = document.getElementById("progress");
let currentProjection = projectionCatalog[0].id;
const projectionDialog = createProjectionChooser(chooseProjection);
const status = document.getElementById("status");
const infoPanel = document.getElementById("info-panel");
const infoToggle = document.getElementById("info-toggle");
const infoBackdrop = document.getElementById("info-backdrop");
const stepList = createProjectionStepList(document.getElementById('projection-steps'), animateToStep);
function setInfoVisible(visible) {
    const hadFocus = infoPanel.contains(document.activeElement);
    document.body.classList.toggle("info-open", visible);
    infoPanel.inert = !visible;
    infoBackdrop.hidden = !visible;
    infoToggle.setAttribute("aria-expanded", String(visible));
    infoToggle.setAttribute("aria-label", visible ? "Close info" : "Open info");
    if (visible) document.getElementById("choose-projection").focus();
    else if (hadFocus) infoToggle.focus();
}
infoToggle.addEventListener("click", () => setInfoVisible(infoPanel.inert));
infoBackdrop.addEventListener("click", () => setInfoVisible(false));
const distortionMaximums = {
    area: Math.ceil(Math.max(...Object.values(distortionScores).map(score => score.areaDifference)) / 20) * 20,
    angle: Math.ceil(Math.max(...Object.values(distortionScores).map(score => score.angleError)) / 10) * 10,
};

// Keep simulation precision independent of range-input stepping and URL formatting.
let currentProgress = Number(slider.value);
loadUrlState();
setInfoVisible(window.matchMedia('(min-width: 760px)').matches);
const view = createScene(container);
document
    .getElementById("zoom-in")
    .addEventListener("click", () => view.zoom(-300));
document
    .getElementById("zoom-out")
    .addEventListener("click", () => view.zoom(300));
const model = createModel();
view.scene.add(model.mesh, model.guide);
const earthControls = createEarthControls(
    view.renderer.domElement,
    view.camera,
    view.controls,
    model.rotate,
);
let progressAnimation = null;

function setGuessingMode(enabled) {
    if (enabled) setInfoVisible(false);
}
function updateProjectionInfo() {
    const info = projectionInfo[currentProjection];
    document.getElementById("info-name").textContent = projectionCatalog.find(item => item.id === currentProjection).title;
    document.getElementById("info-description").textContent = info.text;
    document.getElementById("info-source").href = "https://en.wikipedia.org/wiki/" + info.article;
    updateDistortionChart();
    stepList.setProjection(currentProjection);
    stepList.setProgress(currentProgress / 100);
}

function animateToStep(progress) {
    animateProgressTo(progress * 100);
    if (window.matchMedia('(max-width: 759px)').matches) setInfoVisible(false);
}

function updateDistortionChart() {
    const { areaDifference, angleError } = distortionScores[currentProjection];
    for (const [id, value, maximum, unit] of [
        ["area", areaDifference, distortionMaximums.area, "%"],
        ["angle", angleError, distortionMaximums.angle, "°"],
    ]) {
        document.getElementById(`${id}-distortion-value`).textContent =
            `${value.toFixed(1)}${unit}`;
        document.getElementById(`${id}-distortion-fill`).style.width =
            `${maximum > 0 ? (value / maximum) * 100 : 0}%`;
        const roughStep = maximum > 0 ? maximum / 5 : 1;
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const step =
            [1, 2, 5, 10].find((value) => value * magnitude >= roughStep) *
            magnitude;
        const decimals = Math.max(0, -Math.floor(Math.log10(step)));
        const tickValues = Array.from(
            { length: Math.floor(maximum / step) + 1 },
            (_, index) => index * step,
        );
        document.getElementById(`${id}-distortion-ticks`).replaceChildren(
            ...tickValues.map((value) => {
                const tick = document.createElement("span");
                tick.className = "distortion-tick";
                tick.style.left = `${maximum > 0 ? (value / maximum) * 100 : 0}%`;
                tick.textContent = value.toFixed(decimals);
                return tick;
            }),
        );
    }
}

function loadUrlState() {
    const params = new URL(window.location.href).searchParams;
    const savedProjection = params.get("projection");
    currentProjection = projectionCatalog.some(item => item.id === savedProjection)
        ? savedProjection
        : projectionCatalog[0].id;
    const savedProgress = params.get("progress");
    const progress =
        savedProgress !== null && savedProgress.trim() !== ""
            ? Number(savedProgress)
            : NaN;
    currentProgress = Number.isFinite(progress)
        ? Math.max(0, Math.min(100, progress))
        : Number(slider.defaultValue);
    slider.value = currentProgress;
    updateProjectionInfo();
}

function saveUrlState() {
    const url = new URL(window.location.href);
    url.searchParams.set("projection", currentProjection);
    url.searchParams.set("progress", String(Math.round(currentProgress)));
    if (url.href !== window.location.href)
        window.history.replaceState(window.history.state, "", url);
}

function updateProgressTrack() {
    const checkpoints = getProjectionCheckpoints(currentProjection);
    const progress = currentProgress / 100;
    const stops = [];
    for (let i = 0; i < checkpoints.length - 1; i++) {
        const start = checkpoints[i] * 100;
        const end = checkpoints[i + 1] * 100;
        const completed = Math.max(start, Math.min(end, progress * 100));
        const accent = i % 2 === 0 ? "var(--accent-light)" : "var(--accent)";
        const grey = i % 2 === 0 ? "#d5dce0" : "#bfc8ce";
        stops.push(
            `${accent} ${start}%`,
            `${accent} ${completed}%`,
            `${grey} ${completed}%`,
            `${grey} ${end}%`,
        );
    }
    slider.style.setProperty(
        "--stage-track",
        `linear-gradient(to right, ${stops.join(", ")})`,
    );
}

function updateProjection() {
    const state = getProjectionState(currentProjection, currentProgress / 100);
    model.update(state);
    view.frame(state);
    slider.style.setProperty("--progress", `${currentProgress}%`);
    updateProgressTrack();
    stepList.setProgress(currentProgress / 100);
    saveUrlState();
}
window.addEventListener("popstate", () => {
    progressAnimation = null;
    setGuessingMode(false);
    loadUrlState();
    updateProjection();
});
slider.addEventListener("pointerdown", () => {
    progressAnimation = null;
});
slider.addEventListener("input", () => {
    progressAnimation = null;
    currentProgress = Number(slider.value);
    updateProjection();
});
function chooseProjection(id) {
    currentProjection = id;
    progressAnimation = null;
    earthControls.reset();
    model.resetRotation();
    view.reset();
    currentProgress = 100;
    slider.value = currentProgress;
    updateProjectionInfo();
    updateProjection();
}
window.addEventListener("keydown", (event) => {
    if (projectionDialog.open && !(event.ctrlKey && /^(?:Digit|Numpad)[0-9]$/.test(event.code))) return;
    if (event.code === "Escape" && !event.repeat) {
        event.preventDefault();
        setInfoVisible(infoPanel.inert);
        return;
    }
    // The tenth projection uses 0, matching its position after 1–9 on the keyboard.
    const numberKey = /^(?:Digit|Numpad)([0-9])$/.exec(event.code);
    if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        numberKey
    ) {
        if (
            event.repeat ||
            event.target.closest(
                'textarea, [contenteditable], input:not([type="range"])',
            )
        )
            return;
        event.preventDefault();
        setInfoVisible(false);
        progressAnimation = null;
        earthControls.reset();
        model.resetRotation();
        view.reset();
        projectionDialog.close();
        currentProjection = projectionCatalog[(Number(numberKey[1]) || 10) - 1].id;
        setGuessingMode(true);
        updateProjectionInfo();
        currentProgress = 100;
        slider.value = currentProgress;
        updateProjection();
        lastFrameTime = performance.now();
        // Do not leave keyboard focus on a control that has just been hidden.
        view.renderer.domElement.focus({ preventScroll: true });
        return;
    }
    if (!infoPanel.inert) return;
    if (
        !["KeyN", "KeyB"].includes(event.code) ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
    )
        return;
    if (
        event.target.closest(
            'select, textarea, [contenteditable], input:not([type="range"])',
        )
    )
        return;
    event.preventDefault();
    stepProjection(event.code === "KeyB");
});
function stepProjection(backward) {
    const from = currentProgress;
    const checkpoint =
        backward
            ? getPreviousProjectionCheckpoint
            : getNextProjectionCheckpoint;
    const to =
        checkpoint(currentProjection, (progressAnimation?.to ?? from) / 100) *
        100;
    animateProgressTo(to);
}

function animateProgressTo(to) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        progressAnimation = null;
        currentProgress = to;
        slider.value = currentProgress;
        updateProjection();
    } else {
        progressAnimation = { from: currentProgress, to, start: performance.now() };
    }
}
document.getElementById("previous-stage").addEventListener("click", () => stepProjection(true));
document.getElementById("next-stage").addEventListener("click", () => stepProjection(false));
updateProjection();

function resize() {
    if (view.resize()) updateProjection();
}
new ResizeObserver(resize).observe(container);
resize();

let lastFrameTime = performance.now();
document.getElementById("reset").addEventListener("click", () => {
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

loadMapTexture(view.renderer)
    .then((texture) => {
        model.setTexture(texture);
        createMapAnnotations(
            view.renderer.domElement,
            view.camera,
            model,
            texture,
        );
        status.textContent = "";
    })
    .catch((error) => {
        status.textContent = error.message;
        status.hidden = false;
    });

view.renderer.setAnimationLoop((time) => {
    const deltaTime = Math.max(
        0,
        Math.min(0.05, (time - lastFrameTime) / 1000),
    );
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
