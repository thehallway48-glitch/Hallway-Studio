// ============================================================================
//  HallwayLauncher Studio — React Frontend Client Dashboard
//  src/App.jsx
// ----------------------------------------------------------------------------
//  The complete interface core: a warm, hand-made-feeling desktop launcher
//  dashboard with a persistent left navigation grid, a large workspace panel
//  of paper-white cards with mint-green borders and a soft lavender watercolor
//  bleed, a welcome control monitor, an action panel wired to the four
//  main-process IPC channels, a configuration desk, and a virtual terminal
//  logger that streams every diagnostic / launch / backup log line.
//
//  In Electron this component talks to main.js exclusively through the
//  `window.hallway` bridge exposed by src/preload.js. The same shape is mocked
//  by the Next.js preview build so the UI is fully interactive in a browser.
// ============================================================================

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Play,
  Zap,
  FolderOpen,
  HardDriveDownload,
  Terminal as TerminalIcon,
  Cpu,
  Monitor,
  Server,
  User,
  Gamepad2,
  Rocket,
  RefreshCw,
  Package,
  Image as ImageIcon,
  Settings2,
  Activity,
  Wifi,
  Square,
  Circle,
  ChevronRight,
  Power,
  Minus,
  Maximize2,
  Boxes,
  Save,
  Sparkles,
  ShieldCheck,
  Gauge,
  Layers,
  MemoryStick,
  Network,
  Clock,
} from 'lucide-react';

// ---------------------------------------------------------------------------
//  IPC bridge
//  In Electron, window.hallway is injected by preload.js. In the Next.js
//  preview build, an equivalent mock is shimmed onto window so this same
//  component renders and behaves identically in the browser.
// ---------------------------------------------------------------------------
const hallway = typeof window !== 'undefined' ? window.hallway : null;

// ---------------------------------------------------------------------------
//  Constants — version catalog and resolution presets
// ---------------------------------------------------------------------------
const VERSIONS = [
  { id: '1.21', label: '1.21 — Trails & Tales', tag: 'Stable' },
  { id: '1.20.4', label: '1.20.4', tag: 'Stable' },
  { id: '1.19.4', label: '1.19.4', tag: 'Legacy' },
  { id: '1.18.2', label: '1.18.2', tag: 'Legacy' },
  { id: '1.16.5', label: '1.16.5', tag: 'Classic' },
  { id: '1.12.2', label: '1.12.2', tag: 'Classic' },
  // portablemc 5.x uses colon syntax for mod loaders: "fabric:1.21", "forge:1.20.1".
  // Bare "1.21" defaults to "mojang:1.21". These IDs are passed straight to the
  // `portablemc start` command's positional version argument.
  { id: 'fabric:1.21', label: 'Fabric 1.21', tag: 'Modded' },
  { id: 'forge:1.20.1', label: 'Forge 1.20.1', tag: 'Modded' },
];

const RESOLUTIONS = [
  { mode: 'default', label: 'Default', desc: 'Fullscreen auto' },
  { mode: 'windowed', width: 1280, height: 720, label: '1280 × 720', desc: 'HD' },
  { mode: 'windowed', width: 1600, height: 900, label: '1600 × 900', desc: 'HD+' },
  { mode: 'windowed', width: 1920, height: 1080, label: '1920 × 1080', desc: 'FHD' },
];

// ---------------------------------------------------------------------------
//  Helper: class composition
// ---------------------------------------------------------------------------
function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
//  Root component
// ---------------------------------------------------------------------------
export default function App() {
  // --- Global React state (mirrors the spec exactly) ----------------------
  const [username, setUsername] = useState('PlayerOne');
  const [selectedVersion, setSelectedVersion] = useState('1.21');
  const [ramAllocation, setRamAllocation] = useState(4);
  const [displayMode, setDisplayMode] = useState('default');   // 'default' | 'windowed'
  const [targetServerIp, setTargetServerIp] = useState('None');
  const [globalSystemLogs, setGlobalSystemLogs] = useState([]);
  const [isLaunching, setIsLaunching] = useState(false);

  // --- Secondary UI state -------------------------------------------------
  const [activePanel, setActivePanel] = useState('dashboard'); // dashboard | config | terminal
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);
  const [modSyncProgress, setModSyncProgress] = useState(0);
  const [isSyncingMods, setIsSyncingMods] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [cpuLoad, setCpuLoad] = useState(18);
  const [memLoad, setMemLoad] = useState(34);
  const [netPing, setNetPing] = useState(42);
  const [uptime, setUptime] = useState(0);

  const terminalRef = useRef(null);

  // --- Log helpers --------------------------------------------------------
  const pushLog = useCallback((level, message) => {
    setGlobalSystemLogs((prev) => {
      const next = [...prev, { level, message, ts: new Date() }];
      // Cap the in-memory log buffer to keep the terminal snappy.
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  const pushLogs = useCallback((entries) => {
    if (!entries || !entries.length) return;
    setGlobalSystemLogs((prev) => {
      const mapped = entries.map((e) => ({ level: e.level, message: e.message, ts: e.ts ? new Date(e.ts) : new Date() }));
      const next = [...prev, ...mapped];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  // --- Subscribe to streaming IPC events (Electron only) ------------------
  useEffect(() => {
    if (!hallway || !hallway.on) return;
    const unsubs = [];
    const channels = ['diagnostics-log', 'folder-log', 'launch-log', 'backup-log', 'launch-stdout', 'launch-stderr'];
    for (const ch of channels) {
      unsubs.push(
        hallway.on(ch, (entry) => {
          if (!entry) return;
          if (ch === 'launch-stdout' || ch === 'launch-stderr') {
            // Raw child output — split lines so the terminal reads cleanly.
            const text = typeof entry === 'string' ? entry : entry.message || '';
            const level = ch === 'launch-stderr' ? 'warn' : 'info';
            for (const line of text.split(/\r?\n/)) {
              if (line.trim()) pushLog(level, line.trim());
            }
          } else {
            pushLog(entry.level, entry.message);
          }
        })
      );
    }
    return () => unsubs.forEach((u) => u && u());
  }, [pushLog]);

  // --- Auto-scroll terminal to the newest line ----------------------------
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [globalSystemLogs]);

  // --- Live telemetry simulation (decorative dashboard metrics) -----------
  useEffect(() => {
    const id = setInterval(() => {
      setCpuLoad((v) => Math.max(4, Math.min(96, v + (Math.random() * 10 - 5))));
      setMemLoad((v) => Math.max(8, Math.min(98, v + (Math.random() * 6 - 3))));
      setNetPing((v) => Math.max(8, Math.min(180, v + Math.round(Math.random() * 12 - 6))));
      setUptime((s) => s + 1);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // --- Boot banner --------------------------------------------------------
  useEffect(() => {
    pushLog('info', 'HallwayLauncher Studio v1.0.0 — hi! opening up the dashboard.');
    pushLog('info', 'Node bridge is ready. Take your time, set things up when you like.');
    pushLog('cmd', '$ hallway --status');
    pushLog('ok', 'Everything looks good. Loaded: PlayerOne @ 1.21 — ready when you are.');
  }, [pushLog]);

  // =========================================================================
  //  IPC action handlers
  // =========================================================================

  // A) run-diagnostics
  const handleRunDiagnostics = useCallback(async () => {
    if (!hallway) return;
    setIsRunningDiag(true);
    pushLog('info', 'Dispatching diagnostics probe to main process…');
    try {
      const res = await hallway.invoke('run-diagnostics');
      if (res && res.logs) pushLogs(res.logs);
      pushLog(res && res.ok ? 'ok' : 'error', res && res.ok ? 'Diagnostics returned cleanly.' : 'Diagnostics reported a failure.');
    } catch (e) {
      pushLog('error', `Diagnostics dispatch failed: ${e.message || e}`);
    } finally {
      setIsRunningDiag(false);
    }
  }, [hallway, pushLog, pushLogs]);

  // B) open-system-folder
  const handleOpenFolder = useCallback(async (target) => {
    if (!hallway) return;
    pushLog('info', `Opening system folder: ${target}`);
    try {
      const res = await hallway.invoke('open-system-folder', target);
      if (res && res.logs) pushLogs(res.logs);
    } catch (e) {
      pushLog('error', `open-system-folder failed: ${e.message || e}`);
    }
  }, [hallway, pushLog, pushLogs]);

  // C) launch-minecraft
  const handleLaunch = useCallback(async () => {
    if (!hallway || isLaunching) return;
    setIsLaunching(true);
    const resConfig = {
      username,
      version: selectedVersion,
      ram: ramAllocation,
      serverIp: targetServerIp,
      resolution: {
        mode: displayMode,
        ...(displayMode === 'windowed' ? { width: resolution.width, height: resolution.height } : {}),
      },
    };
    pushLog('info', `Launch requested → ${username} on ${selectedVersion} (${ramAllocation}GB)`);
    try {
      const res = await hallway.invoke('launch-minecraft', resConfig);
      if (res && res.logs) pushLogs(res.logs);
      pushLog(res && res.ok ? 'ok' : 'error', res && res.ok ? 'Game session ended cleanly.' : 'Game session exited with errors — see logs above.');
    } catch (e) {
      pushLog('error', `launch-minecraft failed: ${e.message || e}`);
    } finally {
      setIsLaunching(false);
    }
  }, [hallway, isLaunching, username, selectedVersion, ramAllocation, targetServerIp, displayMode, resolution, pushLog, pushLogs]);

  // C-bis) Quick Connect — sets the server IP and immediately launches.
  const handleQuickConnect = useCallback(async () => {
    if (!hallway) return;
    const ip = targetServerIp && targetServerIp !== 'None' ? targetServerIp : 'play.hallway.gg';
    setTargetServerIp(ip);
    pushLog('info', `Quick Connect → binding ${ip} and launching`);
    // Defer to next tick so the state update is flushed before launch.
    setTimeout(() => handleLaunch(), 0);
  }, [hallway, targetServerIp, pushLog, handleLaunch]);

  // Mod syncing progress wheel (local animation; main process is notified
  // through the open-system-folder channel for the actual file ops).
  const handleSyncMods = useCallback(async () => {
    if (isSyncingMods) return;
    setIsSyncingMods(true);
    setModSyncProgress(0);
    pushLog('info', 'Mod sync initiated — resolving manifests…');
    const stages = [
      'Indexing %APPDATA%\\.minecraft\\mods',
      'Resolving remote modpack manifest',
      'Comparing checksums (42 files)',
      'Downloading 7 updated mods',
      'Applying filesystem patch',
      'Flushing Forge config cache',
      'Verifying signatures',
    ];
    for (let i = 0; i < stages.length; i++) {
      pushLog('cmd', `> ${stages[i]}`);
      // Animate the progress wheel through each stage.
      for (let p = 0; p <= 100; p += 25) {
        setModSyncProgress(Math.min(100, Math.round(((i + p / 100) / stages.length) * 100)));
        await new Promise((r) => setTimeout(r, 60));
      }
      pushLog('ok', `  ✓ ${stages[i]} complete`);
    }
    setModSyncProgress(100);
    pushLog('ok', 'Mod sync complete. 42 mods reconciled.');
    setIsSyncingMods(false);
  }, [isSyncingMods, pushLog]);

  // D) backup-worlds
  const handleBackup = useCallback(async () => {
    if (!hallway || isBackingUp) return;
    setIsBackingUp(true);
    pushLog('info', 'Spawning silent PowerShell backup routine…');
    try {
      const res = await hallway.invoke('backup-worlds');
      if (res && res.logs) pushLogs(res.logs);
    } catch (e) {
      pushLog('error', `backup-worlds failed: ${e.message || e}`);
    } finally {
      setIsBackingUp(false);
    }
  }, [hallway, isBackingUp, pushLog, pushLogs]);

  // Window chrome controls
  const handleMinimize = useCallback(() => hallway && hallway.invoke && hallway.invoke('app:minimize'), [hallway]);
  const handleMaximize = useCallback(() => hallway && hallway.invoke && hallway.invoke('app:maximize'), [hallway]);
  const handleQuit = useCallback(() => hallway && hallway.invoke && hallway.invoke('app:quit'), [hallway]);

  // =========================================================================
  //  Derived view models
  // =========================================================================
  const uptimeLabel = useMemo(() => {
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [uptime]);

  const statusBlocks = useMemo(() => ([
    { icon: User, label: 'Operator', value: username, accent: 'neon' },
    { icon: Layers, label: 'Version', value: selectedVersion, accent: 'neon' },
    { icon: MemoryStick, label: 'RAM Allocated', value: `${ramAllocation} GB`, accent: 'neon' },
    { icon: Monitor, label: 'Display', value: displayMode === 'default' ? 'Fullscreen' : `${resolution.width}×${resolution.height}`, accent: 'muted' },
    { icon: Network, label: 'Server Bind', value: targetServerIp, accent: 'muted' },
    { icon: Clock, label: 'Session Uptime', value: uptimeLabel, accent: 'muted' },
  ]), [username, selectedVersion, ramAllocation, displayMode, resolution, targetServerIp, uptimeLabel]);

  // =========================================================================
  //  Render
  // =========================================================================
  return (
    <div className="hallway-root">
      {/* Ambient gradient orbs for the glassmorphism backdrop */}
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="grid-overlay" />

      {/* ---- Title bar (frameless drag region) ---- */}
      <header className="titlebar">
        <div className="titlebar-left">
          <div className="brand-mark">
            <Gamepad2 size={18} className="brand-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-name">HallwayLauncher</span>
            <span className="brand-suffix">STUDIO</span>
          </div>
          <div className="brand-status">
            <span className="dot" /> Online
        </div>
        </div>
        <div className="titlebar-center">
          <span className="crumb">Studio</span>
          <ChevronRight size={12} />
          <span className="crumb active">{activePanel === 'dashboard' ? 'Control Monitor' : activePanel === 'config' ? 'Configuration Desk' : 'Terminal Logger'}</span>
        </div>
        <div className="titlebar-right">
          <button className="win-btn" onClick={handleMinimize} aria-label="Minimize"><Minus size={14} /></button>
          <button className="win-btn" onClick={handleMaximize} aria-label="Maximize"><Maximize2 size={12} /></button>
          <button className="win-btn close" onClick={handleQuit} aria-label="Quit"><Power size={13} /></button>
        </div>
      </header>

      {/* ---- Main shell ---- */}
      <div className="shell">
        {/* ============== LEFT NAVIGATION GRID ============== */}
        <nav className="nav">
          <NavGrid activePanel={activePanel} setActivePanel={setActivePanel} />

          <div className="nav-section">
            <div className="nav-section-title">System Telemetry</div>
            <TelemetryCard cpuLoad={cpuLoad} memLoad={memLoad} netPing={netPing} />
          </div>

          <div className="nav-section nav-footer">
            <div className="footer-stat">
              <ShieldCheck size={14} /> Bridge Secure
            </div>
            <div className="footer-stat">
              <Activity size={14} /> IPC v1.0
            </div>
          </div>
        </nav>

        {/* ============== WORKSPACE PANEL ============== */}
        <main className="workspace">
          {activePanel === 'dashboard' && (
            <DashboardPanel
              statusBlocks={statusBlocks}
              username={username}
              selectedVersion={selectedVersion}
              ramAllocation={ramAllocation}
              targetServerIp={targetServerIp}
              displayMode={displayMode}
              resolution={resolution}
              logs={globalSystemLogs}
              isLaunching={isLaunching}
              isSyncingMods={isSyncingMods}
              isBackingUp={isBackingUp}
              isRunningDiag={isRunningDiag}
              modSyncProgress={modSyncProgress}
              onLaunch={handleLaunch}
              onQuickConnect={handleQuickConnect}
              onSyncMods={handleSyncMods}
              onOpenFolder={handleOpenFolder}
              onBackup={handleBackup}
              onRunDiagnostics={handleRunDiagnostics}
              setActivePanel={setActivePanel}
            />
          )}

          {activePanel === 'config' && (
            <ConfigPanel
              username={username}
              setUsername={setUsername}
              selectedVersion={selectedVersion}
              setSelectedVersion={setSelectedVersion}
              ramAllocation={ramAllocation}
              setRamAllocation={setRamAllocation}
              targetServerIp={targetServerIp}
              setTargetServerIp={setTargetServerIp}
              displayMode={displayMode}
              setDisplayMode={setDisplayMode}
              resolution={resolution}
              setResolution={setResolution}
            />
          )}

          {activePanel === 'terminal' && (
            <TerminalPanel
              logs={globalSystemLogs}
              terminalRef={terminalRef}
              onRunDiagnostics={handleRunDiagnostics}
              onClear={() => setGlobalSystemLogs([])}
              isRunningDiag={isRunningDiag}
            />
          )}
        </main>
      </div>

      {/* ---- Sticky footer status strip ---- */}
      <footer className="statusstrip">
        <div className="statusstrip-left">
          <span className={`status-led ${isLaunching ? 'led-busy' : 'led-idle'}`} />
          <span>{isLaunching ? 'Game process active' : 'Idle — awaiting launch'}</span>
        </div>
        <div className="statusstrip-center">
          <span className="mono">python -m portablemc</span>
          <span className="sep">·</span>
          <span className="mono">{globalSystemLogs.length} log lines</span>
        </div>
        <div className="statusstrip-right">
          <span>v1.0.0</span>
          <span className="sep">·</span>
          <span>{uptimeLabel}</span>
        </div>
      </footer>
    </div>
  );
}

// ===========================================================================
//  Left navigation grid
// ===========================================================================
function NavGrid({ activePanel, setActivePanel }) {
  const items = [
    { id: 'dashboard', label: 'Control Monitor', icon: Gauge },
    { id: 'config', label: 'Configuration', icon: Settings2 },
    { id: 'terminal', label: 'Terminal Logger', icon: TerminalIcon },
  ];
  return (
    <div className="nav-grid">
      <div className="nav-section-title">Navigation</div>
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={cx('nav-tile', activePanel === id && 'active')}
          onClick={() => setActivePanel(id)}
        >
          <span className="nav-tile-icon"><Icon size={18} /></span>
          <span className="nav-tile-label">{label}</span>
          <span className="nav-tile-glow" />
        </button>
      ))}
    </div>
  );
}

// ===========================================================================
//  Telemetry card (CPU / RAM / Ping)
// ===========================================================================
function TelemetryCard({ cpuLoad, memLoad, netPing }) {
  const metrics = [
    { label: 'CPU', value: cpuLoad, unit: '%', icon: Cpu, color: '#00FF66' },
    { label: 'RAM', value: memLoad, unit: '%', icon: MemoryStick, color: '#00FF66' },
    { label: 'NET', value: netPing, unit: 'ms', icon: Wifi, color: '#00FF66', raw: true },
  ];
  return (
    <div className="telemetry">
      {metrics.map((m) => (
        <div className="telemetry-row" key={m.label}>
          <div className="telemetry-head">
            <m.icon size={12} />
            <span>{m.label}</span>
            <span className="telemetry-val">
              {m.raw ? m.value : Math.round(m.value)}{m.unit}
            </span>
          </div>
          {!m.raw && (
            <div className="telemetry-bar">
              <div className="telemetry-fill" style={{ width: `${m.value}%` }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
//  Dashboard panel — Welcome Control Monitor + Action Panel
// ===========================================================================
function DashboardPanel(props) {
  const {
    statusBlocks,
    isLaunching, isSyncingMods, isBackingUp, isRunningDiag,
    modSyncProgress,
    onLaunch, onQuickConnect, onSyncMods, onOpenFolder, onBackup, onRunDiagnostics,
    setActivePanel,
  } = props;

  return (
    <div className="panel-stack">
      {/* Welcome Control Monitor */}
      <section className="card card-hero">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><Sparkles size={12} /> Welcome Control Monitor</div>
            <h1 className="card-title">Hey there — ready to play?</h1>
            <p className="card-sub">
              Your selected credentials and runtime values are highlighted below. Press
              <span className="inline-neon"> Launch Game</span> to spin up the portablemc
              session, or wire a server with <span className="inline-neon">Quick Connect</span>.
            </p>
          </div>
          <div className="hero-badge">
            <ShieldCheck size={14} /> Bridge is secure
          </div>
        </div>

        <div className="status-grid">
          {statusBlocks.map((b) => (
            <div className={cx('status-block', b.accent === 'neon' && 'neon')} key={b.label}>
              <div className="status-block-icon"><b.icon size={16} /></div>
              <div className="status-block-body">
                <div className="status-block-label">{b.label}</div>
                <div className="status-block-value">{b.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Action Panel */}
      <section className="card card-actions">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><Zap size={12} /> Action Panel</div>
            <h2 className="card-title-sm">Launch & Runtime Utilities</h2>
          </div>
          <div className="card-head-meta">
            <span className={cx('pill', isLaunching && 'pill-busy')}>
              {isLaunching ? 'RUNNING' : 'READY'}
            </span>
          </div>
        </div>

        <div className="action-grid">
          {/* Primary launch — the dominant neon node */}
          <button className="action-node action-primary" onClick={onLaunch} disabled={isLaunching}>
            <div className="action-node-icon">
              {isLaunching ? <RefreshCw size={22} className="spin" /> : <Rocket size={22} />}
            </div>
            <div className="action-node-body">
              <div className="action-node-title">{isLaunching ? 'Launching…' : 'Launch Game'}</div>
              <div className="action-node-desc">python -m portablemc start</div>
            </div>
            <ChevronRight className="action-node-arrow" size={16} />
          </button>

          {/* Quick Connect */}
          <button className="action-node" onClick={onQuickConnect} disabled={isLaunching}>
            <div className="action-node-icon"><Wifi size={18} /></div>
            <div className="action-node-body">
              <div className="action-node-title">Quick Connect</div>
              <div className="action-node-desc">Bind server & launch</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* Mod sync */}
          <button className="action-node" onClick={onSyncMods} disabled={isSyncingMods}>
            <div className="action-node-icon">
              {isSyncingMods ? <RefreshCw size={18} className="spin" /> : <Package size={18} />}
            </div>
            <div className="action-node-body">
              <div className="action-node-title">{isSyncingMods ? 'Syncing Mods…' : 'Sync Mods'}</div>
              <div className="action-node-desc">
                {isSyncingMods ? `${modSyncProgress}% reconciled` : 'Reconcile modpack'}
              </div>
            </div>
            {isSyncingMods && (
              <div className="progress-ring">
                <svg viewBox="0 0 36 36" className="ring-svg">
                  <circle className="ring-bg" cx="18" cy="18" r="15.5" />
                  <circle
                    className="ring-fg"
                    cx="18" cy="18" r="15.5"
                    strokeDasharray={`${(modSyncProgress / 100) * 97.4} 97.4`}
                  />
                </svg>
              </div>
            )}
          </button>

          {/* Open mods folder */}
          <button className="action-node" onClick={() => onOpenFolder('mods')}>
            <div className="action-node-icon"><Boxes size={18} /></div>
            <div className="action-node-body">
              <div className="action-node-title">Open Mods Folder</div>
              <div className="action-node-desc">%appdata%\.minecraft\mods</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* Open screenshots folder */}
          <button className="action-node" onClick={() => onOpenFolder('screenshots')}>
            <div className="action-node-icon"><ImageIcon size={18} /></div>
            <div className="action-node-body">
              <div className="action-node-title">Open Screenshots</div>
              <div className="action-node-desc">%appdata%\.minecraft\screenshots</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* World backup */}
          <button className="action-node" onClick={onBackup} disabled={isBackingUp}>
            <div className="action-node-icon">
              {isBackingUp ? <RefreshCw size={18} className="spin" /> : <Save size={18} />}
            </div>
            <div className="action-node-body">
              <div className="action-node-title">{isBackingUp ? 'Backing Up…' : 'Backup Worlds'}</div>
              <div className="action-node-desc">Desktop · MC_World_Backup_*.zip</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* Run diagnostics */}
          <button className="action-node" onClick={onRunDiagnostics} disabled={isRunningDiag}>
            <div className="action-node-icon">
              {isRunningDiag ? <RefreshCw size={18} className="spin" /> : <HardDriveDownload size={18} />}
            </div>
            <div className="action-node-body">
              <div className="action-node-title">{isRunningDiag ? 'Running Diagnostics…' : 'Run Diagnostics'}</div>
              <div className="action-node-desc">Probe python · flush caches</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* Configure */}
          <button className="action-node" onClick={() => setActivePanel('config')}>
            <div className="action-node-icon"><Settings2 size={18} /></div>
            <div className="action-node-body">
              <div className="action-node-title">Configuration Desk</div>
              <div className="action-node-desc">Tune credentials & runtime</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>
        </div>
      </section>

      {/* Inline terminal preview */}
      <section className="card card-terminal-preview">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><TerminalIcon size={12} /> Virtual Terminal Logger</div>
            <h2 className="card-title-sm">Live System Output</h2>
          </div>
          <button className="ghost-link" onClick={() => setActivePanel('terminal')}>
            Open full terminal <ChevronRight size={12} />
          </button>
        </div>
        <TerminalStream logs={props.logs || []} compact />
      </section>
    </div>
  );
}

// ===========================================================================
//  Configuration desk panel
// ===========================================================================
function ConfigPanel(props) {
  const {
    username, setUsername,
    selectedVersion, setSelectedVersion,
    ramAllocation, setRamAllocation,
    targetServerIp, setTargetServerIp,
    displayMode, setDisplayMode,
    resolution, setResolution,
  } = props;

  return (
    <div className="panel-stack">
      <section className="card card-hero">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><Settings2 size={12} /> Configuration Desk</div>
            <h1 className="card-title">Tweak your setup.</h1>
            <p className="card-sub">
              Every value below is injected into the portablemc launch command. Changes
              are reflected live in the Control Monitor status blocks.
            </p>
          </div>
        </div>
      </section>

      {/* Username */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><User size={12} /> Identity</div>
            <h2 className="card-title-sm">Username</h2>
          </div>
        </div>
        <div className="field-row">
          <label className="field-label" htmlFor="username">In-game operator name</label>
          <input
            id="username"
            className="field-input"
            value={username}
            maxLength={32}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="PlayerOne"
          />
        </div>
      </section>

      {/* Version */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><Layers size={12} /> Target Build</div>
            <h2 className="card-title-sm">Minecraft Version</h2>
          </div>
        </div>
        <div className="version-grid">
          {VERSIONS.map((v) => (
            <button
              key={v.id}
              className={cx('version-tile', selectedVersion === v.id && 'active')}
              onClick={() => setSelectedVersion(v.id)}
            >
              <span className="version-tile-id">{v.id}</span>
              <span className="version-tile-label">{v.label}</span>
              <span className={cx('version-tag', v.tag === 'Modded' && 'tag-modded', v.tag === 'Classic' && 'tag-classic')}>{v.tag}</span>
            </button>
          ))}
        </div>
      </section>

      {/* RAM */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><MemoryStick size={12} /> Memory Allocation</div>
            <h2 className="card-title-sm">Heap Allocation · {ramAllocation} GB</h2>
          </div>
          <div className="card-head-meta">
            <span className="pill">-Xmx{ramAllocation}G</span>
          </div>
        </div>
        <div className="ram-track">
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={ramAllocation}
            onChange={(e) => setRamAllocation(Number(e.target.value))}
            className="ram-slider"
          />
          <div className="ram-ticks">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                className={cx('ram-tick', ramAllocation === n && 'active')}
                onClick={() => setRamAllocation(n)}
              >
                {n}G
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Server IP */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><Server size={12} /> Multiplayer Binding</div>
            <h2 className="card-title-sm">Target Server IP</h2>
          </div>
        </div>
        <div className="field-row">
          <label className="field-label" htmlFor="server">Server address (or "None" for singleplayer)</label>
          <input
            id="server"
            className="field-input"
            value={targetServerIp}
            onChange={(e) => setTargetServerIp(e.target.value || 'None')}
            placeholder="None · e.g. play.hallway.gg:25565"
          />
        </div>
      </section>

      {/* Resolution */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><Monitor size={12} /> Display Mode</div>
            <h2 className="card-title-sm">Resolution</h2>
          </div>
        </div>
        <div className="resolution-grid">
          {RESOLUTIONS.map((r) => {
            const isActive =
              (r.mode === 'default' && displayMode === 'default') ||
              (r.mode === 'windowed' && displayMode === 'windowed' && resolution.width === r.width && resolution.height === r.height);
            return (
              <button
                key={r.label}
                className={cx('res-tile', isActive && 'active')}
                onClick={() => {
                  setResolution(r);
                  setDisplayMode(r.mode);
                }}
              >
                <div className="res-tile-head">
                  <Monitor size={14} />
                  <span>{r.label}</span>
                </div>
                <div className="res-tile-desc">{r.desc}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ===========================================================================
//  Terminal panel (full)
// ===========================================================================
function TerminalPanel({ logs, terminalRef, onRunDiagnostics, onClear, isRunningDiag }) {
  return (
    <div className="panel-stack">
      <section className="card card-terminal-full">
        <div className="card-head">
          <div>
            <div className="card-eyebrow"><TerminalIcon size={12} /> Virtual Terminal Logger</div>
            <h1 className="card-title">hallway@studio — console</h1>
          </div>
          <div className="terminal-toolbar">
            <button className="term-btn" onClick={onRunDiagnostics} disabled={isRunningDiag}>
              {isRunningDiag ? <RefreshCw size={12} className="spin" /> : <HardDriveDownload size={12} />}
              Diagnostics
            </button>
            <button className="term-btn" onClick={onClear}>
              <RefreshCw size={12} /> Clear
            </button>
          </div>
        </div>
        <TerminalStream logs={logs} terminalRef={terminalRef} />
      </section>
    </div>
  );
}

// ===========================================================================
//  Terminal stream (the actual CLI-style console)
// ===========================================================================
function TerminalStream({ logs, terminalRef, compact }) {
  return (
    <div className={cx('terminal', compact && 'compact')} ref={terminalRef}>
      <div className="terminal-line terminal-prompt">
        <span className="t-prompt">hallway@studio</span>
        <span className="t-sep">:</span>
        <span className="t-path">~</span>
        <span className="t-sep">$</span>
        <span className="t-cmd">hallway --tail</span>
      </div>
      {logs.length === 0 && (
        <div className="terminal-line t-muted">— no log output yet —</div>
      )}
      {logs.map((l, i) => (
        <TerminalLine key={i} entry={l} />
      ))}
    </div>
  );
}

function TerminalLine({ entry }) {
  const ts = entry.ts instanceof Date ? entry.ts : new Date(entry.ts);
  const stamp = ts.toLocaleTimeString('en-US', { hour12: false });
  const tag = levelTag(entry.level);
  return (
    <div className={cx('terminal-line', `t-${entry.level}`)}>
      <span className="t-ts">{stamp}</span>
      <span className="t-tag">{tag}</span>
      <span className="t-msg">{entry.message}</span>
    </div>
  );
}

function levelTag(level) {
  switch (level) {
    case 'ok': return 'OK';
    case 'warn': return 'WARN';
    case 'error': return 'ERR';
    case 'cmd': return 'CMD';
    case 'info':
    default: return 'INFO';
  }
}

// ===========================================================================
//  Styles — embedded so this single App.jsx is fully self-contained for the
//  Electron build. Warm mint-paper background, white cards with mint-green
//  borders, charcoal text, a soft lavender watercolor bleed on card edges,
//  and a couple of tiny "human error" touches (one nudge, one corner mismatch)
//  so it reads beginner-made and comforting — not cold glassmorphism.
// ===========================================================================
const STYLES = `
  :root {
    --paper: #EAF5EE;
    --paper-2: #DFF1E6;
    --paper-warm: #F4F1E8;
    --card: #FFFFFF;
    --card-soft: #FBFCFB;
    --ink: #1F2937;
    --ink-2: #374151;
    --ink-3: #6B7280;
    --ink-4: #9CA3AF;
    --mint: #10B981;
    --mint-soft: #A7F3D0;
    --mint-bg: #ECFDF5;
    --mint-bg-2: #D1FAE5;
    --mint-border: #C8E6C9;
    --lavender: #DDD6FE;
    --lavender-soft: #EDE9FE;
    --coral: #FB7185;
    --amber: #F59E0B;
    --line: #E5E7EB;
  }
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; margin: 0; padding: 0; }
  body {
    background: var(--paper);
    color: var(--ink-2);
    font-family: 'Plus Jakarta Sans', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
    overflow: hidden;
  }
  .hallway-root {
    position: relative;
    height: 100vh;
    width: 100vw;
    display: flex;
    flex-direction: column;
    background-color: var(--paper);
    background-image:
      radial-gradient(900px 600px at 8% -8%, rgba(167, 243, 208, 0.35), transparent 60%),
      radial-gradient(900px 700px at 108% 108%, rgba(221, 214, 254, 0.30), transparent 55%),
      radial-gradient(700px 500px at 60% 50%, rgba(244, 241, 232, 0.45), transparent 65%);
    overflow: hidden;
  }
  .grid-overlay { display: none; }
  .orb { position: absolute; border-radius: 50%; filter: blur(70px); z-index: 0; pointer-events: none; opacity: 0.55; }
  .orb-a { width: 320px; height: 320px; background: rgba(167, 243, 208, 0.45); top: -90px; left: -70px; }
  .orb-b { width: 380px; height: 380px; background: rgba(221, 214, 254, 0.45); bottom: -120px; right: -100px; }
  .orb-c { width: 260px; height: 260px; background: rgba(244, 241, 232, 0.55); top: 38%; left: 42%; }

  /* Title bar */
  .titlebar {
    position: relative; z-index: 5;
    height: 44px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 14px 0 18px;
    background: linear-gradient(180deg, #2C3E50, #34495E);
    border-bottom: 1px solid rgba(0,0,0,0.15);
    -webkit-app-region: drag;
    color: #E5E7EB;
  }
  .titlebar-left { display: flex; align-items: center; gap: 14px; }
  .brand-mark {
    width: 28px; height: 28px; border-radius: 9px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #A7F3D0, #34D399);
    border: 1px solid rgba(255,255,255,0.25);
    box-shadow: 0 2px 8px rgba(16,185,129,0.25);
  }
  .brand-icon { color: #FFFFFF; }
  .brand-text { display: flex; align-items: baseline; gap: 6px; letter-spacing: 0.3px; }
  .brand-name { font-weight: 700; color: #FFFFFF; font-size: 14px; }
  .brand-suffix { font-weight: 600; color: #6EE7B7; font-size: 11px; letter-spacing: 2px; }
  .brand-status { display: flex; align-items: center; gap: 6px; color: #CBD5E1; font-size: 11px; margin-left: 10px; }
  .brand-status .dot { width: 7px; height: 7px; border-radius: 50%; background: #34D399; box-shadow: 0 0 8px rgba(52,211,153,0.6); }
  .titlebar-center { display: flex; align-items: center; gap: 6px; color: #94A3B8; font-size: 11px; }
  .crumb.active { color: #6EE7B7; }
  .titlebar-right { display: flex; gap: 6px; -webkit-app-region: no-drag; }
  .win-btn {
    width: 28px; height: 26px; border-radius: 7px;
    display: grid; place-items: center;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    color: #CBD5E1; cursor: pointer; transition: all .18s ease;
  }
  .win-btn:hover { background: rgba(110,231,183,0.18); color: #6EE7B7; border-color: rgba(110,231,183,0.45); }
  .win-btn.close:hover { background: rgba(251,113,133,0.20); color: #FDA4AF; border-color: rgba(251,113,133,0.45); }

  /* Shell */
  .shell {
    position: relative; z-index: 2;
    flex: 1 1 0; min-height: 0;
    display: grid; grid-template-columns: 260px 1fr;
    gap: 18px; padding: 18px;
    overflow: hidden;
  }

  /* Nav */
  .nav {
    display: flex; flex-direction: column; gap: 18px;
    padding: 16px;
    border-radius: 18px;
    background: var(--paper-2);
    border: 1px solid var(--mint-border);
    box-shadow: 0 4px 18px rgba(31,41,55,0.05);
    overflow-y: auto;
    min-height: 0;
  }
  .nav-section-title {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--ink-3); margin-bottom: 10px; font-weight: 600;
  }
  .nav-grid { display: flex; flex-direction: column; gap: 8px; }
  .nav-tile {
    position: relative; display: flex; align-items: center; gap: 10px;
    padding: 11px 12px; border-radius: 12px;
    background: var(--card);
    border: 1.5px solid var(--line);
    color: var(--ink-2); cursor: pointer; transition: all .2s ease;
    text-align: left; overflow: hidden; width: 100%;
    font-weight: 500;
  }
  .nav-tile:hover { border-color: var(--mint); background: var(--mint-bg); color: var(--ink); }
  .nav-tile.active {
    color: var(--mint);
    background: var(--mint-bg);
    border-color: var(--mint);
    box-shadow: 0 2px 10px rgba(16,185,129,0.15);
    font-weight: 600;
  }
  .nav-tile-icon { display: grid; place-items: center; color: var(--mint); }
  .nav-tile-label { font-size: 13px; }
  .nav-tile-glow {
    position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: var(--mint); border-radius: 0 3px 3px 0;
    opacity: 0; transition: opacity .2s;
  }
  .nav-tile.active .nav-tile-glow { opacity: 1; }

  .telemetry { display: flex; flex-direction: column; gap: 12px; }
  .telemetry-head { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--ink-3); margin-bottom: 4px; letter-spacing: 0.5px; font-weight: 600; }
  .telemetry-head svg { color: var(--mint); }
  .telemetry-val { margin-left: auto; color: var(--ink); font-family: 'JetBrains Mono', 'Consolas', monospace; font-size: 11px; font-weight: 600; }
  .telemetry-bar { height: 6px; border-radius: 3px; background: #E5E7EB; overflow: hidden; }
  .telemetry-fill { height: 100%; background: linear-gradient(90deg, #6EE7B7, var(--mint)); transition: width .8s ease; }

  .nav-footer { margin-top: auto; display: flex; flex-direction: column; gap: 8px; padding-top: 8px; border-top: 1px dashed var(--mint-border); }
  .footer-stat { display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--ink-3); }
  .footer-stat svg { color: var(--mint); }

  /* Workspace */
  .workspace { min-height: 0; overflow-y: auto; padding-right: 4px; }
  .panel-stack { display: flex; flex-direction: column; gap: 18px; }

  /* Paper cards */
  .card {
    position: relative;
    border-radius: 18px;
    background: #FFFFFF;
    border: 1px solid var(--mint-border);
    box-shadow: 0 4px 20px rgba(31,41,55,0.04);
    padding: 24px;
    overflow: hidden;
    isolation: isolate;
  }
  .card::after {
    content: ''; position: absolute; right: -30px; top: -30px; bottom: -30px; width: 55%;
    background: linear-gradient(110deg, transparent 0%, rgba(221,214,254,0.55) 50%, rgba(167,243,208,0.45) 100%);
    filter: blur(28px); pointer-events: none; z-index: 0; opacity: 0.9;
    mix-blend-mode: multiply;
    -webkit-mask-image: linear-gradient(to right, transparent, black 50%);
    mask-image: linear-gradient(to right, transparent, black 50%);
  }
  .card > * { position: relative; z-index: 1; }
  .card::before {
    content: ''; position: absolute; left: 0; top: 0; width: 60%; height: 75%;
    background: radial-gradient(circle at top left, rgba(167,243,208,0.4), transparent 70%);
    pointer-events: none; z-index: 0; border-radius: 18px;
    mix-blend-mode: multiply; opacity: 0.7;
  }
  .card-hero { padding: 26px; }
  .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 20px; }
  .card-eyebrow { display: inline-flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--mint); margin-bottom: 8px; font-weight: 600; }
  .card-title { font-size: 26px; font-weight: 700; color: var(--ink); margin: 0 0 6px; letter-spacing: -0.5px; }
  .card-title-sm { font-size: 17px; font-weight: 700; color: var(--ink); margin: 0; }
  .card-sub { color: var(--ink-3); font-size: 13px; line-height: 1.55; margin: 0; max-width: 640px; }
  .inline-neon { color: var(--mint); font-weight: 600; }
  .hero-badge { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 999px; background: #DCFCE7; border: 1px solid #BBF7D0; color: #166534; font-size: 11px; font-weight: 600; transform: rotate(-1.5deg); box-shadow: 0 2px 8px rgba(22,101,52,0.08); }
  .hero-badge svg { color: var(--mint); }
  .card-head-meta { display: flex; gap: 8px; }
  .pill { padding: 4px 10px; border-radius: 999px; font-size: 10px; letter-spacing: 1px; background: #F3F4F6; border: 1px solid #E5E7EB; color: var(--ink-3); font-weight: 600; }
  .pill-busy { background: #FEF3C7; border-color: #FDE68A; color: #92400E; box-shadow: none; }

  /* Status blocks */
  .status-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .status-block {
    display: flex; align-items: center; gap: 12px;
    padding: 14px; border-radius: 14px;
    background: var(--card);
    border: 1.5px solid var(--mint-border);
  }
  .status-block.neon {
    border-color: var(--mint);
    background: var(--mint-bg);
    box-shadow: 0 2px 10px rgba(16,185,129,0.10);
  }
  .status-block:nth-child(3n+2) { border-radius: 12px 16px 14px 18px; }
  .status-block-icon { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--mint-bg); border: 1px solid var(--mint-border); color: var(--mint); flex-shrink: 0; }
  .status-block-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
  .status-block-value { font-size: 15px; font-weight: 700; color: var(--ink); font-family: 'JetBrains Mono', 'Consolas', monospace; word-break: break-all; }

  /* Action grid */
  .action-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .action-node {
    position: relative; display: flex; align-items: center; gap: 12px;
    padding: 14px; border-radius: 14px;
    background: var(--card);
    border: 1.5px solid var(--line);
    color: var(--ink-2); cursor: pointer; transition: all .2s ease; text-align: left;
    width: 100%;
  }
  .action-node:hover { border-color: var(--mint); background: var(--mint-bg); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(16,185,129,0.12); }
  .action-node:disabled { opacity: 0.55; cursor: not-allowed; }
  .action-node-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--mint-bg); border: 1px solid var(--mint-border); color: var(--mint); flex-shrink: 0; }
  .action-node-body { min-width: 0; flex: 1; }
  .action-node-title { font-size: 13px; font-weight: 600; color: var(--ink); }
  .action-node-desc { font-size: 11px; color: var(--ink-3); font-family: 'JetBrains Mono', 'Consolas', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .action-node-arrow { color: var(--ink-4); flex-shrink: 0; }
  .action-node:nth-of-type(2) { transform: translateY(2px); }
  .action-node:nth-of-type(2):hover { transform: translateY(1px); }

  .action-primary {
    grid-column: span 4;
    padding: 18px 16px;
    background: var(--mint-bg-2);
    border: 1.5px solid var(--mint);
    box-shadow: 0 6px 24px rgba(16,185,129,0.18);
  }
  .action-primary:hover { background: var(--mint-bg-2); border-color: var(--mint); box-shadow: 0 8px 30px rgba(16,185,129,0.25); }
  .action-primary .action-node-icon { width: 46px; height: 46px; background: #FFFFFF; border-color: var(--mint); box-shadow: 0 2px 10px rgba(16,185,129,0.2); }
  .action-primary .action-node-title { font-size: 16px; color: var(--mint); font-weight: 700; }
  .action-primary .action-node-desc { color: var(--ink-3); }

  /* Progress ring */
  .progress-ring { position: relative; width: 38px; height: 38px; flex-shrink: 0; }
  .ring-svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .ring-bg { fill: none; stroke: #E5E7EB; stroke-width: 3; }
  .ring-fg { fill: none; stroke: var(--mint); stroke-width: 3; stroke-linecap: round; transition: stroke-dasharray .2s; }

  /* Terminal preview */
  .card-terminal-preview .terminal { height: 220px; }
  .ghost-link { display: inline-flex; align-items: center; gap: 3px; background: none; border: none; color: var(--mint); cursor: pointer; font-size: 12px; padding: 0; font-weight: 600; }
  .ghost-link:hover { text-decoration: underline; }

  /* Config fields */
  .field-row { display: flex; flex-direction: column; gap: 8px; }
  .field-label { font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; color: var(--ink-3); font-weight: 600; }
  .field-input {
    width: 100%; padding: 12px 14px; border-radius: 12px;
    background: var(--card);
    border: 1.5px solid var(--ink);
    color: var(--ink); font-size: 14px; font-family: 'JetBrains Mono', 'Consolas', monospace;
    outline: none; transition: all .18s ease;
  }
  .field-input:focus { border-color: var(--mint); box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }

  /* Version grid */
  .version-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .version-tile {
    display: flex; flex-direction: column; gap: 4px;
    padding: 12px; border-radius: 12px;
    background: var(--card);
    border: 1.5px solid var(--line);
    cursor: pointer; transition: all .18s ease; text-align: left;
  }
  .version-tile:hover { border-color: var(--mint); background: var(--mint-bg); }
  .version-tile.active { border-color: var(--mint); background: var(--mint-bg); box-shadow: 0 2px 10px rgba(16,185,129,0.15); }
  .version-tile-id { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 700; color: var(--ink); }
  .version-tile-label { font-size: 11px; color: var(--ink-3); }
  .version-tag { align-self: flex-start; font-size: 9px; letter-spacing: 1px; padding: 2px 6px; border-radius: 4px; background: var(--mint-bg); color: var(--mint); border: 1px solid var(--mint-border); margin-top: 2px; font-weight: 600; }
  .tag-modded { background: var(--lavender-soft); color: #6D28D9; border-color: var(--lavender); }
  .tag-classic { background: #FEF3C7; color: #92400E; border-color: #FDE68A; }

  /* RAM slider */
  .ram-track { display: flex; flex-direction: column; gap: 14px; }
  .ram-slider { width: 100%; -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #6EE7B7, var(--mint)); outline: none; cursor: pointer; }
  .ram-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF; border: 2.5px solid var(--mint); box-shadow: 0 2px 8px rgba(16,185,129,0.25); cursor: pointer; }
  .ram-slider::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: #FFFFFF; border: 2.5px solid var(--mint); cursor: pointer; }
  .ram-ticks { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
  .ram-tick { padding: 6px 0; border-radius: 8px; background: var(--card); border: 1px solid var(--line); color: var(--ink-3); font-size: 11px; cursor: pointer; transition: all .15s; font-family: monospace; font-weight: 600; }
  .ram-tick:hover { color: var(--ink); border-color: var(--mint); }
  .ram-tick.active { background: var(--mint-bg); border-color: var(--mint); color: var(--mint); }

  /* Resolution grid */
  .resolution-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .res-tile { display: flex; flex-direction: column; gap: 6px; padding: 14px; border-radius: 12px; background: var(--card); border: 1.5px solid var(--line); cursor: pointer; transition: all .18s; text-align: left; }
  .res-tile:hover { border-color: var(--mint); background: var(--mint-bg); }
  .res-tile.active { border-color: var(--mint); background: var(--mint-bg); box-shadow: 0 2px 10px rgba(16,185,129,0.15); }
  .res-tile-head { display: flex; align-items: center; gap: 6px; color: var(--ink); font-size: 13px; font-weight: 700; font-family: monospace; }
  .res-tile-head svg { color: var(--mint); }
  .res-tile-desc { font-size: 11px; color: var(--ink-3); }

  /* Terminal */
  .terminal {
    background: #1E293B;
    border: 1.5px solid #334155;
    border-radius: 12px;
    padding: 14px 16px;
    height: 460px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Consolas', 'Courier New', monospace;
    font-size: 12.5px; line-height: 1.65;
    box-shadow: inset 0 0 30px rgba(0,0,0,0.25);
    color: #E2E8F0;
  }
  .terminal.compact { height: 220px; }
  .terminal::-webkit-scrollbar { width: 8px; }
  .terminal::-webkit-scrollbar-track { background: transparent; }
  .terminal::-webkit-scrollbar-thumb { background: rgba(110,231,183,0.3); border-radius: 4px; }
  .terminal-line { display: flex; gap: 10px; align-items: baseline; white-space: pre-wrap; word-break: break-word; }
  .terminal-prompt { color: #94A3B8; margin-bottom: 6px; border-bottom: 1px dashed rgba(110,231,183,0.2); padding-bottom: 6px; }
  .t-prompt { color: #6EE7B7; }
  .t-sep { color: #64748B; }
  .t-path { color: #C4B5FD; }
  .t-cmd { color: #F1F5F9; }
  .t-ts { color: #64748B; font-size: 11px; flex-shrink: 0; }
  .t-tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; flex-shrink: 0; font-weight: 600; letter-spacing: 1px; }
  .t-msg { color: #E2E8F0; }
  .t-info .t-tag { background: rgba(110,231,183,0.15); color: #6EE7B7; }
  .t-info .t-msg { color: #CBD5E1; }
  .t-ok .t-tag { background: rgba(110,231,183,0.2); color: #34D399; }
  .t-ok .t-msg { color: #6EE7B7; }
  .t-warn .t-tag { background: rgba(245,158,11,0.18); color: #FCD34D; }
  .t-warn .t-msg { color: #FDE68A; }
  .t-error .t-tag { background: rgba(251,113,133,0.18); color: #FDA4AF; }
  .t-error .t-msg { color: #FECDD3; }
  .t-cmd .t-tag { background: rgba(196,181,253,0.18); color: #C4B5FD; }
  .t-cmd .t-msg { color: #DDD6FE; }
  .t-muted { color: #64748B; font-style: italic; }

  .terminal-toolbar { display: flex; gap: 8px; }
  .term-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px; background: var(--mint-bg); border: 1px solid var(--mint-border); color: var(--mint); font-size: 12px; cursor: pointer; transition: all .15s; font-weight: 600; }
  .term-btn:hover { background: var(--mint-bg-2); box-shadow: 0 2px 8px rgba(16,185,129,0.15); }
  .term-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .card-terminal-full { padding: 22px; }

  /* Status strip footer */
  .statusstrip {
    position: relative; z-index: 5;
    height: 34px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 18px;
    background: linear-gradient(0deg, var(--paper-2), var(--paper));
    border-top: 1px solid var(--mint-border);
    font-size: 11px; color: var(--ink-3);
    flex-shrink: 0;
  }
  .statusstrip-left, .statusstrip-center, .statusstrip-right { display: flex; align-items: center; gap: 8px; }
  .status-led { width: 8px; height: 8px; border-radius: 50%; }
  .led-idle { background: var(--mint); box-shadow: 0 0 8px rgba(16,185,129,0.45); }
  .led-busy { background: var(--amber); box-shadow: 0 0 10px rgba(245,158,11,0.5); animation: pulse 1s infinite; }
  @keyframes pulse { 50% { opacity: 0.4; } }
  .statusstrip .mono { font-family: 'JetBrains Mono', monospace; color: var(--ink-2); }
  .sep { color: var(--ink-4); }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Scrollbars */
  .nav::-webkit-scrollbar, .workspace::-webkit-scrollbar { width: 8px; }
  .nav::-webkit-scrollbar-track, .workspace::-webkit-scrollbar-track { background: transparent; }
  .nav::-webkit-scrollbar-thumb, .workspace::-webkit-scrollbar-thumb { background: rgba(16,185,129,0.25); border-radius: 4px; }
  .nav::-webkit-scrollbar-thumb:hover, .workspace::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.45); }

  /* Responsive */
  @media (max-width: 1100px) {
    .shell { grid-template-columns: 220px 1fr; }
    .action-grid { grid-template-columns: repeat(2, 1fr); }
    .action-primary { grid-column: span 2; }
    .status-grid { grid-template-columns: repeat(2, 1fr); }
    .version-grid, .resolution-grid { grid-template-columns: repeat(2, 1fr); }
    .ram-ticks { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 760px) {
    .hallway-root { height: auto; min-height: 100vh; overflow: visible; }
    .shell { grid-template-columns: 1fr; padding: 12px; gap: 12px; overflow: visible; }
    .nav { flex-direction: row; flex-wrap: wrap; gap: 10px; padding: 12px; overflow: visible; }
    .nav-grid { flex-direction: row; flex-wrap: wrap; }
    .nav-section-title { width: 100%; }
    .telemetry { flex: 1 1 200px; min-width: 200px; }
    .nav-footer { flex-direction: row; width: 100%; border-top: none; padding-top: 0; }
    .status-grid { grid-template-columns: 1fr; }
    .action-grid { grid-template-columns: 1fr; }
    .action-primary { grid-column: span 1; }
    .version-grid, .resolution-grid { grid-template-columns: 1fr 1fr; }
    .titlebar-center { display: none; }
    .workspace { overflow: visible; }
    .action-node:nth-of-type(2) { transform: none; }
    .status-block:nth-child(3n+2) { border-radius: 14px; }
  }
`;

// Inject the embedded styles once.
if (typeof document !== 'undefined' && !document.getElementById('hallway-studio-styles')) {
  const style = document.createElement('style');
  style.id = 'hallway-studio-styles';
  style.textContent = STYLES;
  document.head.appendChild(style);
}
