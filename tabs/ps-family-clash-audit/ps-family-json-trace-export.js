const JSON_TRACE_HEADERS = Object.freeze([
  'Report Row',
  'Support Family Key',
  'Support Family',
  'Name of the element',
  'Reference of the element',
  'TYPE',
  'PIPE',
  'Branch Root',
  'Position',
  'Position Easting',
  'Position Northing',
  'Position Elevation',
  'Position Source',
  'BORE',
  'OUTSIDE DIAMETER',
  'RTEXT of detailing text',
  'ISOMETRIC NOTES',
  'DTXR',
  'DTXR_POS',
  'DTXR_PS',
  'DTXR_SOURCE',
  'DTXR_FALLBACK_USED',
  'DTXR_STATUS',
  'SUPPORT GAP',
  'ANCILIARY SUPPORT REFERENCE',
  'Component spec reference',
  'SITE',
  'JsonNodeNo',
  'JSON Path',
  'DTXR Source Node No',
  'DTXR Source Path',
  'Line Family',
  'Full Line Tag',
  'Carrier IDs',
  'Source Schema',
  'Resolution Status',
  'Diagnostics',
]);

function text(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function valueText(value) {
  return value && typeof value === 'object' ? '' : text(value);
}

function sourcePathText(value) {
  if (!Array.isArray(value)) return text(value);
  return value.reduce((path, segment) => {
    if (Number.isInteger(segment)) return `${path}[${segment}]`;
    const key = text(segment);
    if (/^[A-Za-z_$][\w$]*$/u.test(key)) return `${path}.${key}`;
    return `${path}[${JSON.stringify(key)}]`;
  }, '$');
}

function attrValue(attributes, names) {
  const wanted = new Set(names.map((name) => name.toUpperCase()));
  for (const [key, value] of Object.entries(attributes || {})) {
    if (wanted.has(text(key).toUpperCase()) && valueText(value)) return valueText(value);
  }
  return '';
}

function pointFrom(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) return numericPoint(value[0], value[1], value[2]);
  if (typeof value === 'object') {
    return numericPoint(
      value.x ?? value.X ?? value.E ?? value.east,
      value.y ?? value.Y ?? value.N ?? value.north,
      value.z ?? value.Z ?? value.U ?? value.EL ?? value.elevation,
    );
  }
  return pointFromText(value);
}

function numericPoint(xValue, yValue, zValue) {
  const point = { x: Number(xValue), y: Number(yValue), z: Number(zValue) };
  return Object.values(point).every(Number.isFinite) ? point : null;
}

function pointFromText(value) {
  const source = text(value);
  if (!source) return null;
  const directional = {};
  source.replace(/\b(E|W|N|S|U|D|EL)\s*[:=]?\s*(-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?)/giu, (_, axis, raw) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return '';
    const key = axis.toUpperCase();
    if (key === 'E') directional.x = numeric;
    if (key === 'W') directional.x = -numeric;
    if (key === 'N') directional.y = numeric;
    if (key === 'S') directional.y = -numeric;
    if (key === 'U' || key === 'EL') directional.z = numeric;
    if (key === 'D') directional.z = -numeric;
    return '';
  });
  if ([directional.x, directional.y, directional.z].every(Number.isFinite)) return directional;
  const values = source.match(/-?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/gu)?.map(Number) || [];
  return values.length >= 3 ? numericPoint(values[0], values[1], values[2]) : null;
}

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? String(Math.round(Number(value) * 1000) / 1000) : '';
}

function positionFields(member) {
  const point = pointFrom(member?.positionGlobal);
  return {
    point,
    label: point ? `E=${formatNumber(point.x)} N=${formatNumber(point.y)} EL=${formatNumber(point.z)}` : '',
    source: point ? 'MEMBER_POSITION_GLOBAL' : 'NONE',
  };
}

function dtxrFields(member) {
  const attributes = member?.attributes || {};
  const rawDtxrPos = attrValue(attributes, ['DTXR_POS']);
  const dtxrPos = (rawDtxrPos && !pointFrom(rawDtxrPos) ? rawDtxrPos : '')
    || attrValue(attributes, ['DTXR', 'DESC', 'DESCRIPTION', 'RTEXT', 'SPRE']);
  const dtxrPs = attrValue(attributes, ['DTXR_PS', 'DTXRPS', 'ISOMETRIC NOTES', 'ISONOTE']);
  const effective = dtxrPos || dtxrPs;
  const source = dtxrPos ? 'DTXR_POS' : (dtxrPs ? 'DTXR_PS_FALLBACK' : 'NONE');
  return {
    dtxrPos,
    dtxrPs,
    effective,
    source,
    fallbackUsed: source === 'DTXR_PS_FALLBACK',
    status: dtxrStatus(dtxrPos, dtxrPs),
  };
}

function dtxrStatus(dtxrPos, dtxrPs) {
  if (dtxrPos && dtxrPs) {
    return normalized(dtxrPos) === normalized(dtxrPs)
      ? 'DTXR_POS_AND_PS_EQUAL'
      : 'DTXR_POS_AND_PS_DIFFERENT';
  }
  if (dtxrPos) return 'DTXR_POS_ONLY';
  if (dtxrPs) return 'DTXR_PS_ONLY';
  return 'DTXR_MISSING';
}

function normalized(value) {
  return text(value).toUpperCase().replace(/\s+/gu, ' ');
}

function familyName(value) {
  const match = text(value).toUpperCase().match(/(?:PS|SL)-?\d+/u);
  return match ? match[0].replace(/^(PS|SL)(?=\d)/u, '$1-') : '';
}

function branchRoot(value) {
  const full = text(value)
    .replace(/\\+/gu, '/')
    .replace(/\/{2,}/gu, '/')
    .replace(/\s+/gu, '')
    .replace(/^\/*/u, '/')
    .replace(/\/$/u, '')
    .toUpperCase();
  return full.replace(/\/B\d+$/u, '');
}

function lineFields(family, member) {
  const context = member?.lineContext || family?.lineContext || {};
  const branchNode = text(context.branchNode || member?.sourceParentBranch || family?.branchId || family?.branchIds?.[0]);
  const fullLineTag = text(context.fullLineTag || family?.fullLineTag || family?.fullLineTags?.[0]);
  const lineFamily = text(context.lineFamily || family?.lineFamily || family?.lineFamilies?.[0]);
  const pipe = branchNode || fullLineTag || lineFamily;
  const carrierIds = [context.carrierId, ...(family?.carrierIds || [])].map(text).filter(Boolean);
  return { branchNode, fullLineTag, lineFamily, pipe, branchRoot: branchRoot(pipe), carrierIds: [...new Set(carrierIds)].sort().join('|') };
}

function traceCoreFields(member, line, position) {
  return {
    'Name of the element': text(member?.memberId),
    TYPE: text(member?.sourceRecordType),
    PIPE: line.pipe,
    'Branch Root': line.branchRoot,
    Position: position.label,
    'Position Easting': position.point ? formatNumber(position.point.x) : '',
    'Position Northing': position.point ? formatNumber(position.point.y) : '',
    'Position Elevation': position.point ? formatNumber(position.point.z) : '',
    'Position Source': position.source,
  };
}

function traceDtxrFields(dtxr) {
  return {
    'RTEXT of detailing text': dtxr.dtxrPos,
    'ISOMETRIC NOTES': dtxr.dtxrPs,
    DTXR: dtxr.effective,
    DTXR_POS: dtxr.dtxrPos,
    DTXR_PS: dtxr.dtxrPs,
    DTXR_SOURCE: dtxr.source,
    DTXR_FALLBACK_USED: dtxr.fallbackUsed ? 'TRUE' : 'FALSE',
    DTXR_STATUS: dtxr.status,
  };
}

function traceAttributeFields(attributes) {
  return {
    'Reference of the element': attrValue(attributes, ['ComponentRefNo', 'COMPONENTREFNO', 'REF', 'RefNo']),
    BORE: attrValue(attributes, ['ABORE', 'LBORE', 'HBORE', 'BORE']),
    'OUTSIDE DIAMETER': attrValue(attributes, ['OD', 'OUTSIDE_DIAMETER', 'OUTSIDE DIAMETER']),
    'SUPPORT GAP': attrValue(attributes, ['CMPSUPGAP', 'SUPPORT GAP']),
    'ANCILIARY SUPPORT REFERENCE': attrValue(attributes, ['ANCILIARY SUPPORT REFERENCE', 'ANCILLARY_SUPPORT_REFERENCE', 'SUPPORT_REFERENCE', 'SREF']),
    'Component spec reference': attrValue(attributes, ['Component spec reference', 'COMPONENT_SPEC_REFERENCE', 'COMPONENTSPEC', 'SPEC', 'SPRE']),
    SITE: attrValue(attributes, ['SITE', 'SITE_AREA']),
  };
}

function traceProvenanceFields(member, line, dtxr, sourceSchema, jsonNodeNo, sourcePath) {
  return {
    JsonNodeNo: jsonNodeNo,
    'JSON Path': sourcePath,
    'DTXR Source Node No': dtxr.source === 'NONE' ? '' : jsonNodeNo,
    'DTXR Source Path': dtxr.source === 'NONE' ? '' : sourcePath,
    'Line Family': line.lineFamily,
    'Full Line Tag': line.fullLineTag,
    'Carrier IDs': line.carrierIds,
    'Source Schema': text(sourceSchema),
  };
}

function memberRow(family, member, sourceSchema) {
  const attributes = member?.attributes || {};
  const supportFamily = familyName(family?.familyId || member?.memberId);
  const line = lineFields(family, member);
  const position = positionFields(member);
  const dtxr = dtxrFields(member);
  const jsonNodeNo = attrValue(attributes, ['JsonNodeNo', 'JSON_NODE_NO', 'NODE_NO', 'NodeNumber', 'NODE', 'SEQ', 'SEQUENCE']);
  const sourcePath = sourcePathText(member?.sourcePath);
  const diagnostics = diagnosticCodes(member, line, position, dtxr, supportFamily);
  return {
    'Support Family Key': line.branchRoot && supportFamily ? `${line.branchRoot}::${supportFamily}` : '',
    'Support Family': supportFamily,
    ...traceCoreFields(member, line, position),
    ...traceAttributeFields(attributes),
    ...traceDtxrFields(dtxr),
    ...traceProvenanceFields(member, line, dtxr, sourceSchema, jsonNodeNo, sourcePath),
    'Resolution Status': diagnostics.length ? 'SOURCE_EVIDENCE_PARTIAL' : 'SOURCE_EVIDENCE_READY',
    Diagnostics: diagnostics.join('|'),
  };
}

function diagnosticCodes(member, line, position, dtxr, supportFamily) {
  const output = [];
  if (!text(member?.memberId)) output.push('SUPPORT_IDENTITY_MISSING');
  if (!supportFamily) output.push('SUPPORT_FAMILY_MISSING');
  if (!line.pipe) output.push('BRANCH_MISSING');
  if (!position.point) output.push('POSITION_MISSING');
  if (!dtxr.effective) output.push('DTXR_MISSING');
  if (!sourcePathText(member?.sourcePath)) output.push('SOURCE_PATH_MISSING');
  return output;
}

function naturalKey(value) {
  return text(value).toUpperCase().replace(/\d+/gu, (part) => part.padStart(14, '0'));
}

function compareValue(left, right) {
  const a = naturalKey(left);
  const b = naturalKey(right);
  return a < b ? -1 : (a > b ? 1 : 0);
}

function compareRows(left, right) {
  return compareValue(left['Branch Root'], right['Branch Root'])
    || compareValue(left['Support Family'], right['Support Family'])
    || compareValue(left['Name of the element'], right['Name of the element'])
    || compareValue(left.Position, right.Position)
    || compareValue(left['JSON Path'], right['JSON Path']);
}

export const PS_FAMILY_JSON_TRACE_HEADERS = JSON_TRACE_HEADERS;

export function createPsFamilyJsonTraceRows(families = [], sourceSchema = '') {
  const projected = (Array.isArray(families) ? families : []).flatMap((family) => (
    (family?.members || []).map((member) => memberRow(family, member, sourceSchema))
  ));
  return projected.sort(compareRows).map((row, index) => ({ 'Report Row': index + 1, ...row }));
}
