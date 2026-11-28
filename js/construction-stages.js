export const constructionStages = {
    'runder-spiegel': ['Globe', 'Metal cylinder inside the globe', 'World reflected in the cylinder', 'Wide perspective image', 'Thin reflected image', 'Runder-Spiegel square'],
    authagraph: ['Globe', 'Transfer to tetrahedral patches', 'Tetrahedron', 'Unfolded strip', 'AuthaGraph rectangle'],
    dymaxion: ['Globe', 'Fuller icosahedron', 'Dymaxion AirOcean net'],
    peirce: ['Globe facing the north pole', 'Hemispheres unfolded side by side', 'Two conformal hemisphere squares', 'Peirce quincuncial square'],
    'gall-peters': ['Globe', 'Equal-area cylinder', 'Lambert equal-area rectangle', 'Gall–Peters rectangle'],
    orthographic: ['Globe', 'Two hemispheres unfolded', 'Two orthographic disks'],
    'azimuthal-equidistant': ['Globe', 'Opened hemisphere bowl', 'Equidistant disk'],
    werner: ['Globe', 'Even latitude spacing', 'Sinusoidal map', 'Werner heart'],
    collignon: ['Globe', 'Conical latitude rings', 'Prime meridian on the map plane', 'Collignon triangle'],
    gores: ['Globe', 'Twelve separated curved gores', 'Flat globe gores'],
    stereographic: ['Globe with rear cap removed', 'Stereographic disk'],
    aitoff: ['Globe', 'Longitudes halved', 'Azimuthal equidistant disk', 'Aitoff ellipse'],
    hammer: ['Globe', 'Longitudes halved', 'Lambert equal-area disk', 'Hammer ellipse'],
    mollweide: ['Globe', 'Mollweide latitude rings', 'Prime meridian on the map plane', 'Mollweide ellipse'],
    robinson: ['Globe', 'Robinson latitude rings', 'Prime meridian on the map plane', 'Robinson map'],
    'natural-earth-1': ['Globe', 'Natural Earth I latitude rings', 'Prime meridian on the map plane', 'Natural Earth I map'],
    'natural-earth-2': ['Globe', 'Natural Earth II latitude rings', 'Prime meridian on the map plane', 'Natural Earth II map'],
    'equal-earth': ['Globe', 'Equal Earth latitude rings', 'Prime meridian on the map plane', 'Equal Earth map'],
    torus: ['Globe', 'Poles pinched together', 'Torus', 'Horizontal cylinder', 'Rectangle'],
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
