# ⚡ Ghost-PM — AI-Powered Hackathon Copilot & Skeptical Judge Engine

> **Rate. Brainstorm. Build. Ship.**  
> A comprehensive headless hackathon coaching system, codebase auditor, real-time strategy advisor, and evidence-based AI judging engine built for high-stakes hackathon teams.

---

## 📌 Overview

**Ghost-PM** (by **TEAM Catalyst Crew**) bridges the gap between brainstorming an idea and presenting a winning pitch. It acts as an always-on co-founder and judge, keeping teams on scope, auditing codebase progress in real-time, verifying competitor uniqueness via live web research, and pressure-testing pitches against ruthless judging standards.

The ecosystem consists of **3 main interconnected modules**:

1. 🌐 **Ghost-PM Web Application & Dashboard** (Next.js + Supabase + Gemini): Collaborative web workspace featuring AI strategy advisor chat, idea rating engine, workspace pitch builders, milestone trackers, and real-time team synchronization.
2. ⚖️ **Skeptical AI Judge Agent** (Python / Flask / CLI): Standalone judging service that ingests pitch decks (`.pptx`, `.docx`) or text descriptions, executes Tavily web research to catch existing competitors, and generates evidence-backed scores and progressive 6-question defense panels.
3. 💻 **Ghost-PM Headless CLI & Background Daemon** (Python CLI + Git Hooks): Terminal interactive REPL and background daemon (`ghostpm`) that watches codebase AST graph structures, guards against scope drift on git commits, and syncs progress live to the cloud dashboard.

---

## ✨ Key Features

### 1. 🎯 AI Strategy Advisor & Envelope Prompting
- **Context-Aware Coaching**: Integrates hackathon constraints (duration, track, team skill set, judging criteria) directly into AI advice.
- **Drift Detection**: Monitors discussion and code focus using vector embeddings (`gemini-embedding-001`), raising alerts if the team veers off track.
- **Strategy Nudges**: Automatically pushes warnings when technical complexity threatens the submission deadline.

### 2. 💡 Idea Evaluator & Tavily Competitor Verification
- **6-Dimension Scoring Matrix**: Evaluates concepts across *Uniqueness*, *Innovation*, *Scalability*, *Feasibility*, *Competition*, and *Judging Fit*.
- **Live Competitor Research**: Automatically queries Tavily Web Search API to identify existing market solutions, GitHub repositories, and direct competitors.
- **Weighted Profiles**: Customizes scoring weights based on hackathon format (e.g., Ideathon vs. Prototype Build).

### 3. ⚖️ Evidence-Based Skeptical AI Judge Agent
- **Pitch Deck Document Extractor**: Native text extraction from PowerPoint (`.pptx`) slides and Word (`.docx`) executive briefs.
- **Evidence-Backed Rubric**: Every 1–10 score requires explicit citation of submitted text, deck slides, or discovered web competitors. No generic praise.
- **Progressive 6-Question Pressure Panel**: Generates judge questions ordered by difficulty:
  1. *Easy*: Framing & core problem identification.
  2. *Easy-Medium*: Step-by-step technical mechanics.
  3. *Medium*: Technical deep-dive on weakest technical claim.
  4. *Medium-Hard*: Differentiation against named real-world competitors.
  5. *Hard*: Edge case handling & 10x–100x scalability.
  6. *Hardest*: Business viability, unit economics, or ethical considerations.
- **Dual Web & CLI Interfaces**: Run via browser UI (`http://localhost:5000`) or one-shot terminal command.

### 4. 🛠️ Codebase Auditor & AST Graph Parser
- **Code Graph Analysis**: Parses project dependency graphs and AST structures to measure actual development velocity versus planned milestones.
- **Git Scope Guard Hooks**: Integrates `pre-commit` and `post-commit` git hooks to verify that committed code aligns with active milestone scope.
- **Daemon Auto-Sync**: Background daemon (`ghostpm daemon`) continuously audits file changes and pushes updates to Supabase Realtime channels.

### 5. 🔐 Multi-Tenant Realtime Backend
- **Supabase Integration**: Row Level Security (RLS) ensures complete data isolation per team.
- **Realtime Collaboration**: Instant synchronization of messages, milestones, idea ratings, and code health indicators across web and terminal sessions.
- **API Key Pool Management**: Round-robin key rotation and exponential backoff retry handler for Gemini API rate limits (`429 / RESOURCE_EXHAUSTED`).

---

## 🏗️ Architecture & Component Map

```
                          ┌───────────────────────────────────────────┐
                          │         Ghost-PM Next.js Dashboard         │
                          │   (Auth, Advisor Chat, Idea Matrix, UI)  │
                          └─────────────────────┬─────────────────────┘
                                                │
                                    Supabase Realtime & RLS
                                                │
       ┌────────────────────────────────────────┼────────────────────────────────────────┐
       │                                        │                                        │
┌──────▼────────────────────────┐    ┌──────────▼────────────────────┐    ┌──────────────▼────────────────┐
│      Headless CLI & Daemon    │    │       Gemini AI Pool          │    │     Skeptical Judge Server    │
│  (ghostpm REPL, Git Hooks,    │    │ (gemini-2.5-flash /           │    │  (Flask Web UI, Pitch Deck    │
│   AST Graph Auditor, Sync)    │    │  gemini-embedding-001)        │    │   Extractor, Tavily Search)   │
└───────────────────────────────┘    └───────────────────────────────┘    └───────────────────────────────┘
```

---

## 📁 Repository Structure

```
├── app.py                   # Flask Web Server for Judge Agent (Port 5000)
├── judge_agent.py           # Core Skeptical AI Judge logic & CLI runner
├── extractors.py            # Document extractors (PPTX/DOCX) & Tavily search wrapper
├── test_judge_agent.py      # Unit test suite for Judge Agent
├── requirements.txt         # Python dependencies for Judge Agent & Web UI
│
├── cli/                     # Ghost-PM Headless Terminal & Daemon
│   ├── ghost_pm/
│   │   ├── cli.py           # Command-line entry points (ghostpm)
│   │   ├── repl.py          # Interactive terminal chat & slash commands
│   │   ├── auditor.py       # Codebase graph auditor
│   │   ├── daemon.py        # File watching & background auto-sync
│   │   ├── graph_parser.py  # Dependency & AST graph parser
│   │   ├── ai_advisor.py    # Gemini client pool manager
│   │   ├── auth.py          # Supabase auth interface
│   │   └── hooks/           # Pre-commit & post-commit git hooks
│   └── pyproject.toml       # CLI package setup
│
├── src/                     # Next.js 15 Web Application
│   ├── app/
│   │   ├── (auth)/          # Authentication pages (login, signup)
│   │   ├── (dashboard)/     # Team dashboard, onboarding, advisor, workspace
│   │   └── api/             # API routes (ai/brainstorm, ai/rate, ai/search, teams)
│   ├── components/          # UI components (Radix UI, Tailwind CSS)
│   └── lib/                 # Gemini API clients, types, schemas, prompts, Supabase helpers
│
└── supabase/                # Database Schema & Migrations
    └── schema.sql           # PostgreSQL tables, RLS policies, indexes
```

---

## ⚙️ Environment Variables Setup

Copy `.env.example` to `.env` (or `.env.local` for Next.js) and fill in your API credentials:

```env
# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Tavily Web Search API (For competitor verification)
TAVILY_API_KEY=your_tavily_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## 🚀 Quick Start & Installation

### Option A: Run the Next.js Web Application

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

### Option B: Run the Skeptical AI Judge Agent Server

1. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Start the Flask Web Server**:
   ```bash
   python app.py
   ```
   Open **[http://localhost:5000](http://localhost:5000)** to evaluate ideas or pitch decks through the web UI.

3. **Or execute directly via Python CLI**:
   ```bash
   python judge_agent.py --idea "AI-powered automated code review tool for hackathons" --research --pretty
   ```

   *With Pitch Deck (.pptx / .docx) Upload*:
   ```bash
   python judge_agent.py --ppt pitch_deck.pptx --research --pretty
   ```

---

### Option C: Install & Run Ghost-PM Terminal CLI & Daemon

1. **Install the CLI package locally**:
   ```bash
   cd cli
   pip install -e .
   ```

2. **Authenticate & Join your team**:
   ```bash
   ghostpm login
   ghostpm join <YOUR_TEAM_CODE>
   ```

3. **Launch the Interactive Terminal REPL**:
   ```bash
   ghostpm
   ```

4. **Start the Background Daemon**:
   ```bash
   ghostpm daemon start
   ```

---

## 💻 CLI & Slash Command Reference

Inside the `ghostpm` interactive terminal session, use the following slash commands:

| Command | Description |
|---|---|
| `/help` | Display all available slash commands and usage |
| `/status` | View real-time team status, milestone progress, and duration timer |
| `/team` | List active team members and current task assignments |
| `/discuss <msg>` | Broadcast a message to the team realtime chat |
| `/advice` | Request instant strategic advice from Ghost-PM Gemini advisor |
| `/graph` | Render dependency graph and AST codebase metrics |
| `/commit -m "msg"`| Perform scope-checked git commit against active milestones |
| `/milestone` | Manage project milestones (view, add, complete) |
| `/audit` | Trigger a manual codebase quality scan |
| `/panic` | Enable high-priority deadline mode (forces scope reduction) |
| `@ai <question>` | Direct line to ask the AI co-founder questions |

---

## 🧪 Running Tests

Validate the AI Judge Agent logic and document extraction:

```bash
python -m unittest test_judge_agent -v
```

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons, Radix UI.
- **Python Services**: Python 3.10+, Flask, `python-pptx`, `python-docx`, `google-genai`, `tavily-python`.
- **AI Models**: Google Gemini 2.5 Flash (`gemini-2.5-flash`), Gemini Embedding (`gemini-embedding-001`), Tavily Web Research API.
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, WebSockets Realtime engine).

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
