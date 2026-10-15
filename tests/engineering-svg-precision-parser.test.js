import assert from 'node:assert/strict';
import {
  createEngineeringPrecisionExpression,
  validateEngineeringPrecisionExpression,
} from '../core/engineering-scene/index.js';
import {
  parseEngineeringPrecisionExpression,
  parseEngineeringPrecisionScalar,
} from '../core/engineering-svg/precision-runtime.js';

const scalar = parseEngineeringPrecisionExpression('12.5');
assert.deepEqual(scalar, {
  schema: 'EngineeringPrecisionExpression.v1',
  kind: 'scalar',
  mode: 'absolute',
  raw: '12.5',
  values: [12.5],
  unit: '',
});
const relativeScalar = parseEngineeringPrecisionExpression('@-2.25', { unit: 'mm' });
assert.equal(relativeScalar.kind, 'scalar');
assert.equal(relativeScalar.mode, 'relative');
assert.deepEqual(relativeScalar.values, [-2.25]);
assert.equal(relativeScalar.unit, 'mm');

const pair = parseEngineeringPrecisionExpression(' 1.5, -3 ');
assert.equal(pair.kind, 'pair');
assert.equal(pair.mode, 'absolute');
assert.deepEqual(pair.values, [1.5, -3]);
const relativePair = parseEngineeringPrecisionExpression('@1.5,-3');
assert.equal(relativePair.mode, 'relative');
assert.deepEqual(relativePair.values, [1.5, -3]);

const triple = parseEngineeringPrecisionExpression('@100.125,200.25,-300.5', { unit: 'mm' });
assert.equal(triple.kind, 'triple');
assert.equal(triple.mode, 'relative');
assert.deepEqual(triple.values, [100.125, 200.25, -300.5]);
assert.deepEqual(validateEngineeringPrecisionExpression(JSON.parse(JSON.stringify(triple))), triple);

assert.deepEqual(parseEngineeringPrecisionScalar('.5').values, [0.5]);
assert.throws(() => parseEngineeringPrecisionScalar('1,2'), /exactly one value/);
assert.throws(() => parseEngineeringPrecisionExpression(''), /required/);
assert.throws(() => parseEngineeringPrecisionExpression('@'), /required after @/);
assert.throws(() => parseEngineeringPrecisionExpression('1,,2'), /one, two, or three/);
assert.throws(() => parseEngineeringPrecisionExpression('1,2,3,4'), /one, two, or three/);
assert.throws(() => parseEngineeringPrecisionExpression('1e3'), /Invalid numeric precision value/);
assert.throws(() => parseEngineeringPrecisionExpression('Infinity'), /Invalid numeric precision value/);
assert.throws(() => parseEngineeringPrecisionExpression('1,@2'), /Invalid numeric precision value/);
assert.throws(() => createEngineeringPrecisionExpression({ kind: 'pair', values: [1] }), /require 2 value/);
assert.throws(() => createEngineeringPrecisionExpression({ kind: 'triple', values: [1, 2, NaN] }), /must be finite/);
assert.throws(() => validateEngineeringPrecisionExpression({ ...triple, raw: '  @100.125,200.25,-300.5  ' }), /normalized/);

console.log('engineering SVG precision parser: ok');
