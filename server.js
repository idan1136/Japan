const http = require('http');
const fs = require('fs');
const path = require('path');
const Planner = require('./js/planner.js');

const root = __dirname;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.csv': 'text/csv; charset=utf-8',
  '.webmanifest': 'application/manifest+json'
};

const stateFile = path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(root, 'data'), 'shared-state.json');
const emptyState = { checks: {}, customChecks: {}, restaurants: {}, food: {}, booked: {}, notes: {} };

function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (err) { return emptyState; }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const tmp = stateFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, stateFile);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/state') {
    cors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(readState()));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', function (chunk) {
        body += chunk;
        if (body.length > 500000) req.destroy();
      });
      req.on('end', function () {
        let incoming = emptyState;
        try { incoming = JSON.parse(body); } catch (err) { incoming = emptyState; }
        const merged = Planner.mergeShared(readState(), incoming);
        writeState(merged);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(merged));
      });
      return;
    }
    res.writeHead(405);
    res.end();
    return;
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  fs.readFile(file, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const type = types[path.extname(file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

server.listen(process.env.PORT || 3000, '0.0.0.0');
