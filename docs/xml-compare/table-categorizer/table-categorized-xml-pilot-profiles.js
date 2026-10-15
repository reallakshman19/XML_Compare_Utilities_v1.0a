import { DEFAULT_COORDINATE_CLUSTER_CONTRACT } from './table-categorized-xml-coordinate-cluster.js';

export const PS_MAPPING_TABLE_2_SAMPLE=`PS NO	Bore	pipe	DTXR	Support Gap	Mandatory	X	Y	Z
PS-XYZ.1	DN80	LINE-A	GUIDE	10	YES	1000	2000	3000
PS-XYZ.2	DN80	LINE-A	LINE STOP	0	YES	1001	2000	3000
PS-XYZ.7	DN80	LINE-A	REST	-	YES	999.5	2000	3000
PS-XYZ.10	DN80	LINE-A	GUIDE	10	YES	1000.2	2000	3000
PS-XYZ.3	DN80	LINE-A	GUIDE	10	YES	1500	2000	3000
PS-ABC.1	DN80	LINE-A	GUIDE	10	YES	1000	2000	3000`;

export const PS_MAPPING_TABLE_2_MODEL_SAMPLE=`PS NO	Bore	pipe	DTXR	Support Gap	Mandatory
PS-XYZ.1	DN80	LINE-A	GUIDE	10	YES
PS-XYZ.2	DN80	LINE-A	LINE STOP	0	YES
PS-XYZ.7	DN80	LINE-A	REST	-	YES
PS-XYZ.10	DN80	LINE-A	GUIDE	10	YES
PS-XYZ.3	DN80	LINE-A	GUIDE	10	YES
PS-ABC.1	DN80	LINE-A	GUIDE	10	YES`;

export const PS_MAPPING_COORDINATE_LOOKUP_SAMPLE=`PS NO	X	Y	Z
PS-XYZ.1	1000	2000	3000
PS-XYZ.2	1001	2000	3000
PS-XYZ.7	999.5	2000	3000
PS-XYZ.10	1000.2	2000	3000
PS-XYZ.3	1500	2000	3000
PS-ABC.1	1000	2000	3000`;

export const FIELD_COMPARISON_SAMPLE=`SupportISONOTE	Remarks
/SL-14143.1 :ISONOTE 'REST(2kN), GUIDE(2kN), [GUIDE GAP=25mm],LINE STOP(6kN)'	/SL-14143.3 :ISONOTE 'REST(2kN), GUIDE(2kN), [GUIDE GAP=15mm],LINE STOP(6kN)'
/SL-14144.1 :ISONOTE 'REST(3kN), GUIDE(2kN), [GUIDE GAP=20mm],LINE STOP(7kN)'	/SL-14144.2 :ISONOTE 'REST(3kN), GUIDE(2kN), [GUIDE GAP=20mm],LINE STOP(7kN)'`;

export const ISO_NOTE_TABLE_1_SAMPLE=`JOBNAME	LinenoinCII	PIPEAXIS	NODE_NUM	NODE_NAME	NPS	TYPE	SupportISONOTE	Remarks
SYS-002C	/ASIM-1836-4"-P8810032-31441C4-PP/B1	N-S	1160	PS-14438/DATUM	4	Rigid +Y	/PS-14438/DATUM :ISONOTE 'REST(4kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	E-W	5160	SL-14141/DATUM	4	Rigid +Y; Rigid LIM	/SL-14141/DATUM :ISONOTE 'REST(2kN),LINE STOP(6kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5100	SL-14143.1|HOLD	4	Rigid +Y; Rigid LIM; Rigid GUI w/gap	/SL-14143.1 :ISONOTE 'REST(2kN), GUIDE(2kN), [GUIDE GAP=25mm],LINE STOP(6kN)'	HOLD
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5140	SL-14142.3	4	Rigid +Y	/SL-14142.3 :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5210	SL-14145/DATUM	4	Rigid +Y	/SL-14145/DATUM :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5230	SL-14144/DATUM	4	Rigid +Y; Rigid GUI	/SL-14144/DATUM :ISONOTE 'REST(6kN), GUIDE(4kN), [GUIDE GAP=0mm]'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5290	PS-14119/DATUM	4	Rigid +Y	/PS-14119/DATUM :ISONOTE 'REST(3kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5390	PS-14120/DATUM	4	Rigid +Y; Rigid LIM; Rigid GUI	/PS-14120/DATUM :ISONOTE 'REST(3kN), GUIDE(2kN), [GUIDE GAP=0mm],LINE STOP(6kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5530	PS-14121/DATUM	4	Rigid +Y	/PS-14121/DATUM :ISONOTE 'REST(5kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	5600	PS-14442/DATUM	4	Rigid +Y	/PS-14442/DATUM :ISONOTE 'REST(5kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	E-W	1290	SL-14132/DATUM	4	Rigid +Y; Rigid LIM	/SL-14132/DATUM :ISONOTE 'REST(2kN),LINE STOP(6kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	1230	SL-14307.15|HOLD	4	Rigid +Y; Rigid LIM; Rigid GUI w/gap	/SL-14307.15 :ISONOTE 'REST(2kN), GUIDE(2kN), [GUIDE GAP=25mm],LINE STOP(6kN)'	HOLD
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	1270	SL-14133.1	4	Rigid +Y	/SL-14133.1 :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	1340	SL-14136/DATUM	4	Rigid +Y	/SL-14136/DATUM :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	1360	SL-14135/DATUM	4	Rigid +Y; Rigid GUI	/SL-14135/DATUM :ISONOTE 'REST(6kN), GUIDE(3kN), [GUIDE GAP=0mm]'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	1420	PS-14104/DATUM	4	Rigid +Y	/PS-14104/DATUM :ISONOTE 'REST(3kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	1540	PS-14105/DATUM	4	Rigid +Y; Rigid LIM; Rigid GUI	/PS-14105/DATUM :ISONOTE 'REST(3kN), GUIDE(2kN), [GUIDE GAP=0mm],LINE STOP(6kN)'	`;
export const ISO_NOTE_TABLE_2_SAMPLE=`JOBNAME	LinenoinCII	PIPEAXIS	NODE_NUM	NODE_NAME	NPS	TYPE	SupportISONOTE	Remarks
SYS-002C	/ASIM-1836-4"-P8810032-31441C4-PP/B1	N-S	15160	PS-14438/DATUM	4	Rigid +Y	/PS-14438/DATUM :ISONOTE 'REST(4kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	E-W	15100	SL-14141/DATUM	4	Rigid +Y; Rigid LIM	/PS-14104/DATUM :ISONOTE 'REST(3kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15140	SL-14143.1|HOLD	4	Rigid +Y; Rigid LIM; Rigid GUI w/gap	/SL-14143.1 :ISONOTE 'REST(2kN), GUIDE(2kN), [GUIDE GAP=15mm],LINE STOP(6kN)'	HOLD
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15210	PS-14142.3	4	Rigid +Y	/SL-14142.3 :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15230	SL-14145/DATUM	4	Rigid +Y	/SL-14145/DATUM :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15290	SL-14144/DATUM	4	Rigid +Y; Rigid LIM; Rigid GUI	/PS-14120/DATUM :ISONOTE 'REST(5kN), GUIDE(2kN), [GUIDE GAP=0mm],LINE STOP(6kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15390	PS-14119/DATUM	4	Rigid +Y	/PS-14119/DATUM :ISONOTE 'REST(3kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15530	PS-14120/DATUM	4	Rigid +Y; Rigid LIM; Rigid GUI	/PS-14120/DATUM :ISONOTE 'REST(3kN), GUIDE(2kN), [GUIDE GAP=10mm],LINE STOP(6kN)'	
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	15600	PS-14121/DATUM	4	Rigid +Y	/PS-14121/DATUM :ISONOTE 'REST(5kN)'	HOLD
SYS-002C	/ASIM-1836-4"-P8810033-31441C4-PP/B1	N-S	11290	PS-14442/DATUM	4	Rigid +Y	/PS-14442/DATUM :ISONOTE 'REST(5kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	E-W	11230	SL-14132/DATUM	4	Rigid +Y; Rigid LIM	/SL-14132/DATUM :ISONOTE 'REST(2kN),LINE STOP(6kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	11270	SL-14307.15|HOLD	4	Rigid +Y; Rigid LIM; Rigid GUI w/gap	/SL-14307.15 :ISONOTE 'REST(2kN), GUIDE(2kN), [GUIDE GAP=5mm],LINE STOP(6kN)'	HOLD
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	11340	SL-14133.9	4	Rigid +Y	/SL-14133.1 :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	11360	SL-14136/DATUM	4	Rigid +Y	/SL-14136/DATUM :ISONOTE 'REST(2kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	11420	SL-14135/DATUM	4	Rigid +Y; Rigid GUI	/SL-14135/DATUM :ISONOTE 'REST(6kN), GUIDE(3kN), [GUIDE GAP=10mm]'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	11540	PS-14104/DATUM	4	Rigid +Y	/PS-14104/DATUM :ISONOTE 'REST(3kN)'	
SYS-002C	/ASIM-1836-4"-P8810034-31441C4-PP/B1	N-S	10000	PS-14105/DATUM	4	Rigid +Y; Rigid LIM; Rigid GUI	/PS-14105/DATUM :ISONOTE 'REST(3kN), GUIDE(2kN), [GUIDE GAP=0mm],LINE STOP(6kN)'	`;

const psNo={op:'trim',column:'PS NO'};
const psBase={op:'fallback',resolvers:[{op:'regexExtract',input:psNo,pattern:'^(.+?)\\.\\d+$',group:1}],defaultResolver:psNo};
const cluster={op:'coordinateCluster',contract:DEFAULT_COORDINATE_CLUSTER_CONTRACT};
const feature={op:'classifier',column:'DTXR'};
const psNoS1={op:'trim',sourceId:'S1',column:'PS NO'};
const psBaseS1={op:'fallback',resolvers:[{op:'regexExtract',input:psNoS1,pattern:'^(.+?)\\.\\d+$',group:1}],defaultResolver:psNoS1};
const clusterS2={op:'coordinateCluster',sourceId:'S2',contract:{...DEFAULT_COORDINATE_CLUSTER_CONTRACT,axisMapping:{x:'X',y:'Y',z:'Z'}}};
const featureS1={op:'classifier',sourceId:'S1',column:'DTXR'};

const leftNote={op:'trim',column:'SupportISONOTE'};
const rightNote={op:'trim',column:'Remarks'};
const isoNote={op:'trim',column:'SupportISONOTE'};
const noteIdPattern=`^/?([^\\s/:'".]+)(?:\\.(\\d+))?(?:/DATUM)?\\s*:ISONOTE`;
const restPattern='\\bREST\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*kN\\s*\\)';
const guidePattern='\\bGUIDE\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*kN\\s*\\)';
const guideGapPattern='\\bGUIDE\\s+GAP\\s*=\\s*([-+]?\\d*\\.?\\d+)\\s*mm';
const lineStopPattern='\\bLINE\\s*STOP\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*kN\\s*\\)';
const leftBase=regex(leftNote,noteIdPattern,1), rightBase=regex(rightNote,noteIdPattern,1);
const leftRevision=regex(leftNote,noteIdPattern,2), rightRevision=regex(rightNote,noteIdPattern,2);
const leftRestKn=num(regex(leftNote,restPattern,1)), rightRestKn=num(regex(rightNote,restPattern,1));
const leftGuideKn=num(regex(leftNote,guidePattern,1)), rightGuideKn=num(regex(rightNote,guidePattern,1));
const leftGuideGapMm=num(regex(leftNote,guideGapPattern,1)), rightGuideGapMm=num(regex(rightNote,guideGapPattern,1));
const leftLineStopKn=num(regex(leftNote,lineStopPattern,1)), rightLineStopKn=num(regex(rightNote,lineStopPattern,1));
const restLoadStatus=cmp(leftRestKn,rightRestKn), guideLoadStatus=cmp(leftGuideKn,rightGuideKn), guideGapStatus=cmp(leftGuideGapMm,rightGuideGapMm), lineStopLoadStatus=cmp(leftLineStopKn,rightLineStopKn);
const isoConnectorKey=regex(isoNote,noteIdPattern,1), isoRevision=regex(isoNote,noteIdPattern,2);
const isoRestKn=num(regex(isoNote,restPattern,1)), isoGuideKn=num(regex(isoNote,guidePattern,1)), isoGuideGapMm=num(regex(isoNote,guideGapPattern,1)), isoLineStopKn=num(regex(isoNote,lineStopPattern,1));

export const PS_MAPPING_TABLE_2_SHADOW_PROFILE=Object.freeze({
  schema:'UniversalCategorizerProfile.v1',profileId:'ps-mapping-table-2-shadow-profile',displayName:'PS Mapping Table 2 Shadow Profile',
  requiredColumns:Object.freeze(['PS NO','Bore','pipe','DTXR','Support Gap','Mandatory']),optionalColumns:Object.freeze(['X','Y','Z']),duplicateKeyPolicy:'merge-sourceRefs',multiValuePolicy:'single-feature-per-row',coordinateCluster:Object.freeze(DEFAULT_COORDINATE_CLUSTER_CONTRACT),
  rootPartitionMode:'static',rootPartitions:Object.freeze([{key:'MODEL_SIDE',displayName:'Model Side',sourceScope:Object.freeze(['S1'])}]),
  levelDefinitions:Object.freeze([Object.freeze({levelId:'categorizedTableGraph',levelType:'container',creationMode:'static',key:'CategorizedTableGraph',displayName:'CategorizedTableGraph',documentRoot:true,children:Object.freeze([Object.freeze({levelId:'rootPartition',levelType:'partition',creationMode:'static',key:'MODEL_SIDE',displayName:'RootPartition: MODEL_SIDE',children:Object.freeze([supportFamily(psBase,cluster,psNo,feature,{gapSource:null})])})])})])
});

export const PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE=Object.freeze({
  schema:'UniversalCategorizerProfile.v1',profileId:'ps-mapping-table-2-coordinate-lookup-profile',displayName:'PS Mapping Table 2 + Coordinate Lookup Profile',
  requiredColumns:Object.freeze(['PS NO','Bore','pipe','DTXR','Support Gap','Mandatory']),optionalColumns:Object.freeze(['X','Y','Z']),duplicateKeyPolicy:'merge-sourceRefs',multiValuePolicy:'single-feature-per-row',coordinateCluster:Object.freeze(DEFAULT_COORDINATE_CLUSTER_CONTRACT),drivingSourceId:'S1',
  rootPartitionMode:'static',rootPartitions:Object.freeze([{key:'MODEL_SIDE',displayName:'Model Side',sourceScope:Object.freeze(['S1','S2'])}]),
  joins:Object.freeze([Object.freeze({joinId:'join_table2_coordinates',leftSourceId:'S1',rightSourceId:'S2',joinType:'left',leftKeyResolver:{sourceId:'S1',column:'PS NO',pipeline:Object.freeze([{op:'trim'}])},rightKeyResolver:{sourceId:'S2',column:'PS NO',pipeline:Object.freeze([{op:'trim'}])},outputAlias:'coordinateLookup',duplicatePolicy:'diagnostic',missingPolicy:'warning'})]),
  levelDefinitions:Object.freeze([Object.freeze({levelId:'categorizedTableGraph',levelType:'container',creationMode:'static',key:'CategorizedTableGraph',displayName:'CategorizedTableGraph',documentRoot:true,children:Object.freeze([Object.freeze({levelId:'rootPartition',levelType:'partition',creationMode:'static',key:'MODEL_SIDE',displayName:'RootPartition: MODEL_SIDE',children:Object.freeze([supportFamily(psBaseS1,clusterS2,psNoS1,featureS1,{gapSource:'S1'})])})])})])
});

export const FIELD_COMPARISON_SAMPLE_PROFILE=Object.freeze({
  schema:'UniversalCategorizerProfile.v1',profileId:'field-comparison-sample-profile',displayName:'Field-level Comparison Sample Recipe',
  requiredColumns:Object.freeze(['SupportISONOTE','Remarks']),optionalColumns:Object.freeze([]),duplicateKeyPolicy:'merge-sourceRefs',multiValuePolicy:'single-feature-per-row',coordinateCluster:Object.freeze(DEFAULT_COORDINATE_CLUSTER_CONTRACT),
  rootPartitionMode:'static',rootPartitions:Object.freeze([{key:'FIELD_COMPARISON',displayName:'Field Comparison',sourceScope:Object.freeze(['S1'])}]),
  exportPolicy:Object.freeze({documentRootTag:'FieldComparisonReport',rootPartitionTag:'ComparisonPartition',includeDiagnosticsElement:true,childElementFields:Object.freeze(['leftSupportBase','rightSupportBase','leftRevision','rightRevision','restLoadStatus','guideLoadStatus','guideGapStatus','lineStopLoadStatus','comparisonSummary'])}),
  levelDefinitions:Object.freeze([Object.freeze({levelId:'fieldComparisonReport',xmlTag:'FieldComparisonReport',levelType:'container',creationMode:'static',key:'FieldComparisonReport',displayName:'FieldComparisonReport',documentRoot:true,children:Object.freeze([Object.freeze({levelId:'comparisonPartition',xmlTag:'ComparisonPartition',levelType:'partition',creationMode:'static',key:'FIELD_COMPARISON',displayName:'Field Comparison',children:Object.freeze([Object.freeze({levelId:'comparisonItem',xmlTag:'ComparisonItem',levelType:'group',creationMode:'one-per-key',keyResolver:{op:'fallback',resolvers:Object.freeze([leftBase,rightBase]),defaultResolver:{op:'concat',parts:Object.freeze(['row_',{op:'trim',column:'SupportISONOTE'}])}},displayNameResolver:leftBase,fieldResolvers:Object.freeze({leftSupportBase:leftBase,rightSupportBase:rightBase,leftRevision,rightRevision,leftRestKn,rightRestKn,restLoadStatus,leftGuideKn,rightGuideKn,guideLoadStatus,leftGuideGapMm,rightGuideGapMm,guideGapStatus,leftLineStopKn,rightLineStopKn,lineStopLoadStatus,comparisonSummary:{op:'template',template:'{{leftSupportBase}} rev {{leftRevision}} vs {{rightRevision}}: REST {{restLoadStatus}}, GUIDE load {{guideLoadStatus}}, GUIDE GAP {{guideGapStatus}}, LINE STOP {{lineStopLoadStatus}}.',values:Object.freeze({leftSupportBase:leftBase,leftRevision,rightRevision,restLoadStatus,guideLoadStatus,guideGapStatus,lineStopLoadStatus})}}),children:Object.freeze([])})])})])})])
});

export const ISO_NOTE_RECIPE_PROFILE=Object.freeze({
  schema:'UniversalCategorizerProfile.v1',profileId:'ISOrecipe',displayName:'ISO Note Saved Recipe',connectorKeyField:'connectorKey',
  requiredColumns:Object.freeze(['SupportISONOTE']),optionalColumns:Object.freeze(['JOBNAME','LinenoinCII','PIPEAXIS','NODE_NUM','NODE_NAME','NPS','TYPE','Remarks']),duplicateKeyPolicy:'merge-sourceRefs',multiValuePolicy:'single-feature-per-row',coordinateCluster:Object.freeze(DEFAULT_COORDINATE_CLUSTER_CONTRACT),
  rootPartitionMode:'static',rootPartitions:Object.freeze([{key:'ISO_SOURCE',displayName:'ISO Source'}]),
  exportPolicy:Object.freeze({documentRootTag:'IsoNoteXml',rootPartitionTag:'IsoPartition',includeDiagnosticsElement:true,childElementFields:Object.freeze(['connectorKey','revision','restKn','guideKn','guideGapMm','lineStopKn','rawNote','jobName','lineNoInCii','pipeAxis','nodeNumber','nodeName','nps','supportType','remarks'])}),
  levelDefinitions:Object.freeze([Object.freeze({levelId:'isoNoteXml',xmlTag:'IsoNoteXml',levelType:'container',creationMode:'static',key:'IsoNoteXml',displayName:'IsoNoteXml',documentRoot:true,children:Object.freeze([Object.freeze({levelId:'isoPartition',xmlTag:'IsoPartition',levelType:'partition',creationMode:'static',key:'ISO_SOURCE',displayName:'ISO Source',children:Object.freeze([Object.freeze({levelId:'isoItem',xmlTag:'IsoItem',levelType:'group',creationMode:'one-per-key',keyResolver:isoConnectorKey,displayNameResolver:isoConnectorKey,fieldResolvers:Object.freeze({connectorKey:isoConnectorKey,revision:isoRevision,restKn:isoRestKn,guideKn:isoGuideKn,guideGapMm:isoGuideGapMm,lineStopKn:isoLineStopKn,rawNote:isoNote,jobName:{op:'trim',column:'JOBNAME'},lineNoInCii:{op:'trim',column:'LinenoinCII'},pipeAxis:{op:'trim',column:'PIPEAXIS'},nodeNumber:{op:'numberParser',column:'NODE_NUM'},nodeName:{op:'trim',column:'NODE_NAME'},nps:{op:'numberParser',column:'NPS'},supportType:{op:'trim',column:'TYPE'},remarks:{op:'trim',column:'Remarks'}}),children:Object.freeze([])})])})])})])
});

function regex(input,pattern,group){return Object.freeze({op:'regexExtract',input,pattern,group,flags:'i'});}
function num(input){return Object.freeze({op:'numberParser',input});}
function cmp(left,right){return Object.freeze({op:'compare',mode:'number',left,right,tolerance:0,matchValue:'MATCH',mismatchValue:'MISMATCH'});}
function supportFamily(baseResolver,clusterResolver,psNoResolver,featureResolver,{gapSource=null}={}){return Object.freeze({levelId:'supportFamily',levelType:'group',creationMode:'one-per-key',keyResolver:{op:'fallback',resolvers:[{op:'concat',parts:[baseResolver,'__',clusterResolver]}],defaultResolver:baseResolver},displayNameResolver:baseResolver,children:Object.freeze([Object.freeze({levelId:'supportOccurrence',levelType:'occurrence',creationMode:'one-per-key',keyResolver:psNoResolver,displayNameResolver:psNoResolver,children:Object.freeze([Object.freeze({levelId:'supportFeature',levelType:'feature',creationMode:'one-per-key',keyResolver:{op:'concat',parts:[psNoResolver,'_',featureResolver]},displayNameResolver:featureResolver,fieldResolvers:Object.freeze({featureType:featureResolver}),children:Object.freeze([Object.freeze({levelId:'gap',levelType:'measure',creationMode:'zero-or-one',keyResolver:{op:'concat',parts:[psNoResolver,'_',featureResolver,'_Gap']},displayName:'Gap',fieldResolvers:Object.freeze({rawValue:{op:'trim',sourceId:gapSource||undefined,column:'Support Gap'},value:{op:'numberParser',sourceId:gapSource||undefined,column:'Support Gap',severity:'INFO'}})})])})])})])});}
