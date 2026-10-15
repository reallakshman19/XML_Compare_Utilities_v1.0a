import assert from 'node:assert/strict';

import {
  PIPELINE_CAD_DIAGNOSTICS_SCHEMA,
  PIPELINE_CAD_SOAK_AUDIT_SCHEMA,
  PIPELINE_CAD_SOAK_LEDGER_SCHEMA,
  PIPELINE_CAD_SOAK_MAX_EVENTS,
  PIPELINE_CAD_SOAK_MAX_SESSIONS,
  PIPELINE_CAD_SOAK_STORAGE_KEY,
  buildPipelineCadDiagnosticsBundle,
  clearPipelineCadSoakLedger,
  createPipelineCadSoakAudit,
  normalizePipelineCadSoakLedger,
  readPipelineCadSoakLedger,
  recordPipelineCadEvidence,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-soak-evidence.js';
import {
  sanitizePipelineCadSoakStorage,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-soak-evidence-hardening.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.values = new Map(Object.entries(entries));
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage({ pipeline3dCadRenderer: 'canvas' });
const sessionStorage = new MemoryStorage();
const baseOptions = {
  storage,
  sessionStorage,
  target: {
    devicePixelRatio: 1.5,
    innerWidth: 1440,
    innerHeight: 900,
    navigator: { language: 'en-GB' },
    document: null,
  },
};

clearPipelineCadSoakLedger(storage);

{
  const started = recordPipelineCadEvidence('session-start', {
    renderer: 'canvas',
    runtimeBuild: 'test-runtime',
    devicePixelRatio: 1.5,
    viewportWidth: 1440,
    viewportHeight: 900,
    language: 'en-GB',
    rawTable: 'SECRET RAW TABLE VALUE',
  }, {
    ...baseOptions,
    sessionId: 'session-1',
    now: '2026-07-13T05:00:00.000Z',
  });
  assert.equal(started.ledger.schema, PIPELINE_CAD_SOAK_LEDGER_SCHEMA);
  assert.equal(started.audit.verdict, 'IN_PROGRESS');

  recordPipelineCadEvidence('workspace-mounted', {
    renderer: 'canvas',
    table2Rows: 3,
    table3LengthRows: 3,
    table3DepthRows: 2,
    table3MarkerRows: 1,
    table2a: 'SECRET RAW TABLE VALUE',
  }, {
    ...baseOptions,
    sessionId: 'session-1',
    now: '2026-07-13T05:00:01.000Z',
  });

  const ledger = readPipelineCadSoakLedger(storage);
  const serialized = JSON.stringify(ledger);
  assert.equal(ledger.sessions.length, 1);
  assert.equal(ledger.sessions[0].counters.mounts, 1);
  assert.equal(serialized.includes('SECRET RAW TABLE VALUE'), false, 'raw table content must not enter the soak ledger');
  assert.equal(serialized.includes('table2a'), false, 'raw table field names must not enter evidence details');
}

{
  for (const [index, sessionId] of ['session-2', 'session-3'].entries()) {
    recordPipelineCadEvidence('session-start', { renderer: 'canvas' }, {
      ...baseOptions,
      sessionId,
      now: `2026-07-13T05:01:0${index}.000Z`,
    });
    recordPipelineCadEvidence('workspace-mounted', {
      renderer: 'canvas',
      table2Rows: 3,
      table3LengthRows: 3,
    }, {
      ...baseOptions,
      sessionId,
      now: `2026-07-13T05:01:1${index}.000Z`,
    });
  }

  const audit = createPipelineCadSoakAudit(readPipelineCadSoakLedger(storage), {
    now: '2026-07-13T05:02:00.000Z',
  });
  assert.equal(audit.schema, PIPELINE_CAD_SOAK_AUDIT_SCHEMA);
  assert.equal(audit.verdict, 'READY');
  assert.equal(audit.progress.successfulCanvasSessions, 3);
  assert.equal(audit.progress.successfulMounts, 3);
}

{
  recordPipelineCadEvidence('validation-error', {
    name: 'PipelineCadProfileValidationError',
    firstCode: 'TABLE3A_DISCONTINUITY',
    errors: 1,
    warnings: 0,
  }, {
    ...baseOptions,
    sessionId: 'session-3',
    now: '2026-07-13T05:03:00.000Z',
  });
  const audit = createPipelineCadSoakAudit(readPipelineCadSoakLedger(storage));
  assert.equal(audit.verdict, 'READY', 'correctable profile validation errors must not block runtime soak readiness');
  assert.equal(audit.summary.validationErrors, 1);
}

{
  recordPipelineCadEvidence('runtime-error', {
    name: 'PipelineCadRuntimeError',
    message: 'PipelineCad synthetic runtime failure\nwith private detail',
    raw: 'SECRET RAW TABLE VALUE',
  }, {
    ...baseOptions,
    sessionId: 'session-3',
    now: '2026-07-13T05:04:00.000Z',
  });
  const audit = createPipelineCadSoakAudit(readPipelineCadSoakLedger(storage));
  assert.equal(audit.verdict, 'BLOCKED');
  assert.ok(audit.blockers.some((blocker) => blocker.code === 'CAD_RUNTIME_ERRORS_PRESENT'));
  assert.equal(audit.summary.runtimeErrors, 1);
}

{
  const bundle = buildPipelineCadDiagnosticsBundle({
    ...baseOptions,
    now: '2026-07-13T05:05:00.000Z',
  });
  const serialized = JSON.stringify(bundle);
  assert.equal(bundle.schema, PIPELINE_CAD_DIAGNOSTICS_SCHEMA);
  assert.equal(bundle.privacy.rawTablesIncluded, false);
  assert.equal(bundle.privacy.xmlIncluded, false);
  assert.equal(bundle.privacy.modelRowsIncluded, false);
  assert.equal(bundle.runtime.renderer, 'canvas');
  assert.equal(bundle.soakAudit.verdict, 'BLOCKED');
  assert.equal(serialized.includes('SECRET RAW TABLE VALUE'), false);
}

{
  const oversized = {
    schema: PIPELINE_CAD_SOAK_LEDGER_SCHEMA,
    sessions: Array.from({ length: PIPELINE_CAD_SOAK_MAX_SESSIONS + 5 }, (_, sessionIndex) => ({
      id: `retention-${sessionIndex}`,
      renderer: 'canvas',
      counters: { mounts: 1 },
      events: Array.from({ length: PIPELINE_CAD_SOAK_MAX_EVENTS + 20 }, (_, eventIndex) => ({
        type: 'command-committed',
        recordedAt: '2026-07-13T05:00:00.000Z',
        detail: { reason: `event-${eventIndex}` },
      })),
    })),
  };
  const normalized = normalizePipelineCadSoakLedger(oversized, {
    now: '2026-07-13T05:06:00.000Z',
  });
  assert.equal(normalized.sessions.length, PIPELINE_CAD_SOAK_MAX_SESSIONS);
  assert.equal(normalized.sessions[0].id, 'retention-5');
  assert.equal(normalized.sessions.at(-1).events.length, PIPELINE_CAD_SOAK_MAX_EVENTS);
}

{
  const pollutedStorage = new MemoryStorage({
    pipeline3dCadRenderer: 'canvas',
    [PIPELINE_CAD_SOAK_STORAGE_KEY]: JSON.stringify({
      schema: PIPELINE_CAD_SOAK_LEDGER_SCHEMA,
      sessions: [{
        id: 'polluted',
        renderer: 'canvas',
        counters: { mounts: 1 },
        events: [{
          type: 'workspace-mounted',
          recordedAt: '2026-07-13T05:07:00.000Z',
          detail: {
            table2Rows: 3,
            table3LengthRows: 3,
            rawTable: 'PERSISTED SECRET TABLE VALUE',
            xml: '<Secret>value</Secret>',
          },
        }],
      }],
    }),
  });
  const sanitized = sanitizePipelineCadSoakStorage(pollutedStorage, {
    now: '2026-07-13T05:08:00.000Z',
  });
  const serialized = JSON.stringify(sanitized);
  assert.equal(serialized.includes('PERSISTED SECRET TABLE VALUE'), false);
  assert.equal(serialized.includes('<Secret>'), false);
  assert.deepEqual(Object.keys(sanitized.sessions[0].events[0].detail).sort(), [
    'renderer',
    'table2Rows',
    'table3DepthRows',
    'table3LengthRows',
    'table3MarkerRows',
  ]);
}

assert.ok(storage.getItem(PIPELINE_CAD_SOAK_STORAGE_KEY));
console.log('pipeline-3d-model CAD soak evidence tests passed');
