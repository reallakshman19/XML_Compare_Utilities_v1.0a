function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function fmt(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
}

function metric(label, value) {
  return `<div class="p3d-elastic-metric"><span>${h(label)}</span><b>${h(value)}</b></div>`;
}

export function renderBendSummary(page, output) {
  const bend = output.elasticBends;
  const first = bend.candidates[0];
  page.querySelector('[data-p3d-elastic-summary]').innerHTML = [
    metric('Design basis', bend.screening.settings.designBasis),
    metric('Candidates', bend.diagnostics.candidateCount),
    metric('Emitted', bend.diagnostics.emittedCount),
    metric('First derived class', first ? `${first.classification} / ${first.bendClass}` : '—'),
    metric('First radius basis', first?.radiusBasis || '—'),
    metric('Ignored short elements', bend.diagnostics.ignoredShortSegmentCount || 0),
    metric('Blocking errors', bend.diagnostics.blockedCount || 0),
  ].join('');
}

function candidateRow(item) {
  return `<tr><td>${h(item.sourceBasis)}</td><td>${h(item.classification)}</td><td>${h(item.bendClass)}</td><td>${h(item.classificationReason)}</td><td>${h(item.radiusBasis)}</td><td>${fmt(item.radiusD)}</td><td>${fmt(item.radiusMm)}</td><td>${fmt(item.planAngleDeg)}</td><td>${fmt(item.profileAngleDeg)}</td><td>${fmt(item.turnAngleDeg)}</td><td>${h(item.previousNode)} → ${h(item.cornerNode)} → ${h(item.nextNode)}</td><td>${h(item.classificationPreviousNode)} → ${h(item.classificationNextNode)}</td><td>${h(item.ignoredSegmentIndexes.join(','))}</td><td>${fmt(item.ignoredTotalLengthMm)}</td><td>${h(item.status)}</td></tr>`;
}

export function renderBendCandidates(page, output) {
  const rows = output.elasticBends.candidates.map(candidateRow).join('');
  page.querySelector('[data-p3d-elastic-result]').innerHTML = `<table><thead><tr><th>Source basis</th><th>Geometry</th><th>Bend class</th><th>Reason</th><th>Radius basis</th><th>Radius D</th><th>Radius mm</th><th>Plan°</th><th>Profile°</th><th>3D°</th><th>Owned nodes</th><th>Classification support</th><th>Ignored segments</th><th>Ignored mm</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="15">No authoritative direction-change candidates.</td></tr>'}</tbody></table>`;
  const diagnostics = [...output.elasticBends.errors, ...output.elasticBends.warnings];
  page.querySelector('[data-p3d-elastic-warnings]').textContent = diagnostics
    .map((item) => `${item.severity}: ${item.code}: ${item.message}`)
    .join('\n');
}
