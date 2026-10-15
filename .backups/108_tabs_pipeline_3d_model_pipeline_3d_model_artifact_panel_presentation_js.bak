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

function artifactPresentation(item, index) {
  const name = text(item?.name).trim() || `artifact-${index + 1}`;
  const role = text(item?.role).trim() || 'UNSPECIFIED_ROLE';
  const sourceSchema = text(item?.sourceSchema).trim() || 'UNSPECIFIED_SCHEMA';
  const bytes = byteLength(item?.text);
  return Object.freeze({
    index, name, role, sourceSchema, byteLength: bytes,
    sizeLabel: formatBytes(bytes),
    title: `${role} | ${sourceSchema} | ${formatBytes(bytes)}`,
  });
}

export function summarizePipelineArtifacts(artifacts = []) {
  const source = Array.isArray(artifacts) ? artifacts : [];
  const items = Object.freeze(source.map(artifactPresentation));
  const totalBytes = items.reduce((total, item) => total + item.byteLength, 0);
  return Object.freeze({
    artifactCount: items.length,
    totalBytes,
    totalSizeLabel: formatBytes(totalBytes),
    items,
  });
}

function artifactButton(item) {
  const title = escapeHtml(item.title);
  const label = escapeHtml(`Download ${item.name}: ${item.title}`);
  return `<button type="button" data-p3d-artifact="${item.index}" title="${title}" aria-label="${label}">${escapeHtml(item.name)}</button>`;
}

export function buildPipelineArtifactPanelHtml(artifacts = []) {
  const summary = summarizePipelineArtifacts(artifacts);
  if (!summary.artifactCount) {
    return '<h4>Engineering evidence artifacts</h4><p>No artifacts available.</p>';
  }
  const countLabel = `${summary.artifactCount} artifact${summary.artifactCount === 1 ? '' : 's'}`;
  return `<h4>Engineering evidence artifacts</h4><p data-p3d-artifact-summary>${countLabel} — ${summary.totalSizeLabel}</p><div data-p3d-artifact-actions>${summary.items.map(artifactButton).join(' ')}</div>`;
}
