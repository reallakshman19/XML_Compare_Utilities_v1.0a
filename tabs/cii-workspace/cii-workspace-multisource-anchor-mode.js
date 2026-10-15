/**
 * ARCH-01 A2-16: non-destructive SOURCE-local authority-mode projection.
 * Two retained evidence ledgers may coexist; ONLY the chosen lane is used by
 * the legacy Writer2 preview. This is NOT a joint correspondence certificate.
 */
import {buildCiiSelectedBaseLoops} from './cii-workspace-base-loop-selection.js';

export const CII_MS_AUTHORITY_MODES = Object.freeze(['AUTO','MANUAL']);

const item=(map,id)=>map instanceof Map?map.get(id):map?.[id];
const frozen=(value)=>Object.freeze(value);
const numericId=x=>{
 const s=String(x??'').trim(),n=Number(s);
 return s&&Number.isSafeInteger(n)?String(n):null;
};
export function ciiMultiSourceEffectiveMode(mode,manualPairs=[]){
 if(mode==='AUTO'||mode==='MANUAL')return mode;
 if(mode!==undefined&&mode!==null&&mode!=='')throw Error('CII_MS_UNKNOWN_ANCHOR_MODE');
 return manualPairs.length?'MANUAL':'AUTO'; // historical sessions were manual-first
}
export function buildCiiMultiSourceActiveAuthorityPlan(
 inspection,selectedBySource=new Map(),manualBySource=new Map(),modeBySource=new Map(),
){
 const entries=[],baseLoopsBySource={},anchorPairsBySource={};
 for(const member of inspection?.memberInspections||[]){
  const sourceId=String(member?.sourceId||'').trim();
  if(!sourceId||entries.some(e=>e.sourceId===sourceId))
   throw Error('CII_MS_DUPLICATE_OR_MISSING_SOURCE_MEMBER');
  const keys=item(selectedBySource,sourceId)||new Set();
  const loops=buildCiiSelectedBaseLoops(member.inspection?.baseAnchorSuggestions||[],keys);
  const supplied=item(manualBySource,sourceId)||[];
  if(!Array.isArray(supplied))throw Error('CII_MS_MANUAL_LEDGER_INVALID');
  const pairs=[],seen=new Set();
  for(const pair of supplied){
   const sourceNodeId=numericId(pair?.sourceNodeId),targetNodeId=numericId(pair?.targetNodeId);
   if(!sourceNodeId||!targetNodeId)throw Error('CII_MS_MANUAL_NODE_INVALID');
   const key=sourceNodeId+'=>'+targetNodeId;
   if(seen.has(key))continue;
   seen.add(key);pairs.push(frozen({sourceNodeId,targetNodeId}));
  }
  const mode=ciiMultiSourceEffectiveMode(item(modeBySource,sourceId),pairs);
  const active=mode==='AUTO'?loops:pairs;
  if(active.length){
   if(mode==='AUTO')baseLoopsBySource[sourceId]=loops;
   else anchorPairsBySource[sourceId]=pairs;
  }
  const autos=new Map();
  for(const loop of loops)for(const pair of loop.anchorPairs||[]){
   const key=String(pair.sourceNodeId),target=String(pair.targetNodeId);
   if(!autos.has(key))autos.set(key,new Set());
   autos.get(key).add(target);
  }
  const contradictoryManualPairs=pairs.flatMap(pair=>{
   const options=autos.get(pair.sourceNodeId);
   return options&&options.size&&!options.has(pair.targetNodeId)
    ?[frozen({sourceNodeId:pair.sourceNodeId,manualTargetNodeId:pair.targetNodeId,
      automaticTargetNodeIds:frozen([...options].sort())})]:[];
  });
  entries.push(frozen({
   sourceId,activeMode:mode,activeReady:active.length>0,
   retainedAutomaticBaseLoopCount:loops.length,retainedManualPairCount:pairs.length,
   inactiveAutomaticEvidenceCount:mode==='MANUAL'?loops.length:0,
   inactiveManualEvidenceCount:mode==='AUTO'?pairs.length:0,
   contradictoryManualPairs:frozen(contradictoryManualPairs),
   selectedLaneOnly:true,certifiedPhysicalPairs:0,writerAuthorizedByThisPlan:false,
  }));
 }
 return frozen({
  schema:'CiiMultiSourceAnchorMode.v1',
  rows:frozen(entries),
  ready:entries.length>0&&entries.every(x=>x.activeReady),
  baseLoopsBySource:frozen(baseLoopsBySource),
  anchorPairsBySource:frozen(anchorPairsBySource),
  simultaneousAuthorityDispatch:false,
  physicalIdentityCertified:false,
  writerAuthorizationGranted:false,
 });
}
