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
  const groups = groupPipelineArtifactsByRole(summary.items);
  const groupedHtml = groups.map((group, index) => roleGroup(group, index === 0)).join('');
  return `<h4>Engineering evidence artifacts</h4><p data-p3d-artifact-summary>${countLabel} — ${summary.totalSizeLabel} — ${groups.length} role${groups.length === 1 ? '' : 's'}</p><div data-p3d-artifact-role-groups>${groupedHtml}</div>`;
}
