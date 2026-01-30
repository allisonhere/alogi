# Alogi - AI-Powered Log Viewer

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
*   **📓 System Journal:** Integrated support for `journalctl` to browse system services and logs alongside files.
*   **🛰️ Remote Logs (SSH):** Browse `/var/log` on remote hosts over SSH.
*   **🐳 Docker Logs (SSH):** List running containers and view `docker logs` from remote hosts.
*   **⚙️ Configurable:** Manage log paths, AI providers, and hosts via Settings (persisted to `~/.config/alogi/config.json`).

## 🛠️ Tech Stack

*   **Framework:** Next.js 16 (App Router)
*   **Styling:** Tailwind CSS v4 (Cyberpunk/Terminal aesthetic)
*   **Icons:** Lucide React
*   **AI:** Google Generative AI SDK (Gemini) + OpenAI SDK
*   **Backend:** Node.js (Local FS & Child Process)

## 📦 Installation

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

## 🐳 Docker Notes

*   Docker hosts use SSH and run `docker ps` + `docker logs` on the remote machine.
*   Ensure Docker is installed and the SSH user can run Docker commands (e.g. user in the `docker` group or using sudo).

## License

MIT
