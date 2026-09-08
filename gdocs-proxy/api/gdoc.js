// Proxy CORS para puxar o texto de um Google Docs compartilhado por link.
//
// O navegador não consegue buscar docs.google.com direto (sem CORS + redireciona
// para outro host). Esta função busca o export?format=txt no servidor e devolve o
// texto com os cabeçalhos CORS, para o teleprompter conseguir ler.
//
// Segurança: só aceita um ID de documento (regex), então nunca vira um proxy
// aberto — ele sempre bate apenas na URL de export do Google Docs.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const id = String((req.query && req.query.id) || '').trim();
  if (!/^[a-zA-Z0-9_-]{20,120}$/.test(id)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'ID de documento inválido.' }));
    return;
  }

  const url = 'https://docs.google.com/document/d/' + id + '/export?format=txt';

  try {
    const upstream = await fetch(url, { redirect: 'follow' });
    const contentType = upstream.headers.get('content-type') || '';
    let body = await upstream.text();

    // Documento privado: o Google devolve uma página HTML de login em vez do texto.
    const looksLikeLogin =
      contentType.includes('text/html') ||
      /^\s*<!doctype html/i.test(body) ||
      body.includes('accounts.google.com');

    if (!upstream.ok || looksLikeLogin) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        error: 'Documento não acessível. Compartilhe como "Qualquer pessoa com o link".'
      }));
      return;
    }

    // Remove BOM inicial, se houver.
    if (body.charCodeAt(0) === 0xfeff) body = body.slice(1);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(body);
  } catch (e) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Falha ao buscar o documento.' }));
  }
};
