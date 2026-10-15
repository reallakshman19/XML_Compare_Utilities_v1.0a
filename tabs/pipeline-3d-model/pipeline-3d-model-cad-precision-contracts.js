export const PIPELINE_CAD_PRECISION_EXPRESSION_SCHEMA = 'PipelineCadPrecisionExpression.v1';
export const PIPELINE_CAD_PRECISION_SESSION_SCHEMA = 'PipelineCadPrecisionEditSession.v1';
export const PIPELINE_CAD_PRECISION_RESULT_SCHEMA = 'PipelineCadPrecisionEditResult.v1';

const freeze = (value) => Object.freeze(value);
const text = (value) => String(value ?? '').trim();

function finiteOrNull(value, label) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${label} must be finite.`);
  return number;
}

function freezeRecord(value = {}) {
  return freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    item && typeof item === 'object' && !Object.isFrozen(item) ? freezeRecord(item) : item,
  ])));
}

export function createPipelineCadPrecisionExpression(input = {}) {
  const kind = input.kind === 'pair' ? 'pair' : 'scalar';
  const mode = input.mode === 'relative' ? 'relative' : 'absolute';
  const values = freeze((Array.isArray(input.values) ? input.values : [])
    .map((value, index) => finiteOrNull(value, `values[${index}]`)));
  if (values.length !== (kind === 'pair' ? 2 : 1)) {
    throw new TypeError(`${kind} precision expressions require ${kind === 'pair' ? 2 : 1} value(s).`);
  }
  return freeze({
    schema: PIPELINE_CAD_PRECISION_EXPRESSION_SCHEMA,
    kind,
    mode,
    raw: text(input.raw),
    values,
    unit: text(input.unit),
  });
}

export function createPipelineCadPrecisionSession(input = {}) {
  const graph = text(input.graph);
  const entityId = text(input.entityId);
  const entityType = text(input.entityType);
  if (!['table2x', 'table3x'].includes(graph)) throw new TypeError('Precision session graph is invalid.');
  if (!entityId || !entityType) throw new TypeError('Precision session requires entity identity.');
  const sourceRevision = Number(input.sourceRevision);
  if (!Number.isInteger(sourceRevision) || sourceRevision < 0) throw new TypeError('sourceRevision must be a non-negative integer.');
  return freeze({
    schema: PIPELINE_CAD_PRECISION_SESSION_SCHEMA,
    sessionId: text(input.sessionId),
    graph,
    entityId,
    entityType,
    sourceRevision,
    coordinateMode: text(input.coordinateMode) || 'canonical',
    inputMode: input.inputMode === 'relative' ? 'relative' : 'absolute',
    source: ['typed', 'grip', 'context'].includes(input.source) ? input.source : 'typed',
    before: freezeRecord(input.before),
    requested: freezeRecord(input.requested),
    staged: freezeRecord(input.staged),
    valid: input.valid !== false,
    message: text(input.message),
  });
}

export function createPipelineCadPrecisionResult(input = {}) {
  const session = input.session;
  if (session?.schema !== PIPELINE_CAD_PRECISION_SESSION_SCHEMA) {
    throw new TypeError('Precision result requires a valid session.');
  }
  const reason = text(input.reason);
  if (!reason) throw new TypeError('Precision result requires a command reason.');
  return freeze({
    schema: PIPELINE_CAD_PRECISION_RESULT_SCHEMA,
    sessionId: session.sessionId,
    graph: session.graph,
    entityId: session.entityId,
    entityType: session.entityType,
    before: freezeRecord(input.before ?? session.before),
    after: freezeRecord(input.after ?? session.staged),
    reason,
  });
}

export const _test = freeze({ finiteOrNull, freezeRecord, text });
