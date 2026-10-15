const STYLE_ID = 'pipeline-3d-cad-object-snap-style';
const TOKENS = Object.freeze({ endpoint: 'END', midpoint: 'MID', station: 'STA', marker: 'MRK', nearest: 'NEA', projection: 'PRJ', intersection: 'INT' });
const FIELDS = Object.freeze([
  ['endpointEnabled', 'Endpoint'], ['midpointEnabled', 'Midpoint'], ['stationObjectEnabled', 'Station'],
  ['markerEnabled', 'Marker'], ['nearestEnabled', 'Nearest'], ['projectionEnabled', 'Projection'],
  ['intersectionEnabled', 'Intersection'],
]);

export function ensurePipelineCadObjectSnapStyle(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(STYLE_ID)) return false;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-cad-object-snap-glyph{position:absolute;z-index:8;display:none;transform:translate(-50%,-50%);pointer-events:none;min-width:26px;height:26px;padding:4px;border:2px solid #22d3ee;background:#082f49dd;color:#cffafe;font:700 9px/14px ui-monospace,monospace;text-align:center;box-shadow:0 0 0 2px #020617aa}
.p3d-cad-object-snap-glyph[data-active="true"]{display:block}.p3d-cad-object-snap-glyph[data-mode="endpoint"]{border-radius:2px}.p3d-cad-object-snap-glyph[data-mode="midpoint"]{clip-path:polygon(50% 0,100% 100%,0 100%)}.p3d-cad-object-snap-glyph[data-mode="marker"]{border-radius:50%}.p3d-cad-object-snap-status{min-width:124px;color:#67e8f9;font:700 10px ui-monospace,monospace}.p3d-cad-object-snap-status[data-active="false"]{color:#64748b;font-weight:400}
.p3d-cad-object-snap-palette{grid-template-columns:max-content 92px}.p3d-cad-object-snap-palette label{display:contents}.p3d-cad-object-snap-palette input[type="checkbox"]{width:auto;justify-self:start}`;
  doc.head.appendChild(style);
  return true;
}

function paletteHtml() {
  const modes = FIELDS.map(([key, label]) => `<label><span>${label}</span><input type="checkbox" data-object-snap-field="${key}"></label>`).join('');
  return `<div class="p3d-cad-palette p3d-cad-object-snap-palette" data-p3d-cad-object-snap-palette hidden>
<label><span>Object Snap</span><input type="checkbox" data-object-snap-field="objectEnabled"></label>${modes}
<label><span>Aperture (px)</span><input type="number" min="1" max="100" step="1" data-object-snap-field="objectAperture"></label>
<footer><button type="button" data-object-snap-action="apply">Apply</button><button type="button" data-object-snap-action="defaults">Defaults</button><button type="button" data-object-snap-action="cancel">Cancel</button></footer></div>`;
}

function createControls(doc, bar) {
  const button = (action, text) => {
    const node = doc.createElement('button');
    node.type = 'button'; node.dataset.p3dCadObjectSnapAction = action; node.textContent = text;
    return node;
  };
  const toggle = button('toggle', 'Object Snap (F3)');
  toggle.setAttribute('aria-pressed', 'true');
  const settingsButton = button('settings', 'Object Snap Settings');
  const status = doc.createElement('span');
  status.className = 'p3d-cad-object-snap-status'; status.dataset.p3dCadObjectSnapStatus = '';
  status.dataset.active = 'false'; status.textContent = 'Object Snap ready';
  bar?.append(toggle, settingsButton, status);
  const palette = doc.createRange().createContextualFragment(paletteHtml()).firstElementChild;
  doc.body.appendChild(palette);
  return { toggle, settingsButton, status, palette };
}

function createGlyphs(doc, stages) {
  return Object.fromEntries(Object.entries(stages).map(([name, stage]) => {
    const glyph = doc.createElement('div');
    glyph.className = 'p3d-cad-object-snap-glyph';
    glyph.dataset.p3dCadObjectSnapGlyph = name; glyph.dataset.active = 'false';
    stage.appendChild(glyph);
    return [name, glyph];
  }));
}

function positionPalette(palette, trigger) {
  const rect = trigger.getBoundingClientRect();
  palette.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 280))}px`;
  palette.style.top = `${Math.min(innerHeight - 410, rect.bottom + 6)}px`;
  palette.hidden = false;
}

function fillPalette(palette, settings) {
  palette.querySelectorAll('[data-object-snap-field]').forEach((input) => {
    const value = settings[input.dataset.objectSnapField];
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value;
  });
}

function readPalette(palette) {
  const values = {};
  palette.querySelectorAll('[data-object-snap-field]').forEach((input) => {
    values[input.dataset.objectSnapField] = input.type === 'checkbox' ? input.checked : input.value;
  });
  return values;
}

function placeGlyph(glyph, candidate, graph, stage) {
  const canvasRect = graph.canvas.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const x = canvasRect.left - stageRect.left + candidate.screenPoint.x * canvasRect.width / graph.width;
  const y = canvasRect.top - stageRect.top + candidate.screenPoint.y * canvasRect.height / graph.height;
  glyph.style.left = `${x}px`; glyph.style.top = `${y}px`;
  glyph.dataset.mode = candidate.mode; glyph.dataset.active = 'true';
  glyph.textContent = TOKENS[candidate.mode] || candidate.mode.slice(0, 3).toUpperCase();
  glyph.title = `${candidate.label} · ${candidate.screenDistance.toFixed(1)} px`;
}

function createViewApi(parts, stages) {
  const { toggle, settingsButton, palette, status, glyphs } = parts;
  const hide = (name = null) => {
    const targets = name ? [glyphs[name]] : Object.values(glyphs);
    targets.filter(Boolean).forEach((glyph) => { glyph.dataset.active = 'false'; delete glyph.dataset.mode; });
    if (!name || !Object.values(glyphs).some((glyph) => glyph.dataset.active === 'true')) {
      status.dataset.active = 'false'; status.textContent = 'Object Snap ready';
    }
    return true;
  };
  return Object.freeze({
    ...parts,
    open(settings) { fillPalette(palette, settings); positionPalette(palette, settingsButton); },
    values: () => readPalette(palette),
    update(settings, disabled = false) {
      toggle.setAttribute('aria-pressed', settings.objectEnabled ? 'true' : 'false');
      toggle.disabled = disabled; settingsButton.disabled = disabled;
      palette.querySelectorAll('input,button').forEach((node) => { node.disabled = disabled; });
      if (disabled) palette.hidden = true;
    },
    show(name, acquisition, graph) {
      const candidate = acquisition?.candidate; const glyph = glyphs[name];
      if (!glyph || !candidate) return hide(name);
      placeGlyph(glyph, candidate, graph, stages[name]);
      status.dataset.active = 'true'; status.textContent = `${candidate.label} · ${candidate.screenDistance.toFixed(1)} px`;
      return true;
    },
    hide,
    destroy() {
      palette.remove(); toggle.remove(); settingsButton.remove(); status.remove();
      Object.values(glyphs).forEach((glyph) => glyph.remove());
      return true;
    },
  });
}

export function createPipelineCadObjectSnapView(options = {}) {
  const { dialog, stages, shell } = options;
  const doc = dialog.ownerDocument || globalThis.document;
  ensurePipelineCadObjectSnapStyle(doc);
  const bar = shell?.element || dialog.querySelector('[data-p3d-cad-viewbar]');
  const controls = createControls(doc, bar);
  return createViewApi({ ...controls, glyphs: createGlyphs(doc, stages) }, stages);
}
