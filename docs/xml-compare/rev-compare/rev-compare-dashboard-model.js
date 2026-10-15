import { executeRevCompare } from './rev-compare-engine.js';
import { REV_COMPARE_CHANGE_TYPES } from './rev-compare-contracts.js';

const clean = (value) => String(value ?? '').trim();

export function createRevCompareDashboardModel(workspace) {
  const activeLevel = clean(workspace?.source?.summary?.activeLevel) || 'Element';
  
  // Choose key based on what is commonly configured. `nodeName` for nodes, `displayName` or `uid` as fallback.
  // Actually, let's use whatever is selected in the UI. If aim has nameField, use it.
  const keyField = clean(workspace?.aim?.nameField) || 'displayName';
  
  const { results, duplicates } = executeRevCompare(workspace, keyField);
  
  const sourceRecords = workspace?.source?.records || [];
  const targetRecords = workspace?.target?.records || [];
  const compareFields = workspace?.compareFields || [];
  
  const commonResults = results.filter(r => r.type === 'COMMON' || r.type === 'CHANGED');
  const missingResults = results.filter(r => r.type === REV_COMPARE_CHANGE_TYPES.MISSING);
  const newResults = results.filter(r => r.type === REV_COMPARE_CHANGE_TYPES.NEW);
  
  let numericChangesCount = 0;
  for (const r of commonResults) {
    if (r.changes.some(c => c.type === REV_COMPARE_CHANGE_TYPES.NUMERIC_CHANGED)) {
      numericChangesCount++;
    }
  }

  const connectorsStr = (workspace?.aim?.connectors || []).map(c => c.field).join(', ') || 'None';
  const anchorStr = workspace?.aim?.mode === 'text' ? 'Text' : 'Numeric';

  const executiveSummary = [
    { metric: 'Source rows', count: sourceRecords.length, meaning: `Input ${activeLevel.toLowerCase()} rows in Source` },
    { metric: 'Target rows', count: targetRecords.length, meaning: `Input ${activeLevel.toLowerCase()} rows in Target` },
    { metric: `Common ${activeLevel.toLowerCase()} keys by ${keyField} base`, count: commonResults.length, meaning: 'Same normalized key exists in both revisions' },
    { metric: `Missing ${activeLevel.toLowerCase()} by ${keyField} base`, count: missingResults.length, meaning: 'Present in Source, absent in Target' },
    { metric: `New ${activeLevel.toLowerCase()}`, count: newResults.length, meaning: 'Present in Target, absent in Source' },
    { metric: 'Data duplicate errors', count: duplicates.length, meaning: 'Node key duplicated in the same revision' },
    { metric: 'Critical Numeric Changes', count: numericChangesCount, meaning: 'Numeric change in configured fields' },
    { metric: 'Connectors / Anchor', count: `${connectorsStr} / ${anchorStr}`, meaning: 'Configured mapping rules' }
  ];

  const blockers = [];
  missingResults.forEach(r => blockers.push(`**Missing in Target:** \`${r.key}\` — existed in Source, missing in Target.`));
  newResults.forEach(r => blockers.push(`**New in Target:** \`${r.key}\` — introduced in Target.`));
  duplicates.forEach(d => blockers.push(`**Duplicate Blockers (Target):** \`${d.nodeName || d.displayName || d.uid}\` — found twice.`));

  const changedRecords = commonResults.filter(r => r.type === 'CHANGED' || r.changes.some(c => c.type !== REV_COMPARE_CHANGE_TYPES.MATCH));
  
  return Object.freeze({
    activeLevel,
    keyField,
    executiveSummary,
    blockers,
    commonResults,
    missingResults,
    newResults,
    duplicates,
    changedRecords,
    revCompareDeltaThreshold: workspace.revCompareDeltaThreshold || 0,
    compareFields,
    results
  });
}

export const _test = Object.freeze({ clean, createRevCompareDashboardModel });
