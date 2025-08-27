const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({ 'Cache-Control': 'no-store' }, headers));
  res.end(body);
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, '404 Not Found');
      } else {
        send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, '500 Internal Server Error');
      }
      return;
    }
    send(res, 200, { 'Content-Type': contentType }, data);
  });
}

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url);
    let pathname = decodeURI(parsed.pathname || '/');
    if (pathname === '/') pathname = '/index.html';
    // Prevent path traversal
    const safePath = path.normalize(pathname).replace(/^([\.\/\\])*$/, '/index.html').replace(/^([\.]{2,}[\/\\])+/g, '');
    const filePath = path.join(PUBLIC_DIR, safePath);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      send(res, 403, { 'Content-Type': 'text/plain; charset=utf-8' }, '403 Forbidden');
      return;
    }
    serveFile(filePath, res);
  } catch (e) {
    send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, '500 Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


