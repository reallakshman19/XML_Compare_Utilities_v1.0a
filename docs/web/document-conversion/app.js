import { convertDocument, getCapabilities, searchPdf } from './api-client.js';
import {
  downloadText,
  renderConversionOutput,
  renderIndexSummary,
  renderPageChips,
  renderSearchResults,
  setNotice,
  setOutputTab,
} from './ui-render.js';

const elements = collectElements();
let state = {
  searchResult: null,
  conversionResult: null,
  selectedPages: new Set(),
  busy: false,
};

export async function startDocumentConversionUi() {
  bindEvents();
  setOutputTab(outputElements(), 'markdown');
  try {
    const capabilities = await getCapabilities();
    const persistent = capabilities.pdfSearch?.persistentIndex ? 'persistent index' : 'memory-only index';
    setHealth(true, `Service ready · ${persistent}`);
  } catch (error) {
    setHealth(false, errorMessage(error));
  }
}

function bindEvents() {
  elements.searchButton.addEventListener('click', runSearch);
  elements.query.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runSearch();
  });
  elements.clearSelection.addEventListener('click', clearSelection);
  elements.pageStart.addEventListener('input', manualRangeChanged);
  elements.pageEnd.addEventListener('input', manualRangeChanged);
  elements.convertButton.addEventListener('click', runConversion);
  elements.markdownTab.addEventListener('click', () => setOutputTab(outputElements(), 'markdown'));
  elements.evidenceTab.addEventListener('click', () => setOutputTab(outputElements(), 'evidence'));
  elements.copyMarkdown.addEventListener('click', copyMarkdown);
  elements.downloadMarkdown.addEventListener('click', downloadMarkdown);
  elements.downloadEvidence.addEventListener('click', downloadEvidence);
}

async function runSearch() {
  if (state.busy) return;
  const payload = searchPayload();
  if (!payload.sourcePath.trim() || !payload.query.trim()) {
    setNotice(elements.searchStatus, 'Source path and search text are required.', 'error');
    return;
  }
  setBusy(true);
  setNotice(elements.searchStatus, 'Indexing/searching PDF…', 'working');
  try {
    const result = await searchPdf(payload);
    state = { ...state, searchResult: result, selectedPages: new Set() };
    clearRangeInputs();
    renderSearchState();
    const count = result.summary?.totalMatches ?? 0;
    const incomplete = result.index?.pagesWithoutSearchableText?.length ?? 0;
    const suffix = incomplete ? ` · ${incomplete} page${incomplete === 1 ? '' : 's'} unsearchable` : '';
    setNotice(elements.searchStatus, `${count} trusted match${count === 1 ? '' : 'es'} found${suffix}.`, count ? 'success' : 'muted');
  } catch (error) {
    resetSearchView();
    setNotice(elements.searchStatus, errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

function searchPayload() {
  const payload = {
    sourcePath: elements.sourcePath.value,
    query: elements.query.value,
    options: {
      caseSensitive: elements.caseSensitive.checked,
      wholeWord: elements.wholeWord.checked,
      useRegex: false,
      ocr: elements.searchOcr.value,
      ocrLanguage: elements.searchLanguage.value,
      ocrConfidenceMin: Number(elements.searchConfidence.value),
    },
  };
  return withPassword(payload);
}

function renderSearchState() {
  const result = state.searchResult;
  if (!result) return;
  renderIndexSummary(elements.indexSummary, result);
  renderPageChips(
    elements.pageChips,
    result.summary?.pagesWithMatches || [],
    state.selectedPages,
    togglePage,
  );
  renderSearchResults(
    elements.searchResults,
    result.matches || [],
    state.selectedPages,
    togglePage,
  );
}

function togglePage(page) {
  const next = new Set(state.selectedPages);
  if (next.has(page)) next.delete(page);
  else next.add(page);
  state = { ...state, selectedPages: next };
  syncRangeFromSelection();
  renderSearchState();
}

function syncRangeFromSelection() {
  const pages = [...state.selectedPages].sort((a, b) => a - b);
  if (!pages.length) {
    clearRangeInputs();
    return;
  }
  elements.pageStart.value = String(pages[0]);
  elements.pageEnd.value = String(pages[pages.length - 1]);
  updateRangeHelp();
}

function manualRangeChanged() {
  if (state.selectedPages.size) {
    state = { ...state, selectedPages: new Set() };
    renderSearchState();
  }
  updateRangeHelp();
}

function clearSelection() {
  state = { ...state, selectedPages: new Set() };
  clearRangeInputs();
  renderSearchState();
}

function clearRangeInputs() {
  elements.pageStart.value = '';
  elements.pageEnd.value = '';
  updateRangeHelp();
}

function updateRangeHelp() {
  const start = Number(elements.pageStart.value);
  const end = Number(elements.pageEnd.value);
  if (start >= 1 && end >= start) {
    elements.rangeHelp.textContent = `Pages ${start}–${end} · ${end - start + 1} page${end === start ? '' : 's'}`;
  } else {
    elements.rangeHelp.textContent = 'Select one or more result pages, or type a range.';
  }
}

async function runConversion() {
  if (state.busy) return;
  const payload = conversionPayload();
  if (!payload) return;
  setBusy(true);
  setNotice(elements.convertStatus, `Converting pages ${payload.pages.start}–${payload.pages.end}…`, 'working');
  try {
    const result = await convertDocument(payload);
    state = { ...state, conversionResult: result };
    renderConversionOutput(outputElements(), result);
    setOutputTab(outputElements(), 'markdown');
    const diagnostics = result.diagnostics?.length ?? 0;
    setNotice(
      elements.convertStatus,
      `Conversion complete · ${result.pageRange?.count ?? 0} pages · ${diagnostics} diagnostics.`,
      'success',
    );
  } catch (error) {
    setNotice(elements.convertStatus, errorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

function conversionPayload() {
  const start = Number(elements.pageStart.value);
  const end = Number(elements.pageEnd.value);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    setNotice(elements.convertStatus, 'Choose a valid 1-based page range before converting.', 'error');
    return null;
  }
  const payload = {
    sourcePath: elements.sourcePath.value,
    pages: { start, end },
    options: {
      tableMode: elements.tableMode.value,
      ocr: elements.convertOcr.value,
      ocrLanguage: elements.searchLanguage.value,
      images: 'skip',
      headers: elements.headers.value,
      footers: elements.footers.value,
      engineeringRegions: elements.engineeringRegions.value,
    },
  };
  return withPassword(payload);
}

function withPassword(payload) {
  return elements.pdfPassword.value ? { ...payload, password: elements.pdfPassword.value } : payload;
}

async function copyMarkdown() {
  const text = state.conversionResult?.markdown;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setNotice(elements.convertStatus, 'Markdown copied to clipboard.', 'success');
  } catch {
    setNotice(elements.convertStatus, 'Clipboard access failed; use Download .md instead.', 'error');
  }
}

function downloadMarkdown() {
  const result = state.conversionResult;
  if (!result?.markdown) return;
  downloadText(outputFilename('md'), result.markdown, 'text/markdown;charset=utf-8');
}

function downloadEvidence() {
  const result = state.conversionResult;
  if (!result?.evidence) return;
  downloadText(outputFilename('evidence.json'), `${JSON.stringify(result.evidence, null, 2)}\n`, 'application/json');
}

function outputFilename(extension) {
  const start = elements.pageStart.value || 'all';
  const end = elements.pageEnd.value || start;
  return `document-pages-${start}-${end}.${extension}`;
}

function setBusy(busy) {
  state = { ...state, busy };
  elements.searchButton.disabled = busy;
  elements.convertButton.disabled = busy;
}

function resetSearchView() {
  state = { ...state, searchResult: null, selectedPages: new Set() };
  elements.indexSummary.hidden = true;
  clearRangeInputs();
  renderPageChips(elements.pageChips, [], new Set(), togglePage);
  renderSearchResults(elements.searchResults, [], new Set(), togglePage);
}

function setHealth(ok, message) {
  elements.healthDot.classList.toggle('online', ok);
  elements.healthText.textContent = message;
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function outputElements() {
  return {
    markdown: elements.markdownOutput,
    evidence: elements.evidenceOutput,
    markdownTab: elements.markdownTab,
    evidenceTab: elements.evidenceTab,
    copy: elements.copyMarkdown,
    downloadMarkdown: elements.downloadMarkdown,
    downloadEvidence: elements.downloadEvidence,
  };
}

function collectElements() {
  const ids = [
    'health-dot', 'health-text', 'source-path', 'pdf-password', 'query', 'search-button',
    'case-sensitive', 'whole-word', 'search-ocr', 'search-language',
    'search-confidence', 'search-status', 'index-summary', 'page-chips',
    'clear-selection', 'page-start', 'page-end', 'range-help', 'search-results',
    'table-mode', 'convert-ocr', 'engineering-regions', 'headers', 'footers',
    'convert-button', 'convert-status', 'markdown-tab', 'evidence-tab',
    'copy-markdown', 'download-markdown', 'download-evidence',
    'markdown-output', 'evidence-output',
  ];
  return Object.fromEntries(ids.map((id) => [camel(id), document.getElementById(id)]));
}

function camel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

startDocumentConversionUi();
