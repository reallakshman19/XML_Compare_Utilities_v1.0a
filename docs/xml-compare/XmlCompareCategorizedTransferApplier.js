import {
  applyGraphDomTransferPlan,
  resolveTransferSourceBlocks,
  resolveTransferTargetContainer,
} from './XmlCompareTransferPatchEngine.js';
import {
  parseCategorizedTransferDocument,
  serializeCategorizedTransferDocument,
} from './XmlCompareCategorizedXmlTree.js';

export const XML_COMPARE_CATEGORIZED_TRANSFER_APPLIER_SCHEMA = 'xml-compare-categorized-transfer-applier/v3';

export function applyCategorizedTransferPlan(targetXml = '', sourceXml = '', plan = {}, options = {}) {
  return applyGraphDomTransferPlan(targetXml, sourceXml, plan, options);
}

export { parseCategorizedTransferDocument, resolveTransferSourceBlocks, resolveTransferTargetContainer, serializeCategorizedTransferDocument, applyGraphDomTransferPlan };

export const _test = Object.freeze({ applyCategorizedTransferPlan, parseCategorizedTransferDocument, serializeCategorizedTransferDocument, resolveTransferSourceBlocks, resolveTransferTargetContainer });
