export const constructionStages = {
    'lambert-conic': ['Northern hemisphere', 'Cone', 'Opened cone', 'Flat sector', 'Lambert spacing'],
    albers: ['Northern hemisphere', 'Cone', 'Opened cone', 'Flat sector', 'Albers spacing'],
    'winkel-tripel': ['Globe', 'Longitudes halved', 'Azimuthal equidistant', 'Aitoff', 'Winkel Tripel'],
};

export function constructionStageLabel(type, progress) {
    const labels = constructionStages[type];
    if (!labels) return '';
    const value = Math.max(0, Math.min(1, progress)) * (labels.length - 1);
    const index = Math.round(value);
    if (Math.abs(index - value) < 0.001) return labels[index];
    const before = Math.floor(value);
    return `${labels[before]} → ${labels[before + 1]}`;
}
