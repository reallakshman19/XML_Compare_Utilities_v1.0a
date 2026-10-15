// Renders a simple plan-view SVG ("key plan") showing how multi-sheet Table 1
// geometry was stitched together: each sheet's polyline in its own color,
// match points highlighted where sheets pivot, and the derived rotation
// Angle labeled at each transition. Pure string building — no DOM dependency,
// so this can be unit-tested/inspected outside the browser too.

const SHEET_COLORS = ['#38bdf8', '#facc15', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];
const WIDTH = 760;
const HEIGHT = 460;
const PADDING = 44;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function buildScaler(points) {
  const xs = points.map((p) => p.globalX);
  const ys = points.map((p) => p.globalY);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const availW = WIDTH - PADDING * 2;
  const availH = HEIGHT - PADDING * 2;
  const scale = Math.min(availW / spanX, availH / spanY);
  const scaledSpanX = spanX * scale;
  const scaledSpanY = spanY * scale;
  const offsetX = PADDING + (availW - scaledSpanX) / 2;
  const offsetY = PADDING + (availH - scaledSpanY) / 2;
  return (x, y) => ({
    sx: offsetX + (x - minX) * scale,
    sy: HEIGHT - offsetY - (y - minY) * scale,
  });
}

function formatAngle(angleDeg) {
  return `${Number(angleDeg).toFixed(2)}°`;
}

// points: the flat chained point list (each with globalX/globalY, label).
// sheets: groupPointsIntoSheets(points) output — [{sheetIndex, angleDeg, startIndex, endIndex, meta}].
export function renderKeyPlanSvg(points, sheets) {
  if (!points.length) return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="120"></svg>';
  const toScreen = buildScaler(points);
  const parts = [];

  sheets.forEach((sheet) => {
    const color = SHEET_COLORS[sheet.sheetIndex % SHEET_COLORS.length];
    const sheetPoints = points.slice(sheet.startIndex, sheet.endIndex + 1);
    const path = sheetPoints.map((p) => toScreen(p.globalX, p.globalY)).map((s) => `${s.sx.toFixed(1)},${s.sy.toFixed(1)}`).join(' ');
    parts.push(`<polyline points="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
    sheetPoints.forEach((p, i) => {
      const { sx, sy } = toScreen(p.globalX, p.globalY);
      const isBoundary = i === 0 || i === sheetPoints.length - 1;
      const radius = isBoundary ? 5 : 3;
      parts.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${radius}" fill="${isBoundary ? '#f87171' : color}" stroke="#0b1220" stroke-width="1" data-coord="${p.globalX.toFixed(3)}, ${p.globalY.toFixed(3)}, ${p.globalZ.toFixed(3)}"/>`);
    });
    // Angle annotation near the sheet's start (skip sheet 1, whose angle is always 0/reference).
    if (sheet.sheetIndex > 0 && sheetPoints.length) {
      const { sx, sy } = toScreen(sheetPoints[0].globalX, sheetPoints[0].globalY);
      parts.push(
        `<text x="${(sx + 8).toFixed(1)}" y="${(sy - 8).toFixed(1)}" fill="#f87171" font-size="12" font-family="monospace">Δ ${esc(formatAngle(sheet.angleDeg))}</text>`,
      );
    }
  });

  const legend = sheets
    .map((sheet, i) => {
      const color = SHEET_COLORS[sheet.sheetIndex % SHEET_COLORS.length];
      const lengthText = sheet.meta?.length != null ? ` · length ${sheet.meta.length}` : '';
      return `<g transform="translate(10, ${10 + i * 18})">
        <rect width="12" height="12" fill="${color}" rx="2"/>
        <text x="18" y="10" fill="#e2e8f0" font-size="11" font-family="monospace">Sheet ${sheet.sheetIndex + 1} · Angle ${esc(formatAngle(sheet.angleDeg))}${esc(lengthText)}</text>
      </g>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" height="auto" style="background:#0b1220;border-radius:8px;border:1px solid rgba(148,163,184,.28);">
<g id="p3d-pz-layer">
${parts.join('\n')}
</g>
${legend}
<text x="${WIDTH - 8}" y="${HEIGHT - 8}" fill="#64748b" font-size="10" font-family="monospace" text-anchor="end">Red dots = sheet boundary / match points</text>
</svg>`;
}
