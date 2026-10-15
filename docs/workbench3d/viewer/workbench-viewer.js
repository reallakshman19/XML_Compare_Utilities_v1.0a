/**
 * workbench-viewer.js — the 3D viewer shell.
 *
 * The viewer never matches: it renders VisualGeometryModel.v1 plus a
 * status-by-objectId map derived from CompareAudit.v1 and reports picks back.
 * Three.js is loaded dynamically (importmap key first, CDN fallback) so the
 * rest of the workbench — and Node tests — never depend on it.
 *
 * Rendering strategy: every drawable is an instance of a unit primitive
 * (cylinder / sphere / cone / octahedron) inside a small set of InstancedMesh
 * batches keyed by (group × primitive × opacity class). Large models collapse
 * to a few dozen draw calls; visibility and recolor are per-instance buffer
 * writes, not scene rebuilds. Picking is a GPU color-ID pass (gpu-picker.js),
 * O(draw calls) regardless of model size.
 */

import { createGpuPicker, PICK_LAYER } from './gpu-picker.js';
import { scoreBandColor, SCORE_BAND_COLORS } from '../ui/transfer-overlay-models.js';
import { createWorkbenchNavigationControls } from './workbench-navigation-controls.js';
import {
  createViewerNavigationState, normalizeNavigationPreset, normalizeVerticalAxis,
  sameViewerNavigationState, validateViewerNavigationState,
  viewToWorldCoordinates, worldToViewCoordinates,
} from './workbench-navigation-state.js';
import { createSceneDerivationScheduler } from './scene-derivation-scheduler.js';
import { diffSceneChunks, querySceneSpatialIndex, SCENE_CHUNK_SIZE } from './scene-runtime.js';

const THREE_IMPORTS = Object.freeze(['three', 'https://esm.sh/three@0.160.0/build/three.module.js']);

/** Diff-status → render style. Single source of truth for viewer + legend. */
export const STATUS_STYLES = Object.freeze({
  MATCHED_UNCHANGED: { color: 0x22c55e, label: 'Matched / unchanged' },
  PROPERTY_CHANGED: { color: 0xeab308, label: 'Property changed' },
  GEOMETRY_CHANGED: { color: 0xf97316, label: 'Geometry changed' },
  MISSING_IN_TARGET: { color: 0xef4444, label: 'Missing in target' },
  NEW_IN_TARGET: { color: 0x3b82f6, label: 'New in target' },
  AMBIGUOUS: { color: 0xa855f7, label: 'Ambiguous' },
  SPLIT: { color: 0xec4899, label: 'Split' },
  MERGE: { color: 0xec4899, label: 'Merge' },
  CONSUMED: { color: 0xec4899, label: 'Consumed short' },
  CONFLICT: { color: 0x7f1d1d, label: 'Conflict / blocked' },
  TRANSFER_READY: { color: 0x06b6d4, label: 'Transfer ready' },
  GHOST: { color: 0x64748b, label: 'Source (ghost)' },
});

async function loadThree() {
  let lastError = null;
  for (const spec of THREE_IMPORTS) {
    try { return await import(spec); } catch (error) { lastError = error; }
  }
  throw new Error(`Three.js unavailable: ${lastError?.message ?? 'no import source worked'}`);
}

/** Connector type/status → line color. */
const CONNECTOR_COLORS = Object.freeze({
  BASIS_CONNECTOR: 0xf59e0b,          // unique gold — identity/manual anchors
  MATCH_CONNECTOR: 0x22c55e,
  CANDIDATE_CONNECTOR: 0x60a5fa,
  CONFLICT_CONNECTOR: 0xa855f7,
  TRANSFER_CONNECTOR: 0x0891b2,
  TRANSFER_READY: 0x06b6d4,
  TRANSFER_BLOCKED: 0x7f1d1d,
  REGISTRATION_ANCHOR_CONNECTOR: 0x94a3b8,
});

/** Derived match connectors grade their colour by confidence. */
const MATCH_CONFIDENCE_COLORS = Object.freeze({
  HIGH: 0x22c55e,    // green — strong derived evidence
  MEDIUM: 0x84cc16,  // lime
  LOW: 0xef4444,     // red — review before trusting
});

const MARKER_COLORS = Object.freeze({
  RIGID: 0xf59e0b, BEND: 0x8b5cf6, SIF: 0x14b8a6, RESTRAINT: 0x22d3ee,
  RESTRAINT_ARROW: 0x06b6d4, HANGER: 0x22d3ee, SUPPORT: 0x22d3ee, NODE: 0x94a3b8,
});

const GHOST_PROPOSAL_COLOR = 0x22d3ee;

export async function createWorkbenchViewer(container, {
  onPick, onHoverConnector, onHoverObject, onCameraChange, onRuntimeError,
  onNavigationError, navigationPreset,
} = {}) {
  const THREE = await loadThree();
  if (typeof Worker !== 'function') throw new Error('Workbench viewer requires browser Worker support for scene derivation.');
  let verticalAxis = 'Z';
  const effectiveNavigationPreset = normalizeNavigationPreset(navigationPreset);
  let host = container; // reassigned by reattach() when the tab re-renders its DOM
  // preserveDrawingBuffer keeps readPixels/screenshots dependable.
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0b1220);
  renderer.setScissorTest(false);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('role', 'application');
  renderer.domElement.setAttribute('aria-label', 'Interactive engineering 3D scene. Use the toolbar or keyboard commands to select, navigate, zoom, and fit objects.');
  renderer.domElement.setAttribute('aria-keyshortcuts', 'F [ ] Enter Delete Control+Z Control+Y');

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(1, 2, 1.5);
  scene.add(keyLight);
  const grid = new THREE.GridHelper(10000, 20, 0x1f2a3d, 0x142033);
  scene.add(grid);
  const axes = new THREE.AxesHelper(800);
  scene.add(axes);

  const axisScene = new THREE.Scene();
  const axisCamera = new THREE.PerspectiveCamera(50, 1, 1, 1000);
  const axisHelper = new THREE.AxesHelper(40);
  axisScene.add(axisHelper);

  const createLineLetter = (pointsArray, color) => {
    const pts = pointsArray.map(p => new THREE.Vector3(...p));
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.LineSegments(geom, new THREE.LineBasicMaterial({ color }));
  };
  const letterX = createLineLetter([[48, -4, -4], [48, 4, 4], [48, 4, -4], [48, -4, 4]], 0xff8888);
  const letterY = createLineLetter([[-4, 52, 0], [0, 48, 0], [4, 52, 0], [0, 48, 0], [0, 48, 0], [0, 44, 0]], 0x88ff88);
  const letterZ = createLineLetter([[-4, 0, 52], [4, 0, 52], [4, 0, 52], [-4, 0, 44], [-4, 0, 44], [4, 0, 44]], 0x8888ff);
  axisScene.add(letterX, letterY, letterZ);

  function renderAxisCompass(xOffset, yOffset) {
    axisCamera.quaternion.copy(camera.quaternion);
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    axisCamera.position.copy(dir.multiplyScalar(120));
    axisCamera.lookAt(0, 0, 0);

    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    const size = 64;
    renderer.setViewport(xOffset + 10, yOffset + 10, size, size);
    renderer.setScissor(xOffset + 10, yOffset + 10, size, size);
    renderer.render(axisScene, axisCamera);
    renderer.autoClear = autoClear;
    renderer.setScissorTest(mode === 'side-by-side');
  }

  let activeCameraType = 'Perspective';
  const perspCamera = new THREE.PerspectiveCamera(55, 1, 1, 1e7);
  perspCamera.position.set(2500, 2200, 2500);
  perspCamera.up.set(0, 0, 1);
  const orthoCamera = new THREE.OrthographicCamera(-100, 100, 100, -100, 1, 1e7);
  orthoCamera.up.set(0, 0, 1);
  axisCamera.up.set(0, 0, 1);
  let camera = perspCamera;

  const pivotMarker = new THREE.Group();
  const pivotGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-40,0,0), new THREE.Vector3(40,0,0),
    new THREE.Vector3(0,-40,0), new THREE.Vector3(0,40,0),
    new THREE.Vector3(0,0,-40), new THREE.Vector3(0,0,40)
  ]);
  const pivotMat = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.5 });
  pivotMarker.add(new THREE.LineSegments(pivotGeom, pivotMat));
  pivotMarker.visible = false;

  const sourceGroup = new THREE.Group();
  const targetGroup = new THREE.Group();
  const ghostGroup = new THREE.Group(); // ghost fix proposals (setGhostModel)
  const connectorGroup = new THREE.Group();
  const transientGroup = new THREE.Group(); // drag previews / rubber bands
  const measurementGroup = new THREE.Group(); // persistent measure polyline, excluded from picking
  scene.add(sourceGroup, targetGroup, ghostGroup, connectorGroup, transientGroup, measurementGroup, pivotMarker);

  let mode = 'overlay';
  let sourceOpacity = 0.32;
  let statusFilter = null; // Set of statuses or null
  let isolation = null; // Set of objectIds or null
  let statusByObjectId = new Map();
  let disposed = false;
  // Connector layer state — connectors are hidden by default and shown only
  // per mode ('selection' follows the selected object).
  let connectorMode = 'selection';
  let selectedObjectId = null;
  let selectedIds = new Set();
  // Style/override state — set from outside; the viewer never derives colors.
  let activeStyles = null; // { STATUS: { colorInt, alpha, label } } from effectiveStatusStyles
  let colorOverrides = null; // Map<objectId, colorInt> (e.g. heatmap) — beats status color
  let transientRecolor = null; // Map<objectId, colorInt> from updateObjects() — beats everything but selection

  function styleOf(statusKey) {
    if (activeStyles?.[statusKey]) return activeStyles[statusKey];
    const base = STATUS_STYLES[statusKey] ?? STATUS_STYLES.GHOST;
    return { colorInt: base.color, alpha: 1, label: base.label };
  }

  let models = { source: null, target: null, registrationTranslation: [0, 0, 0] };
  let pendingModels = models;
  let sceneRuntime = null;
  let runtimeError = null;
  let fullRebuildCount = 0;
  let incrementalRebuildCount = 0;
  let skippedRebuildCount = 0;
  let pendingFit = false;
  const sceneOrigin = new THREE.Vector3();
  let ghostModel = null;
  let connectorRecords = []; // [{ connector, from:V3, to:V3, colorInt }]

  // ── instanced batching ───────────────────────────────────────────────────
  // A "record" is one instance of a unit primitive. Batches group records by
  // (render group × primitive × opacity class) into one InstancedMesh each.
  const UNIT = {}; // primitive name -> unit BufferGeometry (lazy)
  function unitGeometry(prim) {
    if (!UNIT[prim]) {
      const frustumRatio = prim.startsWith('FRUSTUM:') ? Number(prim.split(':')[1]) : null;
      UNIT[prim] = Number.isFinite(frustumRatio) ? new THREE.CylinderGeometry(frustumRatio, 1, 1, 16, 1)
        : prim === 'CYL' ? new THREE.CylinderGeometry(1, 1, 1, 12, 1)
          : prim === 'CONE' ? new THREE.ConeGeometry(0.45, 1, 12)
            : prim === 'OCT' ? new THREE.OctahedronGeometry(1)
              : prim === 'SPH_LOW' ? new THREE.SphereGeometry(1, 6, 4)
                : prim === 'SPH_BALANCED' ? new THREE.SphereGeometry(1, 8, 6)
                  : new THREE.SphereGeometry(1, 12, 10);
    }
    return UNIT[prim];
  }

  const batchMaterials = new Map(); // alphaKey -> MeshStandardMaterial
  function batchMaterial(alphaKey) {
    if (!batchMaterials.has(alphaKey)) {
      const opts = { color: 0xffffff, roughness: 0.55, metalness: 0.08 };
      const mat = new THREE.MeshStandardMaterial(opts);
      if (alphaKey === 'ghost') { mat.transparent = true; mat.opacity = sourceOpacity; mat.depthWrite = false; }
      else if (alphaKey === 'proposal') { mat.transparent = true; mat.opacity = 0.45; mat.depthWrite = false; mat.emissive = new THREE.Color(0x0e7490); mat.emissiveIntensity = 0.4; }
      else if (alphaKey.startsWith('a')) { const alpha = Number(alphaKey.slice(1)) || 1; mat.transparent = alpha < 1; mat.opacity = alpha; }
      batchMaterials.set(alphaKey, mat);
    }
    return batchMaterials.get(alphaKey);
  }

  let batches = []; // [{ mesh, records, group, chunkId }]
  let pickTable = [null]; // pickId (1-based) -> record
  let freePickIds = [];
  let pendingRecords = null; // Map<batchKey, {group, prim, alphaKey, chunkId, layerMode, records[]}> during rebuild

  const _pos = new THREE.Vector3(); const _quat = new THREE.Quaternion(); const _scale = new THREE.Vector3();
  const _mat4 = new THREE.Matrix4(); const _color = new THREE.Color(); const _up = new THREE.Vector3(0, 1, 0);

  /**
   * Queue one instance. `spec`: prim, position(V3), quaternion(Quaternion|null),
   * scale(V3), alphaKey, colorMode('style'|'fixed'), styleKey, fixedColorInt,
   * overridable, meta { objectId, nodeId, modelId, marker, kind, pathId,
   * status, ghost, isObjectMarker, connector, groupKind }.
   */
  function emit(group, spec) {
    const layerMode = spec.layerMode ?? 'both';
    const key = `${spec.chunkId}|${group.uuid}|${spec.prim}|${spec.alphaKey}|${layerMode}`;
    let bucket = pendingRecords.get(key);
    if (!bucket) {
      bucket = { group, prim: spec.prim, alphaKey: spec.alphaKey, chunkId: spec.chunkId, layerMode, records: [] };
      pendingRecords.set(key, bucket);
    }
    const record = {
      prim: spec.prim,
      position: spec.position.clone(),
      quaternion: spec.quaternion ? spec.quaternion.clone() : null,
      scale: spec.scale.clone(),
      colorMode: spec.colorMode,
      styleKey: spec.styleKey ?? null,
      fixedColorInt: spec.fixedColorInt ?? null,
      overridable: !!spec.overridable,
      meta: spec.meta,
      pickId: 0,
      batch: null,
      index: 0,
    };
    if (spec.pickable !== false) {
      record.pickId = freePickIds.pop() ?? pickTable.length;
      pickTable[record.pickId] = record;
    }
    bucket.records.push(record);
    return record;
  }

  function emitCylinderBetween(group, start, end, radius, spec) {
    const dir = end.clone().sub(start);
    const length = Math.max(dir.length(), 0.001);
    _quat.setFromUnitVectors(_up, dir.normalize());
    emit(group, {
      ...spec,
      prim: 'CYL',
      position: start.clone().add(end).multiplyScalar(0.5),
      quaternion: _quat,
      scale: _scale.set(radius, length, radius),
    });
  }

  /** Emit a true tapered cylinder whose bottom is at start and top is at end. */
  function emitFrustumBetween(group, start, end, startRadius, endRadius, spec) {
    const dir = end.clone().sub(start);
    const length = Math.max(dir.length(), 0.001);
    const baseRadius = Math.max(Number(startRadius) || 0, 0.001);
    const ratio = Math.max(Number(endRadius) || 0, 0.001) / baseRadius;
    _quat.setFromUnitVectors(_up, dir.normalize());
    emit(group, {
      ...spec,
      prim: `FRUSTUM:${ratio.toFixed(4)}`,
      position: start.clone().add(end).multiplyScalar(0.5),
      quaternion: _quat,
      scale: _scale.set(baseRadius, length, baseRadius),
    });
  }

  function segmentRecords(group, seg, spec, radiusScale = 1) {
    const kind = String(seg.kind || '');
    const start = new THREE.Vector3(...seg.start);
    const end = new THREE.Vector3(...seg.end);
    const radius = Math.max((seg.radiusMm || 25) * radiusScale, 4);
    const diff = end.clone().sub(start);
    const len = diff.length();
    const normalizedKind = kind.trim().toUpperCase();
    if (normalizedKind === 'VALVE' && len >= 0.1) {
      const normal = diff.clone().normalize();
      const at = (fraction) => start.clone().addScaledVector(normal, len * fraction);
      const cuts = [0, 0.14, 0.30, 0.70, 0.86, 1].map(at);
      const flangeRadius = Math.max(radius * 1.55, radius + 35);
      const seatRadius = Math.max(radius * 1.04, radius + 2);
      const bodyRadius = Math.max(radius * 1.35, radius + 25);
      const flangeSpec = { ...spec, fixedColorInt: 0xb7b7b7 };
      _quat.setFromUnitVectors(_up, normal);
      emitCylinderBetween(group, cuts[0], cuts[1], flangeRadius, flangeSpec);
      emitCylinderBetween(group, cuts[1], cuts[2], seatRadius, spec);
      const bodyLength = cuts[2].distanceTo(cuts[3]);
      const sphereRadius = Math.max(bodyRadius, bodyLength / 2);
      emit(group, { ...spec, prim: 'SPH', position: cuts[2].clone().add(cuts[3]).multiplyScalar(0.5), quaternion: _quat, scale: _scale.set(sphereRadius, sphereRadius, sphereRadius) });
      emitCylinderBetween(group, cuts[3], cuts[4], seatRadius, spec);
      emitCylinderBetween(group, cuts[4], cuts[5], flangeRadius, flangeSpec);
      return;
    }
    if (normalizedKind === 'INST' && len >= 0.1) {
      emitCylinderBetween(group, start, end, radius, spec);
      const mid = start.clone().add(end).multiplyScalar(0.5);
      emit(group, { ...spec, prim: 'SPH', position: mid, quaternion: null, scale: _scale.set(radius * 1.22, radius * 1.22, radius * 1.22) });
      return;
    }
    if (normalizedKind === 'FLANGE' && len >= 0.1) {
      const normal = diff.clone().normalize();
      const split = start.clone().addScaledVector(normal, len * 0.46);
      const hubRadius = Math.max(radius * 1.18, radius + 8);
      emitFrustumBetween(group, start, split, radius, hubRadius, spec);
      emitCylinderBetween(group, split, end, Math.max(radius * 1.55, radius + 35), spec);
      return;
    }
    if (normalizedKind === 'GASK' && len >= 0.1) {
      emitCylinderBetween(group, start, end, radius * 1.25, spec);
      return;
    }
    if ((normalizedKind === 'TEE' || normalizedKind === 'TEE_COLLAR') && len >= 0.1) {
      emitCylinderBetween(group, start, end, radius, spec);
      return;
    }
    if (normalizedKind === 'OLET' && len >= 0.1) {
      const branchRadius = Math.max((Number(seg.radiusMm2) || radius * 0.5) * radiusScale, 3);
      emitFrustumBetween(group, start, end, radius, branchRadius, spec);
      return;
    }
    if (normalizedKind === 'REDUCER' && len >= 0.1) {
      // Reducer: truncated taper from the large end (seg.radiusMm at start) to
      // the small end (seg.radiusMm2 at end) as stepped cylinders — exact bore
      // radii, no fudge factor, orientation supplied by the visual model.
      const smallR = Math.max((Number(seg.radiusMm2) || radius * 0.6) * radiusScale, 3);
      emitFrustumBetween(group, start, end, radius, smallR, spec);
      return;
    }
    if (normalizedKind === 'ELBOW') {
      const centerArr = seg.center || (seg.attrs?.centerPoint || seg.attrs?.centrePoint || seg.attrs?.center || seg.attrs?.centre);
      const c = centerArr ? new THREE.Vector3(...centerArr) : null;
      if (c && elbowRecords(group, seg, spec, start, end, c, radius)) return;
    }
    emitCylinderBetween(group, start, end, radius, spec);
  }

  /** Tessellate the bend arc into cylinder instances. Returns false when the
   *  geometry degenerates and the caller should fall back to a straight run. */
  function elbowRecords(group, seg, spec, p1, p2, c, radius) {
    const v1 = p1.clone().sub(c);
    const v2 = p2.clone().sub(c);
    if (v1.length() < 0.1 || v2.length() < 0.1) return false;
    const d1 = v1.clone().normalize();
    const d2 = v2.clone().normalize();
    const dot = THREE.MathUtils.clamp(d1.dot(d2), -1, 1);
    const angle = Math.acos(dot);
    if (angle < 0.05 || Math.abs(Math.PI - angle) < 0.05) return false;
    const normal = new THREE.Vector3().crossVectors(d1, d2);
    if (normal.length() < 1e-4) return false;
    const arcRadius = Math.min(v1.length(), v2.length());
    if (arcRadius < radius * 0.5) return false;
    const arcStart = c.clone().addScaledVector(d1, arcRadius);
    const arcEnd = c.clone().addScaledVector(d2, arcRadius);
    const sweepAngle = Math.PI - angle;
    const alphaVal = (4 / 3) * Math.tan(sweepAngle / 4);
    const cp1 = arcStart.clone().addScaledVector(d1, -alphaVal * arcRadius);
    const cp2 = arcEnd.clone().addScaledVector(d2, -alphaVal * arcRadius);
    const curve = new THREE.CubicBezierCurve3(arcStart, cp1, cp2, arcEnd);
    const requestedRange = Array.isArray(seg.curveRange) ? seg.curveRange.map(Number) : [0, 1];
    const startT = THREE.MathUtils.clamp(Number.isFinite(requestedRange[0]) ? requestedRange[0] : 0, 0, 1);
    const endT = THREE.MathUtils.clamp(Number.isFinite(requestedRange[1]) ? requestedRange[1] : 1, startT, 1);
    if (startT === 0 && p1.distanceTo(arcStart) > 0.1) emitCylinderBetween(group, p1, arcStart, radius, spec);
    if (endT === 1 && arcEnd.distanceTo(p2) > 0.1) emitCylinderBetween(group, arcEnd, p2, radius, spec);
    const steps = Math.max(4, Math.ceil(12 * (endT - startT)));
    const points = Array.from({ length: steps + 1 }, (_, index) => curve.getPoint(startT + ((endT - startT) * index / steps)));
    for (let i = 0; i < steps; i += 1) {
      emitCylinderBetween(group, points[i], points[i + 1], radius, spec);
    }
    // Sphere joints hide the faceting between arc segments.
    for (let i = 1; i < steps; i += 1) {
      emit(group, { ...spec, prim: 'SPH', position: points[i], quaternion: null, scale: _scale.set(radius, radius, radius) });
    }
    return true;
  }

  function nodePrimitive() {
    if (sceneRuntime?.lod.level === 'coarse') return 'SPH_LOW';
    if (sceneRuntime?.lod.level === 'balanced') return 'SPH_BALANCED';
    return 'SPH';
  }

  function emitNodePickProxy(group, spec, marker, meta) {
    const pickSize = Math.max(Number(marker.pickSizeMm) || Number(marker.sizeMm) || 24, 18);
    emit(group, {
      ...spec,
      prim: nodePrimitive(),
      scale: _scale.set(pickSize, pickSize, pickSize),
      alphaKey: 'solid',
      layerMode: 'pick',
      pickable: true,
      meta: { ...meta, pickProxy: true },
    });
  }

  function markerRecord(group, marker, modelId, statusKey, groupKind, chunkId) {
    const isAnchor = String(marker.kind).startsWith('ANCHOR');
    const isNode = marker.kind === 'NODE';
    const isRestraintArrow = marker.kind === 'RESTRAINT_ARROW';
    const size = Number.isFinite(marker.sizeMm) ? marker.sizeMm : (isAnchor ? 34 : 30);
    if (size <= 0) return; // LABEL markers carry sizeMm 0 — nothing to draw
    const prim = isAnchor ? 'OCT' : isRestraintArrow ? 'CONE' : isNode ? nodePrimitive() : 'SPH';
    const baseColor = Number.isFinite(marker.colorInt) ? marker.colorInt : isAnchor ? 0x94a3b8 : (MARKER_COLORS[marker.kind] ?? 0xcbd5e1);
    const statusColored = !!(marker.objectId && (isNode || marker.isObjectMarker) && statusKey);
    const overridable = !!(marker.objectId && (isNode || marker.isObjectMarker));
    const ghost = groupKind === 'ghostModel' ? false : (modelId === 'source' && !marker.isObjectMarker);
    const alpha = statusColored ? styleOf(statusKey).alpha : (marker.kind === 'SUPPORT' ? 0.15 : isNode ? 0.38 : 1);
    const alphaKey = groupKind === 'ghostModel' ? 'proposal' : ghost ? 'ghost' : alpha < 1 ? `a${alpha}` : 'solid';
    const pos = _pos.set(...marker.position);
    let quaternion = null;
    if (isRestraintArrow) {
      if (!Array.isArray(marker.direction) || marker.direction.length !== 3) throw new TypeError(`Restraint arrow ${marker.objectId ?? '(unknown)'} has no 3D direction.`);
      const dirVec = new THREE.Vector3(...marker.direction).normalize();
      quaternion = new THREE.Quaternion().setFromUnitVectors(_up, dirVec);
      // The cone primitive points in +Y and its tip is at +size/2 locally.
      // To place the tip exactly at marker.position, we shift the cone's center backward by size/2.
      pos.addScaledVector(dirVec, -size / 2);
    }
    const meta = {
      objectId: marker.objectId ?? null,
      nodeId: marker.nodeId ?? null,
      modelId,
      marker: marker.kind,
      fallback: !!marker.fallback,
      status: statusKey ?? null,
      ghost,
      groupKind,
    };
    const shared = {
      chunkId,
      position: pos,
      quaternion,
      colorMode: statusColored ? 'style' : 'fixed',
      styleKey: statusColored ? statusKey : null,
      fixedColorInt: baseColor,
      overridable,
    };
    emit(group, {
      ...shared,
      prim,
      scale: _scale.set(size, size, size),
      alphaKey,
      layerMode: isNode ? 'render' : 'both',
      pickable: !isNode,
      meta,
    });
    if (isNode) emitNodePickProxy(group, shared, marker, meta);
  }

  function buildModelRecords(visual, group, modelId, groupKind, allowedChunks) {
    if (!visual) return;
    for (const [index, seg] of (visual.segments ?? []).entries()) {
      const chunkId = `${modelId}:segments:${Math.floor(index / SCENE_CHUNK_SIZE)}`;
      if (allowedChunks && !allowedChunks.has(chunkId)) continue;
      const status = groupKind === 'ghostModel' ? null : statusByObjectId.get(seg.objectId);
      const ghost = groupKind !== 'ghostModel' && modelId === 'source'
        && (!status || ['MATCHED_UNCHANGED', 'PROPERTY_CHANGED', 'GEOMETRY_CHANGED'].includes(status));
      const style = styleOf(ghost ? 'GHOST' : (status ?? 'GHOST'));
      const alphaKey = groupKind === 'ghostModel' ? 'proposal' : ghost ? 'ghost' : style.alpha < 1 ? `a${style.alpha}` : 'solid';
      // Statusless target segments honor an explicit per-segment color
      // (restraint family tints etc.); diff statuses always win when present.
      const explicitColor = Number.isFinite(seg.colorInt) && !ghost && !status && groupKind !== 'ghostModel';
      segmentRecords(group, seg, {
        chunkId,
        alphaKey,
        colorMode: groupKind === 'ghostModel' || explicitColor ? 'fixed' : 'style',
        styleKey: ghost ? 'GHOST' : (status ?? 'GHOST'),
        fixedColorInt: Number.isFinite(seg.colorInt) ? seg.colorInt : GHOST_PROPOSAL_COLOR,
        overridable: !ghost,
        meta: {
          objectId: seg.objectId ?? null,
          nodeId: null,
          modelId,
          kind: seg.kind,
          pathId: seg.pathId,
          status: status ?? null,
          ghost,
          groupKind,
        },
      });
    }
    for (const [index, marker] of (visual.markers ?? []).entries()) {
      const chunkId = `${modelId}:markers:${Math.floor(index / SCENE_CHUNK_SIZE)}`;
      if (allowedChunks && !allowedChunks.has(chunkId)) continue;
      markerRecord(group, marker, modelId, marker.objectId ? statusByObjectId.get(marker.objectId) : null, groupKind, chunkId);
    }
  }

  function buildConnectorHandleRecords() {
    for (let i = 0; i < connectorRecords.length; i += 1) {
      const rec = connectorRecords[i];
      for (const [point, endpointId] of [[rec.from, rec.connector.sourceObjectId], [rec.to, rec.connector.targetObjectId]]) {
        emit(connectorGroup, {
          chunkId: 'connector:handles:0',
          prim: 'SPH',
          position: point,
          quaternion: null,
          scale: _scale.set(26, 26, 26),
          alphaKey: 'solid',
          colorMode: 'fixed',
          fixedColorInt: rec.colorInt,
          overridable: false,
          meta: { objectId: endpointId ?? null, nodeId: null, modelId: 'connector', connector: rec.connector, connectorIndex: i, groupKind: 'connector' },
        });
      }
    }
  }

  function releaseBatch(batch, recyclePickIds) {
    batch.group.remove(batch.mesh);
    batch.mesh.geometry.dispose();
    batch.mesh.dispose?.();
    if (!recyclePickIds) return;
    for (const record of batch.records) {
      if (!record.pickId) continue;
      pickTable[record.pickId] = null;
      freePickIds.push(record.pickId);
    }
  }

  function disposeBatches() {
    for (const batch of batches) releaseBatch(batch, false);
    batches = [];
    pickTable = [null];
    freePickIds = [];
  }

  function materializePendingRecords() {
    for (const bucket of pendingRecords.values()) {
      const count = bucket.records.length;
      const geometry = unitGeometry(bucket.prim).clone();
      const pickAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
      geometry.setAttribute('pickColor', pickAttr);
      const mesh = new THREE.InstancedMesh(geometry, batchMaterial(bucket.alphaKey), count);
      mesh.frustumCulled = false;
      mesh.layers.enable(PICK_LAYER);
      if (bucket.layerMode === 'render') mesh.layers.disable(PICK_LAYER);
      if (bucket.layerMode === 'pick') mesh.layers.disable(0);
      for (let i = 0; i < count; i += 1) {
        const record = bucket.records[i];
        record.batch = mesh;
        record.index = i;
        picker.encodeId(record.pickId, pickAttr.array, i * 3);
      }
      mesh.userData.records = bucket.records;
      bucket.group.add(mesh);
      batches.push({ mesh, records: bucket.records, group: bucket.group, chunkId: bucket.chunkId });
    }
    pendingRecords = null;
  }

  function applyGroupOrigins() {
    const translation = new THREE.Vector3(...(models.registrationTranslation ?? [0, 0, 0]));
    sourceGroup.position.copy(translation).sub(sceneOrigin);
    for (const group of [targetGroup, ghostGroup, connectorGroup, transientGroup, measurementGroup]) group.position.copy(sceneOrigin).multiplyScalar(-1);
  }

  function rebuild() {
    disposeBatches();
    pendingRecords = new Map();
    buildModelRecords(models.source, sourceGroup, 'source', 'model', null);
    buildModelRecords(models.target, targetGroup, 'target', 'model', null);
    buildModelRecords(ghostModel, ghostGroup, 'ghost', 'ghostModel', null);
    buildConnectorHandleRecords();
    materializePendingRecords();
    applyGroupOrigins();
    refreshInstanceStates();
    rebuildConnectorLines();
    fullRebuildCount += 1;
    completePendingFit();
    updateCameraClipPlanes();
    render();
  }

  function rebuildChangedChunks(chunkIds) {
    const changed = new Set(chunkIds);
    const retained = [];
    for (const batch of batches) {
      if (changed.has(batch.chunkId)) releaseBatch(batch, true);
      else retained.push(batch);
    }
    batches = retained;
    pendingRecords = new Map();
    buildModelRecords(models.source, sourceGroup, 'source', 'model', changed);
    buildModelRecords(models.target, targetGroup, 'target', 'model', changed);
    materializePendingRecords();
    applyGroupOrigins();
    refreshInstanceStates();
    incrementalRebuildCount += 1;
    completePendingFit();
    updateCameraClipPlanes();
    render();
  }

  // Coalesce state pushes (setModels + setStatuses + setStatusStyles arrive
  // back-to-back from the tabs) into a single geometry rebuild.
  let rebuildQueued = false;
  function invalidate() {
    if (rebuildQueued || disposed) return;
    rebuildQueued = true;
    queueMicrotask(() => {
      rebuildQueued = false;
      if (!disposed) rebuild();
    });
  }

  function recordVisible(record) {
    const meta = record.meta;
    if (meta.groupKind === 'ghostModel') return true;
    if (meta.groupKind === 'connector') return connectorVisible(meta.connector);
    if (isolation) {
      if (meta.objectId && !isolation.has(meta.objectId)) return false;
      if (!meta.objectId) return false;
    }
    if (mode === 'diff-only') {
      if (meta.modelId === 'source' && meta.ghost) return false;
      if (!meta.status || meta.status === 'MATCHED_UNCHANGED') return meta.modelId === 'target' ? false : !meta.ghost;
    }
    if (statusFilter && meta.status && !statusFilter.has(meta.status)) return false;
    if (statusFilter && !meta.status && !meta.marker) return false;
    return true;
  }

  function effectiveColorInt(record) {
    const meta = record.meta;
    let color;
    if (record.colorMode === 'fixed' && !record.overridable) {
      color = record.fixedColorInt;
    } else {
      const override = meta.objectId && record.overridable
        ? (transientRecolor?.get(meta.objectId) ?? colorOverrides?.get(meta.objectId))
        : undefined;
      if (override !== undefined && override !== null) color = override;
      else if (record.colorMode === 'style') color = styleOf(record.styleKey).colorInt;
      else color = record.fixedColorInt;
    }
    if (meta.objectId && selectedIds.has(meta.objectId)) {
      return 0xff00ff;
    }
    return color;
  }

  /** Write per-instance matrices + colors from record state. No geometry work. */
  function refreshInstanceStates() {
    for (const batch of batches) {
      const mesh = batch.mesh;
      for (let i = 0; i < batch.records.length; i += 1) {
        const record = batch.records[i];
        const visible = recordVisible(record);
        _pos.copy(record.position);
        if (record.quaternion) _quat.copy(record.quaternion); else _quat.identity();
        if (visible) _scale.copy(record.scale); else _scale.set(0, 0, 0);
        _mat4.compose(_pos, _quat, _scale);
        mesh.setMatrixAt(i, _mat4);
        mesh.setColorAt(i, _color.set(effectiveColorInt(record)));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    sourceGroup.visible = mode !== 'target-only';
  }

  // ── connector layer (renders ConnectorModel.v1 — never derives links) ──
  let connectorLines = []; // [{ line, records }] one per opacity bucket

  function connectorColor(connector) {
    if (connector.basis) return SCORE_BAND_COLORS.basis;
    if (connector.type === 'TRANSFER_CONNECTOR' && CONNECTOR_COLORS[connector.status]) return CONNECTOR_COLORS[connector.status];
    if (connector.type === 'MATCH_CONNECTOR') {
      const banded = scoreBandColor(connector.score);
      if (banded !== null) return banded;
      if (MATCH_CONFIDENCE_COLORS[connector.confidence]) return MATCH_CONFIDENCE_COLORS[connector.confidence];
    }
    return CONNECTOR_COLORS[connector.type] ?? 0xcbd5e1;
  }

  function connectorVisible(connector) {
    if (connectorMode === 'hidden') return false;
    if (connectorMode === 'selection') {
      if (!selectedObjectId) return false;
      return connector.sourceObjectId === selectedObjectId || connector.targetObjectId === selectedObjectId;
    }
    return connector.visibleModes.includes(connectorMode);
  }

  function disposeConnectorLines() {
    for (const entry of connectorLines) {
      connectorGroup.remove(entry.line);
      entry.line.geometry.dispose();
      entry.line.material.dispose();
    }
    connectorLines = [];
  }

  /** Merge visible connectors into one LineSegments per opacity bucket. */
  function rebuildConnectorLines() {
    disposeConnectorLines();
    const buckets = new Map(); // opacity -> { positions:[], colors:[], records:[] }
    for (const rec of connectorRecords) {
      if (!connectorVisible(rec.connector)) continue;
      const opacity = rec.connector.type === 'CANDIDATE_CONNECTOR' ? 0.55 : 0.9;
      let bucket = buckets.get(opacity);
      if (!bucket) { bucket = { positions: [], colors: [], records: [] }; buckets.set(opacity, bucket); }
      bucket.positions.push(rec.from.x, rec.from.y, rec.from.z, rec.to.x, rec.to.y, rec.to.z);
      _color.set(rec.colorInt);
      bucket.colors.push(_color.r, _color.g, _color.b, _color.r, _color.g, _color.b);
      bucket.records.push(rec);
    }
    for (const [opacity, bucket] of buckets) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(bucket.colors, 3));
      const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity }));
      line.userData.records = bucket.records;
      connectorGroup.add(line);
      connectorLines.push({ line, records: bucket.records });
    }
  }

  function applyConnectorVisibility() {
    rebuildConnectorLines();
    refreshInstanceStates();
  }

  function updateCameraAspect(cam, aspect) {
    if (cam.isPerspectiveCamera) {
      cam.aspect = aspect;
    } else {
      const frustumSize = (cam.top - cam.bottom) || (2 * Math.tan((55 * Math.PI) / 360) * controls.target.distanceTo(cam.position));
      cam.left = -frustumSize * aspect / 2;
      cam.right = frustumSize * aspect / 2;
    }
    cam.updateProjectionMatrix();
  }

  // ── render loop (on-demand; rAF with timeout fallback so throttled or
  //    occluded tabs still paint) ─────────────────────────────────────────
  let renderQueued = false;
  function render() {
    if (renderQueued || disposed) return;
    renderQueued = true;
    let ran = false;
    const run = () => {
      if (ran) return;
      ran = true;
      renderQueued = false;
      if (disposed) return;
      const width = host.clientWidth || 800;
      const height = host.clientHeight || 480;
      renderer.setSize(width, height, false);
      if (mode === 'side-by-side') {
        renderer.setScissorTest(true);
        updateCameraAspect(camera, (width / 2) / height);
        // left: source only
        targetGroup.visible = false; sourceGroup.visible = true;
        renderer.setViewport(0, 0, width / 2, height);
        renderer.setScissor(0, 0, width / 2, height);
        renderer.render(scene, camera);
        renderAxisCompass(0, 0);
        // right: target only
        sourceGroup.visible = false; targetGroup.visible = true;
        renderer.setViewport(width / 2, 0, width / 2, height);
        renderer.setScissor(width / 2, 0, width / 2, height);
        renderer.render(scene, camera);
        renderAxisCompass(width / 2, 0);
        sourceGroup.visible = true;
        renderer.setScissorTest(false);
      } else {
        updateCameraAspect(camera, width / height);
        renderer.setViewport(0, 0, width, height);
        renderer.render(scene, camera);
        renderAxisCompass(0, 0);
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    setTimeout(run, 50);
  }

  const picker = createGpuPicker(THREE, renderer);

  /**
   * GPU pick at client coordinates. Handles the side-by-side split (each half
   * is its own view of the shared camera). Returns { record, point } or null.
   */
  function gpuPickAt(clientX, clientY) {
    if (disposed) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const width = host.clientWidth || 800;
    const height = host.clientHeight || 480;
    let x = (clientX - rect.left) * (width / Math.max(rect.width, 1));
    const y = (clientY - rect.top) * (height / Math.max(rect.height, 1));
    let viewWidth = width;
    let hiddenGroup = null;
    if (mode === 'side-by-side') {
      viewWidth = width / 2;
      if (x < viewWidth) hiddenGroup = targetGroup;
      else { hiddenGroup = sourceGroup; x -= viewWidth; }
    }
    const prevAspect = camera.aspect || (host.clientWidth / host.clientHeight);
    updateCameraAspect(camera, viewWidth / height);
    const prevHiddenVisible = hiddenGroup ? hiddenGroup.visible : true;
    if (hiddenGroup) hiddenGroup.visible = false;
    let id = 0;
    try {
      if (mode !== 'side-by-side' && sourceGroup.visible) {
        // Two-phase pick: the ghosted source renders in the transparent list
        // (after opaque) and would win depth ties against the target it
        // duplicates, so prefer target/ghost-proposal hits first.
        sourceGroup.visible = false;
        id = picker.pick(scene, camera, x, y, viewWidth, height);
        sourceGroup.visible = true;
        if (!id) id = picker.pick(scene, camera, x, y, viewWidth, height);
      } else {
        id = picker.pick(scene, camera, x, y, viewWidth, height);
      }
    } finally {
      if (hiddenGroup) hiddenGroup.visible = prevHiddenVisible;
      updateCameraAspect(camera, prevAspect);
    }
    const record = pickTable[id] ?? null;
    if (!record) return null;
    const point = record.position.clone();
    if (record.batch?.parent) point.add(record.batch.parent.position);
    point.add(sceneOrigin);
    return { record, point };
  }

  // Cursor-anchored zoom: reuse the last anchor during a wheel burst so we
  // don't run a pick per wheel tick.
  let zoomAnchor = null;
  let zoomAnchorAt = 0;
  function getZoomAnchor(event) {
    const now = Date.now();
    if (!zoomAnchor || now - zoomAnchorAt > 150) {
      const hit = gpuPickAt(event.clientX, event.clientY);
      zoomAnchor = hit ? hit.point.clone().sub(sceneOrigin) : null;
    }
    zoomAnchorAt = now;
    return zoomAnchor;
  }

  const navigationHistory = [];
  let controls;
  let gestureStartState = null;
  let lastGoodNavigationState = null;
  let recoveringNavigation = false;

  function captureNavigationState() {
    const origin = sceneOrigin.toArray();
    return createViewerNavigationState({
      cameraPositionWorld: viewToWorldCoordinates(camera.position.toArray(), origin),
      cameraTargetWorld: viewToWorldCoordinates(controls.target.toArray(), origin),
      pivotWorld: controls.pivot ? viewToWorldCoordinates(controls.pivot.toArray(), origin) : null,
      cameraType: activeCameraType, verticalAxis,
      projectionScale: camera.isOrthographicCamera ? camera.zoom : camera.fov,
    });
  }

  function updateCameraClipPlanes() {
    const box = boundsOf(null);
    if (!box) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const distance = camera.position.distanceTo(sphere.center);
    camera.near = Math.max(0.1, distance - sphere.radius * 2);
    camera.far = Math.max(camera.near + 1000, distance + sphere.radius * 2, 10000);
    camera.updateProjectionMatrix();
  }

  function chooseCameraForState(state) {
    activeCameraType = state.cameraType;
    camera = activeCameraType === 'Orthographic' ? orthoCamera : perspCamera;
    camera.up.set(0, state.verticalAxis === 'Z' ? 0 : 1, state.verticalAxis === 'Z' ? 1 : 0);
    axisCamera.up.copy(camera.up);
    if (camera.isOrthographicCamera) camera.zoom = state.projectionScale;
    else camera.fov = state.projectionScale;
    camera.updateProjectionMatrix();
  }

  function restoreNavigationState(state) {
    const errors = validateViewerNavigationState(state);
    if (errors.length) throw new TypeError(`Cannot restore viewer navigation: ${errors.join('; ')}`);
    verticalAxis = state.verticalAxis;
    chooseCameraForState(state);
    const origin = sceneOrigin.toArray();
    const position = new THREE.Vector3(...worldToViewCoordinates(state.cameraPositionWorld, origin));
    const target = new THREE.Vector3(...worldToViewCoordinates(state.cameraTargetWorld, origin));
    const pivot = state.pivotWorld ? new THREE.Vector3(...worldToViewCoordinates(state.pivotWorld, origin)) : null;
    controls.setPivot(pivot);
    controls.setViewInstant(position, target);
  }

  function rememberNavigationState(state) {
    if (!state) return;
    const previous = navigationHistory.at(-1);
    if (!previous || !sameViewerNavigationState(previous, state, 1e-6)) navigationHistory.push(state);
    if (navigationHistory.length > 20) navigationHistory.shift();
  }

  function reportNavigationFailure(error) {
    const wrapped = new Error(`Viewer navigation recovered: ${error.message}`, { cause: error });
    if (typeof onNavigationError === 'function') onNavigationError(wrapped);
    else console.error(wrapped);
  }

  function onNavigationChange() {
    if (!controls) return;
    try {
      const state = captureNavigationState();
      if (camera.position.distanceTo(controls.target) < 0.01) throw new RangeError('Camera target distance is too small.');
      updateCameraClipPlanes();
      lastGoodNavigationState = state;
    } catch (error) {
      if (!recoveringNavigation && lastGoodNavigationState) {
        recoveringNavigation = true;
        try { restoreNavigationState(lastGoodNavigationState); } finally { recoveringNavigation = false; }
      }
      reportNavigationFailure(error);
      return;
    }
    pivotMarker.visible = Boolean(controls.pivot);
    if (controls.pivot) pivotMarker.position.copy(controls.pivot);
    render();
    onCameraChange?.();
  }

  function onNavigationGestureStart() {
    gestureStartState = controls ? captureNavigationState() : null;
  }

  function onNavigationGestureEnd(changed, cancelled) {
    if (cancelled && gestureStartState) restoreNavigationState(gestureStartState);
    else if (changed) rememberNavigationState(gestureStartState);
    gestureStartState = null;
  }

  controls = createWorkbenchNavigationControls({
    THREE, getCamera: () => camera, dom: renderer.domElement, getVerticalAxis: () => verticalAxis,
    onChange: onNavigationChange, getZoomAnchor,
    onGestureStart: onNavigationGestureStart, onGestureEnd: onNavigationGestureEnd,
    navigationPreset: effectiveNavigationPreset,
  });
  lastGoodNavigationState = captureNavigationState();

  function applySceneOrigin(origin, preserveView) {
    const next = new THREE.Vector3(...origin);
    if (preserveView) {
      const shift = sceneOrigin.clone().sub(next);
      camera.position.add(shift);
      controls.target.add(shift);
      controls.pivot?.add(shift);
      controls.syncFromCamera();
    }
    sceneOrigin.copy(next);
  }

  function acceptRuntimeSnapshot(snapshot) {
    const changedChunkIds = diffSceneChunks(sceneRuntime?.chunks, snapshot.chunks);
    const preserveView = sceneRuntime !== null;
    models = pendingModels;
    applySceneOrigin(snapshot.origin, preserveView);
    sceneRuntime = { ...snapshot, changedChunkIds };
    if (changedChunkIds.length) rebuildChangedChunks(changedChunkIds);
    else {
      skippedRebuildCount += 1;
      applyGroupOrigins();
      completePendingFit();
      updateCameraClipPlanes();
      render();
    }
  }

  function reportRuntimeError(error) {
    runtimeError = error.message;
    if (typeof onRuntimeError === 'function') onRuntimeError(error);
    else queueMicrotask(() => { throw error; });
  }

  const sceneWorker = new Worker(new URL('./scene-derivation-worker.js', import.meta.url), { type: 'module', name: 'workbench-scene-derivation' });
  const sceneScheduler = createSceneDerivationScheduler(sceneWorker, acceptRuntimeSnapshot, reportRuntimeError);

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(render) : null;
  resizeObserver?.observe(host);

  // ── picking events ───────────────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  raycaster.params.Line = { threshold: 40 };
  const pointer = new THREE.Vector2();

  function pointerToNdc(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    let x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    if (mode === 'side-by-side') x = (x < 0 ? (x + 0.5) : (x - 0.5)) * 2;
    return [x, y];
  }

  function connectorAt(event) {
    if (!connectorLines.length) return null;
    pointer.set(...pointerToNdc(event));
    raycaster.setFromCamera(pointer, camera);
    for (const entry of connectorLines) {
      const hit = raycaster.intersectObject(entry.line, false)[0];
      if (hit) {
        const segmentIndex = Math.floor((hit.index ?? 0) / 2);
        const rec = entry.records[segmentIndex];
        if (rec) return rec.connector;
      }
    }
    return null;
  }

  // Hover — connector and object hits go to the host UI as tooltip data.
  let hoverThrottle = 0;
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (!onHoverConnector && !onHoverObject) return;
    const now = Date.now();
    if (now - hoverThrottle < 33) return;
    hoverThrottle = now;
    if (onHoverConnector) {
      const connector = connectorAt(event);
      onHoverConnector(connector, event);
      if (connector) { if (onHoverObject) onHoverObject(null, event); return; }
    }
    if (onHoverObject) {
      const hit = gpuPickAt(event.clientX, event.clientY);
      const meta = hit?.record.meta;
      if (meta?.connector) {
        if (onHoverConnector) onHoverConnector(meta.connector, event);
        onHoverObject(null, event);
        return;
      }
      onHoverObject(meta ? { ...meta } : null, event);
    }
  });
  let downAt = null;
  let lastClick = { at: 0, objectId: '' };
  renderer.domElement.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('click', (event) => {
    if (downAt && Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) > 5) return; // drag, not click

    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = rect.bottom - event.clientY;
    let inGizmo = false;
    let viewWidth = host.clientWidth || 800;
    if (mode === 'side-by-side') {
      viewWidth = viewWidth / 2;
      const xRight = x - viewWidth;
      if (x > 10 && x < 74 && y > 10 && y < 74) inGizmo = true;
      if (xRight > 10 && xRight < 74 && y > 10 && y < 74) inGizmo = true;
    } else {
      if (x > 10 && x < 74 && y > 10 && y < 74) inGizmo = true;
    }

    if (inGizmo) {
      const gizmoX = mode === 'side-by-side' && x > viewWidth ? x - viewWidth : x;
      const ndcX = ((gizmoX - 10) / 64) * 2 - 1;
      const ndcY = ((y - 10) / 64) * 2 - 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), axisCamera);
      const intersects = raycaster.intersectObjects(axisScene.children, true);
      if (intersects.length > 0) {
        let clicked = null;
        intersects[0].object.traverseAncestors(a => {
           if (a === letterX) clicked = 'side';
           if (a === letterY) clicked = verticalAxis === 'Z' ? 'front' : 'top';
           if (a === letterZ) clicked = verticalAxis === 'Z' ? 'top' : 'front';
        });
        if (intersects[0].object === letterX) clicked = 'side';
        if (intersects[0].object === letterY) clicked = verticalAxis === 'Z' ? 'front' : 'top';
        if (intersects[0].object === letterZ) clicked = verticalAxis === 'Z' ? 'top' : 'front';
        if (clicked) {
          api.setStandardView(clicked);
          return;
        }
      }
    }

    const hit = gpuPickAt(event.clientX, event.clientY);
    if (hit) {
      const now = Date.now();
      const objectId = String(hit.record.meta.objectId ?? '');
      if (objectId && lastClick.objectId === objectId && now - lastClick.at < 300) {
        rememberNavigationState(captureNavigationState());
        const localPoint = hit.point.clone().sub(sceneOrigin);
        controls.setPivot(localPoint);
        controls.setView(camera.position.clone(), localPoint);
      }
      lastClick = { at: now, objectId };
      if (onPick) {
        const meta = hit.record.meta;
        onPick({
          objectId: meta.objectId ?? null,
          nodeId: meta.nodeId ?? null,
          modelId: meta.modelId,
          status: meta.status ?? null,
          connector: meta.connector ?? null,
          point: hit.point.toArray(),
        });
      }
    } else {
      if (onPick) onPick(null);
    }
  });

  // 'F' fits the current selection (or everything) while the cursor is over
  // the canvas — matches common CAD viewers.
  const onKeyDown = (event) => {
    if (!renderer.domElement.matches(':hover')) return;
    const key = event.key.toLowerCase();
    if (!['f', 'h', 'p', 'backspace'].includes(key)) return;
    event.preventDefault();
    if (key === 'f' && event.shiftKey) api.fitAll();
    else if (key === 'f') api.fitSelection();
    else if (key === 'h') api.fitAll();
    else if (key === 'p') api.togglePivotToSelection();
    else api.previousView();
  };
  window.addEventListener('keydown', onKeyDown);

  function boundsOf(ids) {
    const box = new THREE.Box3();
    let any = false;
    for (const batch of batches) {
      if (batch.group !== sourceGroup && batch.group !== targetGroup) continue;
      for (const record of batch.records) {
        if (!record.meta.objectId) continue;
        if (record.meta.pickProxy) continue;
        if (ids && !ids.has(record.meta.objectId)) continue;
        const extent = Math.max(record.scale.x, record.scale.y, record.scale.z);
        _pos.copy(record.position).add(batch.group.position);
        box.expandByPoint(_pos.clone().addScalar(extent));
        box.expandByPoint(_pos.clone().addScalar(-extent));
        any = true;
      }
    }
    return any ? box : null;
  }

  function fitBox(box) {
    if (!box) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length() || 1000;
    const dir = new THREE.Vector3(...(verticalAxis === 'Z' ? [1, 1, 0.8] : [1, 0.8, 1])).normalize();
    controls.setView(center.clone().add(dir.multiplyScalar(size * 0.9 + 200)), center);
  }

  function completePendingFit() {
    if (!pendingFit) return;
    const box = boundsOf(null);
    if (!box) return;
    pendingFit = false;
    fitBox(box);
  }

  // ── transient overlay (drag previews, rubber bands) — cheap plain meshes ─
  let transientObjects = [];
  function clearTransient() {
    for (const obj of transientObjects) {
      transientGroup.remove(obj);
      obj.geometry?.dispose?.();
      obj.material?.dispose?.();
    }
    transientObjects = [];
  }

  let measurementObjects = [];
  function clearMeasurement() {
    for (const object of measurementObjects) {
      measurementGroup.remove(object);
      object.geometry?.dispose?.();
      object.material?.dispose?.();
    }
    measurementObjects = [];
  }

  function rebuildMeasurement(points) {
    clearMeasurement();
    const vectors = (points ?? []).filter((point) => Array.isArray(point) && point.length === 3)
      .map((point) => new THREE.Vector3(...point.map(Number))).filter((point) => [point.x, point.y, point.z].every(Number.isFinite));
    if (vectors.length > 1) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(vectors), new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false }));
      line.renderOrder = 20;
      measurementGroup.add(line);
      measurementObjects.push(line);
    }
    if (vectors.length) {
      const markers = new THREE.Points(new THREE.BufferGeometry().setFromPoints(vectors), new THREE.PointsMaterial({ color: 0xffd166, size: 8, sizeAttenuation: false, depthTest: false }));
      markers.renderOrder = 21;
      measurementGroup.add(markers);
      measurementObjects.push(markers);
    }
    render();
  }

  function applyVerticalAxis(axis) {
    verticalAxis = normalizeVerticalAxis(axis);
    const up = verticalAxis === 'Z' ? [0, 0, 1] : [0, 1, 0];
    for (const viewCamera of [camera, perspCamera, orthoCamera, axisCamera]) viewCamera.up.set(...up);
    controls.syncFromCamera();
    render();
  }

  function standardViewDirection(view) {
    const zUp = {
      top: [0, 0.001, 1], bottom: [0, -0.001, -1], front: [0, 1, 0.001], back: [0, -1, 0.001],
      right: [1, 0.001, 0], side: [1, 0.001, 0], left: [-1, 0.001, 0], iso: [1, 1, 0.8],
    };
    const yUp = {
      top: [0, 1, 0.001], bottom: [0, -1, 0.001], front: [0, 0.001, 1], back: [0, 0.001, -1],
      right: [1, 0.001, 0], side: [1, 0.001, 0], left: [-1, 0.001, 0], iso: [1, 0.8, 1],
    };
    const directions = verticalAxis === 'Z' ? zUp : yUp;
    return new THREE.Vector3(...(directions[view] ?? directions.iso)).normalize();
  }

  const api = {
    /**
     * Move the canvas into a freshly rendered host element. The tab re-renders
     * its HTML on file load; without this the canvas stays parented to dead DOM
     * and the viewer area shows blank.
     */
    reattach(nextHost) {
      if (!nextHost || nextHost === host || disposed) return;
      resizeObserver?.disconnect();
      host = nextHost;
      host.appendChild(renderer.domElement);
      resizeObserver?.observe(host);
      render();
    },
    setModels(next) {
      pendingModels = { ...pendingModels, ...next };
      runtimeError = null;
      sceneScheduler.request(pendingModels);
    },
    setStatuses(map) {
      statusByObjectId = map instanceof Map ? map : new Map(Object.entries(map ?? {}));
      invalidate();
    },
    setMode(nextMode) { mode = nextMode; refreshInstanceStates(); render(); },
    getMode() { return mode; },
    /**
     * Apply effective status styles ({ STATUS: { colorInt, alpha } }).
     * Alpha changes move records between opacity batches, so this rebuilds.
     */
    setStatusStyles(styles) {
      activeStyles = styles ?? null;
      invalidate();
    },
    /** Map<objectId, colorInt> (e.g. heatmap) — overrides status colors. */
    setColorOverrides(map) {
      colorOverrides = map instanceof Map && map.size ? map : null;
      refreshInstanceStates();
      render();
    },
    /**
     * Ghost proposal model (VisualGeometryModel.v1 or null) — rendered
     * translucent cyan on top of everything and pickable, for fix previews.
     */
    setGhostModel(model) {
      ghostModel = model ?? null;
      invalidate();
    },
    /**
     * Incremental per-object updates without a geometry rebuild.
     * patch: { recolor?: Map<objectId, colorInt>|null }.
     */
    updateObjects(patch) {
      if (patch && 'recolor' in patch) {
        const map = patch.recolor;
        transientRecolor = map instanceof Map && map.size ? map : null;
      }
      refreshInstanceStates();
      render();
    },
    get camera() { return camera; },
    get activeCameraType() { return activeCameraType; },
    get navigationPreset() { return effectiveNavigationPreset; },
    captureNavigationState,
    restoreNavigationState,
    acquireNavigationLock(owner) { return controls.acquireLock(owner); },
    previousView() {
      const previous = navigationHistory.pop();
      if (!previous) return false;
      restoreNavigationState(previous);
      return true;
    },
    toggleCameraType() {
      rememberNavigationState(captureNavigationState());
      const distance = controls.target.distanceTo(camera.position);
      const aspect = (host.clientWidth || 800) / (host.clientHeight || 480);
      if (activeCameraType === 'Perspective') {
        const frustumSize = 2 * Math.tan((perspCamera.fov * Math.PI) / 360) * distance;
        orthoCamera.left = -frustumSize * aspect / 2;
        orthoCamera.right = frustumSize * aspect / 2;
        orthoCamera.top = frustumSize / 2;
        orthoCamera.bottom = -frustumSize / 2;
        orthoCamera.position.copy(perspCamera.position);
        orthoCamera.quaternion.copy(perspCamera.quaternion);
        orthoCamera.zoom = 1;
        orthoCamera.updateProjectionMatrix();
        camera = orthoCamera;
        activeCameraType = 'Orthographic';
      } else {
        perspCamera.position.copy(orthoCamera.position);
        perspCamera.quaternion.copy(orthoCamera.quaternion);
        const frustumSize = orthoCamera.top - orthoCamera.bottom;
        const targetDist = frustumSize / (2 * Math.tan((perspCamera.fov * Math.PI) / 360) * orthoCamera.zoom);
        const dir = new THREE.Vector3(0,0,1).applyQuaternion(orthoCamera.quaternion);
        perspCamera.position.copy(controls.target).add(dir.multiplyScalar(targetDist));
        perspCamera.aspect = aspect;
        perspCamera.updateProjectionMatrix();
        camera = perspCamera;
        activeCameraType = 'Perspective';
      }
      controls.apply();
    },
    get controls() { return controls; },
    /**
     * Overlay transient geometry (cleared by the next setTransient or clearTransient call).
     * @param {{ lines?: [{ points: [[x,y,z], ...], colorInt? }],
     *            spheres?: [{ position: [x,y,z], radiusMm?, colorInt? }] } | null} overlay
     */
    setTransient(overlay) {
      clearTransient();
      if (overlay) {
        for (const spec of overlay.lines ?? []) {
          const pts = (spec.points ?? []).map((p) => new THREE.Vector3(...p));
          if (pts.length < 2) continue;
          const geometry = new THREE.BufferGeometry().setFromPoints(pts);
          const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: spec.colorInt ?? 0x38bdf8, transparent: true, opacity: 0.9, depthTest: false }));
          line.renderOrder = 10;
          transientGroup.add(line);
          transientObjects.push(line);
        }
        for (const spec of overlay.spheres ?? []) {
          const geometry = new THREE.SphereGeometry(Math.max(Number(spec.radiusMm) || 26, 4), 12, 10);
          const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: spec.colorInt ?? 0x38bdf8, transparent: true, opacity: 0.85, depthTest: false }));
          mesh.position.set(...spec.position);
          mesh.renderOrder = 10;
          transientGroup.add(mesh);
          transientObjects.push(mesh);
        }
      }
      render();
    },
    /** Persistent click-to-measure overlay; lengths are calculated by the caller. */
    setMeasurement(points) { rebuildMeasurement(points); },
    /** Project a world [x,y,z] to canvas pixel coords (null when behind camera). */
    worldToScreen(xyz) {
      const v = new THREE.Vector3(...xyz).sub(sceneOrigin).project(camera);
      if (v.z > 1) return null;
      const width = host.clientWidth || 800;
      const height = host.clientHeight || 480;
      return { x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height };
    },
    /** Alias of worldToScreen — HTML overlay anchoring. */
    projectPoint(xyz) { return this.worldToScreen(xyz); },
    /**
     * Project a world [x,y,z] into one pane of the canvas. In side-by-side
     * mode 'source' maps into the left half and 'target' into the right half
     * (the scissor split shares one camera, so NDC just re-maps per pane);
     * otherwise identical to worldToScreen. Null when behind the camera.
     */
    projectPointForPane(xyz, pane = 'full') {
      const v = new THREE.Vector3(...xyz).sub(sceneOrigin).project(camera);
      if (v.z > 1) return null;
      const width = host.clientWidth || 800;
      const height = host.clientHeight || 480;
      const y = (1 - v.y) / 2 * height;
      if (pane === 'full' || mode !== 'side-by-side') return { x: (v.x + 1) / 2 * width, y };
      const half = width / 2;
      return { x: (v.x + 1) / 2 * half + (pane === 'target' ? half : 0), y };
    },
    /** World-space ray under the given client coordinates (drag-plane math). */
    screenRay(clientX, clientY) {
      pointer.set(...pointerToNdc({ clientX, clientY }));
      raycaster.setFromCamera(pointer, camera);
      return { origin: raycaster.ray.origin.clone().add(sceneOrigin).toArray(), direction: raycaster.ray.direction.toArray() };
    },
    /** Orbit the camera by finite azimuth and polar radians. */
    orbitBy(theta, phi) {
      const azimuth = Number(theta), polar = Number(phi);
      if (!Number.isFinite(azimuth) || !Number.isFinite(polar)) throw new RangeError('Orbit angles must be finite radians.');
      rememberNavigationState(captureNavigationState());
      controls.orbitBy(azimuth, polar);
    },
    /** Dolly by a factor (>1 zooms out). */
    zoomBy(factor) {
      const parsed = Number(factor);
      if (!Number.isFinite(parsed) || parsed <= 0) throw new RangeError(`Zoom factor must be positive; received ${factor}.`);
      rememberNavigationState(captureNavigationState());
      controls.zoomBy(parsed);
    },
    /** Pick whatever is under the given client coordinates (GPU ID pass). */
    pickAt(clientX, clientY) {
      const hit = gpuPickAt(clientX, clientY);
      if (!hit) return null;
      const meta = hit.record.meta;
      return {
        objectId: meta.objectId ?? null,
        nodeId: meta.nodeId ?? null,
        modelId: meta.modelId,
        status: meta.status ?? null,
        marker: meta.marker ?? null,
        kind: meta.kind ?? null,
        connector: meta.connector ?? null,
        point: hit.point.toArray(),
      };
    },
    /** Render ConnectorModel.v1 connectors (viewer never derives links itself). */
    setConnectors(connectorModel) {
      connectorRecords = (connectorModel?.connectors ?? []).map((connector) => ({
        connector,
        from: new THREE.Vector3(...connector.from),
        to: new THREE.Vector3(...connector.to),
        colorInt: connectorColor(connector),
      }));
      invalidate();
    },
    /** 'hidden' | 'selection' | 'matches' | 'candidates' | 'conflicts' | 'transfer' | 'registration' */
    setConnectorMode(nextMode) {
      connectorMode = nextMode;
      applyConnectorVisibility();
      render();
    },
    /**
     * Select an object: highlight it plus its related ids (matched counterpart,
     * transfer receiver) and reveal its connectors in 'selection' mode.
     */
    setSelection(objectId, relatedIds = []) {
      selectedObjectId = objectId ?? null;
      selectedIds = new Set(objectId ? [objectId, ...relatedIds] : []);
      applyConnectorVisibility();
      render();
    },
    getStateSnapshot() {
      return {
        contract: 'ViewerStateSnapshot.v1',
        mode,
        connectorMode,
        cameraPosition: camera.position.toArray(),
        cameraTarget: controls.target.toArray(),
        sourceOpacity,
        statusFilter: statusFilter ? [...statusFilter] : [],
        isolation: isolation ? [...isolation] : [],
        selectedObjectId,
        runtimeRevision: sceneRuntime?.revision ?? null,
        runtimePending: sceneScheduler.getState().pending,
        runtimeError,
        floatingOrigin: sceneOrigin.toArray(),
        lod: sceneRuntime?.lod.level ?? null,
        sceneChunkCount: sceneRuntime?.chunks.length ?? 0,
        changedChunkCount: sceneRuntime?.changedChunkIds.length ?? 0,
        spatialEntryCount: sceneRuntime?.spatialIndex.entries.length ?? 0,
        fullRebuildCount,
        incrementalRebuildCount,
        skippedRebuildCount,
        connectorCount: connectorRecords.length,
        visibleConnectorCount: connectorRecords.filter((rec) => connectorVisible(rec.connector)).length,
        instanceCount: batches.reduce((sum, batch) => sum + batch.records.length, 0),
        drawBatchCount: batches.length,
        navigationState: captureNavigationState(),
        navigationHistoryCount: navigationHistory.length,
      };
    },
    setSourceOpacity(value) {
      sourceOpacity = Math.max(0.05, Math.min(1, Number(value)));
      const ghostMat = batchMaterials.get('ghost');
      if (ghostMat) { ghostMat.opacity = sourceOpacity; ghostMat.needsUpdate = true; }
      render();
    },
    setStatusFilter(statuses) {
      statusFilter = statuses && statuses.size ? new Set(statuses) : null;
      refreshInstanceStates(); render();
    },
    isolate(objectIds) {
      isolation = objectIds && objectIds.size ? new Set(objectIds) : null;
      refreshInstanceStates(); render();
      if (isolation) fitBox(boundsOf(isolation));
    },
    fitAll() {
      rememberNavigationState(captureNavigationState());
      const box = boundsOf(null);
      if (box) fitBox(box); else pendingFit = true;
    },
    fitObject(objectId) {
      const box = boundsOf(new Set([objectId]));
      if (box) { rememberNavigationState(captureNavigationState()); fitBox(box); }
    },
    fitSelection() {
      const box = selectedIds.size ? boundsOf(selectedIds) : boundsOf(null);
      if (box) { rememberNavigationState(captureNavigationState()); fitBox(box); }
    },
    setPivotWorld(point) {
      rememberNavigationState(captureNavigationState());
      const local = point ? new THREE.Vector3(...worldToViewCoordinates(point, sceneOrigin.toArray())) : null;
      controls.setPivot(local);
    },
    setPivotToSelection() {
      rememberNavigationState(captureNavigationState());
      if (!selectedIds.size) { controls.setPivot(null); return; }
      const box = boundsOf(selectedIds);
      if (box) controls.setPivot(box.getCenter(new THREE.Vector3()));
    },
    togglePivotToSelection() {
      rememberNavigationState(captureNavigationState());
      if (controls.pivot || !selectedIds.size) { controls.setPivot(null); return; }
      const box = boundsOf(selectedIds);
      if (box) controls.setPivot(box.getCenter(new THREE.Vector3()));
    },
    querySpatial(bounds) {
      if (!sceneRuntime) throw new Error('Scene spatial index is not ready.');
      return querySceneSpatialIndex(sceneRuntime.spatialIndex, bounds);
    },
    setVerticalAxis(axis) {
      const nextAxis = normalizeVerticalAxis(axis);
      if (verticalAxis === nextAxis) return;
      applyVerticalAxis(nextAxis);
    },
    alignToVerticalAxis(axis) {
      const nextAxis = normalizeVerticalAxis(axis);
      if (verticalAxis === nextAxis) return;
      rememberNavigationState(captureNavigationState());
      const target = controls.target.clone();
      const distance = Math.max(camera.position.distanceTo(target), 1);
      applyVerticalAxis(nextAxis);
      controls.setView(target.clone().add(standardViewDirection('iso').multiplyScalar(distance)), target);
    },
    setStandardView(view) {
      const box = boundsOf(null);
      if (!box) return;
      rememberNavigationState(captureNavigationState());
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length() || 1000;
      controls.setView(center.clone().add(standardViewDirection(view).multiplyScalar(size * 0.95 + 200)), center);
    },
    render,
    dispose() {
      disposed = true;
      window.removeEventListener('keydown', onKeyDown);
      resizeObserver?.disconnect();
      controls.dispose();
      sceneScheduler.dispose();
      disposeBatches();
      disposeConnectorLines();
      clearTransient();
      clearMeasurement();
      for (const mat of batchMaterials.values()) mat.dispose();
      batchMaterials.clear();
      for (const key of Object.keys(UNIT)) { UNIT[key].dispose(); delete UNIT[key]; }
      picker.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  return api;
}
