import * as THREE from "three";
import { MAP_CIRCLE_RADIUS, paintMapCircles } from './map-circles.js';

const RADIUS = MAP_CIRCLE_RADIUS;
const COS_RADIUS = Math.cos(RADIUS);

export function createMapAnnotations(canvas, camera, model, texture, paintOverlays = () => {}) {
    const image = texture.image;
    const context = image.getContext("2d");
    const original = document.createElement("canvas");
    original.width = image.width;
    original.height = image.height;
    original.getContext("2d").drawImage(image, 0, 0);
    const centers = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let press = null;

    function edit(event, allowAdd) {
        const bounds = canvas.getBoundingClientRect();
        pointer.set(
            ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
            (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );
        camera.updateMatrixWorld();
        model.mesh.updateWorldMatrix(true, false);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(model.mesh, false)[0];
        if (!hit) return;
        const direction = model.textureDirectionAt(hit);
        if (!direction) return;
        const existing = centers.findLastIndex(
            (center) => center.dot(direction) >= COS_RADIUS,
        );
        if (existing >= 0) centers.splice(existing, 1);
        else if (allowAdd) centers.push(direction);
        else return;
        redraw();
    }

    function redraw() {
        context.clearRect(0, 0, image.width, image.height);
        context.drawImage(original, 0, 0);
        paintOverlays(context);
        paintMapCircles(context, centers);
        texture.needsUpdate = true;
    }

    canvas.addEventListener(
        "pointerdown",
        (event) => {
            if (event.button !== 0 || event.pointerType === "touch") {
                press = null;
                return;
            }
            press = {
                id: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                ctrl: event.ctrlKey,
                dragged: false,
            };
            if (press.ctrl) {
                // Ctrl-drag would otherwise pan the camera before we can resolve the click.
                event.stopImmediatePropagation();
                canvas.focus({ preventScroll: true });
                canvas.setPointerCapture(event.pointerId);
            }
        },
        { capture: true },
    );
    canvas.addEventListener(
        "pointermove",
        (event) => {
            if (
                press?.id === event.pointerId &&
                Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5
            )
                press.dragged = true;
        },
        { capture: true },
    );
    canvas.addEventListener(
        "pointerup",
        (event) => {
            if (press?.id !== event.pointerId) return;
            const click = press;
            press = null;
            if (click.ctrl) event.stopImmediatePropagation();
            if (!click.dragged) edit(event, click.ctrl);
        },
        { capture: true },
    );
    for (const type of ["pointercancel", "lostpointercapture"]) {
        canvas.addEventListener(type, () => {
            press = null;
        });
    }
    return { redraw };
}
