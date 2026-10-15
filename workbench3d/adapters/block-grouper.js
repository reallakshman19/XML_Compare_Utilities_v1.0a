/**
 * block-grouper.js — element data → block-wise collapsible display model (pure).
 */

const SENTINEL = /-?1\.0101|-nan/i;

function cleanEntries(entries) {
  return entries.filter(([, value]) => {
    const text = String(value ?? '').trim();
    return text !== '' && !SENTINEL.test(text);
  });
}

function prettifyBlockName(name) {
  const base = String(name).replace(/s?Block$/i, '');
  if (/^[A-Z0-9_]+$/.test(base)) return base.charAt(0) + base.slice(1).toLowerCase();
  return base.replace(/([a-z])([A-Z])/g, '$1 $2');
}

const RAW_PSEUDO_BLOCKS = Object.freeze([
  ['Section', /^(DIAMETER|WALL_THICK|INSUL_THICK|CORR_ALLOW|SEAM_WELD|MILL_TOL)/],
  ['Process', /^(TEMP_|PRESSURE|HYDRO_)/],
  ['Material', /^(MATERIAL_|PIPE_DENSITY|INSUL_DENSITY|FLUID_DENSITY|MODULUS|HOT_MOD|POISSONS)/],
]);

function packetAncestryEntries(packet) {
  const ancestry = packet.sourceAncestry;
  if (!ancestry) return [];
  const source = ancestry.sourceElement ?? {};
  return [
    ['(source FROM→TO)', `${source.fromNode ?? ''}->${source.toNode ?? ''}`],
    ['(resolved corner)', ancestry.resolvedToNode ?? ''],
    ['(source index)', source.rawIndex ?? ''],
  ];
}

function groupedPush(groups, blockName, label, entries) {
  const clean = cleanEntries(entries);
  if (!clean.length) return;
  let group = groups.find((item) => item.blockName === blockName);
  if (!group) {
    group = { blockName, instances: [] };
    groups.push(group);
  }
  group.instances.push({ label, entries: clean });
}

function addCategorizedGroups(groups, blocks) {
  for (const block of blocks) {
    const blockName = prettifyBlockName(block.name);
    if (block.entries?.length) groupedPush(groups, blockName, '', block.entries);
    (block.instances ?? []).forEach((instance, index) => {
      const label = block.instances.length > 1 ? `[${index + 1}]` : '';
      groupedPush(groups, prettifyBlockName(instance.name), label, Object.entries(instance.attrs));
    });
  }
}

function addRawGroups(groups, object) {
  const nameEntries = [];
  if (object.name) nameEntries.push(['NAME', object.name]);
  if (object.lineId) nameEntries.push(['LINE', object.lineId]);
  groupedPush(groups, 'Name', '', nameEntries);
  groupedPush(groups, 'Geometry', '', [
    ['FROM→TO', object.canonicalFromTo], ['LENGTH mm', object.lengthMm],
    ['PATH', object.pathId], ['STATION mm', object.stationMm],
  ]);
  const used = new Set(['NAME']);
  for (const [blockName, pattern] of RAW_PSEUDO_BLOCKS) {
    const entries = Object.entries(object.properties ?? {}).filter(([key]) => pattern.test(key));
    entries.forEach(([key]) => used.add(key));
    groupedPush(groups, blockName, '', entries);
  }
  groupedPush(groups, 'Other', '', Object.entries(object.properties ?? {}).filter(([key]) => !used.has(key)));
}

function addPacketGroups(groups, packets) {
  const byKind = new Map();
  for (const packet of packets) {
    if (!byKind.has(packet.kind)) byKind.set(packet.kind, []);
    byKind.get(packet.kind).push(packet);
  }
  for (const [kind, instances] of byKind) {
    if (groups.some((group) => group.blockName.toUpperCase().startsWith(kind))) continue;
    const blockName = prettifyBlockName(kind.charAt(0) + kind.slice(1).toLowerCase());
    instances.forEach((packet, index) => {
      const entries = [...Object.entries(packet.attrs ?? {}), ...packetAncestryEntries(packet)];
      if (packet.consumedFrom) entries.push(['(from consumed)', packet.consumedFrom]);
      groupedPush(groups, blockName, instances.length > 1 ? `[${index + 1}]` : '', entries);
    });
  }
}

export function groupObjectBlocks(object) {
  if (!object) return [];
  const groups = [];
  if (Array.isArray(object.blocks) && object.blocks.length) addCategorizedGroups(groups, object.blocks);
  else addRawGroups(groups, object);
  addPacketGroups(groups, object.packets ?? []);
  return groups;
}
