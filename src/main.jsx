// ============================================================================
//  HallwayLauncher Studio — React renderer entry
//  Mounts App.jsx into #root. This is the file Vite bundles as the renderer.
// ============================================================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('HallwayLauncher Studio: #root container not found in index.html');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
