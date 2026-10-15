const STYLE_ID = 'pipeline-elastic-bend-settings-style';

const STYLE_TEXT = `
.pipeline-3d-model-dialog{position:relative}.p3d-elastic-open{margin-right:84px;background:#0c4a6e;color:#e0f2fe;border:1px solid #38bdf8;border-radius:7px;padding:6px 10px;cursor:pointer}
.p3d-elastic-page{position:absolute;inset:0;z-index:40;background:#0b1220;color:#e2e8f0;display:grid;grid-template-rows:auto minmax(0,1fr);border-radius:18px;overflow:hidden}.p3d-elastic-page[hidden],.p3d-policy-section[hidden]{display:none}
.p3d-elastic-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(148,163,184,.25);background:linear-gradient(90deg,#082f49,#0f172a)}.p3d-elastic-head h3{margin:0;color:#e0f2fe}.p3d-elastic-head p{margin:4px 0 0;color:#fbbf24;font-size:12px;max-width:900px}
.p3d-elastic-actions{display:flex;gap:8px;flex-wrap:wrap}.p3d-elastic-actions button{background:#334155;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);border-radius:7px;padding:7px 11px;cursor:pointer}.p3d-elastic-actions button[data-primary]{background:#0369a1;border-color:#38bdf8}
.p3d-elastic-body{min-height:0;overflow:auto;padding:14px;display:grid;grid-template-columns:minmax(390px,500px) minmax(620px,1fr);gap:14px}.p3d-elastic-card,.p3d-policy-section{background:#101a2b;border:1px solid rgba(148,163,184,.25);border-radius:12px;padding:12px}.p3d-elastic-card h4,.p3d-policy-section h5{margin:0 0 10px;color:#bfdbfe}
.p3d-elastic-note{font-size:11px;line-height:1.45;color:#cbd5e1;background:#020617;border:1px solid rgba(148,163,184,.2);border-radius:7px;padding:8px;margin:8px 0}.p3d-elastic-note b{color:#7dd3fc}.p3d-elastic-note[data-alert]{border-color:#f59e0b;color:#fde68a}
.p3d-elastic-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.p3d-elastic-grid label{display:flex;flex-direction:column;gap:4px;color:#94a3b8;font-size:12px}.p3d-elastic-grid label.wide{grid-column:1/-1}.p3d-elastic-grid input,.p3d-elastic-grid select{background:#020617;color:#e2e8f0;border:1px solid rgba(148,163,184,.35);border-radius:6px;padding:6px}.p3d-elastic-checks{display:grid;gap:7px;margin:8px 0}.p3d-elastic-checks label{font-size:12px;color:#cbd5e1}
.p3d-elastic-summary{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:8px;margin-bottom:10px}.p3d-elastic-metric{background:#020617;border:1px solid rgba(148,163,184,.22);border-radius:8px;padding:8px}.p3d-elastic-metric span{display:block;color:#94a3b8;font-size:11px}.p3d-elastic-metric b{font-family:monospace;color:#e0f2fe}
.p3d-elastic-result{overflow:auto;max-height:540px}.p3d-elastic-result table{width:100%;border-collapse:collapse;font-size:11px;min-width:1700px}.p3d-elastic-result th,.p3d-elastic-result td{padding:6px;border-bottom:1px solid rgba(148,163,184,.18);text-align:left}.p3d-elastic-result th{position:sticky;top:0;background:#111c2f;color:#bfdbfe}.p3d-elastic-warnings{margin-top:10px;color:#fde68a;font-size:12px;white-space:pre-wrap}.p3d-elastic-status{min-height:18px;color:#bbf7d0;font-size:12px;margin-top:8px}
@media(max-width:1050px){.p3d-elastic-body{grid-template-columns:1fr}.p3d-elastic-summary{grid-template-columns:1fr 1fr}}
`;

export function installBendSettingsStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  doc.head.appendChild(style);
}
