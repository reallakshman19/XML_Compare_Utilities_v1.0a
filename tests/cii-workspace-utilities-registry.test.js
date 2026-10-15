import assert from 'assert';
import fs from 'fs';
import { installCiiWorkspaceTile } from '../tabs/cii-workspace/cii-workspace-tab.js';

const source = fs.readFileSync(new URL('../tabs/psnm-utility-tab.js', import.meta.url), 'utf8');
const descriptor = "['CII Workspace', './cii-workspace/cii-workspace-tab.js', 'installCiiWorkspaceTile', true]";
const occurrences = source.split(descriptor).length - 1;

assert.strictEqual(occurrences, 1, 'Utilities must register exactly one authoritative CII Workspace tile');
assert.strictEqual(typeof installCiiWorkspaceTile, 'function');
assert(!source.includes("['CII Workspace', './cii-workspace/cii-workspace-tab.js', 'installCiiWorkspaceTile', false]"));
console.log('CII Workspace Utilities registry authority checks passed.');
