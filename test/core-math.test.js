'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../teleprompter-core.js');

test('clamp mantém dentro dos limites', () => {
  assert.strictEqual(core.clamp(5, 0, 10), 5);
  assert.strictEqual(core.clamp(-3, 0, 10), 0);
  assert.strictEqual(core.clamp(99, 0, 10), 10);
});

test('toNumber converte ou usa fallback', () => {
  assert.strictEqual(core.toNumber('42', 0), 42);
  assert.strictEqual(core.toNumber('abc', 7), 7);
  assert.strictEqual(core.toNumber(undefined, 7), 7);
  assert.strictEqual(core.toNumber(NaN, 7), 7);
  assert.strictEqual(core.toNumber(Infinity, 7), 7);
});

test('nextOffset avança proporcional à velocidade e ao tempo', () => {
  // 60 px/s por 1000 ms => +60
  assert.strictEqual(core.nextOffset(0, 60, 1000), 60);
  // 120 px/s por 500 ms => +60
  assert.strictEqual(core.nextOffset(10, 120, 500), 70);
  // velocidade 0 => não move
  assert.strictEqual(core.nextOffset(30, 0, 1000), 30);
});

test('buildMirrorTransform combina os flips', () => {
  assert.strictEqual(core.buildMirrorTransform(false, false), '');
  assert.strictEqual(core.buildMirrorTransform(true, false), 'scaleX(-1)');
  assert.strictEqual(core.buildMirrorTransform(false, true), 'scaleY(-1)');
  assert.strictEqual(core.buildMirrorTransform(true, true), 'scaleX(-1) scaleY(-1)');
});

test('constantes esperadas', () => {
  assert.strictEqual(core.APP_ID, 'teleprompter');
  assert.strictEqual(core.FORMAT_VERSION, 1);
  assert.deepStrictEqual(core.DEFAULT_SETTINGS, { speed: 60, fontSize: 48, mirrorH: false, mirrorV: false });
});
