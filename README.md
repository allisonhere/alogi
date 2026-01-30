# Alogi - AI-Powered Log Viewer

**Alogi** (AI + Logi) is a modern, local-first log viewer built for DevOps engineers and developers who are tired of `grep` and `tail`. It combines a sleek, high-contrast UI with the power of Google Gemini AI to analyze logs, detect patterns, and explain errors in plain English.

![Alogi Dashboard](https://github.com/allisonhere/alogi/blob/main/screenshot.png?raw=true)

## 🚀 Features

*   **⚡️ Live Tailing:** Watch logs stream in real-time (like `tail -f`) with auto-scrolling.
*   **🧠 AI Analysis:** Click "Analyze" to have Google Gemini 2.0 scan your logs for errors, root causes, and actionable recommendations.
*   **🎨 Smart Highlighting:**
    *   **Vibe Check Bar:** A visual heatmap at the top of the screen showing where errors (Red) and warnings (Orange) are buried.
    *   **Syntax Highlighting:** Dates, IPs, and Keywords are color-coded.
    *   **JSON Pretty-Printing:** Automatically detects and formats JSON log lines.
    *   **Pills:** Visual badges for INFO, WARN, and ERROR levels.
*   **📓 System Journal:** Integrated support for `journalctl` to browse system services and logs alongside files.
*   **⚙️ Configurable:** Manage your log paths and AI settings via a dedicated Settings UI (persisted to `~/.config/alogi/config.json`).

## 🛠️ Tech Stack

*   **Framework:** Next.js 15 (App Router)
*   **Styling:** Tailwind CSS (Cyberpunk/Terminal aesthetic)
*   **Icons:** Lucide React
*   **AI:** Google Generative AI SDK (Gemini Flash)
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

You can configure Alogi via the **Settings** page (Gear icon in bottom left), or via environment variables:

1.  **AI Key:** Get a [Google Gemini API Key](https://aistudio.google.com/app/apikey).
2.  **Setup:** Enter the key in the Settings page.

## 🖥️ Usage

*   **Select a Host:** Click a folder on the left (or `(system-journal)`).
*   **Select a File:** Click a log file to view it.
*   **Analyze:** Click the **Sparkles** button to generate an AI summary.
*   **Go Live:** Toggle "Go Live" to stream updates automatically.
*   **Filter:** Use the search bar to filter lines instantly.

##  license

MIT