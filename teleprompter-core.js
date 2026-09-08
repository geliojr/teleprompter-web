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

  return {
    APP_ID: APP_ID,
    FORMAT_VERSION: FORMAT_VERSION,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    LIMITS: LIMITS,
    clamp: clamp,
    toNumber: toNumber,
    nextOffset: nextOffset,
    buildMirrorTransform: buildMirrorTransform
  };
});
