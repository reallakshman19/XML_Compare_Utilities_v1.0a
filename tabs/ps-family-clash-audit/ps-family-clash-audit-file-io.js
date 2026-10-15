export function readBrowserTextFile(file) {
  if (!file || typeof file.text !== 'function') {
    return Promise.reject(new Error('No readable browser File object was provided.'));
  }
  return file.text();
}

export function describeBrowserFile(file) {
  if (!file) return 'No file selected';
  const size = Number.isFinite(file.size) ? `${file.size} bytes` : 'size unavailable';
  return `${file.name || 'unnamed file'} (${size})`;
}

export function loadTextIntoTextarea(text, textarea, statusNode, statusText) {
  textarea.value = String(text ?? '');
  if (statusNode) statusNode.textContent = statusText || 'Text loaded';
  return textarea.value;
}

export async function loadTextFileIntoTextarea(file, textarea, statusNode) {
  const text = await readBrowserTextFile(file);
  return loadTextIntoTextarea(text, textarea, statusNode, describeBrowserFile(file));
}

export function loadSampleTextIntoTextarea(sample, textarea, statusNode) {
  if (!sample || !textarea) throw new Error('No sample target was provided.');
  return loadTextIntoTextarea(sample.text, textarea, statusNode, sample.statusText);
}
