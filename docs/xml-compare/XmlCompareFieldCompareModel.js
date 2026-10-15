import { readFieldValue, textMatchPercent, normalizeText } from './XmlCompareFieldExtractor.js';
import { alignedFieldValue } from './XmlCompareAnchorTransform.js';

export const XML_COMPARE_FIELD_COMPARE_MODEL_SCHEMA='xml-compare-field-compare-model/v1';
export const XML_COMPARE_COMPARE_FIELD_STATE_SCHEMA='xml-compare-compare-field-state/v1';
export const XML_COMPARE_COMPARE_REPORT_SCHEMA='xml-compare-compare-report/v1';

const DEFAULT_TOLERANCE_MM=6;
const DEFAULT_TEXT_MATCH_THRESHOLD=0.6;
const clean=(value)=>String(value??'').trim();
const INTERNAL_FIELDS=new Set(['uid','raw','rawSummary','points','position','sourceRefs','diagnostics','compactFields','stableKey']);

function valueOf(record={},field=''){if(!record||!field)return undefined;return field.includes('.')?field.split('.').reduce((obj,key)=>obj?.[key],record):record[field];}
function normalizeString(value=''){return clean(value).replace(/\s+/g,' ').toLowerCase();}
function finiteNumber(value){const text=clean(value);if(!text)return null;if(/^[-+]?nan$/i.test(text))return null;const n=Number(text);return Number.isFinite(n)?n:null;}
function valueType(sourceValue,targetValue){const sourceNumber=finiteNumber(sourceValue),targetNumber=finiteNumber(targetValue);if(sourceNumber!=null&&targetNumber!=null)return 'number';if(!clean(sourceValue)&&!clean(targetValue))return 'blank';return 'string';}
function numericStatus(absDelta,toleranceMm){if(absDelta<=1e-9)return 'unchanged';return absDelta<=toleranceMm?'within-tol':'changed';}
function textStatus(sourceText,targetText,matchPct,textMatchThreshold,textOptions){if(normalizeText(sourceText,textOptions)===normalizeText(targetText,textOptions))return 'unchanged';return matchPct>=textMatchThreshold?'within-tol':'changed';}
export function normalizeCompareFields(fields=[]){const out=[];for(const field of Array.isArray(fields)?fields:[]){const key=clean(field);if(!key||INTERNAL_FIELDS.has(key)||out.includes(key))continue;out.push(key);}return Object.freeze(out);}
export function addCompareField(fields=[],field=''){return normalizeCompareFields([...normalizeCompareFields(fields),field]);}
export function removeCompareField(fields=[],field=''){const key=clean(field);return Object.freeze(normalizeCompareFields(fields).filter((item)=>item!==key));}
export function availableCompareFields(fields=[]){return Object.freeze((Array.isArray(fields)?fields:[]).map(clean).filter((field,index,self)=>field&&!INTERNAL_FIELDS.has(field)&&self.indexOf(field)===index));}
function recordLabel(record={}){return clean(readFieldValue(record,'displayName')||record?.nodeNumber||record?.elementKey||record?.uid);}
// Per-field diff: numeric fields get delta + tolerance band (coordinate fields aligned by anchor offset);
// text fields get a regex-normalized match percent. Reuses the shared FieldExtractor (2.2.1/2.2.2).
function rowFor(sourceRecord={},targetRecord={},field='',{anchorOffset=null,toleranceMm=DEFAULT_TOLERANCE_MM,textMatchThreshold=DEFAULT_TEXT_MATCH_THRESHOLD,textOptions={}}={}){
  const sourceRaw=readFieldValue(sourceRecord,field),targetRaw=readFieldValue(targetRecord,field);
  const alignedTargetRaw=alignedFieldValue(field,targetRaw,anchorOffset);
  const sourceMissing=sourceRaw===undefined,targetMissing=targetRaw===undefined;
  const sourceValue=clean(sourceRaw),targetValue=clean(alignedTargetRaw);
  const sourceNumber=finiteNumber(sourceValue),targetNumber=finiteNumber(targetValue);
  if(sourceMissing||targetMissing){return Object.freeze({field,sourceValue,targetValue,valueType:'missing',status:'missing',matchPct:0});}
  if(sourceNumber!=null&&targetNumber!=null){const delta=targetNumber-sourceNumber,absDelta=Math.abs(delta);return Object.freeze({field,sourceValue,targetValue,valueType:'number',sourceNumber,targetNumber,delta,absDelta,toleranceMm,status:numericStatus(absDelta,toleranceMm)});}
  if(!sourceValue&&!targetValue)return Object.freeze({field,sourceValue:'',targetValue:'',valueType:'blank',status:'blank',matchPct:1});
  const matchPct=textMatchPercent(sourceValue,targetValue,textOptions);
  return Object.freeze({field,sourceValue,targetValue,valueType:'string',matchPct,status:textStatus(sourceValue,targetValue,matchPct,textMatchThreshold,textOptions)});
}
function summarizeRows(rows=[]){const by=(status)=>rows.filter((row)=>row.status===status).length;return Object.freeze({fieldCount:rows.length,numericCount:rows.filter((row)=>row.valueType==='number').length,stringCount:rows.filter((row)=>row.valueType==='string').length,unchangedCount:by('unchanged'),withinToleranceCount:by('within-tol'),changedCount:by('changed'),missingCount:by('missing'),blankCount:by('blank')});}
export function createXmlCompareFieldCompareModel({sourceRecord=null,targetRecord=null,compareFields=[],anchorOffset=null,toleranceMm=DEFAULT_TOLERANCE_MM,textMatchThreshold=DEFAULT_TEXT_MATCH_THRESHOLD,textOptions={}}={}){
  const diagnostics=[];const fields=normalizeCompareFields(compareFields);
  if(!sourceRecord)diagnostics.push(Object.freeze({severity:'WARNING',code:'missing_source_record',message:'Source record is missing.'}));
  if(!targetRecord)diagnostics.push(Object.freeze({severity:'WARNING',code:'missing_target_record',message:'Target record is missing.'}));
  const rows=fields.map((field)=>rowFor(sourceRecord||{},targetRecord||{},field,{anchorOffset,toleranceMm,textMatchThreshold,textOptions}));
  const itemLabel=[recordLabel(sourceRecord||{}),recordLabel(targetRecord||{})].map(clean).filter(Boolean).join(' → ');
  return Object.freeze({schema:XML_COMPARE_FIELD_COMPARE_MODEL_SCHEMA,itemLabel,sourceUid:clean(sourceRecord?.uid),targetUid:clean(targetRecord?.uid),rows:Object.freeze(rows),summary:summarizeRows(rows),diagnostics:Object.freeze(diagnostics)});
}
function indexRecords(records=[]){const byUid=new Map(),byStableKey=new Map();for(const record of records||[]){const uid=clean(record.uid);if(uid&&!byUid.has(uid))byUid.set(uid,record);const stableKey=clean(record.stableKey);if(stableKey&&!byStableKey.has(stableKey))byStableKey.set(stableKey,record);}return{byUid,byStableKey};}
function resolve(index,stableKey,uid){return index.byStableKey.get(clean(stableKey))||index.byUid.get(clean(uid))||null;}
// Compare (3.2): run the per-field differ across approved candidate pairs at the selected level.
export function createXmlCompareCompareReport({pairs=[],sourceRecords=[],targetRecords=[],compareFields=[],anchorOffset=null,toleranceMm=DEFAULT_TOLERANCE_MM,textMatchThreshold=DEFAULT_TEXT_MATCH_THRESHOLD,textOptions={}}={}){
  const sourceIndex=indexRecords(sourceRecords),targetIndex=indexRecords(targetRecords);
  const pairReports=(pairs||[]).map((pair)=>{
    const source=resolve(sourceIndex,pair.sourceStableKey,pair.sourceUid),target=resolve(targetIndex,pair.targetStableKey,pair.targetUid);
    const model=createXmlCompareFieldCompareModel({sourceRecord:source,targetRecord:target,compareFields,anchorOffset,toleranceMm,textMatchThreshold,textOptions});
    return Object.freeze({sourceUid:clean(pair.sourceUid),targetUid:clean(pair.targetUid),resolved:Boolean(source&&target),...model});
  });
  const totals=pairReports.reduce((acc,report)=>{for(const key of Object.keys(acc))acc[key]+=report.summary[key]||0;return acc;},{fieldCount:0,numericCount:0,stringCount:0,unchangedCount:0,withinToleranceCount:0,changedCount:0,missingCount:0,blankCount:0});
  return Object.freeze({schema:XML_COMPARE_COMPARE_REPORT_SCHEMA,compareFields:normalizeCompareFields(compareFields),pairCount:pairReports.length,pairs:Object.freeze(pairReports),totals:Object.freeze(totals)});
}
export const _test=Object.freeze({clean,valueOf,normalizeString,finiteNumber,valueType,numericStatus,textStatus,normalizeCompareFields,addCompareField,removeCompareField,availableCompareFields,rowFor,summarizeRows,indexRecords});
