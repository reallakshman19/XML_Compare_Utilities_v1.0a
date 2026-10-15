function text(value) {
  return String(value ?? '');
}

export function writePipelineElementValue(element, value, EventCtor = globalThis.Event) {
  if (!element) return false;
  const next = text(value);
  if (element.value === next) return false;
  element.value = next;
  if (typeof element.dispatchEvent === 'function' && typeof EventCtor === 'function') {
    element.dispatchEvent(new EventCtor('input', { bubbles: true }));
  }
  return true;
}

export function writePipelineElementHtml(element, value) {
  if (!element) return false;
  const next = text(value);
  if (element.innerHTML === next) return false;
  element.innerHTML = next;
  return true;
}

export function writePipelineElementText(element, value) {
  if (!element) return false;
  const next = text(value);
  if (element.textContent === next) return false;
  element.textContent = next;
  return true;
}
