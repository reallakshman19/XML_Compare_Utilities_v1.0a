import { createPendingConnectorPreview } from '../XmlCompareApprovedConnectorModel.js';
import { buildCategorizedGraph } from './table-categorized-xml-graph-builder.js';
import { exportCategorizedGraphArtifacts } from './table-categorized-xml-exporter.js';
import { parseTableSource } from './table-categorized-xml-source-parser.js';
import { validateEditableProfile } from './table-categorized-xml-profile-validation.js';
import { runCategorizerValidation } from './table-categorized-xml-validation.js';
import { proofXmlWellFormed } from './table-categorized-xml-exporter.js';

export const TABLE_CATEGORIZED_XML_RECIPE_WORKFLOW_SCHEMA='table-categorized-xml-recipe-workflow/v1-source-handoff';
export const SAVED_TABLE_XML_RECIPE_SCHEMA='SavedTableXmlRecipe.v1';
export const TABLE_XML_SOURCE_HANDOFF_SCHEMA='TableXmlSourceHandoff.v1';

export function saveTableXmlRecipe(profile={},metadata={}){
  const recipe=Object.freeze({
    schema:SAVED_TABLE_XML_RECIPE_SCHEMA,
    recipeId:String(metadata.recipeId||profile.profileId||'tableXmlRecipe'),
    displayName:String(metadata.displayName||profile.displayName||profile.profileId||'Table XML Recipe'),
    workflow:'Table->XML->XMLCompareSource',
    profile:Object.freeze({...profile}),
    connectorKeyField:String(metadata.connectorKeyField||profile.connectorKeyField||'connectorKey'),
    notes:Object.freeze([...(metadata.notes||[])])
  });
  return Object.freeze({recipe,json:JSON.stringify(recipe,null,2)});
}

export function loadTableXmlRecipe(textOrObject){
  const parsed=typeof textOrObject==='string'?JSON.parse(textOrObject):textOrObject;
  if(parsed?.schema!==SAVED_TABLE_XML_RECIPE_SCHEMA)throw new Error(`Unsupported saved recipe schema: ${parsed?.schema||'missing'}`);
  if(!parsed.profile||typeof parsed.profile!=='object')throw new Error('Saved recipe profile is missing.');
  return Object.freeze({...parsed,profile:Object.freeze(parsed.profile)});
}

export function buildXmlArtifactFromTable({tableText='',sourceId='SourceA',sourceName='',recipe=null,profile=null,delimiterMode='tab'}={}){
  const resolvedProfile=recipe?.profile||profile;
  if(!resolvedProfile)throw new Error('A saved recipe or profile is required.');
  const source=parseTableSource(tableText,{sourceId,sourceName:sourceName||sourceId,delimiterMode});
  const profileValidation=validateEditableProfile(resolvedProfile,{sources:[source]});
  const graph=buildCategorizedGraph(resolvedProfile,[source]);
  const validationResults=[...profileValidation,...runCategorizerValidation({profile:resolvedProfile,sources:[source],graph,activeSourceId:source.sourceId})];
  const exportResult=exportCategorizedGraphArtifacts({graph,profile:resolvedProfile,validationResults,sources:[source]});
  const connectorKeyField=recipe?.connectorKeyField||resolvedProfile.connectorKeyField||'connectorKey';
  return Object.freeze({
    schema:'TableXmlArtifact.v1',
    sourceId:source.sourceId,
    sourceName:source.sourceName,
    recipeId:recipe?.recipeId||resolvedProfile.profileId,
    profileId:resolvedProfile.profileId,
    connectorKeyField,
    source,
    graph,
    validationResults:Object.freeze(validationResults),
    exportResult,
    xmlText:exportResult.xmlText,
    records:Object.freeze(recordsFromGraph(graph,{sourceId:source.sourceId,connectorKeyField}))
  });
}

export function createXmlCompareSourceHandoff(artifact,{side='sourceA',sourceLabel='Source A'}={}){
  const xmlProof=proofXmlWellFormed(artifact?.xmlText||'');
  return Object.freeze({
    schema:TABLE_XML_SOURCE_HANDOFF_SCHEMA,
    side,
    sourceLabel,
    sourceId:artifact?.sourceId||side,
    recipeId:artifact?.recipeId||'',
    profileId:artifact?.profileId||'',
    connectorKeyField:artifact?.connectorKeyField||'connectorKey',
    xmlText:artifact?.xmlText||'',
    records:Object.freeze((artifact?.records||[]).map((record)=>Object.freeze({...record,side,sourceLabel}))),
    diagnostics:Object.freeze(xmlProof.ok?[{severity:'INFO',code:'source_handoff_xml_well_formed',message:xmlProof.message}]:[{severity:'BLOCKER',code:'source_handoff_xml_invalid',message:xmlProof.message}])
  });
}

export function createConnectorPreviewByKey(sourceHandoff,targetHandoff,connectorKey,{confidence=0.98}={}){
  const sourceRecord=findRecordByConnectorKey(sourceHandoff,connectorKey);
  const targetRecord=findRecordByConnectorKey(targetHandoff,connectorKey);
  if(!sourceRecord||!targetRecord)return Object.freeze({ok:false,connectorKey:String(connectorKey||''),preview:null,diagnostics:Object.freeze([{severity:'BLOCKER',code:'connector_key_not_found',message:`Connector key ${connectorKey} was not found in both XML sources.`}])});
  const preview=createPendingConnectorPreview({
    sourceRecord,
    targetRecord,
    sourceUid:sourceRecord.uid,
    targetUid:targetRecord.uid,
    sourceStableKey:sourceRecord.stableKey,
    targetStableKey:targetRecord.stableKey,
    sourceLabel:sourceRecord.displayName,
    targetLabel:targetRecord.displayName,
    basis:['table-xml-recipe','connector-key',sourceHandoff?.connectorKeyField||'connectorKey'],
    confidence,
    transformBasis:'connector-key'
  });
  return Object.freeze({ok:Boolean(preview),connectorKey:String(connectorKey||''),preview,diagnostics:Object.freeze([])});
}

function recordsFromGraph(graph,{sourceId='',connectorKeyField='connectorKey'}={}){
  return Object.freeze((graph?.nodes||[])
    .filter((node)=>node.fields?.[connectorKeyField]||node.key)
    .filter((node)=>node.levelType!=='container'&&node.levelType!=='partition')
    .map((node)=>recordFromNode(node,{sourceId,connectorKeyField})));
}
function recordFromNode(node,{sourceId='',connectorKeyField='connectorKey'}={}){
  const connectorKey=String(node.fields?.[connectorKeyField]||node.key||'').trim();
  const uid=`${sourceId}:${connectorKey}`;
  return Object.freeze({
    uid,
    stableKey:connectorKey,
    connectorKey,
    displayName:node.displayName||connectorKey,
    nodeName:node.displayName||connectorKey,
    elementKey:connectorKey,
    sourceRefs:Object.freeze([...(node.sourceRefs||[])]),
    fields:Object.freeze({...node.fields,connectorKey}),
    raw:Object.freeze({nodeId:node.id,levelId:node.levelId,key:node.key})
  });
}
function findRecordByConnectorKey(handoff={},connectorKey=''){
  const key=String(connectorKey||'').trim();
  return (handoff.records||[]).find((record)=>record.connectorKey===key||record.stableKey===key||record.fields?.connectorKey===key)||null;
}
