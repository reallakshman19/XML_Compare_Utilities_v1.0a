import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ciiByteStringToBytes,
  ciiBytesEqual,
  ciiBytesToByteString,
  ciiSha256,
  detectCiiNeutralVersion,
} from '../tabs/cii-workspace/cii-workspace-v11-v14-converter.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FROZEN = `${ROOT}/converters/scripts/cii-v11-v14-upstream`;
const EXPECTED = Object.freeze({
  'cii_v11_v14.py': '6152f28c0c43b4d70029f360d993da5794310c8a',
  'cii_v11_v14_format.py': '56f59fb7e095a887fc84e8a008a5f40acbadaec5',
  'cii_v11_v14_records.py': '1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235',
  'cii_v11_v14_sif.py': '88c1d80bdb7bd2d5197a56c5be60ac2057c02367',
  'cii_v11_v14_validate.py': '8e6896e8b61ac3c90d579139d39b29a6ace1637c',
  'cii2019_section_rules.py': 'efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e',
});

function gitBlobSha(path) {
  const bytes = readFileSync(path);
  const header = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

for (const [fileName, expectedSha] of Object.entries(EXPECTED)) {
  assert.equal(gitBlobSha(`${FROZEN}/${fileName}`), expectedSha, `${fileName} must remain byte-identical to pinned 3D_Converters source`);
}

const localRulesSha = gitBlobSha(`${ROOT}/converters/scripts/cii2019_section_rules.py`);
assert.notEqual(localRulesSha, EXPECTED['cii2019_section_rules.py'], 'test requires dependency drift to remain explicit rather than silently sharing local rules');

const worker = readFileSync(`${ROOT}/converters/cii-v11-v14-writer-worker.js`, 'utf8');
assert.match(worker, /\.\/scripts\/cii-v11-v14-upstream\//);
assert.match(worker, /const FROZEN_SCRIPT_BLOBS = Object\.freeze/);
for (const [fileName, expectedSha] of Object.entries(EXPECTED)) {
  assert.match(worker, new RegExp(`['"]${fileName.replaceAll('.', '\\.') }['"]\\s*:\\s*['"]${expectedSha}['"]`), `${fileName} runtime blob identity must be pinned in worker`);
}
assert.match(worker, /new TextEncoder\(\)\.encode\(`blob \$\{bytes\.byteLength\}\\0`\)/);
assert.match(worker, /crypto\.subtle\.digest\('SHA-1', payload\)/);
assert.match(worker, /Frozen \$\{fileName\} Git blob mismatch/);
assert.match(worker, /response\.arrayBuffer\(\)/);
assert.match(worker, /FS\.writeFile\(`\/scripts\/\$\{fileName\}`, bytes\)/);
assert.doesNotMatch(worker, /response\.text\(\)/);
assert.match(worker, /cii2019_section_rules\.py/);
assert.doesNotMatch(worker, /FROZEN_SCRIPT_ROOT\s*=\s*['"]\.\/scripts\/['"]/);
assert.match(worker, /FS\.unlink\(path\)/);
assert.match(worker, /cleanupJobDir\(pyodide, jobDir, \[inputPath, outputPath, auditPath\]\)/);
assert.ok(
  worker.indexOf("if (!inputBytes.byteLength) throw new Error('Primary CII input is empty.');") < worker.indexOf('pyodide.FS.mkdirTree(jobDir);'),
  'empty input must be rejected before allocating a job directory',
);
assert.match(worker, /let jobQueue = Promise\.resolve\(\);/);
assert.match(worker, /jobQueue\.then\(\(\) => runJob\(message\)\)/);
assert.match(worker, /jobQueue = current\.catch\(\(\) => undefined\)/);
assert.doesNotMatch(worker, /self\.addEventListener\('message', async \(event\)/);

const converter = readFileSync(`${ROOT}/tabs/cii-workspace/cii-workspace-v11-v14-converter.js`, 'utf8');
assert.match(converter, /frozen-3d-converters-7/);
assert.match(converter, /const AUDIT_SCHEMA = 'cii-v11-v14-conversion-audit\/v1'/);
assert.match(converter, /CII_VERSION_BRIDGE_AUDIT_SCHEMA_MISMATCH/);
assert.match(converter, /CII_VERSION_BRIDGE_AUDIT_ARRAY_REQUIRED/);
assert.match(converter, /CII_VERSION_BRIDGE_SOURCE_BYTE_COUNT_AUDIT_MISMATCH/);
assert.match(converter, /CII_VERSION_BRIDGE_TARGET_BYTE_COUNT_AUDIT_MISMATCH/);
assert.match(converter, /function frozenAuditSnapshot\(value\)/);
assert.match(converter, /loss_events:\s*Object\.freeze/);
assert.match(converter, /warnings:\s*Object\.freeze/);
assert.match(converter, /changed_sections:\s*Object\.freeze/);
assert.match(converter, /result\.audit\.loss_events\.length/);
assert.match(converter, /CII_VERSION_BRIDGE_SOURCE_SHA256_AUDIT_MISMATCH/);
assert.match(converter, /CII_VERSION_BRIDGE_TARGET_SHA256_AUDIT_MISMATCH/);
assert.match(converter, /Math\.abs\(numeric - major\) > 1e-6/);
assert.match(converter, /addEventListener\('messageerror'/);
assert.match(converter, /pending\.delete\(jobId\);\s*reject\(new Error\(`Failed to post CAESAR v11\/v14 conversion job:/s);

const bridge = readFileSync(`${ROOT}/tabs/cii-workspace/cii-workspace-writer-version-bridge.js`, 'utf8');
assert.match(bridge, /ca8d391ac5f829f53bebb3c37adf0547c34a67b4/);
assert.match(bridge, /projectCanonicalV14WriterDelta/);
assert.match(bridge, /assertCiiV14Writer2FixedFieldAuthority/);
assert.match(bridge, /CIIWorkspaceWriterVersionBridge\.v2/);
assert.match(bridge, /ORIGINAL_V14_BYTES_PLUS_CANONICAL_WRITER_DELTA/);
assert.match(bridge, /wholeFileCanonicalRewriteAllowed:\s*false/);
assert.match(bridge, /canonicalBaselineUsedAsOutput:\s*false/);
assert.match(bridge, /baselineCanonicalSha256:\s*up\.targetSha256/);
assert.match(bridge, /exactRoundTrip:\s*ciiBytesEqual\(conversionInput, up\.outputBytes\)/);
assert.doesNotMatch(bridge, /BASELINE_ROUNDTRIP_NOT_EXACT/);
assert.match(bridge, /CII_VERSION_BRIDGE_BASELINE_CANONICAL_SHA_MISMATCH/);
assert.match(bridge, /CII_VERSION_BRIDGE_CANONICAL_MODIFIED_ROUNDTRIP_NOT_EXACT/);
assert.match(bridge, /CII_VERSION_BRIDGE_PROJECTED_V14_NORMALIZED_POSTIMAGE_MISMATCH/);
assert.match(bridge, /projectCanonicalV14WriterDelta\(\s*normalized\.originalBytes,\s*normalized\.baselineCanonicalBytes,\s*upgraded\.outputBytes/s);
assert.match(bridge, /ciiBytesEqual\(v11PostimageBytes, canonicalProof\.outputBytes\)/);
assert.match(bridge, /ciiBytesEqual\(v11PostimageBytes, projectedProof\.outputBytes\)/);
assert.match(bridge, /modifiedTargetSha256 = await ciiSha256\(projection\.outputBytes/);
assert.match(bridge, /byteString:\s*ciiBytesToByteString\(projection\.outputBytes\)/);
assert.match(bridge, /fixedFieldAuthority,/);
assert.ok(
  bridge.indexOf('const fixedFieldAuthority = assertCiiV14Writer2FixedFieldAuthority(')
    < bridge.indexOf('const projection = projectCanonicalV14WriterDelta('),
  'V14 Writer2 fixed-field authority must be checked before canonical delta projection',
);
assert.doesNotMatch(bridge, /byteString:\s*ciiBytesToByteString\(upgraded\.outputBytes\)/);
assert.doesNotMatch(bridge, /convertCiiNeutralVersionLossless\(v11Result\.text/);
assert.doesNotMatch(bridge, /allowLossy\s*:\s*true/);

const fixedFieldAuthority = readFileSync(`${ROOT}/tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js`, 'utf8');
assert.match(fixedFieldAuthority, /CIIWorkspaceV14Writer2FixedFieldAuthority\.v1/);
assert.match(fixedFieldAuthority, /'0:3': 'CONTROL_NODENAME_NONAM_COUNT'/);
assert.match(fixedFieldAuthority, /'1:3': 'CONTROL_RESTRAINT_BLOCK_COUNT'/);
assert.match(fixedFieldAuthority, /'2:4': 'CONTROL_SIF_TEE_BLOCK_COUNT'/);
assert.match(fixedFieldAuthority, /'12:3': 'ELEMENT_RESTRAINT_POINTER'/);
assert.match(fixedFieldAuthority, /'13:4': 'ELEMENT_SIF_TEE_POINTER'/);
assert.match(fixedFieldAuthority, /'13:5': 'ELEMENT_NODENAME_POINTER'/);
assert.match(fixedFieldAuthority, /CII_V14_WRITER2_FIXED_FIELD_NOT_AUTHORIZED/);
assert.match(fixedFieldAuthority, /CII_V14_WRITER2_CONTROL_COUNT_CLAIM_REQUIRED/);
assert.match(fixedFieldAuthority, /CII_V14_WRITER2_CONTROL_COUNT_CHANGED_WITHOUT_CARDINALITY/);
assert.match(fixedFieldAuthority, /CII_V14_WRITER2_POINTER_CLAIM_REQUIRED/);
assert.match(fixedFieldAuthority, /CII_V14_WRITER2_CARDINALITY_INCREASE_NOT_AUTHORIZED/);
assert.match(fixedFieldAuthority, /CII_V14_WRITER2_POINTER_OUT_OF_RANGE/);

const projection = readFileSync(`${ROOT}/tabs/cii-workspace/cii-workspace-v14-change-projection.js`, 'utf8');
assert.match(projection, /CIIWorkspaceV14ChangeProjection\.v2/);
assert.match(projection, /PROJECTABLE_CHANGED_SECTIONS/);
assert.match(projection, /if \(!PROJECTABLE_CHANGED_SECTIONS\.has\(baselineSection\.name\)\)/);
assert.match(projection, /CII_V14_PROJECTION_CHANGED_SECTION_NOT_AUTHORIZED/);
const projectionAuthorityBlock = projection.slice(
  projection.indexOf('const PROJECTABLE_CHANGED_SECTIONS'),
  projection.indexOf('const CARDINALITY_UNIT_ROWS'),
);
assert.doesNotMatch(projectionAuthorityBlock, /MISCEL_1/);
assert.match(projection, /CARDINALITY_UNIT_ROWS/);
assert.match(projection, /NODENAME:\s*1/);
assert.match(projection, /RESTRANT:\s*24/);
assert.match(projection, /'SIF&TEES':\s*14/);
assert.match(projection, /physical\.push\(\.\.\.originalSection\.rows\)/);
assert.match(projection, /MERGE_FIXED_ROW/);
assert.match(projection, /DELETE_UNITS/);
assert.match(projection, /INSERT_UNITS/);
assert.match(projection, /CII_V14_PROJECTION_AMBIGUOUS_DUPLICATE_UNIT/);
assert.match(projection, /CII_V14_PROJECTION_CARDINALITY_SECTION_NOT_QUALIFIED/);
assert.match(projection, /CII_V14_PROJECTION_NON_ISOLATED_CARDINALITY_RUN/);
assert.match(projection, /CII_V14_PROJECTION_UNIT_REORDER_NOT_AUTHORIZED/);
assert.match(projection, /CII_V14_PROJECTION_EQUAL_CARDINALITY_UNIT_REPLACEMENT_NOT_AUTHORIZED/);
assert.match(projection, /rejectEqualCardinalityUnitMutation/);
assert.match(projection, /CII_V14_PROJECTION_CHANGED_FIELD_PREIMAGE_MISMATCH/);
assert.match(projection, /CII_V14_PROJECTION_BASELINE_ORIGINAL_ROW_COUNT_MISMATCH/);
assert.doesNotMatch(projection, /return\s+modifiedCanonicalValue/);

const upstreamFormat = readFileSync(`${FROZEN}/cii_v11_v14_format.py`, 'utf8');
assert.match(upstreamFormat, /return f"\{value:#\.6G\}"/);
assert.match(upstreamFormat, /return f"\{value:\.6E\}"/);
assert.notEqual('   2.044599E+02 0.000000E+00', '   2.044600E+02 0.000000E+00');

const v11 = '#$ VERSION\n        5.00000      11.0000    1252\n#$ CONTROL\n';
const v14 = '#$ VERSION\r\n    5.00000      14.0000        1256\r\n#$ CONTROL\r\n';
assert.equal(detectCiiNeutralVersion(v11), 11);
assert.equal(detectCiiNeutralVersion(v14), 14);
assert.equal(ciiBytesEqual(v11, new TextEncoder().encode(v11)), true);
assert.throws(() => detectCiiNeutralVersion('#$ VERSION\n  5.0 12.0\n'), /UNSUPPORTED_VERSION/);
assert.throws(() => detectCiiNeutralVersion('#$ VERSION\n  5.0 11.4\n'), /UNSUPPORTED_VERSION/);

const expectedV11Sha = createHash('sha256').update(Buffer.from(v11, 'utf8')).digest('hex');
assert.equal(await ciiSha256(v11, webcrypto), expectedV11Sha);
const binaryFixture = Uint8Array.from([0x00, 0x41, 0x7f, 0x80, 0xff]);
const binaryString = ciiBytesToByteString(binaryFixture);
assert.deepEqual([...ciiByteStringToBytes(binaryString)], [...binaryFixture]);
assert.throws(() => ciiByteStringToBytes(String.fromCharCode(0x100)), /BYTE_STRING_INVALID/);

console.log('CII Workspace frozen 3D_Converters V11/V14 source + change-isolation custody: PASS');