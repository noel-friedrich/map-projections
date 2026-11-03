# Projection previews

These PNGs are rendered from `createModel()`, `getProjectionState(id, 1)` and
`loadMapTexture()`, exactly as used by the interactive map. They use the Natural
Earth texture and geographic grid, an orthographic camera, and a transparent background.
Each completed projection is centered and fitted into a 640 × 400 image.
Map texture attribution: [world-map-source.txt](../world-map-source.txt).

Regenerate after changing geometry or texture:

```sh
node scripts/generate-projection-previews.mjs
```

The generator requires `playwright-core` and Chrome/Chromium. If they are not
installed in the project, set `PLAYWRIGHT_MODULE` to the absolute path of
Playwright's `index.mjs` and `CHROME_EXECUTABLE` to the browser binary. It starts
and closes its own local server. The site only loads the resulting PNGs; it does
not render previews at runtime.
