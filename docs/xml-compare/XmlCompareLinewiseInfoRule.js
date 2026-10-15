export const XML_COMPARE_LINEWISE_INFO_RULE_SCHEMA = 'xml-compare-linewise-info-rule/v1';

export const LINEWISE_XML_OWNERSHIP_RULE_TEXT = `Line-wise Categorized XML ownership rule

Root
  One XML document root only.

LineBlock
  Line-owned fields only:
    Branchname
    LineNo
    PipingClass
    Rating

Element
  Element owns the route span and element blocks:
    fromNode
    toNode
    elementKey
    NameBlock
    RouteGeometryBlock
      DELTA_X
      DELTA_Y
      DELTA_Z
    DerivedBlock
    RigidBlock
    MiscBlock
    OriginalElement

  Only DELTA_X / DELTA_Y / DELTA_Z are element-level route geometry.

NodesBlock
  NodesBlock is a child of Element.
  Node is a child of NodesBlock.
  Each Element has its own FROM and TO node occurrence.

Node
  Node-owned data is only data tied to node number or endpoint role:
    nodeNumber
    role = FROM / TO
    elementKey
    FROM_GLOBAL_X / FROM_GLOBAL_Y / FROM_GLOBAL_Z for FROM node
    TO_GLOBAL_X / TO_GLOBAL_Y / TO_GLOBAL_Z for TO node
    non-sentinel Temperature cases visible for that node occurrence
    DISPLACEMENTS by NODE_NUM
    FORCESMOMENTS by NODE_NUM
    SIF by NODE

  RestraintsBlock is a child of Node.
  RESTRAINT rows belong under the matching Node where RESTRAINT NODE equals nodeNumber.

Sentinel suppression
  Suppress -1.010100, -1.0101, blank, null, undefined.
  Suppress DISPLACEMENTS / FORCESMOMENTS / SIF / RESTRAINT rows where the owning NODE or NODE_NUM is sentinel.
  Suppress VECTOR rows where all engineering values are sentinel.

Canonical nesting
  Element
    NodesBlock
      Node role="FROM"
        RestraintsBlock
        DisplacementsBlock
        ForcesMomentsBlock
        SifBlock
      Node role="TO"
        RestraintsBlock
        DisplacementsBlock
        ForcesMomentsBlock
        SifBlock`;

export function escapeLinewiseInfoRule(value = '') {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderLinewiseInfoRuleButtonHtml(isOpen = false) {
  return `<button type="button" class="xml-compare-linewise-info-rule-btn" data-xml-compare-linewise-info-action="open-info-rule" aria-label="Show Line-wise XML ownership rule" title="Show Line-wise XML ownership rule" aria-expanded="${isOpen ? 'true' : 'false'}">i</button>`;
}

export function renderLinewiseInfoRuleModalHtml(isOpen = false) {
  if (!isOpen) return '';
  return `<div class="xml-compare-linewise-info-rule-modal" data-xml-compare-linewise-info-rule-panel><section class="xml-compare-linewise-info-rule-dialog" role="dialog" aria-modal="true" aria-label="Line-wise XML ownership rule"><header><h3>Line-wise XML ownership rule</h3><button type="button" data-xml-compare-linewise-info-action="close-info-rule">Close</button></header><pre>${escapeLinewiseInfoRule(LINEWISE_XML_OWNERSHIP_RULE_TEXT)}</pre><footer><button type="button" data-xml-compare-linewise-info-action="close-info-rule">Close</button></footer></section></div>`;
}

export const _test = Object.freeze({ escapeLinewiseInfoRule });
