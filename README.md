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
