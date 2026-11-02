# Earth, Moon & Mars

Serve the repository over HTTP (for example `python -m http.server 8000` from
the repository root), then open `http://localhost:8000/planets-simulation/`.
No build or npm installation is needed. Three.js r180 loads from jsDelivr.

Click the view to capture the mouse for first-person flight. Mouse movement
turns the camera in place. Use WASD to fly along the viewing direction,
Q/E (or Ctrl/Space) to descend/ascend, and Shift to boost. Escape releases
the mouse so you can use Reset and the speed slider. On touch screens,
drag on the right to look and hold/drag on the left to fly.

Hold F to apply 1% friction to the planets per simulation tick (velocities
are multiplied by 0.99). Release F to stop damping. Friction respects the
speed slider and has no effect while paused.

The scene reuses the Mercator visualization's actual light grid environment,
shadows, background, fog and interface styles. The only controls on screen
are Reset, the bottom slider, and a controls hint that hides during flight.

The bottom slider sets 0–4,800 physics ticks per real second. Each tick is
1/120 simulated second: 120 ticks/s is 1×, 4,800 is 40×, and 0 completely pauses
gravity, orbits, spin and collision responses between planets.
You can still move the camera and inspect surfaces while paused. Reset
restores the initial system, camera and default 120 ticks/s.

All three bodies mutually attract through Newtonian gravity, integrated
with velocity Verlet. Earth is free to move around the common centre of
mass. Relative masses and radii match the real bodies approximately, but
distances and time are compressed: this is an exploratory three-body
system, not a reconstruction of their real Solar System orbits.

Swept sphere collision detection prevents planets and the camera from
tunnelling through surfaces. Planet impacts conserve momentum with a
coefficient of restitution of 0.8; they bounce rather than merge, preserving
the three bodies. The camera slides along surfaces and moving planets push
it out of the way. Flight speed reduces near surfaces for closer inspection.

Real surface maps are stored locally; the existing Natural Earth texture
is reused for Earth. Mars and Moon were downloaded from Solar System Scope.
See [texture sources and licences](assets/sources.txt).

Run physics regression checks with `npm test` from this directory
(Node.js 18 or later). Tests cover pause/rate behavior, mutual gravity,
long-term energy stability, momentum, high-speed impacts, initial overlaps,
camera collisions and reset.
