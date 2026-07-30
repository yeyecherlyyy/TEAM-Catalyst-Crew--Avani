# Ghost-PM CLI

AI-powered interactive terminal for hackathon teams. Real-time sync, intelligent advice, and seamless collaboration from your terminal.

## Installation

```bash
pip install ghostpm
```

## Quick Start

```bash
# 1. Create an account (or use the web dashboard)
ghostpm signup

# 2. Join your team
ghostpm join ABC123

# 3. You're in! Use slash commands or just type to chat.
ghostpm> /help
ghostpm> /status
ghostpm> /advice
ghostpm> hey team, should we use websockets?
ghostpm> @ai what's the best way to handle auth?
```

## Commands

Once inside the interactive terminal:

| Command | Description |
|---------|-------------|
| `/help` | Show all commands |
| `/status` | Project dashboard (milestones, graph, team, time) |
| `/team` | Who's online and what they're working on |
| `/discuss <msg>` | Send a message to the team |
| `/advice` | Get AI-powered suggestions (Gemini) |
| `/graph` | Code graph summary from graphify |
| `/commit -m "msg"` | Smart commit with scope guard |
| `/milestone` | List and manage milestones |
| `/audit` | Codebase quality scan (Ponytail-inspired) |
| `/review` | Review recent commits |
| `/panic` | Toggle panic mode |
| `/quit` | Exit (daemon keeps running) |
| `<any text>` | Send as team chat |
| `@ai <question>` | Ask the AI assistant |

## One-Shot Commands

```bash
ghostpm status    # Quick status check
ghostpm watch     # Live auto-refreshing dashboard
ghostpm login     # Authenticate
ghostpm signup    # Create account
ghostpm daemon start/stop  # Manage background daemon
```

## Architecture

```
ghostpm join <code>
  ├── auth.py          → Supabase Auth (email/password)
  ├── sync/client.py   → Supabase CRUD + realtime
  ├── repl.py          → Interactive terminal (slash commands + chat)
  ├── ai_advisor.py    → Gemini-powered advice engine
  ├── auditor.py       → Ponytail-inspired codebase audit
  ├── daemon.py        → Background file watcher + auto-advice
  ├── graph_parser.py  → Graphify integration
  ├── state.py         → Pydantic models (state.json)
  └── hooks/           → Git pre-commit (scope guard) + post-commit
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | For /advice |
| `SUPABASE_URL` | Supabase project URL | Built-in default |
| `SUPABASE_KEY` | Supabase anon key | Built-in default |

## How It Works

1. **Web Dashboard**: Team leader creates a team, sets problem statement, configures hackathon format
2. **CLI Join**: Developers run `ghostpm join <team_code>` to connect
3. **Interactive Mode**: Code, chat, get AI advice, track progress — all from the terminal
4. **Background Daemon**: Watches files, syncs activity, auto-drops AI suggestions every 15 minutes
5. **Git Hooks**: Every commit is scope-checked against the active milestone
