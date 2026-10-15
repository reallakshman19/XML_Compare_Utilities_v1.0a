import { configuredAnchorSlots } from './navis-tag-anchor-policy.js';
import { NAVIS_TAG_EVIDENCE_SCHEMA, coordinateProfileOptions, normalizeConfig, parseCoordinate, text } from './navis-tag-isonote-contracts.js';

function decodeXml(value) {
  return String(value ?? '')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function stripTags(value) { return decodeXml(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function attrs(source) {
  const output = {};
  String(source || '').replace(/([A-Za-z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g, (_, key, value) => { output[key] = decodeXml(value); return ''; });
  return output;
}
function localTagPattern(tag) { return `(?:[A-Za-z_][\\w.-]*:)?${tag}`; }
function firstTagBody(source, tag) {
  return String(source || '').match(new RegExp(`<${localTagPattern(tag)}\\b[^>]*>([\\s\\S]*?)<\\/${localTagPattern(tag)}>`, 'i'))?.[1] || '';
}
function blocks(source, tag) {
  const regex = new RegExp(`<${localTagPattern(tag)}\\b([^>]*)>([\\s\\S]*?)<\\/${localTagPattern(tag)}>`, 'gi');
  const output = [];
  let match;
  while ((match = regex.exec(String(source || '')))) output.push({ attrs: attrs(match[1]), body: match[2], index: match.index });
  return output;
}
function firstPos3f(source) {
  const match = String(source || '').match(new RegExp(`<${localTagPattern('pos3f')}\\b([^>]*)\\/?\\s*>`, 'i'));
  if (!match) return null;
  const a = attrs(match[1]);
  const point = { x: Number(a.x), y: Number(a.y), z: Number(a.z) };
  return Object.values(point).every(Number.isFinite) ? point : null;
}
function boundsMidpoint(source) {
  const min = firstPos3f(firstTagBody(source, 'min'));
  const max = firstPos3f(firstTagBody(source, 'max'));
  if (!min || !max) return null;
  return { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
}
function parseCreatedDate(commentBody) {
  const match = String(commentBody || '').match(new RegExp(`<${localTagPattern('date')}\\b([^>]*)\\/?\\s*>`, 'i'));
  if (!match) return '';
  const a = attrs(match[1]);
  if (!a.year || !a.month || !a.day) return '';
  const date = [a.year, a.month, a.day].map((part, index) => index ? String(part).padStart(2, '0') : String(part)).join('-');
  const time = ['hour', 'minute', 'second'].map((key) => String(a[key] || '0').padStart(2, '0')).join(':');
  return `${date}T${time}`;
}
function rootUnit(source, override) {
  if (override && override !== 'auto') return override;
  const exchange = String(source || '').match(new RegExp(`<${localTagPattern('exchange')}\\b([^>]*)>`, 'i'));
  return attrs(exchange?.[1] || '').units || 'm';
}
function diagnostic(severity, code, message, context = {}) { return { severity, code, message, ...context }; }

export function parseNavisTagXml(xmlText, inputConfig = {}, identityTrace = null) {
  const source = String(xmlText || '');
  const config = normalizeConfig(inputConfig);
  const diagnostics = [];
  if (!source.trim()) return { tags: [], diagnostics: [diagnostic('ERROR', 'NAVIS_XML_EMPTY', 'Navis Tag XML is empty.')], summary: { viewCount: 0, tagCount: 0, validTagCount: 0, units: '' } };
  if (!new RegExp(`<${localTagPattern('exchange')}\\b`, 'i').test(source)) diagnostics.push(diagnostic('ERROR', 'NAVIS_EXCHANGE_ROOT_MISSING', 'No Navis <exchange> root was found.'));

  const units = rootUnit(source, config.navisUnits);
  const tags = [];
  const viewBlocks = blocks(source, 'view');
  viewBlocks.forEach((view, viewIndexZero) => {
    const viewIndex = viewIndexZero + 1;
    const viewAttrs = view.attrs;
    const comments = new Map();
    for (const commentBlock of blocks(view.body, 'comment')) {
      const id = commentBlock.attrs.id || `COMMENT-${comments.size + 1}`;
      if (comments.has(id)) diagnostics.push(diagnostic('WARN', 'DUPLICATE_COMMENT_ID_IN_VIEW', `Duplicate comment id ${id} in ${viewAttrs.name || `View ${viewIndex}`}.`, { viewGuid: viewAttrs.guid || '', commentId: id }));
      comments.set(id, { id, status: commentBlock.attrs.status || '', body: stripTags(firstTagBody(commentBlock.body, 'body')), user: stripTags(firstTagBody(commentBlock.body, 'user')), createdDate: parseCreatedDate(commentBlock.body) });
    }

    const usedCommentIds = new Set();
    blocks(view.body, 'rltag').forEach((tagBlock, tagIndexZero) => {
      const tagIndex = tagIndexZero + 1;
      const tagAttrs = tagBlock.attrs;
      const commentId = tagAttrs.commentid || tagAttrs.id || '';
      const comment = comments.get(commentId) || null;
      if (commentId) usedCommentIds.add(commentId);
      const pos3dBody = firstTagBody(tagBlock.body, 'pos3d');
      const directPosition = firstPos3f(pos3dBody);
      const fallbackPosition = directPosition ? null : boundsMidpoint(firstTagBody(tagBlock.body, 'bounds'));
      const rawPosition = directPosition || fallbackPosition;
      const positionSource = directPosition ? 'RLTAG_POS3D' : fallbackPosition ? 'RLTAG_BOUNDS_MIDPOINT' : 'NONE';
      const position = rawPosition ? parseCoordinate(rawPosition, units, coordinateProfileOptions(config, 'navis')) : null;
      const codes = [];
      if (!comment) codes.push('COMMENT_LINK_NOT_FOUND');
      if (!comment?.body) codes.push('COMMENT_BODY_EMPTY');
      if (!rawPosition) codes.push('TAG_POSITION_MISSING');
      if (positionSource === 'RLTAG_BOUNDS_MIDPOINT') codes.push('POSITION_FROM_BOUNDS');
      const tagId = tagAttrs.id || String(tagIndex);
      const evidence = {
        schema: NAVIS_TAG_EVIDENCE_SCHEMA,
        evidenceId: `${viewAttrs.guid || `VIEW-${viewIndex}`}:RL-${tagId}:C-${commentId || 'NONE'}`,
        viewIndex, viewName: viewAttrs.name || `View ${viewIndex}`, viewGuid: viewAttrs.guid || '', tagId, commentId,
        commentBody: comment?.body || '', commentUser: comment?.user || '', commentStatus: comment?.status || '', commentDate: comment?.createdDate || '',
        rawPosition, position, positionSource, units, coordinateProfileName: position?.profileName || config.navisCoordinateProfileName, datumOffsetMm: position?.datumOffsetMm || null, tagAttributes: tagAttrs, diagnostics: codes,
      };
      tags.push(evidence);
      codes.forEach((code) => diagnostics.push(diagnostic(code === 'COMMENT_BODY_EMPTY' || code === 'POSITION_FROM_BOUNDS' ? 'WARN' : 'ERROR', code, `${code} for ${evidence.evidenceId}.`, { evidenceId: evidence.evidenceId, viewGuid: evidence.viewGuid, tagId: evidence.tagId, commentId: evidence.commentId })));
    });
    for (const [commentId, comment] of comments) if (!usedCommentIds.has(commentId)) diagnostics.push(diagnostic('WARN', 'COMMENT_WITHOUT_RLTAG', `Comment ${commentId} is not referenced by an rltag.`, { viewGuid: viewAttrs.guid || '', commentId, commentBody: comment.body }));
  });

  if (!viewBlocks.length) diagnostics.push(diagnostic('ERROR', 'NAVIS_VIEWS_NOT_FOUND', 'No <view> records were found.'));
  if (!tags.length) diagnostics.push(diagnostic('ERROR', 'NAVIS_TAGS_NOT_FOUND', 'No <rltag> records were found.'));
  const result = {
    tags, diagnostics,
    summary: {
      viewCount: viewBlocks.length, tagCount: tags.length, validTagCount: tags.filter((tag) => tag.position && tag.commentBody).length,
      boundsFallbackCount: tags.filter((tag) => tag.positionSource === 'RLTAG_BOUNDS_MIDPOINT').length,
      unresolvedCommentCount: tags.filter((tag) => !tag.commentBody).length,
      unresolvedPositionCount: tags.filter((tag) => !tag.position).length,
      units,
      coordinateProfileName: config.navisCoordinateProfileName,
      datumOffsetMm: coordinateProfileOptions(config, 'navis'),
    },
  };
  return applyAnchorTransformation(result, identityTrace, config);
}

function normalizedIdentity(value) { return text(value).toLowerCase().replace(/^\//, ''); }
function findAnchorTag(tags, tagId) {
  return tags.find((tag) => [tag.tagId, tag.commentId, tag.viewIndex].some((value) => text(value) === tagId)) || null;
}
function findAnchorRow(rows, supportIdentity) {
  const target = normalizedIdentity(supportIdentity);
  return rows.find((row) => {
    const candidates = [row.canonicalIdentity, row.tableIdentityRaw, ...(row.groupedIdentities || [])];
    return candidates.some((value) => normalizedIdentity(value) === target);
  }) || null;
}
function failedAttempt(anchor, status, reason) {
  return { ...anchor, valid: false, status, reason, anchorId: '', resolvedTagId: '', resolvedSupportIdentity: '', deltaEMm: null, deltaNMm: null, deltaElMm: null };
}
function zeroDatumConfig(config) {
  return { ...config, navisEastingDatumMm: 0, navisNorthingDatumMm: 0, navisElevationDatumMm: 0 };
}
function stableAnchorId(tagId, supportIdentity) {
  return `TAG:${text(tagId)}|SUPPORT:${normalizedIdentity(supportIdentity).toUpperCase()}`;
}
function evaluateAnchor(anchor, navisParse, identityTrace, config) {
  if (!anchor.complete) return failedAttempt(anchor, 'INCOMPLETE_CONFIG', 'Both Tag ID and Support ID are required.');
  const anchorTag = findAnchorTag(navisParse.tags, anchor.tagId);
  if (!anchorTag) return failedAttempt(anchor, 'TAG_NOT_FOUND', `Navis Tag ${anchor.tagId} was not found.`);
  const anchorRow = findAnchorRow(identityTrace?.rows || [], anchor.supportIdentity);
  if (!anchorRow) return failedAttempt(anchor, 'SUPPORT_NOT_FOUND', `JSON support ${anchor.supportIdentity} was not found.`);
  if (!anchorTag.rawPosition || !anchorRow.position) return failedAttempt(anchor, 'COORDINATE_MISSING', 'Anchor Tag or JSON support has no usable coordinate.');
  const base = parseCoordinate(anchorTag.rawPosition, anchorTag.units, coordinateProfileOptions(zeroDatumConfig(config), 'navis'));
  const json = anchorRow.position;
  if (![base?.x, base?.y, base?.z, json?.x, json?.y, json?.z].every(Number.isFinite)) return failedAttempt(anchor, 'COORDINATE_INVALID', 'Anchor coordinates are not finite numbers.');
  const resolvedSupportIdentity = anchorRow.canonicalIdentity;
  return {
    ...anchor,
    valid: true,
    status: 'VALID_HYPOTHESIS',
    reason: 'Configured Tag and JSON support identity resolved with finite coordinates.',
    anchorId: stableAnchorId(anchorTag.tagId, resolvedSupportIdentity),
    resolvedTagId: anchorTag.tagId,
    commentId: anchorTag.commentId,
    anchorTag,
    anchorRow,
    resolvedSupportIdentity,
    groupedSourceIdentities: anchorRow.tableIdentityRaw || (anchorRow.groupedIdentities || []).join('|'),
    selectedNodeId: anchorRow.selectedNodeId || '',
    selectedJsonPath: anchorRow.selectedJsonPath || '',
    selectedBranch: anchorRow.resolvedBranch || '',
    deltaEMm: Number(json.x) - Number(base.x),
    deltaNMm: Number(json.y) - Number(base.y),
    deltaElMm: Number(json.z) - Number(base.z),
  };
}
function inactiveAnchor(attempts = [], summaryText = '') {
  return { active: false, policy: 'EQUAL_AUTHORITY', configuredCount: attempts.length, validCount: 0, hypotheses: [], attempts, globalTransformApplied: false, summaryText };
}
function anchorSummary(valid) {
  return `${valid.length} equal-authority anchor transform ${valid.length === 1 ? 'hypothesis' : 'hypotheses'} available. Candidate matching may use whichever hypothesis gives the best tolerance-normalized result.`;
}

export function applyAnchorTransformation(navisParse, identityTrace, inputConfig = {}) {
  if (!navisParse || !Array.isArray(navisParse.tags)) return navisParse;
  const config = normalizeConfig(inputConfig);
  const anchors = configuredAnchorSlots(config);
  if (!anchors.length || !identityTrace) {
    navisParse.anchor = inactiveAnchor([], '');
    return navisParse;
  }
  const attempts = anchors.map((anchor) => evaluateAnchor(anchor, navisParse, identityTrace, config));
  const hypotheses = attempts.filter((attempt) => attempt.valid).sort((a, b) => a.anchorId.localeCompare(b.anchorId));
  if (!hypotheses.length) {
    const reasons = attempts.map((attempt) => `Anchor ${attempt.slot || attempt.priority}: ${attempt.status}`).join('; ');
    navisParse.anchor = inactiveAnchor(attempts, `No configured anchor hypothesis is usable. ${reasons}`);
    return navisParse;
  }
  const single = hypotheses.length === 1 ? hypotheses[0] : null;
  if (single) {
    const effectiveConfig = { ...config, navisEastingDatumMm: single.deltaEMm, navisNorthingDatumMm: single.deltaNMm, navisElevationDatumMm: single.deltaElMm };
    const options = coordinateProfileOptions(effectiveConfig, 'navis');
    for (const tag of navisParse.tags) {
      if (!tag.rawPosition) continue;
      const newPos = parseCoordinate(tag.rawPosition, tag.units, options);
      tag.position = newPos;
      tag.datumOffsetMm = newPos?.datumOffsetMm || { x: single.deltaEMm, y: single.deltaNMm, z: single.deltaElMm };
      tag.transformBasis = `Single anchor: Tag ${single.resolvedTagId} ↔ /${single.resolvedSupportIdentity}`;
    }
  }
  navisParse.anchor = {
    active: true,
    policy: 'EQUAL_AUTHORITY',
    configuredCount: anchors.length,
    validCount: hypotheses.length,
    hypotheses,
    attempts,
    globalTransformApplied: Boolean(single),
    tagId: single?.resolvedTagId || '',
    commentId: single?.commentId || '',
    supportIdentity: single?.resolvedSupportIdentity || '',
    deltaEMm: single?.deltaEMm ?? null,
    deltaNMm: single?.deltaNMm ?? null,
    deltaElMm: single?.deltaElMm ?? null,
    summaryText: anchorSummary(hypotheses),
  };
  if (navisParse.summary) {
    navisParse.summary.anchorPolicy = 'EQUAL_AUTHORITY';
    navisParse.summary.anchorValidCount = hypotheses.length;
    navisParse.summary.anchorGlobalTransformApplied = Boolean(single);
    if (single) navisParse.summary.datumOffsetMm = { x: single.deltaEMm, y: single.deltaNMm, z: single.deltaElMm };
  }
  return navisParse;
}
