<div align="center">

```text
   ██████╗ ██╗  ██╗ ██████╗ ███████╗████████╗   ██████╗ ███╗   ███╗
  ██╔════╝ ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝   ██╔══██╗████╗ ████║
  ██║  ███╗███████║██║   ██║███████╗   ██║█████╗ ██████╔╝██╔████╔██║
  ██║   ██║██╔══██║██║   ██║╚════██║   ██║╚════╝ ██╔═══╝ ██║╚██╔╝██║
  ╚██████╔╝██║  ██║╚██████╔╝███████║   ██║       ██║     ██║ ╚═╝ ██║
   ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝       ╚═╝     ╚═╝     ╚═╝
```

# Ghost-PM

**Autonomous Hackathon Intelligence System**

[**🚀 Live Deployment (Vercel)**](https://team-catalyst-crew-avani.vercel.app/)

A multi-surface platform that coaches teams from ideation through pitch defense — combining real-time AI advisory, evidence-based judging, codebase auditing, and live collaboration into a single orchestrated system.

[![Built with Gemini](https://img.shields.io/badge/AI-Gemini_2.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![TanStack](https://img.shields.io/badge/Frontend-TanStack_Start-EF4444?style=flat-square)](https://tanstack.com/start)
[![Python](https://img.shields.io/badge/Engine-Python_3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-000000?style=flat-square)](LICENSE)

---

**Team Catalyst Crew** | Summer of Code Foundation 2026

</div>

---

## The Problem

Hackathon teams operate under extreme time pressure with no structured feedback loop. Ideas go unvalidated, codebases drift from scope, and pitch defenses are practiced zero times before the stage. Most teams build the wrong thing, discover competitors too late, or collapse under judge scrutiny they never rehearsed for.

## The Solution

Ghost-PM is an always-on technical co-founder that spans three interfaces — web dashboard, terminal CLI, and automated background daemon — to provide continuous, evidence-backed guidance across every phase of a hackathon.

---

## System Architecture

```mermaid
graph TB
    subgraph CLIENT["Client Layer"]
        direction LR
        WEB["Web Dashboard<br/>TanStack Start + React 19"]
        CLI["Terminal REPL<br/>ghostpm CLI"]
        DAEMON["Background Daemon<br/>File Watcher + Git Hooks"]
    end

    subgraph INTELLIGENCE["Intelligence Layer"]
        direction LR
        ADVISOR["Strategy Advisor<br/>Context-Aware Coaching"]
        JUDGE["Skeptical Judge<br/>Evidence-Based Scoring"]
        AUDITOR["Code Auditor<br/>AST Graph Analysis"]
    end

    subgraph INFRASTRUCTURE["Infrastructure Layer"]
        direction LR
        SUPA["Supabase<br/>PostgreSQL + RLS + Realtime"]
        GEMINI["Gemini API Pool<br/>Round-Robin + Backoff"]
        TAVILY["Tavily Search<br/>Competitor Discovery"]
    end

    WEB --> ADVISOR
    WEB --> JUDGE
    CLI --> ADVISOR
    CLI --> AUDITOR
    DAEMON --> AUDITOR
    DAEMON --> SUPA

    ADVISOR --> GEMINI
    ADVISOR --> SUPA
    JUDGE --> GEMINI
    JUDGE --> TAVILY
    AUDITOR --> SUPA

    style CLIENT fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    style INTELLIGENCE fill:#0f3460,stroke:#16213e,color:#e0e0e0
    style INFRASTRUCTURE fill:#533483,stroke:#16213e,color:#e0e0e0
```

---

## Core Modules

### 1. Web Dashboard

Full-featured collaborative workspace built on TanStack Start with server-side rendering, Supabase Realtime synchronization, and Gemini-powered AI advisory.

| Capability | Implementation |
|---|---|
| AI Strategy Chat | Envelope-prompted Gemini sessions with hackathon context injection |
| Idea Evaluation | 6-dimension scoring matrix with weighted profiles per hackathon format |
| Artifact Generation | Scorecards, roadmaps, flowcharts, comparison tables, technical briefs |
| Judge Simulation | Full pressure-panel defense with progressive difficulty scaling |
| Code Visualization | 3D dependency graph rendering with React Three Fiber |
| Interactive Roadmap | Milestone tracking with drag-and-drop reordering and status management |
| Team Collaboration | Real-time message sync, team creation via invite codes, role management |

### 2. Skeptical AI Judge Engine

Standalone judging service that ingests pitch decks and executes adversarial evaluation with mandatory evidence citation.

```mermaid
flowchart LR
    INPUT["Pitch Input<br/>.pptx / .docx / text"] --> EXTRACT["Document<br/>Extraction"]
    EXTRACT --> RESEARCH["Tavily Web<br/>Research"]
    RESEARCH --> SCORE["Evidence-Based<br/>Rubric Scoring"]
    SCORE --> PANEL["6-Question<br/>Pressure Panel"]
    PANEL --> REPORT["Structured<br/>Judge Report"]

    style INPUT fill:#1e293b,stroke:#334155,color:#e2e8f0
    style EXTRACT fill:#1e293b,stroke:#334155,color:#e2e8f0
    style RESEARCH fill:#1e293b,stroke:#334155,color:#e2e8f0
    style SCORE fill:#1e293b,stroke:#334155,color:#e2e8f0
    style PANEL fill:#1e293b,stroke:#334155,color:#e2e8f0
    style REPORT fill:#1e293b,stroke:#334155,color:#e2e8f0
```

**Scoring Dimensions**

| Dimension | Weight | What It Measures |
|---|---|---|
| Uniqueness | Variable | Differentiation from discovered competitors |
| Innovation | Variable | Novel technical or conceptual approach |
| Scalability | Variable | Architecture readiness for 10x-100x growth |
| Feasibility | Variable | Buildability within hackathon time constraints |
| Competition | Variable | Market positioning against existing solutions |
| Judging Fit | Variable | Alignment with specific hackathon evaluation criteria |

**Pressure Panel Progression**

```
Level 1  Easy          Problem framing and core identification
Level 2  Easy-Medium   Step-by-step technical mechanics
Level 3  Medium        Deep-dive on weakest technical claim
Level 4  Medium-Hard   Differentiation against named competitors
Level 5  Hard          Edge cases and scalability under load
Level 6  Hardest       Business viability and ethical considerations
```

### 3. Headless CLI and Background Daemon

Terminal-native interface for teams that live in the editor. Includes an interactive REPL, git hook integration, and a file-watching daemon that continuously syncs codebase health to the cloud.

```mermaid
flowchart TB
    subgraph TERMINAL["Terminal Interface"]
        REPL["Interactive REPL<br/>Slash Commands + @ai Queries"]
        GIT["Git Hooks<br/>Pre-commit Scope Guard"]
    end

    subgraph BACKGROUND["Background Services"]
        WATCH["File Watcher<br/>inotify / FSEvents"]
        AST["AST Parser<br/>Dependency Graph Builder"]
        SYNC["Cloud Sync<br/>Supabase Realtime Push"]
    end

    REPL --> AST
    GIT --> AST
    WATCH --> AST
    AST --> SYNC

    style TERMINAL fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    style BACKGROUND fill:#0f3460,stroke:#16213e,color:#e0e0e0
```

---

## Data Model

```mermaid
erDiagram
    TEAMS ||--o{ TEAM_MEMBERS : contains
    TEAMS ||--o{ CHAT_SESSIONS : hosts
    TEAMS ||--o{ ARTIFACTS : produces
    TEAMS ||--o{ MILESTONES : tracks
    TEAMS ||--o{ CODE_SNAPSHOTS : monitors
    TEAMS ||--o{ NOTIFICATIONS : receives

    CHAT_SESSIONS ||--o{ MESSAGES : contains
    MILESTONES ||--o{ TASKS : breaks_into
    MESSAGES ||--o{ EMBEDDINGS : indexed_by

    TEAMS {
        uuid id PK
        text name
        text team_code UK
        enum hackathon_format
        enum duration_bracket
        jsonb team_skills
        jsonb judging_emphasis
    }

    TEAM_MEMBERS {
        uuid team_id FK
        uuid user_id FK
        enum role
    }

    ARTIFACTS {
        uuid id PK
        uuid team_id FK
        enum type
        text title
        jsonb content
    }

    MILESTONES {
        uuid id PK
        uuid team_id FK
        text title
        enum status
        integer sort_order
    }

    MESSAGES {
        uuid id PK
        uuid session_id FK
        text role
        text content
    }
```

All tables enforce Row Level Security. Team data is fully isolated — members can only access resources belonging to their own team.

---

## Request Flow

```mermaid
sequenceDiagram
    participant U as User
    participant D as Dashboard
    participant G as Gemini API
    participant S as Supabase
    participant T as Tavily

    U->>D: Submit idea for evaluation
    D->>G: Envelope-prompted scoring request
    G-->>D: 6-dimension score + reasoning

    D->>T: Competitor verification query
    T-->>D: Discovered competitors + URLs

    D->>S: Persist artifact (scorecard)
    S-->>D: Realtime broadcast to team

    D-->>U: Rendered scorecard with evidence
```

---

## Repository Structure

```
ghost-pm/
    app.py                        Flask server for Judge Agent
    judge_agent.py                Core skeptical judge logic
    extractors.py                 PPTX/DOCX extraction + Tavily wrapper
    test_judge_agent.py           Judge Agent test suite
    requirements.txt              Python dependencies

    cli/
        ghost_pm/
            cli.py                Command-line entry points
            repl.py               Interactive REPL + slash commands
            auditor.py            Codebase quality auditor
            daemon.py             File watcher + background sync
            graph_parser.py       AST dependency graph builder
            ai_advisor.py         Gemini client pool manager
            auth.py               Supabase auth interface
            config.py             Configuration management
            state.py              Session state handler
            hooks/                Git pre-commit + post-commit hooks
            sync/                 Cloud synchronization modules

    frontend/
        src/
            routes/               TanStack file-based routing
            components/
                Graph3D.tsx       3D dependency visualization
                InteractiveRoadmap.tsx  Milestone management
                artifact-viewer.tsx     Artifact rendering engine
                judge-panel.tsx         Judge simulation UI
                code-graph.tsx          Code analysis dashboard
                roadmap-panel.tsx       Roadmap visualization
                auth-gate.tsx           Authentication modal
                team-modals.tsx         Team create/join flows
            lib/
                auth.ts           Authentication utilities
                gemini.ts         Gemini API client
                supabase.ts       Supabase client
                memory.ts         Chat session persistence
                realtime.ts       Realtime subscription hooks
                artifacts.ts      Artifact CRUD operations

    src/                          Next.js API layer
        app/
            api/
                ai/brainstorm/    AI brainstorm endpoint
                ai/rate/          Idea rating endpoint
                ai/embed/         Embedding generation
                ai/search/        Tavily search proxy
                teams/            Team management API
        lib/
            ai/                   Gemini client configuration
            supabase/             Supabase server client

    supabase/
        schema.sql                PostgreSQL schema + RLS policies
```

---

## Installation

### Prerequisites

| Dependency | Version | Purpose |
|---|---|---|
| Node.js | 18+ | Web dashboard runtime |
| Bun | 1.0+ | Frontend package manager |
| Python | 3.10+ | Judge engine and CLI |
| Supabase Project | -- | Database, auth, and realtime |
| Gemini API Key | -- | AI model access |
| Tavily API Key | -- | Web research for competitor analysis |

### Environment Configuration

Create `.env` at the project root:

```env
# Google Gemini
GEMINI_API_KEY=

# Tavily Web Search
TAVILY_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

For the frontend, create `frontend/.env.local`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GEMINI_API_KEY=
```

### Database Setup

Execute `supabase/schema.sql` in the Supabase SQL Editor. This creates all tables, enums, RLS policies, and required indexes.

---

### Web Dashboard

```bash
cd frontend
bun install
bun run dev
```

Access at `http://localhost:5173`

### Judge Agent Server

```bash
pip install -r requirements.txt
python app.py
```

Access at `http://localhost:5000`

### Judge Agent CLI

```bash
# Evaluate a text idea
python judge_agent.py --idea "Your hackathon idea" --research --pretty

# Evaluate a pitch deck
python judge_agent.py --ppt pitch_deck.pptx --research --pretty
```

### Ghost-PM Terminal

```bash
cd cli
pip install -e .

ghostpm login
ghostpm join <TEAM_CODE>
ghostpm                    # Launch interactive REPL
ghostpm daemon start       # Start background watcher
```

---

## CLI Command Reference

| Command | Description |
|---|---|
| `/help` | Display available commands |
| `/status` | Team status, milestone progress, duration timer |
| `/team` | Active members and task assignments |
| `/discuss <msg>` | Broadcast to team realtime chat |
| `/advice` | Request strategic advice from Gemini advisor |
| `/graph` | Render dependency graph and codebase metrics |
| `/commit -m "msg"` | Scope-checked git commit against active milestones |
| `/milestone` | View, add, or complete project milestones |
| `/audit` | Trigger manual codebase quality scan |
| `/panic` | Activate deadline mode with forced scope reduction |
| `@ai <question>` | Direct query to AI co-founder |

---

## Testing

```bash
# Judge Agent unit tests
python -m unittest test_judge_agent -v
```

---

## Technology

| Layer | Stack |
|---|---|
| Frontend | TanStack Start, React 19, TypeScript, Tailwind CSS 4, Radix UI, React Three Fiber |
| API | Next.js 15 App Router, Serverless Functions |
| AI | Gemini 2.5 Flash, Gemini Embedding 001, Tavily Search API |
| Backend | Supabase PostgreSQL, Row Level Security, Realtime WebSockets, pgvector |
| CLI | Python 3.10+, Click, Rich, Watchdog |
| Judge Engine | Python, Flask, python-pptx, python-docx, google-genai |

---

<div align="center">

Built by **Team Catalyst Crew** for the Summer of Code Foundation 2026

</div>
