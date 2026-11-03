import * as THREE from "three";
import { projectPoint, projectAzimuthal } from "./projections.js";
import { createMapMaterial } from "./texture.js";
import { GOODE_LOBES } from "./pseudocylindrical.js";
import { createPolyhedralCoordinate, animatePolyhedral } from './platonic.js';
import {
    TETRA_VERTICES,
    TETRA_FACES,
    createTetrahedralCoordinate,
    animateTetrahedral,
    createTetrahedralAnimation,
} from "./tetrahedral.js";

function makeSurface(
    coordinates,
    indices,
    uvs = coordinates.flatMap((c) => [
        c.longitude / (2 * Math.PI) + 0.5,
        c.latitude / Math.PI + 0.5,
    ]),
) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(
            new Float32Array(coordinates.length * 3),
            3,
        ).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute(
        "sphereDirection",
        new THREE.BufferAttribute(
            new Float32Array(coordinates.length * 3),
            3,
        ).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setIndex(indices);
    return { geometry, coordinates };
}

function createAzimuthalGeometry() {
    const coordinates = [],
        indices = [];
    const columns = 192,
        rows = 128;
    for (let row = 0; row <= rows; row++) {
        const angle = (row / rows) * Math.PI;
        for (let column = 0; column <= columns; column++) {
            const azimuth = (column / columns) * Math.PI * 2;
            const direction = [
                Math.sin(angle) * Math.cos(azimuth),
                Math.sin(angle) * Math.sin(azimuth),
                Math.cos(angle),
            ];
            coordinates.push({
                angle,
                azimuth,
                cosAzimuth: Math.cos(azimuth),
                sinAzimuth: Math.sin(azimuth),
                direction,
                longitude: Math.atan2(direction[0], direction[2]),
                latitude: Math.asin(direction[1]),
            });
            if (row < rows && column < columns) {
                const a = row * (columns + 1) + column,
                    b = a + 1,
                    c = a + columns + 1,
                    d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }
    }
    return makeSurface(coordinates, indices);
}

function createTetrahedralGeometry() {
    const coordinates = [],
        indices = [];
    const resolution = 96;
    for (const face of TETRA_FACES) {
        const offset = coordinates.length;
        const index = (row, column) =>
            offset + row * (resolution + 1) - (row * (row - 1)) / 2 + column;
        for (let row = 0; row <= resolution; row++) {
            for (let column = 0; column <= resolution - row; column++) {
                const weights = [
                    1 - (row + column) / resolution,
                    row / resolution,
                    column / resolution,
                ];
                const point = [0, 1, 2].map((axis) =>
                    face.vertices.reduce(
                        (sum, vertex, i) => sum + vertex[axis] * weights[i],
                        0,
                    ),
                );
                const length = Math.hypot(...point);
                const direction = point.map((value) => value / length);
                coordinates.push({
                    direction,
                    tetra: createTetrahedralCoordinate(direction, face.id),
                    longitude: Math.atan2(direction[0], direction[2]),
                    latitude: Math.asin(direction[1]),
                });
                if (row < resolution && column < resolution - row) {
                    const a = index(row, column),
                        b = index(row, column + 1),
                        c = index(row + 1, column);
                    indices.push(a, c, b);
                    if (column < resolution - row - 1)
                        indices.push(b, c, index(row + 1, column + 1));
                }
            }
        }
    }
    return makeSurface(coordinates, indices);
}

function createPolyhedralGeometry(solid) {
    const coordinates = [], indices = [];
    const resolution = 24;
    for (const face of solid.faces) {
        for (let edge = 0; edge < face.vertices.length; edge++) {
            const triangle = [face.normal, face.vertices[edge], face.vertices[(edge + 1) % face.vertices.length]];
            const offset = coordinates.length;
            const index = (row, column) => offset + row * (resolution + 1) - row * (row - 1) / 2 + column;
            for (let row = 0; row <= resolution; row++) for (let column = 0; column <= resolution - row; column++) {
                const weights = [1 - (row + column) / resolution, row / resolution, column / resolution];
                const point = [0,1,2].map(axis => triangle.reduce((sum, vertex, i) => sum + weights[i] * vertex[axis], 0));
                const length = Math.hypot(...point);
                const direction = point.map(value => value / length);
                coordinates.push({ longitude: Math.atan2(direction[0], direction[2]), latitude: Math.asin(direction[1]),
                    polyhedral: createPolyhedralCoordinate(solid.type, direction, face.id) });
                if (row < resolution && column < resolution - row) {
                    const a = index(row,column), b = index(row,column+1), c = index(row+1,column);
                    indices.push(a,b,c);
                    if (column < resolution-row-1) indices.push(b,index(row+1,column+1),c);
                }
            }
        }
    }
    return makeSurface(coordinates, indices);
}

function createSurfaceGeometry() {
    const coordinates = [];
    const indices = [];
    const uvs = [];
    for (const lobe of GOODE_LOBES) {
        const columns = Math.ceil(
            ((lobe.east - lobe.west) / (2 * Math.PI)) * 192,
        );
        const rows = 64;
        const offset = coordinates.length;
        for (let row = 0; row <= rows; row++) {
            const latitude =
                lobe.south + ((lobe.north - lobe.south) * row) / rows;
            for (let column = 0; column <= columns; column++) {
                const longitude =
                    lobe.west + ((lobe.east - lobe.west) * column) / columns;
                coordinates.push({
                    longitude,
                    latitude,
                    lobeCenter: lobe.center,
                });
                uvs.push(
                    longitude / (2 * Math.PI) + 0.5,
                    latitude / Math.PI + 0.5,
                );
                if (row < rows && column < columns) {
                    const a = offset + row * (columns + 1) + column;
                    const b = a + 1,
                        c = a + columns + 1,
                        d = c + 1;
                    indices.push(a, b, c, b, d, c);
                }
            }
        }
    }
    return makeSurface(coordinates, indices, uvs);
}

function createCylinderGuide() {
    const vertices = [];
    const segments = 96;
    for (const y of [-Math.PI, Math.PI]) {
        for (let j = 0; j < segments; j++) {
            for (const a of [j, j + 1]) {
                const angle = (a / segments) * Math.PI * 2;
                vertices.push(
                    Math.sin(angle) * 1.005,
                    y,
                    Math.cos(angle) * 1.005,
                );
            }
        }
    }
    for (let j = 0; j < 12; j++) {
        const angle = (j / 12) * Math.PI * 2;
        for (const y of [-Math.PI, Math.PI]) {
            vertices.push(Math.sin(angle) * 1.005, y, Math.cos(angle) * 1.005);
        }
    }
    return new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
        ),
        new THREE.LineBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.3,
        }),
    );
}

function createTetrahedronGuide() {
    const vertices = [];
    for (let i = 0; i < TETRA_VERTICES.length; i++) {
        for (let j = i + 1; j < TETRA_VERTICES.length; j++)
            vertices.push(...TETRA_VERTICES[i], ...TETRA_VERTICES[j]);
    }
    const guide = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.Float32BufferAttribute(vertices, 3),
        ),
        new THREE.LineBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.3,
        }),
    );
    guide.name = "tetrahedron-guide";
    return guide;
}

export function createModel() {
    let { geometry, coordinates } = createSurfaceGeometry();
    const surfaces = new Map([["standard", { geometry, coordinates }]]);
    let positions = geometry.attributes.position;
    let uv = geometry.attributes.uv;
    let sphereDirections = geometry.attributes.sphereDirection;

    const rotation = new THREE.Quaternion();
    const inverseRotation = new THREE.Matrix3();
    const rotationMatrix = new THREE.Matrix4();
    const rotationStep = new THREE.Quaternion();
    const material = createMapMaterial(inverseRotation);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    // The bounding volume changes as the geometry bends.
    mesh.frustumCulled = false;
    const guide = new THREE.Group();
    const cylinderGuide = createCylinderGuide();
    const tetrahedronGuide = createTetrahedronGuide();
    guide.add(cylinderGuide, tetrahedronGuide);
    const solidGuides = new Map();
    const position = { x: 0, y: 0, z: 0 };

    function update(state) {
        const kind = state.polyhedral ? state.type : state.tetrahedral
            ? "tetrahedral"
            : state.azimuthal
              ? "azimuthal"
              : "standard";
        if (!surfaces.has(kind))
            surfaces.set(
                kind,
                state.polyhedral ? createPolyhedralGeometry(state.solid) : state.tetrahedral
                    ? createTetrahedralGeometry()
                    : createAzimuthalGeometry(),
            );
        const surface = surfaces.get(kind);
        ({ geometry, coordinates } = surface);
        mesh.geometry = geometry;
        positions = geometry.attributes.position;
        uv = geometry.attributes.uv;
        sphereDirections = geometry.attributes.sphereDirection;
        const updateGeography = surface.latitudeRange !== state.latitudeRange;
        const tetraAnimation = state.tetrahedral
            ? createTetrahedralAnimation(state.progress)
            : null;
        const azimuthalRows = state.azimuthal ? new Map() : null;
        for (let i = 0; i < coordinates.length; i++) {
            const coordinate = coordinates[i];
            const {
                longitude,
                latitude: fullLatitude,
                lobeCenter,
            } = coordinate;
            const latitude =
                (fullLatitude * state.latitudeRange) / (Math.PI / 2);
            if (state.polyhedral)
                animatePolyhedral(coordinate.polyhedral, state.progress, position, state.animation);
            else if (state.tetrahedral)
                animateTetrahedral(
                    coordinate.tetra,
                    state.progress,
                    position,
                    tetraAnimation,
                );
            else if (state.azimuthal) {
                let row = azimuthalRows.get(coordinate.angle);
                if (!row) {
                    row = projectAzimuthal(
                        coordinate.angle,
                        0,
                        state.progress,
                        {},
                    );
                    azimuthalRows.set(coordinate.angle, row);
                }
                position.x = row.x * coordinate.cosAzimuth;
                position.y = row.x * coordinate.sinAzimuth;
                position.z = row.z;
            } else
                projectPoint(longitude, latitude, state, position, lobeCenter);
            positions.setXYZ(i, position.x, position.y, position.z);
            if (updateGeography) {
                uv.setY(i, (latitude + Math.PI / 2) / Math.PI);
                sphereDirections.setXYZ(
                    i,
                    Math.cos(latitude) * Math.sin(longitude),
                    Math.sin(latitude),
                    Math.cos(latitude) * Math.cos(longitude),
                );
            }
        }
        positions.needsUpdate = true;
        if (updateGeography) {
            sphereDirections.needsUpdate = true;
            uv.needsUpdate = true;
            surface.latitudeRange = state.latitudeRange;
        }
        // This unlit material and its depth-only shadow pass do not use normals.
        // Culling is disabled; recompute raycast bounds lazily only when clicked.
        geometry.boundingSphere = null;
        const cylindrical =
            !state.pseudo && !state.tetrahedral && !state.azimuthal && !state.polyhedral;
        cylinderGuide.visible = cylindrical && state.project < 1;
        tetrahedronGuide.visible =
            Boolean(state.tetrahedral) && state.progress < 0.5;
        if (state.polyhedral && !solidGuides.has(state.type)) {
            const edges = new Set(), vertices = [];
            for (const face of state.solid.faces) for (let i=0; i<face.indices.length; i++) {
                const a=face.indices[i], b=face.indices[(i+1)%face.indices.length], key=[a,b].sort((x,y)=>x-y).join(',');
                if (edges.has(key)) continue;
                edges.add(key); vertices.push(...state.solid.vertices[a], ...state.solid.vertices[b]);
            }
            const wire = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices,3)),
                new THREE.LineBasicMaterial({color: 0x888888, transparent: true, opacity: 0.3}));
            solidGuides.set(state.type, wire);
            guide.add(wire);
        }
        for (const [type, wire] of solidGuides) wire.visible = Boolean(state.polyhedral) && state.type === type && state.progress < 0.5;
        guide.visible = cylinderGuide.visible || tetrahedronGuide.visible || (Boolean(state.polyhedral) && state.progress < 0.5);
        if (state.tetrahedral)
            tetrahedronGuide.material.opacity =
                0.3 * (1 - Math.min(1, state.progress * 2));
        if (cylindrical) {
            cylinderGuide.material.opacity = 0.3 * (1 - state.project);
            cylinderGuide.scale.y = state.guideHeight / Math.PI;
        }
    }

    function rotate(axis, angle) {
        rotationStep.setFromAxisAngle(axis, angle);
        rotation.premultiply(rotationStep).normalize();
        inverseRotation.setFromMatrix4(
            rotationMatrix.makeRotationFromQuaternion(rotation).invert(),
        );
    }

    function resetRotation() {
        rotation.identity();
        inverseRotation.identity();
    }

    function setTexture(texture) {
        material.map = texture;
        material.color.set("white");
        material.needsUpdate = true;
    }

    function textureDirectionAt(hit) {
        // Reverse the mesh transform, then interpolate the exact varying sampled by
        // the fragment shader. UV interpolation alone differs on curved triangles.
        const local = mesh.worldToLocal(hit.point.clone());
        const indices = [hit.face.a, hit.face.b, hit.face.c];
        const vertices = indices.map((index) =>
            new THREE.Vector3().fromBufferAttribute(positions, index),
        );
        const weights = THREE.Triangle.getBarycoord(
            local,
            ...vertices,
            new THREE.Vector3(),
        );
        if (!weights) return null;
        const direction = new THREE.Vector3();
        indices.forEach((index, i) =>
            direction.addScaledVector(
                new THREE.Vector3().fromBufferAttribute(
                    sphereDirections,
                    index,
                ),
                weights.getComponent(i),
            ),
        );
        return direction.normalize().applyMatrix3(inverseRotation).normalize();
    }

    return {
        mesh,
        guide,
        rotation,
        update,
        rotate,
        resetRotation,
        setTexture,
        textureDirectionAt,
    };
}
