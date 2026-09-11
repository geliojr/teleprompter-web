(function () {
  'use strict';

  var core = window.TeleprompterCore;
  var STORAGE_KEY = 'teleprompter-state';
  var FONT_STEP = 4;
  var SPEED_STEP = 10;
  // URL do proxy que puxa o texto de um Google Docs (deploy em gdocs-proxy/, Vercel).
  var GDOCS_PROXY = 'https://gdocs-proxy.vercel.app/api/gdoc';

  var el = {
    editor: document.getElementById('editor'),
    prompter: document.getElementById('prompter'),
    scriptInput: document.getElementById('script-input'),
    startBtn: document.getElementById('start-btn'),
    importBtn: document.getElementById('import-btn'),
    saveBtn: document.getElementById('save-btn'),
    fileInput: document.getElementById('file-input'),
    gdocsUrl: document.getElementById('gdocs-url'),
    gdocsBtn: document.getElementById('gdocs-btn'),
    message: document.getElementById('message'),
    scroller: document.getElementById('scroller'),
    scriptText: document.getElementById('script-text'),
    playBtn: document.getElementById('play-btn'),
    restartBtn: document.getElementById('restart-btn'),
    rewindBtn: document.getElementById('rewind-btn'),
    forwardBtn: document.getElementById('forward-btn'),
    speedDec: document.getElementById('speed-dec'),
    speedInc: document.getElementById('speed-inc'),
    speedValue: document.getElementById('speed-value'),
    fontDec: document.getElementById('font-dec'),
    fontInc: document.getElementById('font-inc'),
    mirrorH: document.getElementById('mirror-h'),
    mirrorV: document.getElementById('mirror-v'),
    fullscreenBtn: document.getElementById('fullscreen-btn'),
    editBtn: document.getElementById('edit-btn'),
    viewport: document.getElementById('viewport'),
    exitImmersiveBtn: document.getElementById('exit-immersive'),
    seekbar: document.getElementById('seekbar'),
    seekFill: document.getElementById('seek-fill')
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
  var maxScroll = 0; // altura rolável do texto; recalculada só quando muda (não a cada frame)
  var DRAG_THRESHOLD = 8; // px de movimento para diferenciar arrasto de toque
  var drag = { active: false, moved: false, startY: 0, startOffset: 0, wasPlaying: false };

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
    updateSpeedDisplay();
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
  function showPrompter(autoplay) {
    el.scriptText.textContent = el.scriptInput.value;
    applyFontSize();
    applyMirror();
    el.editor.classList.add('hidden');
    el.prompter.classList.remove('hidden');
    recomputeMaxScroll();
    resetScroll();
    if (autoplay !== false) play(); // o clique em "Iniciar" passa o evento (autoplay); a carga por URL passa false
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
    updateSeek();
  }

  // ---- Barra de progresso / navegação (seek) ----
  // "Progresso de leitura" (0..1). Com espelho vertical o offset é invertido,
  // então o progresso é medido a partir do fim.
  function readingProgress() {
    if (maxScroll <= 0) return 0;
    var p = settings.mirrorV ? (maxScroll - offset) : offset;
    if (p < 0) p = 0;
    if (p > maxScroll) p = maxScroll;
    return p / maxScroll;
  }

  function updateSeek() {
    el.seekFill.style.height = (readingProgress() * 100) + '%';
  }

  function seekToClientY(clientY) {
    if (maxScroll <= 0) return;
    var rect = el.seekbar.getBoundingClientRect();
    var frac = rect.height ? (clientY - rect.top) / rect.height : 0;
    frac = Math.max(0, Math.min(1, frac));
    var p = frac * maxScroll;
    offset = settings.mirrorV ? (maxScroll - p) : p;
    applyOffset();
  }

  // Sentido da rolagem: com espelho vertical (scaleY(-1)) o texto fica invertido,
  // então a rolagem precisa ir ao contrário — começa no fim e diminui — para o
  // roteiro ser lido do começo para o fim, e não de trás para frente.
  function scrollDirection() { return settings.mirrorV ? -1 : 1; }
  function scrollStartOffset() { return settings.mirrorV ? maxScroll : 0; }
  function atScrollEnd() { return settings.mirrorV ? (offset <= 0) : (offset >= maxScroll); }

  function resetScroll() {
    offset = scrollStartOffset();
    applyOffset();
  }

  // Empurra o texto para trás (dir -1) ou para frente (dir +1) por ~30% da tela.
  // Serve para achar o ponto sem depender de gesto (que no mobile recarrega a página).
  function nudge(dir) {
    var step = el.viewport.clientHeight * 0.3;
    // dir: +1 = avançar no roteiro, -1 = voltar. scrollDirection ajusta ao espelho vertical.
    offset = core.clamp(offset + dir * scrollDirection() * step, 0, maxScroll);
    applyOffset();
  }

  // ---- Arrastar para rolar (dedo/mouse na área do texto) ----
  function onDragStart(e) {
    drag.active = true;
    drag.moved = false;
    drag.startY = e.clientY;
    drag.startOffset = offset;
    drag.wasPlaying = playing;
    if (el.viewport.setPointerCapture) {
      try { el.viewport.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function onDragMove(e) {
    if (!drag.active) return;
    var dy = e.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      drag.moved = true;
      if (playing) pause(); // suspende a rolagem automática enquanto arrasta
    }
    // Arrastar para cima avança (offset sobe); para baixo volta.
    offset = core.clamp(drag.startOffset - dy, 0, maxScroll);
    applyOffset();
  }

  function onDragEnd(e) {
    if (!drag.active) return;
    drag.active = false;
    if (el.viewport.releasePointerCapture && e.pointerId != null) {
      try { el.viewport.releasePointerCapture(e.pointerId); } catch (err) {}
    }
    if (drag.moved && drag.wasPlaying) play(); // se estava tocando, continua do novo ponto
  }

  function onViewportClick() {
    if (drag.moved) { drag.moved = false; return; } // foi arrasto, não toque
    if (immersive) togglePlay();
  }

  // ---- Arrastar/tocar a barra de seek para pular pelo texto ----
  var seeking = { active: false, wasPlaying: false };
  function onSeekStart(e) {
    seeking.active = true;
    seeking.wasPlaying = playing;
    if (playing) pause();
    if (el.seekbar.setPointerCapture) { try { el.seekbar.setPointerCapture(e.pointerId); } catch (err) {} }
    seekToClientY(e.clientY);
  }
  function onSeekMove(e) {
    if (!seeking.active) return;
    seekToClientY(e.clientY);
  }
  function onSeekEnd(e) {
    if (!seeking.active) return;
    seeking.active = false;
    if (el.seekbar.releasePointerCapture && e.pointerId != null) { try { el.seekbar.releasePointerCapture(e.pointerId); } catch (err) {} }
    if (seeking.wasPlaying) play();
  }

  function recomputeMaxScroll() {
    maxScroll = el.scriptText.offsetHeight;
    updateSeek();
  }

  function frame(ts) {
    if (!playing) return;
    if (!lastTs) lastTs = ts;
    var delta = ts - lastTs;
    lastTs = ts;
    offset = core.nextOffset(offset, scrollDirection() * settings.speed, delta);
    if (atScrollEnd()) {
      offset = settings.mirrorV ? 0 : maxScroll;
      applyOffset();
      pause();
      return;
    }
    applyOffset();
    rafId = requestAnimationFrame(frame);
  }

  function play() {
    if (playing) return;
    if (atScrollEnd()) resetScroll(); // já no fim: recomeça do início em vez de virar botão morto
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
  function updateSpeedDisplay() {
    el.speedValue.textContent = String(settings.speed);
  }

  function changeSpeed(delta) {
    settings.speed = core.clamp(settings.speed + delta, core.LIMITS.speed.min, core.LIMITS.speed.max);
    updateSpeedDisplay();
    save();
  }

  function changeFont(delta) {
    settings.fontSize = core.clamp(settings.fontSize + delta, core.LIMITS.fontSize.min, core.LIMITS.fontSize.max);
    applyFontSize();
    recomputeMaxScroll();
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
    // Mantém a mesma linha no centro ao inverter (o sentido da rolagem também vira).
    offset = maxScroll - offset;
    applyMirror();
    applyOffset();
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

  // ---- Importar do Google Docs (link) ----
  // Aceita a URL completa do documento ou o ID cru.
  function extractDocId(input) {
    if (!input) return null;
    var m = /\/document\/d\/([a-zA-Z0-9_-]{20,})/.exec(input);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{20,}$/.test(input)) return input;
    return null;
  }

  // Busca o texto de um doc pelo ID via proxy. Retorna uma Promise que resolve com
  // o texto (e já preenche o editor) ou rejeita com uma mensagem amigável.
  function fetchDoc(id) {
    return fetch(GDOCS_PROXY + '?id=' + encodeURIComponent(id)).then(function (r) {
      if (r.ok) {
        return r.text().then(function (text) {
          el.scriptInput.value = text;
          save();
          return text;
        });
      }
      return r.json().then(
        function (data) { throw new Error((data && data.error) || 'Não foi possível importar o documento.'); },
        function () { throw new Error('Não foi possível importar o documento.'); }
      );
    });
  }

  function importFromGoogleDocs() {
    var id = extractDocId(el.gdocsUrl.value.trim());
    if (!id) {
      showMessage('Link do Google Docs inválido. Cole a URL completa do documento.');
      return;
    }
    showMessage('Puxando do Google Docs...');
    el.gdocsBtn.disabled = true;
    fetchDoc(id)
      .then(function () { showMessage('Texto importado do Google Docs.'); })
      .catch(function (e) { showMessage(e.message || 'Falha ao acessar o Google Docs.'); })
      .then(function () { el.gdocsBtn.disabled = false; });
  }

  // ---- Link do Google Docs pela URL do teleprompter (?doc=...) ----
  // Aceita ?doc=<link>, ?url=<link>, um link cru após ?, ou o mesmo via #hash.
  function docIdFromLocation() {
    var tries = [];
    try {
      var params = new URLSearchParams(location.search);
      ['doc', 'url', 'gdoc'].forEach(function (k) {
        var v = params.get(k);
        if (v) tries.push(v);
      });
    } catch (e) {}
    tries.push(location.search.replace(/^\?/, ''));
    tries.push(location.hash.replace(/^#/, ''));
    tries.push(location.search + location.hash);
    var all = tries.slice();
    tries.forEach(function (t) { try { all.push(decodeURIComponent(t)); } catch (e) {} });
    for (var i = 0; i < all.length; i++) {
      var id = extractDocId(all[i]);
      if (id) return id;
    }
    return null;
  }

  function loadDocFromUrlIfPresent() {
    var id = docIdFromLocation();
    if (!id) return;
    showMessage('Carregando roteiro do Google Docs...');
    fetchDoc(id)
      .then(function () {
        showMessage('');
        showPrompter(false); // vai direto ao prompter, pausado no topo, pronto para tocar
      })
      .catch(function (e) {
        showMessage(e.message || 'Não consegui carregar o Google Docs do link. Verifique o compartilhamento.');
      });
  }

  // ---- Ligações ----
  function bind() {
    el.scriptInput.addEventListener('input', function () { showMessage(''); save(); });
    el.startBtn.addEventListener('click', showPrompter);
    el.editBtn.addEventListener('click', showEditor);
    el.playBtn.addEventListener('click', togglePlay);
    el.restartBtn.addEventListener('click', resetScroll);
    el.rewindBtn.addEventListener('click', function () { nudge(-1); });
    el.forwardBtn.addEventListener('click', function () { nudge(1); });
    el.speedDec.addEventListener('click', function () { changeSpeed(-SPEED_STEP); });
    el.speedInc.addEventListener('click', function () { changeSpeed(SPEED_STEP); });
    el.fontDec.addEventListener('click', function () { changeFont(-FONT_STEP); });
    el.fontInc.addEventListener('click', function () { changeFont(FONT_STEP); });
    el.mirrorH.addEventListener('click', toggleMirrorH);
    el.mirrorV.addEventListener('click', toggleMirrorV);
    el.fullscreenBtn.addEventListener('click', toggleFullscreen);
    el.exitImmersiveBtn.addEventListener('click', exitImmersive);
    // Arrastar (dedo/mouse) na área do texto rola o teleprompter.
    el.viewport.addEventListener('pointerdown', onDragStart);
    el.viewport.addEventListener('pointermove', onDragMove);
    el.viewport.addEventListener('pointerup', onDragEnd);
    el.viewport.addEventListener('pointercancel', onDragEnd);
    el.seekbar.addEventListener('pointerdown', onSeekStart);
    el.seekbar.addEventListener('pointermove', onSeekMove);
    el.seekbar.addEventListener('pointerup', onSeekEnd);
    el.seekbar.addEventListener('pointercancel', onSeekEnd);
    // No modo imersivo (controles escondidos) tocar na tela pausa/retoma — vale no celular.
    el.viewport.addEventListener('click', onViewportClick);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    // Ao girar/redimensionar, o texto re-quebra e muda de altura: recalcula.
    window.addEventListener('resize', function () {
      if (!el.prompter.classList.contains('hidden')) recomputeMaxScroll();
    });
    el.saveBtn.addEventListener('click', download);
    el.importBtn.addEventListener('click', function () { el.fileInput.click(); });
    el.gdocsBtn.addEventListener('click', importFromGoogleDocs);
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
    updateSpeedDisplay();
    applyFontSize();
    applyMirror();
    updateMirrorButtons();
    loadDocFromUrlIfPresent();
  }

  init();
})();
