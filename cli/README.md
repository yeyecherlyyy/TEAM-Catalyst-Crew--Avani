# Ghost-PM: The Headless CLI Project Manager

![Ghost-PM Banner](https://ghost-pm.vercel.app/og-image.png)

**Ghost-PM** is an AI-powered, headless project manager designed specifically for hackathon teams. It lives entirely in your terminal, acting like a silent observer (a "ghost") that watches your team's progress, syncs it in real-time, and provides proactive AI advice to keep you on track.

**Built for speed. Built for focus. Built for hackathons.**

## 🚀 Features

- **Terminal-First REPL**: An interactive, always-on terminal interface (like Claude Code). Never leave your IDE.
- **Real-Time Sync**: Seamlessly syncs chat, tasks, and code metrics with your teammates via Supabase Realtime.
- **AI Advisor**: Powered by Google Gemini. Get proactive suggestions on scope creep, time management, and code complexity.
- **Code Graph (graphify)**: Automatically builds an AST-based graph of your codebase to detect "God Nodes" and refactor risks.
- **Smart Git Hooks**: Pre-commit hooks guard against scope creep, while post-commit hooks track progress.
- **Zero-Config Setup**: Supabase credentials are baked in. Just sign in, join a team code, and start hacking.

## 📦 Installation

Ghost-PM requires Python 3.11+.

```bash
pip install ghostpm
```

*Note: For AI features, you will need a `GEMINI_API_KEY`.*

## ⚡ Quick Start

1. **Create a team** on the [Ghost-PM Web Dashboard](https://ghost-pm.vercel.app).
2. **Get your Team Code** (e.g., `ABC123`).
3. **Run the CLI** in your project directory:

```bash
# Authenticate (first time only)
ghostpm login

# Join your team's workspace
ghostpm join ABC123
```

## 🎮 The Ghost-PM REPL

Once you run `ghostpm join`, you will enter the interactive REPL.

### Commands

**📊 Information**
- `/status`  - Full project dashboard (progress, time left, alerts)
- `/team`    - See who is online, idle times, and what files they are editing

**🗺️ Roadmap & Tasks**
- `/tasks`   - View roadmap tasks from the web dashboard
- `/checkin` - Log progress (e.g., `/checkin 50 Finished auth backend`)
- `/milestone`- List current milestones

**💬 Communication**
- `text`     - Type anything without a slash to send a team chat message
- `@ai`      - Mention `@ai` to ask the AI advisor a question in chat

**⚙️ Code & Git**
- `/commit`  - Smart commit with scope guard (e.g., `/commit -m "Add auth"`)
- `/graph`   - View code graph summary (files, functions, god nodes)
- `/audit`   - Run a codebase audit (finds dead code, deep nesting, etc.)
- `/review`  - Review recent commits for quality

**⚡ General**
- `/panic`   - Toggle panic mode (relaxes scope guards when time is running out)
- `/quit`    - Exit the REPL (the background daemon keeps syncing)

## 🏗️ Architecture

Ghost-PM operates with a dual architecture:
1. **The CLI (`ghostpm`)**: A lightweight python package installed globally.
2. **The Daemon**: A silent background process that watches file modifications, tracks idle time, and syncs with Supabase.
3. **The Web Dashboard**: A Next.js/Vite frontend for viewing roadmaps, task boards, and team analytics visually.

## 🤝 Contributing

We welcome contributions! Please see our [GitHub Repository](https://github.com/yeyecherlyyy/TEAM-Catalyst-Crew--Avani) for guidelines.

## 📄 License

MIT License - Created by Catalyst Crew.
