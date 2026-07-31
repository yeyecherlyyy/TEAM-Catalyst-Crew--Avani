# Architecture

This document describes the technical architecture of Ghost-PM, covering system design, data flow, security model, and deployment topology.

## System Overview

Ghost-PM is a multi-surface platform with three client interfaces (web dashboard, terminal CLI, background daemon) connected through a shared intelligence layer and unified data store.

```mermaid
graph TB
    subgraph CLIENTS["Client Surfaces"]
        WEB["Web Dashboard<br/>TanStack Start + SSR"]
        CLI["Terminal REPL<br/>Python CLI"]
        DAEMON["Background Daemon<br/>File Watcher"]
    end

    subgraph INTELLIGENCE["Intelligence Layer"]
        ADVISOR["Strategy Advisor"]
        JUDGE["Skeptical Judge"]
        AUDITOR["Code Auditor"]
        EMBED["Embedding Engine"]
    end

    subgraph DATA["Data Layer"]
        SUPA["Supabase<br/>PostgreSQL + RLS"]
        RT["Realtime Engine<br/>WebSocket Channels"]
        VEC["pgvector<br/>Embedding Store"]
    end

    subgraph EXTERNAL["External Services"]
        GEMINI["Gemini 2.5 Flash"]
        GEM_EMBED["Gemini Embedding 001"]
        TAVILY["Tavily Search API"]
    end

    WEB --> ADVISOR & JUDGE
    CLI --> ADVISOR & AUDITOR
    DAEMON --> AUDITOR

    ADVISOR --> GEMINI & SUPA
    JUDGE --> GEMINI & TAVILY
    AUDITOR --> SUPA
    EMBED --> GEM_EMBED & VEC

    SUPA --> RT

    style CLIENTS fill:#0d1117,stroke:#30363d,color:#c9d1d9
    style INTELLIGENCE fill:#161b22,stroke:#30363d,color:#c9d1d9
    style DATA fill:#0d1117,stroke:#30363d,color:#c9d1d9
    style EXTERNAL fill:#161b22,stroke:#30363d,color:#c9d1d9
```

## Module Architecture

### Web Dashboard

The frontend is built with TanStack Start (React 19 + Vite + Nitro SSR). File-based routing maps URL paths to route components.

```
frontend/src/
    routes/
        __root.tsx          Root layout with providers
        index.tsx           Main dashboard view
    components/
        auth-gate.tsx       Authentication modal
        artifact-viewer.tsx Artifact rendering engine
        judge-panel.tsx     Judge simulation UI
        code-graph.tsx      Code analysis + 3D graph
        roadmap-panel.tsx   Milestone management
        team-modals.tsx     Team create/join flows
    lib/
        auth.ts             Supabase Auth wrapper
        gemini.ts           Gemini API client
        supabase.ts         Supabase client singleton
        memory.ts           Chat session persistence
        realtime.ts         Realtime subscription hooks
        artifacts.ts        Artifact CRUD operations
```

**Key Design Decisions:**

- **SSR with Nitro**: Server-side rendering for initial page load performance and SEO. Nitro handles the server runtime, enabling deployment to Vercel, Cloudflare, or Node.js.
- **Envelope Prompting**: All Gemini calls inject hackathon-specific context (format, duration, skills, judging criteria) as system instructions. This constrains AI output to remain contextually relevant.
- **Dual Persistence**: Chat history and artifacts are persisted to both Supabase (for team sync) and localStorage (for offline resilience).

### Skeptical Judge Engine

```mermaid
flowchart TB
    INPUT["Input Layer"] --> EXTRACT["Extraction"]
    EXTRACT --> ANALYZE["Analysis"]
    ANALYZE --> OUTPUT["Output"]

    subgraph INPUT
        TEXT["Text Description"]
        PPTX[".pptx Deck"]
        DOCX[".docx Brief"]
    end

    subgraph EXTRACT
        SLIDE_PARSE["Slide Parser<br/>python-pptx"]
        DOC_PARSE["Document Parser<br/>python-docx"]
        TEXT_CLEAN["Text Normalizer"]
    end

    subgraph ANALYZE
        TAVILY_SEARCH["Competitor Research<br/>Tavily API"]
        RUBRIC["Evidence-Based Scoring<br/>Gemini 2.5 Flash"]
        PRESSURE["Pressure Panel<br/>6-Question Generator"]
    end

    subgraph OUTPUT
        JSON_REPORT["Structured JSON"]
        WEB_UI["Flask Web Interface"]
        CLI_OUT["CLI Pretty Print"]
    end

    style INPUT fill:#1a1a2e,stroke:#16213e,color:#e0e0e0
    style EXTRACT fill:#16213e,stroke:#1a1a2e,color:#e0e0e0
    style ANALYZE fill:#0f3460,stroke:#16213e,color:#e0e0e0
    style OUTPUT fill:#533483,stroke:#16213e,color:#e0e0e0
```

**Key Design Decisions:**

- **Mandatory Evidence Citation**: Every numerical score in the rubric must reference specific text from the submission or discovered competitors. This prevents hallucinated praise.
- **Progressive Difficulty**: The 6-question panel escalates methodically from easy framing questions to adversarial business viability challenges, simulating a real judge panel.
- **Web Research Integration**: Tavily queries run before scoring to populate the competitor landscape. Scores for Uniqueness and Competition are calibrated against real-world findings.

### CLI and Daemon

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> REPL: ghostpm
    Idle --> Daemon: ghostpm daemon start
    Idle --> Auth: ghostpm login

    REPL --> SlashCmd: /command
    REPL --> AIQuery: @ai query
    SlashCmd --> REPL: Output
    AIQuery --> Gemini: API Call
    Gemini --> REPL: Response

    Daemon --> Watching: File System Events
    Watching --> ASTParser: File Changed
    ASTParser --> ScopeCheck: Dependency Graph
    ScopeCheck --> Sync: Upload to Supabase
    Sync --> Watching: Continue
```

**Key Design Decisions:**

- **Non-blocking Daemon**: The file watcher runs in a separate thread to avoid blocking the REPL. Events are debounced to prevent redundant analysis on rapid file saves.
- **AST-based Auditing**: Rather than simple file diffing, the auditor parses actual code structure (imports, exports, function signatures) to measure development velocity against milestones.
- **Git Hook Integration**: Pre-commit hooks validate that changed files align with active milestone scope, preventing accidental scope drift.

## Data Architecture

### Entity Relationship Model

```mermaid
erDiagram
    TEAMS ||--o{ TEAM_MEMBERS : "has members"
    TEAMS ||--o{ CHAT_SESSIONS : "owns sessions"
    TEAMS ||--o{ ARTIFACTS : "produces"
    TEAMS ||--o{ MILESTONES : "tracks"
    TEAMS ||--o{ CODE_SNAPSHOTS : "monitors"
    TEAMS ||--o{ NOTIFICATIONS : "receives"
    TEAMS ||--o{ IDEA_RATINGS : "evaluates"

    CHAT_SESSIONS ||--o{ MESSAGES : "contains"
    MILESTONES ||--o{ TASKS : "decomposes into"
    MESSAGES ||--o{ EMBEDDINGS : "indexed by"

    TEAMS {
        uuid id PK
        text name
        text team_code UK
        uuid owner_id FK
        enum hackathon_format
        enum duration_bracket
        jsonb team_skills
        jsonb judging_emphasis
    }

    TEAM_MEMBERS {
        uuid team_id FK
        uuid user_id FK
        enum role
        timestamp joined_at
    }

    MESSAGES {
        uuid id PK
        uuid session_id FK
        text role
        text content
        timestamp created_at
    }

    ARTIFACTS {
        uuid id PK
        uuid team_id FK
        enum type
        text title
        jsonb content
        timestamp created_at
    }

    MILESTONES {
        uuid id PK
        uuid team_id FK
        text title
        text description
        enum status
        integer sort_order
    }
```

### Security Model

All database access is governed by Row Level Security (RLS). Policies enforce:

| Operation | Rule |
|---|---|
| `SELECT` | User must be a member of the team that owns the resource. |
| `INSERT` | User must be authenticated. Team ownership is validated. |
| `UPDATE` | User must be a member of the owning team. |
| `DELETE` | User must be the team owner. |

Team isolation is enforced at the database level. Even with a valid authentication token, users cannot access resources belonging to other teams.

### API Key Management

Gemini API calls use a **round-robin key pool** with exponential backoff:

```mermaid
flowchart LR
    REQ["API Request"] --> POOL["Key Pool<br/>Round-Robin Selection"]
    POOL --> KEY1["Key 1"]
    POOL --> KEY2["Key 2"]
    POOL --> KEY3["Key N"]
    KEY1 --> GEMINI["Gemini API"]
    KEY2 --> GEMINI
    KEY3 --> GEMINI
    GEMINI -->|429 Rate Limit| BACKOFF["Exponential Backoff<br/>+ Next Key"]
    BACKOFF --> POOL
    GEMINI -->|200 OK| RESPONSE["Response"]

    style POOL fill:#1e293b,stroke:#334155,color:#e2e8f0
    style BACKOFF fill:#7f1d1d,stroke:#991b1b,color:#fecaca
    style RESPONSE fill:#14532d,stroke:#166534,color:#bbf7d0
```

## Deployment

### Production (Vercel)

The frontend deploys to Vercel using Nitro's Build Output API:

1. Vercel detects a push to `main`.
2. `bun install` installs dependencies in the `frontend/` root directory.
3. `vite build` compiles the application. Nitro generates `.vercel/output/` with serverless functions and static assets.
4. Vercel auto-detects the Build Output API directory and deploys.

### Local Development

```bash
# Terminal 1: Frontend
cd frontend && bun run dev

# Terminal 2: Judge Server
python app.py

# Terminal 3: CLI
ghostpm
```

All services connect to the same Supabase project, enabling cross-surface real-time synchronization during development.
