import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import '../tabs/pipeline-3d-model/pipeline-3d-model-cad-production-hardening.js';
import {
  PipelineProfileModel,
  TABLE_HEADERS,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-model.js';
import {
  PipelineCadController,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-controller.js';
import {
  deleteProfileRowCommand,
  moveTable2ElevationCommand,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js';
import {
  auditPipelineCadRaw,
  getPipelineCadIndexStats,
  isProtectedPipelineCadRow,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-production-hardening.js';
import { formatStation } from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-math.js';

function validRaw() {
  return {
    table2a: `${TABLE_HEADERS.table2a.join('\t')}\n100\t—\t—\t0+000.0\t10.00\n110\t—\t10\t0+010.0\t11.00\n120\t—\t10\t0+020.0\t12.00`,
    table3a: `${TABLE_HEADERS.table3a.join('\t')}\n100\t110\t105\t10.0\n110\t120\t115\t10.0`,
    table3b: `${TABLE_HEADERS.table3b.join('\t')}\n—\t—\t105\tA/G`,
    table3c: `${TABLE_HEADERS.table3c.join('\t')}\n115\tPM-001`,
  };
}

function largeRaw(count = 2000) {
  const table2 = [TABLE_HEADERS.table2a.join('\t')];
  for (let index = 0; index < count; index += 1) {
    const h = 1000 + index;
    table2.push(`${h}\t—\t${index ? '1' : '—'}\t${formatStation(index)}\t${(200 + index / 100).toFixed(2)}`);
  }

  const table3 = [TABLE_HEADERS.table3a.join('\t')];
  for (let index = 0; index < count - 1; index += 1) {
    const fromH = 1000 + index;
    const toH = fromH + 1;
    table3.push(`${fromH}\t${toH}\t${fromH + 0.5}\t1.0`);
  }

  return {
    table2a: table2.join('\n'),
    table3a: table3.join('\n'),
    table3b: `${TABLE_HEADERS.table3b.join('\t')}\n—\t—\t1000.5\tA/G`,
    table3c: `${TABLE_HEADERS.table3c.join('\t')}\n1500\tPM-001`,
  };
}

class FakeField extends EventTarget {
  constructor(value) {
    super();
    this.value = value;
  }
}

class FakeDialog extends EventTarget {
  constructor(raw) {
    super();
    this.raw = Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, new FakeField(value)]));
    this.statuses = [{ textContent: '', dataset: {} }, { textContent: '', dataset: {} }];
  }

  querySelector(selector) {
    const match = String(selector).match(/^\[data-p3d-split="(table2a|table3a|table3b|table3c)-raw"\]$/);
    if (match) return this.raw[match[1]];
    return null;
  }

  querySelectorAll(selector) {
    if (selector === '[data-p3d-cad-status]') return this.statuses;
    return [];
  }
}

{
  const raw = validRaw();
  const audit = auditPipelineCadRaw(raw);
  assert.equal(audit.valid, true);
  assert.equal(audit.summary.errors, 0);

  const invalid = {
    ...raw,
    table3a: `${TABLE_HEADERS.table3a.join('\t')}\n100\t110\t105\t10.0\n112\t120\t116\t8.0`,
  };
  const invalidAudit = auditPipelineCadRaw(invalid);
  assert.equal(invalidAudit.valid, false);
  assert.ok(invalidAudit.issues.some((entry) => entry.code === 'TABLE3A_DISCONTINUITY' && entry.sourceLine === 2));
}

{
  const model = PipelineProfileModel.fromRaw(validRaw());
  const first = model.table2Rows[0];
  const middle = model.table2Rows[1];
  const last = model.table2Rows.at(-1);
  assert.equal(isProtectedPipelineCadRow(model, first.id), true);
  assert.equal(isProtectedPipelineCadRow(model, middle.id), false);
  assert.equal(isProtectedPipelineCadRow(model, last.id), true);
  assert.throws(() => model.deleteRow(first.id), /terminal anchors/i);
  assert.throws(() => model.deleteRow(last.id), /terminal anchors/i);
  assert.equal(model.deleteRow(middle.id).id, middle.id);
  assert.equal(model.table2Rows.length, 2);
}

{
  const dialog = new FakeDialog(validRaw());
  const controller = new PipelineCadController(dialog);
  const middle = controller.model.table2Rows[1];
  controller.execute(moveTable2ElevationCommand(controller.model, middle.id, 15.25), 'benchmark-move');
  assert.equal(controller.history.canUndo, true);

  let resetDetail = null;
  controller.addEventListener('historyReset', (event) => { resetDetail = event.detail; });
  assert.equal(controller.refreshFromRaw({ clearHistory: true, reloadGraphs: true, reason: 'manual-raw-input' }), true);
  assert.equal(resetDetail.discardedUndoCount, 1);
  assert.equal(resetDetail.discardedRedoCount, 0);
  assert.match(dialog.statuses[0].textContent, /history reset \(1 undo, 0 redo discarded\)/i);

  let rejected = null;
  controller.addEventListener('commandRejected', (event) => { rejected = event.detail; });
  const first = controller.model.table2Rows[0];
  const beforeCount = controller.model.table2Rows.length;
  assert.equal(controller.execute(deleteProfileRowCommand(controller.model, first.id), 'delete-profile-row'), false);
  assert.equal(controller.model.table2Rows.length, beforeCount);
  assert.match(rejected.error.message, /terminal anchors/i);
  controller.destroy();
}

{
  const raw = largeRaw();
  const started = performance.now();
  const model = PipelineProfileModel.fromRaw(raw);
  const rows = [
    ...model.table2Rows,
    ...model.table3LengthRows,
    ...model.table3DepthRows,
    ...model.table3MarkerRows,
  ];
  for (let index = 0; index < 20000; index += 1) {
    const row = rows[(index * 97) % rows.length];
    assert.equal(model.findRow(row.id)?.id, row.id);
  }
  const serialized = model.serializeRaw();
  const elapsedMs = performance.now() - started;
  const stats = getPipelineCadIndexStats(model);
  assert.equal(stats.size, rows.length);
  assert.equal(stats.table2Rows, 2000);
  assert.equal(stats.table3LengthRows, 1999);
  assert.match(serialized.table2a, /1\+999\.0/);
  assert.ok(elapsedMs < 5000, `Large-profile model/index benchmark exceeded 5000 ms: ${elapsedMs.toFixed(1)} ms`);
}

console.log('pipeline-3d-model CAD production hardening tests passed');
