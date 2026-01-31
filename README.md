# Alogi - AI-Powered Log Viewer

<p align="center">
  <img src="docs/logo.svg" alt="Alogi logo" width="120" height="120" />
</p>

**Alogi** (AI + Logi) is a modern, local-first log viewer built for DevOps engineers and developers who are tired of `grep` and `tail`. It combines a sleek, high-contrast UI with AI analysis to detect patterns and explain errors in plain English.

![Alogi Dashboard](https://github.com/allisonhere/alogi/blob/main/screenshot.png?raw=true)

## 🚀 Features

*   **⚡️ Live Tailing:** Watch logs stream in real-time (like `tail -f`) with auto-scrolling.
*   **🧠 AI Analysis:** Click "Analyze" to scan your logs for errors, root causes, and actionable recommendations (Gemini or OpenAI).
*   **🎨 Smart Highlighting:**
    *   **Vibe Check Bar:** A visual heatmap at the top of the screen showing where errors (Red) and warnings (Orange) are buried.
    *   **Syntax Highlighting:** Dates, IPs, and Keywords are color-coded.
    *   **JSON Pretty-Printing:** Automatically detects and formats JSON log lines.
    *   **Pills:** Visual badges for INFO, WARN, and ERROR levels.
    *   **Inline Search Highlighting:** Matches are highlighted directly in the log output.
*   **📓 System Journal:** Integrated support for `journalctl` to browse system services and logs alongside files.
*   **🛰️ Remote Logs (SSH):** Browse `/var/log` on remote hosts over SSH.
*   **🐳 Docker Logs (SSH):** List running containers and view `docker logs` from remote hosts.
*   **📊 Insights Sidebar:** Top errors/warnings, trend buckets, and spike detection with jump-to actions.
*   **🧩 Resizable Panels:** Drag to resize host/file panels with size persistence.
*   **✨ Onboarding Overlay:** First-run guidance for hosts, files, live, and AI actions.
*   **⚙️ Configurable:** Manage log paths, AI providers, and hosts via Settings (persisted to `~/.config/alogi/config.json`).

## 🛠️ Tech Stack

*   **Framework:** Next.js 16 (App Router)
*   **Styling:** Tailwind CSS v4 (Cyberpunk/Terminal aesthetic)
*   **Icons:** Lucide React
*   **AI:** Google Generative AI SDK (Gemini) + OpenAI SDK
*   **Backend:** Node.js (Local FS & Child Process)

## 📦 Installation

Prefer ready-to-go apps? Visit the install page for direct downloads and distro-specific instructions:

- Install page: https://allisonhere.github.io/alogi/
- Latest release assets: https://github.com/allisonhere/alogi/releases/latest

1.  **Clone the repo:**
    ```bash
    git clone https://github.com/allisonhere/alogi.git
    cd alogi
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the app:**
    ```bash
    npm run dev
    ```

4.  **Open in Browser:**
    Go to `http://localhost:3000`

## 🔑 Configuration

You can configure Alogi via the **Settings** page (Gear icon in bottom left). Settings are stored at `~/.config/alogi/config.json`.

You can also prefill values via environment variables:

*   `LOG_ROOT_DIR` for local logs root
*   `GEMINI_API_KEY` for Gemini
*   `OPENAI_API_KEY` for OpenAI

## 🖥️ Usage

*   **Select a Host:** Click a folder on the left (or `(system-journal)`). Remote hosts appear as `remote:<alias>` or `docker:<alias>`.
*   **Select a File:** Click a log file to view it.
*   **Analyze:** Click the **Sparkles** button to generate an AI summary.
*   **Go Live:** Toggle "Go Live" to stream updates automatically.
*   **Filter:** Use the search bar to filter lines instantly.
*   **Insights:** Toggle the Insights button to see top errors/warnings and trends.
*   **Wrap/Font:** Use Wrap + A-/A/A+ to control line wrapping and font size.

### ⌨️ Keyboard Shortcuts

*   `/` or `F` — Focus filter
*   `Cmd/Ctrl + K` — Focus filter
*   `L` — Toggle Live
*   `W` — Toggle Wrap
*   `Cmd/Ctrl + +` — Increase font size
*   `Cmd/Ctrl + -` — Decrease font size
*   `Cmd/Ctrl + 0` — Reset font size
*   `J / K` — Next/previous file in the file list

## 🐳 Docker Notes

*   Docker hosts use SSH and run `docker ps` + `docker logs` on the remote machine.
*   Ensure Docker is installed and the SSH user can run Docker commands (e.g. user in the `docker` group or using sudo).

## 📦 Desktop Packaging (Linux)

Install page: **https://allisonhere.github.io/alogi/**

Direct downloads (latest):
* AppImage: `https://github.com/allisonhere/alogi/releases/latest/download/Alogi-x86_64.AppImage`
* Ubuntu deb: `https://github.com/allisonhere/alogi/releases/latest/download/Alogi-amd64.deb`
* Arch pkg: `https://github.com/allisonhere/alogi/releases/latest/download/alogi-arch.pkg.tar.zst`

### AppImage + Debian (.deb)

Build Linux desktop artifacts (AppImage + .deb):

```bash
npm run dist:linux
```

Output is placed in `dist-electron/`.

### Arch / CachyOS (pacman)

1) Build the unpacked Linux app:

```bash
npm install
npm run dist:linux:dir
```

2) Create the tarball for the PKGBUILD:

```bash
tar -C dist-electron -czf packaging/arch/linux-unpacked.tar.gz linux-unpacked
```

3) Build and install the package:

```bash
cd packaging/arch
makepkg -f
sudo pacman -U alogi-*.pkg.tar.zst
```

Notes:
* Requires Node.js 20+ and npm on your system.

Notes:
* The PKGBUILD expects `linux-unpacked.tar.gz` in `packaging/arch/`.
* You can edit `PKGBUILD` to bump `pkgver` when you release new versions.

### GitHub Releases + AUR automation

* Tag a release `vX.Y.Z` to publish AppImage + deb + linux-unpacked to GitHub Releases.
* Optional AUR publishing is wired via `.github/workflows/aur.yml` and requires AUR secrets (see `packaging/arch/aur/README.md`).

## License

MIT
