'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../teleprompter-core.js');

test('normalizeSettings aplica defaults quando faltam campos', () => {
  assert.deepStrictEqual(core.normalizeSettings(undefined), core.DEFAULT_SETTINGS);
  assert.deepStrictEqual(core.normalizeSettings({}), core.DEFAULT_SETTINGS);
});

test('normalizeSettings faz clamp e coage tipos', () => {
  const s = core.normalizeSettings({ speed: 9999, fontSize: 2, mirrorH: 1, mirrorV: 0 });
  assert.strictEqual(s.speed, core.LIMITS.speed.max);
  assert.strictEqual(s.fontSize, core.LIMITS.fontSize.min);
  assert.strictEqual(s.mirrorH, true);
  assert.strictEqual(s.mirrorV, false);
});

test('serializeState monta o envelope esperado', () => {
  const out = core.serializeState('olá', { speed: 100, fontSize: 40, mirrorH: true, mirrorV: false });
  assert.deepStrictEqual(out, {
    app: 'teleprompter',
    version: 1,
    text: 'olá',
    settings: { speed: 100, fontSize: 40, mirrorH: true, mirrorV: false }
  });
});

test('serializeState trata texto não-string', () => {
  const out = core.serializeState(null, {});
  assert.strictEqual(out.text, '');
});

test('parseImport aceita arquivo válido', () => {
  const json = JSON.stringify({ app: 'teleprompter', version: 1, text: 'roteiro', settings: { speed: 80, fontSize: 50, mirrorH: false, mirrorV: true } });
  const r = core.parseImport(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.text, 'roteiro');
  assert.deepStrictEqual(r.settings, { speed: 80, fontSize: 50, mirrorH: false, mirrorV: true });
});

test('parseImport rejeita JSON inválido', () => {
  const r = core.parseImport('{ isso não é json');
  assert.strictEqual(r.ok, false);
  assert.ok(typeof r.error === 'string' && r.error.length > 0);
});

test('parseImport rejeita arquivo de outro app', () => {
  const r = core.parseImport(JSON.stringify({ app: 'outra-coisa', text: 'x' }));
  assert.strictEqual(r.ok, false);
});

test('parseImport normaliza settings ausentes', () => {
  const r = core.parseImport(JSON.stringify({ app: 'teleprompter', version: 1, text: 'y' }));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.settings, core.DEFAULT_SETTINGS);
});
