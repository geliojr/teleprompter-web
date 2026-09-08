# Teleprompter Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página web estática que transforma um texto em teleprompter, com rolagem de velocidade ajustável, espelho horizontal/vertical, salvar/importar roteiro em `.json` e persistência no navegador, publicada no GitHub Pages.

**Architecture:** App 100% client-side, sem framework e sem build. A lógica pura (matemática de rolagem, montagem de transform, serialização/validação de arquivo) fica num módulo `teleprompter-core.js` sem dependências de DOM, testável com o runner nativo do Node. A camada de integração (`app.js`) faz DOM, eventos, loop `requestAnimationFrame`, localStorage, Fullscreen e download/upload de arquivo. `index.html` + `styles.css` compõem a UI (tema escuro).

**Tech Stack:** HTML5, CSS3, JavaScript (ES5/ES2015 puro, sem módulos ES para funcionar via `file://` e GitHub Pages). Testes com `node --test` (runner embutido, sem dependências). Deploy no GitHub Pages.

## Global Constraints

- Sem dependências de runtime, sem framework, sem etapa de build. Só HTML/CSS/JS estáticos.
- Nenhum arquivo de teste ou de dev é servido em produção; o Pages serve a raiz.
- `teleprompter-core.js` NÃO pode referenciar `document`, `window` para lógica (só o wrapper UMD toca `global`), para rodar no Node.
- Interface em PT-BR. Tema escuro/minimalista.
- Scripts carregados como scripts clássicos (`<script src=...>`), NÃO `type="module"` — precisa abrir via `file://` também.
- Formato do arquivo exportado/importado, exato:
  ```json
  { "app": "teleprompter", "version": 1, "text": "...", "settings": { "speed": 60, "fontSize": 48, "mirrorH": false, "mirrorV": false } }
  ```
- Espelho: `↔` = `scaleX(-1)` (esquerda↔direita), `↕` = `scaleY(-1)` (cima↕baixo), independentes.
- Deploy: repositório `geliojr/teleprompter-web`, branch `main`, GitHub Pages na raiz. O branch local já faz track de `origin/main`, então `git push` publica em `main`.

---

## File Structure

- `teleprompter-core.js` — Criar. Funções puras + constantes, wrapper UMD (Node `require` / browser `window.TeleprompterCore`).
- `test/core-math.test.js` — Criar. Testes de `clamp`, `toNumber`, `nextOffset`, `buildMirrorTransform`.
- `test/core-io.test.js` — Criar. Testes de `normalizeSettings`, `serializeState`, `parseImport`.
- `index.html` — Criar. Estrutura: view editor + view prompter + controles.
- `styles.css` — Criar. Tema escuro, layout do editor e do prompter.
- `app.js` — Criar. Integração: estado, persistência, troca de view, loop de rolagem, controles, save/import.
- `README.md` — Criar. Uso, como rodar local, como testar, deploy.

---

## Task 1: Core — funções matemáticas (TDD)

**Files:**
- Create: `teleprompter-core.js`
- Test: `test/core-math.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `clamp(value: number, min: number, max: number) -> number`
  - `toNumber(value: any, fallback: number) -> number` (retorna `value` numérico finito, senão `fallback`)
  - `nextOffset(offsetPx: number, speedPxPerSec: number, deltaMs: number) -> number`
  - `buildMirrorTransform(mirrorH: boolean, mirrorV: boolean) -> string` (`""`, `"scaleX(-1)"`, `"scaleY(-1)"`, ou `"scaleX(-1) scaleY(-1)"`)
  - Constantes: `APP_ID = "teleprompter"`, `FORMAT_VERSION = 1`, `DEFAULT_SETTINGS = {speed:60,fontSize:48,mirrorH:false,mirrorV:false}`, `LIMITS = {speed:{min:0,max:400}, fontSize:{min:16,max:160}}`
  - Módulo exposto como `window.TeleprompterCore` (browser) e `module.exports` (Node).

- [ ] **Step 1: Verificar Node disponível**

Run: `node --version`
Expected: imprime uma versão (v18+ tem `node --test` e `node:test`). Se falhar, instalar Node antes de continuar.

- [ ] **Step 2: Escrever o teste que falha**

Create `test/core-math.test.js`:

```js
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `node --test`
Expected: FAIL — `Cannot find module '../teleprompter-core.js'`.

- [ ] **Step 4: Implementar o mínimo em `teleprompter-core.js`**

Create `teleprompter-core.js`:

```js
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
```

- [ ] **Step 5: Rodar e ver passar**

Run: `node --test`
Expected: PASS — todos os testes de `core-math.test.js` verdes.

- [ ] **Step 6: Commit**

```bash
git add teleprompter-core.js test/core-math.test.js
git commit -m "feat: funções puras de rolagem e espelho do teleprompter"
```

---

## Task 2: Core — serialização/validação de arquivo (TDD)

**Files:**
- Modify: `teleprompter-core.js` (adicionar funções e incluí-las no objeto retornado)
- Test: `test/core-io.test.js`

**Interfaces:**
- Consumes: `APP_ID`, `FORMAT_VERSION`, `DEFAULT_SETTINGS`, `LIMITS`, `clamp`, `toNumber` (Task 1).
- Produces:
  - `normalizeSettings(raw: any) -> {speed:number, fontSize:number, mirrorH:boolean, mirrorV:boolean}` (aplica defaults + clamp + Boolean)
  - `serializeState(text: any, settings: any) -> {app, version, text, settings}` (objeto pronto para `JSON.stringify`)
  - `parseImport(jsonText: string) -> {ok:true, text:string, settings:object} | {ok:false, error:string}`

- [ ] **Step 1: Escrever o teste que falha**

Create `test/core-io.test.js`:

```js
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test`
Expected: FAIL — `core.normalizeSettings is not a function` (e demais).

- [ ] **Step 3: Implementar no `teleprompter-core.js`**

Adicionar as três funções ANTES do `return`, logo depois de `buildMirrorTransform`:

```js
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
```

Substituir o objeto `return` para incluir as novas funções:

```js
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test`
Expected: PASS — testes de `core-math.test.js` e `core-io.test.js` verdes.

- [ ] **Step 5: Commit**

```bash
git add teleprompter-core.js test/core-io.test.js
git commit -m "feat: serialização e validação de roteiro (.json) do teleprompter"
```

---

## Task 3: UI estática — `index.html` + `styles.css`

**Files:**
- Create: `index.html`
- Create: `styles.css`

**Interfaces:**
- Consumes: `teleprompter-core.js` (carregado, mas usado só na Task 4).
- Produces (IDs que a Task 4 consome): `editor`, `prompter`, `script-input`, `start-btn`, `import-btn`, `save-btn`, `file-input`, `message`, `scroller`, `script-text`, `play-btn`, `restart-btn`, `speed-range`, `font-dec`, `font-inc`, `mirror-h`, `mirror-v`, `fullscreen-btn`, `edit-btn`.

- [ ] **Step 1: Criar `index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Teleprompter</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <main id="app">
    <section id="editor" class="view">
      <h1>Teleprompter</h1>
      <textarea id="script-input" placeholder="Cole ou digite seu roteiro aqui..."></textarea>
      <div class="editor-actions">
        <button id="start-btn" class="primary" type="button">Iniciar ▶</button>
        <button id="import-btn" type="button">📂 Importar .json</button>
        <button id="save-btn" type="button">💾 Salvar .json</button>
      </div>
      <p id="message" class="message" role="alert" aria-live="polite"></p>
      <input type="file" id="file-input" accept="application/json,.json" hidden>
    </section>

    <section id="prompter" class="view hidden">
      <div id="viewport">
        <div id="scroller">
          <div id="script-text"></div>
        </div>
      </div>
      <div id="controls">
        <button id="play-btn" type="button" title="Play/Pausa (espaço)">▶</button>
        <button id="restart-btn" type="button" title="Reiniciar do topo">⟳</button>
        <label>Velocidade
          <input type="range" id="speed-range" min="0" max="400" step="5">
        </label>
        <button id="font-dec" type="button" title="Diminuir fonte">A-</button>
        <button id="font-inc" type="button" title="Aumentar fonte">A+</button>
        <button id="mirror-h" type="button" title="Espelhar esquerda↔direita">↔</button>
        <button id="mirror-v" type="button" title="Espelhar cima↕baixo">↕</button>
        <button id="fullscreen-btn" type="button" title="Tela cheia">⛶</button>
        <span class="spacer"></span>
        <button id="edit-btn" type="button" title="Voltar a editar">✏️ Editar</button>
      </div>
    </section>
  </main>

  <script src="teleprompter-core.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Criar `styles.css`**

```css
:root {
  --bg: #0b0b0d;
  --panel: #16161a;
  --fg: #f5f5f5;
  --muted: #9aa0a6;
  --accent: #4f8cff;
  --border: #2a2a30;
}
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body {
  background: var(--bg);
  color: var(--fg);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.hidden { display: none !important; }
.view { height: 100vh; }

/* Editor */
#editor {
  max-width: 820px;
  margin: 0 auto;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
#editor h1 { margin: 0; font-size: 24px; font-weight: 600; }
#script-input {
  flex: 1;
  min-height: 40vh;
  resize: vertical;
  background: var(--panel);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  font-size: 18px;
  line-height: 1.5;
}
.editor-actions { display: flex; gap: 10px; flex-wrap: wrap; }
button {
  background: var(--panel);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 15px;
  cursor: pointer;
}
button:hover { border-color: var(--accent); }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.message { color: var(--muted); min-height: 20px; margin: 0; }

/* Prompter */
#prompter { position: relative; display: flex; flex-direction: column; background: #000; }
#viewport { flex: 1; overflow: hidden; position: relative; }
#scroller {
  position: absolute;
  top: 0; left: 0; right: 0;
  will-change: transform;
  padding: 50vh 6vw;
}
#script-text {
  font-size: 48px;
  line-height: 1.4;
  font-weight: 600;
  white-space: pre-wrap;
  word-wrap: break-word;
  text-align: center;
  transform-origin: center center;
}
#controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--panel);
  border-top: 1px solid var(--border);
}
#controls label { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 14px; }
#controls input[type="range"] { width: 160px; }
#controls .spacer { flex: 1; }
```

- [ ] **Step 3: Verificar no navegador**

Run (num terminal, na raiz do projeto): `python3 -m http.server 8000`
Depois abrir `http://localhost:8000/` no navegador (ou via Chrome DevTools MCP `new_page`).
Expected:
- Tela escura com título "Teleprompter", textarea grande e três botões (Iniciar, Importar, Salvar).
- A view do prompter está oculta (só o editor visível).
- Nenhum erro no console.

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: UI estática do teleprompter (editor + prompter, tema escuro)"
```

---

## Task 4: Integração — `app.js`

**Files:**
- Create: `app.js`

**Interfaces:**
- Consumes: `window.TeleprompterCore` (todas as funções/constantes das Tasks 1–2) e os IDs da Task 3.
- Produces: comportamento interativo completo (não é consumido por outra task de código; a Task 5 só documenta/deploya).

- [ ] **Step 1: Criar `app.js` completo**

```js
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
    editBtn: document.getElementById('edit-btn')
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

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el.prompter.requestFullscreen) {
      el.prompter.requestFullscreen();
    }
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
```

- [ ] **Step 2: Verificar no navegador (fluxo principal)**

Run: `python3 -m http.server 8000` (na raiz), abrir `http://localhost:8000/`.
Fazer e conferir:
- Digitar/colar um texto longo (várias linhas) → clicar **Iniciar**. A view muda para o prompter e o texto começa a **rolar de baixo para cima** automaticamente.
- **▶/⏸**: pausa e retoma a rolagem. Barra de espaço também pausa/retoma.
- **⟳**: volta o texto ao topo.
- **Velocidade**: mover o slider muda a velocidade em tempo real; no 0 o texto para de andar.
- **✏️ Editar**: volta ao editor com o texto preservado.
- Nenhum erro no console.

- [ ] **Step 3: Verificar espelho, fonte e tela cheia**

Ainda no prompter:
- **↔**: o texto inverte esquerda↔direita (fica "espelhado" na horizontal) e o botão fica destacado. Clicar de novo desativa.
- **↕**: o texto inverte cima↕baixo e o botão fica destacado.
- **↔ + ↕** juntos: ambos aplicados.
- **A- / A+**: diminuem/aumentam o tamanho do texto.
- **⛶**: entra em tela cheia; `Esc` sai.

- [ ] **Step 4: Verificar persistência**

- Ajustar velocidade e fonte, escrever um texto, recarregar a página (F5).
- Expected: o texto e as preferências (velocidade/fonte/espelhos) voltam como estavam.

- [ ] **Step 5: Verificar salvar e importar**

- No editor, clicar **💾 Salvar .json** → baixa `teleprompter-AAAA-MM-DD.json`. Abrir o arquivo e conferir o formato (`app`, `version`, `text`, `settings`).
- Apagar o texto, mudar velocidade/fonte, clicar **📂 Importar .json** e escolher o arquivo baixado.
- Expected: texto e configurações são restaurados; aparece "Roteiro importado com sucesso."
- Importar um arquivo `.json` qualquer inválido (ex.: `{"x":1}`) → aparece a mensagem de erro e a página **não quebra**.

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: interatividade do teleprompter (rolagem, espelho, fonte, tela cheia, salvar/importar)"
```

---

## Task 5: README + deploy no GitHub Pages

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: repositório `geliojr/teleprompter-web` já criado, remote `origin`, branch local track de `origin/main`.
- Produces: site publicado em `https://geliojr.github.io/teleprompter-web/`.

- [ ] **Step 1: Criar `README.md`**

```markdown
# Teleprompter Web

Página web que transforma um texto em teleprompter. Cole o roteiro, ajuste a
velocidade, espelhe na horizontal/vertical e coloque em tela cheia. Tudo roda
no navegador — nenhum texto é enviado para servidores.

**Online:** https://geliojr.github.io/teleprompter-web/

## Funcionalidades

- Rolagem automática com velocidade ajustável (play/pausa, reiniciar).
- Espelhar horizontal (↔) e vertical (↕), independentes — para uso com vidro/beam-splitter.
- Tamanho de fonte ajustável e modo tela cheia.
- Salvar o roteiro + configurações em arquivo `.json` e importar de volta.
- Persistência automática no navegador (localStorage).

## Uso local

Abra `index.html` no navegador, ou sirva a pasta:

```
python3 -m http.server 8000
# acesse http://localhost:8000/
```

## Testes

Funções puras (`teleprompter-core.js`) são testadas com o runner nativo do Node:

```
node --test
```

## Estrutura

- `index.html` / `styles.css` — interface (tema escuro).
- `teleprompter-core.js` — lógica pura (rolagem, espelho, serialização).
- `app.js` — integração com DOM, eventos e navegador.
- `test/` — testes das funções puras.

## Atalhos

- **Espaço**: play/pausa (no modo prompter).
```

- [ ] **Step 2: Commit e push**

```bash
git add README.md
git commit -m "docs: README do teleprompter web"
git push
```
Expected: push para `origin/main` sem erro.

- [ ] **Step 3: Habilitar GitHub Pages (main, raiz)**

```bash
gh api --method POST repos/geliojr/teleprompter-web/pages -f "source[branch]=main" -f "source[path]=/"
```
Expected: JSON com o status da página. Se retornar 409 (já existe), seguir. Se o token não tiver permissão, habilitar manualmente em GitHub → Settings → Pages → Source: `main` / `/ (root)`.

- [ ] **Step 4: Verificar publicação**

Aguardar ~1–2 min e checar:

```bash
gh api repos/geliojr/teleprompter-web/pages --jq '.html_url,.status'
curl -s -o /dev/null -w "%{http_code}\n" https://geliojr.github.io/teleprompter-web/
```
Expected: `status` = `built` e HTTP `200`. Abrir a URL e confirmar que o teleprompter carrega e funciona (rolagem + espelho).

---

## Self-Review (feito na escrita do plano)

- **Cobertura do spec:** rolagem+velocidade (Task 4), espelho H/V (Tasks 1/4), tamanho de fonte (Task 4), tela cheia (Task 4), salvar/importar `.json` (Tasks 2/4), persistência localStorage (Task 4), UI escura PT-BR (Task 3), deploy GitHub Pages (Task 5). Terminologia de espelho documentada com ícones explícitos. Sem lacunas.
- **Placeholders:** nenhum "TBD/TODO"; todo código presente.
- **Consistência de tipos/nomes:** IDs do HTML (Task 3) batem com `el.*` (Task 4); funções `core.*` batem com as assinaturas das Tasks 1–2 (`clamp`, `toNumber`, `nextOffset`, `buildMirrorTransform`, `normalizeSettings`, `serializeState`, `parseImport`, `DEFAULT_SETTINGS`, `LIMITS`).

---

## Fase 2 — Trabalho futuro (NÃO implementar agora)

> Estas funcionalidades **não** fazem parte da implementação atual (Fase 1). Elas
> exigem um brainstorm + spec próprios antes de virar tarefas, porque **mudam a
> arquitetura**. Esta seção é um registro de intenção, não um plano executável.

### O que se quer

1. **Histórico da sessão** — lista dos roteiros usados/salvos (com data e um
   trecho do texto), permitindo reabrir um roteiro anterior.
2. **Conta por usuário via Google** — login com a conta Google (OAuth 2.0 /
   OpenID Connect).
3. **Histórico por usuário** — para quem está logado, o histórico é salvo e
   sincronizado (acessível de qualquer dispositivo), não só no navegador local.

### Impacto arquitetural (o ponto crítico)

A Fase 1 é **100% estática, sem backend** — por isso cabe no GitHub Pages e o
texto nunca sai do navegador. A Fase 2 **quebra essas duas premissas**:

- Login Google + histórico por usuário exigem **autenticação** e um lugar para
  **guardar dados por usuário** (backend + banco de dados).
- O GitHub Pages **só serve arquivos estáticos** — não hospeda API nem banco.
  Logo, a Fase 2 precisa de hospedagem adicional/diferente.
- Guardar o conteúdo dos roteiros no servidor levanta **privacidade/LGPD**
  (hoje o texto é só local); precisa de política de dados e consentimento.

### Caminho recomendado (a validar no brainstorm da Fase 2)

- **BaaS** (Backend-as-a-Service) para não manter servidor próprio: o front
  continua estático e fala direto com o serviço.
  - Opção A: **Firebase** (Auth com Google + Firestore) — rápido de integrar.
  - Opção B: **Supabase** (Auth com Google + Postgres) — SQL, open-source.
- Front pode continuar no GitHub Pages **ou** migrar para Vercel/Firebase
  Hosting (a decidir conforme o BaaS).
- **Histórico local primeiro:** o "histórico da sessão" pode existir só com
  localStorage antes de haver login — entrega valor sem backend e serve de base
  para a sincronização depois.

### Questões em aberto para o brainstorm da Fase 2

- O histórico guarda o texto inteiro ou só metadados (título/data)?
- Anônimo (local) + logado (nuvem) coexistem? Como faz o merge ao logar?
- Limite de itens no histórico? Apagar item / limpar histórico?
- Onde hospedar (mantém Pages + BaaS, ou migra tudo)? Custo esperado?
- Tratamento de LGPD: privacidade, exclusão de conta e de dados.

### Sugestão de sequência

1. Fase 2a — **Histórico local** (localStorage), sem login. Incremento pequeno
   sobre a Fase 1, ainda estático.
2. Fase 2b — **Login com Google + sincronização** do histórico via BaaS. Aqui
   entra o backend; precisa do seu próprio spec.
