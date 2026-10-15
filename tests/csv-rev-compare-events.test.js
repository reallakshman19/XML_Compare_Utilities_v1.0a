import assert from 'node:assert/strict';

import { convertSupportRevisionPair } from '../tabs/csv-rev-compare/support-revision-pipeline.js';
import { buildSupportRevisionModel } from '../tabs/csv-rev-compare/support-revision-model.js';
import { buildSupportRevisionLineage } from '../tabs/csv-rev-compare/support-revision-lineage.js';
import { buildSupportRevisionEventLedger } from '../tabs/csv-rev-compare/support-revision-events.js';
import { renderSupportRevisionRemarks } from '../tabs/csv-rev-compare/support-revision-remarks.js';
import { compareLoadVectors, normalizeLoadVector } from '../tabs/csv-rev-compare/support-revision-loads.js';

const H = ['PREV NAME','SCOPE','CIVILSECONDARYSUPPORT','PIPE','SIZE','PIPING PRIMARY SUPPORT','SUPPORT TYPE','PIPING PRIMARY SUPPORT REFERENCE','EAST/WEST','NORTH/SOUTH','BOP ELEVATION','TOTAL SUPPORT POINTS ON SECONDARY','REMARKS (IF ANY)','PRIMARY SUPPORT DESCRIPTION','PRIMARY SUPPORT ZONE','PRIMARY SUPPORT SITE','PIPE SCHEDULE','INSULATION','STRESS SYSTEM NUMBER','NODE NO','REVISION','Fx','Fy','Fz','Fx','Fy','Fz'];
function row(overrides = {}) {
  const base = {'PREV NAME':'PS02012',SCOPE:'PL',CIVILSECONDARYSUPPORT:'SL-212',PIPE:'ASIM-1885-PL-4"-M8810130-02',SIZE:'4','PIPING PRIMARY SUPPORT':'/SL-212.3, /SL-212.1, /SL-212.4, /SL-212.2','SUPPORT TYPE':'SHOE-250, REST-250, MDS/AT05-10-PMP, MDS/ST06.10-PMP','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641, =1006657947/896, =1006649755/3642, =1006649755/4596','EAST/WEST':'E 1000','NORTH/SOUTH':'N 2000','BOP ELEVATION':'U 3000','TOTAL SUPPORT POINTS ON SECONDARY':'4','REMARKS (IF ANY)':'','PRIMARY SUPPORT DESCRIPTION':'','PRIMARY SUPPORT ZONE':'','PRIMARY SUPPORT SITE':'','PIPE SCHEDULE':'SCH40',INSULATION:'NONE','STRESS SYSTEM NUMBER':'SYS-1','NODE NO':'10',REVISION:'1','Fx#1':'','Fy#1':'','Fz#1':'','Fx#2':'','Fy#2':'','Fz#2':''};
  const values = { ...base, ...overrides }, ordinals = new Map();
  return H.map((header) => { const ordinal = (ordinals.get(header) || 0) + 1; ordinals.set(header, ordinal); return values[`${header}#${ordinal}`] ?? values[header] ?? ''; });
}
function csv(rows) { return [H, ...rows].map((cells) => cells.map(csvCell).join(',')).join('\n'); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text; }
function compare(rows1, rows2) {
  const pair = convertSupportRevisionPair(csv(rows1), csv(rows2));
  assert.equal(pair.ok, true, JSON.stringify(pair.diagnostics, null, 2));
  const source = buildSupportRevisionModel(pair.rev1), target = buildSupportRevisionModel(pair.rev2);
  const lineage = buildSupportRevisionLineage(source, target);
  const ledger = buildSupportRevisionEventLedger(source, target, lineage);
  return { source, target, lineage, ledger, remarks: renderSupportRevisionRemarks(ledger, source, target) };
}
function event(result, type) { return result.ledger.events.find((item) => item.type === type); }
function targetRemark(result, family) { const item = result.target.locations.find((location) => location.family === family); return item ? result.remarks.targetRemarks[item.sourceRowId]?.remark || '' : ''; }

// Independent slot-level load classification policy.
{
  const empty = normalizeLoadVector([{ sourceHeader:'Fy', ordinal:1, columnId:'Fy', raw:'' }, { sourceHeader:'Fy', ordinal:2, columnId:'Fy__2', raw:'' }]);
  const numeric = normalizeLoadVector([{ sourceHeader:'Fy', ordinal:1, columnId:'Fy', raw:'-13623' }, { sourceHeader:'Fy', ordinal:2, columnId:'Fy__2', raw:'-11594' }]);
  assert.equal(compareLoadVectors(empty, numeric).classification, 'LOAD_BECAME_NUMERIC');
  assert.equal(compareLoadVectors(numeric, numeric).classification, 'UNCHANGED');
  const changed = normalizeLoadVector([{ sourceHeader:'Fy', ordinal:1, columnId:'Fy', raw:'-14000' }, { sourceHeader:'Fy', ordinal:2, columnId:'Fy__2', raw:'-11594' }]);
  assert.equal(compareLoadVectors(numeric, changed).classification, 'LOAD_SIGNATURE_CHANGED');
}

// SL-212: persistent 3641 survives member renumbering; 4596 disappears; numeric vector changes.
{
  const before = row({'Fx#1':'100','Fy#1':'-3200','Fz#1':'50','Fx#2':'5','Fy#2':'-11594','Fz#2':'8'});
  const after = row({REVISION:'2','PIPING PRIMARY SUPPORT':'/SL-212.2, /SL-212.1, /SL-212.4','SUPPORT TYPE':'SHOE-250, REST-250, MDS/AT05-10-PMP','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641, =1006657947/896, =1006649755/3642','Fx#1':'100','Fy#1':'-3300','Fz#1':'50','Fx#2':'5','Fy#2':'-12000','Fz#2':'8'});
  const result = compare([before], [after]);
  const renumber = event(result, 'PRIMARY_MEMBER_RENUMBERED');
  const setChanged = event(result, 'SUPPORT_COMPONENT_SET_CHANGED');
  assert.equal(renumber.normalizedState.identity, 'SAME_COMPONENT');
  assert.ok(renumber.persistentReferences.includes('=1006649755/3641'));
  assert.deepEqual(setChanged.normalizedState.removedReferences, ['=1006649755/4596']);
  assert.ok(event(result, 'LOAD_SIGNATURE_CHANGED'));
  assert.equal(targetRemark(result, 'SL-212'), 'Support Type Changes, Minor Load change');
}

// PS02039 EMPTY -> NUMERIC projects only the governed load-standardised token.
{
  const before = row({'PREV NAME':'PS02039',CIVILSECONDARYSUPPORT:'SL-239','PIPING PRIMARY SUPPORT':'/SL-239.1','SUPPORT TYPE':'REST-50','PIPING PRIMARY SUPPORT REFERENCE':'=239/1'});
  const after = row({'PREV NAME':'PS02039',CIVILSECONDARYSUPPORT:'SL-239',REVISION:'2','PIPING PRIMARY SUPPORT':'/SL-239.1','SUPPORT TYPE':'REST-50','PIPING PRIMARY SUPPORT REFERENCE':'=239/1','Fx#1':'10','Fy#1':'20','Fz#1':'30','Fx#2':'40','Fy#2':'50','Fz#2':'60'});
  const result = compare([before], [after]);
  assert.ok(event(result, 'LOAD_BECAME_NUMERIC'));
  assert.equal(targetRemark(result, 'SL-239'), 'load standardised');
}

// Unchanged numeric load vector emits no load event/remark.
{
  const numeric = row({'PIPING PRIMARY SUPPORT':'/SL-212.3','SUPPORT TYPE':'SHOE-250','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641','Fx#1':'10','Fy#1':'20','Fz#1':'30','Fx#2':'40','Fy#2':'50','Fz#2':'60'});
  const result = compare([numeric], [numeric]);
  assert.ok(!event(result, 'LOAD_BECAME_NUMERIC'));
  assert.ok(!event(result, 'LOAD_SIGNATURE_CHANGED'));
  assert.equal(targetRemark(result, 'SL-212'), '');
}

// Target remarks are non-evidence and Hold text never creates automatic events.
{
  const before = row({'PIPING PRIMARY SUPPORT':'/SL-212.3','SUPPORT TYPE':'SHOE-250','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641','REMARKS (IF ANY)':'Support Hold'});
  const cleanTarget = row({REVISION:'2','PIPING PRIMARY SUPPORT':'/SL-212.3','SUPPORT TYPE':'SHOE-250','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641','REMARKS (IF ANY)':''});
  const poisonedTarget = row({REVISION:'2','PIPING PRIMARY SUPPORT':'/SL-212.3','SUPPORT TYPE':'SHOE-250','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641','REMARKS (IF ANY)':'Support Relocated, Hold Removed'});
  const a = compare([before], [cleanTarget]), b = compare([before], [poisonedTarget]);
  assert.deepEqual(a.ledger.events.map((item) => item.type), b.ledger.events.map((item) => item.type));
  assert.ok(!b.ledger.events.some((item) => /HOLD/.test(item.type)));
}

// Suppressed engineering metadata remains auditable but never becomes a remark token.
{
  const before = row({'PIPING PRIMARY SUPPORT':'/SL-212.3','SUPPORT TYPE':'SHOE-250','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641','PIPE SCHEDULE':'SCH40'});
  const after = row({REVISION:'2','PIPING PRIMARY SUPPORT':'/SL-212.3','SUPPORT TYPE':'SHOE-250','PIPING PRIMARY SUPPORT REFERENCE':'=1006649755/3641','PIPE SCHEDULE':'SCH80'});
  const result = compare([before], [after]);
  const suppressed = event(result, 'SUPPRESSED_FIELD_CHANGED');
  assert.equal(suppressed.remarkEligible, false);
  assert.equal(targetRemark(result, 'SL-212'), '');
}

console.log('csv-rev-compare event tests passed');
