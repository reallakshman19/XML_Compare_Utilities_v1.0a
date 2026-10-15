function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalValue(value[key])]));
}
function planSignature(plan) {
  const signature = JSON.stringify(canonicalValue(plan));
  if (!signature) throw new TypeError('Canonical analysis-section plan must be JSON-safe.');
  return signature;
}
export function createPipelineCanonicalPlanPublicationSession(
  EventCtor = globalThis.CustomEvent,
) {
  let publishedSignature = null;
  return Object.freeze({
    publish(dialog, plan) {
      if (!dialog || !plan) return false;
      const signature = planSignature(plan);
      if (signature === publishedSignature) return false;
      dialog.pipelineCanonicalAnalysisSectionPlan = plan;
      dialog.dispatchEvent(new EventCtor('pipeline-canonical-analysis-section-plan', {
        bubbles: false, detail: { plan },
      }));
      publishedSignature = signature;
      return true;
    },
    reset() { publishedSignature = null; },
  });
}
export const _test = Object.freeze({ canonicalValue, planSignature });
