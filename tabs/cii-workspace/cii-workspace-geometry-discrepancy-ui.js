import {inspectCiiGeometryDiscrepancy} from './cii-workspace-geometry-discrepancy-review.js';

/**
 * A2-17 rendered engineering investigation control.
 * Inputs, preview and exported JSON NEVER alter preparedSession or Writer inputs.
 */
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'not available':Array.isArray(v)?v.map(x=>Number(x).toFixed(3)).join(', '):String(v);
export const CII_A217_DEFAULT_DRAFT=Object.freeze({
 sourceId:'S2',sourceNodeId:'',targetNodeId:'',
 sourceElementId:'',targetElementId:'',
 dxMm:0,dyMm:0,dzMm:0,sourceElementLengthAdjustmentMm:0,
});
const options=[
 ['S2_BEND_200','S2 E43 ↔ T E1017 · 200 mm BEND length discrepancy'],
 ['S2_PIPE_1500','S2 E11 ↔ T E983 · 1,500 mm PIPE discrepancy'],
 ['S2_TERMINAL','S2 terminal NODE 40 ↔ TARGET 40030 · topology difference'],
];
function resultsMarkup(receipt){
 if(!receipt)return '<p data-ciiw-geometry-empty="1">Choose original NODEs and optionally ELEMENTs, enter a proposed shift, then select Preview. No adjustment will be applied to either model.</p>';
 const pair=receipt.originalPhysicalPair,adjusted=receipt.proposedAdjustment;
 return `<div data-ciiw-geometry-result="1">
 <p><b>Engineering status: REVIEW ONLY — NOT CERTIFIED · NOT APPLIED</b></p>
 <p>Original SOURCE SHA: <code>${h(receipt.provenance.sourceOriginalSha256)}</code></p>
 <p>Original TARGET SHA: <code>${h(receipt.provenance.targetOriginalSha256)}</code></p>
 <table class="ciiw-mini-grid"><thead><tr><th>Physical observation</th><th>Recorded/observed</th><th>Hypothetical change (not applied)</th></tr></thead>
 <tbody>
 <tr><td>NODE pair</td><td>${h(pair.sourceNodeId)} → ${h(pair.targetNodeId)}</td><td>Identity UNVERIFIED; degrees ${h(pair.sourceNodeDegree)} ↔ ${h(pair.targetNodeDegree)}</td></tr>
 <tr><td>SOURCE XYZ, mm</td><td>${h(fmt(pair.originalSourcePositionMm))}</td><td>${h(fmt(adjusted.proposedSourcePositionMm))}</td></tr>
 <tr><td>TARGET XYZ, mm</td><td>${h(fmt(pair.originalTargetPositionMm))}</td><td>Unchanged</td></tr>
 <tr><td>TARGET minus SOURCE XYZ, mm (unregistered frames)</td><td>${h(fmt(pair.originalTargetMinusSourceMm))}</td><td>Hypothetical residual ${h(fmt(adjusted.hypotheticalTargetMinusAdjustedSourceMm))}</td></tr>
 <tr><td>Recorded ELEMENT lengths, mm</td><td>SOURCE ${h(fmt(pair.sourceElement?.recordedLengthMm))} · TARGET ${h(fmt(pair.targetElement?.recordedLengthMm))}</td><td>Adjusted SOURCE ${h(fmt(adjusted.hypotheticalAdjustedSourceElementLengthMm))}</td></tr>
 <tr><td>TARGET minus SOURCE recorded ELEMENT length, mm</td><td>${h(fmt(pair.recordedTargetMinusSourceLengthMm))}</td><td>Hypothetical residual ${h(fmt(adjusted.hypotheticalElementLengthResidualMm))}</td></tr>
 </tbody></table>
 <p><b>Boundaries:</b> ${h(receipt.warnings.join(' · ').replaceAll('_',' '))}</p>
 <p><b>Writer readiness:</b> BLOCKED · 0 certified NODEs · 0 certified ELEMENTs · no correspondence certificate · no new APPLY.</p>
 <button type="button" data-ciiw-geometry-download>Download source-bound review JSON</button>
 </div>`;
}
export function renderCiiGeometryDiscrepancyReviewPanel(container,preparedSession,state){
 if(!container||!preparedSession)return;
 const draft=state.draft||{...CII_A217_DEFAULT_DRAFT};
 state.draft=draft;
 const choices=(preparedSession.members||[]).map(m=>`<option value="${h(m.sourceId)}" ${draft.sourceId===m.sourceId?'selected':''}>${h(m.sourceId)} — ${h(m.fileName)}</option>`).join('');
 container.innerHTML=`<section class="ciiw-base-set" data-ciiw-geometry-review="1">
 <header><div><b>Geometry Discrepancy Review</b><span>Original NODE/ELEMENT measurements · 100/200 mm review-only adjustments</span></div><span class="ciiw-corroboration">REVIEW ONLY</span></header>
 <p>Explore a SOURCE/TARGET geometry difference and propose a scoped translation or a separate recorded ELEMENT-length revision. <b>Nothing here changes correspondence, matching tolerances, CII bytes or Writer scope.</b> Original coordinate frames have not been independently registered; a BEND length difference does not prove an XYZ displacement.</p>
 <label><b>Recorded discrepancy investigation</b> <select data-ciiw-geometry-case><option value="">Custom review — no assumed correspondence</option>${options.map(([v,label])=>`<option value="${h(v)}">${h(label)}</option>`).join('')}</select></label>
 <div class="ciiw-detail-grid">
 <label>Original SOURCE <select data-ciiw-geometry-field="sourceId">${choices}</select></label>
 <label>SOURCE NODE ID <input data-ciiw-geometry-field="sourceNodeId" type="text" inputmode="numeric" value="${h(draft.sourceNodeId)}" placeholder="e.g. 630"></label>
 <label>TARGET NODE ID <input data-ciiw-geometry-field="targetNodeId" type="text" inputmode="numeric" value="${h(draft.targetNodeId)}" placeholder="e.g. 10470"></label>
 <label>SOURCE ELEMENT ID (optional) <input data-ciiw-geometry-field="sourceElementId" type="text" value="${h(draft.sourceElementId)}" placeholder="E43:620->630"></label>
 <label>TARGET ELEMENT ID (optional) <input data-ciiw-geometry-field="targetElementId" type="text" value="${h(draft.targetElementId)}" placeholder="E1017:10460->10470"></label>
 </div>
 <p><b>Proposed SOURCE translation (mm)</b> — a visual hypothesis, not a geometric tolerance.</p>
 <div class="ciiw-detail-grid">
 ${[['dxMm','ΔX'],['dyMm','ΔY'],['dzMm','ΔZ']].map(([k,name])=>`<label>${name} (mm) <input data-ciiw-geometry-field="${k}" type="number" min="-5000" max="5000" step="any" value="${h(draft[k])}"></label>`).join('')}
 </div>
 <p>Presets: ${['100','200'].flatMap(mm=>[['Y',Number(mm)],['Y',-Number(mm)]].map(([axis,value])=>
 `<button type="button" class="ciiw-ms-inline-action" data-ciiw-geometry-preset-axis="${axis}" data-ciiw-geometry-preset-mm="${value}">Δ${axis} ${value>0?'+':''}${value} mm</button>`)).join(' ')}</p>
 <label><b>Separate proposed SOURCE recorded ELEMENT length change (mm)</b><input data-ciiw-geometry-field="sourceElementLengthAdjustmentMm" type="number" min="-5000" max="5000" step="any" value="${h(draft.sourceElementLengthAdjustmentMm)}"></label>
 <div class="ciiw-transfer-scope-actions"><button type="button" data-ciiw-geometry-preview>Preview difference only</button><button type="button" data-ciiw-geometry-clear>Reset adjustment</button></div>
 <div data-ciiw-geometry-status></div><div data-ciiw-geometry-output>${resultsMarkup(state.receipt)}</div>
 </section>`;
 function repaint(){
  const review=container.querySelector('[data-ciiw-geometry-review]');
  if(!review)return;
  review.querySelectorAll('[data-ciiw-geometry-field]').forEach(el=>{
   const key=el.dataset.ciiwGeometryField;
   if(key==='sourceId')el.value=draft.sourceId;
   else el.value=String(draft[key]??'');
  });
  review.querySelector('[data-ciiw-geometry-output]').innerHTML=resultsMarkup(state.receipt);
 }
 function change(field,value){
  draft[field]=value;state.receipt=null;
  const status=container.querySelector('[data-ciiw-geometry-status]');if(status)status.textContent='';
  repaint();
 }
 container.querySelectorAll('[data-ciiw-geometry-field]').forEach(el=>el.addEventListener('change',()=>{
  const key=el.dataset.ciiwGeometryField;
  change(key,['dxMm','dyMm','dzMm','sourceElementLengthAdjustmentMm'].includes(key)?Number(el.value):el.value);
 }));
 container.querySelectorAll('[data-ciiw-geometry-preset-mm]').forEach(btn=>btn.addEventListener('click',()=>{
  change('dyMm',Number(btn.dataset.ciiwGeometryPresetMm));
 }));
 container.querySelector('[data-ciiw-geometry-case]')?.addEventListener('change',e=>{
  const name=e.target.value;
  if(name==='S2_BEND_200')Object.assign(draft,{sourceId:'S2',sourceNodeId:'630',targetNodeId:'10470',sourceElementId:'E43:620->630',targetElementId:'E1017:10460->10470',dxMm:0,dyMm:0,dzMm:0,sourceElementLengthAdjustmentMm:-200});
  else if(name==='S2_PIPE_1500')Object.assign(draft,{sourceId:'S2',sourceNodeId:'210',targetNodeId:'10130',sourceElementId:'E11:210->220',targetElementId:'E983:10130->10140',dxMm:0,dyMm:0,dzMm:0,sourceElementLengthAdjustmentMm:1500});
  else if(name==='S2_TERMINAL')Object.assign(draft,{sourceId:'S2',sourceNodeId:'40',targetNodeId:'40030',sourceElementId:'',targetElementId:'',dxMm:0,dyMm:0,dzMm:0,sourceElementLengthAdjustmentMm:0});
  else Object.assign(draft,CII_A217_DEFAULT_DRAFT);
  state.receipt=null;repaint();
 });
 container.querySelector('[data-ciiw-geometry-clear]')?.addEventListener('click',()=>{
  Object.assign(draft,{dxMm:0,dyMm:0,dzMm:0,sourceElementLengthAdjustmentMm:0});
  state.receipt=null;repaint();
 });
 container.querySelector('[data-ciiw-geometry-preview]')?.addEventListener('click',()=>{
  const status=container.querySelector('[data-ciiw-geometry-status]');
  try{state.receipt=inspectCiiGeometryDiscrepancy(preparedSession,draft);
   status.textContent='Read-only source-bound geometric hypothesis computed. No model changes or Writer authority.';
  }catch(e){state.receipt=null;status.textContent=e?.message||String(e)}
  repaint();
 });
 container.querySelector('[data-ciiw-geometry-review]').addEventListener('click',e=>{
  if(!e.target.closest('[data-ciiw-geometry-download]'))return;
  if(!state.receipt)return;
  const payload=JSON.stringify(state.receipt,null,2);
  const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
  const link=container.ownerDocument.createElement('a');
  link.href=url;link.download='cii-geometry-discrepancy-review-source-bound.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),0);
 });
}
