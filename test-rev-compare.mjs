import fs from 'fs';
import { normalizeXmlCompareDatasetFromText } from './xml-compare/XmlCompareTopologyReportModel.js';
import { executeRevCompare } from './xml-compare/rev-compare/rev-compare-engine.js';
import { createRevCompareDashboardModel } from './xml-compare/rev-compare/rev-compare-dashboard-model.js';
import { exportRevCompareCsv } from './xml-compare/rev-compare/rev-compare-exporters.js';

const textA = fs.readFileSync('tests/fixtures/table-categorized/table_S1_source.xml', 'utf8');
const textB = fs.readFileSync('tests/fixtures/table-categorized/table_S2_target.xml', 'utf8');

const source = normalizeXmlCompareDatasetFromText(textA);
const target = normalizeXmlCompareDatasetFromText(textB);

// The user said: "Connectot element level , refer snap, sting compare."
// Let's set up the workspace for 'Element' level
const workspace = {
  source: {
    records: source.nodes.map(n => ({
      uid: n.uid,
      nodeName: n.nodeName,
      displayName: n.nodeName,
      type: 'Element',
      ...n.fields
    })),
    summary: { activeLevel: 'Element' }
  },
  target: {
    records: target.nodes.map(n => ({
      uid: n.uid,
      nodeName: n.nodeName,
      displayName: n.nodeName,
      type: 'Element',
      ...n.fields
    })),
    summary: { activeLevel: 'Element' }
  },
  compareFields: ['design_x', 'design_y', 'design_z', 'description'],
  aim: {
    nameField: 'nodeName'
  }
};

const model = createRevCompareDashboardModel(workspace);

console.log("=== Executive Summary ===");
console.table(model.executiveSummary);

console.log("\n=== Critical Blockers ===");
model.blockers.forEach(b => console.log(b));

console.log("\n=== Delta Grid (CSV) ===");
console.log(exportRevCompareCsv(workspace));
