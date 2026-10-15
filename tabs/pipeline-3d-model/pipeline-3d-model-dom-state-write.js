function text(value) {
  return String(value ?? '');
}

export function writePipelineElementProperty(element, name, value) {
  if (!element || !name || element[name] === value) return false;
  element[name] = value;
  return true;
}

export function writePipelineElementDataset(element, name, value) {
  if (!element?.dataset || !name) return false;
  const next = text(value);
  if (element.dataset[name] === next) return false;
  element.dataset[name] = next;
  return true;
}

export function writePipelineElementAttribute(element, name, value) {
  if (!element || !name || typeof element.setAttribute !== 'function') return false;
  const next = text(value);
  if (typeof element.getAttribute === 'function' && element.getAttribute(name) === next) return false;
  element.setAttribute(name, next);
  return true;
}
