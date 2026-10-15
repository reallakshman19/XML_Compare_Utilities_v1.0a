export const PSNM_UTILITY_LAYOUT_STABILIZER_SCHEMA = 'app-dashboard/v1';

const STYLE_ID = 'app-dashboard-style';

export function utilityLayoutCss() {
  return `
/* ── Unified App Launcher Dashboard ──────────────────────────────────────── */
.app-dashboard-root { min-height: 100%; padding: 24px 32px; background: #0b1121; color: #d9e6f7; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; }
.app-dashboard-header { margin-bottom: 24px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); padding-bottom: 16px; }
.app-dashboard-header h1 { margin: 0 0 6px; font-size: 24px; font-weight: 800; color: #e2e8f0; letter-spacing: -0.01em; }
.app-dashboard-header p { margin: 0; color: #94a3b8; font-size: 14px; }
.app-dashboard-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }

/* ── Standardized Launcher Cards ─────────────────────────────────────────── */
.psmap-tile { 
  display: flex !important; flex-direction: column; align-items: flex-start; text-align: left;
  height: auto; min-height: 140px; padding: 20px; box-sizing: border-box;
  background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 16px;
  color: #e2e8f0; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}
.psmap-tile:hover {
  background: rgba(30, 41, 59, 0.8); border-color: rgba(56, 189, 248, 0.5);
  transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
}
.psmap-tile:active { transform: translateY(0); }
.psmap-tile [class$="-icon"], .psnm-tile-icon { font-size: 32px; line-height: 1; margin: 0 0 12px; display: block; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.psmap-tile b { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; display: block; letter-spacing: -0.01em; }
.psmap-tile span:not([class]) { color: #94a3b8; font-size: 13px; line-height: 1.4; display: block; font-weight: 400; }

/* ── Overrides for modal components ──────────────────────────────────────── */
[data-psmap-modal] { max-width: calc(100vw - 32px); max-height: calc(100vh - 32px); overflow: hidden; }
[data-psmap-modal] .psmap-body { min-height: 0; overflow: auto; }
@media(max-width: 900px) {
  .app-dashboard-root { padding: 16px; }
  .app-dashboard-grid { grid-template-columns: 1fr; }
}
`;
}

function ensureStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(STYLE_ID)) return null;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = utilityLayoutCss();
  doc.head?.appendChild(style);
  return style;
}

export function installPsnmUtilityLayoutStabilizer(container) {
  const doc = container?.ownerDocument || globalThis.document;
  ensureStyle(doc);
  
  container.innerHTML = `
  <div class="app-dashboard-root">
    <header class="app-dashboard-header">
      <h1>Utilities Dashboard</h1>
      <p>Data tools, validators, and converters.</p>
    </header>
    <div class="app-dashboard-grid" data-psnm-deck>
      <!-- Launcher cards will be injected here by the tile installers -->
    </div>
  </div>`;
  
  // Return the grid so subsequent installers can append their tiles directly to it
  return container.querySelector('.app-dashboard-grid');
}

export const _test = Object.freeze({ utilityLayoutCss });
