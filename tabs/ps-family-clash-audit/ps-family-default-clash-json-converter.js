import { parseSupportChangeXml } from './ps-family-psclash-xml-parser.js';

export const PS_FAMILY_DEFAULT_CLASH_CONVERSION_SCHEMA = 'PsFamilyDefaultClashConvertedModel.v1';
export const STRICT_CLASH_CONVERSION_MODE = 'STRICT_RELATIONSHIP_PRESERVING';
export const CONTROL_CLASH_CONVERSION_MODE = 'CLASH_IMPRINTED_GEOMETRY_CONTROL';

const REFERENCE_KEYS = Object.freeze([
  'CONNECTED_TO', 'CONNECTS_TO', 'MEMBER_REF', 'SUPPORT_MEMBER_REF', 'MATE',
]);

export function convertPsFamilyClashXmlToCombinedModel(input = {}, options = {}) {
  const mode = options.mode || STRICT_CLASH_CONVERSION_MODE;
  const coordinateScale = positive(options.coordinateScale, 1000);
  const config = options.parserConfig || {};
  const structure = parseSupportChangeXml(
    input.structureXmlText,
    config,
    'StructureGroup vs Supports',
  );
  const support = parseSupportChangeXml(
    input.supportXmlText,
    config,
    'Clash within Supports',
  );
  const structureRows = structure.rows.filter((row) => row.edgeType === 'StructuralContact');
  const chainRows = support.rows.filter((row) => row.edgeType === 'SupportChain');
  const memberIds = unique([
    ...structureRows.flatMap((row) => [row.support]),
    ...chainRows.flatMap((row) => [row.supportA, row.supportB]),
  ].map(rooted));
  const branchIds = unique([
    ...structureRows.map((row) => row.branchNode),
    ...chainRows.map((row) => row.branchNode),
  ].map(rooted));
  const pointsByMember = indexStructurePoints(structureRows, coordinateScale);
  const referencesByMember = indexChainReferences(chainRows);
  const control = mode === CONTROL_CLASH_CONVERSION_MODE
    ? createControlGeometry(memberIds, structureRows, coordinateScale)
    : null;
  const branchObjects = branchIds.map((branchId) => branchObject(
    branchId,
    memberIds.filter((memberId) => memberBranch(memberId, structureRows, chainRows) === branchId),
    structureRows,
    chainRows,
    pointsByMember,
    referencesByMember,
    control,
    mode,
  ));
  const unassignedMembers = memberIds.filter((memberId) => !branchObjects.some(
    (branch) => branch.children.some((member) => rooted(member.attributes.NAME) === memberId),
  ));
  if (unassignedMembers.length) {
    branchObjects.push(branchObject(
      '/UNRESOLVED-CLASH-XML-BRANCH', unassignedMembers,
      structureRows, chainRows, pointsByMember, referencesByMember, control, mode,
    ));
  }
  const steelObjects = buildSteelObjects(structureRows, coordinateScale, control, mode);
  return {
    schema: PS_FAMILY_DEFAULT_CLASH_CONVERSION_SCHEMA,
    validationOnly: true,
    productionDependency: false,
    conversionMode: mode,
    coordinateSystem: { units: 'mm', sourceCoordinateScale: coordinateScale },
    sourceSummary: {
      structureClashCount: structureRows.length,
      supportChainClashCount: chainRows.length,
      supportMemberCount: memberIds.length,
      branchCount: branchObjects.length,
      structuralGroupCount: steelObjects.length,
    },
    conversionCaution: mode === CONTROL_CLASH_CONVERSION_MODE
      ? 'Geometry is derived from the clash graph only to test engine reproducibility; it is circular validation evidence and must never be used in production.'
      : 'Only identities, hierarchy, line context, clash points and explicit references are preserved. Missing solids, axes and extents are not invented.',
    diagnostics: [
      ...structure.diagnostics,
      ...support.diagnostics,
      diagnostic('SOURCE_HAS_NO_CARRIER_OBJECT_GEOMETRY', 'The clash XML provides branch paths but no authoritative physical pipe object or carrier axis.'),
      diagnostic('SUPPORT_CHAIN_HAS_NO_CLASH_POINTS', 'The default Clash within Supports XML has no clash points or member extents; analytical member contact cannot be independently reconstructed.'),
      diagnostic('STRUCTURAL_EXTENTS_UNAVAILABLE', 'Structure clash points identify contacts but do not provide the structural section axis, bounds or orientation.'),
    ],
    objects: [...branchObjects, ...steelObjects],
  };
}

function branchObject(branchId, memberIds, structureRows, chainRows, points, refs, control, mode) {
  const context = [...structureRows, ...chainRows].find((row) => rooted(row.branchNode) === branchId) || {};
  return {
    name: branchId,
    type: 'BRANCH',
    attributes: {
      NAME: branchId,
      FULL_LINE_TAG: context.fullLineTag || null,
      LINE_FAMILY: context.lineFamily || null,
      SOURCE_PROVENANCE: mode,
    },
    children: memberIds.map((memberId) => supportMember(
      memberId, branchId, structureRows, chainRows, points, refs, control, mode,
    )),
  };
}

function supportMember(memberId, branchId, structureRows, chainRows, points, refs, control, mode) {
  const structural = structureRows.filter((row) => rooted(row.support) === memberId);
  const chains = chainRows.filter((row) => [row.supportA, row.supportB].map(rooted).includes(memberId));
  const attributes = {
    NAME: memberId,
    OWNER: branchId,
    SOURCE_PROVENANCE: mode,
    SOURCE_STRUCTURE_CLASH_IDS: structural.map((row) => row.clashName),
    SOURCE_SUPPORT_CHAIN_CLASH_IDS: chains.map((row) => row.clashName),
  };
  const point = points.get(memberId);
  if (point) {
    attributes.POS = point;
    attributes.CLASH_POINT_ONLY = true;
  }
  const targets = refs.get(memberId) || [];
  targets.slice(0, REFERENCE_KEYS.length).forEach((target, index) => {
    attributes[REFERENCE_KEYS[index]] = target;
  });
  const steelRefs = unique(structural.map((row) => rooted(row.structuralRoot || row.structuralGroup)));
  if (steelRefs.length === 1) attributes.STEEL_REF = steelRefs[0];
  if (control?.memberGeometry.has(memberId)) {
    Object.assign(attributes, control.memberGeometry.get(memberId), {
      CLASH_DERIVED_GEOMETRY: true,
    });
  }
  return { name: memberId, type: 'ATTA', attributes };
}

function buildSteelObjects(rows, coordinateScale, control, mode) {
  const roots = unique(rows.map((row) => rooted(row.structuralRoot || row.psRoot)));
  return roots.map((steelId) => {
    const matching = rows.filter((row) => rooted(row.structuralRoot || row.psRoot) === steelId);
    const points = matching.map((row) => scaledPoint(row.point, coordinateScale)).filter(Boolean);
    const itemName = rooted(matching[0]?.structuralGroup || `${steelId}/CLASH-STRUCTURE`);
    const memberAttributes = {
      NAME: itemName,
      SOURCE_PROVENANCE: mode,
      SOURCE_STRUCTURE_CLASH_IDS: matching.map((row) => row.clashName),
    };
    const average = averagePoint(points);
    if (average) {
      memberAttributes.POS = average;
      memberAttributes.CLASH_POINT_ONLY = true;
    }
    if (control?.steelGeometry) {
      Object.assign(memberAttributes, control.steelGeometry, {
        CLASH_DERIVED_GEOMETRY: true,
      });
    }
    return {
      name: steelId,
      type: 'STEEL_GROUP',
      attributes: {
        NAME: steelId,
        DESCRIPTION: 'Converted from default StructureGroup vs Supports clash XML',
        SOURCE_PROVENANCE: mode,
        ...(average ? { POS: average } : {}),
      },
      children: [{ name: itemName, type: 'SCTN', attributes: memberAttributes }],
    };
  });
}

function createControlGeometry(memberIds, structureRows, coordinateScale) {
  const ordered = chainOrder(memberIds, structureRows);
  const base = averagePoint(structureRows.map((row) => scaledPoint(row.point, coordinateScale)).filter(Boolean))
    || { x: 0, y: 0, z: 0 };
  const memberGeometry = new Map();
  ordered.forEach((memberId, index) => {
    const center = { x: base.x + index * 30, y: base.y, z: base.z + 10 };
    memberGeometry.set(memberId, {
      POS: center,
      BOUNDS: {
        min: { x: center.x - 15, y: center.y - 10, z: base.z },
        max: { x: center.x + 15, y: center.y + 10, z: base.z + 20 },
      },
    });
  });
  const terminalMembers = unique(structureRows.map((row) => rooted(row.support)));
  const terminalBoxes = terminalMembers.map((id) => memberGeometry.get(id)?.BOUNDS).filter(Boolean);
  const minX = terminalBoxes.length ? Math.min(...terminalBoxes.map((row) => row.min.x)) + 3 : base.x;
  const maxX = terminalBoxes.length ? Math.max(...terminalBoxes.map((row) => row.max.x)) : base.x + 30;
  return {
    memberGeometry,
    steelGeometry: {
      AXIS_START: { x: minX, y: base.y, z: base.z },
      AXIS_END: { x: maxX, y: base.y, z: base.z },
      BOUNDS: {
        min: { x: minX, y: base.y - 10, z: base.z - 20 },
        max: { x: maxX, y: base.y + 10, z: base.z },
      },
    },
  };
}

function chainOrder(memberIds, structureRows) {
  const terminals = unique(structureRows.map((row) => rooted(row.support)));
  return [...memberIds].sort((left, right) => {
    const leftNumber = memberNumber(left);
    const rightNumber = memberNumber(right);
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    return terminals.indexOf(left) - terminals.indexOf(right) || left.localeCompare(right);
  });
}

function indexStructurePoints(rows, scale) {
  const map = new Map();
  for (const row of rows) {
    const point = scaledPoint(row.point, scale);
    if (point && row.support) map.set(rooted(row.support), point);
  }
  return map;
}

function indexChainReferences(rows) {
  const map = new Map();
  for (const row of rows) {
    const left = rooted(row.supportA);
    const right = rooted(row.supportB);
    if (!left || !right) continue;
    if (!map.has(left)) map.set(left, []);
    map.get(left).push(right);
  }
  return map;
}

function memberBranch(memberId, structureRows, chainRows) {
  const row = [...structureRows, ...chainRows].find((item) => (
    [item.support, item.supportA, item.supportB].map(rooted).includes(memberId)
  ));
  return rooted(row?.branchNode);
}

function scaledPoint(point, scale) {
  if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return null;
  return { x: point.x * scale, y: point.y * scale, z: point.z * scale };
}
function averagePoint(points) {
  if (!points.length) return null;
  return {
    x: points.reduce((sum, row) => sum + row.x, 0) / points.length,
    y: points.reduce((sum, row) => sum + row.y, 0) / points.length,
    z: points.reduce((sum, row) => sum + row.z, 0) / points.length,
  };
}
function rooted(value) { const text = String(value || '').trim(); return text ? `/${text.replace(/^\/+/, '')}` : ''; }
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function memberNumber(value) { const match = String(value).match(/\.(\d+)$/u); return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER; }
function positive(value, fallback) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : fallback; }
function diagnostic(code, message) { return { level: 'INFO', code, message }; }
