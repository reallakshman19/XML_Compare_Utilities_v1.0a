/**
 * staged-json-adapter.js — converts staged JSON objects into Raw Element
 * Records suitable for the CanonicalObjectGraph builder.
 *
 * This provides the exact same output shape as inputxml-adapter.js, allowing
 * the monolithic Compare Engine to operate on Staged JSON documents natively.
 */

import { readStagedBranches } from '../core/staged-json-core.js';

function isObject(val) {
  return val && typeof val === 'object' && !Array.isArray(val);
}

function cleanNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : (value == null ? '' : String(value).trim());
}

/** 
 * Safely parse a point {x,y,z} object into an [x,y,z] array or return null. 
 */
function strictPoint(value) {
  if (!isObject(value)) return null;
  const x = Number(value.x), y = Number(value.y), z = Number(value.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  return [x, y, z];
}

/** 
 * Map a Staged JSON component into the "Raw Element Record" format 
 * expected by canonical-graph-builder.js
 */
function adaptComponent(component, index, branchName) {
  const attrs = isObject(component.attributes) ? component.attributes : {};
  const start = strictPoint(attrs.APOS) || [0, 0, 0];
  const end = strictPoint(attrs.LPOS) || start;
  
  const deltaMm = [
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  ];
  
  const lengthMm = Math.hypot(deltaMm[0], deltaMm[1], deltaMm[2]);
  
  // Staged JSON may carry properties directly on the element or in attributes.
  // We grab standard CAESAR II evidence keys if present.
  const properties = { ...attrs };
  
  // Clean diameter and wall thickness.
  const diameterMm = cleanNumber(attrs.DIAMETER, NaN);
  const wallThickMm = cleanNumber(attrs.WALL_THICK, NaN);
  
  // The graph builder needs a fromNode and toNode to calculate path logic.
  // If APORT_ID is present, we use it. Otherwise, we fallback to a synthesized ID.
  const fromNode = cleanText(attrs.APORT_ID) || `${branchName}-COMP${index}-START`;
  const toNode = cleanText(attrs.LPORT_ID) || `${branchName}-COMP${index}-END`;
  const name = cleanText(component.name) || cleanText(attrs.NAME) || `#${index}`;
  const componentType = cleanText(component.type) || cleanText(attrs.TYPE) || '';

  return {
    index,
    fromNode,
    toNode,
    deltaMm,
    lengthMm,
    diameterMm,
    wallThickMm,
    name,
    componentType,
    lineId: branchName,
    packets: [], // Staged JSON doesn't encapsulate logic in "packets" natively
    properties,
    blocks: null, // Categorized XML concept, irrelevant here
  };
}

/**
 * Iterates a Staged JSON document and extracts all components into a flat array
 * of Raw Element Records for compare.
 */
export function extractStagedRecords(stagedJsonDoc) {
  const { branches } = readStagedBranches(stagedJsonDoc);
  const records = [];
  
  let globalIndex = 0;
  
  for (const branch of branches) {
    const branchName = cleanText(branch.name) || cleanText(branch.attributes?.NAME) || `BRANCH-${globalIndex}`;
    const components = Array.isArray(branch.children) ? branch.children : [];
    
    for (const component of components) {
      records.push(adaptComponent(component, globalIndex, branchName));
      globalIndex++;
    }
  }
  
  return records;
}
