import assert from 'node:assert/strict';
import {buildCiiMultiSourceActiveAuthorityPlan,ciiMultiSourceEffectiveMode}
 from '../tabs/cii-workspace/cii-workspace-multisource-anchor-mode.js';
import {restoreCiiWriter2AnchorSession,createCiiWriter2SessionSnapshot}
 from '../tabs/cii-workspace/cii-workspace-multisource-session-persistence.js';
import {readFile} from 'node:fs/promises';

const suggestion=(s,t)=>({sourceNodeId:s,targetNodeId:t,
 basisMethod:'METHOD_B_NETWORK',methodB:{status:'READY'},confidence:'HIGH'});
const inspect={sourceSet:{sourceSetSha256:'source-digest'},versionBridge:{target:{originalSha256:'target-digest'}},
 memberInspections:[
  {sourceId:'S1',inspection:{baseAnchorSuggestions:[suggestion('420','10330')]}},
  {sourceId:'S2',inspection:{baseAnchorSuggestions:[suggestion('100','900')]}},
 ]};
const selected=new Map([['S1',new Set(['420=>10330'])],['S2',new Set(['100=>900'])]]);
const manual=new Map([['S1',[{sourceNodeId:'420',targetNodeId:'415'}]],['S2',[]]]);
const modes=new Map([['S1','MANUAL'],['S2','AUTO']]);
const plan=buildCiiMultiSourceActiveAuthorityPlan(inspect,selected,manual,modes);
assert.equal(plan.schema,'CiiMultiSourceAnchorMode.v1');
assert.equal(plan.ready,true);
assert.deepEqual(Object.keys(plan.baseLoopsBySource),['S2']);
assert.deepEqual(plan.anchorPairsBySource.S1,[{sourceNodeId:'420',targetNodeId:'415'}]);
assert.equal(plan.rows[0].inactiveAutomaticEvidenceCount,1);
assert.equal(plan.rows[0].retainedAutomaticBaseLoopCount,1);
assert.equal(plan.rows[0].retainedManualPairCount,1);
assert.deepEqual(plan.rows[0].contradictoryManualPairs,[{
 sourceNodeId:'420',manualTargetNodeId:'415',automaticTargetNodeIds:['10330']
}]);
assert.equal(plan.simultaneousAuthorityDispatch,false);
assert.equal(plan.physicalIdentityCertified,false);
assert.equal(plan.writerAuthorizationGranted,false);
assert(Object.isFrozen(plan.rows[0]));
assert(Object.isFrozen(plan.rows[0].contradictoryManualPairs));
const auto=buildCiiMultiSourceActiveAuthorityPlan(inspect,selected,manual,
 new Map([['S1','AUTO'],['S2','AUTO']]));
assert.equal(auto.rows[0].inactiveManualEvidenceCount,1);
assert.equal(auto.anchorPairsBySource.S1,undefined);
assert.equal(auto.baseLoopsBySource.S1[0].method,'METHOD_B_NETWORK');
assert.deepEqual(auto.baseLoopsBySource.S1[0].anchorPairs,[
 {sourceNodeId:'420',targetNodeId:'10330'}
]);
assert.equal(auto.rows[0].retainedManualPairCount,1);
assert.equal(plan.anchorPairsBySource.S1[0].targetNodeId,'415');
assert.equal(ciiMultiSourceEffectiveMode(undefined,[{sourceNodeId:'420',targetNodeId:'415'}]),'MANUAL');
assert.equal(ciiMultiSourceEffectiveMode(undefined,[]),'AUTO');
assert.throws(()=>ciiMultiSourceEffectiveMode('MERGE',[]),/UNKNOWN_ANCHOR_MODE/);
const missing=buildCiiMultiSourceActiveAuthorityPlan(inspect,selected,manual,
 new Map([['S1','AUTO'],['S2','MANUAL']]));
assert.equal(missing.ready,false,'manual mode without manual evidence must not borrow auto authority');
assert.equal(missing.baseLoopsBySource.S2,undefined);
assert.equal(missing.anchorPairsBySource.S2,undefined);
const selectedMissing=buildCiiMultiSourceActiveAuthorityPlan(inspect,
 new Map([['S1',new Set()],['S2',new Set(['100=>900'])]]),manual,modes);
assert.equal(selectedMissing.ready,true,'explicit manual active route should still work without automatic bases');
assert.equal(selectedMissing.rows[0].retainedAutomaticBaseLoopCount,0);
const withBadNode=new Map([['S1',[{sourceNodeId:'not-a-node',targetNodeId:'415'}]]]);
assert.throws(()=>buildCiiMultiSourceActiveAuthorityPlan(inspect,selected,withBadNode,modes),
 /MANUAL_NODE_INVALID/);
const dupInspect={memberInspections:[inspect.memberInspections[0],inspect.memberInspections[0]]};
assert.throws(()=>buildCiiMultiSourceActiveAuthorityPlan(dupInspect,selected,manual,modes),
 /DUPLICATE_OR_MISSING_SOURCE_MEMBER/);
assert.throws(()=>buildCiiMultiSourceActiveAuthorityPlan(inspect,selected,manual,
 new Map([['S1','MERGE']])),/UNKNOWN_ANCHOR_MODE/);
const session=createCiiWriter2SessionSnapshot({
 sourceSetSha256:'source-digest',targetOriginalSha256:'target-digest',
 selectedBySource:selected,manualBySource:manual,authorityModeBySource:modes,
});
assert.deepEqual(session.selectedBySource.S1,['420=>10330']);
assert.equal(session.authorityModeBySource.S1,'MANUAL');
const restored=restoreCiiWriter2AnchorSession(session,inspect);
assert.deepEqual(restored.selectedBySource.S1,['420=>10330']);
assert.deepEqual(restored.manualBySource.S1,[{sourceNodeId:'420',targetNodeId:'415'}]);
assert.equal(restored.authorityModeBySource.S1,'MANUAL');
const revived=buildCiiMultiSourceActiveAuthorityPlan(inspect,restored.selectedBySource,
 restored.manualBySource,restored.authorityModeBySource);
assert.equal(revived.ready,true);
assert.equal(revived.rows[0].activeMode,'MANUAL');
assert.equal(revived.rows[0].inactiveAutomaticEvidenceCount,1);
const legacy=structuredClone(session);delete legacy.authorityModeBySource;
const restoredLegacy=restoreCiiWriter2AnchorSession(legacy,inspect);
assert.equal(restoredLegacy.authorityModeBySource.S1,'MANUAL');
assert.deepEqual(restoredLegacy.selectedBySource.S1,['420=>10330']);
const stale=structuredClone(session);stale.selectedBySource.S1.push('bad=>key');
const restoredStale=restoreCiiWriter2AnchorSession(stale,inspect);
assert.deepEqual(restoredStale.staleSelectionSourceIds,['S1']);
assert.deepEqual(restoredStale.selectedBySource.S1,['420=>10330']);
const ui=await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js',import.meta.url),'utf8');
for(const token of ['data-ciiw-ms-authority-switch','activeAnchorPlan().baseLoopsBySource',
 'activeAnchorPlan().anchorPairsBySource','authorityModeBySource.set(id, \'MANUAL\')',
 'authorityModeBySource.set(id, \'AUTO\')',
 'inactive evidence is retained, not applied'])
 assert(ui.includes(token),'UI authority separation '+token);
assert(!ui.includes('selectedBySource.set(id, new Set());'));
assert(!ui.includes('manualBySource.set(id, []); manualDraftBySource'));
for(const token of ['data-ciiw-ms-authority-conflict',
 'confidenceEpoch += 1;', 'reviewDecisions.clear(); commonAnalysisCache = createCiiCommonAnalysisCache();',
 'if (reviewButton) reviewButton.disabled = true;',
 'if (csvButton) csvButton.disabled = true;',
 'if (jsonButton) jsonButton.disabled = true;',
 "Anchor authority changed. Compare models again before reviewing or applying any transfer."])
 assert(ui.includes(token),'authority change must immediately invalidate stale review/scope: '+token);
console.log('PASS A2-16: both anchor evidence ledgers retained; explicit single authority routed; stale mode/review fail closed; no certification/Writer');
