import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge}
 from '../tabs/cii-workspace/cii-workspace-source-set.js';
import {inspectCiiGeometryDiscrepancy,assertCiiGeometryReviewCannotWrite}
 from '../tabs/cii-workspace/cii-workspace-geometry-discrepancy-review.js';
import {CII_A217_DEFAULT_DRAFT}
 from '../tabs/cii-workspace/cii-workspace-geometry-discrepancy-ui.js';
const fixture=n=>readFileSync(fileURLToPath(new URL('../Benchmark/'+n,import.meta.url)));
const sources=['S1','S2','S3'].map(sourceId=>({
 sourceId,fileName:sourceId+'.CII',bytes:fixture(sourceId+'.CII'),
}));
const {inspection,preparedSession}=await prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge({
 sources,targetBytes:fixture('T.CII'),targetFileName:'T.CII',
},{cryptoRef:globalThis.crypto||webcrypto});
assert.equal(preparedSession.schema,'CIIWorkspacePreparedSourceSetSession.v1');
assert.equal(preparedSession.members.length,3);
const source=preparedSession.members.find(x=>x.sourceId==='S2');
const target=preparedSession.target;
assert(source&&target);
const sourceGraphBefore=JSON.stringify({nodes:source.sourceGraph.nodes,edges:source.sourceGraph.edges});
const targetGraphBefore=JSON.stringify({nodes:target.targetGraph.nodes,edges:target.targetGraph.edges});

const bendArgs={sourceId:'S2',sourceNodeId:'630',targetNodeId:'10470',
 sourceElementId:'E43:620->630',targetElementId:'E1017:10460->10470',
 dxMm:0,dyMm:0,dzMm:0,sourceElementLengthAdjustmentMm:-200};
const bend=inspectCiiGeometryDiscrepancy(preparedSession,bendArgs);
assert.equal(bend.schema,'CiiGeometryDiscrepancyReview.v1');
assert.equal(bend.provenance.sourceOriginalSha256,source.originalSha256);
assert.equal(bend.provenance.targetOriginalSha256,target.originalSha256);
assert.equal(bend.provenance.sourceSetSha256,inspection.sourceSet.sourceSetSha256);
assert.equal(bend.originalPhysicalPair.sourceElement.recordedLengthMm,774.55);
assert.equal(bend.originalPhysicalPair.targetElement.recordedLengthMm,574.55);
assert.equal(bend.originalPhysicalPair.recordedTargetMinusSourceLengthMm,-200);
assert.equal(bend.proposedAdjustment.sourceElementRecordedLengthAdjustmentMm,-200);
assert.equal(bend.proposedAdjustment.hypotheticalAdjustedSourceElementLengthMm,574.55);
assert.equal(bend.proposedAdjustment.hypotheticalElementLengthResidualMm,0);
assert(bend.warnings.includes('BEND_RECORDED_LENGTH_CANNOT_BE_INFERRED_AS_STRAIGHT_DISPLACEMENT'));
assert(bend.warnings.includes('SOURCE_TARGET_COORDINATES_NOT_INDEPENDENTLY_REGISTERED'));
assert.equal(bend.engineeringReady,false);
assert.equal(bend.physicalIdentityCertified,false);
assert.equal(bend.writerReady,false);
assert.equal(bend.transferPlan,null);
assert.equal(bend.writeScope,null);
assert.equal(bend.certifiedNodeCount,0);
assert.deepEqual(bend.correspondenceCertificates,[]);
assert(Object.isFrozen(bend));
assert(Object.isFrozen(bend.originalPhysicalPair));
assert(Object.isFrozen(bend.proposedAdjustment));

const translated=inspectCiiGeometryDiscrepancy(preparedSession,{
 ...bendArgs,sourceElementLengthAdjustmentMm:0,dyMm:-200,
});
assert.deepEqual(translated.proposedAdjustment.sourceTranslationMm,[0,-200,0]);
assert.equal(translated.originalPhysicalPair.recordedTargetMinusSourceLengthMm,-200);
assert.equal(translated.proposedAdjustment.hypotheticalElementLengthResidualMm,-200,
 'a proposed XYZ translation cannot silently change BEND scalar length');
const adjust100=inspectCiiGeometryDiscrepancy(preparedSession,{
 ...bendArgs,dyMm:-100,sourceElementLengthAdjustmentMm:-100,
});
assert.equal(adjust100.proposedAdjustment.hypotheticalElementLengthResidualMm,-100);
assert.deepEqual(adjust100.proposedAdjustment.sourceTranslationMm,[0,-100,0]);
assert.equal(adjust100.physicalIdentityCertified,false);
const pipe=inspectCiiGeometryDiscrepancy(preparedSession,{
 sourceId:'S2',sourceNodeId:'210',targetNodeId:'10130',
 sourceElementId:'E11:210->220',targetElementId:'E983:10130->10140',
 sourceElementLengthAdjustmentMm:1500,
});
assert.equal(pipe.originalPhysicalPair.sourceElement.type,'PIPE');
assert.equal(pipe.originalPhysicalPair.sourceElement.recordedLengthMm,6500);
assert.equal(pipe.originalPhysicalPair.targetElement.recordedLengthMm,8000);
assert.equal(pipe.originalPhysicalPair.recordedTargetMinusSourceLengthMm,1500);
assert.equal(pipe.proposedAdjustment.hypotheticalElementLengthResidualMm,0);
assert.equal(pipe.writerReady,false);

const terminal=inspectCiiGeometryDiscrepancy(preparedSession,{
 sourceId:'S2',sourceNodeId:'40',targetNodeId:'40030',dyMm:100,
});
assert.equal(terminal.originalPhysicalPair.sourceElement,null);
assert.equal(terminal.originalPhysicalPair.targetElement,null);
assert.equal(terminal.proposedAdjustment.hypotheticalElementLengthResidualMm,null);
assert(terminal.warnings.includes('SOURCE_TARGET_NODE_DEGREE_MISMATCH'));
assert.equal(terminal.writerReady,false);
assert.throws(()=>assertCiiGeometryReviewCannotWrite(terminal),/REVIEW_NEVER_CERTIFICATION_OR_WRITER_AUTHORITY/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 sourceId:'S4'}),/ORIGINAL_SOURCE_CUSTODY_REQUIRED/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 sourceNodeId:'99999999'}),/NODE_NOT_IN_ORIGINAL_SOURCE/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 targetNodeId:'99999999'}),/NODE_NOT_IN_ORIGINAL_TARGET/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 targetElementId:'E983:10130->10140'}),/NODE_NOT_INCIDENT_TO_ELEMENT_TARGET/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 targetElementId:''}),/BOTH_ELEMENTS_OR_NEITHER_REQUIRED/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 dxMm:Infinity}),/OUT_OF_RANGE_HYPOTHESIS_MM/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 dxMm:5001}),/OUT_OF_RANGE_HYPOTHESIS_MM/);
assert.throws(()=>inspectCiiGeometryDiscrepancy(preparedSession,{...bendArgs,
 sourceElementLengthAdjustmentMm:-1000}),/INVALID_PROPOSED_ELEMENT_LENGTH/);
const altered={...preparedSession,target:{...target,originalSha256:'stale'}};
assert.throws(()=>inspectCiiGeometryDiscrepancy(altered,bendArgs),/ORIGINAL_TARGET_CUSTODY_REQUIRED/);
const alteredMember={...preparedSession,members:preparedSession.members.map(m=>m.sourceId==='S2'
 ?{...m,normalizedSha256:'0'.repeat(64)}:m)};
assert.throws(()=>inspectCiiGeometryDiscrepancy(alteredMember,bendArgs),/ORIGINAL_SOURCE_CUSTODY_REQUIRED/);
assert.equal(JSON.stringify({nodes:source.sourceGraph.nodes,edges:source.sourceGraph.edges}),sourceGraphBefore);
assert.equal(JSON.stringify({nodes:target.targetGraph.nodes,edges:target.targetGraph.edges}),targetGraphBefore);
assert.equal(inspection.sourceSet.sourceSetSha256,bend.provenance.sourceSetSha256);
assert.equal(CII_A217_DEFAULT_DRAFT.dyMm,0);
const repeat=inspectCiiGeometryDiscrepancy(preparedSession,bendArgs);
assert.equal(JSON.stringify(repeat),JSON.stringify(bend));
console.log('PASS A2-17: genuine S2 BEND -200mm scalar and separate -100/-200mm XYZ hypotheses; 1500mm PIPE, terminal topology, SHA custody and Writer veto');
