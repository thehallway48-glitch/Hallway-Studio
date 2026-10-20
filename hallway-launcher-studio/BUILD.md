# Building HallwayLauncher Studio into a Windows `.exe`

There are **three ways** to get the installer. Pick whichever fits.

---

## Option 1 — GitHub Actions (no Windows machine needed) ✅ recommended

The workflow in `.github/workflows/build-exe.yml` runs the build on a Windows
runner for you and uploads the `.exe` as a downloadable artifact.

1. Push this whole `hallway-launcher-studio/` folder to a GitHub repo.
2. In GitHub, open the **Actions** tab → **Build Windows Installer** →
   click **Run workflow** (or it runs automatically on push to `main`).
3. When the run finishes (≈3–4 min), scroll to the bottom of the run page
   and download the **HallwayLauncherStudio-windows-exe** artifact.
4. Unzip it → you'll find **`HallwayLauncherStudio-1.0.0 Setup.exe`**.
   Double-click to install — it creates a desktop + Start Menu shortcut.

That's it. No Windows license, no Visual Studio, no local toolchain.

---

## Option 2 — On your own Windows machine

```powershell
cd hallway-launcher-studio
npm install
npx install-scripts approve electron@31.7.7 esbuild@0.21.5 electron-winstaller@5.4.4
npm run make:squirrel
```

The installer lands at:

```
out\make\squirrel.win32\x64\HallwayLauncherStudio-1.0.0 Setup.exe
```

(That's the file you double-click to install. The other files in the folder —
the `.nupkg`, `RELEASES`, and the bare `.exe` — are used by Squirrel's
auto-update mechanism; you can ignore them for a manual install.)

---

## Option 3 — Portable zip (any OS, no installer)

If you just want a runnable folder with no installer (handy for testing on
Linux/macOS, or shipping as a portable Windows app):

```bash
npm run make:zip
```

Output: `out/make/zip/<platform>/x64/HallwayLauncherStudio-<platform>-x64-1.0.0.zip`.
Unzip and run the `HallwayLauncherStudio` executable inside.

---

## Why your build wasn't working

The original `hallway-launcher-studio/` folder only had three files
(`package.json`, `main.js`, `src/App.jsx`). Electron Forge + Vite needs several
more to build at all — they're now all included:

| File | Why it's required |
|---|---|
| `vite.main.config.js` | Vite config for the Electron main process bundle |
| `vite.preload.config.js` | Vite config for the preload script bundle |
| `vite.renderer.config.js` | Vite config for the React renderer bundle |
| `index.html` | The HTML shell Vite loads the renderer into |
| `src/main.jsx` | React entry that mounts `App.jsx` into `#root` |
| `src/preload.js` | The `contextBridge` that exposes `window.hallway` |
| `src/index.css` | Tailwind directives for the renderer |
| `tailwind.config.js` + `postcss.config.js` | Tailwind/PostCSS setup |
| `build/icon.ico` + `build/loading.gif` | Required by Squirrel.Windows |
| `.gitignore` | Keeps `node_modules/`/`out/`/`dist/` out of git |

A few config fixes were also needed:

- `package.json` `main` must be `.vite/build/main.js` (where the Vite plugin
  outputs the bundled main process), not `main.js`.
- The plugin's `build` array must list `src/main.js` and `src/preload.js`
  with their separate Vite configs.
- `main.js` was moved to `src/main.js` and its preload path + production
  entry path were corrected for the bundled layout.
- The Squirrel startup check was inlined (the `electron-squirrel-startup`
  package wasn't being packaged into the asar reliably — inlining its ~10
  lines of `process.argv` logic removed the runtime dependency entirely).
- `@electron-forge/maker-zip` was added as a secondary maker so `make`
  produces *something* on any platform (Squirrel.Windows only runs on Windows).

---

## Verifying the build pipeline

This project was actually built in a Linux sandbox to prove the pipeline:

- `npx vite build` → 1525 modules, 200 KB JS bundle ✓
- `npx electron-forge package` → `out/HallwayLauncherStudio-linux-x64/` ✓
- The packaged app launches under Xvfb and creates a window titled
  "HallwayLauncher Studio" loading the renderer HTML ✓
- `npx electron-forge make --makers @electron-forge/maker-zip` →
  `out/make/zip/linux/x64/HallwayLauncherStudio-linux-x64-1.0.0.zip` (101 MB) ✓

The Squirrel.Windows maker itself only runs on Windows (it shells out to
Windows-only tools), so it's skipped here — but the workflow in
`.github/workflows/build-exe.yml` runs it on `windows-latest` and produces
the real `Setup.exe`.

---

## Need an icon swap?

Drop your own `icon.ico` (multi-resolution, 16/32/48/64/128/256) and
`loading.gif` (400×100) into `build/` and rebuild. The current ones were
generated programmatically (mint paper + green "H" badge) — replace them
with your own branding anytime.
