# Distortion chart

The info panel’s horizontal chart describes the **completed projection**, even while the slider shows
an intermediate surface. Camera movement and globe rotation do not change it.
Scores are precomputed; there is no numerical sampling in the rendering loop.

Regenerate after changing projection equations:

```sh
node scripts/precompute-distortion.mjs
```

An optional argument changes the number of samples per projection (default
524288). Commit the resulting `js/distortion-data.js` alongside equation changes.

## Sampling and local measurements

Use a deterministic Fibonacci sphere with uniform height (sin(latitude)) and
golden-angle longitudes. Every sample has equal surface-area weight. Mercator
and central cylindrical use their existing rendered latitude bounds, respectively
atan(sinh(pi)) ≈ 85.05° and atan(pi) ≈ 72.34°. The others cover the entire sphere.
Thus scores describe each map's displayed region; the two cropped maps omit
their polar caps. Exact poles and isolated singularities are not sampled.

Differentiate the projection numerically along two perpendicular unit tangent
directions, using central great-circle steps of 1e-7 radians. Hold Goode's lobe
and Lee's tetrahedral face fixed at each sample; unwrap the date-line longitude.
This measures stretching within a piece rather than the gap across a cut.

Let a and b be the largest and smallest local stretch factors. Local area
magnification is S = a*b. The local worst angle change in degrees is
omega = 2*asin((a-b)/(a+b)) * 180/pi. These quantities follow Tissot's indicatrix:
https://proj.org/en/stable/development/reference/datatypes.html#c.PJ_FACTORS
https://github.com/OSGeo/PROJ/blob/master/src/factors.cpp

## Global scores and bars

**Average area difference (%)** = 100 * mean(abs(S/mean(S) - 1)). Normalizing
by mean(S) removes uniform map resizing. It compares each equal-area Earth
sample's mapped area with its correct share of the total mapped area.
Zero means equal-area. The theoretical range is 0–200%.

**Average angle error (degrees)** = mean(omega). This averages the worst local
angle change over Earth, rather than taking one worst point on the entire map.
Zero means conformal. Its theoretical range is 0–180°.

Each bar runs from zero to the highest score among the available maps rounded
up to a multiple of 20% for area or 10° for angles. Labeled ticks use round increments
chosen from powers of ten times 1, 2, or 5 (currently 20% and 10°).
The scales remain fixed when
switching projections, and update automatically if the precomputed scores change.

The two bar widths use different units and must not be interpreted as a common
combined score. These local measures do not penalize interruptions or overlaps.

Numerical residuals below 0.0001 are rounded to zero. No projection-specific
property labels are used to override the measured values. Stored scores retain
six decimal places for reproducibility, while the chart displays one decimal
place; values are numerical estimates, not exact global integrals.

For the five Platonic unfoldings, the sampling locks the solid face when taking
local derivatives, just as for Lee's faces. The maps use gnomonic projection:
at angular distance theta from a face normal, the principal stretches are
sec(theta)^2 and sec(theta), so local area scale is sec(theta)^3. Neither areas
nor angles are preserved. Rigid unfolding and re-centering do not change these
scores. The generated scores include all entries in projection-catalog.js.
