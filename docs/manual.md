# Alogi User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Web Server Mode](#web-server-mode)
4. [Getting Started](#getting-started)
5. [Interface Overview](#interface-overview)
6. [Viewing Logs](#viewing-logs)
7. [Connecting to Remote Hosts](#connecting-to-remote-hosts)
8. [AI Features](#ai-features)
9. [Search and Filtering](#search-and-filtering)
10. [Keyboard Shortcuts](#keyboard-shortcuts)
11. [Settings](#settings)
12. [Troubleshooting](#troubleshooting)

---

## Introduction

Alogi is an AI-powered log viewer designed for developers and DevOps engineers. It provides a unified interface for viewing logs from multiple sources including local files, remote servers via SSH, systemd journal, and Docker containers.

### Key Features

- Live log tailing with auto-scroll
- AI-powered log analysis and chat (Claude, Gemini, OpenAI)
- Multi-source support (local, SSH, journal, Docker)
- Regex and text search with highlighting
- Time-based filtering
- Syntax highlighting and JSON formatting
- Bookmarks and insights panel
- Dark and light themes

---

## Installation

### Ubuntu / Debian

```bash
wget -O /tmp/Alogi-amd64.deb https://github.com/allisonhere/alogi/releases/latest/download/Alogi-amd64.deb
sudo apt install /tmp/Alogi-amd64.deb
```

Using `/tmp` avoids apt sandbox warnings when your home directory isn't world-readable.

### Arch Linux / CachyOS

```bash
yay -S alogi
```

### From Source

```bash
git clone https://github.com/allisonhere/alogi.git
cd alogi
npm install
npm run dev
```

Open `http://localhost:3000` in your browser, or run `npm run dev:desktop` for the Electron app.

### Web Server Mode

If you have the packaged app installed, you can run it in browser-only mode:

```bash
alogi --web --open
```

Defaults to `127.0.0.1:3000`. Use `--host` and `--port` to override.
Desktop mode is the default. You can force it with `--desktop`.

#### LAN Access Example

To allow other devices on your network to access the UI:

```bash
alogi --web --host 0.0.0.0 --port 8111 --open
```

Then open `http://<your-host-ip>:8111` from another device on the same network.

#### Security Notes

- `--host 0.0.0.0` exposes the UI to your local network.
- There is no built-in authentication yet, so only use this on trusted networks.
- Use a firewall to restrict access if needed.

#### Troubleshooting

- If `alogi --help` launches the desktop app, you are on an older build.
- The web server prints its URL in the terminal when it starts.

---

## Getting Started

When you first launch Alogi, you'll see a three-panel layout:

1. **Hosts Panel** (left) — Lists available log sources
2. **Files Panel** (middle) — Shows files/services for the selected host
3. **Log Viewer** (right) — Displays log content

### Quick Start

1. Click a host in the left panel (e.g., `/var/log` or `System Journal`)
2. Select a log file from the middle panel
3. View the log content in the main viewer
4. Click **Go Live** to tail the log in real-time
5. Click the **Sparkles** button to run AI analysis

---

## Interface Overview

### Header Bar

| Element | Description |
|---------|-------------|
| **Hosts** | Toggle hosts panel visibility |
| **Files** | Toggle files panel visibility |
| **Live / Paused** | Toggle real-time log tailing |
| **Time filter** | Filter logs by time range |
| **Bookmarks** | Show only bookmarked lines |
| **Insights** | Open insights panel (errors, trends) |
| **Wrap** | Toggle line wrapping |
| **A- / A / A+** | Decrease / reset / increase font size |
| **Search box** | Filter logs by text or regex |
| **Sparkles button** | Run AI analysis / toggle AI panel |

### Vibe Check Bar

The colored bar below the header shows the distribution of log severity:
- **Red** — Errors
- **Orange** — Warnings
- **Gray** — Normal lines

Click any section to jump to that part of the log.

### Status Bar

The bottom bar shows:
- Line count
- File size
- Encoding
- Scroll position
- Connection status (for SSH)

---

## Viewing Logs

### Local Files

1. Click a directory in the Hosts panel (e.g., `/var/log`)
2. Browse and select a log file
3. The content loads in the viewer

**Note:** Some system logs require elevated permissions. If you see a permission error, Alogi will prompt for your sudo password.

### System Journal

1. Click **System Journal** in the Hosts panel
2. Select a service from the list
3. View journalctl output for that service

### Live Tailing

1. Click **Live** in the header (or press `L`)
2. New log lines appear automatically
3. The viewer auto-scrolls to the bottom
4. Click **Paused** to stop tailing

### Large Files

For files over 5,000 lines, Alogi shows the most recent 5,000 by default. Click **Show all** in the warning banner to load the entire file (may affect performance with line wrapping enabled).

---

## Connecting to Remote Hosts

### Adding a Remote Host

1. Click the **Settings** gear icon in the bottom-left
2. Scroll to **Remote Hosts**
3. Click **Add Host**
4. Enter connection details:
   - **Alias** — Display name for this host
   - **Hostname** — Server address (IP or domain)
   - **Username** — SSH username
   - **Port** — SSH port (default: 22)
   - **Auth Method** — Key-based or password
   - **Key Path** — Path to SSH private key (if using key auth)
   - **Password** — SSH password (if using password auth)
5. Click **Test Connection** to verify
6. Click **Save**

### Viewing Remote Logs

Remote hosts appear in the Hosts panel with a server icon. When selected, Alogi shows three categories:

- **Journal Services** — Remote systemd services
- **/var/log Files** — Remote log files
- **Docker Containers** — Running containers on the remote host

### SSH Key Setup

For key-based authentication:
1. Generate a key if needed: `ssh-keygen -t ed25519`
2. Copy to server: `ssh-copy-id user@hostname`
3. In Alogi, set Key Path to `~/.ssh/id_ed25519` (or your key location)

---

## AI Features

Alogi integrates with Claude (Anthropic), Gemini (Google), and OpenAI for log analysis.

### Setup

1. Go to **Settings** → **AI Configuration**
2. Enable AI features
3. Select a provider (Claude, Gemini, or OpenAI)
4. Enter your API key
5. Click **Test Key** to verify
6. Save settings

### Getting API Keys

- **Claude:** [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
- **Gemini:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **OpenAI:** [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Running Analysis

1. Load a log file
2. Click the **Sparkles** button (or it shows **AI Analyze** if no analysis exists)
3. Wait for the AI to process the logs
4. View the summary, key findings, and recommendations

The AI uses smart context extraction to focus on errors and recent log entries, even for very large files.

### AI Chat

After running an analysis:
1. The AI panel opens on the right
2. Type questions in the input box at the bottom
3. Ask follow-up questions like:
   - "What's causing the timeout errors?"
   - "Explain this stack trace"
   - "How do I fix the connection refused error?"

### AI Panel Controls

| Button | Action |
|--------|--------|
| **Re-Analyze** | Run a fresh analysis |
| **Export** | Copy summary as plain text, markdown, or JSON |
| **Chevron (>)** | Collapse the panel |
| **X** | Close the panel |

---

## Search and Filtering

### Text Search

1. Type in the search box
2. Matching lines are highlighted
3. Non-matching lines are hidden

### Regex Search

1. Click the `.*` button (or press `Ctrl+R`)
2. Enter a regular expression
3. Examples:
   - `error|warning` — Match "error" or "warning"
   - `\d{3}` — Match any 3-digit number
   - `192\.168\.\d+\.\d+` — Match local IPs

### Time Filtering

1. Click the **Clock** icon
2. Enter start and end times (HH:MM format)
3. Only lines within that range are shown
4. The detected time range of the log is shown as a hint

### Bookmarks

- Click the bookmark icon on any line to mark it
- Click **Bookmarks** in the header to show only bookmarked lines
- Use `Ctrl+B` to bookmark the line at the center of the viewport

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` or `F` | Focus search box |
| `Ctrl+K` | Focus search box |
| `Ctrl+R` | Toggle regex mode |
| `L` | Toggle live mode |
| `W` | Toggle line wrapping |
| `Ctrl++` | Increase font size |
| `Ctrl+-` | Decrease font size |
| `Ctrl+0` | Reset font size |
| `Ctrl+B` | Bookmark center line |
| `J` | Next file in list |
| `K` | Previous file in list |

---

## Settings

Access settings via the gear icon in the bottom-left of the Hosts panel.

### Log Paths

Configure which local directories appear in the Hosts panel.

- Default: `/var/log`
- Add custom paths as needed

### AI Configuration

- **Enable AI Features** — Master toggle for AI functionality
- **Provider** — Choose Claude, Gemini, or OpenAI
- **API Key** — Your provider's API key
- **Model** — Select which model to use

### Remote Hosts

Manage SSH connections to remote servers. See [Connecting to Remote Hosts](#connecting-to-remote-hosts).

### About

View the current version and links to GitHub and documentation.

---

## Troubleshooting

### Permission Denied on Local Files

Some system logs (e.g., `/var/log/auth.log`) require root access.

1. Alogi will show a password prompt
2. Enter your sudo password
3. The password is cached for the session only

### SSH Connection Failed

- Verify the hostname is reachable: `ping hostname`
- Test SSH manually: `ssh user@hostname`
- Check the port number (default is 22)
- For key auth, ensure the key path is correct and the key is added to the server's `authorized_keys`
- For password auth, ensure password authentication is enabled on the server

### AI Analysis Not Working

- Verify your API key is correct in Settings
- Click **Test Key** to validate
- Check that AI features are enabled
- Ensure you have API credits with your provider

### Large File Performance

For very large logs with line wrapping enabled:
1. Disable line wrapping (click **Wrap** or press `W`)
2. Use time filtering to narrow the range
3. Use search to filter to relevant lines

### External Links Not Opening

On some Linux systems (especially KDE), external links may fail to open. This is a known Electron/portal issue. Alogi uses `xdg-open` as a workaround, which should work on most systems.

### Clearing the Cache (Arch/AUR)

If you encounter checksum errors after an update:
```bash
yay -Scc
rm -rf ~/.cache/yay/alogi
yay -S alogi
```

---

## Environment Variables

You can set these in your shell or `.env.local`:

| Variable | Description |
|----------|-------------|
| `LOG_ROOT_DIR` | Default log directory path |
| `ANTHROPIC_API_KEY` | Claude API key |
| `GEMINI_API_KEY` | Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `ALOGI_DEBUG` | Set to `true` to enable debug logging |

---

## Getting Help

- **GitHub Issues:** [github.com/allisonhere/alogi/issues](https://github.com/allisonhere/alogi/issues)
- **Source Code:** [github.com/allisonhere/alogi](https://github.com/allisonhere/alogi)

---

*Alogi is MIT licensed. Made by Allie.*
