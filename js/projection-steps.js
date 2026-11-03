import { getProjectionCheckpoints } from './projections.js';

const globe = 'Start with the globe.';
const cylinder = 'Project the globe onto a surrounding cylinder.';
const unrollCylinder = 'Unroll the cylinder into a rectangle.';
const solid = faces => [globe, `Project the globe onto ${faces} faces.`, 'Unfold the faces into a flat net.'];
const conic = property => [
    'Start with the northern hemisphere.',
    'Project the hemisphere onto a cone.',
    'Cut along a meridian and open the cone.',
    'Unroll the cone into a flat sector.',
    `Adjust latitude spacing to preserve ${property}.`,
];
const descriptions = {
    mercator: [globe, cylinder, unrollCylinder, 'Stretch latitude spacing to preserve local angles.'],
    'same-height': [globe, 'Project onto a cylinder while keeping each point’s height.', unrollCylinder],
    classic: [globe, 'Project outward from the globe’s center onto a cylinder.', unrollCylinder],
    sinusoidal: [globe, 'Space latitude lines evenly from south to north.', 'Unroll the latitude rings into a flat map.'],
    robinson: [globe, 'Reshape latitude rings to balance sizes and shapes.', 'Unroll the rings into the Robinson map.'],
    'equal-earth': [globe, 'Set latitude spacing and ring widths for equal areas.', 'Unroll the rings into the Equal Earth map.'],
    goode: [globe, 'Space latitude lines evenly from south to north.', 'Flatten the globe into a sinusoidal map.', 'Round the polar regions while keeping equal areas.', 'Separate the lobes to reduce shape distortion.'],
    equirectangular: [globe, 'Project onto a cylinder with evenly spaced latitudes.', unrollCylinder],
    tetrahedral: [globe, 'Map the globe onto a tetrahedron, preserving local angles.', 'Unfold the faces into a flat triangular net.'],
    'lambert-azimuthal': [globe, 'Open the globe into a hemispherical bowl.', 'Flatten the bowl into an equal-area disk.'],
    tetrahedron: solid('four triangular'),
    cube: [globe, 'Project the globe onto six square faces.', 'Unfold the faces into a cross-shaped net.'],
    octahedron: solid('eight triangular'),
    dodecahedron: solid('twelve pentagonal'),
    icosahedron: solid('twenty triangular'),
    'lambert-conic': conic('local angles'),
    albers: conic('area'),
    'winkel-tripel': [globe, 'Halve longitudes to fit the world onto a hemisphere.', 'Flatten the hemisphere into an equidistant disk.', 'Stretch the disk horizontally into the Aitoff ellipse.', 'Blend the ellipse with a rectangular map to form Winkel Tripel.'],
};

export function getProjectionSteps(type) {
    return getProjectionCheckpoints(type).map((progress, index) => ({
        progress, description: descriptions[type][index],
    }));
}

export function createProjectionStepList(list, onJump) {
    let steps = [], buttons = [];
    let activeIndex = -1;
    return {
        setProjection(type) {
            steps = getProjectionSteps(type);
            buttons = [];
            activeIndex = -1;
            list.replaceChildren(...steps.map(({ progress, description }, index) => {
                const item = document.createElement('li');
                const number = document.createElement('button');
                number.type = 'button';
                number.className = 'step-number';
                number.textContent = String(index + 1);
                number.setAttribute('aria-label', `Step ${index + 1}: ${description}`);
                number.addEventListener('click', () => onJump(progress));
                const text = document.createElement('span');
                text.textContent = description;
                item.append(number, text);
                buttons.push(number);
                return item;
            }));
        },
        setProgress(progress) {
            // Match the checkpoint tolerance, including URL-rounded thirds.
            const active = steps.findLastIndex(step => step.progress <= progress + 0.005);
            if (active === activeIndex) return;
            buttons[activeIndex]?.removeAttribute('aria-current');
            buttons[active]?.setAttribute('aria-current', 'step');
            activeIndex = active;
        },
    };
}
