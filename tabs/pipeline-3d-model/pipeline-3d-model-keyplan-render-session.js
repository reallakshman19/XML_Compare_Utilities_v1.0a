function renderSignature(points, sheets, markers, dpr) {
  return JSON.stringify([dpr, points || [], sheets || [], markers || []]);
}

function normalizedDpr(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 1;
}

export function createPipelineKeyPlanRenderSession(paint) {
  if (typeof paint !== 'function') throw new TypeError('Key-plan render session requires a painter.');
  let sourceCanvas = null;
  let signature = null;
  return Object.freeze({
    render(canvas, points = [], sheets = [], tooltip = null, markers = [], dpr = globalThis.devicePixelRatio) {
      if (!canvas) return false;
      const next = renderSignature(points, sheets, markers, normalizedDpr(dpr));
      if (sourceCanvas === canvas && signature === next) return false;
      paint(canvas, points, sheets, tooltip, markers);
      sourceCanvas = canvas;
      signature = next;
      return true;
    },
    reset() {
      sourceCanvas = null;
      signature = null;
    },
  });
}

export const _test = Object.freeze({ normalizedDpr, renderSignature });
