import * as THREE from 'three';

export function createMapMaterial(earthInverseRotation) {
  const material = new THREE.MeshBasicMaterial({ color: 0xb9d9ed, side: THREE.DoubleSide });
  // Rotate the sampled geography rather than the projected surface. Sampling in
  // the fragment shader avoids stretched triangles across the map's cut seam.
  material.onBeforeCompile = shader => {
    shader.uniforms.earthInverseRotation = { value: earthInverseRotation };
    shader.vertexShader = `
      attribute vec3 sphereDirection;
      varying vec3 vSphereDirection;
    ` + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vSphereDirection = sphereDirection;
    `);
    shader.fragmentShader = `
      uniform mat3 earthInverseRotation;
      varying vec3 vSphereDirection;
    ` + shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 direction = earthInverseRotation * normalize(vSphereDirection);
        vec2 globeUV = vec2(
          atan(direction.x, direction.z) / (2.0 * PI) + 0.5,
          asin(clamp(direction.y, -1.0, 1.0)) / PI + 0.5
        );
        diffuseColor *= texture2D(map, globeUV);
      #endif
    `);
  };
  return material;
}

export async function loadMapTexture(renderer) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('World map could not load. Reload the page.'));
    // Text-free Natural Earth I; attribution is in assets/world-map-source.txt.
    image.src = new URL('../assets/world-map-natural-earth.jpg', import.meta.url).href;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  // Draw the geographic grid into the texture so it rotates with the Earth.
  context.strokeStyle = 'rgba(255,255,255,0.35)';
  context.lineWidth = 1;
  context.beginPath();
  for (let longitude = -180; longitude <= 180; longitude += 30) {
    const x = (longitude + 180) / 360 * canvas.width;
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
  }
  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = (90 - latitude) / 180 * canvas.height;
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
  }
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}
