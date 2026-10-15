import { deepFreeze } from './cii-workspace-contracts.js';

function text(value) { return String(value ?? '').trim(); }
function unique(values) { return [...new Set((values || []).map(text).filter(Boolean))]; }
function sourceMemberBlocker(code) {
  const value = text(code);
  if (!value || value.startsWith('CII_') || value.startsWith('TRANSFER_') || value.startsWith('MULTISOURCE_')) return false;
  return /^[A-Za-z0-9_-]+:/.test(value);
}
function scopeBound(scope) {
  return scope?.status === 'BOUND'
    && scope?.mode === 'EXPLICIT_APPLY_EXCLUDE'
    && scope?.authority === 'USER_EXPLICIT_OPERATION_SCOPE';
}
function messageFor(code) {
  if (sourceMemberBlocker(code)) {
    const split = String(code).indexOf(':');
    return `${String(code).slice(0, split)} is the first incomplete member prerequisite: ${String(code).slice(split + 1)}.`;
  }
  const messages = {
    MULTISOURCE_CORRESPONDENCE_NOT_READY: 'Aggregate source-set correspondence is not ready because at least one member prerequisite is incomplete.',
    CII_MS_CAUSAL_TRANSFER_UNAVAILABLE: 'Transfer Preview is unavailable until correspondence is ready.',
    CII_MS_CAUSAL_SCOPE_NOT_BINDABLE: 'Writer2 transfer scope cannot be bound until Transfer Preview is ready.',
    CII_MS_CAUSAL_WRITER_UNAVAILABLE: 'Writer2 is unavailable until the upstream prerequisite chain is resolved.',
    CII_MS_WRITER2_BOUND_SCOPE_REQUIRED: 'Explicit Writer2 APPLY / EXCLUDE scope has not been bound yet.',
    MULTISOURCE_TARGET_MUTATION_CONFLICT: 'Multiple source members propose conflicting NodeName mutations for the same physical target.',
  };
  return messages[code] || code;
}
function entry(stage, relation, code, dependsOn = []) {
  return deepFreeze({
    stage,
    relation,
    code,
    message: messageFor(code),
    dependsOn: deepFreeze(unique(dependsOn)),
  });
}

export function ciiMultiSourceBlockerCausality(transferPlan, readinessBlockers = []) {
  const planBlockers = unique(transferPlan?.blockers || []);
  const rawBlockers = unique(readinessBlockers);
  if (!rawBlockers.length && transferPlan?.status === 'PREVIEW_READY' && scopeBound(transferPlan?.transferScope)) {
    return deepFreeze({ status: 'READY', primary: deepFreeze([]), derived: deepFreeze([]), rawBlockers: deepFreeze([]) });
  }

  const primary = [];
  const derived = [];
  const consumed = new Set();
  const memberRoots = planBlockers.filter(sourceMemberBlocker);
  const correspondenceBlocked = planBlockers.includes('MULTISOURCE_CORRESPONDENCE_NOT_READY');
  const targetConflict = planBlockers.includes('MULTISOURCE_TARGET_MUTATION_CONFLICT');

  if (correspondenceBlocked) {
    if (memberRoots.length) {
      for (const code of memberRoots) { primary.push(entry('CORRESPONDENCE_MEMBER', 'PRIMARY', code)); consumed.add(code); }
      derived.push(entry('CORRESPONDENCE_AGGREGATE', 'DERIVED', 'MULTISOURCE_CORRESPONDENCE_NOT_READY', memberRoots));
      consumed.add('MULTISOURCE_CORRESPONDENCE_NOT_READY');
    } else {
      primary.push(entry('CORRESPONDENCE_AGGREGATE', 'PRIMARY', 'MULTISOURCE_CORRESPONDENCE_NOT_READY'));
      consumed.add('MULTISOURCE_CORRESPONDENCE_NOT_READY');
    }
    derived.push(entry('TRANSFER_PREVIEW', 'DERIVED', 'CII_MS_CAUSAL_TRANSFER_UNAVAILABLE', ['MULTISOURCE_CORRESPONDENCE_NOT_READY']));
    derived.push(entry('TRANSFER_SCOPE', 'DERIVED', 'CII_MS_CAUSAL_SCOPE_NOT_BINDABLE', ['CII_MS_CAUSAL_TRANSFER_UNAVAILABLE']));
    derived.push(entry('WRITER2', 'DERIVED', 'CII_MS_CAUSAL_WRITER_UNAVAILABLE', ['CII_MS_CAUSAL_SCOPE_NOT_BINDABLE']));
  }

  if (targetConflict) {
    primary.push(entry('TRANSFER_PREVIEW', 'PRIMARY', 'MULTISOURCE_TARGET_MUTATION_CONFLICT'));
    consumed.add('MULTISOURCE_TARGET_MUTATION_CONFLICT');
  }

  for (const code of planBlockers) {
    if (consumed.has(code)) continue;
    primary.push(entry('TRANSFER_PREVIEW', 'PRIMARY', code));
    consumed.add(code);
  }

  const bound = scopeBound(transferPlan?.transferScope);
  const transferBlocked = transferPlan?.status !== 'PREVIEW_READY';
  const upstreamBlocked = correspondenceBlocked || transferBlocked;
  if (transferBlocked && !correspondenceBlocked) {
    const transferRoots = primary.filter((row) => row.stage === 'TRANSFER_PREVIEW').map((row) => row.code);
    derived.push(entry('TRANSFER_SCOPE', 'DERIVED', 'CII_MS_CAUSAL_SCOPE_NOT_BINDABLE', transferRoots));
    derived.push(entry('WRITER2', 'DERIVED', 'CII_MS_CAUSAL_WRITER_UNAVAILABLE', ['CII_MS_CAUSAL_SCOPE_NOT_BINDABLE']));
  }
  if (!bound && !upstreamBlocked && rawBlockers.includes('CII_MS_WRITER2_BOUND_SCOPE_REQUIRED')) {
    primary.push(entry('TRANSFER_SCOPE', 'PRIMARY', 'CII_MS_WRITER2_BOUND_SCOPE_REQUIRED'));
    consumed.add('CII_MS_WRITER2_BOUND_SCOPE_REQUIRED');
    derived.push(entry('WRITER2', 'DERIVED', 'CII_MS_CAUSAL_WRITER_UNAVAILABLE', ['CII_MS_WRITER2_BOUND_SCOPE_REQUIRED']));
  }

  const derivedRaw = new Set([
    'CII_MS_WRITER2_TRANSFER_PLAN_NOT_PREVIEW_READY',
    'CII_MS_WRITER2_BOUND_SCOPE_REQUIRED',
  ]);
  for (const code of rawBlockers) {
    if (consumed.has(code)) continue;
    if (upstreamBlocked && derivedRaw.has(code)) { consumed.add(code); continue; }
    primary.push(entry(bound ? 'WRITER2' : 'TRANSFER_SCOPE', 'PRIMARY', code));
    consumed.add(code);
  }

  return deepFreeze({
    status: primary.length || derived.length ? 'BLOCKED' : 'READY',
    primary: deepFreeze(primary),
    derived: deepFreeze(derived),
    rawBlockers: deepFreeze(rawBlockers),
  });
}

export const _test = Object.freeze({ sourceMemberBlocker, scopeBound, messageFor });
