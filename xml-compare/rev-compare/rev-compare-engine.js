import { REV_COMPARE_CHANGE_TYPES, normalizeNodeKey, isNumericField } from './rev-compare-contracts.js';
import { textMatchPercent } from '../XmlCompareFieldExtractor.js';

const clean = (value) => String(value ?? '').trim();

function getFieldValue(record, field) {
  if (!record) return '';
  if (record[field] !== undefined) return record[field];
  if (record.rawSummary?.[field] !== undefined) return record.rawSummary[field];
  return '';
}

export function alignRecords(sourceRecords = [], targetRecords = [], approvedMatches = [], keyField = 'nodeName') {
  const sourceMap = new Map();
  const targetMap = new Map();
  
  // First map by explicitly approved matches
  for (const match of approvedMatches) {
    if (match.sourceUid && match.targetUid) {
      sourceMap.set(match.sourceUid, match.targetUid);
      targetMap.set(match.targetUid, match.sourceUid);
    }
  }
  
  // Create pools of unmapped records
  const unmappedSource = sourceRecords.filter(r => !sourceMap.has(r.uid));
  const unmappedTarget = targetRecords.filter(r => !targetMap.has(r.uid));
  
  // Map remaining by normalized key field (e.g. nodeName or displayName)
  const targetKeyMap = new Map();
  for (const t of unmappedTarget) {
    const key = normalizeNodeKey(getFieldValue(t, keyField) || t.uid);
    if (!targetKeyMap.has(key)) {
      targetKeyMap.set(key, t);
    }
  }
  
  for (const s of unmappedSource) {
    const key = normalizeNodeKey(getFieldValue(s, keyField) || s.uid);
    const matchedTarget = targetKeyMap.get(key);
    if (matchedTarget && !targetMap.has(matchedTarget.uid)) {
      sourceMap.set(s.uid, matchedTarget.uid);
      targetMap.set(matchedTarget.uid, s.uid);
    }
  }
  
  return { sourceMap, targetMap };
}

export function compareRecordPair(sourceRecord, targetRecord, compareFields = []) {
  const changes = [];
  let isChanged = false;
  
  for (const field of compareFields) {
    const v1 = getFieldValue(sourceRecord, field);
    const v2 = getFieldValue(targetRecord, field);
    
    if (clean(v1) !== clean(v2)) {
      isChanged = true;
      if (isNumericField(field, v1, v2)) {
        const n1 = Number(v1) || 0;
        const n2 = Number(v2) || 0;
        changes.push({
          field,
          type: REV_COMPARE_CHANGE_TYPES.NUMERIC_CHANGED,
          sourceValue: v1,
          targetValue: v2,
          delta: n2 - n1
        });
      } else {
        changes.push({
          field,
          type: REV_COMPARE_CHANGE_TYPES.TEXT_CHANGED,
          sourceValue: v1,
          targetValue: v2,
          matchPct: Math.round(textMatchPercent(v1, v2) * 100)
        });
      }
    } else {
      changes.push({
        field,
        type: REV_COMPARE_CHANGE_TYPES.MATCH,
        sourceValue: v1,
        targetValue: v2
      });
    }
  }
  
  return { isChanged, changes };
}

export function executeRevCompare(workspace, keyField = 'displayName') {
  const sourceRecords = workspace?.source?.records || [];
  const targetRecords = workspace?.target?.records || [];
  const approvedMatches = workspace?.approvedMatchSet?.approvedMatches || [];
  const compareFields = workspace?.compareFields || [];
  
  const { sourceMap, targetMap } = alignRecords(sourceRecords, targetRecords, approvedMatches, keyField);
  
  const results = [];
  
  // Track duplicates based on normalized key
  const targetKeysSeen = new Set();
  const duplicates = [];
  
  for (const s of sourceRecords) {
    const sKey = normalizeNodeKey(getFieldValue(s, keyField) || s.uid);
    const tUid = sourceMap.get(s.uid);
    
    if (!tUid) {
      results.push({
        sourceUid: s.uid,
        targetUid: null,
        key: sKey,
        type: REV_COMPARE_CHANGE_TYPES.MISSING,
        sourceRecord: s,
        targetRecord: null,
        changes: []
      });
    } else {
      const t = targetRecords.find(tr => tr.uid === tUid);
      let { isChanged, changes } = compareRecordPair(s, t, compareFields);
      
      const tKey = normalizeNodeKey(getFieldValue(t, keyField) || t.uid);
      if (targetKeysSeen.has(tKey)) {
        duplicates.push(t);
      } else {
        targetKeysSeen.add(tKey);
      }
      
      if (sKey !== tKey) {
        changes.push({
          field: keyField,
          type: REV_COMPARE_CHANGE_TYPES.IDENTITY_MISMATCH,
          sourceValue: sKey,
          targetValue: tKey
        });
        isChanged = true;
      }
      
      results.push({
        sourceUid: s.uid,
        targetUid: tUid,
        key: sKey,
        type: isChanged ? 'CHANGED' : 'COMMON',
        sourceRecord: s,
        targetRecord: t,
        changes
      });
    }
  }
  
  for (const t of targetRecords) {
    if (!targetMap.has(t.uid)) {
      const tKey = normalizeNodeKey(getFieldValue(t, keyField) || t.uid);
      if (targetKeysSeen.has(tKey)) {
        duplicates.push(t);
      } else {
        targetKeysSeen.add(tKey);
      }
      results.push({
        sourceUid: null,
        targetUid: t.uid,
        key: tKey,
        type: REV_COMPARE_CHANGE_TYPES.NEW,
        sourceRecord: null,
        targetRecord: t,
        changes: []
      });
    }
  }
  
  return { results, duplicates };
}

export const _test = Object.freeze({ clean, getFieldValue, alignRecords, compareRecordPair, executeRevCompare });
