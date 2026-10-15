/** Deterministic pointer controls. Inputs and outputs use scene-local coordinates. */

import { NAVIGATION_PRESETS, normalizeNavigationPreset } from './workbench-navigation-state.js';

const TRANSITION_MS = 240;
const WHEEL_END_MS = 180;

function pointerMode(preset, event) {
  if (preset === NAVIGATION_PRESETS.CAD_EDIT) {
    if (event.button !== 1) return null;
    return event.shiftKey ? 'pan' : 'orbit';
  }
  if (event.button === 2 || (event.button === 0 && event.shiftKey)) return 'pan';
  return event.button === 0 ? 'orbit' : null;
}

export function createWorkbenchNavigationControls(input) {
  const { THREE, getCamera, dom, getVerticalAxis, onChange, getZoomAnchor,
    onGestureStart, onGestureEnd } = input;
  const preset = normalizeNavigationPreset(input.navigationPreset);
  const target = new THREE.Vector3();
  let spherical = new THREE.Spherical();
  let pivot = null;
  let activePointer = null;
  let transitionFrame = null;
  let wheelTimer = null;
  let wheelActive = false;
  const locks = new Set();

  function toSphericalVector(vector) {
    return getVerticalAxis() === 'Z' ? new THREE.Vector3(vector.x, vector.z, -vector.y) : vector.clone();
  }

  function toWorldVector(vector) {
    return getVerticalAxis() === 'Z' ? new THREE.Vector3(vector.x, -vector.z, vector.y) : vector.clone();
  }

  function syncFromCamera() {
    spherical = new THREE.Spherical().setFromVector3(toSphericalVector(getCamera().position.clone().sub(target)));
  }

  function apply() {
    spherical.phi = Math.max(0.001, Math.min(Math.PI - 0.001, spherical.phi));
    spherical.radius = Math.max(0.01, spherical.radius);
    getCamera().position.copy(toWorldVector(new THREE.Vector3().setFromSpherical(spherical)).add(target));
    getCamera().lookAt(target);
    onChange();
  }

  function cancelTransition() {
    if (transitionFrame !== null) cancelAnimationFrame(transitionFrame);
    transitionFrame = null;
  }

  function finishPointer(cancelled) {
    if (!activePointer) return;
    const finished = activePointer;
    activePointer = null;
    if (dom.hasPointerCapture?.(finished.pointerId)) dom.releasePointerCapture(finished.pointerId);
    onGestureEnd(finished.changed, cancelled);
  }

  function finishWheel(cancelled) {
    if (wheelTimer !== null) clearTimeout(wheelTimer);
    wheelTimer = null;
    if (!wheelActive) return;
    wheelActive = false;
    onGestureEnd(true, cancelled);
  }

  function panBy(dx, dy) {
    const camera = getCamera();
    const height = Math.max(dom.clientHeight, 1);
    const scale = camera.isOrthographicCamera
      ? (camera.top - camera.bottom) / height / camera.zoom
      : 2 * Math.tan((camera.fov * Math.PI) / 360) * spherical.radius / height;
    target.add(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * scale));
    target.add(new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(dy * scale));
  }

  function orbitByPixels(dx, dy) {
    if (pivot) {
      const camera = getCamera();
      const offset = camera.position.clone().sub(pivot);
      const around = new THREE.Spherical().setFromVector3(toSphericalVector(offset));
      around.theta -= dx * 0.003;
      around.phi = Math.max(0.001, Math.min(Math.PI - 0.001, around.phi - dy * 0.003));
      const next = toWorldVector(new THREE.Vector3().setFromSpherical(around)).add(pivot);
      target.copy(pivot);
      spherical.setFromVector3(toSphericalVector(next.clone().sub(target)));
      return;
    }
    spherical.theta -= dx * 0.003;
    spherical.phi -= dy * 0.003;
  }

  function onPointerDown(event) {
    if (locks.size || activePointer) return;
    const mode = pointerMode(preset, event);
    if (!mode) return;
    cancelTransition();
    activePointer = { pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY, changed: false };
    dom.setPointerCapture?.(event.pointerId);
    onGestureStart();
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!activePointer || event.pointerId !== activePointer.pointerId) return;
    const dx = event.clientX - activePointer.x;
    const dy = event.clientY - activePointer.y;
    activePointer.x = event.clientX;
    activePointer.y = event.clientY;
    if (!dx && !dy) return;
    if (activePointer.mode === 'orbit') orbitByPixels(dx, dy);
    else panBy(dx, dy);
    activePointer.changed = true;
    apply();
  }

  function onPointerUp(event) {
    if (activePointer?.pointerId === event.pointerId) finishPointer(false);
  }

  function onPointerCancel(event) {
    if (activePointer?.pointerId === event.pointerId) finishPointer(true);
  }

  function onWheel(event) {
    if (locks.size) return;
    event.preventDefault();
    cancelTransition();
    if (!wheelActive) { wheelActive = true; onGestureStart(); }
    const factor = Math.exp(event.deltaY * (event.shiftKey ? 0.0005 : 0.002));
    const anchor = getZoomAnchor?.(event) ?? null;
    if (anchor) target.sub(anchor).multiplyScalar(factor).add(anchor);
    const camera = getCamera();
    if (camera.isOrthographicCamera) {
      camera.zoom = Math.max(1e-4, Math.min(1e6, camera.zoom / factor));
      camera.updateProjectionMatrix();
    } else spherical.radius *= factor;
    apply();
    if (wheelTimer !== null) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => finishWheel(false), WHEEL_END_MS);
  }

  function setView(position, lookAt) {
    cancelTransition();
    const start = performance.now();
    const startTarget = target.clone();
    const startPosition = getCamera().position.clone();
    const step = (now) => {
      const amount = Math.min(1, (now - start) / TRANSITION_MS);
      const eased = 1 - Math.pow(1 - amount, 3);
      target.lerpVectors(startTarget, lookAt, eased);
      const positionNow = new THREE.Vector3().lerpVectors(startPosition, position, eased);
      spherical.setFromVector3(toSphericalVector(positionNow.sub(target)));
      apply();
      transitionFrame = amount < 1 ? requestAnimationFrame(step) : null;
    };
    transitionFrame = requestAnimationFrame(step);
  }

  function setViewInstant(position, lookAt) {
    cancelTransition();
    target.copy(lookAt);
    spherical.setFromVector3(toSphericalVector(position.clone().sub(lookAt)));
    apply();
  }

  function acquireLock(owner) {
    const key = String(owner ?? '').trim();
    if (!key) throw new TypeError('Navigation lock owner is required.');
    const token = Object.freeze({ owner: key });
    locks.add(token);
    finishPointer(true);
    finishWheel(true);
    let released = false;
    return () => { if (!released) { locks.delete(token); released = true; } };
  }

  function onEscape(event) {
    if (event.key === 'Escape') { finishPointer(true); finishWheel(true); cancelTransition(); }
  }

  function onContext(event) { if (preset !== NAVIGATION_PRESETS.CAD_EDIT) event.preventDefault(); }
  function onBlur() { finishPointer(true); finishWheel(true); }
  const windowRef = dom.ownerDocument.defaultView;
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointercancel', onPointerCancel);
  dom.addEventListener('lostpointercapture', onPointerCancel);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.addEventListener('contextmenu', onContext);
  windowRef.addEventListener('blur', onBlur);
  windowRef.addEventListener('keydown', onEscape);
  syncFromCamera();
  apply();

  return Object.freeze({
    target,
    get spherical() { return spherical; },
    get pivot() { return pivot; },
    setPivot(point) { pivot = point ? point.clone() : null; onChange(); },
    setView,
    setViewInstant,
    syncFromCamera,
    apply,
    orbitBy(theta, phi) { spherical.theta -= theta; spherical.phi -= phi; apply(); },
    zoomBy(factor) {
      const camera = getCamera();
      if (camera.isOrthographicCamera) {
        camera.zoom = Math.max(1e-4, Math.min(1e6, camera.zoom / factor));
        camera.updateProjectionMatrix();
      }
      else spherical.radius *= factor;
      apply();
    },
    acquireLock,
    dispose() {
      finishPointer(true); finishWheel(true); cancelTransition();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerCancel);
      dom.removeEventListener('lostpointercapture', onPointerCancel);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('contextmenu', onContext);
      windowRef.removeEventListener('blur', onBlur);
      windowRef.removeEventListener('keydown', onEscape);
    },
  });
}
