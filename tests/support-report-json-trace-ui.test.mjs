import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderSupportReportJsonTrace } from '../tabs/support-steel-relationship-builder/support-report-view.js?v=20260911-support-report-pos-trace-20';

test('Support Report panel exposes staged JSON import without creating a second model authority', () => {
  const addon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
  assert.match(addon, /data-ssr-model-file/);
  assert.match(addon, /Staged JSON trace source/);
  assert.match(addon, /same combined staged-model source as the Input tab/i);
  assert.match(addon, /popup\.querySelector\('\[data-ssrb-input="model"\]'\)/);
  assert.doesNotMatch(addon, /data-ssr-model[^-]/);
  assert.match(addon, /JSON trace groups native evidence by staged POS while preserving observed-member mappings\./i);
});

test('JSON trace view renders one auditable row per POS cluster and keeps report location separate', () => {
  const member = (observedMemberId, resolvedMemberId, supportType) => ({
    observedMemberId, resolvedMemberId, matchBasis: 'DIRECT_MEMBER_ID',
    positionBasis: 'NATIVE_MEMBER_POSITION', positionGlobal: { x: 1, y: -2, z: 3 },
    attributeEvidence: { supportType, primarySupportReference: '=1/2', description: 'Pipe Guide', insulationThickness: '25mm' },
  });
  const members = [member('/PS-068.1', '/PS-068.1', 'REST'), member('/PS-068.2', '/PS-068.2', 'GUIDE')];
  const report = { rows: [{
    civilSecondarySupport: 'PS-068(REF)', pipe: 'ASIM-LINE',
    eastWest: 'E 100 mm', northSouth: 'S 200 mm', bopElevation: 'U 300 mm',
    evidence: { jsonTrace: {
      members,
      posClusters: [{
        posClusterId: 'POS:1|-2|3', positionGlobal: { x: 1, y: -2, z: 3 },
        observedMemberIds: ['/PS-068.1', '/PS-068.2'], resolvedMemberIds: ['/PS-068.1', '/PS-068.2'],
        matchBases: ['DIRECT_MEMBER_ID'], members,
      }],
    } },
  }] };
  const html = renderSupportReportJsonTrace(report);
  assert.match(html, /POS cluster/);
  assert.match(html, /POS:1\|-2\|3/);
  assert.match(html, /E 100 mm · S 200 mm · U 300 mm/);
  assert.match(html, /\/PS-068\.1, \/PS-068\.2/);
  assert.match(html, /REST, GUIDE/);
  assert.match(html, /do not merge separate Navisworks report locations/);
  assert.equal((html.match(/POS:1\|-2\|3/g) || []).length, 1);
});
