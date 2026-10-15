// Guarded startup for the standalone XML Compare Utilities app.
function startupMount() {
  return document.getElementById('app') || document.getElementById('app-layout') || document.getElementById('app-shell') || document.body;
}

function reportStartupError(error) {
  console.error('XML Compare Utilities startup error', error);
  const root = startupMount();
  if (!root) return;
  root.textContent = `XML Compare Utilities startup error: ${String(error?.message || error)}`;
}

async function startStandaloneApp() {
  const module = await import('./core/app.js?v=20260708-m23-transfer-tile-layout');
  await module.init(startupMount());
}

startStandaloneApp().catch(reportStartupError);
