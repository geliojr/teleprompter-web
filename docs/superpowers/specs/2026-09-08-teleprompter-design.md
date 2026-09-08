# Teleprompter Web — Design

**Data:** 2026-09-08
**Status:** Aprovado

## Objetivo

Página web que recebe um texto e o transforma em um teleprompter, disponível
online (GitHub Pages). Permite espelhar o texto (horizontal e vertical),
controlar a velocidade da rolagem, ajustar tamanho de fonte, salvar/importar
roteiros em arquivo `.json` e persiste o estado no navegador.

## Premissas

- Aplicação **100% client-side**: sem backend, sem framework, sem build. O texto
  nunca sai do navegador do usuário.
- Hospedagem: **GitHub Pages** (serve arquivos estáticos como estão).
- Idioma da interface: **PT-BR**.
- Visual: **escuro e minimalista** (padrão de teleprompters profissionais).

## Arquitetura

Três arquivos estáticos na raiz do repositório:

- `index.html` — estrutura da página e dos controles.
- `styles.css` — estilos (tema escuro, layout do editor e do prompter).
- `app.js` — lógica: rolagem, espelhamento, persistência, export/import.

Sem dependências externas. Abrir `index.html` no navegador já funciona.

## Interface — dois estados na mesma página

1. **Editor:** um `textarea` grande para colar/escrever o roteiro + botão
   **"Iniciar"**. Também acessível: importar arquivo.
2. **Prompter:** área central com o texto rolando e uma **barra de controles**
   na base. Botão **"Editar"** volta ao editor.

## Controles (barra do prompter)

- **▶ / ⏸ Play/Pausa** — inicia/pausa a rolagem.
- **⟳ Reiniciar** — volta o texto ao topo.
- **Velocidade** — slider; rolagem medida em px/segundo (independente da taxa de
  quadros do monitor).
- **A- / A+ Fonte** — diminui/aumenta o tamanho do texto.
- **↔ Espelhar horizontal** — inverte esquerda↔direita (`scaleX(-1)`); modo
  clássico para vidro/beam-splitter de teleprompter.
- **↕ Espelhar vertical** — inverte cima↕baixo (`scaleY(-1)`).
- **⛶ Tela cheia** — Fullscreen API.
- **💾 Salvar** — exporta `.json` (roteiro + configurações).
- **📂 Importar** — carrega `.json` e restaura o estado.

### Nota sobre terminologia de espelho

"Espelhar horizontal/vertical" é ambíguo entre pessoas. Aqui são tratados como
**dois flips independentes**, com rótulos/ícones explícitos:

- `↔` = inverte esquerda-direita (`scaleX(-1)`).
- `↕` = inverte cima-baixo (`scaleY(-1)`).

Os dois podem ser ativados simultaneamente.

## Mecânica principal

### Rolagem automática

- `requestAnimationFrame` translada o conteúdo de texto para cima via
  `translateY`, usando **delta time** para velocidade constante em qualquer
  monitor.
- Play/pausa liga/desliga o loop; reiniciar zera a posição.
- Velocidade em px/segundo controlada pelo slider.

### Espelhamento

- Transforms CSS combinados aplicados a um wrapper do texto.
- **Observação honesta:** o flip vertical (`↕`) também inverte visualmente o
  sentido da rolagem — isso é inerente a virar o conteúdo de cabeça para baixo.
  Os rótulos deixam claro o efeito de cada botão.

### Persistência automática (localStorage)

- Salva o texto e as preferências (velocidade, fonte, espelhos) a cada mudança.
- Ao reabrir a página, restaura o último estado.

### Export / Import (`.json`)

Formato do arquivo:

```json
{
  "app": "teleprompter",
  "version": 1,
  "text": "seu roteiro...",
  "settings": { "speed": 60, "fontSize": 48, "mirrorH": false, "mirrorV": false }
}
```

- **Salvar:** baixa `teleprompter-AAAA-MM-DD.json` com roteiro + configurações.
- **Importar:** lê o `.json` e restaura texto + configurações. Se o arquivo for
  inválido ou fora do formato esperado, exibe um aviso e **não quebra** a página
  (o estado atual é preservado).

## Organização do código (funções puras testáveis)

Isolar em funções puras (sem efeitos colaterais) para clareza e testabilidade:

- Cálculo de deslocamento por velocidade e delta time.
- Montagem da string de `transform` a partir do estado de espelhos.
- Serialização do estado para `.json` (export).
- Parse/validação de um `.json` importado (retorna estado válido ou erro).

O restante (DOM, eventos, rAF loop) fica na camada de integração.

## Verificação

Projeto pequeno; a verificação proporcional é **no navegador** (via Chrome
DevTools): checar rolagem, controle de velocidade, ambos os espelhos, fonte,
tela cheia e o ciclo salvar→importar. Testes unitários das funções puras são
opcionais e podem ser adicionados se desejado.

## Hospedagem / deploy

- Repositório no **GitHub pessoal** do usuário.
- GitHub Pages servindo a raiz (branch principal), tornando a página pública.

## Fora de escopo (YAGNI)

- Contas de usuário / sincronização em nuvem.
- Edição rica (markdown, formatação), múltiplos roteiros salvos na nuvem.
- Controle remoto por outro dispositivo.
