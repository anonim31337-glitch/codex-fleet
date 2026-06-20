#!/usr/bin/env node
/**
 * Codex-Fleet WebSocket relay + static UI server
 *
 *  - Serves the built frontend (../frontend/dist) over HTTP, so the whole panel
 *    lives behind ONE port / ONE tunnel. The browser connects its WebSocket back
 *    to the same origin automatically — no ?ws= juggling needed.
 *  - Machine agents (OMEN, VIVO) connect with ?role=agent and push CPU/RAM.
 *  - Frontend clients receive aggregated fleet state and can enqueue prompt rows.
 *
 * Install:  npm install            (deps: ws)
 * Run:      node server.js
 * Expose:   cloudflared tunnel --url http://localhost:8765
 * Open on phone: the printed *.trycloudflare.com URL — that's it.
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8765;
const DIST_DIR = path.join(__dirname, '..', 'frontend', 'dist');
const QUEUE_FILE = path.join(__dirname, 'queue.txt');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// ── static file server (built frontend) ──────────────────────────────────────
function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // resolve safely inside DIST_DIR
  const filePath = path.normalize(path.join(DIST_DIR, urlPath));
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403); res.end('forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback → index.html (so deep links work)
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (e2, html) => {
        if (e2) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Codex-Fleet relay active. Build the frontend (npm run build) to serve the UI here.\n');
        } else {
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(html);
        }
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(serveStatic);
const wss = new WebSocketServer({ server });

// ── fleet state ───────────────────────────────────────────────────────────────
const fleet = {
  nodes: {},     // { OMEN: { cpu, mem, ts, online }, VIVO: { ... } }
  logs: [],      // ring buffer, last 30 lines (REAL events)
  handoff: null,
  iadsDone: 0,
  audit94: 0,
  audit94Scan: 0,
  queueCount: 0,
  queueTail: [],
};

const clients = new Set();

function ts() { return new Date().toTimeString().slice(0, 8); }

function log(line) {
  fleet.logs = [...fleet.logs, `[${ts()}] ${line}`].slice(-30);
  console.log('[relay]', line);
}

function loadQueue() {
  try {
    const txt = fs.readFileSync(QUEUE_FILE, 'utf8');
    const lines = txt.split(/\r?\n/).filter((l) => l.trim().length);
    fleet.queueCount = lines.length;
    fleet.queueTail = lines.slice(-5);
  } catch (e) {
    fleet.queueCount = 0;
    fleet.queueTail = [];
  }
}

function addToQueue(str) {
  fs.appendFileSync(QUEUE_FILE, str + '\n');
  loadQueue();
}

function addLogs(lines) {
  if (!Array.isArray(lines) || !lines.length) return;
  fleet.logs = [...fleet.logs, ...lines].slice(-30);
}

function buildFleetState() {
  return {
    type: 'fleet_state',
    nodes: fleet.nodes,
    logs: fleet.logs.slice(-12),
    handoff: fleet.handoff,
    iadsDone: fleet.iadsDone,
    audit94: fleet.audit94,
    audit94Scan: fleet.audit94Scan,
    queueCount: fleet.queueCount,
    queueTail: fleet.queueTail,
    ts: ts(),
  };
}

function broadcast() {
  const msg = JSON.stringify(buildFleetState());
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

// ── connections ────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const role = url.searchParams.get('role') || 'client';

  if (role === 'agent') {
    let myNode = null;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.type !== 'agent_update') return;

      const first = !fleet.nodes[msg.node] || !fleet.nodes[msg.node].online;
      myNode = msg.node;
      fleet.nodes[myNode] = {
        cpu: msg.cpu ?? 0,
        mem: msg.mem ?? 0,
        ts: msg.ts || ts(),
        online: true,
      };
      if (msg.handoff)                 fleet.handoff     = msg.handoff;
      if (msg.iadsDone !== undefined)  fleet.iadsDone    = msg.iadsDone;
      if (msg.audit94  !== undefined)  fleet.audit94     = msg.audit94;
      if (msg.audit94Scan !== undefined) fleet.audit94Scan = msg.audit94Scan;
      addLogs(msg.logs);
      if (first) log(`node ${myNode} ONLINE :: cpu ${fleet.nodes[myNode].cpu}% mem ${fleet.nodes[myNode].mem}%`);
      broadcast();
    });

    const markOffline = () => {
      if (myNode && fleet.nodes[myNode]) {
        fleet.nodes[myNode] = { ...fleet.nodes[myNode], online: false };
        log(`node ${myNode} OFFLINE`);
        broadcast();
      }
    };
    ws.on('close', markOffline);
    ws.on('error', markOffline);
    log('agent connected');

  } else {
    clients.add(ws);
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(buildFleetState()));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'generate_row' && typeof msg.str === 'string' && msg.str.trim()) {
          addToQueue(msg.str.trim());
          log(`queued row #${fleet.queueCount} :: ${msg.str.slice(0, 48)}…`);
          broadcast();
        }
      } catch (err) {}
    });
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
    log(`frontend connected (${clients.size} client${clients.size === 1 ? '' : 's'})`);
  }
});

loadQueue();
log(`queue loaded :: ${fleet.queueCount} row(s)`);

server.listen(PORT, () => {
  const hasUi = fs.existsSync(path.join(DIST_DIR, 'index.html'));
  console.log(`\nCodex-Fleet relay  →  http://localhost:${PORT}`);
  console.log(`UI served:  ${hasUi ? 'YES (frontend/dist)' : 'NO — run "npm run build" in ../frontend'}`);
  console.log(`Expose:     cloudflared tunnel --url http://localhost:${PORT}`);
  console.log(`Agents:     ws://localhost:${PORT}?role=agent\n`);
});
