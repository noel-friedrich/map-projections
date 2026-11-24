// Short summaries; each entry links to its Wikipedia source.
export const projectionInfo = {
  'natural-earth-1': {article:'Natural_Earth_projection',text:'A compromise pseudocylindrical world map with gently rounded corners. Its polynomial latitude spacing and parallel widths balance area and shape distortion, without preserving either exactly. The poles form straight lines.'},
  'natural-earth-2': {article:'Natural_Earth_projection',text:'A more rounded companion to Natural Earth I. Its meridians bend steeply inward near short, straight pole lines, giving the map an elongated globe shape. This compromise projection balances area and shape distortion without preserving either exactly.'},
  authagraph: {article:'AuthaGraph_projection',text:'A rectangular tetrahedral world map, implemented from Hajime Narukawa’s 2022 mathematical formulation. Transfers spherical regions to a tetrahedron, unfolds its faces and rearranges the strip into a rectangle. Balances area and shape distortion.'},
  dymaxion: {article:'Dymaxion_map',text:'Buckminster Fuller’s world map uses an icosahedron and the AirOcean arrangement, with additional cuts in selected faces. The spherical-triangle mapping reduces distortion while keeping most land connected.'},
  peirce: {article:'Peirce_quincuncial_projection',text:'A conformal square world map, except at four singular points on the equator. The north pole lies at the center and the south pole appears at all four corners. Opposite edges join so the map can tile continuously.'},
  'gall-peters': {article:'Gall–Peters_projection',text:'A cylindrical equal-area map with true scale along 45° north and south. It narrows and vertically stretches the Lambert equal-area rectangle while preserving relative areas. Shapes stretch near the equator and compress near the poles.'},
  orthographic: {article:'Orthographic_map_projection',text:'Splits the globe into two hemispheres, hinges them open, and projects each along parallel rays. Both circular maps face forward, showing the whole Earth. Shapes and areas compress toward each rim.'},
  'azimuthal-equidistant': {article:'Azimuthal_equidistant_projection',text:'Distances from the map center match distances along the globe, and directions from the center are correct. The opposite point opens into the disk rim. Other distances and relative areas are distorted.'},
  werner: {article:'Werner_projection',text:'A heart-shaped equal-area map. Latitude parallels become concentric circular arcs around the north pole while keeping their lengths. This is the polar form of the Bonne projection.'},
  collignon: {article:'Collignon_projection',text:'An equal-area triangular map with straight horizontal parallels. The north pole becomes the tip, while the south pole stretches across the base. Latitude spacing compensates for the changing width.'},
  gores: {article:'Gore_(segment)',text:'Twelve sinusoidal strips show the whole world with equal relative areas. These narrow pole-to-pole pieces resemble the paper gores used to construct globes. Here they peel apart and flatten side by side.'},
  "stereographic": {
    "article": "Stereographic_map_projection",
    "text": "Projects from the back point of the globe onto a plane touching its front, preserving local angles. Cropped at 120 degrees from the front center to form a circular map. The rear cap is removed from the globe at every stage, including the start."
  },
  "aitoff": {
    "article": "Aitoff_projection",
    "text": "Uses an azimuthal equidistant disk: radius follows angular distance from the center of the longitude-compressed hemisphere. Doubling its width forms the ellipse. Unlike Hammer, Aitoff does not preserve relative areas. It is also used in Winkel Tripel."
  },
  "hammer": {
    "article": "Hammer_projection",
    "text": "Uses a Lambert azimuthal equal-area disk, with different radial spacing from Aitoff's equidistant disk. Both halve longitudes and double the disk width, but Hammer preserves relative areas: equally sized regions on Earth occupy equally sized areas on the map."
  },
  "mollweide": {
    "article": "Mollweide_projection",
    "text": "An equal-area elliptical map with straight, horizontal parallels and curved meridians. Latitude spacing and parallel widths keep relative areas correct. Its polar regions are also used in Goode homolosine."
  },
  "torus": {
    "article": "Equirectangular_projection",
    "text": "Pinches the poles together, opens a torus, then cuts and unrolls it into a rectangle. The smaller hole produces a narrower equirectangular map, with evenly spaced longitude and latitude."
  },
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
    "text": "Used for National Geographic world maps. First constructs the Aitoff projection, then blends its coordinates equally with an equirectangular map to balance area and shape distortion."
  }
};
