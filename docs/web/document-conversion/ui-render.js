export function setNotice(element, message, tone = 'muted') {
  element.className = `notice ${tone}`;
  element.textContent = message;
}

export function renderIndexSummary(element, result) {
  const index = result.index || {};
  const total = index.totalPages ?? 0;
  const ocrPages = index.ocrIndexedPages?.length ?? 0;
  const incomplete = index.pagesWithoutSearchableText?.length ?? 0;
  element.hidden = false;
  element.replaceChildren(
    metric('Matches', result.summary?.totalMatches ?? 0),
    metric('Pages', total),
    metric('OCR indexed', ocrPages),
    metric('Index source', index.cacheSource || 'unknown'),
    metric('Unsearchable', incomplete),
  );
}

export function renderPageChips(element, pageEntries, selectedPages, onToggle) {
  element.replaceChildren();
  if (!pageEntries.length) {
    element.append(emptyMessage('No pages contain the requested text.'));
    return;
  }
  for (const entry of pageEntries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = selectedPages.has(entry.page) ? 'page-chip selected' : 'page-chip';
    button.setAttribute('aria-pressed', selectedPages.has(entry.page) ? 'true' : 'false');
    button.textContent = `Page ${entry.page} · ${entry.matches}`;
    button.addEventListener('click', () => onToggle(entry.page));
    element.append(button);
  }
}

export function renderSearchResults(element, matches, selectedPages, onToggle) {
  element.replaceChildren();
  if (!matches.length) {
    element.append(emptyMessage('No matches found.'));
    return;
  }
  const groups = groupByPage(matches);
  for (const [page, values] of groups) {
    const section = document.createElement('section');
    section.className = 'result-page';
    section.append(pageHeader(page, values.length, selectedPages.has(page), onToggle));
    for (const match of values) section.append(matchCard(match));
    element.append(section);
  }
}

export function renderConversionOutput(elements, result) {
  elements.markdown.value = result.markdown || '';
  elements.evidence.textContent = JSON.stringify(result.evidence || {}, null, 2);
  elements.copy.disabled = false;
  elements.downloadMarkdown.disabled = false;
  elements.downloadEvidence.disabled = false;
}

export function setOutputTab(elements, tab) {
  const markdownActive = tab === 'markdown';
  elements.markdown.hidden = !markdownActive;
  elements.evidence.hidden = markdownActive;
  elements.markdownTab.classList.toggle('active', markdownActive);
  elements.evidenceTab.classList.toggle('active', !markdownActive);
  elements.markdownTab.setAttribute('aria-selected', String(markdownActive));
  elements.evidenceTab.setAttribute('aria-selected', String(!markdownActive));
}

export function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function metric(label, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'metric';
  const name = document.createElement('span');
  name.className = 'metric-label';
  name.textContent = label;
  const content = document.createElement('strong');
  content.textContent = String(value);
  wrapper.append(name, content);
  return wrapper;
}

function emptyMessage(text) {
  const value = document.createElement('p');
  value.className = 'empty';
  value.textContent = text;
  return value;
}

function groupByPage(matches) {
  const groups = new Map();
  for (const match of matches) {
    if (!groups.has(match.page)) groups.set(match.page, []);
    groups.get(match.page).push(match);
  }
  return [...groups.entries()].sort((left, right) => left[0] - right[0]);
}

function pageHeader(page, count, selected, onToggle) {
  const header = document.createElement('div');
  header.className = 'result-page-header';
  const title = document.createElement('h3');
  title.textContent = `Page ${page}`;
  const meta = document.createElement('span');
  meta.textContent = `${count} match${count === 1 ? '' : 'es'}`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = selected ? 'button small selected' : 'button ghost small';
  button.textContent = selected ? 'Included' : 'Include page';
  button.addEventListener('click', () => onToggle(page));
  header.append(title, meta, button);
  return header;
}

function matchCard(match) {
  const card = document.createElement('article');
  card.className = 'match-card';
  const meta = document.createElement('div');
  meta.className = 'match-meta';
  const source = document.createElement('span');
  source.className = match.extraction === 'ocr' ? 'badge ocr' : 'badge';
  source.textContent = match.extraction === 'ocr' ? 'OCR' : 'Native';
  meta.append(source);
  if (typeof match.confidence === 'number') {
    const confidence = document.createElement('span');
    confidence.textContent = `${Math.round(match.confidence * 100)}% confidence`;
    meta.append(confidence);
  }
  const snippet = document.createElement('p');
  appendHighlighted(snippet, match.snippet || match.lineText || '', match.snippetMatchRange);
  card.append(meta, snippet);
  return card;
}

function appendHighlighted(element, text, range) {
  if (!range || range.start < 0 || range.end <= range.start || range.end > text.length) {
    element.textContent = text;
    return;
  }
  element.append(document.createTextNode(text.slice(0, range.start)));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(range.start, range.end);
  element.append(mark, document.createTextNode(text.slice(range.end)));
}
