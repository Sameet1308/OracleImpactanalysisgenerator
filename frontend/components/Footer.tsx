import React from 'react';

export default function Footer() {
  return (
    <footer style={{ padding: 20, background: `url('/BlueVerseFooter.png') center/cover no-repeat`, marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto' }}>
        <img src="/BlueVerseLogo2.svg" alt="BlueVerse" style={{ height: 40 }} />
        <div style={{ color: '#fff', opacity: 0.9 }}>© {new Date().getFullYear()} BlueVerse · All rights reserved</div>
      </div>
    </footer>
  );
}
