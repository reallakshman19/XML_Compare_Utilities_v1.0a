const VB_W = 760;
const VB_H = 420;

export function paintLocalSheetCanvas(canvas, points, hoveredNode, selectedNode) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.parentElement.clientWidth || VB_W;
  const h = canvas.parentElement.clientHeight || VB_H;
  const dpr = window.devicePixelRatio || 1;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, w, h);

  if (!points.length) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No points to draw', w / 2, h / 2);
    return null;
  }

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const pad = 44;
  const scaleX = (w - pad * 2) / spanX;
  const scaleY = (h - pad * 2) / spanY;
  const baseScale = Math.min(scaleX, scaleY);
  const centerLocalX = minX + spanX / 2;
  const centerLocalY = minY + spanY / 2;

  // We could add pan/zoom here, but for preview we auto-fit.
  const zoom = 1;
  const panX = 0;
  const panY = 0;

  function toScreen(x, y) {
    return {
      sx: w / 2 + (x - centerLocalX) * baseScale * zoom + panX,
      sy: h / 2 - (y - centerLocalY) * baseScale * zoom + panY
    };
  }

  // Draw grid
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  const spacing = 40;
  for (let x = panX % spacing; x < w; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = panY % spacing; y < h; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  // Draw line
  if (points.length >= 2) {
    ctx.beginPath();
    const pStart = toScreen(points[0].x, points[0].y);
    ctx.moveTo(pStart.sx, pStart.sy);
    for (let i = 1; i < points.length; i++) {
      const p = toScreen(points[i].x, points[i].y);
      ctx.lineTo(p.sx, p.sy);
    }
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // Draw points
  const screenPoints = points.map(p => {
    const { sx, sy } = toScreen(p.x, p.y);
    return { ...p, sx, sy };
  });

  screenPoints.forEach((p, i) => {
    const isBoundary = i === 0 || i === points.length - 1;
    const isSelected = selectedNode && selectedNode.lineIndex === p.lineIndex;
    const isHovered = hoveredNode && hoveredNode.lineIndex === p.lineIndex;
    
    let radius = isBoundary ? 5.5 : 3.5;
    if (isSelected || isHovered) radius += 2;

    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#fb923c' : (isBoundary ? '#f87171' : '#38bdf8');
    ctx.strokeStyle = isSelected ? '#fff' : '#0b1220';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.fill();
    ctx.stroke();

    if (isHovered && !isSelected) {
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });

  return { screenPoints, toScreen };
}

export function wirePreviewModal(dialog, get, parseTable1, groupPointsIntoSheets) {
  const btnOpen = get('preview-table1');
  const modal = get('preview-modal');
  if (!btnOpen || !modal) return;

  const btnClose = get('preview-close');
  const btnDone = get('preview-done');
  const btnDelete = get('preview-delete');
  const tabsContainer = get('preview-tabs');
  const canvas = get('preview-canvas');
  const infoBox = get('preview-info');
  const table1Area = get('table1');

  let currentSheets = [];
  let currentSheetIndex = 0;
  let hoveredNode = null;
  let selectedNode = null;
  let screenPointsData = [];

  function updateRawText(lineIndex) {
    if (lineIndex == null) return;
    const lines = String(table1Area.value || '').split(/\r?\n/);
    lines.splice(lineIndex, 1);
    table1Area.value = lines.join('\n');
    table1Area.dispatchEvent(new Event('input', { bubbles: true }));
    const runBtn = dialog.querySelector('[data-p3d="run"]');
    if (runBtn) runBtn.click();
  }

  function renderPreview() {
    // Parse table 1
    const points = parseTable1(table1Area.value);
    currentSheets = groupPointsIntoSheets(points);
    if (currentSheetIndex >= currentSheets.length) currentSheetIndex = Math.max(0, currentSheets.length - 1);

    // Render tabs
    tabsContainer.innerHTML = currentSheets.map((sheet, i) => 
      `<button type="button" class="p3d-preview-tab" data-index="${i}" data-active="${i === currentSheetIndex}">Sheet ${i + 1} (${sheet.endIndex - sheet.startIndex + 1} pts)</button>`
    ).join('');

    Array.from(tabsContainer.querySelectorAll('button')).forEach(btn => {
      btn.addEventListener('click', () => {
        currentSheetIndex = Number(btn.getAttribute('data-index'));
        selectedNode = null;
        hoveredNode = null;
        renderPreview();
      });
    });

    drawCanvas();
    updateSidebar();
  }

  function drawCanvas() {
    if (!currentSheets.length) {
      screenPointsData = [];
      paintLocalSheetCanvas(canvas, [], null, null);
      return;
    }
    const sheet = currentSheets[currentSheetIndex];
    const points = parseTable1(table1Area.value).slice(sheet.startIndex, sheet.endIndex + 1);
    
    // Check if selectedNode/hoveredNode still exist
    if (selectedNode && !points.find(p => p.lineIndex === selectedNode.lineIndex)) selectedNode = null;
    if (hoveredNode && !points.find(p => p.lineIndex === hoveredNode.lineIndex)) hoveredNode = null;

    const res = paintLocalSheetCanvas(canvas, points, hoveredNode, selectedNode);
    screenPointsData = res ? res.screenPoints : [];
  }

  function updateSidebar() {
    const node = selectedNode || hoveredNode;
    if (node) {
      infoBox.textContent = `Label: ${node.label}\nLine Index: ${node.lineIndex + 1}\n\nRaw Text:\n${node.rawLine}`;
    } else {
      infoBox.textContent = 'Hover over a node to see its raw data.';
    }
    btnDelete.disabled = !selectedNode;
  }

  btnOpen.addEventListener('click', () => {
    modal.style.display = 'flex';
    selectedNode = null;
    hoveredNode = null;
    renderPreview();
  });

  const close = () => { modal.style.display = 'none'; };
  btnClose.addEventListener('click', close);
  btnDone.addEventListener('click', close);

  btnDelete.addEventListener('click', () => {
    if (selectedNode) {
      updateRawText(selectedNode.lineIndex);
      selectedNode = null;
      hoveredNode = null;
      renderPreview();
      // manually fire input event to trigger auto-save or re-parse in main if needed
      table1Area.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width / (window.devicePixelRatio || 1));
    const my = (e.clientY - rect.top) * (canvas.height / rect.height / (window.devicePixelRatio || 1));
    
    let closest = null;
    let minDist = 12; // hit radius
    
    screenPointsData.forEach(p => {
      const dist = Math.hypot(p.sx - mx, p.sy - my);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    });

    if (closest !== hoveredNode) {
      hoveredNode = closest;
      drawCanvas();
      if (!selectedNode) updateSidebar();
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (hoveredNode) {
      hoveredNode = null;
      drawCanvas();
      if (!selectedNode) updateSidebar();
    }
  });

  canvas.addEventListener('click', () => {
    if (hoveredNode) {
      selectedNode = hoveredNode;
    } else {
      selectedNode = null;
    }
    drawCanvas();
    updateSidebar();
  });
}

function parseTsvToObjects(tsv) {
  const lines = String(tsv || '').split(/\r?\n/).filter(line => line.trim());
  if (!lines.length) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split('\t');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i]?.trim() || ''; });
    return obj;
  });
}

export function createTable2XSVG(tsvText) {
  const data = parseTsvToObjects(tsvText);
  if (!data.length) return '<div style="color:#94a3b8;padding:20px;">No data to render</div>';

  const w = 1000;
  const h = 400;
  const pad = 60;

  let minH = Infinity, maxH = -Infinity;
  let minV = Infinity, maxV = -Infinity;

  const intPoints = [];
  const mainPoints = [];

  data.forEach(row => {
    const hint = Number(row['H_Int']);
    const vint = Number(row['V_Int']);
    if (!isNaN(hint) && !isNaN(vint)) {
      minH = Math.min(minH, hint); maxH = Math.max(maxH, hint);
      minV = Math.min(minV, vint); maxV = Math.max(maxV, vint);
      intPoints.push({ x: hint, y: vint });
    }

    const hVal = Number(row['H']);
    const vVal = Number(row['V']);
    if (!isNaN(hVal) && !isNaN(vVal) && row['H'] !== '' && row['V'] !== '') {
      minH = Math.min(minH, hVal); maxH = Math.max(maxH, hVal);
      minV = Math.min(minV, vVal); maxV = Math.max(maxV, vVal);
      mainPoints.push({ x: hVal, y: vVal, basis: row['H(coor)'], station: row['Station Text'], elevation: row['Elevation Text'] });
    }
  });

  if (minH === Infinity) return '<div style="color:#94a3b8;padding:20px;">Invalid data points</div>';

  if (maxH === minH) maxH += 1;
  if (maxV === minV) maxV += 1;

  const rangeV = maxV - minV;
  // add 20% vertical padding
  minV -= rangeV * 0.2;
  maxV += rangeV * 0.2;

  const scaleX = (x) => pad + ((x - minH) / (maxH - minH)) * (w - pad * 2);
  const scaleY = (y) => h - pad - ((y - minV) / (maxV - minV)) * (h - pad * 2);

  const pathD = intPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(2)} ${scaleY(p.y).toFixed(2)}`).join(' ');

  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="background:#0b1220;border-radius:8px;touch-action:none;" data-svg-type="table2x" data-min-y="${minV}" data-max-y="${maxV}" data-pad="${pad}" data-w="${w}" data-h="${h}">`;
  
  // Grid lines
  svg += `<line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#334155" stroke-width="2"/>`;
  svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="#334155" stroke-width="2"/>`;

  // Path
  svg += `<path d="${pathD}" fill="none" stroke="#38bdf8" stroke-width="3" stroke-linejoin="round" />`;

  mainPoints.forEach(p => {
    const sx = scaleX(p.x);
    const sy = scaleY(p.y);
    // Add interactive circle with cursor pointer and slightly larger radius for easier grabbing
    svg += `<circle cx="${sx}" cy="${sy}" r="7" fill="#facc15" stroke="#0f172a" stroke-width="2" style="cursor:ns-resize;" class="p3d-draggable-node" data-drag-type="table2x" data-h-basis="${p.basis}" data-original-text="${p.elevation}" />`;
    
    if (p.station && p.station !== '—') {
      svg += `<line x1="${sx}" y1="${h-pad}" x2="${sx}" y2="${h-pad+4}" stroke="#64748b" stroke-width="1.5"/>`;
      svg += `<text x="${sx}" y="${h-pad + 16}" fill="#fb923c" font-size="11" font-family="monospace" text-anchor="middle">${p.station}</text>`;
    }
    if (p.elevation && p.elevation !== '—') {
      svg += `<text x="${sx}" y="${sy - 12}" fill="#94a3b8" font-size="10" font-family="monospace" text-anchor="middle" class="p3d-drag-label" data-h-basis="${p.basis}">${p.elevation}</text>`;
    }
  });

  svg += `</svg>`;
  return svg;
}

export function createTable3XSVG(tsvText) {
  const data = parseTsvToObjects(tsvText);
  if (!data.length) return '<div style="color:#94a3b8;padding:20px;">No data to render</div>';

  const w = 1000;
  const h = 400;
  const pad = 60;

  let minH = Infinity, maxH = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const zPoints = [];
  const markers = [];
  const hLengths = [];

  data.forEach(row => {
    const hint = Number(row['Hlength_Cum_Int']);
    if (!isNaN(hint)) {
      minH = Math.min(minH, hint); maxH = Math.max(maxH, hint);
      
      const zStr = row['Z'];
      if (zStr && zStr !== '—') {
        let zVal;
        if (zStr === 'A/G' || zStr === 'A/g') {
          zVal = 0.75; // nominal value
        } else {
          zVal = -parseFloat(zStr); // negative for depth
        }
        
        if (!isNaN(zVal)) {
          minZ = Math.min(minZ, zVal); maxZ = Math.max(maxZ, zVal);
          const hBasis = row['[H vs Z] Text Position X'] || row['H(coor basis used)'];
          zPoints.push({ x: hint, z: zVal, text: zStr, basis: hBasis });
        }
      }

      const mText = row['MarkerText'];
      if (mText && mText !== '—') {
        const hBasis = row['[H vs Markers] Text Position X'] || row['H(coor basis used)'];
        markers.push({ x: hint, text: mText, basis: hBasis });
      }
      
      const hText = row['HLength Text'];
      if (hText && hText !== '—') {
        const lengthVal = parseFloat(hText);
        // Place the text in the middle of the span by subtracting half its length from the end point
        const midX = !isNaN(lengthVal) ? hint - (lengthVal / 2) : hint;
        hLengths.push({ x: midX, text: hText });
      }
    }
  });

  if (minH === Infinity) return '<div style="color:#94a3b8;padding:20px;">Invalid data points</div>';

  if (maxH === minH) maxH += 1;
  if (minZ === Infinity) { minZ = -10; maxZ = 0; }
  if (maxZ === minZ) maxZ += 1;

  const rangeZ = maxZ - minZ;
  minZ -= rangeZ * 0.2;
  maxZ += rangeZ * 0.5; // Leave extra room at top for markers

  const scaleX = (x) => pad + ((x - minH) / (maxH - minH)) * (w - pad * 2);
  const scaleY = (z) => h - pad - ((z - minZ) / (maxZ - minZ)) * (h - pad * 2);

  const hMapStr = data.map(r => `${r['Hlength_Cum_Int']}:${r['H(coor basis used)']}`).join(',');

  let svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="background:#0b1220;border-radius:8px;touch-action:none;" data-svg-type="table3x" data-min-y="${minZ}" data-max-y="${maxZ}" data-min-x="${minH}" data-max-x="${maxH}" data-pad="${pad}" data-w="${w}" data-h="${h}" data-h-map="${hMapStr}">`;
  
  // Axes (H axis at top, Z axis at left)
  svg += `<line x1="${pad}" y1="${pad}" x2="${w-pad}" y2="${pad}" stroke="#334155" stroke-width="2"/>`;
  svg += `<line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h-pad}" stroke="#334155" stroke-width="2"/>`;
  svg += `<text x="${pad - 10}" y="${h - pad}" fill="#94a3b8" font-size="12" font-family="monospace" text-anchor="end">Z (Depth)</text>`;
  svg += `<text x="${w - pad + 10}" y="${pad + 4}" fill="#94a3b8" font-size="12" font-family="monospace" text-anchor="start">Hlength_Cum</text>`;

  // Z profile line
  if (zPoints.length > 0) {
    const pathD = zPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x).toFixed(2)} ${scaleY(p.z).toFixed(2)}`).join(' ');
    svg += `<path d="${pathD}" fill="none" stroke="#f472b6" stroke-width="3" stroke-linejoin="round" />`;
    
    zPoints.forEach(p => {
      const sx = scaleX(p.x);
      const sy = scaleY(p.z);
      svg += `<circle cx="${sx}" cy="${sy}" r="7" fill="#f472b6" stroke="#0f172a" stroke-width="2" style="cursor:ns-resize;" class="p3d-draggable-node" data-drag-type="table3x" data-h-basis="${p.basis}" data-original-text="${p.text}" />`;
      svg += `<text x="${sx}" y="${sy + 18}" fill="#fbcfe8" font-size="10" font-family="monospace" text-anchor="middle" class="p3d-drag-label" data-h-basis="${p.basis}">${p.text}</text>`;
    });
  }

  // Markers hanging from the top axis
  markers.forEach(p => {
    const sx = scaleX(p.x);
    // Dashed line dropping down from top axis
    svg += `<line x1="${sx}" y1="${pad}" x2="${sx}" y2="${h-pad}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="4" class="p3d-drag-marker-line" data-h-basis="${p.basis}" />`;
    // Draw Marker Text above the axis
    svg += `<text x="${sx}" y="${pad - 18}" fill="#6ee7b7" font-size="11" font-family="monospace" text-anchor="middle" font-weight="bold" class="p3d-drag-marker-text" data-h-basis="${p.basis}">${p.text}</text>`;
    // Draw Explicit X value just below Marker Text
    svg += `<text x="${sx}" y="${pad - 4}" fill="#fb923c" font-size="11" font-family="monospace" text-anchor="middle" class="p3d-drag-marker-x" data-h-basis="${p.basis}">X: ${p.x.toFixed(1)}</text>`;
    // Top anchor circle
    svg += `<circle cx="${sx}" cy="${pad}" r="7" fill="#34d399" stroke="#0f172a" stroke-width="2" style="cursor:ew-resize;" class="p3d-draggable-node" data-drag-type="table3x-marker" data-h-basis="${p.basis}" data-original-text="${p.text}" />`;
  });

  // HLength text (trendline/spans) below top axis
  hLengths.forEach(p => {
    const sx = scaleX(p.x);
    svg += `<text x="${sx}" y="${pad + 16}" fill="#cbd5e1" font-size="10" font-family="monospace" text-anchor="middle">${p.text}</text>`;
  });

  svg += `</svg>`;
  return svg;
}
