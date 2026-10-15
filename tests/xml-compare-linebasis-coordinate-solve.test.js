import assert from 'node:assert/strict';

import { inputXmlToCategorizedInputXml, _test } from '../xml-compare/CategorizedInputXmlConverter.js';

// Line-basis InputXML: DELTA_Z chain only, no global coordinates (the target-file case).
const lineBasisInput = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="1000.000000" TO_NODE="1010.000000" DELTA_X="-1.010100" DELTA_Y="-1.010100" DELTA_Z="-108.000000" DIAMETER="114.299995"/>
<PIPINGELEMENT FROM_NODE="1010.000000" TO_NODE="1020.000000" DELTA_X="-1.010100" DELTA_Y="-1.010100" DELTA_Z="-992.000000" DIAMETER="114.299995"/>
</PIPINGMODEL>
</CAESARII>`;

const cat = inputXmlToCategorizedInputXml(lineBasisInput, { sourceName: 'line-basis-target' });

// Root-cause fix: a delta-only line-basis input must now emit DerivedCoordinateBlock per node.
assert.ok(/<DerivedCoordinateBlock>/.test(cat), 'line-basis input should emit DerivedCoordinateBlock');
const nodeCount = (cat.match(/<Node /g) || []).length;
const coordCount = (cat.match(/<DerivedCoordinateBlock>/g) || []).length;
assert.equal(coordCount, nodeCount, 'every node should carry a coordinate block');

// Seeded first-from (1000) at origin; chain integrates: 1010 = -108, 1020 = -108 + -992 = -1100.
function coordZ(node) {
  const m = cat.match(new RegExp(`<Node nodeNumber="${node}"[^>]*>[\\s\\S]*?<DerivedCoordinateBlock>([\\s\\S]*?)</DerivedCoordinateBlock>`));
  return m ? Number((m[1].match(/<(?:FROM|TO)_GLOBAL_Z>([^<]*)</) || [])[1]) : NaN;
}
assert.ok(Math.abs(coordZ(1000) - 0) < 0.01, `node 1000 Z should be 0, got ${coordZ(1000)}`);
assert.ok(Math.abs(coordZ(1010) - (-108)) < 0.01, `node 1010 Z should be -108, got ${coordZ(1010)}`);
assert.ok(Math.abs(coordZ(1020) - (-1100)) < 0.01, `node 1020 Z should be -1100, got ${coordZ(1020)}`);

// Anchor offset (compare-time translation) re-bases the target onto the source frame.
const src10z = -19800.000;
const offset = src10z - coordZ(1010);            // -19800 - (-108) = -19692
assert.ok(Math.abs((coordZ(1010) + offset) - src10z) < 0.01, 'anchor offset re-bases 1010 onto source 10');
assert.ok(Math.abs((coordZ(1020) + offset) - (-20792)) < 0.01, 'aligned 1020 Z should be -20792');

// Already-coordinated input (source case) must be a no-op: solver returns null, globals preserved.
const coordinatedInput = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input">
<PIPINGMODEL>
<PIPINGELEMENT FROM_NODE="10.000000" TO_NODE="20.000000" DELTA_Z="-108.000000" FROM_GLOBAL_X="23227.580" FROM_GLOBAL_Y="3257.150" FROM_GLOBAL_Z="-19800.000" TO_GLOBAL_X="23227.580" TO_GLOBAL_Y="3257.150" TO_GLOBAL_Z="-19908.000"/>
</PIPINGMODEL>
</CAESARII>`;
const coordinatedAttrs = _test.splitPipingElements(coordinatedInput).map((e) => _test.attrsOf(e.match(/^<PIPINGELEMENT\b[^>]*>/i)?.[0] || e.match(/^<PIPINGELEMENT\b[^>]*\/>/i)?.[0] || ''));
assert.equal(_test.solveGlobalsForElements(coordinatedAttrs), null, 'already-coordinated input should skip the solver');
const coordinatedCat = inputXmlToCategorizedInputXml(coordinatedInput, { sourceName: 'source' });
assert.ok(/<FROM_GLOBAL_X>23227.580<\/FROM_GLOBAL_X>/.test(coordinatedCat), 'existing global coordinates should be preserved');

console.log('XML Compare line-basis coordinate solve tests passed');
