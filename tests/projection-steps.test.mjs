import test from 'node:test';
import assert from 'node:assert/strict';
import { projectionCatalog } from '../js/projection-catalog.js';
import { getProjectionCheckpoints } from '../js/projections.js';
import { getProjectionSteps } from '../js/projection-steps.js';

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
