import * as THREE from "three";

export function createGridMaterial() {
    const material = new THREE.MeshBasicMaterial({ color: "white" });
    material.onBeforeCompile = (shader) => {
        shader.uniforms.gridColor = { value: new THREE.Color("#e6e6e6") };
        shader.vertexShader =
            `varying vec3 vGridPosition;\n` +
            shader.vertexShader.replace(
                "#include <begin_vertex>",
                `
        #include <begin_vertex>
        vGridPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `,
            );
        shader.fragmentShader =
            `
      uniform vec3 gridColor;
      varying vec3 vGridPosition;
    ` +
            shader.fragmentShader.replace(
                "#include <color_fragment>",
                `
      #include <color_fragment>
      // One-unit squares in world space; derivatives keep lines smooth in pixels.
      vec2 footprint = max(fwidth(vGridPosition.xz), vec2(0.00001));
      vec2 distanceToLine = abs(fract(vGridPosition.xz - 0.5) - 0.5);
      vec2 coverage = 1.0 - smoothstep(vec2(0.0), footprint * 1.25, distanceToLine);
      // Fade each axis before its lines become too dense to resolve on screen.
      coverage *= 1.0 - smoothstep(vec2(0.08), vec2(0.5), footprint);
      diffuseColor.rgb = mix(diffuseColor.rgb, gridColor, max(coverage.x, coverage.y));
    `,
            );
    };
    return material;
}
