const MAX_PROXY_BODY = 4.4 * 1024 * 1024;
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'content-length']);

module.exports = async function apiProxy(req, res) {
  const configuredOrigin = process.env.API_ORIGIN;
  if (!configuredOrigin) {
    res.statusCode = 503;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: { code: 'API_ORIGIN_MISSING', message: 'Set API_ORIGIN in the Vercel project environment.' } }));
  }

  let upstreamOrigin;
  try {
    upstreamOrigin = new URL(configuredOrigin);
    if (!['https:', 'http:'].includes(upstreamOrigin.protocol)) throw new Error('Unsupported API protocol');
  } catch {
    res.statusCode = 500;
    return res.end('API_ORIGIN must be a valid HTTP(S) origin.');
  }

  const target = new URL(req.url, upstreamOrigin.origin);
  if (target.origin !== upstreamOrigin.origin || !(target.pathname === '/api' || target.pathname.startsWith('/api/'))) {
    res.statusCode = 404;
    return res.end('Not found.');
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase()) || value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_PROXY_BODY) {
          res.statusCode = 413;
          res.setHeader('content-type', 'application/json');
          return res.end(JSON.stringify({ error: { code: 'REQUEST_TOO_LARGE', message: 'Upload must be smaller than 4 MB.' } }));
        }
        chunks.push(chunk);
      }
    } catch {
      res.statusCode = 400;
      return res.end('Unable to read request body.');
    }
    if (size) body = Buffer.concat(chunks, size);
  }

  try {
    const upstream = await fetch(target, { method: req.method, headers, body, redirect: 'manual' });
    res.statusCode = upstream.status;
    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP.has(key.toLowerCase()) || key.toLowerCase() === 'content-encoding') return;
      if (key.toLowerCase() === 'set-cookie' && typeof upstream.headers.getSetCookie === 'function') {
        res.setHeader('set-cookie', upstream.headers.getSetCookie());
      } else {
        res.setHeader(key, value);
      }
    });
    if (typeof upstream.headers.getSetCookie === 'function') {
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader('set-cookie', cookies);
    }
    const responseBody = Buffer.from(await upstream.arrayBuffer());
    res.end(responseBody);
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', event: 'api.proxy_failed', message: error.message }));
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'The booking service is temporarily unavailable.' } }));
  }
};

module.exports.config = { api: { bodyParser: false } };
