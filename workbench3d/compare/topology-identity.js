/**
 * topology-identity.js — annotate CanonicalTopology with source identity from
 * the staged JSON it was built from, and extract basis pairs for compare.
 *
 * Annotation gives every edge: a side-prefixed id ("source:CE-…"/"target:CE-…"),
 * ref (ComponentRefNo), name (node name), nodeNumbers, lengthMm, properties
 * (transferable scalar block) and packets (RESTRAINT blocks from attached
 * supports). Basis pairs are identity-grade matches — shared ComponentRefNo or
 * shared support tag — which carry the highest confidence in auto mode.
 */

/** Attribute keys carried as the transferable/comparable property block. */
export const PROPERTY_BLOCK_KEYS = Object.freeze([
  'NAME', 'PIPINGCLASS', 'RATING', 'BOREMM', 'MATERIALCODE', 'ELEMENTLENGTHMM',
  'OUTSIDEDIAMETER', 'WALLTHICKNESS', 'CORROSIONALLOWANCE', 'INSULATIONTHICKNESS',
]);

function rootPathOf(stagedDoc) {
  if (Array.isArray(stagedDoc)) return '$';
  if (Array.isArray(stagedDoc?.objects)) return '$.objects';
  if (Array.isArray(stagedDoc?.hierarchy)) return '$.hierarchy';
  if (Array.isArray(stagedDoc?.branches)) return '$.branches';
  return '$';
}

function branchesOf(stagedDoc) {
  if (Array.isArray(stagedDoc)) return stagedDoc;
  return stagedDoc?.objects ?? stagedDoc?.hierarchy ?? stagedDoc?.branches ?? [];
}

/** Map "$.objects[i].children[j]" → staged component record. */
export function buildComponentPathIndex(stagedDoc) {
  const root = rootPathOf(stagedDoc);
  const index = new Map();
  branchesOf(stagedDoc).forEach((branch, branchIndex) => {
    (branch?.children ?? []).forEach((child, childIndex) => {
      index.set(`${root}[${branchIndex}].children[${childIndex}]`, child);
    });
  });
  return index;
}

const prefixId = (side, id) => (id ? `${side}:${id}` : id);

function edgeLength(edge, nodesById) {
  const a = nodesById.get(edge.fromNodeId)?.position;
  const b = nodesById.get(edge.toNodeId)?.position;
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function componentPaths(edge) {
  return (edge.sourcePaths ?? []).filter((path) => path.includes('.children['));
}

/**
 * Annotate a canonical topology with staged identity and prefix all ids by
 * side ("source"/"target") so the two revisions never share an id-space.
 * Returns a plain (non-frozen) shallow topology copy.
 */
export function annotateTopology(topo, stagedDoc, side) {
  const pathIndex = buildComponentPathIndex(stagedDoc);
  const nodesById = new Map(topo.nodes.map((n) => [n.id, n]));

  // Support packets keyed by the edge component path they attach to.
  const packetsByEdgePath = new Map();
  const supports = (topo.supports ?? []).map((support) => {
    const component = firstComponent(support.sourcePaths, pathIndex);
    const tag = String(support.tag ?? component?.attributes?.NAME ?? '').trim();
    const packets = (support.restraints ?? []).map((restraint) => ({
      kind: 'RESTRAINT',
      attrs: {
        TAG: tag,
        TYPE: String(restraint.type ?? restraint.direction ?? ''),
        STIFFNESS: String(restraint.stiffness ?? ''),
        GAP: String(restraint.gap ?? ''),
        FRICTION: String(restraint.friction ?? ''),
        NODE: String(support.inputXmlNodeId ?? ''),
      },
    }));
    const edgePath = support.attachmentEdgeSourcePath;
    if (edgePath && packets.length) {
      packetsByEdgePath.set(edgePath, [...(packetsByEdgePath.get(edgePath) ?? []), ...packets]);
    }
    return {
      ...support,
      id: prefixId(side, support.id),
      nodeId: prefixId(side, support.nodeId),
      tag,
      packets,
    };
  });

  const edges = topo.edges.map((edge, rawIndex) => {
    const components = componentPaths(edge).map((path) => pathIndex.get(path)).filter(Boolean);
    const attrs = components.map((c) => c?.attributes ?? {});
    const ref = attrs.map((a) => String(a.REF ?? '').trim()).find(Boolean) ?? '';
    const name = attrs.map((a) => String(a.NAME ?? '').trim()).find(Boolean) ?? '';
    const nodeNumbers = attrs
      .flatMap((a) => String(a.NODE_NUMBERS ?? '').split(','))
      .map((v) => v.trim()).filter((v) => v && v !== '-1');
    const properties = {};
    for (const a of attrs) {
      for (const key of PROPERTY_BLOCK_KEYS) {
        if (a[key] != null && String(a[key]).trim() !== '' && properties[key] == null) {
          properties[key] = String(a[key]).trim();
        }
      }
    }
    const packets = componentPaths(edge).flatMap((path) => packetsByEdgePath.get(path) ?? []);
    return {
      ...edge,
      id: prefixId(side, edge.id),
      fromNodeId: prefixId(side, edge.fromNodeId),
      toNodeId: prefixId(side, edge.toNodeId),
      rawIndex,
      ref,
      name,
      nodeNumbers,
      lengthMm: edgeLength(edge, nodesById),
      properties,
      packets,
    };
  });

  const nodes = topo.nodes.map((node) => ({ ...node, id: prefixId(side, node.id) }));
  const pointFeatures = (topo.pointFeatures ?? []).map((f) => ({ ...f, nodeId: prefixId(side, f.nodeId) }));
  const junctions = (topo.junctions ?? []).map((j) => ({ ...j, id: prefixId(side, j.id), nodeId: prefixId(side, j.nodeId) }));
  const boundaries = (topo.boundaries ?? []).map((b) => ({ ...b, id: prefixId(side, b.id), nodeId: prefixId(side, b.nodeId) }));

  return { ...topo, side, nodes, edges, pointFeatures, junctions, boundaries, supports };
}

function firstComponent(sourcePaths, pathIndex) {
  for (const path of sourcePaths ?? []) {
    const component = pathIndex.get(path);
    if (component) return component;
  }
  return null;
}

function uniqueKeyMap(edges, keyOf) {
  const map = new Map();
  const dropped = new Set();
  for (const edge of edges) {
    const key = keyOf(edge);
    if (!key) continue;
    if (map.has(key)) { dropped.add(key); continue; }
    map.set(key, edge);
  }
  for (const key of dropped) map.delete(key);
  return map;
}

/**
 * Identity-grade basis pairs between two annotated topologies.
 * Order matters: ref pairs first (strongest), then support-tag pairs, then
 * unique edge names. One source/target edge participates in at most one pair.
 */
export function extractBasisPairs(topoA, topoB) {
  const pairs = [];
  const usedSource = new Set();
  const usedTarget = new Set();
  const claim = (sourceEdge, targetEdge, via, detail) => {
    if (!sourceEdge || !targetEdge) return;
    if (usedSource.has(sourceEdge.id) || usedTarget.has(targetEdge.id)) return;
    usedSource.add(sourceEdge.id);
    usedTarget.add(targetEdge.id);
    pairs.push({ sourceObjectId: sourceEdge.id, targetObjectId: targetEdge.id, via, detail });
  };

  const refA = uniqueKeyMap(topoA.edges, (e) => e.ref);
  const refB = uniqueKeyMap(topoB.edges, (e) => e.ref);
  for (const [ref, sourceEdge] of refA) {
    claim(sourceEdge, refB.get(ref), 'basis-ref', `ComponentRefNo ${ref}`);
  }

  // Support tags: map each support to the edge its attachment rides on.
  const edgeByPathA = edgesByComponentPath(topoA);
  const edgeByPathB = edgesByComponentPath(topoB);
  const tagA = uniqueKeyMap(topoA.supports ?? [], (s) => s.tag);
  const tagB = uniqueKeyMap(topoB.supports ?? [], (s) => s.tag);
  for (const [tag, supportA] of tagA) {
    const supportB = tagB.get(tag);
    if (!supportB) continue;
    claim(
      edgeByPathA.get(supportA.attachmentEdgeSourcePath),
      edgeByPathB.get(supportB.attachmentEdgeSourcePath),
      'basis-name',
      `support tag ${tag}`,
    );
  }

  const nameA = uniqueKeyMap(topoA.edges, (e) => e.name);
  const nameB = uniqueKeyMap(topoB.edges, (e) => e.name);
  for (const [name, sourceEdge] of nameA) {
    claim(sourceEdge, nameB.get(name), 'basis-name', `node name ${name}`);
  }

  return pairs;
}

function edgesByComponentPath(topo) {
  const map = new Map();
  for (const edge of topo.edges) {
    for (const path of componentPaths(edge)) {
      if (!map.has(path)) map.set(path, edge);
    }
  }
  return map;
}

/**
 * Support anchor pairs (matched tags) for the registration audit — rendered
 * as registration-anchor connectors between the attachment nodes.
 */
export function extractAnchorPairs(topoA, topoB) {
  const tagA = uniqueKeyMap(topoA.supports ?? [], (s) => s.tag);
  const tagB = uniqueKeyMap(topoB.supports ?? [], (s) => s.tag);
  const pairs = [];
  for (const [tag, supportA] of tagA) {
    const supportB = tagB.get(tag);
    if (!supportB) continue;
    const residual = Math.hypot(
      (supportA.position?.x ?? 0) - (supportB.position?.x ?? 0),
      (supportA.position?.y ?? 0) - (supportB.position?.y ?? 0),
      (supportA.position?.z ?? 0) - (supportB.position?.z ?? 0),
    );
    pairs.push({
      sourceNode: supportA.nodeId,
      targetNode: supportB.nodeId,
      tag,
      residualMm: Number(residual.toFixed(1)),
    });
  }
  return pairs;
}
