const SVG_NS = 'http://www.w3.org/2000/svg';

function svgElement(documentRef, tagName) {
  return documentRef.createElementNS(SVG_NS, tagName);
}

function setAttributes(element, attributes) {
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
}

function geometryTag(geometry) {
  if (geometry?.kind === 'point') return 'circle';
  if (geometry?.kind === 'segment') return 'line';
  if (geometry?.kind === 'polyline') return 'polyline';
  return null;
}

function ensureGeometryElement(group, geometry) {
  const tag = geometryTag(geometry);
  const current = group.firstElementChild;
  if (!tag) {
    current?.remove();
    return null;
  }
  if (current?.localName === tag) return current;
  current?.remove();
  const element = svgElement(group.ownerDocument, tag);
  group.appendChild(element);
  return element;
}

function updateGeometryElement(group, geometry) {
  const element = ensureGeometryElement(group, geometry);
  if (!element) return;
  if (geometry.kind === 'point') {
    const [point] = geometry.points;
    setAttributes(element, { cx: point.x, cy: point.y, r: 4 });
  } else if (geometry.kind === 'segment') {
    const [start, end] = geometry.points;
    setAttributes(element, { x1: start.x, y1: start.y, x2: end.x, y2: end.y });
  } else {
    const points = geometry.closed ? [...geometry.points, geometry.points[0]] : geometry.points;
    setAttributes(element, { points: points.map((point) => `${point.x},${point.y}`).join(' ') });
  }
  element.setAttribute('vector-effect', 'non-scaling-stroke');
  element.setAttribute('data-engineering-svg-geometry', geometry.kind);
}

function removeAttribute(element, name) {
  if (typeof element.removeAttribute === 'function') element.removeAttribute(name);
  else element.attributes?.delete?.(name);
}

function updateEntityAccessibility(group, entity) {
  if (entity.selectable) {
    setAttributes(group, {
      role: 'button',
      tabindex: '0',
      'aria-label': `${entity.domainType} ${entity.id}`,
    });
    return;
  }
  removeAttribute(group, 'role');
  removeAttribute(group, 'tabindex');
  removeAttribute(group, 'aria-label');
}

function updateEntityGroup(group, entity, selected) {
  setAttributes(group, {
    'data-engineering-svg-entity-id': entity.id,
    'data-engineering-svg-kind': entity.kind,
    'data-engineering-svg-domain-type': entity.domainType,
    'data-engineering-svg-layer-name': entity.layer,
    'aria-selected': selected ? 'true' : 'false',
  });
  updateEntityAccessibility(group, entity);
  group.classList.toggle('is-selected', selected);
  group.style.pointerEvents = entity.selectable ? 'auto' : 'none';
  updateGeometryElement(group, entity.projectedGeometry);
}

export function createEngineeringSvgRenderer(host) {
  if (!host?.ownerDocument?.createElementNS) throw new TypeError('Engineering SVG renderer requires a DOM host.');
  const documentRef = host.ownerDocument;
  const root = svgElement(documentRef, 'svg');
  setAttributes(root, {
    xmlns: SVG_NS,
    role: 'img',
    'aria-label': 'Engineering drawing',
    'data-engineering-svg-root': '1',
    preserveAspectRatio: 'xMidYMid meet',
  });
  host.appendChild(root);
  const layers = new Map();
  const entities = new Map();
  let selectedIds = new Set();
  let destroyed = false;

  function ensureLayer(name) {
    if (layers.has(name)) return layers.get(name);
    const layer = svgElement(documentRef, 'g');
    layer.setAttribute('data-engineering-svg-layer', name);
    layers.set(name, layer);
    root.appendChild(layer);
    return layer;
  }

  function reconcile(projectedScene) {
    if (destroyed) throw new Error('Engineering SVG renderer is destroyed.');
    setAttributes(root, {
      viewBox: `0 0 ${projectedScene.viewport.width} ${projectedScene.viewport.height}`,
      'data-engineering-svg-scene-id': projectedScene.sceneId,
      'data-engineering-svg-projection': projectedScene.projection,
    });
    const presentEntities = new Set();
    const orderedLayers = [];
    projectedScene.entities.forEach((entity) => {
      presentEntities.add(entity.id);
      if (!orderedLayers.includes(entity.layer)) orderedLayers.push(entity.layer);
      const layer = ensureLayer(entity.layer);
      const group = entities.get(entity.id) || svgElement(documentRef, 'g');
      entities.set(entity.id, group);
      updateEntityGroup(group, entity, selectedIds.has(entity.id));
      layer.appendChild(group);
    });
    entities.forEach((group, id) => {
      if (!presentEntities.has(id)) {
        group.remove();
        entities.delete(id);
      }
    });
    layers.forEach((layer, name) => {
      if (!orderedLayers.includes(name)) {
        layer.remove();
        layers.delete(name);
      }
    });
    orderedLayers.forEach((name) => root.appendChild(layers.get(name)));
    return root;
  }

  function setSelection(ids = []) {
    selectedIds = new Set(ids);
    entities.forEach((group, id) => {
      const selected = selectedIds.has(id);
      group.classList.toggle('is-selected', selected);
      group.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
  }

  return Object.freeze({
    root,
    reconcile,
    setSelection,
    getEntityNode: (id) => entities.get(id) || null,
    getEntityCount: () => entities.size,
    destroy() {
      if (destroyed) return false;
      destroyed = true;
      entities.clear();
      layers.clear();
      root.remove();
      return true;
    },
  });
}
