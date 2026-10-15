import assert from 'node:assert/strict';
import {ciiMultiSourceAnchorLedgerMarkup} from '../tabs/cii-workspace/cii-workspace-multisource-anchor-ledger-ui.js';

const suggestion=(s,t)=>({sourceNodeId:s,targetNodeId:t,basisMethod:'METHOD_B_NETWORK',
 methodB:{status:'READY'}});
const inspection={memberInspections:[
 {sourceId:'S1',inspection:{baseAnchorSuggestions:[suggestion('420','10330')]}},
 {sourceId:'S2',inspection:{baseAnchorSuggestions:[suggestion('100','900')]}},
]};
const auto=new Map([['S1',new Set(['420=>10330'])],['S2',new Set(['100=>900'])]]);
const manual=new Map([['S1',[{sourceNodeId:'420',targetNodeId:'415'}]],['S2',[]]]);
const modes=new Map([['S1','MANUAL'],['S2','AUTO']]);
const mixed=ciiMultiSourceAnchorLedgerMarkup(inspection,auto,manual,modes);
assert(mixed.includes('2 / 2 SOURCE members covered by ACTIVE authority'));
assert(mixed.includes('Anchor authority READY'));
assert(mixed.includes('data-ciiw-ms-anchor-ledger-row="manual" data-ciiw-ms-ledger-lane="ACTIVE"'));
assert(mixed.includes('data-ciiw-ms-anchor-ledger-row="automatic" data-ciiw-ms-ledger-lane="RETAINED"'));
assert(mixed.includes('data-ciiw-ms-anchor-ledger-row="automatic" data-ciiw-ms-ledger-lane="ACTIVE"'));
assert(mixed.includes('LOCKED and method-qualified do not mean independently certified physical identity'));
assert(mixed.includes('Compare models →</button>'));
assert(!mixed.includes('data-ciiw-ms-compare-now disabled'));
const blocked=ciiMultiSourceAnchorLedgerMarkup(inspection,auto,manual,
 new Map([['S1','MANUAL'],['S2','MANUAL']]));
assert(blocked.includes('1 / 2 SOURCE members covered by ACTIVE authority'));
assert(blocked.includes('Anchor authority incomplete'));
assert(blocked.includes('data-ciiw-ms-compare-now disabled'));
assert(blocked.includes('data-ciiw-ms-anchor-ledger-row="automatic" data-ciiw-ms-ledger-lane="RETAINED"'));
const other=ciiMultiSourceAnchorLedgerMarkup(inspection,auto,manual,
 new Map([['S1','AUTO'],['S2','AUTO']]));
assert(other.includes('data-ciiw-ms-anchor-ledger-row="manual" data-ciiw-ms-ledger-lane="RETAINED"'));
assert(other.includes('2 / 2 SOURCE members covered by ACTIVE authority'));
assert(!other.includes('data-ciiw-ms-compare-now disabled'));
const repeated=ciiMultiSourceAnchorLedgerMarkup(inspection,auto,manual,modes);
assert(repeated.includes('2 / 2 SOURCE members covered by ACTIVE authority'));
assert(repeated.includes('data-ciiw-ms-ledger-lane="RETAINED"'));
assert(!repeated.includes('data-ciiw-ms-compare-now disabled'));
console.log('PASS A2-16 active/retained authority rows and truly active Compare readiness; no implied physical certification');
