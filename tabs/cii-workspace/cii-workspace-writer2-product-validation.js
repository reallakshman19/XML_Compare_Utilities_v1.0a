import { deepFreeze } from './cii-workspace-contracts.js';
import { validateCiiWriter2CompositeWithHangerRoundTrip } from './cii-workspace-writer2-composite-hanger-validation.js';
import { validateCiiWriter2CompositeWithPartialHangerRoundTrip } from './cii-workspace-writer2-composite-hanger-partial-validation.js';
import { validateCiiWriter2CompositeWithRestraintDelete } from './cii-workspace-writer2-composite-restraint-validation.js';

const RESTRAINT_RESULT_SCHEMA = 'CIIWorkspaceWriter2CompositeRestraintResult.v1';

function count(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`CII_WRITER_2_PRODUCT_${label}_COUNT_INVALID`);
  return number;
}
function validateRestraintProduct(before, after, targetGraph, transferPlan, writerResult) {
  const restraintCount = count(writerResult?.familyMutationCounts?.restraintDeleteOperations, 'RESTRAINT_DELETE');
  const restraintComponent = writerResult?.components?.restraintDelete || null;
  if (restraintCount < 1 || !restraintComponent) {
    throw new Error('CII_WRITER_2_PRODUCT_RESTRAINT_COMPONENT_TESTIMONY_MISMATCH');
  }
  const validation = validateCiiWriter2CompositeWithRestraintDelete({
    before, after, targetGraph, transferPlan, writerResult,
  });
  return deepFreeze({
    ...validation,
    productValidatorClass: 'RESTRAINT_DELETE_COMPOSITE',
    unexpectedSemanticDeltaCount: 0,
  });
}

export function validateCiiWriter2ProductRoundTrip(before, after, targetGraph, transferPlan, writerResult) {
  const restraintCount = count(writerResult?.familyMutationCounts?.restraintDeleteOperations, 'RESTRAINT_DELETE');
  const restraintComponent = writerResult?.components?.restraintDelete || null;
  if (writerResult?.schema === RESTRAINT_RESULT_SCHEMA) {
    return validateRestraintProduct(before, after, targetGraph, transferPlan, writerResult);
  }
  if (restraintCount > 0 || restraintComponent) {
    throw new Error('CII_WRITER_2_PRODUCT_RESTRAINT_RESULT_SCHEMA_MISMATCH');
  }

  const counts = writerResult?.familyMutationCounts || {};
  const deleteAllCount = count(counts.hangerDeleteAllOperations, 'HANGER_DELETE_ALL');
  const partialCount = count(counts.hangerPartialDeleteOperations, 'HANGER_PARTIAL_DELETE');
  const deleteAllComponent = writerResult?.components?.hangerDeleteAll || null;
  const partialComponent = writerResult?.components?.hangerPartialDelete || null;

  if ((deleteAllCount > 0) !== Boolean(deleteAllComponent)) {
    throw new Error('CII_WRITER_2_PRODUCT_HANGER_DELETE_ALL_COMPONENT_TESTIMONY_MISMATCH');
  }
  if ((partialCount > 0) !== Boolean(partialComponent)) {
    throw new Error('CII_WRITER_2_PRODUCT_HANGER_PARTIAL_COMPONENT_TESTIMONY_MISMATCH');
  }
  if ((deleteAllCount > 0 && partialCount > 0) || (deleteAllComponent && partialComponent)) {
    throw new Error('CII_WRITER_2_PRODUCT_HANGER_COMPONENT_CLASS_AMBIGUOUS');
  }

  const validation = partialCount > 0
    ? validateCiiWriter2CompositeWithPartialHangerRoundTrip(before, after, targetGraph, transferPlan, writerResult)
    : validateCiiWriter2CompositeWithHangerRoundTrip(before, after, targetGraph, transferPlan, writerResult);
  const productValidatorClass = partialCount > 0 ? 'PARTIAL_H_GT_1' : deleteAllCount > 0 ? 'DELETE_ALL' : 'NO_HANGER';
  return deepFreeze({ ...validation, productValidatorClass, unexpectedSemanticDeltaCount: 0 });
}

export const _test = Object.freeze({ count, validateRestraintProduct, RESTRAINT_RESULT_SCHEMA });
