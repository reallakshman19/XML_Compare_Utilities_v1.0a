import './navis-tag-isonote.test.js';
import './navis-tag-isonote-static.test.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PSNM_UTILITY_LAYOUT_STABILIZER_SCHEMA, utilityLayoutCss } from '../tabs/psnm-utility-tab-layout-stabilizer.js';

assert.equal(PSNM_UTILITY_LAYOUT_STABILIZER_SCHEMA, 'app-dashboard/v1');

const css = utilityLayoutCss();
assert.ok(css.includes('.app-dashboard-grid'));
assert.ok(css.includes('grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))'));
assert.ok(css.includes('[data-psmap-modal] .psmap-body'));
assert.ok(css.includes('@media(max-width: 900px)'));

const stabilizerSource = readFileSync('tabs/psnm-utility-tab-layout-stabilizer.js', 'utf8');
assert.match(stabilizerSource, /data-psnm-deck/);

const utilityTabSource = readFileSync('tabs/psnm-utility-tab.js', 'utf8');
assert.match(utilityTabSource, /installPsnmUtilityLayoutStabilizer/);
assert.match(utilityTabSource, /psnm-utility-tab-layout-stabilizer\.js/);
assert.match(utilityTabSource, /installNavisTagIsonoteUtilityTile/);
assert.match(utilityTabSource, /destroyNavisTagIsonote/);

console.log('psnm-utility-layout-stabilizer tests passed');
