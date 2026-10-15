function stableRef(ref = '') {
  if (!ref || typeof ref !== 'object') return JSON.stringify(ref || '');
  return JSON.stringify(Object.keys(ref).sort().reduce((acc, key) => ({ ...acc, [key]: ref[key] }), {}));
}

function diagnosticKey(item = {}) {
  return [item.severity || '', item.code || '', item.message || '', stableRef(item.ref)].join('|');
}

export function dedupeInputReadinessDiagnostics(diagnostics = []) {
  const seen = new Set(), out = [];
  for (const diagnostic of Array.isArray(diagnostics) ? diagnostics : []) {
    const key = diagnosticKey(diagnostic);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(diagnostic);
  }
  return Object.freeze(out);
}
