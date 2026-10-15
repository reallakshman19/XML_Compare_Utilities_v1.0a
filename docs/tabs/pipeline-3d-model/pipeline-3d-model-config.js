import './pipeline-3d-model-cad-runtime-policy.js?v=20260713-cad-default-1';
import './pipeline-3d-model-cad-production-hardening.js?v=20260713-cad-hardening-1';
import './pipeline-3d-model-cad-interaction-quality.js?v=20260713-cad-quality-1';
import './pipeline-3d-model-cad-axis-history-fix.js?v=20260713-axis-history-1';
import './pipeline-3d-model-cad-layout-hardening.js?v=20260713-cad-layout-1';
import './pipeline-3d-model-cad-lifecycle-performance.js?v=20260713-cad-lifecycle-1';
import './pipeline-3d-model-cad-floating-preview.js?v=20260713-floating-preview-1';
import './pipeline-3d-model-cad-floating-preview-hardening.js?v=20260713-floating-preview-hardening-1';
import { installPipelineCadWorkspaceComposition } from './pipeline-3d-model-cad-workspace.js?v=20260715-pcad-002';
import './pipeline-3d-model-cad-selection-visibility.js?v=20260714-pcad-001-selection';
if (globalThis.document) installPipelineCadWorkspaceComposition(globalThis.document);

export const STORAGE_KEY = 'pipeline-3d-model-config-v1';
const field = (key, label, unit = '') => Object.freeze({ key, label, unit, default: '' });
const pressureFields = Array.from({ length: 9 }, (_, index) => field(
  `p${index + 1}`, `P${index + 1}${index === 0 ? ' (Design Pressure)' : ''}`));
const temperatureFields = Array.from({ length: 9 }, (_, index) => field(`t${index + 1}`, `T${index + 1}`, 'Deg C'));
export const CONFIG_FIELDS = Object.freeze([
  field('jobName', 'Job Name'), field('issueNo', 'Issue No'),
  field('caesarVersion', 'CAESAR Version'), field('branchName', 'Branch Name'),
  field('lineNo', 'Line No'), field('outsideDiameterMm', 'Physical Outside Diameter', 'mm'),
  field('boreMm', 'Nominal / Bore Reference (not OD)', 'mm'),
  field('wallThickness', 'Wall Thickness', 'mm'), ...pressureFields, ...temperatureFields,
  field('fluidDensity', 'Fluid Density', 'kg/m3'),
  field('materialCode', 'Material No (CAESAR MATERIAL_NUM)'),
  field('corrosionAllowance', 'Corrosion Allowance', 'mm'),
  field('insulationThickness', 'Insulation Thickness', 'mm'),
  field('insulationDensity', 'Insulation Density', 'kg/m3'),
  field('hydroPressure', 'Hydro Test Pressure'),
]);
export function fieldLabel(value) { return value.unit ? `${value.label} (${value.unit})` : value.label; }
function readStorage(storage) {
  try { const raw = storage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
export function loadConfigValues(storage = globalThis.localStorage) {
  const saved = storage?.getItem ? readStorage(storage) : {};
  return Object.fromEntries(CONFIG_FIELDS.map((item) => [item.key,
    Object.hasOwn(saved, item.key) ? saved[item.key] : '']));
}
export function saveConfigValues(values, storage = globalThis.localStorage) {
  if (!storage?.setItem) return false;
  try { storage.setItem(STORAGE_KEY, JSON.stringify(values || {})); return true; }
  catch { return false; }
}
