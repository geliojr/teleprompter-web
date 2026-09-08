# Teleprompter Web

Página web que transforma um texto em teleprompter. Cole o roteiro, ajuste a
velocidade, espelhe na horizontal/vertical e coloque em tela cheia. Tudo roda
no navegador — nenhum texto é enviado para servidores.

**Online:** https://geliojr.github.io/teleprompter-web/

## Funcionalidades

- Rolagem automática com velocidade ajustável (play/pausa, reiniciar).
- Voltar/avançar o texto por botões (⏪/⏩) ou arrastando com o dedo/mouse na área do texto.
- Espelhar horizontal (↔) e vertical (↕), independentes — para uso com vidro/beam-splitter.
- Tamanho de fonte ajustável e modo tela cheia (imersivo, funciona no mobile).
- Salvar o roteiro + configurações em arquivo `.json` e importar de volta.
- Importar de um link do **Google Docs** (documento compartilhado como "qualquer pessoa com o link").
- Persistência automática no navegador (localStorage).

## Google Docs

O botão "Puxar do Google Docs" busca o texto de um documento **compartilhado por
link**. Como o navegador não consegue ler `docs.google.com` diretamente (sem CORS),
existe um pequeno proxy serverless em `gdocs-proxy/` (Vercel) que busca o
`export?format=txt` e devolve com CORS. Ele só aceita IDs de documento, então nunca
vira um proxy aberto. Documentos **privados** não são suportados por este caminho
(exigiriam login Google/OAuth).

Para (re)publicar o proxy:

```
cd gdocs-proxy
vercel --prod
```

A URL do proxy usada pelo app fica em `app.js` (`GDOCS_PROXY`).

### Abrir por link direto (parâmetro na URL)

Dá para abrir o teleprompter já com um roteiro do Google Docs, passando o link no
parâmetro `?doc=` — útil para mandar para outro aparelho:

```
https://geliojr.github.io/teleprompter-web/?doc=<link-do-google-docs>
```

Exemplo:

```
https://geliojr.github.io/teleprompter-web/?doc=https://docs.google.com/document/d/SEU_ID/edit
```

O app puxa o texto e vai direto para o prompter (pausado no topo, pronto para tocar).
Também aceita o link cru após `?` e o mesmo via `#`. O documento precisa estar
compartilhado como "qualquer pessoa com o link".

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
