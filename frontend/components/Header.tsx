import React from 'react';

type Props = { onLogout?: () => void };

export default function Header({ onLogout }: Props) {
  return (
    <header className="app-header">
      <div className="h-left">
        <div className="h-logo">Ora1</div>
        <div className="h-title">AI_Elite_Ora1</div>
        <span className="h-divider">|</span>
        <span className="h-tagline">Impact Analysis</span>
      </div>
      <div className="h-right">
        {onLogout && (
          <button className="h-logout" onClick={onLogout}>Logout</button>
        )}
      </div>
    </header>
  );
}
