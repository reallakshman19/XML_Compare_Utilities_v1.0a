/** Pure HTML builders for the Edit Draft inspector, timeline, and metrics. */

import { asArray, cleanText, escapeMarkup, objectRecord } from './topology-validator-values.js';
export {
  buildLineageRecordTableMarkup, buildRegisteredTopologyEditInspectorMarkup as buildTopologyEditInspectorMarkup,
  lineageRecordRows,
} from './topology-edit-inspector-registry.js';

/** @param {Record<string, unknown>} draft @returns {string} */
export function buildTopologyEditTimelineMarkup(draft) {
  const commands = asArray(draft.commands).map(objectRecord);
  return `<h3>Command timeline</h3>${commands.length ? `<ol>${commands.map((command) => `<li><b>${escapeMarkup(command.id)}</b><span>${escapeMarkup(command.type)}</span><code>${escapeMarkup(JSON.stringify(command.payload))}</code></li>`).join('')}</ol>` : '<p>No draft commands. Base hash is unchanged.</p>'}`;
}

/** @param {Record<string, unknown>} validation @returns {string} */
export function buildTopologyEditValidationMarkup(validation) {
  const findings = asArray(validation.findings).map(objectRecord);
  return `<h3>Blocking findings</h3>${findings.length ? `<ul>${findings.map((row) => `<li class="${row.blocking ? 'is-blocking' : ''}"><b>${escapeMarkup(row.code)}</b> ${escapeMarkup(row.message)}</li>`).join('')}</ul>` : '<p>No blocking findings. Export is enabled.</p>'}`;
}

/** @param {Record<string, unknown>} input @returns {string} */
export function buildTopologyEditMetricsMarkup(input) {
  const { baseArtifacts, canonical, draft, validation, lastRegenerationMs } = input;
  const rows = [
    ['Base hash', cleanText(baseArtifacts?.canonicalTopology?.canonicalTopologyHash).slice(-12) || '—'],
    ['Draft hash', cleanText(canonical?.canonicalTopologyHash).slice(-12) || '—'],
    ['Commands', draft?.commands?.length ?? 0], ['Nodes', canonical?.nodes?.length ?? 0], ['Elements', canonical?.edges?.length ?? 0],
    ['Restraints', asArray(canonical?.supports).reduce((sum, row) => sum + asArray(objectRecord(row).restraints).length, 0)],
    ['Rigid bodies', canonical?.rigids?.length ?? 0], ['Blocking', objectRecord(validation.summary).blockingCount ?? 0],
    ['Regeneration', `${lastRegenerationMs.toFixed(0)} ms`],
  ];
  return rows.map(([label, value]) => `<span><b>${escapeMarkup(label)}</b>${escapeMarkup(value)}</span>`).join('');
}
