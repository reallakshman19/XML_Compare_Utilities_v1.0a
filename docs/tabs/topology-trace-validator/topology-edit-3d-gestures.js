/** Pointer and keyboard ownership for reversible Edit Draft 3D commands. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { selectionForObjectId } from './topology-edit-controller-helpers.js';
import {
  canonicalInteractionDistance, closestLineParameter, EDIT_DRAG_THRESHOLD_PX, pointerTravel, positionRecord,
  solveEditDrag, vAdd, vLen, vScale, vSub,
} from './topology-edit-drag-solver.js';

const AXES = Object.freeze({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });

function nodePosition(canonical, nodeId) {
  const node = asArray(canonical.nodes).map(objectRecord).find((row) => cleanText(row.id) === nodeId);
  return node ? [node.position.x, node.position.y, node.position.z] : null;
}

function adjacentEdgeId(canonical, nodeId) {
  const edge = asArray(canonical.edges).map(objectRecord)
    .find((row) => cleanText(row.fromNodeId) === nodeId || cleanText(row.toNodeId) === nodeId);
  return edge ? cleanText(edge.id) : '';
}

function neighborPositions(canonical, nodeId) {
  return asArray(canonical.edges).map(objectRecord).flatMap((edge) => {
    const from = cleanText(edge.fromNodeId), to = cleanText(edge.toNodeId);
    if (from !== nodeId && to !== nodeId) return [];
    const other = nodePosition(canonical, from === nodeId ? to : from);
    return other ? [other] : [];
  });
}

export function wireTopologyEditGestures({ host, viewer, callbacks, input }) {
  let interaction = null;
  let axisLock = null;
  let boxEl = null;
  let downPos = null;
  let suppressNextClick = false;
  const canonical = () => input()?.draft ?? { nodes: [], edges: [] };
  const cb = () => callbacks() ?? {};

  function releaseCapture(pointerId) {
    if (host.hasPointerCapture?.(pointerId)) host.releasePointerCapture(pointerId);
  }

  function clearInteraction(cancelled) {
    if (!interaction) return null;
    const finished = interaction;
    interaction = null;
    releaseCapture(finished.pointerId);
    finished.releaseNavigation?.();
    viewer().setTransient(null);
    boxEl?.remove(); boxEl = null; axisLock = null;
    if (cancelled || finished.activated) suppressNextClick = true;
    return finished;
  }

  function solvePoint(event) {
    const ray = viewer().screenRay(event.clientX, event.clientY);
    return solveEditDrag({
      ray, start: interaction.start, planeNormal: interaction.planeNormal,
      axis: axisLock ? AXES[axisLock] : null, maxDistance: interaction.maxDistance,
      lastValid: interaction.current,
    });
  }

  function showDragOverlay() {
    const lines = interaction.type === 'move'
      ? interaction.neighbors.map((point) => ({ points: [point, interaction.current] }))
      : [{ points: [interaction.start, interaction.current], colorInt: interaction.type === 'connect' ? 0x22d3ee : 0xf59e0b }];
    viewer().setTransient({ spheres: [{ position: interaction.current, radiusMm: 30 }], lines });
  }

  function startBox(event) {
    boxEl = host.ownerDocument.createElement('div');
    boxEl.className = 'ttv-edit-selection-box-3d';
    host.appendChild(boxEl);
    interaction = {
      state: 'BOX_SELECT', pointerId: event.pointerId, startScreen: [event.clientX, event.clientY],
      activated: false, releaseNavigation: viewer().acquireNavigationLock?.('EDIT_BOX_SELECT'),
    };
    host.setPointerCapture?.(event.pointerId);
    updateBox(event);
    event.stopPropagation(); event.preventDefault();
  }

  function startEditPress(event, tool, pick, start) {
    const downRay = viewer().screenRay(event.clientX, event.clientY);
    interaction = {
      state: 'PRESS_PENDING', pointerId: event.pointerId, type: tool.toLowerCase(),
      nodeId: cleanText(pick.nodeId), start, current: start, startScreen: [event.clientX, event.clientY],
      activated: false, valid: true, planeNormal: vScale(downRay.direction, -1),
      neighbors: tool === 'MOVE' ? neighborPositions(canonical(), cleanText(pick.nodeId)) : [],
      maxDistance: canonicalInteractionDistance(canonical()),
      releaseNavigation: viewer().acquireNavigationLock?.('EDIT_DRAG'),
    };
    host.setPointerCapture?.(event.pointerId);
    event.stopPropagation(); event.preventDefault();
  }

  function onPointerDown(event) {
    if (event.button !== 0 || interaction) return;
    downPos = [event.clientX, event.clientY];
    const tool = String(cb().getTool?.() ?? 'SELECT');
    if (event.shiftKey && tool === 'SELECT') { startBox(event); return; }
    if (!['MOVE', 'CONNECT', 'ADD'].includes(tool)) return;
    const pick = viewer().pickAt(event.clientX, event.clientY);
    const start = pick?.modelId === 'target' && pick.nodeId ? nodePosition(canonical(), cleanText(pick.nodeId)) : null;
    if (start) startEditPress(event, tool, pick, start);
  }

  function onPointerMove(event) {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    if (interaction.state === 'BOX_SELECT') { updateBox(event); return; }
    if (interaction.state === 'PRESS_PENDING' && pointerTravel(interaction.startScreen, event) < EDIT_DRAG_THRESHOLD_PX) return;
    interaction.state = 'EDIT_DRAG'; interaction.activated = true;
    const solved = solvePoint(event);
    interaction.valid = solved.valid;
    if (solved.valid) interaction.current = solved.point;
    else cb().onHint?.(`Move paused: ${solved.reason}. Release or press Escape to cancel.`);
    showDragOverlay();
  }

  async function commitMove(finished, event) {
    const pick = viewer().pickAt(event.clientX, event.clientY);
    const targetNode = pick?.modelId === 'target' ? cleanText(pick.nodeId) : '';
    if (targetNode && targetNode !== finished.nodeId) {
      await cb().executeCommand('MERGE_NODES', { sourceNodeId: finished.nodeId, targetNodeId: targetNode });
    } else if (vLen(vSub(finished.current, finished.start)) > 0.5) {
      await cb().executeCommand('MOVE_NODE', { nodeId: finished.nodeId, position: positionRecord(finished.current) });
    }
  }

  async function commitConnection(finished, event) {
    const pick = viewer().pickAt(event.clientX, event.clientY);
    const targetNode = pick?.modelId === 'target' ? cleanText(pick.nodeId) : '';
    if (!targetNode || targetNode === finished.nodeId) throw new Error('Connect: drop on a second node to bridge the gap.');
    const contextEdgeId = cb().getContextEdgeId?.() || adjacentEdgeId(canonical(), finished.nodeId);
    if (!contextEdgeId) throw new Error('Connect requires an engineering context edge (select one first).');
    await cb().executeCommand('BRIDGE_GAP', { fromNodeId: finished.nodeId, toNodeId: targetNode, contextEdgeId });
  }

  async function commitAddition(finished) {
    if (vLen(vSub(finished.current, finished.start)) <= 0.5) return;
    const contextEdgeId = cb().getContextEdgeId?.() || adjacentEdgeId(canonical(), finished.nodeId);
    if (!contextEdgeId) throw new Error('Add requires an engineering context edge (select one first).');
    await cb().executeCommand('ADD_STRAIGHT_ELEMENT', { fromNodeId: finished.nodeId, toPosition: positionRecord(finished.current), contextEdgeId });
  }

  async function onPointerUp(event) {
    if (!interaction || event.pointerId !== interaction.pointerId) return;
    if (interaction.state === 'BOX_SELECT') { await finishBox(event); return; }
    const finished = clearInteraction(false);
    if (!finished.activated || !finished.valid) return;
    try {
      if (finished.type === 'move') await commitMove(finished, event);
      else if (finished.type === 'connect') await commitConnection(finished, event);
      else await commitAddition(finished);
    } catch (error) { cb().onGestureError?.(error); }
  }

  function cancelInteraction(event) {
    if (!interaction || (event?.pointerId !== undefined && event.pointerId !== interaction.pointerId)) return;
    clearInteraction(true);
    cb().onHint?.('Edit gesture cancelled.');
  }

  async function onClick(event) {
    if (suppressNextClick) { suppressNextClick = false; return; }
    const press = downPos; downPos = null;
    if (event.detail > 1 || pointerTravel(press, event) >= EDIT_DRAG_THRESHOLD_PX) return;
    const pick = viewer().pickAt(event.clientX, event.clientY);
    const tool = String(cb().getTool?.() ?? 'SELECT');
    if (tool === 'MEASURE') {
      if (pick?.point && !pick.connector) cb().onMeasurePoint?.(pick.point);
      else cb().onHint?.('Measure: click a rendered component surface.');
      return;
    }
    if (!pick || pick.modelId === 'source') { if (!event.ctrlKey && !event.metaKey) cb().setSelection?.([], true); return; }
    if (pick.connector) return;
    const row = pick.nodeId ? { kind: 'node', id: cleanText(pick.nodeId) } : selectionForObjectId(canonical(), cleanText(pick.objectId));
    if (!row) { cb().onGhostPick?.(cleanText(pick.objectId)); return; }
    if (tool === 'SPLIT' && row.kind === 'edge') { await splitPickedEdge(row, event); return; }
    cb().selectFromPointer?.(row, event);
  }

  async function splitPickedEdge(row, event) {
    try {
      const edge = asArray(canonical().edges).map(objectRecord).find((item) => cleanText(item.id) === row.id);
      const from = nodePosition(canonical(), cleanText(edge?.fromNodeId)), to = nodePosition(canonical(), cleanText(edge?.toNodeId));
      if (!from || !to) throw new Error('Split: edge endpoints not found.');
      const direction = vSub(to, from), ray = viewer().screenRay(event.clientX, event.clientY);
      const parameter = closestLineParameter(ray, from, direction);
      if (parameter === null) throw new Error('Split: the pointer ray is parallel to this edge.');
      const fraction = Math.min(0.95, Math.max(0.05, Math.round(parameter * 100) / 100));
      await cb().executeCommand('SPLIT_EDGE', { edgeId: row.id, fraction });
    } catch (error) { cb().onGestureError?.(error); }
  }

  function updateBox(event) {
    const rect = host.getBoundingClientRect(), start = interaction.startScreen;
    const left = Math.min(start[0], event.clientX), top = Math.min(start[1], event.clientY);
    boxEl.style.left = `${left - rect.left}px`; boxEl.style.top = `${top - rect.top}px`;
    boxEl.style.width = `${Math.abs(event.clientX - start[0])}px`; boxEl.style.height = `${Math.abs(event.clientY - start[1])}px`;
    interaction.activated = pointerTravel(start, event) >= EDIT_DRAG_THRESHOLD_PX;
  }

  async function finishBox(event) {
    const finished = clearInteraction(false);
    if (!finished.activated) return;
    const rect = host.getBoundingClientRect();
    const minX = Math.min(finished.startScreen[0], event.clientX) - rect.left;
    const maxX = Math.max(finished.startScreen[0], event.clientX) - rect.left;
    const minY = Math.min(finished.startScreen[1], event.clientY) - rect.top;
    const maxY = Math.max(finished.startScreen[1], event.clientY) - rect.top;
    const rows = asArray(canonical().nodes).map(objectRecord).flatMap((node) => {
      const screen = viewer().projectPoint([node.position.x, node.position.y, node.position.z]);
      return screen && screen.x >= minX && screen.x <= maxX && screen.y >= minY && screen.y <= maxY
        ? [{ kind: 'node', id: cleanText(node.id) }] : [];
    });
    cb().setSelection?.(rows, true);
  }

  async function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (key === 'escape' && interaction) { event.preventDefault(); cancelInteraction(); return; }
    if (!host.matches(':hover') && !host.contains(host.ownerDocument.activeElement)) return;
    if (interaction?.state === 'EDIT_DRAG' && ['x', 'y', 'z'].includes(key)) {
      axisLock = axisLock === key ? null : key;
      cb().onHint?.(axisLock ? `Axis lock: ${axisLock.toUpperCase()}` : 'Axis lock off');
      return;
    }
    if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
    const nodes = (cb().getSelection?.() ?? []).filter((row) => row.kind === 'node');
    if (nodes.length !== 1) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    const vertical = String(input()?.verticalAxis ?? 'Z').toUpperCase() === 'Z' ? 'z' : 'y';
    const delta = key === 'arrowleft' ? ['x', -1] : key === 'arrowright' ? ['x', 1]
      : key === 'arrowup' ? [vertical, 1] : [vertical, -1];
    const start = nodePosition(canonical(), nodes[0].id);
    if (!start) return;
    try {
      await cb().executeCommand('MOVE_NODE', { nodeId: nodes[0].id, position: positionRecord(vAdd(start, vScale(AXES[delta[0]], delta[1] * step))) });
    } catch (error) { cb().onGestureError?.(error); }
  }

  const windowRef = host.ownerDocument.defaultView;
  host.addEventListener('pointerdown', onPointerDown, true);
  windowRef.addEventListener('pointermove', onPointerMove);
  windowRef.addEventListener('pointerup', onPointerUp);
  windowRef.addEventListener('pointercancel', cancelInteraction);
  host.addEventListener('lostpointercapture', cancelInteraction);
  host.addEventListener('click', onClick);
  windowRef.addEventListener('keydown', onKeyDown);
  windowRef.addEventListener('blur', cancelInteraction);
  return () => {
    clearInteraction(true);
    host.removeEventListener('pointerdown', onPointerDown, true);
    windowRef.removeEventListener('pointermove', onPointerMove);
    windowRef.removeEventListener('pointerup', onPointerUp);
    windowRef.removeEventListener('pointercancel', cancelInteraction);
    host.removeEventListener('lostpointercapture', cancelInteraction);
    host.removeEventListener('click', onClick);
    windowRef.removeEventListener('keydown', onKeyDown);
    windowRef.removeEventListener('blur', cancelInteraction);
  };
}

export const _test = Object.freeze({ positionRecord });
