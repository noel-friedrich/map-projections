// Short summaries; each entry links to its Wikipedia source.
export const projectionInfo = {
  "mercator": {
    "article": "Mercator_projection",
    "text": "A cylindrical map designed for navigation. Constant compass bearings form straight lines, while regions near the poles appear larger."
  },
  "same-height": {
    "article": "Lambert_cylindrical_equal-area_projection",
    "text": "A cylindrical map that keeps relative areas correct, compressing shapes vertically near the poles."
  },
  "classic": {
    "article": "Central_cylindrical_projection",
    "text": "Projects outward from the globe’s center onto a surrounding cylinder. Distortion grows rapidly toward the poles."
  },
  "sinusoidal": {
    "article": "Sinusoidal_projection",
    "text": "Keeps relative areas correct, with straight parallels and curved meridians. Shapes become more distorted away from the central meridian."
  },
  "robinson": {
    "article": "Robinson_projection",
    "text": "A compromise designed to make the whole world look balanced, allowing some distortion of both shapes and areas."
  },
  "equal-earth": {
    "article": "Equal_Earth_projection",
    "text": "A world map that preserves relative areas while keeping a familiar, rounded outline."
  },
  "goode": {
    "article": "Goode_homolosine_projection",
    "text": "Combines sinusoidal and Mollweide maps. Interruptions reduce distortion across the continents while preserving relative areas."
  },
  "equirectangular": {
    "article": "Equirectangular_projection",
    "text": "Places longitude and latitude on a rectangular grid. Its simplicity makes it useful for storing world map imagery."
  },
  "tetrahedral": {
    "article": "Lee_conformal_world_in_a_tetrahedron",
    "text": "Maps the globe onto a tetrahedron while preserving local angles. The faces can unfold into a flat map."
  },
  "lambert-azimuthal": {
    "article": "Lambert_azimuthal_equal-area_projection",
    "text": "Maps the globe onto a disk with correct relative areas. Shapes become increasingly distorted away from the center."
  },
  "tetrahedron": {
    "article": "Tetrahedron",
    "text": "Projects the globe from its center onto four triangular faces, then opens them into a triangular net. Shapes and areas become more distorted toward face edges."
  },
  "cube": {
    "article": "Cube",
    "text": "Projects the globe from its center onto six square faces, then opens them into a compact cross-shaped net. Shapes and areas become more distorted toward face edges."
  },
  "octahedron": {
    "article": "Octahedron",
    "text": "Projects the globe from its center onto eight triangular faces, then opens them into a compact net. Shapes and areas become more distorted toward face edges."
  },
  "dodecahedron": {
    "article": "Dodecahedron",
    "text": "Projects the globe from its center onto twelve pentagonal faces, then opens them into a compact net. Shapes and areas become more distorted toward face edges."
  },
  "icosahedron": {
    "article": "Icosahedron",
    "text": "Projects the globe from its center onto twenty triangular faces, then opens them into a compact net. Shapes and areas become more distorted toward face edges."
  },
  "lambert-conic": {
    "article": "Lambert_conformal_conic_projection",
    "text": "Used for aviation and regional maps, preserving local angles. Shown at 0–85°N with standard parallels at 30°N and 60°N."
  },
  "albers": {
    "article": "Albers_projection",
    "text": "Used for regional and thematic maps, preserving relative areas. Shown at 0–85°N with standard parallels at 30°N and 60°N."
  },
  "winkel-tripel": {
    "article": "Winkel_tripel_projection",
    "text": "Used for National Geographic world maps. Combines Aitoff and equirectangular coordinates to balance area and shape distortion."
  }
};
