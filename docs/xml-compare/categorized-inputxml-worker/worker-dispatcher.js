import { createCategorizedInputXmlService } from '../categorized-inputxml-api/index.js';
import { createInputXmlChangeSetService } from '../inputxml-changeset-api/index.js';
import { createInputXmlProducerService } from '../inputxml-producer-api/index.js';
import {
  CATEGORIZED_INPUTXML_WORKER_OPERATIONS,
  createWorkerCapabilities,
  isWorkerOperation,
} from './worker-contracts.js';

function operationTable(producerService, categorizedService, changeSetService) {
  return Object.freeze({
    'producer.categorizeInputXml': (payload) => producerService.categorizeInputXml(payload || {}),
    'categorized.capabilities': () => categorizedService.getCapabilities(),
    'categorized.validate': (payload) => categorizedService.validate(payload || {}),
    'categorized.inspect': (payload) => categorizedService.inspect(payload || {}),
    'categorized.serialize': (payload) => categorizedService.serialize(payload || {}),
    'categorized.exportSourceInputXml': (payload) => categorizedService.exportSourceInputXml(payload || {}),
    'changeset.capabilities': () => changeSetService.getCapabilities(),
    'changeset.derive': (payload) => changeSetService.derive(payload || {}),
    'changeset.validate': (payload) => changeSetService.validateChangeSet(payload?.changeSet ?? payload),
    'changeset.apply': (payload) => changeSetService.apply(payload || {}),
  });
}

export function createCategorizedInputXmlWorkerDispatcher(options = {}) {
  const producerService = options.producerService || createInputXmlProducerService();
  const categorizedService = options.categorizedService || createCategorizedInputXmlService();
  const changeSetService = options.changeSetService || createInputXmlChangeSetService();
  const operations = operationTable(producerService, categorizedService, changeSetService);
  return Object.freeze({
    getCapabilities: createWorkerCapabilities,
    listOperations: () => CATEGORIZED_INPUTXML_WORKER_OPERATIONS,
    dispatch(operation, payload = null) {
      if (!isWorkerOperation(operation)) {
        const error = new Error(`Unsupported worker operation: ${operation}`);
        error.code = 'OPERATION_UNKNOWN';
        throw error;
      }
      return operations[operation](payload);
    },
  });
}

export const _test = Object.freeze({ operationTable });
