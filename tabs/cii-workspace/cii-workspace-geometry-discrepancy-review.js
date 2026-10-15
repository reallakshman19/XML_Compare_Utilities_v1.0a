/**
 * ARCH-01 A2-17: source-bound, non-writing geometry revision hypothesis.
 * Observed BEND scalar length != end-node coordinate shift. Neither permits
 * physical identity certification, global tolerance expansion, or Writer.
 */
const HASH=/^[a-f0-9]{64}$/i;
const id=v=>String(v??'').trim();
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const rounded=v=>v==null?null:Math.abs(v)<0.0000005?0:Number(v.toFixed(6));
const fail=code=>{throw new Error('CII_A217_'+code)};
const deepFreeze=x=>Array.isArray(x)?Object.freeze(x.map(deepFreeze)):x&&typeof x==='object'
 ?Object.freeze(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,deepFreeze(v)]))):x;
const position=p=>{
 const a=Array.isArray(p)?p:[p?.x,p?.y,p?.z];
 return a?.length===3&&a.every(finite)?a:null;
};
const minus=(a,b)=>a.map((v,i)=>rounded(v-b[i]));
const magnitude=a=>rounded(Math.hypot(...a));
const sourceHashSession=s=>{
 if(s?.schema!=='CIIWorkspacePreparedSourceSetSession.v1'
   ||s?.authority!=='IMMUTABLE_NORMALIZED_MODEL_CUSTODY')
   fail('PREPARED_CUSTODY_REQUIRED');
 const sha=s?.sourceSetSha256,target=s?.target;
 if(!HASH.test(sha||'')||!HASH.test(target?.originalSha256||'')
  ||!HASH.test(target?.normalizedSha256||'')
  ||target?.targetGraph?.documentId!==`TARGET:${target.normalizedSha256}`)
  fail('ORIGINAL_TARGET_CUSTODY_REQUIRED');
 return s;
};
const indexed=(graph,nodeId,side)=>{
 if(!graph||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))fail('GRAPH_REQUIRED_'+side);
 const row=graph.nodes.find(n=>id(n.id)===nodeId);
 if(!row)fail('NODE_NOT_IN_ORIGINAL_'+side);
 return row;
};
const exactEdge=(graph,edgeId,nodeId,side)=>{
 if(!edgeId)return null;
 const edge=graph.edges.find(e=>id(e.elementId)===edgeId);
 if(!edge)fail('ELEMENT_NOT_IN_ORIGINAL_'+side);
 if(id(edge.from)!==nodeId&&id(edge.to)!==nodeId)
  fail('NODE_NOT_INCIDENT_TO_ELEMENT_'+side);
 const len=Number(edge.lengthMm);
 if(!Number.isFinite(len)||len<=0)fail('INVALID_ORIGINAL_ELEMENT_LENGTH_'+side);
 return {id:edgeId,from:id(edge.from),to:id(edge.to),
   type:String(edge.componentKind||'UNKNOWN'),recordedLengthMm:rounded(len)};
};
/**
 * options nodeId and targetNodeId are explicitly entered hypotheses; not
 * certified correspondence. Each displacement is a hypothetical SOURCE-only
 * coordinate-vector delta, never a real target or source modification.
 */
export function inspectCiiGeometryDiscrepancy(preparedSession,{
 sourceId,sourceNodeId,targetNodeId,sourceElementId='',targetElementId='',
 dxMm=0,dyMm=0,dzMm=0,sourceElementLengthAdjustmentMm=0,
}={}){
 const s=sourceHashSession(preparedSession);
 const member=s.members?.find(m=>m.sourceId===sourceId);
 if(!member||!HASH.test(member.originalSha256||'')
  ||!HASH.test(member.normalizedSha256||'')
  ||member.sourceGraph?.documentId!==`SOURCE:${member.normalizedSha256}`)
  fail('ORIGINAL_SOURCE_CUSTODY_REQUIRED');
 const aId=id(sourceNodeId),bId=id(targetNodeId);
 if(!/^-?\d+$/.test(aId)||! /^-?\d+$/.test(bId))fail('EXPLICIT_NODE_PAIR_REQUIRED');
 const source=indexed(member.sourceGraph,aId,'SOURCE');
 const target=indexed(s.target.targetGraph,bId,'TARGET');
 const vector=[dxMm,dyMm,dzMm];
 if(!vector.every(v=>finite(v)&&Math.abs(v)<=5000)
  ||!finite(sourceElementLengthAdjustmentMm)
  ||Math.abs(sourceElementLengthAdjustmentMm)>5000)
  fail('OUT_OF_RANGE_HYPOTHESIS_MM');
 const sourceEdge=exactEdge(member.sourceGraph,id(sourceElementId),aId,'SOURCE');
 const targetEdge=exactEdge(s.target.targetGraph,id(targetElementId),bId,'TARGET');
 if(Boolean(sourceEdge)!==Boolean(targetEdge))fail('BOTH_ELEMENTS_OR_NEITHER_REQUIRED');
 const original=position(source.position),tpos=position(target.position);
 const vectorAvailable=Boolean(original&&tpos);
 const adjusted=vectorAvailable?original.map((v,i)=>rounded(v+vector[i])):null;
 const originalDelta=vectorAvailable?minus(tpos,original):null;
 const adjustedResidual=vectorAvailable?minus(tpos,adjusted):null;
 const adjustedLength=sourceEdge?rounded(sourceEdge.recordedLengthMm+sourceElementLengthAdjustmentMm):null;
 if(sourceEdge&&adjustedLength<=0)fail('INVALID_PROPOSED_ELEMENT_LENGTH');
 const mismatch=sourceEdge?rounded(targetEdge.recordedLengthMm-sourceEdge.recordedLengthMm):null;
 const lengthResidual=sourceEdge?rounded(targetEdge.recordedLengthMm-adjustedLength):null;
 const warnings=[
  'UNVERIFIED_SOURCE_TARGET_NODE_IDENTITY',
  'SOURCE_TARGET_COORDINATES_NOT_INDEPENDENTLY_REGISTERED',
  'NO_OWNER_APPROVED_ENGINEERING_REVISION_OR_SURVEY_DATUM',
  'NO_INDEPENDENT_TWO_ENDED_PHYSICAL_GRAPH_CLOSURE',
  'TARGET_NODE_CUSTODY_NOT_INDEPENDENTLY_ADJUDICATED',
  'HYPOTHESIS_NOT_APPLIED_TO_MATCHER_OR_WRITER',
 ];
 if(!vectorAvailable)warnings.push('ORIGINAL_NODE_XYZ_MISSING_VECTOR_INFERENCE_BLOCKED');
 if(source.degree!==target.degree)warnings.push('SOURCE_TARGET_NODE_DEGREE_MISMATCH');
 if(sourceEdge&&sourceEdge.type!==targetEdge.type)warnings.push('ELEMENT_TYPE_MISMATCH');
 if(sourceEdge?.type==='BEND'||targetEdge?.type==='BEND')
  warnings.push('BEND_RECORDED_LENGTH_CANNOT_BE_INFERRED_AS_STRAIGHT_DISPLACEMENT');
 if(sourceEdge&&Math.abs(mismatch)>25)warnings.push('LARGE_RECORDED_LENGTH_DISCREPANCY_REQUIRES_INDEPENDENT_REVISION_EVIDENCE');
 return deepFreeze({
  schema:'CiiGeometryDiscrepancyReview.v1',
  status:'HYPOTHETICAL_REVIEW_ONLY_NOT_ENGINEERING_APPROVED',
  provenance:{
   sourceSetSha256:s.sourceSetSha256,
   sourceId,sourceOriginalSha256:member.originalSha256,
   sourceNormalizedSha256:member.normalizedSha256,
   targetOriginalSha256:s.target.originalSha256,
   targetNormalizedSha256:s.target.normalizedSha256,
  },
  originalPhysicalPair:{
   sourceNodeId:aId,targetNodeId:bId,
   sourceNodeDegree:source.degree,targetNodeDegree:target.degree,
   originalSourcePositionMm:original,originalTargetPositionMm:tpos,
   originalTargetMinusSourceMm:originalDelta,
   originalDifferenceMagnitudeMm:originalDelta?magnitude(originalDelta):null,
   sourceElement:sourceEdge,targetElement:targetEdge,
   recordedTargetMinusSourceLengthMm:mismatch,
  },
  proposedAdjustment:{
   interpretation:'SOURCE_HYPOTHESIS_ONLY',
   sourceTranslationMm:vector,proposedSourcePositionMm:adjusted,
   hypotheticalTargetMinusAdjustedSourceMm:adjustedResidual,
   hypotheticalResidualMagnitudeMm:adjustedResidual?magnitude(adjustedResidual):null,
   sourceElementRecordedLengthAdjustmentMm:sourceElementLengthAdjustmentMm,
   hypotheticalAdjustedSourceElementLengthMm:adjustedLength,
   hypotheticalElementLengthResidualMm:lengthResidual,
  },
  warnings, engineeringReady:false,physicalIdentityCertified:false,
  certifiedNodeCount:0,certifiedElementCount:0,writerReady:false,
  admittedCandidateCount:0,correspondenceCertificates:[],
  transferPlan:null,writeScope:null,
 });
}
export function assertCiiGeometryReviewCannotWrite(review){
 if(review?.schema!=='CiiGeometryDiscrepancyReview.v1')fail('REVIEW_SCHEMA_REQUIRED');
 fail('REVIEW_NEVER_CERTIFICATION_OR_WRITER_AUTHORITY');
}
