import { applySourceTransformRules } from './xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';
import { ISO_NOTE_RECIPE_PROFILE } from './xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';

const source = {
  sourceId: 'S1',
  headers: ["/PS-14438/DATUM :ISONOTE 'REST(4kN)'"],
  columnIds: ['col1'],
  rows: [
    { rowId: 'S1:1', rawByHeader: { "/PS-14438/DATUM :ISONOTE 'REST(4kN)'": "/PS-14438/DATUM :ISONOTE 'REST(4kN)'" } },
    { rowId: 'S1:2', rawByHeader: { "/PS-14438/DATUM :ISONOTE 'REST(4kN)'": "/SL-14141/DATUM :ISONOTE 'REST(2kN),LINE STOP(6kN)'" } }
  ]
};

// Simulated transforms from loadIsoNoteTemplate
const rules = [
  { ruleId: 'iso1', enabled: true, newColumn: 'Base_ID', sourceColumn: 'SupportISONOTE', operation: 'regex-extract', find: '^/?([^\\s/:\'".]+)', replaceWith: '', group: 1, trim: true },
  { ruleId: 'iso2', enabled: true, newColumn: 'Revision', sourceColumn: 'SupportISONOTE', operation: 'regex-extract', find: '^/?(?:[^\\s/:\'".]+)(?:\\.(\\d+))?', replaceWith: '', group: 1, trim: true },
  { ruleId: 'iso3', enabled: true, newColumn: 'Rest_Load', sourceColumn: 'SupportISONOTE', operation: 'regex-extract', find: '\\bREST\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*kN\\s*\\)', replaceWith: '', group: 1, trim: true },
  { ruleId: 'iso4', enabled: true, newColumn: 'Guide_Load', sourceColumn: 'SupportISONOTE', operation: 'regex-extract', find: '\\bGUIDE\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*kN\\s*\\)', replaceWith: '', group: 1, trim: true },
  { ruleId: 'iso5', enabled: true, newColumn: 'Guide_Gap', sourceColumn: 'SupportISONOTE', operation: 'regex-extract', find: '\\bGUIDE\\s+GAP\\s*=\\s*([-+]?\\d*\\.?\\d+)\\s*mm', replaceWith: '', group: 1, trim: true },
  { ruleId: 'iso6', enabled: true, newColumn: 'Line_Stop_Load', sourceColumn: 'SupportISONOTE', operation: 'regex-extract', find: '\\bLINE\\s*STOP\\s*\\(\\s*([-+]?\\d*\\.?\\d+)\\s*kN\\s*\\)', replaceWith: '', group: 1, trim: true },
  { ruleId: 'iso7', enabled: true, newColumn: 'Rest_Load_Clean', sourceColumn: 'Rest_Load', operation: 'parse-number' },
  { ruleId: 'iso8', enabled: true, newColumn: 'Guide_Load_Clean', sourceColumn: 'Guide_Load', operation: 'parse-number' },
  { ruleId: 'iso9', enabled: true, newColumn: 'Guide_Gap_Clean', sourceColumn: 'Guide_Gap', operation: 'parse-number' },
  { ruleId: 'iso10', enabled: true, newColumn: 'Line_Stop_Load_Clean', sourceColumn: 'Line_Stop_Load', operation: 'parse-number' }
];

const result = applySourceTransformRules(source, rules);
console.log(JSON.stringify(result, null, 2));
