import { projectionCatalog } from './projection-catalog.js';

export function createProjectionChooser(onChoose) {
    const dialog = document.getElementById('projection-dialog');
    const trigger = document.getElementById('choose-projection');
    const grid = document.getElementById('projection-grid');
    let selected = projectionCatalog[0].id;
    const cards = projectionCatalog.map(({ id, title }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'projection-card';
        button.dataset.projection = id;
        const image = document.createElement('img');
        image.src = new URL(`../assets/projections/${id}.png`, import.meta.url).href;
        image.alt = '';
        image.width = 640;
        image.height = 400;
        const label = document.createElement('span');
        label.textContent = title;
        button.append(image, label);
        button.addEventListener('click', () => {
            onChoose(id);
            dialog.close();
        });
        return button;
    });
    grid.replaceChildren(...cards);
    trigger.addEventListener('click', () => {
        selected = new URL(window.location.href).searchParams.get('projection') ?? selected;
        for (const card of cards) card.setAttribute('aria-pressed', String(card.dataset.projection === selected));
        dialog.showModal();
        (cards.find(card => card.dataset.projection === selected) ?? cards[0]).focus();
    });
    document.getElementById('close-projection-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    return dialog;
}
