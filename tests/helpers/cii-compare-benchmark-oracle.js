function clean(value) {
  return String(value ?? '').trim();
}

function nodeSet(model) {
  return new Set(Object.keys(model?.nodes || {}).map(clean).filter(Boolean));
}

function edgeKey(a, b) {
  const left = clean(a); const right = clean(b);
  return [left, right].sort((x, y) => Number(x) - Number(y) || x.localeCompare(y)).join('|');
}

function edgeSet(model) {
  return new Set((model?.elements || []).map((element) => edgeKey(element.from, element.to)));
}

function addError(errors, code, details = {}) {
  errors.push(Object.freeze({ code, ...details }));
}

function requireNode(errors, nodes, nodeId, context) {
  const id = clean(nodeId);
  if (!id) addError(errors, 'ORACLE_NODE_ID_MISSING', context);
  else if (!nodes.has(id)) addError(errors, 'ORACLE_NODE_NOT_FOUND', { ...context, nodeId: id });
}

function validateGang(errors, model, nodeIds, context) {
  const nodes = (nodeIds || []).map(clean).filter(Boolean);
  if (nodes.length < 2) {
    addError(errors, 'ORACLE_GANG_TOO_SHORT', context);
    return;
  }
  const knownNodes = nodeSet(model);
  const knownEdges = edgeSet(model);
  for (const nodeId of nodes) requireNode(errors, knownNodes, nodeId, context);
  for (let index = 0; index < nodes.length - 1; index += 1) {
    if (!knownEdges.has(edgeKey(nodes[index], nodes[index + 1]))) {
      addError(errors, 'ORACLE_GANG_EDGE_NOT_FOUND', {
        ...context, from: nodes[index], to: nodes[index + 1], edgeIndex: index,
      });
    }
  }
}

function validateUniqueIds(errors, rows, family) {
  const seen = new Set();
  for (const row of rows || []) {
    const id = clean(row?.id);
    if (!id) addError(errors, 'ORACLE_CASE_ID_MISSING', { family });
    else if (seen.has(id)) addError(errors, 'ORACLE_CASE_ID_DUPLICATE', { family, id });
    else seen.add(id);
  }
}

function validateTargetCustody(errors, rows, targetKey) {
  const ownerByTarget = new Map();
  for (const row of rows || []) {
    const targetNode = clean(row?.[targetKey]);
    if (!targetNode) continue;
    const previous = ownerByTarget.get(targetNode);
    if (previous) {
      addError(errors, 'ORACLE_DUPLICATE_TARGET_CUSTODY', {
        targetKey, targetNode, firstCaseId: previous, secondCaseId: clean(row.id),
      });
    } else ownerByTarget.set(targetNode, clean(row.id));
  }
}

export function preflightCiiCompareOracle(oracle, models = {}) {
  const errors = [];
  if (oracle?.schema !== 'cii-compare-benchmark/v1') {
    addError(errors, 'ORACLE_SCHEMA_UNSUPPORTED', { schema: oracle?.schema || null });
  }
  if (oracle?.oracleRules?.deriveTargetsFromOffset !== false) {
    addError(errors, 'ORACLE_OFFSET_DERIVATION_MUST_BE_DISABLED');
  }

  const source = models.source;
  const target1 = models.target1;
  const target2 = models.target2;
  const sourceNodes = nodeSet(source);
  const target1Nodes = nodeSet(target1);
  const target2Nodes = nodeSet(target2);
  const nodeRows = oracle?.nodeMappings || [];
  const gangRows = oracle?.gangMappings || [];

  validateUniqueIds(errors, nodeRows, 'nodeMappings');
  validateUniqueIds(errors, gangRows, 'gangMappings');
  validateTargetCustody(errors, nodeRows, 'target1Node');
  validateTargetCustody(errors, nodeRows, 'target2Node');

  for (const row of nodeRows) {
    const context = { family: 'nodeMappings', caseId: clean(row.id) };
    requireNode(errors, sourceNodes, row.sourceNode, { ...context, side: 'SOURCE' });
    requireNode(errors, target1Nodes, row.target1Node, { ...context, side: 'TARGET1' });
    requireNode(errors, target2Nodes, row.target2Node, { ...context, side: 'TARGET2' });
  }

  for (const row of gangRows) {
    const context = { family: 'gangMappings', caseId: clean(row.id) };
    const sourceGang = row.sourceNodes || [];
    const target1Gang = row.target1Nodes || [];
    const target2Gang = row.target2Nodes || [];
    if (sourceGang.length !== target1Gang.length || sourceGang.length !== target2Gang.length) {
      addError(errors, 'ORACLE_GANG_CARDINALITY_MISMATCH', {
        ...context, sourceCount: sourceGang.length, target1Count: target1Gang.length, target2Count: target2Gang.length,
      });
    }
    validateGang(errors, source, sourceGang, { ...context, side: 'SOURCE' });
    validateGang(errors, target1, target1Gang, { ...context, side: 'TARGET1' });
    validateGang(errors, target2, target2Gang, { ...context, side: 'TARGET2' });
  }

  return Object.freeze({
    status: errors.length ? 'FAIL' : 'PASS',
    errors: Object.freeze(errors),
    checked: Object.freeze({ nodeMappings: nodeRows.length, gangMappings: gangRows.length }),
  });
}

export function assertCiiCompareOracle(oracle, models = {}) {
  const result = preflightCiiCompareOracle(oracle, models);
  if (result.status === 'PASS') return result;
  const detail = result.errors.map((error) => `${error.code}: ${JSON.stringify(error)}`).join('\n');
  throw new Error(`CII_COMPARE_BENCHMARK_ORACLE_INVALID\n${detail}`);
}
