/** Read-only InputXML bend-geometry diagnostics and deterministic audit evidence. */

import { serializeBendGeometryAudit } from '../adapters/bend-geometry-audit.js';
import {
  buildBendReviewPackageManifest, serializeBendReviewPackageManifest,
} from './bend-review-package.js';
import { bendReviewVerifierHtml } from './bend-review-package-verifier.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function count(value) { return Math.max(0, Math.trunc(Number(value) || 0)); }
function displayName(value, fallback) { return String(value ?? '').trim() || fallback; }

function groupDiagnostics(rows) {
  const groups = new Map();
  for (const row of rows) {
    const code = String(row?.code || 'BEND_GEOMETRY_BLOCKED');
    const current = groups.get(code) ?? { code, count: 0, objectIds: [], messages: [] };
    current.count += 1;
    if (row?.objectId && !current.objectIds.includes(row.objectId)) current.objectIds.push(row.objectId);
    if (row?.message && !current.messages.includes(row.message)) current.messages.push(row.message);
    groups.set(code, current);
  }
  return [...groups.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function disposition(summary, loaded) {
  if (!loaded) return 'NOT_LOADED';
  if (!summary.requested) return 'NO_BENDS';
  if (!summary.blocked && summary.resolved === summary.requested) return 'READY';
  return 'REVIEW_REQUIRED';
}

function sideModel(side, label, name, visual) {
  const loaded = Boolean(visual?.bendSummary);
  const summary = Object.freeze({
    requested: count(visual?.bendSummary?.requested),
    resolved: count(visual?.bendSummary?.resolved),
    blocked: count(visual?.bendSummary?.blocked),
    arcSegments: count(visual?.bendSummary?.arcSegments),
  });
  const diagnostics = groupDiagnostics(Array.isArray(visual?.geometryDiagnostics)
    ? visual.geometryDiagnostics : []);
  const audit = visual?.bendAudit ?? null;
  return Object.freeze({
    side,
    label,
    name,
    loaded,
    disposition: disposition(summary, loaded),
    summary,
    signature: String(audit?.signature ?? ''),
    signatureAlgorithm: String(audit?.signatureAlgorithm ?? ''),
    audit,
    diagnostics: Object.freeze(diagnostics.map((row) => Object.freeze({
      ...row,
      objectIds: Object.freeze([...row.objectIds]),
      messages: Object.freeze([...row.messages]),
    }))),
  });
}

function auditParity(source, target) {
  if (!source.signature || !target.signature) return 'NOT_AVAILABLE';
  return source.signature === target.signature ? 'MATCH' : 'DIFFERENT';
}

export function buildBendDiagnosticsModel(state = {}) {
  const source = sideModel('A', 'Source A', displayName(state.sourceName, 'Source A'), state.visuals?.A);
  const target = sideModel('B', 'Target B', displayName(state.targetName, 'Target B'), state.visuals?.B);
  return Object.freeze({
    source,
    target,
    auditParity: auditParity(source, target),
    reviewPackage: buildBendReviewPackageManifest(state),
    totals: Object.freeze({
      requested: source.summary.requested + target.summary.requested,
      resolved: source.summary.resolved + target.summary.resolved,
      blocked: source.summary.blocked + target.summary.blocked,
      arcSegments: source.summary.arcSegments + target.summary.arcSegments,
    }),
    authorityNote: 'Read-only visual derivation evidence; no XML, topology, comparison, writer, or export authority is changed.',
    signatureNote: 'Semantic signatures use deterministic stable-json-fnv1a32 for comparison, not security authentication.',
  });
}

function tile(label, value) {
  return `<div class="wb3d-tile"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
}

function diagnosticRows(side) {
  if (!side.diagnostics.length) return '<p class="wb3d-muted">No blocked bend diagnostics.</p>';
  const rows = side.diagnostics.map((row) => {
    const firstObjectId = row.objectIds[0] ?? '';
    const inspect = firstObjectId
      ? `<button class="wb3d-btn wb3d-btn-mini" data-action="select-object" data-object="${esc(firstObjectId)}">Inspect</button>`
      : '';
    return `<tr><td>${esc(row.code)}</td><td>${row.count}</td><td>${esc(row.messages.join(' · '))}</td><td>${inspect}</td></tr>`;
  }).join('');
  return `<div class="wb3d-table-wrap"><table><thead><tr><th>Code</th><th>Count</th><th>Reason</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function auditHtml(side) {
  if (!side.audit || !side.signature) return '<p class="wb3d-muted">Bend audit unavailable.</p>';
  const content = encodeURIComponent(serializeBendGeometryAudit(side.audit));
  const fileName = `${side.side === 'A' ? 'source-a' : 'target-b'}-bend-geometry-audit.json`;
  return `<div class="wb3d-toolbar"><span class="wb3d-muted">Audit <code>${esc(side.signature)}</code> · ${esc(side.signatureAlgorithm)}</span><a class="wb3d-btn wb3d-btn-mini" href="data:application/json;charset=utf-8,${content}" download="${fileName}">Export audit JSON</a></div>`;
}

function reviewPackageHtml(manifest) {
  const content = encodeURIComponent(serializeBendReviewPackageManifest(manifest));
  const run = manifest.payload.comparison;
  const inputs = manifest.payload.inputs;
  return `<div class="wb3d-card"><h4>Review package <span class="wb3d-badge">${esc(manifest.disposition)}</span></h4><div class="wb3d-toolbar"><span class="wb3d-muted">Package <code>${esc(manifest.packageSignature)}</code> · run <code>${esc(run.runSignature)}</code></span><a class="wb3d-btn wb3d-btn-mini" href="data:application/json;charset=utf-8,${content}" download="workbench-bend-review-package.json">Export review package</a></div><p class="wb3d-muted">Source <code>${esc(inputs.source.identitySignature)}</code> · Target <code>${esc(inputs.target.identitySignature)}</code> · deterministic read-only binding.</p>${bendReviewVerifierHtml(manifest)}</div>`;
}

function sideHtml(side) {
  const summary = side.summary;
  return `<div><h4>${esc(side.label)} <span class="wb3d-muted">${esc(side.name)}</span> <span class="wb3d-badge">${esc(side.disposition.replaceAll('_', ' '))}</span></h4><div class="wb3d-tiles">${tile('Requested bends', summary.requested)}${tile('Resolved bends', summary.resolved)}${tile('Blocked bends', summary.blocked)}${tile('Arc chords', summary.arcSegments)}</div>${auditHtml(side)}${diagnosticRows(side)}</div>`;
}

export function bendDiagnosticsPanelHtml(state = {}) {
  const model = buildBendDiagnosticsModel(state);
  if (!model.source.loaded && !model.target.loaded) return '';
  const parity = model.auditParity.replaceAll('_', ' ');
  return `<details class="wb3d-card" data-wb3d-bend-diagnostics ${model.totals.blocked ? 'open' : ''}><summary><h3>InputXML bend geometry <span class="wb3d-muted">${model.totals.resolved}/${model.totals.requested} resolved · ${model.totals.blocked} blocked · audit ${esc(parity)}</span></h3></summary><p class="wb3d-muted">${esc(model.authorityNote)} ${esc(model.signatureNote)}</p>${reviewPackageHtml(model.reviewPackage)}<div class="wb3d-evi-cols">${sideHtml(model.source)}${sideHtml(model.target)}</div></details>`;
}
