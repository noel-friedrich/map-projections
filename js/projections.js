import { latitudeProfile, goodeLobeCenter } from "./pseudocylindrical.js";
import { CONIC_TYPES, createConicState, projectConic } from './conic.js';
import { projectWinkel } from './winkel.js';
import { constructionStages } from './construction-stages.js';
import { PLATONIC_SOLIDS, createPolyhedralCoordinate, createPolyhedralAnimation, animatePolyhedral } from './platonic.js';
import {
    createTetrahedralCoordinate,
    animateTetrahedral,
} from "./tetrahedral.js";

export const MERCATOR_LIMIT = Math.atan(Math.sinh(Math.PI));
export const CLASSIC_LIMIT = Math.atan(Math.PI);

const lerp = (a, b, t) => (1 - t) * a + t * b;
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function getProjectionCheckpoints(type) {
    if (constructionStages[type]) return constructionStages[type].map((_, index, stages) => index / (stages.length - 1));
    if (PLATONIC_SOLIDS[type]) return [0, 0.5, 1];
    if (type === "mercator") return [0, 1 / 3, 2 / 3, 1];
    if (type === "goode") return [0, 0.25, 0.5, 0.75, 1];
    return [
        "sinusoidal",
        "robinson",
        "equal-earth",
        "equirectangular",
        "tetrahedral",
        "lambert-azimuthal",
    ].includes(type)
        ? [0, 0.5, 1]
        : [0, 0.7, 1];
}

export function getNextProjectionCheckpoint(type, progress) {
    // Half a percentage point also accepts rounded thirds such as 33% and 67%.
    return (
        getProjectionCheckpoints(type).find(
            (checkpoint) => checkpoint > progress + 0.005,
        ) ?? 0
    );
}

export function getPreviousProjectionCheckpoint(type, progress) {
    return (
        getProjectionCheckpoints(type).findLast(
            (checkpoint) => checkpoint < progress - 0.005,
        ) ?? 1
    );
}

export function getProjectionState(type, progress) {
    if (CONIC_TYPES.includes(type) || type === 'winkel-tripel') {
        const state = type === 'winkel-tripel'
            ? { type, progress, winkel: true, latitudeRange: Math.PI / 2 }
            : createConicState(type, progress);
        state.frameExtent = constructionExtent(state);
        return state;
    }
    if (PLATONIC_SOLIDS[type]) {
        const solid = PLATONIC_SOLIDS[type];
        return { type, progress, polyhedral: true, solid,
            animation: createPolyhedralAnimation(solid, progress), latitudeRange: Math.PI / 2 };
    }
    if (type === "tetrahedral" || type === "lambert-azimuthal") {
        return {
            type,
            progress,
            tetrahedral: type === "tetrahedral",
            azimuthal: type === "lambert-azimuthal",
            latitudeRange: Math.PI / 2,
        };
    }
    if (
        [
            "sinusoidal",
            "robinson",
            "equal-earth",
            "goode",
            "equirectangular",
        ].includes(type)
    ) {
        const opening = type === "goode" ? clamp01(progress * 2) : progress;
        const reshape = clamp01(opening * 2);
        const unroll = clamp01(opening * 2 - 1);
        return {
            type,
            progress,
            pseudo: true,
            reshape,
            unroll,
            curvature: 1 - unroll,
            homolosine: type === "goode" ? clamp01(progress * 4 - 2) : 0,
            interrupt: type === "goode" ? clamp01(progress * 4 - 3) : 0,
            latitudeRange: Math.PI / 2,
            profiles: new Map(),
            columns: new Map(),
        };
    }
    const mercator = type === "mercator";
    // Mercator: equal-height projection, unroll, then conformal vertical stretch.
    const project = mercator
        ? clamp01(progress * 3)
        : Math.min(progress / 0.7, 1);
    const stretch = mercator ? clamp01(progress * 3 - 2) : 1;
    const unroll = mercator
        ? clamp01(progress * 3 - 1)
        : Math.max((progress - 0.7) / 0.3, 0);
    const sameHeight = type === "same-height";
    const classic = type === "classic";
    // Use fixed latitude ranges from the globe stage onward, with no live cropping.
    const latitudeRange = sameHeight
        ? Math.PI / 2
        : classic
          ? CLASSIC_LIMIT
          : MERCATOR_LIMIT;
    const guideHeight = sameHeight
        ? 1
        : classic
          ? lerp(Math.sin(latitudeRange), Math.tan(latitudeRange), project)
          : lerp(Math.sin(latitudeRange), Math.PI, stretch);
    return {
        progress,
        project,
        stretch,
        unroll,
        curvature: 1 - unroll,
        mercator,
        sameHeight,
        classic,
        latitudeRange,
        guideHeight,
        profiles: new Map(),
        columns: new Map(),
    };
}

function constructionExtent(state) {
    const extent = [1, 1, 1];
    const surfaces = state.conic && state.transfer < 1 ? [state, createConicState(state.type, 0.25)] : [state];
    for (const surface of surfaces) {
        const min = surface.latitudeMin ?? -surface.latitudeRange;
        const max = surface.latitudeMax ?? surface.latitudeRange;
        for (let row = 0; row <= 16; row++) for (let column = 0; column <= 32; column++) {
            const p = projectPoint(-Math.PI + 2 * Math.PI * column / 32, min + (max - min) * row / 16, surface, {});
            extent[0] = Math.max(extent[0], Math.abs(p.x));
            extent[1] = Math.max(extent[1], Math.abs(p.y));
            extent[2] = Math.max(extent[2], p.z);
        }
    }
    return extent;
}

function longitudeProfile(longitude, state) {
    let column = state.columns.get(longitude);
    if (!column) {
        const k = state.curvature;
        column =
            k < 1e-8
                ? { x: longitude, bend: 0 }
                : {
                      x: Math.sin(k * longitude) / k,
                      bend: (-2 * Math.sin((k * longitude) / 2) ** 2) / k,
                  };
        state.columns.set(longitude, column);
    }
    return column;
}

// Write into a reusable position object to avoid allocations for every vertex.
export function projectPoint(longitude, latitude, state, position, lobeCenter) {
    if (state.conic) return projectConic(longitude, latitude, state, position);
    if (state.winkel) return projectWinkel(longitude, latitude, state.progress, position);
    if (state.polyhedral) {
        const direction = [Math.cos(latitude) * Math.sin(longitude), Math.sin(latitude), Math.cos(latitude) * Math.cos(longitude)];
        return animatePolyhedral(createPolyhedralCoordinate(state.type, direction), state.progress, position, state.animation);
    }
    if (state.tetrahedral) {
        const direction = [
            Math.cos(latitude) * Math.sin(longitude),
            Math.sin(latitude),
            Math.cos(latitude) * Math.cos(longitude),
        ];
        return animateTetrahedral(
            createTetrahedralCoordinate(direction),
            state.progress,
            position,
        );
    }
    if (state.azimuthal) {
        const x = Math.cos(latitude) * Math.sin(longitude),
            y = Math.sin(latitude);
        const z = Math.cos(latitude) * Math.cos(longitude);
        const azimuth = Math.atan2(y, x);
        return projectAzimuthal(
            Math.acos(Math.max(-1, Math.min(1, z))),
            azimuth,
            state.progress,
            position,
        );
    }
    if (state.pseudo) {
        let profile = state.profiles.get(latitude);
        if (!profile) {
            const destination = latitudeProfile(state.type, latitude);
            const cosLatitude = Math.cos(latitude);
            const polarChange = state.type === "goode" && state.homolosine > 0;
            profile = polarChange
                ? {
                      radius: lerp(
                          cosLatitude,
                          destination.radius,
                          state.homolosine,
                      ),
                      height: lerp(
                          latitude,
                          destination.height,
                          state.homolosine,
                      ),
                  }
                : {
                      radius: lerp(
                          cosLatitude,
                          state.type === "goode"
                              ? cosLatitude
                              : destination.radius,
                          state.reshape,
                      ),
                      height: lerp(
                          Math.sin(latitude),
                          state.type === "goode"
                              ? latitude
                              : destination.height,
                          state.reshape,
                      ),
                  };
            state.profiles.set(latitude, profile);
        }
        // Goode first unfolds as Sinusoidal; only then do its polar regions change.
        position.y = profile.height;
        if (state.type === "goode" && state.homolosine > 0) {
            const center = lobeCenter ?? goodeLobeCenter(longitude, latitude);
            position.x =
                longitude * profile.radius +
                state.interrupt * center * (1 - profile.radius);
            position.z = 1;
        } else {
            const column = longitudeProfile(longitude, state);
            position.x = profile.radius * column.x;
            position.z =
                lerp(profile.radius, 1, state.unroll) +
                profile.radius * column.bend;
        }
        return position;
    }
    let row = state.profiles.get(latitude);
    if (!row) {
        const sphereY = Math.sin(latitude);
        const clipped = Math.max(
            -MERCATOR_LIMIT,
            Math.min(MERCATOR_LIMIT, latitude),
        );
        const cylinderY = state.sameHeight
            ? sphereY
            : state.classic
              ? Math.tan(latitude)
              : lerp(
                    sphereY,
                    Math.log(Math.tan(Math.PI / 4 + clipped / 2)),
                    state.stretch,
                );
        row = {
            radius: lerp(Math.cos(latitude), 1, state.project),
            height: lerp(sphereY, cylinderY, state.project),
        };
        state.profiles.set(latitude, row);
    }
    const column = longitudeProfile(longitude, state);
    position.x = state.unroll === 0 ? row.radius * column.x : column.x;
    position.y = row.height;
    position.z =
        state.unroll === 0 ? row.radius * (1 + column.bend) : 1 + column.bend;
    return position;
}

export function projectAzimuthal(angle, azimuth, progress, position) {
    // Open the full sphere into a hemispherical bowl first, then flatten it.
    // The front center stays at z=1 and the antipode opens into the bowl's rim.
    const reshape = clamp01(progress * 2),
        flatten = clamp01(progress * 2 - 1);
    const bowlRadius = lerp(1, Math.SQRT2, reshape);
    const polarAngle = angle * (1 - reshape / 2);
    const radius = lerp(
        bowlRadius * Math.sin(polarAngle),
        2 * Math.sin(angle / 2),
        flatten,
    );
    position.x = radius * Math.cos(azimuth);
    position.y = radius * Math.sin(azimuth);
    position.z = lerp(1 + bowlRadius * (Math.cos(polarAngle) - 1), 1, flatten);
    return position;
}
