# How to get your `.exe` — a beginner's walkthrough

This guide assumes you've **never used GitHub before**. We'll go slow. By the
end you'll have a real, downloadable `HallwayLauncherStudio-1.0.0 Setup.exe`
that installs your launcher on any Windows PC.

**You will need:**
- A computer with internet (Windows, Mac, or Linux — any of them is fine)
- About 15 minutes

**You will NOT need:**
- A Windows computer (GitHub lends you one for free, for ~4 minutes)
- Any programming knowledge
- Any software installed (we'll do it all in the web browser)

---

## Step 1 — Make a free GitHub account (skip if you already have one)

1. Open **https://github.com** in your browser.
2. Click **Sign up** (top right).
3. Enter your email, make up a password, pick a username.
4. Solve the little puzzle, click **Create account**.
5. GitHub sends you a code by email — type it in.
6. Done. You're in.

---

## Step 2 — Create a new, empty repository

A "repository" is just a folder GitHub stores for you on the internet.

1. In GitHub, click the **+** icon at the top right → **New repository**.
2. **Repository name:** type `hallway-launcher-studio`
3. **Description:** (leave blank, or type anything you like)
4. Click **Public** (so the free Actions minutes work — your code isn't
   sensitive, it's just this launcher).
5. **Leave "Add a README file" UNCHECKED.** (We're going to upload our own
   files instead.)
6. Click the green **Create repository** button at the bottom.

You should now be looking at an almost-empty page that says
"This repository is empty." Perfect.

---

## Step 3 — Upload the project files

We're going to drag-and-drop the whole project folder into GitHub.

### 3a. Find the project folder on your computer

The project is saved at (the path your AI tool showed you). Open your file
explorer / Finder and navigate to it. You should see this inside:

```
hallway-launcher-studio/
  ├── .github/
  │   └── workflows/
  │       └── build-exe.yml        ← the magic file that builds the .exe
  ├── build/
  │   ├── icon.ico
  │   ├── loading.gif
  │   └── ...
  ├── src/
  │   ├── App.jsx
  │   ├── main.js
  │   ├── main.jsx
  │   ├── preload.js
  │   └── index.css
  ├── index.html
  ├── package.json
  ├── ... (a few other config files)
  └── BUILD.md
```

### 3b. CRITICAL — make hidden files visible first

The `.github` folder (where the magic workflow lives) starts with a dot, so
it's hidden by default on Mac and Windows. You MUST upload it, or nothing
will build. Show hidden files once:

- **Mac:** Press `Cmd + Shift + .` (period) in Finder. Hidden files appear
  slightly grayed out. Press it again to hide them later.
- **Windows 10/11:** In File Explorer, click **View** → check **Hidden items**.

### 3c. Upload everything

1. In GitHub, on your empty repository page, click the **uploading an existing
   file** link (it's right there in the middle of the "empty repo" message).
2. Open your file explorer to the `hallway-launcher-studio` folder.
3. Select **everything inside it** (drag a box around all the files, or
   `Ctrl+A` / `Cmd+A`). Make sure `.github` is included.
4. Drag the whole selection onto the GitHub web page. It'll start uploading.
5. Wait until it says "all files uploaded" at the bottom.
6. Scroll down and click the green **Commit changes** button. Leave the
   commit message as the default ("Add files via upload").

Your repo is now populated. You should see the files listed on the repo page.

---

## Step 4 — Trigger the build

1. At the top of your repo page, click the **Actions** tab.
2. If GitHub shows a yellow banner that says "Workflows aren't being run on
   this repository's forked pull requests" — just ignore it, it doesn't
   apply to you.
3. In the left sidebar you'll see **Build Windows Installer**. Click it.
4. On the right side, click the gray **Run workflow ▾** button.
5. A small dropdown appears. Click the green **Run workflow** button inside
   it. (Leave "Run workflow on main" as-is.)

A new entry appears at the top of the list — that's your build starting. It
has a small yellow spinning circle next to it. That circle means "running."

---

## Step 5 — Wait for the build to finish (~4 minutes)

1. Click on that new entry (the one with the yellow spinner) to open its
   detail page.
2. You'll see a card titled **Build .exe on Windows**. Click on it.
3. Watch the steps run. Each one turns green as it completes:
   - "Check out the project" ✓
   - "Set up Node.js" ✓
   - "Install dependencies" ✓ (this one takes ~2 minutes — it's downloading
     ~600 libraries plus a 180 MB copy of Electron)
   - "Build the Squirrel.Windows installer" ✓ (this one takes ~1 minute)
   - "Show generated artifacts" ✓
   - "Upload the .exe installer artifact" ✓

When the whole card goes green, you're done. If any step goes red, click on
its name and scroll to the bottom to read the error — copy-paste it to me
and I'll tell you what's wrong.

---

## Step 6 — Download your `.exe`

1. Still on that build detail page, scroll down to the very bottom.
2. You'll see a section titled **Artifacts** with one item in it:
   **HallwayLauncherStudio-windows-exe**.
3. Click on that name. A zip file downloads to your computer.
4. Unzip it (Windows: right-click → **Extract All**).
5. Inside, you'll find a file named **`HallwayLauncherStudio-1.0.0 Setup.exe`**.

🎉 **That's your installer.** Double-click it to install HallwayLauncher Studio
on any Windows PC. It'll create a desktop icon and a Start Menu shortcut.

---

## Step 7 — Want a new version later? (you can skip this for now)

When you change the code and want a fresh `.exe`:

1. Push the changes to GitHub (re-upload the changed files, the same way as
   Step 3).
2. Go to the **Actions** tab → **Build Windows Installer** → **Run workflow**.
3. Wait ~4 minutes, download the new artifact.

To change the version number (so the installer says e.g. `1.1.0 Setup.exe`
instead of `1.0.0`): open `package.json`, find the line `"version": "1.0.0"`,
change it to `"1.1.0"`, re-upload that one file, and re-run the workflow.

---

## Common hiccups (and how to fix them)

- **"I don't see the Actions tab."** Your repo might be set to private. Go
  to **Settings** → scroll to bottom → **Change visibility** → **Public**.
  Free Actions only work on public repos (for free accounts).

- **"The build failed at Install dependencies."** Click that step, scroll to
  the bottom of its log. You'll usually see a missing package or a typo in
  `package.json`. Copy the last 20 lines and send them to me.

- **"There's no Artifacts section at the bottom."** That means the build
  didn't finish — re-read Step 5 and check the steps went green.

- **"My browser won't let me upload a folder called `.github`."** Make sure
  you did Step 3b (show hidden files). The `.github` folder is essential —
  it contains `build-exe.yml`, which is what makes GitHub build the `.exe`.

- **"I want to share the installer with a friend."** Just send them the
  `HallwayLauncherStudio-1.0.0 Setup.exe` file. They double-click it on
  their own Windows PC. They do not need Node, GitHub, or anything else.

---

## What's actually happening behind the scenes (one paragraph)

You clicked "Run workflow." GitHub rented one of its Windows computers,
copied your files onto it, installed Node.js, ran `npm install` (downloading
all 600+ libraries the launcher needs), ran `npm run make:squirrel` (which
uses Electron Forge + Squirrel.Windows to bundle your code + a copy of
Chromium + an installer wrapper into a single `Setup.exe`), zipped the
result, and put it on the web for you to download. Then it threw the Windows
computer away. All free. ~4 minutes.

If anything in this guide doesn't work, just tell me which step broke and
paste the error message — I'll walk you through it.
