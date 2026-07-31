# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-07-31

### Fixed

- Resolved Vercel deployment configuration for Nitro Build Output API.
- Set explicit Nitro preset for Vercel serverless runtime compatibility.

### Changed

- README rewritten with Mermaid architecture diagrams, ER diagrams, and sequence diagrams.
- Removed emoji usage from all documentation for professional consistency.

## [2.0.0] - 2026-07-30

### Added

- TanStack Start frontend with server-side rendering and full dashboard.
- Interactive 3D code dependency graph visualization (React Three Fiber).
- Drag-and-drop milestone roadmap with status management.
- Real-time team collaboration via Supabase Realtime channels.
- AI Strategy Advisor with context-aware envelope prompting.
- Artifact generation engine (scorecards, roadmaps, flowcharts, briefs).
- Judge simulation panel with progressive 6-question pressure defense.
- Team creation and join-by-code workflows.
- Dark mode support with system preference detection.
- CLI banner component for terminal command promotion.

### Changed

- Migrated frontend from Next.js to TanStack Start for improved SSR control.
- Upgraded Gemini model from 1.5 to 2.5 Flash.
- Database schema consolidated into single idempotent migration.
- RLS policies rewritten for secure team creation and joining flows.

## [1.0.0] - 2026-07-28

### Added

- Ghost-PM headless CLI with interactive REPL and slash commands.
- Background daemon with file watching and auto-sync to Supabase.
- AST-based codebase graph parser and dependency analyzer.
- Git pre-commit and post-commit scope guard hooks.
- Skeptical AI Judge Agent with PPTX/DOCX extraction.
- Tavily-powered competitor verification and web research.
- Evidence-based scoring rubric with 6-dimension evaluation.
- Flask web server for Judge Agent (port 5000).
- Supabase authentication and session management.
- Multi-key Gemini API pool with round-robin rotation and exponential backoff.
- Next.js API routes for AI brainstorm, rating, embedding, and search.
- PostgreSQL schema with RLS, enums, and pgvector support.
- Comprehensive test suite for Judge Agent.
- Initial project documentation and environment configuration.
