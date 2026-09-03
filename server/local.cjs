const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const handler = require('./handler.cjs');
const files = { '/': 'index.html', '/index.html': 'index.html', '/preview.html': 'index.html', '/app.js': 'app.js' };
const server = http.createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route.startsWith('/api/')) return handler(req, res);
  handler.setHeaders(res);
  if (!['GET', 'HEAD'].includes(req.method) || !files[route]) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Sayfa bulunamadı.');
  }
  res.setHeader('Content-Type', route === '/app.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  if (req.method === 'HEAD') return res.end();
  res.end(fs.readFileSync(path.join(__dirname, '..', 'public', files[route])));
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log(`MTSS: http://localhost:${server.address().port}`);
});
