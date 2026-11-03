// Compact non-overlapping nets selected by scripts/find-platonic-nets.mjs.
export const platonicNetParents = {
  "tetrahedron": [
    -1,
    0,
    0,
    0
  ],
  "cube": [
    -1,
    0,
    0,
    2,
    0,
    0
  ],
  "octahedron": [
    -1,
    2,
    3,
    0,
    6,
    0,
    2,
    3
  ],
  "dodecahedron": [
    -1,
    0,
    1,
    1,
    0,
    0,
    11,
    0,
    9,
    11,
    0,
    7
  ],
  "icosahedron": [
    -1,
    6,
    8,
    1,
    5,
    2,
    9,
    8,
    11,
    13,
    9,
    12,
    0,
    0,
    10,
    14,
    18,
    11,
    17,
    12
  ]
};
