import { escapeHtml } from '../sequential-sketcher-contract.js';
import { createViewportTransform, projectPlantPoint } from '../sequential-sketcher-projection.js';
import { buildSequentialReversalCandidates } from '../construction/sequential-supervised-decision-actions.js';

function project(value, mode) { return value ? projectPlantPoint(value, mode) : null; }
function line(parts, a, b, className, attrs = '') {
  if (!a || !b) return;
  parts.push(`<line ${attrs} x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" class="${className}"/>`);
}
function polylinePoints(points) { return points.filter(Boolean).map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '); }
function transformedPoint(transform, point, mode) { const projected = project(point, mode); return projected ? transform(projected) : null; }
function commandPoints(command) {
  return [command.entryPosition, command.exitPosition, command.centre, command.branchPosition, command.hostPosition, command.fromPosition, command.toPosition].filter(Boolean);
}
function candidatePositions(candidate) {
  return {
    from: candidate.fromPosition || candidate.targetPosition || candidate.boundaryPosition || null,
    to: candidate.toPosition || candidate.connectedPosition || candidate.boundaryPosition || null,
  };
}
function candidatePorts(candidate) {
  return {
    fromPortId: candidate.fromPortId || candidate.targetPortId || '',
    toPortId: candidate.toPortId || candidate.connectedPortId || '',
  };
}
function candidateGap(candidate) {
  const value = Number(candidate.gapMm ?? candidate.totalGapMm ?? candidate.targetToBoundaryGapMm);
  return Number.isFinite(value) ? value : null;
}
function supportPoints(supportProjection) {
  return (supportProjection?.supportGlyphs || []).map((glyph) => glyph.centerlinePointGlobal).filter(Boolean);
}
function allPlantPoints(session, supportProjection) {
  const confirmed = session.strokeLedger.flatMap(commandPoints);
  const candidates = session.currentDecisionRequest?.candidates?.flatMap((candidate) => {
    const points = candidatePositions(candidate);
    return [points.from, points.to].filter(Boolean);
  }) || [];
  return [...confirmed, ...candidates, ...supportPoints(supportProjection)];
}

function reducerPolygon(a, b, inletWidth, outletWidth) {
  if (!a || !b) return [];
  const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length; const ny = dx / length;
  return [
    { x: a.x + nx * inletWidth, y: a.y + ny * inletWidth },
    { x: b.x + nx * outletWidth, y: b.y + ny * outletWidth },
    { x: b.x - nx * outletWidth, y: b.y - ny * outletWidth },
    { x: a.x - nx * inletWidth, y: a.y - ny * inletWidth },
  ];
}

function renderConfirmedCommand(parts, command, transform, mode) {
  const a = transformedPoint(transform, command.entryPosition || command.fromPosition, mode);
  const b = transformedPoint(transform, command.exitPosition || command.toPosition, mode);
  const centre = transformedPoint(transform, command.centre, mode);
  const componentAttribute = `data-ssk-component-id="${escapeHtml(command.componentId)}"`;
  const shadowAttribute = command.shadowCarrierEvidence
    ? ` data-ssk-shadow-carrier="${escapeHtml(command.shadowCarrierEvidence.sourceComponentId || command.shadowCarrierEvidence.componentId)}"`
    : '';
  if (command.op === 'DRAW_PIPE') line(parts, a, b, 'ssk-confirmed ssk-pipe', componentAttribute);
  else if (command.op === 'DRAW_VIRTUAL_REPAIR') line(parts, a, b, 'ssk-confirmed-repair', `data-ssk-repair-id="${escapeHtml(command.connectionId)}"`);
  else if (command.op === 'DRAW_ELBOW') {
    if (a && b && centre) parts.push(`<path ${componentAttribute} d="M${a.x.toFixed(2)} ${a.y.toFixed(2)} Q${centre.x.toFixed(2)} ${centre.y.toFixed(2)} ${b.x.toFixed(2)} ${b.y.toFixed(2)}" class="ssk-confirmed ssk-elbow"/>`);
    else line(parts, a, b, 'ssk-confirmed ssk-elbow', componentAttribute);
  } else if (command.op === 'DRAW_REDUCER') {
    const inlet = Math.max(5, Math.min(16, Number(command.inletBoreMm || 80) / 18));
    const outlet = Math.max(3, Math.min(14, Number(command.outletBoreMm || 50) / 18));
    const points = reducerPolygon(a, b, inlet, outlet);
    if (points.length) parts.push(`<polygon ${componentAttribute} points="${polylinePoints(points)}" class="ssk-confirmed-fitting ssk-reducer"/>`);
  } else if (command.op === 'DRAW_TEE_RUN') {
    line(parts, a, b, 'ssk-confirmed ssk-tee-run', componentAttribute);
    const branch = transformedPoint(transform, command.branchPosition, mode);
    const anchor = centre || (a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null);
    line(parts, anchor, branch, 'ssk-confirmed ssk-tee-branch');
  } else if (command.op === 'DRAW_OLET') {
    const host = transformedPoint(transform, command.hostPosition, mode);
    const branch = transformedPoint(transform, command.branchPosition, mode);
    if (host) parts.push(`<circle ${componentAttribute} cx="${host.x.toFixed(2)}" cy="${host.y.toFixed(2)}" r="5" class="ssk-confirmed-fitting ssk-olet"/>`);
    line(parts, host, branch, 'ssk-confirmed ssk-olet-branch');
  } else if (command.op === 'DRAW_VALVE') {
    if (a && b) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      line(parts, a, b, 'ssk-confirmed ssk-valve-line', `${componentAttribute}${shadowAttribute}`);
      parts.push(`<path ${componentAttribute}${shadowAttribute} d="M${mid.x - 10} ${mid.y - 8} L${mid.x} ${mid.y} L${mid.x - 10} ${mid.y + 8} Z M${mid.x + 10} ${mid.y - 8} L${mid.x} ${mid.y} L${mid.x + 10} ${mid.y + 8} Z" class="ssk-confirmed-fitting ssk-valve"/>`);
    }
  } else if (command.op === 'DRAW_INSTRUMENT') {
    if (a && b) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      line(parts, a, b, 'ssk-confirmed ssk-instrument-line', `${componentAttribute}${shadowAttribute}`);
      parts.push(`<g ${componentAttribute}${shadowAttribute} class="ssk-confirmed-instrument"><circle cx="${mid.x.toFixed(2)}" cy="${mid.y.toFixed(2)}" r="11"/><text x="${mid.x.toFixed(2)}" y="${(mid.y + 3.5).toFixed(2)}" text-anchor="middle">I</text></g>`);
    }
  } else if (command.op === 'DRAW_FLANGE' || command.op === 'DRAW_GASKET') {
    line(parts, a, b, 'ssk-confirmed ssk-inline-fitting', componentAttribute);
    if (a && b) {
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dx = b.x - a.x; const dy = b.y - a.y; const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length; const ny = dx / length; const half = command.op === 'DRAW_FLANGE' ? 10 : 7;
      line(parts, { x: mid.x - nx * half, y: mid.y - ny * half }, { x: mid.x + nx * half, y: mid.y + ny * half }, 'ssk-confirmed-fitting ssk-flange');
    }
  } else if (command.op === 'DRAW_CAP') {
    const at = transformedPoint(transform, command.entryPosition, mode);
    if (at) parts.push(`<rect ${componentAttribute} x="${(at.x - 5).toFixed(2)}" y="${(at.y - 5).toFixed(2)}" width="10" height="10" class="ssk-confirmed-fitting ssk-cap"/>`);
  }
}

function renderSupportGlyphs(parts, supportProjection, transform, mode) {
  parts.push('<g data-ssk-layer="confirmed-supports">');
  for (const glyph of supportProjection?.supportGlyphs || []) {
    const point = transformedPoint(transform, glyph.centerlinePointGlobal, mode);
    if (!point) continue;
    parts.push(`<g class="ssk-confirmed-support" data-ssk-support-family="${escapeHtml(glyph.familyId)}"><path d="M${point.x.toFixed(2)} ${(point.y - 10).toFixed(2)}V${(point.y + 5).toFixed(2)}M${(point.x - 8).toFixed(2)} ${(point.y + 5).toFixed(2)}H${(point.x + 8).toFixed(2)}"/><text x="${(point.x + 10).toFixed(2)}" y="${(point.y - 3).toFixed(2)}">${escapeHtml(glyph.label)}</text></g>`);
  }
  parts.push('</g>');
}

export function renderSequentialConstructionCanvas(host, session, options = {}) {
  const width = Math.max(640, Number(options.width) || 1000);
  const height = Math.max(420, Number(options.height) || 660);
  const mode = options.mode || 'ISO';
  const supportProjection = options.supportProjection || null;
  const projected = allPlantPoints(session, supportProjection).map((point) => project(point, mode)).filter(Boolean);
  if (!projected.length) {
    host.innerHTML = '<div class="ssk-empty"><strong>No confirmed construction</strong><span>Start the selected branch to place the first proven component.</span></div>';
    return;
  }
  const transform = createViewportTransform(projected, width, height);
  const parts = [`<svg class="ssk-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gated sequential piping construction">`, '<defs><pattern id="ssk-grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="rgba(148,163,184,.11)" stroke-width="1"/></pattern></defs>', `<rect width="${width}" height="${height}" fill="url(#ssk-grid)"/>`, '<g data-ssk-layer="confirmed-geometry">'];
  for (const command of session.strokeLedger) renderConfirmedCommand(parts, command, transform, mode);
  parts.push('</g>');
  renderSupportGlyphs(parts, supportProjection, transform, mode);
  parts.push('<g data-ssk-layer="candidate-connections">');
  for (const candidate of session.currentDecisionRequest?.candidates || []) {
    const positions = candidatePositions(candidate);
    const from = transformedPoint(transform, positions.from, mode);
    const to = transformedPoint(transform, positions.to, mode);
    if (!from || !to) continue;
    line(parts, from, to, `ssk-candidate${candidate.candidateId === options.selectedCandidateId ? ' is-selected' : ''}`, `data-ssk-candidate-id="${escapeHtml(candidate.candidateId)}" tabindex="0" role="button"`);
    const gap = candidateGap(candidate);
    if (gap !== null) parts.push(`<text x="${((from.x + to.x) / 2 + 6).toFixed(2)}" y="${((from.y + to.y) / 2 - 6).toFixed(2)}" class="ssk-candidate-label">${escapeHtml(gap.toFixed(1))} mm</text>`);
  }
  parts.push('</g>');
  const activeCandidate = session.currentDecisionRequest?.candidates?.[0];
  const activePosition = activeCandidate ? candidatePositions(activeCandidate).to : null;
  const active = transformedPoint(transform, activePosition, mode);
  if (active) parts.push(`<g data-ssk-layer="active-port"><circle cx="${active.x.toFixed(2)}" cy="${active.y.toFixed(2)}" r="10" class="ssk-active-port"/></g>`);
  parts.push('</svg>');
  host.innerHTML = parts.join('');
}

export function renderConstructionMetrics(host, session, supportProjection = null) {
  const metrics = [
    ['State', session.state],
    ['Components', session.confirmedComponentIds.length],
    ['Connections', session.committedConnections.length],
    ['Repairs', session.repairLedger.length],
    ['Supports', supportProjection?.supportGlyphs?.length || 0],
    ['Unresolved supports', supportProjection?.unresolvedSupportFamilies?.length || 0],
    ['Pending branches', session.pendingBranchJunctions.length],
    ['Decisions', session.decisionLedger.length],
    ['Transactions', session.transactionLedger?.length || 0],
    ['Deferred', session.deferredDecisionIds?.length || 0],
  ];
  host.innerHTML = metrics.map(([label, value]) => `<div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}

export function renderConstructionSequence(host, session) {
  host.innerHTML = session.strokeLedger.map((command, index) => `<button type="button" disabled><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(command.op)}</b><small>${escapeHtml(command.sourceComponentId || command.connectionId || command.branchId || '')}</small></button>`).join('');
}

function transactionHistory(session) {
  const rows = (session.transactionLedger || []).slice(-5).reverse();
  if (!rows.length) return '<p>No supervised transactions recorded.</p>';
  return `<ol>${rows.map((row) => `<li><b>${escapeHtml(row.action)}</b><span>${escapeHtml(row.outcome)}</span><small>${escapeHtml(row.transactionId)}</small></li>`).join('')}</ol>`;
}

export function renderConstructionInspector(host, session, evidenceIndexes, selectedCandidateId = '', supportProjection = null) {
  const activePort = evidenceIndexes?.ports?.get(session.activeExitPortId);
  const request = session.currentDecisionRequest;
  const candidates = request?.candidates || [];
  const deferred = request?.state === 'DEFERRED';
  const disabled = deferred ? ' disabled' : '';
  const candidateHtml = candidates.length ? candidates.map((candidate, index) => {
    const gap = candidateGap(candidate);
    const direction = Number(candidate.directionAngleDeg);
    const ports = candidatePorts(candidate);
    const evidence = [candidate.referenceMatch || candidate.referenceKind ? 'reference' : '', candidate.sourceAdjacent ? 'source sequence' : '', candidate.targetPositionBasis?.startsWith('DERIVED') ? 'derived boundary port' : ''].filter(Boolean).join(', ') || 'constrained candidate';
    return `<article class="ssk-candidate-card${candidate.candidateId === selectedCandidateId ? ' is-selected' : ''}" data-ssk-candidate-card="${escapeHtml(candidate.candidateId)}"><header><b>Candidate ${index + 1}</b><span>${gap === null ? 'gap unknown' : `${escapeHtml(gap.toFixed(2))} mm`}</span></header><p>${escapeHtml(candidate.targetSourceComponentId || candidate.referenceTarget || 'Reference target')}<br>${escapeHtml(candidate.targetBranchId || '')}</p><dl><dt>From</dt><dd>${escapeHtml(ports.fromPortId || '—')}</dd><dt>To</dt><dd>${escapeHtml(ports.toPortId || '—')}</dd><dt>Port</dt><dd>${escapeHtml(candidate.targetPortRole || '—')}</dd><dt>Direction</dt><dd>${Number.isFinite(direction) ? `${direction.toFixed(1)}°` : 'unknown'}</dd><dt>Bore</dt><dd>${escapeHtml(candidate.boreCompatibility || 'unknown')}</dd><dt>Evidence</dt><dd>${escapeHtml(evidence)}</dd></dl><div><button type="button" data-ssk-select-candidate="${escapeHtml(candidate.candidateId)}">Preview</button><button type="button" data-ssk-connect-candidate="${escapeHtml(candidate.candidateId)}"${disabled}>Connect</button><button type="button" data-ssk-manual-connect="${escapeHtml(candidate.candidateId)}" data-ssk-from-port="${escapeHtml(ports.fromPortId)}" data-ssk-to-port="${escapeHtml(ports.toPortId)}"${disabled}>Manual connect</button><button type="button" data-ssk-reject-candidate="${escapeHtml(candidate.candidateId)}"${disabled}>Reject</button></div></article>`;
  }).join('') : '<p>No eligible continuation candidate.</p>';
  const reversals = buildSequentialReversalCandidates(session, evidenceIndexes);
  const reversalHtml = reversals.length ? `<div class="ssk-reversal-list"><h4>Reversible entry</h4>${reversals.map((row) => `<button type="button" data-ssk-reverse-component="${escapeHtml(row.candidateId)}" data-ssk-component-id="${escapeHtml(row.componentId)}" data-ssk-entry-port="${escapeHtml(row.entryPortId)}"${disabled}>${escapeHtml(row.portRole || row.entryPortId)}</button>`).join('')}</div>` : '';
  const supportHtml = supportProjection ? `<section><h3>Accepted support projection</h3><dl><dt>Resolved</dt><dd>${supportProjection.supportGlyphs.length}</dd><dt>Unresolved</dt><dd>${supportProjection.unresolvedSupportFamilies.length}</dd><dt>Diagnostics</dt><dd>${supportProjection.diagnostics.length}</dd></dl></section>` : '';
  const decisionHtml = request ? `<section class="ssk-decision-panel"><h3>Construction stopped${deferred ? ' · deferred' : ''}</h3><p><b>${escapeHtml(request.reason)}</b></p><label>Decision reason<textarea data-ssk-decision-reason placeholder="Why is this supervised action justified?">${escapeHtml(request.deferral?.reason || '')}</textarea></label><label>Evidence note<textarea data-ssk-decision-evidence placeholder="Reference, field check, drawing note, or engineering basis">${escapeHtml(request.deferral?.evidenceNote || '')}</textarea></label><div class="ssk-candidate-list">${candidateHtml}</div>${reversalHtml}<div class="ssk-decision-actions">${deferred ? '<button type="button" data-ssk-decision-action="RESUME_DECISION">Resume decision</button>' : '<button type="button" data-ssk-decision-action="DEFER_DECISION">Defer decision</button>'}<button type="button" data-ssk-decision-action="MARK_TERMINAL"${disabled}>Mark intentional terminal</button><button type="button" data-ssk-decision-action="MARK_EXTERNAL_BOUNDARY"${disabled}>Mark external boundary</button></div></section>` : '<section><h3>Continuity gate</h3><p>Construction is clear to advance. Only proven components are shown.</p></section>';
  host.innerHTML = `<section><h3>Construction session</h3><dl><dt>State</dt><dd>${escapeHtml(session.state)}</dd><dt>Branch</dt><dd>${escapeHtml(session.activeBranchId || '—')}</dd><dt>Component</dt><dd>${escapeHtml(evidenceIndexes?.components?.get(session.activeComponentId)?.sourceComponentId || '—')}</dd><dt>Active port</dt><dd>${escapeHtml(activePort?.role || '—')}</dd><dt>Undo depth</dt><dd>${escapeHtml(session.undoStack?.length || 0)}</dd></dl></section>${decisionHtml}<section class="ssk-transaction-history"><h3>Supervised transactions</h3>${transactionHistory(session)}</section>${supportHtml}`;
}
