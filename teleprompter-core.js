(function (global, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.TeleprompterCore = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var APP_ID = 'teleprompter';
  var FORMAT_VERSION = 1;
  var DEFAULT_SETTINGS = { speed: 60, fontSize: 48, mirrorH: false, mirrorV: false };
  var LIMITS = {
    speed: { min: 0, max: 400 },
    fontSize: { min: 16, max: 160 }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function nextOffset(offsetPx, speedPxPerSec, deltaMs) {
    return offsetPx + (speedPxPerSec * deltaMs) / 1000;
  }

  function buildMirrorTransform(mirrorH, mirrorV) {
    var parts = [];
    if (mirrorH) parts.push('scaleX(-1)');
    if (mirrorV) parts.push('scaleY(-1)');
    return parts.join(' ');
  }

  function normalizeSettings(raw) {
    var s = (raw && typeof raw === 'object') ? raw : {};
    return {
      speed: clamp(toNumber(s.speed, DEFAULT_SETTINGS.speed), LIMITS.speed.min, LIMITS.speed.max),
      fontSize: clamp(toNumber(s.fontSize, DEFAULT_SETTINGS.fontSize), LIMITS.fontSize.min, LIMITS.fontSize.max),
      mirrorH: Boolean(s.mirrorH),
      mirrorV: Boolean(s.mirrorV)
    };
  }

  function serializeState(text, settings) {
    return {
      app: APP_ID,
      version: FORMAT_VERSION,
      text: typeof text === 'string' ? text : '',
      settings: normalizeSettings(settings)
    };
  }

  function parseImport(jsonText) {
    var data;
    try {
      data = JSON.parse(jsonText);
    } catch (e) {
      return { ok: false, error: 'Arquivo não é um JSON válido.' };
    }
    if (!data || typeof data !== 'object' || data.app !== APP_ID) {
      return { ok: false, error: 'Este arquivo não é um roteiro de teleprompter válido.' };
    }
    return {
      ok: true,
      text: typeof data.text === 'string' ? data.text : '',
      settings: normalizeSettings(data.settings)
    };
  }

  return {
    APP_ID: APP_ID,
    FORMAT_VERSION: FORMAT_VERSION,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    LIMITS: LIMITS,
    clamp: clamp,
    toNumber: toNumber,
    nextOffset: nextOffset,
    buildMirrorTransform: buildMirrorTransform,
    normalizeSettings: normalizeSettings,
    serializeState: serializeState,
    parseImport: parseImport
  };
});
