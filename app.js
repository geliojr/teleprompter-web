(function () {
  'use strict';

  var core = window.TeleprompterCore;
  var STORAGE_KEY = 'teleprompter-state';
  var FONT_STEP = 4;

  var el = {
    editor: document.getElementById('editor'),
    prompter: document.getElementById('prompter'),
    scriptInput: document.getElementById('script-input'),
    startBtn: document.getElementById('start-btn'),
    importBtn: document.getElementById('import-btn'),
    saveBtn: document.getElementById('save-btn'),
    fileInput: document.getElementById('file-input'),
    message: document.getElementById('message'),
    scroller: document.getElementById('scroller'),
    scriptText: document.getElementById('script-text'),
    playBtn: document.getElementById('play-btn'),
    restartBtn: document.getElementById('restart-btn'),
    speedRange: document.getElementById('speed-range'),
    fontDec: document.getElementById('font-dec'),
    fontInc: document.getElementById('font-inc'),
    mirrorH: document.getElementById('mirror-h'),
    mirrorV: document.getElementById('mirror-v'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    editBtn: document.getElementById('edit-btn'),
    viewport: document.getElementById('viewport'),
    exitImmersiveBtn: document.getElementById('exit-immersive')
  };

  var settings = {
    speed: core.DEFAULT_SETTINGS.speed,
    fontSize: core.DEFAULT_SETTINGS.fontSize,
    mirrorH: core.DEFAULT_SETTINGS.mirrorH,
    mirrorV: core.DEFAULT_SETTINGS.mirrorV
  };
  var offset = 0;
  var playing = false;
  var rafId = null;
  var lastTs = 0;
  var immersive = false;

  // ---- Persistência ----
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(core.serializeState(el.scriptInput.value, settings)));
    } catch (e) { /* modo privado / quota: ignora */ }
  }

  function load() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) { stored = null; }
    if (!stored) return;
    var result = core.parseImport(stored);
    if (result.ok) applyState(result.text, result.settings);
  }

  // ---- Aplicar estado na UI ----
  function applyState(text, newSettings) {
    el.scriptInput.value = text;
    el.scriptText.textContent = text;
    settings.speed = newSettings.speed;
    settings.fontSize = newSettings.fontSize;
    settings.mirrorH = newSettings.mirrorH;
    settings.mirrorV = newSettings.mirrorV;
    el.speedRange.value = String(settings.speed);
    applyFontSize();
    applyMirror();
    updateMirrorButtons();
  }

  function applyFontSize() {
    el.scriptText.style.fontSize = settings.fontSize + 'px';
  }

  function applyMirror() {
    el.scriptText.style.transform = core.buildMirrorTransform(settings.mirrorH, settings.mirrorV);
  }

  function updateMirrorButtons() {
    el.mirrorH.classList.toggle('active', settings.mirrorH);
    el.mirrorV.classList.toggle('active', settings.mirrorV);
  }

  // ---- Troca de view ----
  function showPrompter() {
    el.scriptText.textContent = el.scriptInput.value;
    applyFontSize();
    applyMirror();
    el.editor.classList.add('hidden');
    el.prompter.classList.remove('hidden');
    resetScroll();
    play();
  }

  function showEditor() {
    exitImmersive();
    pause();
    el.prompter.classList.add('hidden');
    el.editor.classList.remove('hidden');
  }

  // ---- Motor de rolagem ----
  function applyOffset() {
    el.scroller.style.transform = 'translateY(' + (-offset) + 'px)';
  }

  function resetScroll() {
    offset = 0;
    applyOffset();
  }

  function maxOffset() {
    return el.scriptText.offsetHeight;
  }

  function frame(ts) {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    var delta = ts - lastTs;
    lastTs = ts;
    offset = core.nextOffset(offset, settings.speed, delta);
    if (offset >= maxOffset()) {
      offset = maxOffset();
      applyOffset();
      pause();
      return;
    }
    applyOffset();
    rafId = requestAnimationFrame(frame);
  }

  function play() {
    if (playing) return;
    playing = true;
    lastTs = 0;
    el.playBtn.textContent = '⏸';
    rafId = requestAnimationFrame(frame);
  }

  function pause() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    el.playBtn.textContent = '▶';
  }

  function togglePlay() {
    if (playing) pause(); else play();
  }

  // ---- Controles ----
  function setSpeed(value) {
    settings.speed = core.clamp(core.toNumber(value, core.DEFAULT_SETTINGS.speed), core.LIMITS.speed.min, core.LIMITS.speed.max);
    save();
  }

  function changeFont(delta) {
    settings.fontSize = core.clamp(settings.fontSize + delta, core.LIMITS.fontSize.min, core.LIMITS.fontSize.max);
    applyFontSize();
    save();
  }

  function toggleMirrorH() {
    settings.mirrorH = !settings.mirrorH;
    applyMirror();
    updateMirrorButtons();
    save();
  }

  function toggleMirrorV() {
    settings.mirrorV = !settings.mirrorV;
    applyMirror();
    updateMirrorButtons();
    save();
  }

  // ---- Tela cheia / modo imersivo ----
  // A barra de controles some e o texto ocupa a tela toda (via CSS: funciona em
  // qualquer navegador, inclusive iOS). Por cima, tentamos o fullscreen real do
  // SO onde houver suporte (esconde a barra do navegador). Se a API não existir
  // ou for recusada, o modo imersivo por CSS garante a experiência mesmo assim.
  function fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function requestFs(node) {
    if (node.requestFullscreen) return node.requestFullscreen();
    if (node.webkitRequestFullscreen) return node.webkitRequestFullscreen();
    return null;
  }

  function exitFs() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    return null;
  }

  function enterImmersive() {
    if (immersive) return;
    immersive = true;
    el.prompter.classList.add('immersive');
    var p = requestFs(el.prompter);
    if (p && typeof p.catch === 'function') { p.catch(function () {}); }
  }

  function exitImmersive() {
    if (!immersive) return;
    immersive = false;
    el.prompter.classList.remove('immersive');
    if (fsElement()) { try { exitFs(); } catch (e) {} }
  }

  function toggleFullscreen() {
    if (immersive) exitImmersive(); else enterImmersive();
  }

  // Sai do modo imersivo se o fullscreen do SO for encerrado por fora (ex.: Esc).
  function onFullscreenChange() {
    if (!fsElement() && immersive) exitImmersive();
  }

  // ---- Salvar / Importar ----
  function download() {
    var data = JSON.stringify(core.serializeState(el.scriptInput.value, settings), null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'teleprompter-' + date + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = core.parseImport(String(reader.result));
      if (!result.ok) { showMessage(result.error); return; }
      applyState(result.text, result.settings);
      save();
      showMessage('Roteiro importado com sucesso.');
    };
    reader.onerror = function () { showMessage('Não foi possível ler o arquivo.'); };
    reader.readAsText(file);
  }

  function showMessage(text) {
    el.message.textContent = text;
  }

  // ---- Ligações ----
  function bind() {
    el.scriptInput.addEventListener('input', function () { showMessage(''); save(); });
    el.startBtn.addEventListener('click', showPrompter);
    el.editBtn.addEventListener('click', showEditor);
    el.playBtn.addEventListener('click', togglePlay);
    el.restartBtn.addEventListener('click', resetScroll);
    el.speedRange.addEventListener('input', function (e) { setSpeed(e.target.value); });
    el.fontDec.addEventListener('click', function () { changeFont(-FONT_STEP); });
    el.fontInc.addEventListener('click', function () { changeFont(FONT_STEP); });
    el.mirrorH.addEventListener('click', toggleMirrorH);
    el.mirrorV.addEventListener('click', toggleMirrorV);
    el.fullscreenBtn.addEventListener('click', toggleFullscreen);
    el.exitImmersiveBtn.addEventListener('click', exitImmersive);
    // No modo imersivo (controles escondidos) tocar na tela pausa/retoma — vale no celular.
    el.viewport.addEventListener('click', function () { if (immersive) togglePlay(); });
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    el.saveBtn.addEventListener('click', download);
    el.importBtn.addEventListener('click', function () { el.fileInput.click(); });
    el.fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) importFile(file);
      e.target.value = '';
    });
    document.addEventListener('keydown', function (e) {
      if (el.prompter.classList.contains('hidden')) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'Escape' && immersive) { exitImmersive(); }
    });
  }

  // ---- Init ----
  function init() {
    bind();
    load();
    el.speedRange.value = String(settings.speed);
    applyFontSize();
    applyMirror();
    updateMirrorButtons();
  }

  init();
})();
