import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionCatalog } from '../js/projection-catalog.js';
import { getProjectionCheckpoints } from '../js/projections.js';
import { getProjectionSteps, createProjectionStepList } from '../js/projection-steps.js';

test('every map has a short instruction for every exact animation checkpoint', () => {
    for (const { id } of projectionCatalog) {
        const steps = getProjectionSteps(id);
        assert.deepEqual(steps.map(step => step.progress), getProjectionCheckpoints(id), id);
        for (const step of steps) {
            assert.equal(typeof step.description, 'string', id);
            assert.ok(step.description.length > 10 && step.description.length < 120, id);
        }
    }
});

test('Mercator describes cylinder, unrolling and angle correction separately', () => {
    const steps = getProjectionSteps('mercator');
    assert.match(steps[1].description, /cylinder/);
    assert.match(steps[2].description, /Unroll.*rectangle/);
    assert.match(steps[3].description, /preserve local angles/);
    assert.equal(steps[1].progress, 1 / 3);
    assert.equal(steps[2].progress, 2 / 3);
});

test('Winkel instructions follow the simplified five-stage construction without a rectangle stop', () => {
    const steps = getProjectionSteps('winkel-tripel');
    assert.equal(steps.length, 5);
    assert.match(steps[3].description, /Aitoff ellipse/);
    assert.match(steps[4].description, /Blend.*Winkel Tripel/);
});

test('step highlighting does not rewrite DOM attributes on every animation frame', () => {
    const originalDocument = globalThis.document;
    const writes = [];
    const element = () => ({
        attributes: new Map(), children: [],
        setAttribute(name, value) { this.attributes.set(name, value); writes.push(['set', name, value]); },
        removeAttribute(name) { if (this.attributes.delete(name)) writes.push(['remove', name]); },
        addEventListener() {},
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
    });
    globalThis.document = { createElement: element };
    try {
        const list = element();
        const view = createProjectionStepList(list, () => {});
        view.setProjection('mercator');
        writes.length = 0;
        view.setProgress(0);
        assert.equal(writes.length, 1);
        for (let frame = 1; frame <= 30; frame++) view.setProgress(frame / 100);
        assert.equal(writes.length, 1, 'unchanged active step should cause no DOM writes');
        view.setProgress(0.33);
        assert.equal(writes.length, 3, 'only old and new active numbers change');
        assert.equal(list.children[1].children[0].attributes.get('aria-current'), 'step');
        for (let frame = 34; frame <= 60; frame++) view.setProgress(frame / 100);
        assert.equal(writes.length, 3);
        view.setProjection('albers');
        view.setProgress(1);
        assert.equal(list.children[4].children[0].attributes.get('aria-current'), 'step');
        assert.equal(list.children.filter(item => item.children[0].attributes.has('aria-current')).length, 1);
    } finally {
        if (originalDocument === undefined) delete globalThis.document;
        else globalThis.document = originalDocument;
    }
});
