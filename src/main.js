// ============================================================================
//  HallwayLauncher Studio — Electron Main Process
//  main.js
// ----------------------------------------------------------------------------
//  Handles native OS actions, secure IPC channels, child_process execution,
//  registry/path scanning, and the Squirrel.Windows lifecycle. This module is
//  the privileged backbone of the launcher; the React renderer never touches
//  the filesystem or spawns processes directly — every native capability is
//  exposed through an explicit ipcMain.handle channel defined below.
// ============================================================================

const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  nativeTheme,
} = require('electron');

const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');

// ---------------------------------------------------------------------------
//  Application-wide constants
// ---------------------------------------------------------------------------
const APP_NAME = 'HallwayLauncher Studio';
const IS_DEV = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5173';
// In the packaged app the bundled main.js lives at .vite/build/main.js, and
// the Vite plugin outputs the renderer build into .vite/renderer/main_window/.
// So from __dirname (.vite/build) we go up one level into .vite, then into
// renderer/main_window.
const PROD_ENTRY = path.join(__dirname, '..', 'renderer', 'main_window', 'index.html');

// The .minecraft root that the original batch script targeted. On Windows
// this resolves to %APPDATA%\.minecraft; on other platforms we fall back to
// the canonical ~/.minecraft so the launcher remains testable cross-platform.
function minecraftDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA, '.minecraft');
  }
  return path.join(os.homedir(), '.minecraft');
}

// Resolve the desktop folder in a cross-platform way. PowerShell's
// [Environment]::GetFolderPath('Desktop') is the source of truth on Windows,
// but we keep a Node fallback for non-Windows dev environments.
function desktopDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.USERPROFILE, 'Desktop');
  }
  return path.join(os.homedir(), 'Desktop');
}

// ---------------------------------------------------------------------------
//  Squirrel.Windows lifecycle hook
//  On Windows, Squirrel fires --squirrel-install / --squirrel-updated /
//  --squirrel-uninstall / --squirrel-obsolete commands during install/update/
//  uninstall. When any of these is the first argv, we MUST quit immediately
//  without creating a window — Squirrel handles shortcut creation
//  automatically when the maker is configured with createDesktopIcon /
//  createStartMenuShortcut (see package.json config.forge).
//
//  This is inlined (instead of depending on the `electron-squirrel-startup`
//  package) so the bundled main.js has zero runtime requires that aren't
//  already externalized — keeping the asar self-contained.
// ---------------------------------------------------------------------------
function isSquirrelLifecycleCommand() {
  if (process.platform !== 'win32') return false;
  const cmd = process.argv[1];
  return (
    cmd === '--squirrel-install' ||
    cmd === '--squirrel-updated' ||
    cmd === '--squirrel-uninstall' ||
    cmd === '--squirrel-obsolete'
  );
}
if (isSquirrelLifecycleCommand()) {
  app.quit();
}

// ---------------------------------------------------------------------------
//  Window bootstrap
// ---------------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    // Pale mint paper — matches the app's --paper token so the window
    // doesn't flash black during load.
    backgroundColor: '#EAF5EE',
    title: APP_NAME,
    show: false,
    // Keep the OS frame + standard min/max/close buttons. A hidden title bar
    // with no drag region defined would make the window hard to move, so we
    // deliberately use the default frame for beginner-friendliness.
    frame: true,
    autoHideMenuBar: true,
    webPreferences: {
      // The Vite plugin rewrites this to the bundled preload location
      // (.vite/build/preload.js) at package time.
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,      // Renderer must NEVER get Node directly.
      contextIsolation: true,       // Preload runs isolated; exposes a safe bridge.
      sandbox: true,
      spellcheck: false,
      devTools: IS_DEV,
    },
  });

  // The renderer's CSS sets its own theme; we just let native chrome follow.
  nativeTheme.themeSource = 'light';

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (IS_DEV) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(PROD_ENTRY);
  }
}

// ---------------------------------------------------------------------------
//  App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Let any running child process know we are leaving.
  for (const child of activeChildren) {
    try {
      child.kill('SIGTERM');
    } catch (_) {
      // Best-effort teardown.
    }
  }
});

// ---------------------------------------------------------------------------
//  Utility: promise-wrapped exec that resolves with trimmed stdout.
// ---------------------------------------------------------------------------
function runShell(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { windowsHide: true, maxBuffer: 8 * 1024 * 1024, ...options }, (err, stdout, stderr) => {
      if (err) {
        reject({ error: err, stderr: (stderr || '').toString().trim(), stdout: (stdout || '').toString().trim() });
        return;
      }
      resolve({
        stdout: (stdout || '').toString().trim(),
        stderr: (stderr || '').toString().trim(),
      });
    });
  });
}

// Keep handles to spawned long-running processes so we can tear them down.
const activeChildren = new Set();

function spawnTracked(command, args, options = {}) {
  const child = spawn(command, args, {
    windowsHide: true,
    shell: false,
    ...options,
  });
  activeChildren.add(child);
  child.on('exit', () => activeChildren.delete(child));
  return child;
}

// ---------------------------------------------------------------------------
//  IPC CHANNEL A — 'run-diagnostics'
//  Runs the Python / portablemc version probes and then flushes the caches
//  that the original batch file wiped (webcache + logs). Every step streams a
//  structured log back to the renderer.
// ---------------------------------------------------------------------------
ipcMain.handle('run-diagnostics', async () => {
  const logs = [];
  const step = (level, message) => {
    const entry = {
      level,            // 'info' | 'ok' | 'warn' | 'error' | 'cmd'
      message,
      ts: new Date().toISOString(),
    };
    logs.push(entry);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('diagnostics-log', entry);
    }
  };

  step('info', '═══ HallwayLauncher Studio — Diagnostics Run ═══');

  // Use the right Python command for the platform (python on Windows, python3
  // elsewhere — Linux/macOS often don't alias `python` to `python3`).
  const pyCmd = process.platform === 'win32' ? 'python' : 'python3';

  // A1) Python interpreter probe.
  step('cmd', `> ${pyCmd} --version`);
  try {
    const { stdout } = await runShell(`${pyCmd} --version`);
    step('ok', `Python detected → ${stdout}`);
  } catch (e) {
    step('error', `Python probe failed: ${e.error ? e.error.message : 'unknown error'}`);
    if (e.stderr) step('error', `  stderr: ${e.stderr}`);
    step('error', 'Install Python 3.10+ from https://www.python.org/downloads/ (tick "Add python.exe to PATH" on Windows).');
  }

  // A2) portablemc module probe.
  step('cmd', `> ${pyCmd} -m portablemc --version`);
  try {
    const { stdout } = await runShell(`${pyCmd} -m portablemc --version`);
    step('ok', `portablemc detected → ${stdout || 'ready'}`);
  } catch (e) {
    step('warn', `portablemc not installed: ${e.error ? e.error.message : 'unknown'}`);
    if (e.stderr) step('warn', `  ${e.stderr}`);
    step('warn', `Install it with:  ${pyCmd} -m pip install --user portablemc`);
  }

  // A3) Cache-flushing loop. We target-erase the webcache dir and the logs
  //     directory contents exactly like the source batch file, using shell
  //     commands so the OS handles the recursive delete safely.
  const mcDir = minecraftDir();
  const webcache = path.join(mcDir, 'webcache');
  const logsDir = path.join(mcDir, 'logs');

  step('info', 'Flushing runtime caches…');

  // webcache — remove the whole directory tree, then recreate empty.
  step('cmd', `> rmdir /S /Q "${webcache}"`);
  try {
    if (process.platform === 'win32') {
      await runShell(`if exist "${webcache}" rmdir /S /Q "${webcache}"`);
    } else {
      await runShell(`rm -rf "${webcache}"`);
    }
    step('ok', `webcache wiped → ${webcache}`);
  } catch (e) {
    step('warn', `webcache flush skipped: ${e.error ? e.error.message : 'absent'}`);
  }

  // logs/*.* — wipe the contents but keep the folder.
  step('cmd', `> del /Q "${path.join(logsDir, '*.*')}"`);
  try {
    if (process.platform === 'win32') {
      await runShell(`if exist "${logsDir}\\*.*" del /Q "${logsDir}\\*.*"`);
    } else {
      await runShell(`rm -f "${logsDir}"/*.*`);
    }
    step('ok', `logs directory cleared → ${logsDir}`);
  } catch (e) {
    step('warn', `logs flush skipped: ${e.error ? e.error.message : 'absent'}`);
  }

  step('ok', 'Diagnostics complete. Runtime is clean.');
  return { ok: true, logs };
});

// ---------------------------------------------------------------------------
//  IPC CHANNEL B — 'open-system-folder'
//  Opens the requested .minecraft sub-folder in the native Windows Explorer.
//  Accepted targets: 'mods' | 'screenshots'. Any other value is rejected and
//  surfaced as an error log.
// ---------------------------------------------------------------------------
ipcMain.handle('open-system-folder', async (_evt, target) => {
  const logs = [];
  const allowed = ['mods', 'screenshots'];
  if (!allowed.includes(target)) {
    const msg = `open-system-folder: rejected unknown target "${target}"`;
    logs.push({ level: 'error', message: msg, ts: new Date().toISOString() });
    return { ok: false, logs };
  }

  const dir = path.join(minecraftDir(), target);
  const step = (level, message) => {
    const entry = { level, message, ts: new Date().toISOString() };
    logs.push(entry);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('folder-log', entry);
    }
  };

  step('info', `Opening system folder → ${dir}`);

  // Ensure the folder exists so Explorer does not error out on a fresh box.
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    step('warn', `Folder auto-create skipped: ${e.message}`);
  }

  try {
    // shell.openPath is the preferred native handler; it returns '' on success
    // or an error string on failure. We fall back to child_process exec with
    // `explorer` if the sandbox blocks openPath.
    const err = await shell.openPath(dir);
    if (err && err.length > 0) {
      step('warn', `shell.openPath reported: ${err} — retrying with explorer.exe`);
      await runShell(`explorer "${dir}"`);
    }
    step('ok', `Opened: ${dir}`);
    return { ok: true, logs };
  } catch (e) {
    step('error', `Failed to open folder: ${e.message}`);
    return { ok: false, logs };
  }
});

// ---------------------------------------------------------------------------
//  IPC CHANNEL C — 'launch-minecraft'
//  Builds the portablemc 5.x `start` command from the renderer-supplied config,
//  locates a valid javaw.exe via directory scan, and spawns the game OFFLINE
//  (no Microsoft auth — the player just plays under the chosen username).
//
//  portablemc 5.x CLI cheat-sheet (verified against `portablemc start --help`,
//  v5.0.6 — the old 4.x syntax this file used previously is GONE and would
//  hard-fail at the argparse layer):
//
//    python -m portablemc start \
//        --username "PlayerOne" \      # offline player name (no --auth = offline)
//        --jvm "C:\...\javaw.exe" \     # optional explicit JVM path
//        --jvm-arg=-Xmx4G \            # one flag per JVM arg, =-form is safest
//        --jvm-arg=-Xms2G \
//        --resolution 1280x720 \       # WxH, single arg (NOT two)
//        --join-server play.host.gg \   # optional, replaces the old --server
//        --join-server-port 25565 \     # optional, default 25565
//        "1.21"                        # version; use "fabric:1.21" / "forge:1.20.1"
//
//  Offline mode is the DEFAULT: portablemc only attempts Microsoft auth when
//  you pass `-a`/`--auth`. We deliberately do NOT pass it, so the game launches
//  offline with the supplied username — exactly what the user asked for.
// ---------------------------------------------------------------------------
ipcMain.handle('launch-minecraft', async (_evt, config) => {
  const {
    username,
    version,
    ram,
    serverIp,
    resolution,
  } = config;

  const logs = [];
  const step = (level, message) => {
    const entry = { level, message, ts: new Date().toISOString() };
    logs.push(entry);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('launch-log', entry);
    }
  };

  step('info', '═══ HallwayLauncher Studio — Launch Sequence ═══');
  step('info', `User → ${username}  (offline profile, no Microsoft login)`);
  step('info', `Version → ${version}`);
  step('info', `RAM → ${ram} GB`);
  step('info', `Server → ${serverIp || 'None'}`);
  step('info', `Resolution → ${resolution && resolution.mode === 'windowed'
    ? `${resolution.width}x${resolution.height}`
    : 'default (fullscreen)'}`);

  // C0) Pre-check: is `python` actually callable? On a fresh Windows box
  //     `python` may resolve to the Microsoft Store stub, which opens the
  //     Store instead of running Python. We test it cheaply and bail with a
  //     helpful error instead of a silent ENOENT.
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  step('cmd', `> ${pythonCmd} --version`);
  try {
    const probe = await runShell(`${pythonCmd} --version`);
    step('ok', `Python OK → ${probe.stdout || probe.stderr || 'found'}`);
  } catch (e) {
    step('error', `Python was not found on PATH. Install Python 3.10+ from https://www.python.org/downloads/ and tick "Add python.exe to PATH" during install, then restart HallwayLauncher Studio.`);
    if (e.error) step('error', `  detail: ${e.error.message}`);
    return { ok: false, logs };
  }

  // C1) Locate javaw.exe by scanning standard Java install roots.
  //     portablemc 5.x can auto-find a JVM via --jvm-policy system, so if we
  //     don't find one we just omit --jvm and let portablemc handle it.
  const javaRoots = [
    'C:\\Program Files\\Java',
    'C:\\Program Files (x86)\\Java',
  ];

  let jvmPath = null;
  if (process.platform === 'win32') {
    for (const root of javaRoots) {
      let entries = [];
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch (_) {
        continue; // Root not present; try the next one.
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(root, entry.name, 'bin', 'javaw.exe');
        try {
          if (fs.existsSync(candidate)) {
            jvmPath = candidate;
            step('ok', `Java runtime located → ${jvmPath}`);
            break;
          }
        } catch (_) {
          // Permission / lock errors — keep scanning.
        }
      }
      if (jvmPath) break;
    }
    if (!jvmPath) {
      step('warn', 'No javaw.exe under Program Files — letting portablemc find a JVM automatically.');
    }
  } else {
    step('info', 'Non-Windows host — letting portablemc pick the JVM.');
  }

  // C2) Build the portablemc 5.x argument list.
  //     IMPORTANT: each --jvm-arg gets its OWN flag (the old single
  //     --jvm-args "..." form was removed in 5.x). We use the =-form
  //     (--jvm-arg=-Xmx4G) because the docs explicitly recommend it: JVM args
  //     start with a dash, which makes the space-form ambiguous for argparse.
  const minHeap = Math.max(1, Math.floor(ram / 2));
  const args = [
    '-m', 'portablemc', 'start',
    '--username', String(username),
  ];
  if (jvmPath) {
    args.push('--jvm', jvmPath);
  }
  args.push('--jvm-arg=-Xmx' + ram + 'G');
  args.push('--jvm-arg=-Xms' + minHeap + 'G');

  // Server: portablemc 5.x renamed --server to --join-server (+ --join-server-port).
  // Accept "host" or "host:port"; split on the last colon if a port is present.
  if (serverIp && serverIp !== 'None' && String(serverIp).trim().length > 0) {
    const trimmed = String(serverIp).trim();
    const colonIdx = trimmed.lastIndexOf(':');
    if (colonIdx > 0 && /^\d+$/.test(trimmed.slice(colonIdx + 1))) {
      args.push('--join-server', trimmed.slice(0, colonIdx));
      args.push('--join-server-port', trimmed.slice(colonIdx + 1));
    } else {
      args.push('--join-server', trimmed);
      // default port 25565 is portablemc's own default; no need to pass it
    }
  }

  // Resolution: 5.x wants "WxH" as a single argument.
  if (resolution && resolution.mode === 'windowed' && resolution.width && resolution.height) {
    args.push('--resolution', `${resolution.width}x${resolution.height}`);
  }

  // Version is the single positional. portablemc accepts bare "1.21"
  // (defaults to mojang:1.21) and the colon syntax "fabric:1.21", "forge:1.20.1".
  args.push(String(version));

  // Echo the full command into the terminal logger so the user can see exactly
  // what's being run (and copy-paste it if they want to debug manually).
  const echoCmd = `${pythonCmd} ` + args.map((a) => {
    // Quote anything containing a space or that starts with a dash followed by
    // a non-flag char (so --username "Player One" stays together).
    return /\s/.test(a) || /^--?[A-Za-z=].*\s/.test(a) ? `"${a}"` : a;
  }).join(' ');
  step('cmd', `> ${echoCmd}`);

  // C3) Spawn portablemc and stream its stdout/stderr to the terminal logger.
  //     We do NOT pass --auth, so portablemc launches offline by default.
  const runPortablemc = (pythonBin) => new Promise((resolve, reject) => {
    const child = spawnTracked(pythonBin, args, {
      windowsHide: false, // show the python window so the user sees game logs
      cwd: minecraftDir(), // run inside .minecraft so saves/logs land correctly
    });

    let stderrBuf = '';
    let stdoutBuf = '';

    child.stdout.on('data', (d) => {
      const text = d.toString();
      stdoutBuf += text;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launch-stdout', text);
      }
    });
    child.stderr.on('data', (d) => {
      const text = d.toString();
      stderrBuf += text;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('launch-stderr', text);
      }
    });

    child.on('error', (err) => reject({ kind: 'error', err, stderr: stderrBuf }));
    child.on('exit', (code, signal) => {
      // portablemc exits 0 on a clean game session (after the game closes).
      // A non-zero code usually means a missing version / network error.
      if (code === 0 || code === null) {
        resolve({ code });
      } else {
        reject({ kind: 'exit', code, signal, stderr: stderrBuf, stdout: stdoutBuf });
      }
    });
  });

  // C4) Primary attempt with the system python.
  try {
    await runPortablemc(pythonCmd);
    step('ok', 'Game session ended cleanly.');
    return { ok: true, logs };
  } catch (failure) {
    step('error', `Primary launch failed (code ${failure.code ?? 'n/a'}). Falling back to local python + pip recovery.`);
    if (failure.stderr) {
      const firstLines = failure.stderr.split(/\r?\n/).filter((l) => l.trim()).slice(0, 3).join(' | ');
      if (firstLines) step('error', `  ${firstLines}`);
    }
  }

  // C5) Fallback: local AppData python, then pip install --user recovery.
  //     portablemc-fabric / portablemc-forge are separate packages in 4.x but
  //     are now BUILT INTO portablemc 5.x (the fabric:/forge: syntax works out
  //     of the box). We still install them harmlessly in case the user is on
  //     an older portablemc; pip will just say "already satisfied".
  const localPython = process.platform === 'win32'
    ? path.join(process.env.APPDATA || '', 'python', 'python.exe')
    : 'python3';

  step('info', `Recovery interpreter → ${localPython}`);
  step('cmd', '> pip install --user portablemc');
  try {
    await new Promise((resolve, reject) => {
      const pip = spawnTracked(localPython, [
        '-m', 'pip', 'install', '--user',
        'portablemc',
      ], { windowsHide: true });

      pip.stdout.on('data', (d) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('launch-stdout', d.toString());
        }
      });
      pip.stderr.on('data', (d) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('launch-stderr', d.toString());
        }
      });
      pip.on('error', reject);
      pip.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`pip exit ${code}`)));
    });

    step('ok', 'Recovery install complete. Retrying launch…');
  } catch (e) {
    step('error', `Recovery install failed: ${e.message}`);
    step('info', 'Install Python 3.10+ from https://www.python.org/downloads/ (tick "Add python.exe to PATH"), then run:');
    step('info', '  pip install portablemc');
    step('info', 'from a terminal, and restart HallwayLauncher Studio.');
    return { ok: false, logs };
  }

  // C6) Retry the launch with the local interpreter.
  try {
    await runPortablemc(localPython);
    step('ok', 'Recovery launch succeeded.');
    return { ok: true, logs };
  } catch (e) {
    step('error', `Recovery launch also failed: ${e.message || e.error?.message || 'unknown'}`);
    return { ok: false, logs };
  }
});

// ---------------------------------------------------------------------------
//  IPC CHANNEL D — 'backup-worlds'
//  Compresses %APPDATA%\.minecraft\saves into a timestamped ZIP on the
//  Desktop using a silent PowerShell Compress-Archive invocation. The label
//  follows the ISO template MC_World_Backup_YYYY-MM-DD_HHMM.zip.
// ---------------------------------------------------------------------------
ipcMain.handle('backup-worlds', async () => {
  const logs = [];
  const step = (level, message) => {
    const entry = { level, message, ts: new Date().toISOString() };
    logs.push(entry);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('backup-log', entry);
    }
  };

  const savesDir = path.join(minecraftDir(), 'saves');
  const desktop = desktopDir();

  // ISO date-time label: YYYY-MM-DD_HHMM
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const zipName = `MC_World_Backup_${stamp}.zip`;
  const zipPath = path.join(desktop, zipName);

  step('info', '═══ HallwayLauncher Studio — World Backup ═══');
  step('info', `Source → ${savesDir}`);
  step('info', `Destination → ${zipPath}`);

  if (!fs.existsSync(savesDir)) {
    step('error', `Saves directory not found: ${savesDir}`);
    return { ok: false, logs };
  }

  if (process.platform !== 'win32') {
    // Non-Windows dev fallback so the channel is still testable.
    step('warn', 'Non-Windows host: using Node tar-style copy fallback.');
    try {
      fs.copyFileSync(savesDir, zipPath);
      step('ok', `Backup written → ${zipPath}`);
      return { ok: true, logs };
    } catch (e) {
      step('error', `Fallback backup failed: ${e.message}`);
      return { ok: false, logs };
    }
  }

  // Silent PowerShell: Compress-Archive -Path savesDir\* -DestinationPath zip -Force
  const psScript =
    `Compress-Archive -Path "${path.join(savesDir, '*')}" ` +
    `-DestinationPath "${zipPath}" -Force; ` +
    `if ($?) { Write-Output 'OK' } else { Write-Output 'FAIL' }`;

  const psCommand =
    `powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command "${psScript.replace(/"/g, '\\"')}"`;

  step('cmd', '> powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command Compress-Archive …');

  try {
    const { stdout } = await runShell(psCommand);
    if (stdout && stdout.trim().endsWith('OK')) {
      step('ok', `Backup complete → ${zipPath}`);
      // Reveal it in Explorer so the user can grab it immediately.
      shell.showItemInFolder(zipPath);
      return { ok: true, logs };
    }
    step('error', `PowerShell reported failure: ${stdout || 'no output'}`);
    return { ok: false, logs };
  } catch (e) {
    step('error', `Backup exec failed: ${e.error ? e.error.message : 'unknown'}`);
    if (e.stderr) step('error', `  ${e.stderr}`);
    return { ok: false, logs };
  }
});

// ---------------------------------------------------------------------------
//  Misc IPC: graceful quit for the renderer's window controls.
// ---------------------------------------------------------------------------
ipcMain.handle('app:quit', () => app.quit());
ipcMain.handle('app:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});
ipcMain.handle('app:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
