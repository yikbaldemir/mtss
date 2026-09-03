// Exercise the actual Vercel export with rewritten URLs and pre-parsed JSON bodies.
import http from 'node:http';
import handler from '../api/index.mjs';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    url.searchParams.set('route', url.pathname.slice(5));
    url.pathname = '/api/index';
    req.url = url.pathname + url.search;
  }
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    try { req.body = JSON.parse(raw); }
    catch { Object.defineProperty(req, 'body', { get() { throw new SyntaxError('Invalid JSON'); } }); }
  }
  await handler(req, res);
});
server.listen(0, '127.0.0.1', () => console.log(`http://localhost:${server.address().port}`));
