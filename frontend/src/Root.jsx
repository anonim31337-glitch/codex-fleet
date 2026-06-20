import React, { useState } from 'react';
import App from './App.jsx';
import StoryEngine from './StoryEngine.jsx';

const ACCENT = '#28E07B';
const MONO = "'IBM Plex Mono', monospace";

// Panel floty to prywatny monitor Patryka — dla zwykłych testerów (tata, koledzy, FB)
// jest bezużyteczny (świeci OFFLINE poza jego siecią). Pokazujemy go tylko lokalnie
// albo gdy ktoś świadomie doda ?fleet=1. Goście lądują od razu na Story Engine.
function fleetEnabled() {
  try {
    const p = new URLSearchParams(window.location.search);
    if (p.has('fleet')) return true;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1';
  } catch (e) { return false; }
}

export default function Root() {
  const showFleet = fleetEnabled();
  const [view, setView] = useState('studio');
  const v = showFleet ? view : 'studio';

  const tab = (id) => ({
    border: '1px solid rgba(255,255,255,0.15)',
    background: v === id ? ACCENT : 'transparent',
    color: v === id ? '#000' : '#ECECEC',
    fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase',
    padding: '7px 16px', cursor: 'pointer',
  });

  return (
    <div style={{ background: '#000', minHeight: '100vh' }}>
      {showFleet && (
        <div style={{ position: 'sticky', top: 0, zIndex: 50, display: 'flex', gap: '6px', padding: '10px clamp(14px,2vw,28px)', background: '#000', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button style={tab('studio')} onClick={() => setView('studio')}>✦ Story Engine</button>
          <button style={tab('fleet')} onClick={() => setView('fleet')}>▦ Panel floty</button>
        </div>
      )}
      {v === 'fleet' ? <App /> : <StoryEngine />}
    </div>
  );
}
