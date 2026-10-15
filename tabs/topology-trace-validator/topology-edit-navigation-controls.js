/** Edit Draft-only CAD view cube, navigation dock, and camera HUD. */

const ICONS = Object.freeze({
  select: 'mouse-pointer-2', orbit: 'orbit', rotate: 'rotate-3d',
  home: 'house', previous: 'undo-2', fitAll: 'maximize-2', fitSelection: 'scan-line',
  zoomIn: 'zoom-in', zoomOut: 'zoom-out', camera: 'camera', pivot: 'crosshair',
});

function iconUrl(name) {
  return new URL(`../../vendor/lucide/icons/${name}.svg`, import.meta.url).href;
}

function iconButton(action, label, shortcut) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return `<button type="button" data-ttv-nav-action="${action}" aria-label="${label}" title="${title}"><img src="${iconUrl(ICONS[action])}" alt=""><span>${label}</span></button>`;
}

export function topologyEditNavigationMarkup() {
  return `<div class="ttv-edit-view-cube" role="group" aria-label="Standard camera views">
    <button type="button" data-ttv-nav-view="top" title="Top view">TOP</button>
    <button type="button" data-ttv-nav-view="left" title="Left view">L</button>
    <button type="button" data-ttv-nav-view="iso" class="is-cube-center" title="Isometric view">ISO</button>
    <button type="button" data-ttv-nav-view="right" title="Right view">R</button>
    <button type="button" data-ttv-nav-view="front" title="Front view">FRONT</button>
    <button type="button" data-ttv-nav-view="back" title="Back view">BACK</button>
    <button type="button" data-ttv-nav-view="bottom" title="Bottom view">BOTTOM</button>
  </div>
  <nav class="ttv-edit-navigation-dock" aria-label="Edit Draft navigation">
    ${iconButton('select', 'Select tool', '')}${iconButton('orbit', 'Orbit view left', '')}${iconButton('rotate', 'Rotate view right', '')}
    ${iconButton('home', 'Home', 'H')}${iconButton('previous', 'Previous', 'Backspace')}
    ${iconButton('fitAll', 'Fit all', 'Shift+F')}${iconButton('fitSelection', 'Fit selection', 'F')}
    ${iconButton('zoomIn', 'Zoom in', '')}${iconButton('zoomOut', 'Zoom out', '')}
    ${iconButton('camera', 'Projection', '')}${iconButton('pivot', 'Pivot', 'P')}
  </nav>
  <div class="ttv-edit-navigation-hud" data-ttv-navigation-hud>
    <strong data-ttv-navigation-state>Perspective · Z-up · Pivot off</strong>
    <span>Left: select/edit · Middle: orbit · Shift+Middle: pan · Wheel: zoom · Esc: cancel</span>
  </div>`;
}

function navigationActions(viewer, onSelect) {
  return Object.freeze({
    select: onSelect,
    orbit: () => viewer.orbitBy(Math.PI / 12, 0),
    rotate: () => viewer.orbitBy(-Math.PI / 12, 0),
    home: () => viewer.fitAll(),
    previous: () => viewer.previousView(),
    fitAll: () => viewer.fitAll(),
    fitSelection: () => viewer.fitSelection(),
    zoomIn: () => viewer.zoomBy(1 / 1.2),
    zoomOut: () => viewer.zoomBy(1.2),
    camera: () => viewer.toggleCameraType(),
    pivot: () => viewer.togglePivotToSelection(),
  });
}

/** Bind controls to one viewer. Inputs are not mutated; destroy removes every listener. */
export function bindTopologyEditNavigation({ host, viewer, onViewSelected, onSelect }) {
  const actions = navigationActions(viewer, onSelect);
  const listeners = [];
  function listen(element, handler) {
    element.addEventListener('click', handler);
    listeners.push(() => element.removeEventListener('click', handler));
  }
  function sync() {
    const state = viewer.captureNavigationState();
    const pivot = state.pivotWorld ? 'Pivot set' : 'Pivot off';
    const label = `${state.cameraType} · ${state.verticalAxis}-up · ${pivot}`;
    const output = host.querySelector('[data-ttv-navigation-state]');
    if (output) output.textContent = label;
    host.querySelector('[data-ttv-nav-action="pivot"]')?.classList.toggle('is-active', Boolean(state.pivotWorld));
  }
  host.querySelectorAll('[data-ttv-nav-action]').forEach((button) => listen(button, () => {
    const action = button.getAttribute('data-ttv-nav-action');
    actions[action]?.(); sync();
  }));
  host.querySelectorAll('[data-ttv-nav-view]').forEach((button) => listen(button, () => {
    const view = button.getAttribute('data-ttv-nav-view');
    viewer.setStandardView(view); onViewSelected?.(view); sync();
  }));
  sync();
  return Object.freeze({ sync, destroy: () => listeners.splice(0).forEach((dispose) => dispose()) });
}

export const _test = Object.freeze({ ICONS, navigationActions });
