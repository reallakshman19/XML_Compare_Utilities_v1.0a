import { createJoinedRowContexts } from './table-categorized-xml-join-engine.js';
import { createResolverContext, runResolver } from './table-categorized-xml-resolver-engine.js';
import { CATEGORIZED_GRAPH_SCHEMA, createGraphEdge, createGraphNode } from './table-categorized-xml-graph-contracts.js';
import { IMPLEMENTED_CREATION_MODES } from './table-categorized-xml-profile-validation.js';

export const TABLE_CATEGORIZED_XML_GRAPH_BUILDER_SCHEMA='table-categorized-xml-graph-builder/v4-many-evidence';

export function buildCategorizedGraph(profile,sources=[],options={}){
  const joined=options.joinedRows?{rows:options.joinedRows,diagnostics:[]} : createJoinedRowContexts(sources,profile?.joins||[],{drivingSourceId:profile?.drivingSourceId||sources[0]?.sourceId});
  const state={profile,sources,context:options.resolverContext||createResolverContext({coordinateCluster:profile?.coordinateCluster||{},sources}),nodes:[],edges:[],diagnostics:[...(joined.diagnostics||[]),...unsupportedModeDiagnostics(profile)],nodeIndex:0,edgeIndex:0};
  if(hasBlockers(state.diagnostics))return graphResult(profile,sources,state);
  for(const level of profile.levelDefinitions||[])buildLevel(state,level,null,joined.rows||[]);
  return graphResult(profile,sources,state);
}
export function graphChildren(graph,parentId){const childIds=new Set((graph?.edges||[]).filter((edge)=>edge.fromNodeId===parentId).map((edge)=>edge.toNodeId));return (graph?.nodes||[]).filter((node)=>childIds.has(node.id));}

function graphResult(profile,sources,state){return Object.freeze({schema:CATEGORIZED_GRAPH_SCHEMA,profileId:profile.profileId,sourceIds:Object.freeze(sources.map((item)=>item.sourceId)),nodes:Object.freeze(state.nodes),edges:Object.freeze(state.edges),diagnostics:Object.freeze(state.diagnostics),documentRootNodeIds:Object.freeze(state.nodes.filter((node)=>node.fields.documentRoot).map((node)=>node.id))});}
function buildLevel(state,level,parent,rows){if(parent?.fields?.documentRoot&&level.levelId==='rootPartition'&&state.profile.rootPartitionMode){buildRootPartitions(state,level,parent,rows);return;}const buckets=bucketRows(state,level,rows);for(const bucket of buckets){const node=appendNode(state,level,parent,bucket.resolved,bucket.rows);for(const child of level.children||[])buildLevel(state,child,node,bucket.rows);}}
function buildRootPartitions(state,level,parent,rows){const partitions=resolvePartitions(state,rows);for(const partition of partitions){const scopedRows=partition.rows||rows;const node=appendNode(state,level,parent,{key:partition.key,displayName:partition.displayName||partition.key,fields:{sourceScope:partition.sourceScope||[]},sourceRefs:partition.sourceRefs||collectRefs(scopedRows)},scopedRows);for(const child of level.children||[])buildLevel(state,child,node,scopedRows);}}
function resolvePartitions(state,rows){const profile=state.profile;if(profile.rootPartitionMode==='perSource')return state.sources.map((source)=>({key:source.sourceId,displayName:source.sourceName,sourceScope:[source.sourceId],rows:rows.filter((row)=>row.sourceRows?.[source.sourceId]||row.rowId?.startsWith(`${source.sourceId}:`)),sourceRefs:(source.rows||[]).map((r)=>r.rowId)}));if(profile.rootPartitionMode==='perColumn'){const col=profile.rootPartitionColumn||'RootPartition';return groupRows(rows,(row)=>rowValue(row,col)||'UNASSIGNED');}if(profile.rootPartitionMode==='perResolver'&&profile.rootPartitionResolver){return groupRows(rows,(row)=>runResolver(profile.rootPartitionResolver,row,state.context).value||'UNASSIGNED');}return (profile.rootPartitions?.length?profile.rootPartitions:[{key:'MODEL_SIDE',displayName:'Model Side',sourceScope:state.sources.map((s)=>s.sourceId)}]).map((p)=>({...p,rows:filterByScope(rows,p.sourceScope),sourceRefs:collectRefs(filterByScope(rows,p.sourceScope))}));}
function groupRows(rows,keyFn){const map=new Map();for(const row of rows){const key=String(keyFn(row));if(!map.has(key))map.set(key,{key,displayName:key,rows:[],sourceRefs:[]});map.get(key).rows.push(row);map.get(key).sourceRefs.push(...sourceRefs(row));}return [...map.values()].map((p)=>({...p,sourceRefs:[...new Set(p.sourceRefs)]}));}
function filterByScope(rows,scope=[]){if(!scope.length)return rows;return rows.filter((row)=>scope.some((sourceId)=>row.sourceRows?.[sourceId]||row.rowId?.startsWith(`${sourceId}:`)));}
function bucketRows(state,level,rows){if(!IMPLEMENTED_CREATION_MODES.includes(level.creationMode)){state.diagnostics.push(blocker(level.creationMode));return [];}if(level.creationMode==='static')return [staticBucket(level,rows)];if(level.creationMode==='one-per-row'||level.creationMode==='lookup-joined')return rows.map((row)=>rowBucket(state,level,row));if(level.creationMode==='zero-or-one')return rows.length?[rowBucket(state,level,rows[0])]:[];if(level.creationMode==='conditional')return conditionalBuckets(state,level,rows);if(level.creationMode==='coordinate-clustered')return coordinateClusterBuckets(state,level,rows);if(level.creationMode==='many-per-row')return manyPerRowBuckets(state,level,rows);return groupedBuckets(state,level,rows);}
function staticBucket(level,rows){return {rows,resolved:{key:level.key,displayName:level.displayName||level.key,fields:{documentRoot:Boolean(level.documentRoot)},sourceRefs:collectRefs(rows)}};}
function rowBucket(state,level,row){return {rows:[row],resolved:resolveLevelForRow(state,level,row)};}
function groupedBuckets(state,level,rows){const byKey=new Map();for(const row of rows){const resolved=resolveLevelForRow(state,level,row);const key=String(resolved.key||'');if(!byKey.has(key))byKey.set(key,{rows:[],resolved});byKey.get(key).rows.push(row);}return [...byKey.values()].map((bucket)=>mergeBucket(bucket));}
function conditionalBuckets(state,level,rows){const out=[];for(const row of rows){const result=runResolver(level.conditionResolver||level.condition||{op:'literal',value:false},row,state.context);state.diagnostics.push(...(result.diagnostics||[]));if(resolverTruthy(result))out.push(rowBucket(state,level,row));}return out;}
function coordinateClusterBuckets(state,level,rows){const resolver=level.keyResolver||level.clusterResolver||{op:'coordinateCluster',contract:state.profile.coordinateCluster||{}};return groupedBuckets(state,{...level,keyResolver:resolver},rows);}

/*
 * many-per-row remains the categorizer authority for repeated evidence. Two
 * optional profile contracts extend the original scalar-list behavior:
 *   parallelListResolvers: { fieldName: resolverSpec }
 *   columnSeries: { sourceId?, headerPattern?, columnIdPattern?, includeBlank?, valueType? }
 * Both preserve source ordering and source-cell provenance.
 */
function manyPerRowBuckets(state,level,rows){return rows.flatMap((row)=>level.columnSeries?columnSeriesBuckets(state,level,row):alignedManyPerRowBuckets(state,level,row));}
function alignedManyPerRowBuckets(state,level,row){
  const primary=resolveList(state,level,row,level.listResolver||level.manyResolver||level.keyResolver);
  const parallel=Object.fromEntries(Object.entries(level.parallelListResolvers||{}).map(([field,resolver])=>[field,resolveList(state,level,row,resolver)]));
  const lengths={value:primary.values.length,...Object.fromEntries(Object.entries(parallel).map(([field,result])=>[field,result.values.length]))};
  const width=Math.max(0,...Object.values(lengths));
  if(new Set(Object.values(lengths)).size>1){state.diagnostics.push(Object.freeze({severity:'WARNING',code:'many_per_row_parallel_list_length_mismatch',message:`Parallel list lengths differ for ${level.levelId}; all ${width} slot(s) were preserved.`,details:Object.freeze({levelId:level.levelId,rowId:sourceRefs(row)[0]||row.rowId||'',lengths:Object.freeze({...lengths})})}));}
  return Array.from({length:width},(_,index)=>manyBucket(state,level,row,{value:primary.values[index]??'',parallel:Object.fromEntries(Object.entries(parallel).map(([field,result])=>[field,result.values[index]??'']))},index));
}
function resolveList(state,level,row,resolver){const result=runResolver(resolver||{op:'literal',value:''},row,state.context);state.diagnostics.push(...(result.diagnostics||[]));return {values:listValues(result.value,level.delimiter),result};}
function listValues(value,delimiter){if(Array.isArray(value))return value.map((item)=>String(item??'').trim());const text=String(value??'');if(!text.trim())return [];const split=delimiter instanceof RegExp?text.split(delimiter):text.split(delimiter||/[;,|]/);return split.map((item)=>String(item??'').trim());}
function manyBucket(state,level,row,item,index){const ref=sourceRefs(row)[0]||row.rowId||'row';const base=resolveLevelForRow(state,{...level,keyResolver:{op:'literal',value:`${ref}:${index+1}`}},row);const display=String(item.value||Object.values(item.parallel||{}).find(Boolean)||`${level.displayName||level.levelId} ${index+1}`);return {rows:[row],resolved:{...base,key:base.key,displayName:display,fields:{...base.fields,value:item.value,manyOrdinal:index+1,...item.parallel},evidence:[...(base.evidence||[]),{sourceRefs:sourceRefs(row),ordinal:index+1,rawByHeader:row.rawByHeader||{},parallelValues:Object.freeze({...item.parallel})}],sourceRefs:base.sourceRefs}};}

function columnSeriesBuckets(state,level,row){
  const bound=seriesSource(state,row,level.columnSeries||{});
  if(!bound.source||!bound.row)return [];
  const cfg=level.columnSeries||{};
  const headerRe=safePattern(cfg.headerPattern||'.*');
  const idRe=cfg.columnIdPattern?safePattern(cfg.columnIdPattern):null;
  const headerOrdinals=new Map();
  const out=[];
  (bound.source.columnIds||[]).forEach((columnId,index)=>{
    const sourceHeader=String(bound.source.headers?.[index]??columnId);
    const headerMatches=headerRe.test(sourceHeader);headerRe.lastIndex=0;
    const idMatches=idRe?idRe.test(String(columnId)):true;if(idRe)idRe.lastIndex=0;
    if(!headerMatches||!idMatches)return;
    const raw=bound.row.rawCells?.[index]??bound.row.rawByColumnId?.[columnId]??'';
    if(cfg.includeBlank===false&&!String(raw).trim())return;
    const ordinal=(headerOrdinals.get(sourceHeader)||0)+1;headerOrdinals.set(sourceHeader,ordinal);
    out.push(seriesBucket(state,level,row,bound.row,{columnIndex:index,columnId,sourceHeader,ordinal,raw},out.length));
  });
  return out;
}
function seriesSource(state,row,cfg){const sourceId=String(cfg.sourceId||sourceRefs(row)[0]?.split(':')[0]||row?.rowId?.split(':')[0]||'');const source=state.sources.find((item)=>item.sourceId===sourceId)||state.sources[0]||null;const sourceRow=row?.sourceRows?.[sourceId]||row?.primaryRow||row;return {source,row:sourceRow};}
function safePattern(pattern){try{return new RegExp(String(pattern||'.*'));}catch{return /.*/;}}
function seriesBucket(state,level,row,sourceRow,item,index){const ref=sourceRefs(sourceRow)[0]||sourceRow.rowId||sourceRefs(row)[0]||row.rowId||'row';const base=resolveLevelForRow(state,{...level,keyResolver:{op:'literal',value:`${ref}:column:${item.columnId}`}},row);const numeric=String(item.raw??'').trim()!==''&&Number.isFinite(Number(item.raw))?Number(item.raw):null;const value=level.columnSeries?.valueType==='number'?numeric:item.raw;const sourceCellRef=`${ref}:${item.columnId}`;return {rows:[row],resolved:{...base,key:base.key,displayName:`${item.sourceHeader} ${item.ordinal}`,fields:{...base.fields,ordinal:item.ordinal,columnOrdinal:item.columnIndex+1,columnId:item.columnId,sourceHeader:item.sourceHeader,raw:item.raw,value,sourceCellRef},evidence:[...(base.evidence||[]),{sourceRefs:[ref],sourceCellRef,columnId:item.columnId,sourceHeader:item.sourceHeader,columnOrdinal:item.columnIndex+1,ordinal:item.ordinal,raw:item.raw}],sourceRefs:[...new Set([...(base.sourceRefs||[]),ref])]}};}

function resolverTruthy(result){return result.ok&&['true','yes','y','1','mandatory'].includes(String(result.value??'').trim().toLowerCase());}
function mergeBucket(bucket){const refs=collectRefs(bucket.rows);return {rows:bucket.rows,resolved:{...bucket.resolved,sourceRefs:refs}};}
function resolveLevelForRow(state,level,row){const key=resolveKey(state,level,row);const display=level.displayNameResolver?runResolver(level.displayNameResolver,row,state.context):null;const fields=resolveFields(level,row,state.context);const diagnostics=[...(key.diagnostics||[]),...(display?.diagnostics||[]),...fieldDiagnostics(fields)];state.diagnostics.push(...diagnostics);return {key:key.value,displayName:level.displayName||display?.value||key.value,fields:fieldValues(fields),evidence:[{sourceRefs:sourceRefs(row),rawByHeader:row.rawByHeader}],diagnostics,sourceRefs:[...new Set([...(key.sourceRefs||[]),...(display?.sourceRefs||[]),...Object.values(fields).flatMap((r)=>r.sourceRefs||[]),...sourceRefs(row)])]};}
function resolveKey(state,level,row){if(level.creationMode==='one-per-row'&&!level.keyResolver){const key=sourceRefs(row)[0]||row.rowId||`row_${state.nodeIndex+1}`;return {value:key,sourceRefs:sourceRefs(row),diagnostics:[]};}return runResolver(level.keyResolver||{op:'literal',value:level.key||''},row,state.context);}
function resolveFields(level,row,context){return Object.freeze(Object.fromEntries(Object.entries(level.fieldResolvers||{}).map(([name,spec])=>[name,runResolver(spec,row,context)])));}
function fieldValues(fields){return Object.freeze(Object.fromEntries(Object.entries(fields).map(([name,result])=>[name,result.value])));}
function fieldDiagnostics(fields){return Object.values(fields).flatMap((result)=>result.diagnostics||[]);}
function appendNode(state,level,parent,resolved,rows){const fields={...(resolved.fields||{})};if(level.documentRoot)fields.documentRoot=true;const node=createGraphNode(++state.nodeIndex,level,parent?.id||null,{...resolved,fields},resolved.sourceRefs||collectRefs(rows));state.nodes.push(node);if(parent)state.edges.push(createGraphEdge(++state.edgeIndex,parent.id,node.id));return node;}
function unsupportedModeDiagnostics(profile){return flattenLevels(profile?.levelDefinitions||[]).filter((level)=>!IMPLEMENTED_CREATION_MODES.includes(level.creationMode)).map((level)=>blocker(level.creationMode));}
function flattenLevels(levels=[]){return levels.flatMap((level)=>[level,...flattenLevels(level.children||[])]);}
function blocker(mode){return Object.freeze({severity:'BLOCKER',code:'unsupported_creation_mode',message:`Unsupported creationMode ${mode}.`,details:Object.freeze({creationMode:mode})});}
function hasBlockers(items=[]){return items.some((item)=>item.severity==='BLOCKER');}
function rowValue(row,column){return row?.rawByColumnId?.[column]??row?.rawByHeader?.[column];}
function sourceRefs(row){return row?.sourceRefs?.length?[...row.sourceRefs]:(row?.rowId?[row.rowId]:[]);}
function collectRefs(rows=[]){return [...new Set(rows.flatMap(sourceRefs))];}
