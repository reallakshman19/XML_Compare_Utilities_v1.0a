/** Per-canvas click-to-measure state and segment/total presentation. */

const vectorLength = (vector) => Math.hypot(vector[0], vector[1], vector[2]);
const vectorSubtract = (left, right) => left.map((value, index) => value - right[index]);

/** Format model-space millimetres without hiding engineering precision. */
export function formatTopologyMeasurement(lengthMm) {
  if (!Number.isFinite(lengthMm)) throw new TypeError('Measurement length must be finite.');
  return lengthMm >= 1000 ? `${(lengthMm / 1000).toFixed(3)} m` : `${lengthMm.toFixed(1)} mm`;
}

/** Create isolated measurement state for one explicit topology canvas runtime. */
export function createTopologyMeasurement() {
  let viewer = null, host = null, points = Object.freeze([]), active = false, clearButton = null;
  const lengths = () => points.slice(1).map((point, index) => vectorLength(vectorSubtract(point, points[index])));
  const render = () => {
    const panel = host?.querySelector('[data-ttv-measure-panel]');
    if (!panel) return;
    const segments = lengths(), total = segments.reduce((sum, length) => sum + length, 0);
    panel.hidden = !active && points.length === 0;
    panel.querySelector('[data-ttv-measure-state]').textContent = active ? 'Click component surfaces to add points' : 'Measurement paused';
    panel.querySelector('[data-ttv-measure-total]').textContent = formatTopologyMeasurement(total);
    panel.querySelector('[data-ttv-measure-count]').textContent = `${points.length} point${points.length === 1 ? '' : 's'}`;
    panel.querySelector('[data-ttv-measure-segments]').innerHTML = segments.length
      ? segments.map((length, index) => `<tr><th>S${index + 1}</th><td>${formatTopologyMeasurement(length)}</td></tr>`).join('')
      : '<tr><td colspan="2">No segments yet.</td></tr>';
  };
  const sync = () => { viewer?.setMeasurement(points); render(); };
  const clear = () => { points = Object.freeze([]); sync(); };
  const bind = (nextViewer, nextHost) => {
    if (typeof nextViewer?.setMeasurement !== 'function' || !nextHost?.querySelector) throw new TypeError('Measurement binding requires a viewer and DOM host.');
    viewer = nextViewer; host = nextHost; clearButton = host.querySelector('[data-ttv-measure-clear]');
    if (clearButton) clearButton.onclick = clear;
    sync();
  };
  const addPoint = (point) => {
    if (!Array.isArray(point) || point.length !== 3 || !point.every((value) => Number.isFinite(Number(value)))) throw new TypeError('Measure requires a finite 3D surface point.');
    points = Object.freeze([...points, Object.freeze(point.map(Number))]); sync();
  };
  const setActive = (next) => { active = next === true; render(); };
  const reset = () => {
    if (clearButton) clearButton.onclick = null;
    viewer?.setMeasurement([]); viewer = null; host = null; clearButton = null;
    points = Object.freeze([]); active = false;
  };
  return Object.freeze({ bind, addPoint, setActive, clear, sync, reset,
    evidence: () => Object.freeze({ active, points, lengths: Object.freeze(lengths()) }) });
}
