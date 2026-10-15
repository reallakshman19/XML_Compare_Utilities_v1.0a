import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNavisTagXml } from '../tabs/navis-tag-isonote/navis-tag-xml-parser.js';

const xml = readFileSync('tests/fixtures/navis-tag-benchmark-fragment.xml', 'utf8');
const result = parseNavisTagXml(xml, { navisUnits: 'auto' });
assert.equal(result.summary.viewCount, 3);
assert.equal(result.summary.tagCount, 3);
assert.equal(result.summary.validTagCount, 3);
assert.equal(result.summary.units, 'm');
assert.equal(result.summary.boundsFallbackCount, 1);

const first = result.tags.find((tag) => tag.viewName === 'Tag View 1');
assert.equal(first.commentBody, 'Model monofl ball valve (typ)');
assert.equal(first.commentUser, 'muc5407');
assert.equal(first.commentDate, '2023-10-02T07:11:52');
assert.equal(first.positionSource, 'RLTAG_POS3D');
assert.ok(Math.abs(first.position.x - 151763.9234984) < 0.001);
assert.ok(Math.abs(first.position.y - 125051.8443733) < 0.001);
assert.ok(Math.abs(first.position.z - 101634.4626546) < 0.001);
assert.match(first.evidenceId, /d3ab9983-21c4-4662-93bd-5909e23be90f:RL-1:C-1/);

const second = result.tags.find((tag) => tag.viewName === 'Tag View 2');
assert.equal(second.commentBody, 'Update 3/4" size monofl ball valve as per comment (typ)');
assert.equal(second.commentId, '2');

const bounds = result.tags.find((tag) => tag.viewName === 'Bounds Fallback');
assert.equal(bounds.commentId, '1');
assert.equal(bounds.positionSource, 'RLTAG_BOUNDS_MIDPOINT');
assert.deepEqual({ x: bounds.position.x, y: bounds.position.y, z: bounds.position.z }, { x: 1100, y: 2200, z: 3300 });
assert.ok(bounds.diagnostics.includes('POSITION_FROM_BOUNDS'));
assert.notEqual(first.evidenceId, bounds.evidenceId);
assert.equal(result.diagnostics.filter((item) => item.code === 'DUPLICATE_COMMENT_ID_IN_VIEW').length, 0);

const broken = parseNavisTagXml('<exchange units="mm"><viewpoints><view name="Broken" guid="v"><comments><comment id="1"><body></body></comment></comments><redlines><rltag id="7" commentid="9"></rltag></redlines></view></viewpoints></exchange>', {});
assert.ok(broken.diagnostics.some((item) => item.code === 'COMMENT_LINK_NOT_FOUND'));
assert.ok(broken.diagnostics.some((item) => item.code === 'COMMENT_BODY_EMPTY'));
assert.ok(broken.diagnostics.some((item) => item.code === 'TAG_POSITION_MISSING'));
assert.ok(broken.diagnostics.some((item) => item.code === 'COMMENT_WITHOUT_RLTAG'));

console.log('navis-tag-isonote benchmark parser tests passed');
