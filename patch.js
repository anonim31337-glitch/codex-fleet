const fs = require('fs');
let template = fs.readFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/template.txt', 'utf8');

const rawHtml = JSON.parse(template);

let newHtml = rawHtml.replace(/componentDidMount\(\) \{[\s\S]*?componentWillUnmount\(\) \{[\s\S]*?clearInterval\(this\.fast\);\n  \}/, `
  componentDidMount() {
    this.fast = setInterval(() => {
      this.setState((s) => {
        if (!s.isNetworkLive) return { now: new Date() };
        const blips = Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => {
          const a = Math.random() * Math.PI * 2;
          const rr = 8 + Math.random() * 38;
          return { x: (50 + Math.cos(a) * rr).toFixed(1), y: (50 + Math.sin(a) * rr).toFixed(1), col: Math.random() < 0.6 ? (this.props.accent ?? '#28E07B') : 'rgba(255,255,255,0.5)' };
        });
        return {
          now: new Date(),
          radarAngle: (s.radarAngle + 0.22) % (Math.PI * 2),
          extRate: +(1180 + Math.random() * 240).toFixed(4),
          blips,
        };
      });
    }, 130);

    const urlParams = new URLSearchParams(window.location.search);
    const wsUrl = urlParams.get('ws') || 'ws://localhost:8765';
    this.connectWs(wsUrl);
  }

  connectWs(url) {
    if (this.ws) this.ws.close();
    this.ws = new WebSocket(url + (url.includes('?') ? '&' : '?') + 'role=client');
    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'fleet_state') {
          this.setState((s) => {
            const nodes = [];
            let bridgeKbs = 0;
            if (msg.nodes) {
              for (const [k, v] of Object.entries(msg.nodes)) {
                nodes.push({ name: k, load: v.online ? (v.cpu || 0) : 0 });
                if (v.online) bridgeKbs += 40 + Math.random() * 60;
              }
            }
            if (nodes.length === 0) {
              nodes.push({ name: 'OMEN', load: 0 }, { name: 'VIVO', load: 0 });
            }
            return {
              isNetworkLive: nodes.some(n => n.load > 0),
              nodes: nodes,
              bridgeKbs: Math.floor(bridgeKbs),
              handoffRev: msg.handoff ? (msg.handoff.rev || s.handoffRev) : s.handoffRev,
              audit94: msg.audit94 !== undefined ? msg.audit94 : s.audit94,
              iadsDone: msg.iadsDone !== undefined ? msg.iadsDone : s.iadsDone,
              auditLogs: msg.logs && msg.logs.length > 0 ? msg.logs : s.auditLogs,
              handoffData: msg.handoff
            };
          });
        }
      } catch (err) {}
    };
    this.ws.onclose = () => {
      this.setState({ isNetworkLive: false });
      setTimeout(() => this.connectWs(url), 3000);
    };
  }

  componentWillUnmount() {
    clearInterval(this.fast);
    if (this.ws) this.ws.close();
  }
`);

// update handoff string display
newHtml = newHtml.replace(/const handoffJson = live[\s\S]*?: "{\\n  \\"orchestrator[\s\S]*?;/, `
    const handoffJson = s.handoffData ? JSON.stringify(s.handoffData, null, 2) : (live
      ? '{\\n  "rev": ' + s.handoffRev + ',\\n  "orchestrator": "KAPITAN-PLANETA",\\n  "status": "ARBITRATING",\\n  "nodes": ["OMEN", "VIVO"],\\n  "lock": ' + (s.handoffRev % 4 === 0 ? 'true' : 'false') + ',\\n  "ts": "' + clock + '"\\n}'
      : '{\\n  "orchestrator": "KAPITAN-PLANETA",\\n  "status": "WAITING",\\n  "nodes": [],\\n  "lock": false,\\n  "signal": null\\n}');
`);

// update "Generate row" button functionality to send websocket message
newHtml = newHtml.replace(/commit: \(\) => this\.setState\(\(st\) => \(\{ queueCount: st\.queueCount \+ 1 \}\)\),/, `
      commit: () => {
        this.setState((st) => ({ queueCount: st.queueCount + 1 }));
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
           this.ws.send(JSON.stringify({ type: 'generate_row', row: selR, str: this.buildString(selR) }));
        }
      },
`);

fs.writeFileSync('C:/Users/anoni/Downloads/KapitanPlaneta/template_patched.txt', JSON.stringify(newHtml));
console.log('Patched template!');
