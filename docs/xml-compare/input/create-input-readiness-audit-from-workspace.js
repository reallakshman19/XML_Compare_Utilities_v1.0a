import { buildInputReadinessAudit } from './build-input-readiness-audit.js';
import { classifyInputReadinessProfile } from './classify-input-readiness-profile.js';
import { collectInputReadinessDiagnosticsForSide } from './collect-input-readiness-diagnostics.js';

function sideModel(workspace = {}, side = 'a') {
  return side === 'b' ? workspace.target : workspace.source;
}

function fileNameOf(state = {}, model = {}, side = 'a') {
  const file = side === 'b' ? state.fileB : state.fileA;
  return String(file?.name || model?.fileName || '').trim();
}

function rawTextOf(state = {}, side = 'a') {
  return side === 'b' ? state.textB || '' : state.textA || '';
}

function sourceIdOf(side = 'a') {
  return side === 'b' ? 'B' : 'A';
}

function sideLabelOf(side = 'a') {
  return side === 'b' ? 'Target B' : 'Source A';
}

function recordsOf(model = {}) {
  if (Array.isArray(model?.baseRecords)) return model.baseRecords;
  if (Array.isArray(model?.records)) return model.records;
  return [];
}

function profileDiagnostics(input = {}, model = {}) {
  return classifyInputReadinessProfile({ ...input, confidence: model.confidence }).diagnostics;
}

export function createReadinessSideInputFromWorkspace({ state = {}, workspace = {}, side = 'a' } = {}) {
  const model = sideModel(workspace, side) || {};
  const input = Object.freeze({
    sourceId: sourceIdOf(side),
    side: sideLabelOf(side),
    fileName: fileNameOf(state, model, side),
    rawText: rawTextOf(state, side),
    profile: model.profile,
    dataset: model,
    records: recordsOf(model),
  });
  return Object.freeze({
    ...input,
    diagnostics: Object.freeze([
      ...profileDiagnostics(input, model),
      ...collectInputReadinessDiagnosticsForSide({ state, workspace, model, side }),
    ]),
  });
}

export function createInputReadinessAuditFromWorkspace({ state = {}, workspace = {}, generatedAt = '' } = {}) {
  return buildInputReadinessAudit({
    generatedAt,
    sourceA: createReadinessSideInputFromWorkspace({ state, workspace, side: 'a' }),
    targetB: createReadinessSideInputFromWorkspace({ state, workspace, side: 'b' }),
  });
}

export function serializeInputReadinessAuditJson(audit = {}) {
  return `${JSON.stringify(audit, null, 2)}\n`;
}
