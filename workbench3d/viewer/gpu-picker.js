/**
 * gpu-picker.js — GPU color-ID picking for the workbench viewer.
 *
 * Every pickable InstancedMesh carries a per-instance `pickColor` attribute
 * encoding a 24-bit pick id. A pick renders a small window of the scene with
 * an override material that outputs that id verbatim, then reads the pixels
 * back. Cost is O(draw calls), independent of triangle/instance count, so it
 * replaces whole-scene CPU raycasts on click/hover/wheel.
 *
 * Ids: 0 = background, 1.. = entries in the caller's pick table. The caller
 * owns the id→object mapping; this module only encodes/decodes pixels.
 */

/** Layer reserved for pickable meshes (grid/axes/labels stay on layer 0). */
export const PICK_LAYER = 1;

/** Pixel window read per pick; center-out order gives a small hit tolerance. */
const WINDOW = 5;

export function createGpuPicker(THREE, renderer) {
  const target = new THREE.WebGLRenderTarget(WINDOW, WINDOW, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });
  const pixels = new Uint8Array(WINDOW * WINDOW * 4);
  const pickMaterial = new THREE.ShaderMaterial({
    vertexShader: [
      'attribute vec3 pickColor;',
      'varying vec3 vPick;',
      'void main() {',
      '  vPick = pickColor;',
      '  #ifdef USE_INSTANCING',
      '    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);',
      '  #else',
      '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '  #endif',
      '}',
    ].join('\n'),
    fragmentShader: 'varying vec3 vPick; void main() { gl_FragColor = vec4(vPick, 1.0); }',
  });
  pickMaterial.toneMapped = false;
  const clearColor = new THREE.Color();

  /** Encode a 1-based pick id into a normalized rgb triple. */
  function encodeId(id, out, offset) {
    out[offset] = ((id >> 16) & 0xff) / 255;
    out[offset + 1] = ((id >> 8) & 0xff) / 255;
    out[offset + 2] = (id & 0xff) / 255;
  }

  /**
   * Pick at pixel (x, y) of a virtual (width, height) view rendered by
   * `camera`. Returns the 1-based pick id under the cursor (searching a small
   * window center-out) or 0 for background. The caller is responsible for
   * setting group visibility/camera aspect to match the view being picked.
   */
  function pick(scene, camera, x, y, width, height) {
    const prevOverride = scene.overrideMaterial;
    const prevLayerMask = camera.layers.mask;
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(clearColor);
    const prevAlpha = renderer.getClearAlpha();
    const prevScissor = renderer.getScissorTest();
    const hadViewOffset = !!camera.view?.enabled;

    scene.overrideMaterial = pickMaterial;
    camera.layers.set(PICK_LAYER);
    const half = Math.floor(WINDOW / 2);
    camera.setViewOffset(width, height, x - half, y - half, WINDOW, WINDOW);
    renderer.setScissorTest(false);
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, WINDOW, WINDOW, pixels);

    scene.overrideMaterial = prevOverride;
    camera.layers.mask = prevLayerMask;
    if (hadViewOffset) camera.view.enabled = true; else camera.clearViewOffset();
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(clearColor, prevAlpha);
    renderer.setScissorTest(prevScissor);

    // Center-out spiral over the window: nearest hit to the cursor wins.
    const order = [];
    for (let dy = 0; dy < WINDOW; dy += 1) {
      for (let dx = 0; dx < WINDOW; dx += 1) order.push([dx, dy, Math.abs(dx - half) + Math.abs(dy - half)]);
    }
    order.sort((a, b) => a[2] - b[2]);
    for (const [dx, dy] of order) {
      // readRenderTargetPixels rows are bottom-up; flip dy to match screen y.
      const offset = ((WINDOW - 1 - dy) * WINDOW + dx) * 4;
      const id = (pixels[offset] << 16) | (pixels[offset + 1] << 8) | pixels[offset + 2];
      if (id) return id;
    }
    return 0;
  }

  function dispose() {
    target.dispose();
    pickMaterial.dispose();
  }

  return { pick, encodeId, dispose };
}
