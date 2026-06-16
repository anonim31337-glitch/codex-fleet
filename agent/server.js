#!/usr/bin/env node
/**
 * Codex-Fleet WebSocket relay server
 *
 * Machine agents (OMEN, VIVO) connect as ?role=agent and push system state.
 * Frontend clients connect as ?role=client and receive aggregated fleet state.
 *
 * Install:  npm install ws
 * Run:      node server.js
 * Expose:   cloudflared tunnel --url http://localhost:8765
 * Frontend: https://your-site.vercel.app?ws=wss://YOUR-TUNNEL.trycloudflare.com
 */

const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8765;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Codex-Fleet relay active\n');
});

const wss = new WebSocketServer({ server });

const fleet = {
  nodes: {},     // { OMEN: { cpu, mem, ts, online }, VIVO: { ... } }
  logs: [],      // ring buffer, last 30 lines
  handoff: null,
  iadsDone: 0,
  audit94: 0,
};

const clients = new Set();

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
    ts: new Date().toTimeString().slice(0, 8),
  };
}

function broadcast() {
  const msg = JSON.stringify(buildFleetState());
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const role = url.searchParams.get('role') || 'client';

  if (role === 'agent') {
    let myNode = null;

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.type !== 'agent_update') return;

      myNode = msg.node;
      fleet.nodes[myNode] = {
        cpu: msg.cpu ?? 0,
        mem: msg.mem ?? 0,
        ts: msg.ts || new Date().toTimeString().slice(0, 8),
        online: true,
      };
      if (msg.handoff)              fleet.handoff  = msg.handoff;
      if (msg.iadsDone !== undefined) fleet.iadsDone = msg.iadsDone;
      if (msg.audit94  !== undefined) fleet.audit94  = msg.audit94;
      addLogs(msg.logs);
      broadcast();
    });

    const markOffline = () => {
      if (myNode && fleet.nodes[myNode]) {
        fleet.nodes[myNode] = { ...fleet.nodes[myNode], online: false };
        broadcast();
      }
    };
    ws.on('close', markOffline);
    ws.on('error', markOffline);
    console.log('[relay] agent connected');

  } else {
    clients.add(ws);
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(buildFleetState()));
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
    console.log(`[relay] frontend connected (${clients.size} total)`);
  }
});

server.listen(PORT, () => {
  console.log(`\nCodex-Fleet relay  →  ws://localhost:${PORT}`);
  console.log(`Expose:   cloudflared tunnel --url http://localhost:${PORT}`);
  console.log(`Agents:   ws://localhost:${PORT}?role=agent`);
  console.log(`Frontend: ?ws=wss://YOUR-TUNNEL.trycloudflare.com\n`);
});
