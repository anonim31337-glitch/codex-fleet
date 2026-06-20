import React from 'react';
import './App.css';

const WS_DEFAULT_PORT = 8765;

// Resolve the relay WebSocket URL.
//  1. ?ws=... explicit override (back-compat with old deploys)
//  2. VITE_WS_URL baked at build time — used for the GitHub Pages build, where the
//     page origin (github.io) is NOT the relay, so it must point at the ngrok tunnel.
//  3. same-origin when the page is served over http/https (relay serves the UI too —
//     e.g. http://localhost:8765 or the ngrok domain that fronts the relay)
//  4. ws://localhost:8765 fallback when opened as a local file
function resolveWsUrl() {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get('ws');
  if (explicit) return explicit;
  const baked = import.meta.env.VITE_WS_URL;
  if (baked) return baked;
  const loc = window.location;
  if (loc.protocol === 'http:' || loc.protocol === 'https:') {
    const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${loc.host}`;
  }
  return `ws://localhost:${WS_DEFAULT_PORT}`;
}

class App extends React.Component {
  state = {
    now: new Date(),
    boot: Date.now(),
    isNetworkLive: false,      // true while the WebSocket is connected
    radarAngle: 0,
    bridgeKbs: 0,              // real count of fleet updates received
    // OMEN / VIVO node rows — load/mem/online filled live from the relay
    nodes: [
      { name: "OMEN", load: 0, mem: 0, online: false },
      { name: "VIVO", load: 0, mem: 0, online: false },
    ],
    handoff: null,             // handoff JSON pushed by an agent, if any
    audit94: 0,
    audit94Scan: 0,
    iadsDone: 0,
    extRate: 0,
    auditLogs: [],             // real relay log lines
    blips: [],
    rows: [
      { lens: 0, light: 0, music: 0, motion: 0, seed: "0x7F" },
      { lens: 1, light: 2, music: 1, motion: 7, seed: "0x12" },
      { lens: 2, light: 1, music: 3, motion: 6, seed: "0x9A" },
      { lens: 0, light: 2, music: 0, motion: 3, seed: "0x44" },
      { lens: 3, light: 0, music: 4, motion: 1, seed: "0x21" },
      { lens: 4, light: 1, music: 3, motion: 6, seed: "0xBE" },
      { lens: 0, light: 2, music: 1, motion: 4, seed: "0x58" },
      { lens: 1, light: 4, music: 2, motion: 5, seed: "0x0D" },
    ],
    selRow: 0,
    bpm: 124,
    queueCount: 0,             // real queue length from the relay
    queueTail: [],             // last queued strings (real)
    copied: false,
    staged: false,
  };

  OPTS = {
    lens: ["85mm f/1.8", "35mm f/2.0", "135mm f/2", "50mm f/1.4", "24mm f/4"],
    light: ["RIM 3200K", "KEY 5600K", "PRACT NEON", "FILL -1.5", "BACKLIT"],
    music: ["SYNTHWAVE", "EPIC TAVERN FOLK", "90s PL HIP-HOP", "EPIC ORCH", "DRONE PAD"],
    motion: ["DOLLY-IN", "PAN-R", "PAN-L", "ORBIT", "STATIC", "CRANE", "PUSH", "HANDHELD"],
  };

  componentDidMount() {
    // Ambient clock + radar sweep. Real fleet data arrives over the socket.
    this.fast = setInterval(() => {
      this.setState((s) => {
        if (!s.isNetworkLive) return { now: new Date() };
        const blips = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => {
          const a = Math.random() * Math.PI * 2;
          const rr = 8 + Math.random() * 38;
          return { x: (50 + Math.cos(a) * rr).toFixed(1), y: (50 + Math.sin(a) * rr).toFixed(1), col: Math.random() < 0.6 ? '#28E07B' : 'rgba(255,255,255,0.5)' };
        });
        return { now: new Date(), radarAngle: (s.radarAngle + 0.22) % (Math.PI * 2), blips };
      });
    }, 130);

    this.connect();
  }

  componentWillUnmount() {
    clearInterval(this.fast);
    this._closing = true;
    if (this.ws) try { this.ws.close(); } catch (e) {}
  }

  // ── WebSocket relay client ────────────────────────────────────────────────
  connect = () => {
    const url = resolveWsUrl();
    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 1500;
      this.setState({ isNetworkLive: true });
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type !== 'fleet_state') return;
      this.applyFleet(msg);
    };

    ws.onclose = () => {
      this.setState((s) => ({
        isNetworkLive: false,
        nodes: s.nodes.map((n) => ({ ...n, online: false, load: 0, mem: 0 })),
      }));
      if (!this._closing) this.scheduleReconnect();
    };

    ws.onerror = () => { try { ws.close(); } catch (e) {} };
  };

  scheduleReconnect = () => {
    this.backoff = Math.min((this.backoff || 1500) * 1.6, 15000);
    clearTimeout(this._rc);
    this._rc = setTimeout(this.connect, this.backoff);
  };

  // Map the relay's fleet_state onto our view model.
  applyFleet = (msg) => {
    this.setState((s) => {
      const srvNodes = msg.nodes || {};
      const nodes = s.nodes.map((n) => {
        const sn = srvNodes[n.name];
        if (!sn) return { ...n, online: false, load: 0, mem: 0 };
        return { ...n, online: !!sn.online, load: sn.cpu ?? 0, mem: sn.mem ?? 0 };
      });
      return {
        bridgeKbs: (s.bridgeKbs + 1) % 100000,
        nodes,
        handoff: msg.handoff ?? null,
        audit94: typeof msg.audit94 === 'number' ? msg.audit94 : 0,
        audit94Scan: typeof msg.audit94Scan === 'number' ? msg.audit94Scan : 0,
        iadsDone: typeof msg.iadsDone === 'number' ? msg.iadsDone : 0,
        extRate: typeof msg.extRate === 'number' ? msg.extRate : 0,
        auditLogs: Array.isArray(msg.logs) ? msg.logs.slice(-12) : s.auditLogs,
        queueCount: typeof msg.queueCount === 'number' ? msg.queueCount : s.queueCount,
        queueTail: Array.isArray(msg.queueTail) ? msg.queueTail : s.queueTail,
      };
    });
  };

  send = (obj) => {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    return false;
  };

  // ── prompt tracker ────────────────────────────────────────────────────────
  cycle = (rowIdx, key) => {
    this.setState((s) => {
      const opts = this.OPTS[key];
      const rows = s.rows.map((r, i) => (i === rowIdx ? { ...r, [key]: (r[key] + 1) % opts.length } : r));
      return { rows, selRow: rowIdx };
    });
  };

  buildString = (r) => {
    return "SCENE_PROMPT :: cinematic shot, " + this.OPTS.lens[r.lens] + " lens, " + this.OPTS.light[r.light] +
      " lighting, " + this.OPTS.motion[r.motion].toLowerCase().replace("-", " ") + " camera move, scored with " +
      this.OPTS.music[r.music] + "; anamorphic flare, 35mm film grain, high-contrast low-key, volumetric haze, seed " + r.seed;
  };

  copyOut = () => {
    const r = this.state.rows[this.state.selRow];
    const str = this.buildString(r);
    try { navigator.clipboard && navigator.clipboard.writeText(str); } catch (e) {}
    this.setState({ copied: true });
    clearTimeout(this._cp);
    this._cp = setTimeout(() => this.setState({ copied: false }), 1500);
  };

  pad = (n) => { return n.toString().padStart(2, "0"); };
  hex = (n) => { return n.toString(16).toUpperCase().padStart(2, "0"); };

  segs = (pct, n, jitter) => {
    const accent = "#28E07B";
    const lit = Math.round((pct / 100) * n) + (jitter && pct > 0 ? (Math.random() < 0.4 ? -1 : 0) : 0);
    return Array.from({ length: n }, (_, i) => ({ col: i < lit ? accent : "rgba(255,255,255,0.08)" }));
  };

  // STAGE ROW → push the built prompt string to the REAL backend queue.
  commit = () => {
    const r = this.state.rows[this.state.selRow];
    const str = this.buildString(r);
    const ok = this.send({ type: 'generate_row', str });
    if (ok) {
      this.setState({ staged: true });
      clearTimeout(this._st);
      this._st = setTimeout(() => this.setState({ staged: false }), 1500);
    } else {
      // not connected — surface it instead of silently faking success
      this.setState({ staged: false });
      alert('Brak połączenia z relayem — kolejka niezapisana. Sprawdź czy server.js działa.');
    }
  };

  render() {
    const s = this.state;
    const accent = "#28E07B";
    const offline = "#E5484D";
    const live = s.isNetworkLive;
    const statusColor = live ? accent : offline;

    const d = s.now;
    const clock = this.pad(d.getHours()) + ":" + this.pad(d.getMinutes()) + ":" + this.pad(d.getSeconds());
    const upS = Math.floor((Date.now() - s.boot) / 1000);
    const uptime = "UP " + this.pad(Math.floor(upS / 3600)) + ":" + this.pad(Math.floor(upS / 60) % 60) + ":" + this.pad(upS % 60);

    const rx = live ? 50 + Math.cos(s.radarAngle) * 46 : 50;
    const ry = live ? 50 + Math.sin(s.radarAngle) * 46 : 50;

    const onlineNames = s.nodes.filter((n) => n.online).map((n) => n.name);
    const handoffJson = s.handoff
      ? JSON.stringify(s.handoff, null, 2)
      : (live
        ? '{\n  "orchestrator": "KAPITAN-PLANETA",\n  "status": ' + (onlineNames.length ? '"ONLINE"' : '"WAITING"') + ',\n  "nodes": ' + JSON.stringify(onlineNames) + ',\n  "ts": "' + clock + '"\n}'
        : '{\n  "orchestrator": "KAPITAN-PLANETA",\n  "status": "DISCONNECTED",\n  "nodes": [],\n  "relay": null\n}');

    const trackerRows = s.rows.map((r, i) => {
      const sel = i === s.selRow;
      return {
        step: this.hex(i),
        lens: this.OPTS.lens[r.lens],
        light: this.OPTS.light[r.light],
        music: this.OPTS.music[r.music],
        motion: this.OPTS.motion[r.motion],
        seed: r.seed,
        bg: sel ? accent + "1A" : "transparent",
        edge: sel ? accent : "rgba(255,255,255,0.06)",
        stepCol: sel ? accent : "rgba(255,255,255,0.4)",
        selectRow: () => this.setState({ selRow: i }),
        cycleLens: () => this.cycle(i, "lens"),
        cycleLight: () => this.cycle(i, "light"),
        cycleMusic: () => this.cycle(i, "music"),
        cycleMotion: () => this.cycle(i, "motion"),
      };
    });

    const selR = s.rows[s.selRow];

    const grainOpacity = 0.07;
    const header = "OMNI";
    const uplinkLabel = live ? "LIVE" : "OFFLINE";
    const bridgeState = live ? "LISTENING" : "OFFLINE";
    const orchState = live
      ? (onlineNames.length ? ("PRIMARY // " + onlineNames.length + " NODE" + (onlineNames.length > 1 ? "S" : "") + " ONLINE") : "RELAY UP // NO NODES YET")
      : "WAITING FOR RELAY...";
    const watchLabel = live ? "WATCH" : "IDLE";
    const radarX = rx.toFixed(1);
    const radarY = ry.toFixed(1);

    const nodes = s.nodes.map((n) => ({
      name: n.name,
      loadLabel: n.online ? (n.load + "% · " + n.mem + "% RAM") : "[OFFLINE]",
      col: n.online ? accent : offline,
      segs: this.segs(n.online ? n.load : 0, 22, n.online),
    }));

    const bulkLabel = live ? "BULK OPS" : "STANDBY";
    const bulkColor = live ? "#E8A33C" : "rgba(255,255,255,0.4)";
    const hasAudit = s.audit94 > 0;
    const hasIads = s.iadsDone > 0;
    const audit94Label = hasAudit ? s.audit94.toFixed(1) + "%" : "--";
    const audit94Segs = this.segs(s.audit94, 32, hasAudit);
    const audit94Scan = hasAudit ? s.audit94Scan.toLocaleString() + " / 18,600" : "standby";
    const iadsLabel = hasIads ? ((s.iadsDone / 16384) * 100).toFixed(1) + "%" : "--";
    const iadsSegs = this.segs(hasIads ? (s.iadsDone / 16384) * 100 : 0, 32, hasIads);
    const iadsShort = hasIads ? s.iadsDone.toLocaleString() + "/16,384" : "STANDBY";
    const extRate = s.extRate ? s.extRate.toFixed(4) : "0.0000";
    const auditLogs = (s.auditLogs && s.auditLogs.length)
      ? s.auditLogs
      : [live ? "[OK]   relay connected :: awaiting node telemetry" : "WAITING FOR RELAY UPLINK ..."];
    const auditCmd = live ? "tail -f relay :: fleet_state" : "awaiting relay — start server.js";
    const selHex = this.hex(s.selRow);
    const bpm = s.bpm;
    const outputString = this.buildString(selR);
    const selLens = this.OPTS.lens[selR.lens];
    const selLight = this.OPTS.light[selR.light];
    const selMusic = this.OPTS.music[selR.music];
    const copyLabel = s.copied ? "COPIED" : "COPY";
    const copyBg = s.copied ? accent : "transparent";
    const copyFg = s.copied ? "#000" : "#ECECEC";
    const stageLabel = s.staged ? "QUEUED ✓" : "STAGE ROW";
    const queueCount = this.pad(s.queueCount);

    return (
<div style={{ position: 'relative', minHeight: '100vh', width: '100%', background: '#000000', color: '#ECECEC', fontFamily: '\'IBM Plex Mono\', monospace', overflow: 'hidden', padding: 'clamp(14px, 2vw, 28px)' }}>

  {/* FILM GRAIN */}
  <svg width="0" height="0" style={{position:'absolute'}} aria-hidden="true">
    <filter id="cfNoise3"><feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="2" stitchTiles="stitch" result="n"></feTurbulence><feColorMatrix in="n" type="saturate" values="0"></feColorMatrix></filter>
  </svg>
  <div style={{ position: 'fixed', inset: 0, zIndex: 9, pointerEvents: 'none', mixBlendMode: 'screen', opacity: grainOpacity }}>
    <svg width="100%" height="100%" preserveAspectRatio="none"><rect width="100%" height="100%" filter="url(#cfNoise3)"></rect></svg>
  </div>
  <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: 'clamp(36px,4vw,60px) clamp(36px,4vw,60px)' }}></div>

  {/* TOP STRIP */}
  <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,0.9vw,14px)', padding: 'clamp(8px,0.9vw,12px) clamp(12px,1.3vw,20px)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
      <svg width="14" height="14" viewBox="0 0 14 14"><rect x="0.5" y="0.5" width="13" height="13" fill="none" stroke={statusColor}></rect><rect x="3.5" y="3.5" width="7" height="7" fill={statusColor}></rect></svg>
      <span style={{ fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.28em', textTransform: 'uppercase' }}>CODEX‑FLEET</span>
      <span style={{ fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.28em', color: 'rgba(255,255,255,0.34)' }}>// OMNI‑TERMINAL</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: 'clamp(8px,0.9vw,12px) clamp(12px,1.3vw,20px)', borderLeft: '1px solid rgba(255,255,255,0.1)', fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.5)' }}>UPLINK&nbsp;<span style={{ color: statusColor }}>{uplinkLabel}</span></div>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'clamp(8px,0.9vw,12px) clamp(12px,1.3vw,20px)', borderLeft: '1px solid rgba(255,255,255,0.1)', fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.2em', minWidth: '11ch', justifyContent: 'flex-end' }}>{clock}</div>
    </div>
  </div>

  {/* KINETIC HEADLINE */}
  <div style={{ position: 'relative', zIndex: 2, border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: 'clamp(10px,1.3vw,22px) clamp(12px,1.3vw,20px) clamp(4px,0.5vw,8px)', overflow: 'hidden' }}>
    <div style={{ fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.34em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', marginBottom: 'clamp(2px,0.4vw,6px)' }}>COMMS&nbsp;BRIDGE&nbsp;·&nbsp;DATA&nbsp;AUDIT&nbsp;·&nbsp;PROMPT&nbsp;ENGINEERING</div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 'clamp(10px,1.5vw,26px)', width: '124vw', whiteSpace: 'nowrap', lineHeight: 0.82 }}>
      <span style={{ fontFamily: '\'Instrument Serif\', serif', fontStyle: 'italic', fontSize: 'clamp(54px, 12.4vw, 218px)', letterSpacing: '-0.02em', color: '#F4F4F2' }}>{header}</span>
      <span style={{ fontFamily: '\'IBM Plex Mono\', monospace', fontSize: 'clamp(11px,1vw,16px)', letterSpacing: '0.18em', color: accent, alignSelf: 'flex-end', paddingBottom: 'clamp(8px,1vw,20px)' }}>// TERMINAL</span>
      <span style={{ fontFamily: '\'Instrument Serif\', serif', fontSize: 'clamp(38px, 7.4vw, 140px)', letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.12)' }}>FLEET</span>
    </div>
  </div>

  {/* MODULE GRID */}
  <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'auto auto', gap: 'clamp(10px,1.1vw,16px)', border: '1px solid rgba(255,255,255,0.1)', padding: 'clamp(10px,1.1vw,16px)' }}>

    {/* ============ MODULE 01 : COMMS BRIDGE ============ */}
    <section style={{ gridColumn: '1 / 6', gridRow: '1 / 2', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', background: '#000', padding: 'clamp(12px,1.3vw,18px)', display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1.1vw,16px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ fontSize: 'clamp(8px,0.66vw,11px)', color: accent, letterSpacing: '0.1em' }}>01</span>
          <span style={{ fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>COMMS.BRIDGE</span>
        </div>
        <span style={{ display:'flex', alignItems:'center', gap:'6px', fontSize: 'clamp(8px,0.66vw,11px)', letterSpacing: '0.18em', color: statusColor }}><svg width="7" height="7" viewBox="0 0 7 7"><rect width="7" height="7" fill={statusColor}></rect></svg>{bridgeState}</span>
      </div>

      <div style={{ display: 'flex', gap: 'clamp(12px,1.4vw,20px)', alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: '0 0 auto', width: 'clamp(112px,11vw,168px)', aspectRatio: '1', border: '1px solid rgba(255,255,255,0.1)' }}>
          <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display:'block' }}>
            <g stroke="rgba(255,255,255,0.14)" fill="none"><circle cx="50" cy="50" r="46"></circle><circle cx="50" cy="50" r="31"></circle><circle cx="50" cy="50" r="16"></circle></g>
            <g stroke="rgba(255,255,255,0.08)"><line x1="50" y1="4" x2="50" y2="96"></line><line x1="4" y1="50" x2="96" y2="50"></line></g>
            <line x1="50" y1="50" x2={radarX} y2={radarY} stroke={statusColor} strokeWidth="1.2"></line>
            <circle cx="50" cy="50" r="2.4" fill={statusColor}></circle>
            {s.blips.map((b, idx) => (
              <rect key={idx} x={b.x} y={b.y} width="2.6" height="2.6" fill={b.col}></rect>
            ))}
          </svg>
          <div style={{ position: 'absolute', bottom: '5px', left: '6px', fontSize: 'clamp(7px,0.6vw,10px)', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)' }}>{s.bridgeKbs}&nbsp;rx</div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 'clamp(8px,1vw,12px)' }}>
          <div>
            <div style={{ fontSize: 'clamp(8px,0.66vw,11px)', color: 'rgba(255,255,255,0.42)', letterSpacing: '0.14em' }}>ORCHESTRATOR</div>
            <div style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(18px,2vw,30px)', color:'#F4F4F2' }}>KAPITAN‑PLANETA</div>
            <div style={{ fontSize: 'clamp(8.5px,0.7vw,11.5px)', color: statusColor, letterSpacing: '0.1em' }}>{orchState}</div>
          </div>
          {nodes.map((nd, idx) => (
            <div key={idx} style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize: 'clamp(8.5px,0.7vw,11.5px)', letterSpacing: '0.08em' }}>
                <span style={{ color:'rgba(255,255,255,0.6)' }}>NODE.{nd.name}</span>
                <span style={{ color:nd.col }}>{nd.loadLabel}</span>
              </div>
              <div style={{ display:'flex', gap:'2px', height: 'clamp(8px,0.9vh,12px)' }}>
                {nd.segs.map((sg, i) => (
                  <div key={i} style={{ flex:1, background: sg.col }}></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: '2px', border: '1px solid rgba(255,255,255,0.12)', background: '#050505', padding: 'clamp(10px,1vw,14px)', marginLeft: 'clamp(8px,1vw,18px)', marginRight: 'clamp(-12px,-1vw,-6px)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '6px' }}>
          <span style={{ fontSize: 'clamp(8px,0.66vw,11px)', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.55)' }}>~/bridge/handoff‑current.json</span>
          <span style={{ fontSize: 'clamp(7.5px,0.62vw,10px)', letterSpacing: '0.1em', color: statusColor }}>●&nbsp;{watchLabel}</span>
        </div>
        <div style={{ fontSize: 'clamp(9px,0.74vw,12px)', lineHeight: 1.55, color: 'rgba(236,236,236,0.82)', whiteSpace: 'pre' }}>{handoffJson}</div>
      </div>
    </section>

    {/* ============ MODULE 02 : AUDIT & EXTRACTION ============ */}
    <section style={{ gridColumn: '6 / 13', gridRow: '1 / 2', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', background: '#000', padding: 'clamp(12px,1.3vw,18px)', display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1.1vw,14px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'clamp(8px,0.9vw,12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ fontSize: 'clamp(8px,0.66vw,11px)', color: accent, letterSpacing: '0.1em' }}>02</span>
          <span style={{ fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>AUDIT.EXTRACTION</span>
        </div>
        <span style={{ fontSize: 'clamp(8px,0.66vw,11px)', letterSpacing: '0.14em', color: bulkColor }}>{bulkLabel}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(12px,1.4vw,22px)' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize: 'clamp(8.5px,0.7vw,11.5px)', letterSpacing:'0.08em' }}>
            <span style={{ color:'rgba(255,255,255,0.6)' }}>AUDYT&nbsp;94S</span>
            <span style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(16px,1.8vw,26px)', color:'#F4F4F2' }}>{audit94Label}</span>
          </div>
          <div style={{ display:'flex', gap: '2px', height: 'clamp(14px,1.5vh,20px)', border:'1px solid rgba(255,255,255,0.1)', padding:'2px' }}>
            {audit94Segs.map((sg, i) => <div key={i} style={{ flex:1, background: sg.col }}></div>)}
          </div>
          <div style={{ fontSize: 'clamp(8px,0.64vw,10.5px)', color: 'rgba(255,255,255,0.4)', letterSpacing:'0.06em' }}>heuristics&nbsp;scanned&nbsp;{audit94Scan}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', fontSize: 'clamp(8.5px,0.7vw,11.5px)', letterSpacing:'0.08em' }}>
            <span style={{ color:'rgba(255,255,255,0.6)' }}>IADS&nbsp;EXTRACT</span>
            <span style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(16px,1.8vw,26px)', color: accent }}>{iadsLabel}</span>
          </div>
          <div style={{ display:'flex', gap: '2px', height: 'clamp(14px,1.5vh,20px)', border:'1px solid rgba(255,255,255,0.1)', padding:'2px' }}>
            {iadsSegs.map((sg, i) => <div key={i} style={{ flex:1, background: sg.col }}></div>)}
          </div>
          <div style={{ fontSize: 'clamp(8px,0.64vw,10.5px)', color: 'rgba(255,255,255,0.4)', letterSpacing:'0.06em' }}>ext_rate&nbsp;{extRate}&nbsp;f/s&nbsp;·&nbsp;16,384&nbsp;total</div>
        </div>
      </div>

      <div style={{ flex:1, minHeight: 'clamp(120px,16vh,210px)', border:'1px solid rgba(255,255,255,0.1)', background:'#040404', padding: 'clamp(8px,0.9vw,12px)', display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:'2px', fontSize: 'clamp(9px,0.74vw,12px)', lineHeight:1.45, overflow:'hidden' }}>
        {auditLogs.map((line, i) => (
          <div key={i} style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: 'rgba(236,236,236,0.78)' }}>{line}</div>
        ))}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'7px', fontSize: 'clamp(9px,0.74vw,12px)' }}>
        <span style={{ color:statusColor }}>audit@codex</span><span style={{ color:'rgba(255,255,255,0.4)' }}>:#</span><span style={{ color:'#ECECEC' }}>{auditCmd}</span>
        <span style={{ display:'inline-block', width:'0.62em', height:'1.05em', background:statusColor }} className="caret-anim"></span>
      </div>
    </section>

    {/* ============ MODULE 03 : PROMPT TRACKER ============ */}
    <section style={{ gridColumn: '1 / 13', gridRow: '2 / 3', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', background: '#000', padding: 'clamp(12px,1.3vw,18px)', display: 'flex', flexDirection: 'column', gap: 'clamp(10px,1.1vw,14px)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 'clamp(8px,0.9vw,12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ fontSize: 'clamp(8px,0.66vw,11px)', color: accent, letterSpacing: '0.1em' }}>03</span>
          <span style={{ fontSize: 'clamp(9px,0.72vw,12px)', letterSpacing: '0.22em', textTransform: 'uppercase' }}>PROMPT.TRACKER</span>
          <span style={{ fontSize: 'clamp(8px,0.66vw,11px)', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em' }}>// CLICK CELLS TO CYCLE</span>
        </div>
        <div style={{ display:'flex', gap: 'clamp(12px,1.4vw,22px)', fontSize: 'clamp(8px,0.66vw,11px)', letterSpacing:'0.14em', color: 'rgba(255,255,255,0.45)' }}>
          <span>BPM&nbsp;<span style={{ color:'#ECECEC' }}>{bpm}</span></span>
          <span>SEL&nbsp;<span style={{ color:accent }}>{selHex}</span>/0F</span>
          <span style={{ color:accent }}>■&nbsp;EDIT</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: '3ch repeat(5, 1fr)', gap: 'clamp(6px,0.8vw,12px)', fontSize: 'clamp(8px,0.64vw,10.5px)', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.4)', borderBottom:'1px solid rgba(255,255,255,0.08)', paddingBottom:'5px' }}>
        <span>#</span><span>LENS</span><span>LIGHT</span><span>MUSIC</span><span>MOTION</span><span>SEED</span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'2px', fontSize: 'clamp(9px,0.74vw,12px)' }}>
        {trackerRows.map((r, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns: '3ch repeat(5, 1fr)', gap: 'clamp(6px,0.8vw,12px)', padding: 'clamp(3px,0.4vw,5px) 4px', background: r.bg, borderLeft: `2px solid ${r.edge}` }}>
            <span onClick={r.selectRow} style={{ color: r.stepCol, cursor:'pointer' }}>{r.step}</span>
            <span onClick={r.cycleLens} style={{ color: '#ECECEC', cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.lens}</span>
            <span onClick={r.cycleLight} style={{ color: 'rgba(236,236,236,0.78)', cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.light}</span>
            <span onClick={r.cycleMusic} style={{ color: accent, cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.music}</span>
            <span onClick={r.cycleMotion} style={{ color: 'rgba(236,236,236,0.78)', cursor:'pointer', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.motion}</span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>{r.seed}</span>
          </div>
        ))}
      </div>

      {/* OUTPUT STRING */}
      <div style={{ border:'1px solid rgba(255,255,255,0.12)', background:'#050505', padding: 'clamp(10px,1vw,14px)', display:'flex', flexDirection:'column', gap: 'clamp(7px,0.8vw,10px)', marginTop:'2px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize: 'clamp(7.5px,0.62vw,10px)', letterSpacing:'0.18em', color: 'rgba(255,255,255,0.45)' }}>[ OUTPUT_STRING ] — ROW {selHex}</span>
          <button onClick={this.copyOut} style={{ border:'1px solid rgba(255,255,255,0.2)', background: copyBg, color: copyFg, fontFamily:'\'IBM Plex Mono\',monospace', fontSize: 'clamp(8px,0.66vw,11px)', letterSpacing:'0.18em', padding: 'clamp(5px,0.6vw,8px) clamp(10px,1vw,16px)', cursor:'pointer', textTransform:'uppercase' }}>{copyLabel}</button>
        </div>
        <div style={{ fontSize: 'clamp(10px,0.82vw,13.5px)', lineHeight: 1.6, color: '#ECECEC', wordBreak: 'break-word' }}>{outputString}</div>
      </div>

      {/* param slot bay */}
      <div style={{ display:'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'clamp(8px,1vw,14px)' }}>
        <div style={{ border:'1px solid rgba(255,255,255,0.1)', padding: 'clamp(8px,0.9vw,12px)' }}>
          <div style={{ fontSize: 'clamp(7.5px,0.62vw,10px)', letterSpacing:'0.16em', color:'rgba(255,255,255,0.4)' }}>OPTICS</div>
          <div style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(16px,1.8vw,26px)', color:'#F4F4F2', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selLens}</div>
          <div style={{ fontSize: 'clamp(8px,0.66vw,11px)', color:accent, letterSpacing:'0.06em' }}>shallow&nbsp;DoF&nbsp;·&nbsp;anamorphic</div>
        </div>
        <div style={{ border:'1px solid rgba(255,255,255,0.1)', padding: 'clamp(8px,0.9vw,12px)' }}>
          <div style={{ fontSize: 'clamp(7.5px,0.62vw,10px)', letterSpacing:'0.16em', color:'rgba(255,255,255,0.4)' }}>LIGHTING</div>
          <div style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(16px,1.8vw,26px)', color:'#F4F4F2', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selLight}</div>
          <div style={{ fontSize: 'clamp(8px,0.66vw,11px)', color:accent, letterSpacing:'0.06em' }}>practical&nbsp;·&nbsp;low-key</div>
        </div>
        <div style={{ border:'1px solid rgba(255,255,255,0.1)', padding: 'clamp(8px,0.9vw,12px)' }}>
          <div style={{ fontSize: 'clamp(7.5px,0.62vw,10px)', letterSpacing:'0.16em', color:'rgba(255,255,255,0.4)' }}>SCORE</div>
          <div style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(16px,1.8vw,26px)', color:'#F4F4F2', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{selMusic}</div>
          <div style={{ fontSize: 'clamp(8px,0.66vw,11px)', color:accent, letterSpacing:'0.06em' }}>tempo&nbsp;{bpm}&nbsp;BPM</div>
        </div>
        <div style={{ border:'1px solid rgba(255,255,255,0.12)', padding: 'clamp(8px,0.9vw,12px)', background:'#050505', display:'flex', flexDirection:'column', justifyContent:'space-between', gap:'6px' }}>
          <div style={{ fontSize: 'clamp(7.5px,0.62vw,10px)', letterSpacing:'0.16em', color:'rgba(255,255,255,0.4)' }}>RENDER&nbsp;QUEUE</div>
          <div style={{ display:'flex', alignItems:'baseline', gap:'8px' }}><span style={{ fontFamily:'\'Instrument Serif\',serif', fontSize: 'clamp(16px,1.8vw,26px)', color:accent }}>{queueCount}</span><span style={{ fontSize: 'clamp(8px,0.66vw,11px)', color:'rgba(255,255,255,0.45)' }}>staged</span></div>
          <button onClick={this.commit} disabled={!live} title={live ? 'Wyślij do realnej kolejki' : 'Brak połączenia z relayem'} style={{ border:'1px solid rgba(255,255,255,0.18)', background: s.staged ? accent : 'transparent', color: s.staged ? '#000' : (live ? '#ECECEC' : 'rgba(255,255,255,0.35)'), fontFamily:'\'IBM Plex Mono\',monospace', fontSize: 'clamp(8.5px,0.7vw,11.5px)', letterSpacing:'0.16em', padding: 'clamp(6px,0.7vw,9px)', cursor: live ? 'pointer' : 'not-allowed', textTransform:'uppercase' }}>{stageLabel}</button>
        </div>
      </div>

      {/* REAL QUEUE TAIL */}
      {s.queueTail && s.queueTail.length > 0 && (
        <div style={{ border:'1px solid rgba(255,255,255,0.1)', background:'#040404', padding:'clamp(8px,0.9vw,12px)', display:'flex', flexDirection:'column', gap:'3px' }}>
          <div style={{ fontSize:'clamp(7.5px,0.62vw,10px)', letterSpacing:'0.16em', color:'rgba(255,255,255,0.4)', marginBottom:'3px' }}>[ QUEUE.TXT ] — ostatnie {s.queueTail.length} · łącznie {s.queueCount}</div>
          {s.queueTail.map((line, i) => (
            <div key={i} style={{ fontSize:'clamp(8.5px,0.7vw,11px)', color:'rgba(236,236,236,0.7)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              <span style={{ color:accent }}>{this.hex(s.queueCount - s.queueTail.length + i)}</span>&nbsp;&nbsp;{line}
            </div>
          ))}
        </div>
      )}
    </section>

  </div>

  {/* FOOTER */}
  <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', border: '1px solid rgba(255,255,255,0.1)', borderTop: 'none', fontSize: 'clamp(8.5px,0.7vw,11.5px)', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.4)' }}>
    <div style={{ padding: 'clamp(7px,0.8vw,11px) clamp(12px,1.3vw,20px)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>EXEC&nbsp;<span style={{ color:accent }}>KAPITAN‑PLANETA.sh</span></div>
    <div style={{ display:'flex' }}>
      <div style={{ padding: 'clamp(7px,0.8vw,11px) clamp(12px,1.3vw,20px)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>BRIDGE&nbsp;<span style={{ color:statusColor }}>{bridgeState}</span></div>
      <div style={{ padding: 'clamp(7px,0.8vw,11px) clamp(12px,1.3vw,20px)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>QUEUE&nbsp;<span style={{ color:'#ECECEC' }}>{s.queueCount}</span></div>
      <div style={{ padding: 'clamp(7px,0.8vw,11px) clamp(12px,1.3vw,20px)' }}>{uptime}</div>
    </div>
  </div>

</div>
    );
  }
}

export default App;
