const arr = (value) => Array.isArray(value) ? value : [];

function escapeUniversalControlHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export function syncUniversalFilterSelect(select, values, selected) {
  if (!select) return;
  const options = ['<option value="">All</option>', ...arr(values).map((value) => (
    `<option value="${escapeUniversalControlHtml(value)}">${escapeUniversalControlHtml(value)}</option>`
  ))].join('');
  if (select.innerHTML !== options) select.innerHTML = options;
  select.value = selected || '';
}

export function syncUniversalNamedViewSelect(select, views, selectedId) {
  if (!select) return;
  const options = ['<option value="">Select named view</option>', ...arr(views).map((view) => (
    `<option value="${escapeUniversalControlHtml(view.id)}">${escapeUniversalControlHtml(view.name)}</option>`
  ))].join('');
  if (select.innerHTML !== options) select.innerHTML = options;
  select.value = selectedId || '';
}

export const _test = Object.freeze({ escapeUniversalControlHtml });
