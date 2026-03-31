import React from 'react';

export default function Header() {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: `url('/BlueVerseBG.png') right center / contain no-repeat`, opacity: 0.12, pointerEvents: 'none' }} />
      <header>
        <div className="h-left">
          <img src="/OraclePythia26Logo.svg" alt="Oracle Pythia-26" style={{ height: 36 }} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 8 }}>
            <div className="h-title">Oracle Pythia-26</div>
            {/* <nav className="h-nav" style={{ marginTop: 4 }}>
              <a href="#">Explore</a>
              <a href="#">Analyze</a>
            </nav> */}
          </div>
        </div>
        <div className="h-right">v1.0</div>
      </header>
    </div>
  );
}
