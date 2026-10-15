const PILL = 'display:inline-flex;align-items:center;border:1px solid #afb8c1;border-radius:999px;padding:.16rem .45rem;font-size:.68rem;font-weight:800;white-space:nowrap;margin:.08rem .2rem .08rem 0';
const EVIDENCE = Object.freeze([
  'background:#ffebe9;border-color:#ff8182;color:#cf222e',
  'background:#fff8c5;border-color:#d4a72c;color:#633c01',
  'background:#eaf5d8;border-color:#74a63a;color:#3b5d15',
  'background:#dafbe1;border-color:#2da44e;color:#116329',
  'background:#1a7f37;border-color:#116329;color:#fff',
]);
const NAME = Object.freeze({
  exact: EVIDENCE[4], canonical: EVIDENCE[3], partial: EVIDENCE[2], none: EVIDENCE[0], unavailable: 'background:#f6f8fa;border-color:#afb8c1;color:#57606a',
});
export function ciiEvidenceBandStyle(level) {
  const index = Math.max(0, Math.min(4, Number(level || 0)));
  return `${PILL};${EVIDENCE[index]}`;
}
export function ciiNodeNameBandStyle(kind) {
  return `${PILL};${NAME[String(kind || 'unavailable').toLowerCase()] || NAME.unavailable}`;
}
