# Projection math

`projection-math.js` is a local ESM bundle of `geoAirocean`,
`geoPeirceQuincuncial`, and `geoRotation`, built from:

- d3-geo-polygon 2.0.1
- d3-geo-projection 4.0.0
- their d3-geo / d3-array dependencies

All bundled license notices are in `projection-math-LICENSE.txt`.
The bundle uses no network requests at runtime. The AirOcean implementation
includes Robert W. Gray's Fuller transformation (public-domain implementation
by Philippe Rivière) and the split-face layout by the D3 contributors.

To rebuild in a temporary npm directory, install the two pinned packages and
esbuild 0.25.12. Create an entry exporting `geoAirocean` from `d3-geo-polygon`,
`geoPeirceQuincuncial` from `d3-geo-projection`, and `geoRotation` from `d3-geo`.
Run `esbuild entry.mjs --bundle --format=esm --minify --outfile=projection-math.js`.
