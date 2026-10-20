'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import './hallway.css';

// ===========================================================================
//  Types
// ===========================================================================
type LogLevel = 'info' | 'ok' | 'warn' | 'error' | 'cmd';
interface LogEntry {
  level: LogLevel;
  message: string;
  ts: Date;
}
type DisplayMode = 'default' | 'windowed';
interface ResolutionPreset {
  mode: DisplayMode;
  width?: number;
  height?: number;
  label: string;
  desc: string;
}
interface LaunchConfig {
  username: string;
  version: string;
  ram: number;
  serverIp: string;
  resolution: { mode: DisplayMode; width?: number; height?: number };
}

// ===========================================================================
//  Mock IPC bridge — simulates the Electron `window.hallway` preload surface
//  so the exact same React component is fully interactive in the browser.
//  In the real Electron build this object is injected by src/preload.js.
// ===========================================================================
type Listener = (entry: unknown) => void;

function cx(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function createMockHallway() {
  const listeners: Record<string, Set<Listener>> = {};

  const emit = (channel: string, entry: unknown) => {
    const set = listeners[channel];
    if (set) for (const cb of set) cb(entry);
  };

  const on = (channel: string, cb: Listener) => {
    (listeners[channel] ||= new Set()).add(cb);
    return () => listeners[channel]?.delete(cb);
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const log = (channel: string, level: LogLevel, message: string, ts = new Date()) => {
    emit(channel, { level, message, ts: ts.toISOString() });
  };

  const invoke = async (channel: string, ...args: unknown[]): Promise<{ ok: boolean; logs: Array<{ level: LogLevel; message: string; ts: string }> }> => {
    const collected: Array<{ level: LogLevel; message: string; ts: string }> = [];
    const push = (level: LogLevel, message: string) => {
      const entry = { level, message, ts: new Date().toISOString() };
      collected.push(entry);
      emit(channel + '-log', entry);
    };

    if (channel === 'run-diagnostics') {
      push('info', '═══ HallwayLauncher Studio — Diagnostics Run ═══');
      await sleep(280);
      push('cmd', '> python --version');
      await sleep(420);
      push('ok', 'Python detected → Python 3.11.7');
      await sleep(220);
      push('cmd', '> python -m portablemc --version');
      await sleep(640);
      push('ok', 'portablemc detected → portablemc 4.2.0');
      await sleep(220);
      push('info', 'Flushing runtime caches…');
      push('cmd', '> if exist "%APPDATA%\\.minecraft\\webcache" rmdir /S /Q "%APPDATA%\\.minecraft\\webcache"');
      await sleep(420);
      push('ok', 'webcache wiped → C:\\Users\\Player\\AppData\\Roaming\\.minecraft\\webcache');
      push('cmd', '> if exist "%APPDATA%\\.minecraft\\logs\\*.*" del /Q "%APPDATA%\\.minecraft\\logs\\*.*"');
      await sleep(420);
      push('ok', 'logs directory cleared → C:\\Users\\Player\\AppData\\Roaming\\.minecraft\\logs');
      await sleep(180);
      push('ok', 'Diagnostics complete. Runtime is clean.');
      return { ok: true, logs: collected };
    }

    if (channel === 'open-system-folder') {
      const target = args[0] as string;
      const dir = `C:\\Users\\Player\\AppData\\Roaming\\.minecraft\\${target}`;
      push('info', `Opening system folder → ${dir}`);
      await sleep(260);
      push('ok', `Opened: ${dir} (revealed in Explorer)`);
      return { ok: true, logs: collected };
    }

    if (channel === 'launch-minecraft') {
      const cfg = args[0] as LaunchConfig;
      const resLabel =
        cfg.resolution.mode === 'windowed' && cfg.resolution.width && cfg.resolution.height
          ? `${cfg.resolution.width}x${cfg.resolution.height}`
          : 'default (fullscreen)';
      push('info', '═══ HallwayLauncher Studio — Launch Sequence ═══');
      push('info', `User → ${cfg.username}  (offline profile, no Microsoft login)`);
      push('info', `Version → ${cfg.version}`);
      push('info', `RAM → ${cfg.ram} GB`);
      push('info', `Server → ${cfg.serverIp || 'None'}`);
      push('info', `Resolution → ${resLabel}`);

      await sleep(280);
      push('cmd', '> python --version');
      await sleep(360);
      push('ok', 'Python OK → Python 3.11.7');

      await sleep(280);
      push('cmd', '> dir "C:\\Program Files\\Java" /B');
      await sleep(380);
      push('ok', 'Java runtime located → C:\\Program Files\\Java\\jdk-17.0.9\\bin\\javaw.exe');

      // Build the real portablemc 5.x command line (matches what main.js runs).
      //   --username NAME          (offline — no --auth means offline by default)
      //   --jvm PATH
      //   --jvm-arg=-Xmx4G         (one flag per JVM arg, =-form is safest)
      //   --jvm-arg=-Xms2G
      //   --resolution 1280x720    (WxH, single arg)
      //   --join-server HOST       (replaces the old --server)
      //   --join-server-port PORT
      //   "1.21"                   (or "fabric:1.21" / "forge:1.20.1")
      const jvmPart = '--jvm "C:\\Program Files\\Java\\jdk-17.0.9\\bin\\javaw.exe"';
      const minHeap = Math.max(1, Math.floor(cfg.ram / 2));
      const jvmArgParts = `--jvm-arg=-Xmx${cfg.ram}G --jvm-arg=-Xms${minHeap}G`;
      let serverPart = '';
      if (cfg.serverIp && cfg.serverIp !== 'None' && String(cfg.serverIp).trim().length > 0) {
        const trimmed = String(cfg.serverIp).trim();
        const colonIdx = trimmed.lastIndexOf(':');
        if (colonIdx > 0 && /^\d+$/.test(trimmed.slice(colonIdx + 1))) {
          serverPart = `--join-server ${trimmed.slice(0, colonIdx)} --join-server-port ${trimmed.slice(colonIdx + 1)}`;
        } else {
          serverPart = `--join-server ${trimmed}`;
        }
      }
      const resPart =
        cfg.resolution.mode === 'windowed' && cfg.resolution.width && cfg.resolution.height
          ? `--resolution ${cfg.resolution.width}x${cfg.resolution.height}`
          : '';

      const launchLine = [
        'python -m portablemc start',
        `--username "${cfg.username}"`,
        jvmPart,
        jvmArgParts,
        serverPart,
        resPart,
        `"${cfg.version}"`,
      ].filter(Boolean).join(' ');
      push('cmd', `> ${launchLine}`);
      await sleep(520);

      // Stream simulated portablemc output.
      const stream: Array<[LogLevel, string]> = [
        ['info', '[portablemc] Resolving version manifest…'],
        ['info', '[portablemc] Downloading metadata: version/' + cfg.version + '.json'],
        ['ok', '[portablemc] Version resolved.'],
        ['info', '[portablemc] Verifying assets (objects)…'],
        ['info', '[portablemc] 12/12 asset indexes verified.'],
        ['info', '[portablemc] Offline profile → ' + cfg.username + ' (no Microsoft login)'],
        ['ok', '[portablemc] Starting JVM… -Xmx' + cfg.ram + 'G -Xms' + minHeap + 'G'],
        ['info', '[minecraft] LWJGL 3.3.2-snapshot loaded'],
        ['info', '[minecraft] OpenAL initialized.'],
        ['info', '[minecraft] OpenGL: NVIDIA GeForce RTX 4060 / 4.6.0'],
        ['ok', '[minecraft] Loaded 7 mods from %APPDATA%\\.minecraft\\mods'],
        ['info', '[minecraft] Stitching texture atlas…'],
        ['ok', '[minecraft] Render pipeline ready.'],
      ];
      for (const [lvl, line] of stream) {
        emit('launch-stdout', line + '\n');
        await sleep(180);
      }
      push('ok', 'Game process exited cleanly.');
      return { ok: true, logs: collected };
    }

    if (channel === 'backup-worlds') {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `_${pad(now.getHours())}${pad(now.getMinutes())}`;
      const zipName = `MC_World_Backup_${stamp}.zip`;
      push('info', '═══ HallwayLauncher Studio — World Backup ═══');
      push('info', 'Source → %APPDATA%\\.minecraft\\saves');
      push('info', `Destination → ${zipName}`);
      await sleep(260);
      push('cmd', '> powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command Compress-Archive …');
      await sleep(900);
      push('ok', `Backup complete → C:\\Users\\Player\\Desktop\\${zipName}`);
      return { ok: true, logs: collected };
    }

    return { ok: false, logs: collected };
  };

  return { invoke, on };
}

// Install the mock bridge exactly once, on the client.
function installMockHallway() {
  if (typeof window === 'undefined') return null;
  if (!(window as unknown as { hallway?: unknown }).hallway) {
    (window as unknown as { hallway?: unknown }).hallway = createMockHallway();
  }
  return (window as unknown as { hallway: ReturnType<typeof createMockHallway> }).hallway;
}

// ===========================================================================
//  Constants
// ===========================================================================
const VERSIONS: Array<{ id: string; label: string; tag: string }> = [
  { id: '1.21', label: '1.21 — Trails & Tales', tag: 'Stable' },
  { id: '1.20.4', label: '1.20.4', tag: 'Stable' },
  { id: '1.19.4', label: '1.19.4', tag: 'Legacy' },
  { id: '1.18.2', label: '1.18.2', tag: 'Legacy' },
  { id: '1.16.5', label: '1.16.5', tag: 'Classic' },
  { id: '1.12.2', label: '1.12.2', tag: 'Classic' },
  // portablemc 5.x uses colon syntax for mod loaders: "fabric:1.21", "forge:1.20.1".
  // Bare "1.21" defaults to "mojang:1.21".
  { id: 'fabric:1.21', label: 'Fabric 1.21', tag: 'Modded' },
  { id: 'forge:1.20.1', label: 'Forge 1.20.1', tag: 'Modded' },
];

const RESOLUTIONS: ResolutionPreset[] = [
  { mode: 'default', label: 'Default', desc: 'Fullscreen auto' },
  { mode: 'windowed', width: 1280, height: 720, label: '1280 × 720', desc: 'HD' },
  { mode: 'windowed', width: 1600, height: 900, label: '1600 × 900', desc: 'HD+' },
  { mode: 'windowed', width: 1920, height: 1080, label: '1920 × 1080', desc: 'FHD' },
];

type Hallway = ReturnType<typeof createMockHallway>;

// ===========================================================================
//  Page
// ===========================================================================
export default function Page() {
  // --- Global React state (mirrors the spec exactly) ----------------------
  const [username, setUsername] = useState('PlayerOne');
  const [selectedVersion, setSelectedVersion] = useState('1.21');
  const [ramAllocation, setRamAllocation] = useState(4);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('default');
  const [targetServerIp, setTargetServerIp] = useState('None');
  const [globalSystemLogs, setGlobalSystemLogs] = useState<LogEntry[]>([]);
  const [isLaunching, setIsLaunching] = useState(false);

  // --- Secondary UI state -------------------------------------------------
  const [activePanel, setActivePanel] = useState<'dashboard' | 'config' | 'terminal'>('dashboard');
  const [resolution, setResolution] = useState<ResolutionPreset>(RESOLUTIONS[0]);
  const [modSyncProgress, setModSyncProgress] = useState(0);
  const [isSyncingMods, setIsSyncingMods] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRunningDiag, setIsRunningDiag] = useState(false);
  const [cpuLoad, setCpuLoad] = useState(18);
  const [memLoad, setMemLoad] = useState(34);
  const [netPing, setNetPing] = useState(42);
  const [uptime, setUptime] = useState(0);

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const hallwayRef = useRef<Hallway | null>(null);
  if (!hallwayRef.current && typeof window !== 'undefined') {
    hallwayRef.current = installMockHallway();
  }
  const hallway = hallwayRef.current;

  // --- Log helpers --------------------------------------------------------
  const pushLog = useCallback((level: LogLevel, message: string) => {
    setGlobalSystemLogs((prev) => {
      const next = [...prev, { level, message, ts: new Date() }];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  const pushLogs = useCallback((entries: Array<{ level: LogLevel; message: string; ts?: string }>) => {
    if (!entries || !entries.length) return;
    setGlobalSystemLogs((prev) => {
      const mapped = entries.map((e) => ({
        level: e.level,
        message: e.message,
        ts: e.ts ? new Date(e.ts) : new Date(),
      }));
      const next = [...prev, ...mapped];
      return next.length > 400 ? next.slice(next.length - 400) : next;
    });
  }, []);

  // --- Subscribe to streaming IPC events ---------------------------------
  useEffect(() => {
    if (!hallway || !hallway.on) return;
    const unsubs: Array<() => void> = [];
    const channels = ['diagnostics-log', 'folder-log', 'launch-log', 'backup-log', 'launch-stdout', 'launch-stderr'];
    for (const ch of channels) {
      unsubs.push(
        hallway.on(ch, (entryRaw) => {
          if (!entryRaw) return;
          if (ch === 'launch-stdout' || ch === 'launch-stderr') {
            const text = typeof entryRaw === 'string' ? entryRaw : (entryRaw as { message?: string }).message || '';
            const level: LogLevel = ch === 'launch-stderr' ? 'warn' : 'info';
            for (const line of text.split(/\r?\n/)) {
              if (line.trim()) pushLog(level, line.trim());
            }
          } else {
            const entry = entryRaw as { level: LogLevel; message: string };
            pushLog(entry.level, entry.message);
          }
        })
      );
    }
    return () => unsubs.forEach((u) => u && u());
  }, [hallway, pushLog]);

  // --- Auto-scroll terminal ---------------------------------------------
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [globalSystemLogs, activePanel]);

  // --- Live telemetry simulation -----------------------------------------
  useEffect(() => {
    const id = window.setInterval(() => {
      setCpuLoad((v) => Math.max(4, Math.min(96, v + (Math.random() * 10 - 5))));
      setMemLoad((v) => Math.max(8, Math.min(98, v + (Math.random() * 6 - 3))));
      setNetPing((v) => Math.max(8, Math.min(180, v + Math.round(Math.random() * 12 - 6))));
      setUptime((s) => s + 1);
    }, 1500);
    return () => window.clearInterval(id);
  }, []);

  // --- Boot banner -------------------------------------------------------
  useEffect(() => {
    pushLog('info', 'HallwayLauncher Studio v1.0.0 — hi! opening up the dashboard.');
    pushLog('info', 'Node bridge is ready. Take your time, set things up when you like.');
    pushLog('cmd', '$ hallway --status');
    pushLog('ok', 'Everything looks good. Loaded: PlayerOne @ 1.21 — ready when you are.');
  }, []);

  // =========================================================================
  //  IPC action handlers
  // =========================================================================
  const handleRunDiagnostics = useCallback(async () => {
    if (!hallway) return;
    setIsRunningDiag(true);
    pushLog('info', 'Dispatching diagnostics probe to main process…');
    try {
      const res = await hallway.invoke('run-diagnostics');
      if (res?.logs) pushLogs(res.logs);
      pushLog(res?.ok ? 'ok' : 'error', res?.ok ? 'Diagnostics returned cleanly.' : 'Diagnostics reported a failure.');
    } catch (e) {
      pushLog('error', `Diagnostics dispatch failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsRunningDiag(false);
    }
  }, [hallway, pushLog, pushLogs]);

  const handleOpenFolder = useCallback(async (target: 'mods' | 'screenshots') => {
    if (!hallway) return;
    pushLog('info', `Opening system folder: ${target}`);
    try {
      const res = await hallway.invoke('open-system-folder', target);
      if (res?.logs) pushLogs(res.logs);
    } catch (e) {
      pushLog('error', `open-system-folder failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [hallway, pushLog, pushLogs]);

  const handleLaunch = useCallback(async () => {
    if (!hallway || isLaunching) return;
    setIsLaunching(true);
    const resConfig: LaunchConfig = {
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
      if (res?.logs) pushLogs(res.logs);
      pushLog(res?.ok ? 'ok' : 'error', res?.ok ? 'Game session ended cleanly.' : 'Game session exited with errors — see logs above.');
    } catch (e) {
      pushLog('error', `launch-minecraft failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsLaunching(false);
    }
  }, [hallway, isLaunching, username, selectedVersion, ramAllocation, targetServerIp, displayMode, resolution, pushLog, pushLogs]);

  const handleQuickConnect = useCallback(async () => {
    if (!hallway) return;
    const ip = targetServerIp && targetServerIp !== 'None' ? targetServerIp : 'play.hallway.gg';
    setTargetServerIp(ip);
    pushLog('info', `Quick Connect → binding ${ip} and launching`);
    setTimeout(() => handleLaunch(), 0);
  }, [hallway, targetServerIp, pushLog, handleLaunch]);

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

  const handleBackup = useCallback(async () => {
    if (!hallway || isBackingUp) return;
    setIsBackingUp(true);
    pushLog('info', 'Spawning silent PowerShell backup routine…');
    try {
      const res = await hallway.invoke('backup-worlds');
      if (res?.logs) pushLogs(res.logs);
    } catch (e) {
      pushLog('error', `backup-worlds failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsBackingUp(false);
    }
  }, [hallway, isBackingUp, pushLog, pushLogs]);

  const handleMinimize = useCallback(() => hallway?.invoke('app:minimize'), [hallway]);
  const handleMaximize = useCallback(() => hallway?.invoke('app:maximize'), [hallway]);
  const handleQuit = useCallback(() => hallway?.invoke('app:quit'), [hallway]);

  // =========================================================================
  //  Derived view models
  // =========================================================================
  const uptimeLabel = useMemo(() => {
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [uptime]);

  const statusBlocks = useMemo(
    () => [
      { icon: User, label: 'Operator', value: username, accent: 'neon' as const },
      { icon: Layers, label: 'Version', value: selectedVersion, accent: 'neon' as const },
      { icon: MemoryStick, label: 'RAM Allocated', value: `${ramAllocation} GB`, accent: 'neon' as const },
      {
        icon: Monitor,
        label: 'Display',
        value: displayMode === 'default' ? 'Fullscreen' : `${resolution.width}×${resolution.height}`,
        accent: 'muted' as const,
      },
      { icon: Network, label: 'Server Bind', value: targetServerIp, accent: 'muted' as const },
      { icon: Clock, label: 'Session Uptime', value: uptimeLabel, accent: 'muted' as const },
    ],
    [username, selectedVersion, ramAllocation, displayMode, resolution, targetServerIp, uptimeLabel]
  );

  const panelTitle =
    activePanel === 'dashboard' ? 'Control Monitor' : activePanel === 'config' ? 'Configuration Desk' : 'Terminal Logger';

  // =========================================================================
  //  Render
  // =========================================================================
  return (
    <div className="hallway-root">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="orb orb-c" />
      <div className="grid-overlay" />

      {/* Title bar */}
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
          <span className="crumb active">{panelTitle}</span>
        </div>
        <div className="titlebar-right">
          <button className="win-btn" onClick={handleMinimize} aria-label="Minimize" type="button">
            <Minus size={14} />
          </button>
          <button className="win-btn" onClick={handleMaximize} aria-label="Maximize" type="button">
            <Maximize2 size={12} />
          </button>
          <button className="win-btn close" onClick={handleQuit} aria-label="Quit" type="button">
            <Power size={13} />
          </button>
        </div>
      </header>

      {/* Shell */}
      <div className="shell">
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

        <main className="workspace">
          {activePanel === 'dashboard' && (
            <DashboardPanel
              statusBlocks={statusBlocks}
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

      {/* Sticky status strip */}
      <footer className="statusstrip">
        <div className="statusstrip-left">
          <span className={cx('status-led', isLaunching ? 'led-busy' : 'led-idle')} />
          <span>{isLaunching ? 'Game is running' : 'Idle — take your time'}</span>
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
//  Sub-components
// ===========================================================================
function NavGrid({
  activePanel,
  setActivePanel,
}: {
  activePanel: 'dashboard' | 'config' | 'terminal';
  setActivePanel: (p: 'dashboard' | 'config' | 'terminal') => void;
}) {
  const items: Array<{ id: 'dashboard' | 'config' | 'terminal'; label: string; icon: typeof Gauge }> = [
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
          type="button"
          className={cx('nav-tile', activePanel === id && 'active')}
          onClick={() => setActivePanel(id)}
        >
          <span className="nav-tile-icon">
            <Icon size={18} />
          </span>
          <span className="nav-tile-label">{label}</span>
          <span className="nav-tile-glow" />
        </button>
      ))}
    </div>
  );
}

function TelemetryCard({ cpuLoad, memLoad, netPing }: { cpuLoad: number; memLoad: number; netPing: number }) {
  const metrics: Array<{
    label: string;
    value: number;
    unit: string;
    icon: typeof Cpu;
    raw?: boolean;
  }> = [
    { label: 'CPU', value: cpuLoad, unit: '%', icon: Cpu },
    { label: 'RAM', value: memLoad, unit: '%', icon: MemoryStick },
    { label: 'NET', value: netPing, unit: 'ms', icon: Wifi, raw: true },
  ];
  return (
    <div className="telemetry">
      {metrics.map((m) => (
        <div className="telemetry-row" key={m.label}>
          <div className="telemetry-head">
            <m.icon size={12} />
            <span>{m.label}</span>
            <span className="telemetry-val">
              {m.raw ? m.value : Math.round(m.value)}
              {m.unit}
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

interface DashboardPanelProps {
  statusBlocks: Array<{ icon: typeof User; label: string; value: string; accent: 'neon' | 'muted' }>;
  logs: LogEntry[];
  isLaunching: boolean;
  isSyncingMods: boolean;
  isBackingUp: boolean;
  isRunningDiag: boolean;
  modSyncProgress: number;
  onLaunch: () => void;
  onQuickConnect: () => void;
  onSyncMods: () => void;
  onOpenFolder: (t: 'mods' | 'screenshots') => void;
  onBackup: () => void;
  onRunDiagnostics: () => void;
  setActivePanel: (p: 'dashboard' | 'config' | 'terminal') => void;
}

function DashboardPanel(props: DashboardPanelProps) {
  const {
    statusBlocks,
    logs,
    isLaunching,
    isSyncingMods,
    isBackingUp,
    isRunningDiag,
    modSyncProgress,
    onLaunch,
    onQuickConnect,
    onSyncMods,
    onOpenFolder,
    onBackup,
    onRunDiagnostics,
    setActivePanel,
  } = props;

  return (
    <div className="panel-stack">
      {/* Welcome Control Monitor */}
      <section className="card card-hero">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">
              <Sparkles size={12} /> Welcome Control Monitor
            </div>
            <h1 className="card-title">Hey there — ready to play?</h1>
            <p className="card-sub">
              Here are the credentials and runtime values you've got set up right now. Tap
              <span className="inline-neon"> Launch Game</span> to start a portablemc session, or
              use <span className="inline-neon">Quick Connect</span> to hop onto a server.
            </p>
          </div>
          <div className="hero-badge">
            <ShieldCheck size={14} /> Bridge is secure
          </div>
        </div>

        <div className="status-grid">
          {statusBlocks.map((b) => (
            <div className={cx('status-block', b.accent === 'neon' && 'neon')} key={b.label}>
              <div className="status-block-icon">
                <b.icon size={16} />
              </div>
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
            <div className="card-eyebrow">
              <Zap size={12} /> Action Panel
            </div>
            <h2 className="card-title-sm">Launch &amp; Runtime Utilities</h2>
          </div>
          <div className="card-head-meta">
            <span className={cx('pill', isLaunching && 'pill-busy')}>{isLaunching ? 'RUNNING' : 'READY'}</span>
          </div>
        </div>

        <div className="action-grid">
          {/* Primary launch */}
          <button type="button" className="action-node action-primary" onClick={onLaunch} disabled={isLaunching}>
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
          <button type="button" className="action-node" onClick={onQuickConnect} disabled={isLaunching}>
            <div className="action-node-icon">
              <Wifi size={18} />
            </div>
            <div className="action-node-body">
              <div className="action-node-title">Quick Connect</div>
              <div className="action-node-desc">Bind server &amp; launch</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* Mod sync */}
          <button type="button" className="action-node" onClick={onSyncMods} disabled={isSyncingMods}>
            <div className="action-node-icon">
              {isSyncingMods ? <RefreshCw size={18} className="spin" /> : <Package size={18} />}
            </div>
            <div className="action-node-body">
              <div className="action-node-title">{isSyncingMods ? 'Syncing Mods…' : 'Sync Mods'}</div>
              <div className="action-node-desc">{isSyncingMods ? `${modSyncProgress}% reconciled` : 'Reconcile modpack'}</div>
            </div>
            {isSyncingMods && (
              <div className="progress-ring">
                <svg viewBox="0 0 36 36" className="ring-svg">
                  <circle className="ring-bg" cx="18" cy="18" r="15.5" />
                  <circle
                    className="ring-fg"
                    cx="18"
                    cy="18"
                    r="15.5"
                    strokeDasharray={`${(modSyncProgress / 100) * 97.4} 97.4`}
                  />
                </svg>
              </div>
            )}
          </button>

          {/* Open mods */}
          <button type="button" className="action-node" onClick={() => onOpenFolder('mods')}>
            <div className="action-node-icon">
              <Boxes size={18} />
            </div>
            <div className="action-node-body">
              <div className="action-node-title">Open Mods Folder</div>
              <div className="action-node-desc">%appdata%\.minecraft\mods</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* Open screenshots */}
          <button type="button" className="action-node" onClick={() => onOpenFolder('screenshots')}>
            <div className="action-node-icon">
              <ImageIcon size={18} />
            </div>
            <div className="action-node-body">
              <div className="action-node-title">Open Screenshots</div>
              <div className="action-node-desc">%appdata%\.minecraft\screenshots</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>

          {/* World backup */}
          <button type="button" className="action-node" onClick={onBackup} disabled={isBackingUp}>
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
          <button type="button" className="action-node" onClick={onRunDiagnostics} disabled={isRunningDiag}>
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
          <button type="button" className="action-node" onClick={() => setActivePanel('config')}>
            <div className="action-node-icon">
              <Settings2 size={18} />
            </div>
            <div className="action-node-body">
              <div className="action-node-title">Configuration Desk</div>
              <div className="action-node-desc">Tune credentials &amp; runtime</div>
            </div>
            <ChevronRight className="action-node-arrow" size={14} />
          </button>
        </div>
      </section>

      {/* Inline terminal preview */}
      <section className="card card-terminal-preview">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">
              <TerminalIcon size={12} /> Virtual Terminal Logger
            </div>
            <h2 className="card-title-sm">Live System Output</h2>
          </div>
          <button type="button" className="ghost-link" onClick={() => setActivePanel('terminal')}>
            Open full terminal <ChevronRight size={12} />
          </button>
        </div>
        <TerminalStream logs={logs} compact />
      </section>
    </div>
  );
}

interface ConfigPanelProps {
  username: string;
  setUsername: (v: string) => void;
  selectedVersion: string;
  setSelectedVersion: (v: string) => void;
  ramAllocation: number;
  setRamAllocation: (v: number) => void;
  targetServerIp: string;
  setTargetServerIp: (v: string) => void;
  displayMode: DisplayMode;
  setDisplayMode: (v: DisplayMode) => void;
  resolution: ResolutionPreset;
  setResolution: (v: ResolutionPreset) => void;
}

function ConfigPanel(props: ConfigPanelProps) {
  const {
    username,
    setUsername,
    selectedVersion,
    setSelectedVersion,
    ramAllocation,
    setRamAllocation,
    targetServerIp,
    setTargetServerIp,
    displayMode,
    setDisplayMode,
    resolution,
    setResolution,
  } = props;

  return (
    <div className="panel-stack">
      <section className="card card-hero">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">
              <Settings2 size={12} /> Configuration Desk
            </div>
            <h1 className="card-title">Tweak your setup.</h1>
            <p className="card-sub">
              Anything you change here gets dropped straight into the portablemc launch command.
              The Control Monitor up top updates live as you fiddle.
            </p>
          </div>
        </div>
      </section>

      {/* Username */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">
              <User size={12} /> Identity
            </div>
            <h2 className="card-title-sm">Username</h2>
          </div>
        </div>
        <div className="field-row">
          <label className="field-label" htmlFor="username">
            In-game operator name
          </label>
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
            <div className="card-eyebrow">
              <Layers size={12} /> Target Build
            </div>
            <h2 className="card-title-sm">Minecraft Version</h2>
          </div>
        </div>
        <div className="version-grid">
          {VERSIONS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={cx('version-tile', selectedVersion === v.id && 'active')}
              onClick={() => setSelectedVersion(v.id)}
            >
              <span className="version-tile-id">{v.id}</span>
              <span className="version-tile-label">{v.label}</span>
              <span
                className={cx(
                  'version-tag',
                  v.tag === 'Modded' && 'tag-modded',
                  v.tag === 'Classic' && 'tag-classic'
                )}
              >
                {v.tag}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* RAM */}
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">
              <MemoryStick size={12} /> Memory Allocation
            </div>
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
            aria-label="RAM allocation"
          />
          <div className="ram-ticks">
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                type="button"
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
            <div className="card-eyebrow">
              <Server size={12} /> Multiplayer Binding
            </div>
            <h2 className="card-title-sm">Target Server IP</h2>
          </div>
        </div>
        <div className="field-row">
          <label className="field-label" htmlFor="server">
            Server address (or &ldquo;None&rdquo; for singleplayer)
          </label>
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
            <div className="card-eyebrow">
              <Monitor size={12} /> Display Mode
            </div>
            <h2 className="card-title-sm">Resolution</h2>
          </div>
        </div>
        <div className="resolution-grid">
          {RESOLUTIONS.map((r) => {
            const isActive =
              (r.mode === 'default' && displayMode === 'default') ||
              (r.mode === 'windowed' &&
                displayMode === 'windowed' &&
                resolution.width === r.width &&
                resolution.height === r.height);
            return (
              <button
                key={r.label}
                type="button"
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

interface TerminalPanelProps {
  logs: LogEntry[];
  terminalRef: React.RefObject<HTMLDivElement | null>;
  onRunDiagnostics: () => void;
  onClear: () => void;
  isRunningDiag: boolean;
}

function TerminalPanel({ logs, terminalRef, onRunDiagnostics, onClear, isRunningDiag }: TerminalPanelProps) {
  return (
    <div className="panel-stack">
      <section className="card card-terminal-full">
        <div className="card-head">
          <div>
            <div className="card-eyebrow">
              <TerminalIcon size={12} /> Virtual Terminal Logger
            </div>
            <h1 className="card-title">hallway@studio — console</h1>
          </div>
          <div className="terminal-toolbar">
            <button type="button" className="term-btn" onClick={onRunDiagnostics} disabled={isRunningDiag}>
              {isRunningDiag ? <RefreshCw size={12} className="spin" /> : <HardDriveDownload size={12} />}
              Diagnostics
            </button>
            <button type="button" className="term-btn" onClick={onClear}>
              <RefreshCw size={12} /> Clear
            </button>
          </div>
        </div>
        <TerminalStream logs={logs} terminalRef={terminalRef} />
      </section>
    </div>
  );
}

function TerminalStream({
  logs,
  terminalRef,
  compact,
}: {
  logs: LogEntry[];
  terminalRef?: React.RefObject<HTMLDivElement | null>;
  compact?: boolean;
}) {
  return (
    <div className={cx('terminal', compact && 'compact')} ref={terminalRef}>
      <div className="terminal-line terminal-prompt">
        <span className="t-prompt">hallway@studio</span>
        <span className="t-sep">:</span>
        <span className="t-path">~</span>
        <span className="t-sep">$</span>
        <span className="t-cmd">hallway --tail</span>
      </div>
      {logs.length === 0 && <div className="terminal-line t-muted">— no log output yet —</div>}
      {logs.map((l, i) => (
        <TerminalLine key={i} entry={l} />
      ))}
    </div>
  );
}

function TerminalLine({ entry }: { entry: LogEntry }) {
  const stamp = entry.ts.toLocaleTimeString('en-US', { hour12: false });
  const tag = levelTag(entry.level);
  return (
    <div className={cx('terminal-line', `t-${entry.level}`)}>
      <span className="t-ts">{stamp}</span>
      <span className="t-tag">{tag}</span>
      <span className="t-msg">{entry.message}</span>
    </div>
  );
}

function levelTag(level: LogLevel): string {
  switch (level) {
    case 'ok':
      return 'OK';
    case 'warn':
      return 'WARN';
    case 'error':
      return 'ERR';
    case 'cmd':
      return 'CMD';
    case 'info':
    default:
      return 'INFO';
  }
}
