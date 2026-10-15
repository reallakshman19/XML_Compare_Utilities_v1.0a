/**
 * Browser-coordinate pan, cursor-centred zoom, Fit All, Fit Branch, and Fit
 * Issue navigation. Presentation changes never read or mutate topology data.
 */

const MIN_SCALE = 0.05;
const MAX_SCALE = 12;
const ZOOM_STEP = 0.8;

function parseViewBox(value) {
  const values = value.trim().split(/\s+/).map(Number);
  if (values.length !== 4 || values.some((number) => !Number.isFinite(number)) || values[2] <= 0 || values[3] <= 0) throw new TypeError(`Invalid SVG viewBox: ${value}.`);
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function writeViewBox(svg, box) {
  svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
  svg.style.setProperty('--ttv-inverse-scale', box.width / 1200);
}

function animateViewBox(svg, state, endBox, duration = 600) {
  const startBox = { ...state.current };
  const startTime = performance.now();

  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);

  function step(time) {
    let progress = (time - startTime) / duration;
    if (progress >= 1) {
      state.current = { ...endBox };
      writeViewBox(svg, state.current);
      state.animationFrame = null;
      return;
    }
    const t = progress * (2 - progress); // ease-out quad
    state.current = {
      x: startBox.x + (endBox.x - startBox.x) * t,
      y: startBox.y + (endBox.y - startBox.y) * t,
      width: startBox.width + (endBox.width - startBox.width) * t,
      height: startBox.height + (endBox.height - startBox.height) * t
    };
    writeViewBox(svg, state.current);
    state.animationFrame = requestAnimationFrame(step);
  }
  state.animationFrame = requestAnimationFrame(step);
}

function clientToView(svg, point, box) {
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return {
    x: box.x + ((point.clientX - rect.left) / rect.width) * box.width,
    y: box.y + ((point.clientY - rect.top) / rect.height) * box.height,
  };
}

function zoomedBox(base, current, factor, anchor) {
  const requestedScale = (current.width * factor) / base.width;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, requestedScale));
  const width = base.width * scale, height = base.height * scale;
  const xRatio = current.width ? (anchor.x - current.x) / current.width : 0.5;
  const yRatio = current.height ? (anchor.y - current.y) / current.height : 0.5;
  const box = { x: anchor.x - xRatio * width, y: anchor.y - yRatio * height, width, height };
  box.x = Math.max(base.x - base.width, Math.min(base.x + base.width * 2, box.x));
  box.y = Math.max(base.y - base.height, Math.min(base.y + base.height * 2, box.y));
  return box;
}

function applyZoom(svg, state, factor, clientPoint) {
  const current = state.current;
  const anchor = clientPoint ? clientToView(svg, clientPoint, current) : { x: current.x + current.width / 2, y: current.y + current.height / 2 };
  state.current = zoomedBox(state.base, current, factor, anchor);
  writeViewBox(svg, state.current);
}

function movePan(svg, state, event) {
  const drag = state.drag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const rect = svg.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dx = event.clientX - drag.clientX, dy = event.clientY - drag.clientY;
  if (Math.hypot(dx, dy) > 3) state.suppressClick = true;
  let newX = drag.box.x - dx * drag.box.width / rect.width;
  let newY = drag.box.y - dy * drag.box.height / rect.height;
  newX = Math.max(state.base.x - state.base.width, Math.min(state.base.x + state.base.width * 2, newX));
  newY = Math.max(state.base.y - state.base.height, Math.min(state.base.y + state.base.height * 2, newY));
  state.current = { ...drag.box, x: newX, y: newY };
  writeViewBox(svg, state.current);
}

function endPan(svg, state, event) {
  if (!state.drag || state.drag.pointerId !== event.pointerId) return;
  state.drag = null;
  svg.classList.remove('is-panning');
  if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
}

function elementsBox(elements, padding = 36) {
  const boxes = [...elements].map((element) => {
    try { return element.getBBox(); } catch { return null; }
  }).filter((box) => box && Number.isFinite(box.x) && Number.isFinite(box.y));
  if (!boxes.length) return null;
  const minX = Math.min(...boxes.map((box) => box.x)), minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.width)), maxY = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: minX - padding, y: minY - padding, width: Math.max(1, maxX - minX + padding * 2), height: Math.max(1, maxY - minY + padding * 2) };
}

function navigationHandlers(svg, state) {
  const onWheel = (event) => {
    event.preventDefault();
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    applyZoom(svg, state, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event);
  };
  const onPointerDown = (event) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('[data-object-key]')) return;
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, box: { ...state.current } };
    state.suppressClick = false;
    svg.setPointerCapture(event.pointerId);
    svg.classList.add('is-panning');
  };
  const onClickCapture = (event) => {
    if (!state.suppressClick) return;
    state.suppressClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const onKeyDown = (event) => {
    if (event.key === '+' || event.key === '=') applyZoom(svg, state, ZOOM_STEP, null);
    else if (event.key === '-') applyZoom(svg, state, 1 / ZOOM_STEP, null);
    else if (event.key === '0') { state.current = { ...state.base }; writeViewBox(svg, state.current); }
    else return;
    event.preventDefault();
  };
  return { onWheel, onPointerDown, onPointerMove: (event) => movePan(svg, state, event), endPointer: (event) => endPan(svg, state, event), onClickCapture, onKeyDown };
}

export function wireTopologySvgNavigation(svg) {
  const base = parseViewBox(svg.getAttribute('viewBox') ?? '');
  const state = { base, current: { ...base }, drag: null, suppressClick: false, animationFrame: null };
  const handlers = navigationHandlers(svg, state);
  const fit = () => {
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    state.current = { ...base };
    writeViewBox(svg, state.current);
  };
  const focusElements = (elements, padding = 36, animate = false) => {
    const box = elementsBox(elements, padding);
    if (!box) return false;
    if (animate) {
      animateViewBox(svg, state, box);
    } else {
      if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
      state.current = box;
      writeViewBox(svg, state.current);
    }
    return true;
  };
  const { onWheel, onPointerDown, onPointerMove, endPointer, onClickCapture, onKeyDown } = handlers;
  svg.addEventListener('wheel', onWheel, { passive: false });
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('click', onClickCapture, true);
  svg.addEventListener('keydown', onKeyDown);
  const destroy = () => {
    svg.removeEventListener('wheel', onWheel);
    svg.removeEventListener('pointerdown', onPointerDown);
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerup', endPointer);
    svg.removeEventListener('pointercancel', endPointer);
    svg.removeEventListener('click', onClickCapture, true);
    svg.removeEventListener('keydown', onKeyDown);
  };
  return Object.freeze({
    fit,
    fitElements: focusElements,
    fitObjectKey: (key, animate = false) => focusElements(svg.querySelectorAll(`[data-object-key="${CSS.escape(String(key))}"]`), 36, animate),
    fitBranch: (branchId, animate = false) => focusElements(svg.querySelectorAll(`[data-branch-id*="${CSS.escape(String(branchId))}"]`), 36, animate),
    zoomIn: () => applyZoom(svg, state, ZOOM_STEP, null),
    zoomOut: () => applyZoom(svg, state, 1 / ZOOM_STEP, null),
    destroy,
  });
}

export const _test = Object.freeze({ parseViewBox, clientToView, zoomedBox, applyZoom, movePan, endPan, elementsBox });
