import {
  PIPELINE_ARTIFACT_MATERIALIZATION_ON_DOWNLOAD,
} from './pipeline-3d-model-on-demand-artifact.js';

function text(value) {
  return String(value ?? '');
}

function byteLength(value) {
  return new TextEncoder().encode(text(value)).byteLength;
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function formatBytes(value) {
  const bytes = Number.isFinite(value) && value >= 0 ? value : 0;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function artifactByteLength(item) {
  if (item?.materialization === PIPELINE_ARTIFACT_MATERIALIZATION_ON_DOWNLOAD) return null;
  if (Number.isFinite(item?.byteLength) && item.byteLength >= 0) return item.byteLength;
  return byteLength(item?.text);
}

function artifactPresentation(item, index) {
  const name = text(item?.name).trim() || `artifact-${index + 1}`;
  const role = text(item?.role).trim() || 'UNSPECIFIED_ROLE';
  const sourceSchema = text(item?.sourceSchema).trim() || 'UNSPECIFIED_SCHEMA';
  const bytes = artifactByteLength(item);
  const sizeLabel = bytes == null ? 'generated on download' : formatBytes(bytes);
  return Object.freeze({
    index, name, role, sourceSchema, byteLength: bytes,
    deferred: bytes == null, sizeLabel,
    title: `${role} | ${sourceSchema} | ${sizeLabel}`,
  });
}

export function summarizePipelineArtifacts(artifacts = []) {
  const source = Array.isArray(artifacts) ? artifacts : [];
  const items = Object.freeze(source.map(artifactPresentation));
  const totalBytes = items.reduce((total, item) => total + (item.byteLength ?? 0), 0);
  const deferredCount = items.filter((item) => item.deferred).length;
  return Object.freeze({
    artifactCount: items.length,
    totalBytes,
    totalSizeLabel: formatBytes(totalBytes),
    deferredCount,
    items,
  });
}

export function groupPipelineArtifactsByRole(items = []) {
  const source = Array.isArray(items) ? items : [];
  const groups = [];
  const byRole = new Map();
  for (const item of source) {
    if (!byRole.has(item.role)) {
      const group = { role: item.role, items: [] };
      byRole.set(item.role, group); groups.push(group);
    }
    byRole.get(item.role).items.push(item);
  }
  return Object.freeze(groups.map((group) => Object.freeze({
    role: group.role, items: Object.freeze([...group.items]),
  })));
}

function artifactButton(item) {
  const title = escapeHtml(item.title);
  const label = escapeHtml(`Download ${item.name}: ${item.title}`);
  return `<button type="button" data-p3d-artifact="${item.index}" title="${title}" aria-label="${label}">${escapeHtml(item.name)}</button>`;
}

function roleGroup(group, open) {
  const count = `${group.items.length} artifact${group.items.length === 1 ? '' : 's'}`;
  const actions = group.items.map(artifactButton).join(' ');
  return `<details data-p3d-artifact-role="${escapeHtml(group.role)}"${open ? ' open' : ''}><summary>${escapeHtml(group.role)} — ${count}</summary><div data-p3d-artifact-actions>${actions}</div></details>`;
}

export function buildPipelineArtifactPanelHtml(artifacts = []) {
  const summary = summarizePipelineArtifacts(artifacts);
  if (!summary.artifactCount) {
    return '<h4>Engineering evidence artifacts</h4><p>No artifacts available.</p>';
  }
  const countLabel = `${summary.artifactCount} artifact${summary.artifactCount === 1 ? '' : 's'}`;
  const deferred = summary.deferredCount
    ? ` loaded + ${summary.deferredCount} generated on download` : '';
  const groups = groupPipelineArtifactsByRole(summary.items);
  const groupedHtml = groups.map((group, index) => roleGroup(group, index === 0)).join('');
  return `<h4>Engineering evidence artifacts</h4><p data-p3d-artifact-summary>${countLabel} — ${summary.totalSizeLabel}${deferred} — ${groups.length} role${groups.length === 1 ? '' : 's'}</p><div data-p3d-artifact-role-groups>${groupedHtml}</div>`;
}
