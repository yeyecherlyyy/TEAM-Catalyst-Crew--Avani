# Contributing to Ghost-PM

Thank you for your interest in contributing to Ghost-PM. This document provides guidelines and standards for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

All contributors are expected to adhere to the [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating.

## Getting Started

1. **Fork** the repository and clone your fork locally.
2. **Install dependencies** for the module you are working on:

   ```bash
   # Frontend
   cd frontend && bun install

   # Python services
   pip install -r requirements.txt

   # CLI
   cd cli && pip install -e .
   ```

3. **Set up environment variables** by copying `.env.example` to `.env` and filling in your credentials.
4. **Create a branch** for your work:

   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Workflow

### Frontend (TanStack Start)

```bash
cd frontend
bun run dev       # Start development server
bun run lint      # Run ESLint
bun run format    # Run Prettier
bun run build     # Production build
```

### Python Services

```bash
python -m unittest test_judge_agent -v    # Run tests
python app.py                             # Start judge server
```

### Pre-Commit Checks

Before committing, ensure:

1. All linters pass with zero warnings.
2. TypeScript compiles without errors (`tsc --noEmit`).
3. Existing tests pass.
4. New features include corresponding tests where applicable.

## Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/). Every commit message must follow the format:

```
<type>(<scope>): <description>

[optional body]
[optional footer(s)]
```

### Types

| Type | Purpose |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting, semicolons, whitespace (no logic change) |
| `refactor` | Code restructuring without behavior change |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance tasks, tooling updates |

### Scopes

| Scope | Applies to |
|---|---|
| `frontend` | TanStack Start web application |
| `judge` | Skeptical AI Judge engine |
| `cli` | Terminal REPL and daemon |
| `api` | Next.js API routes |
| `db` | Supabase schema and migrations |
| `core` | Cross-cutting concerns |

### Examples

```
feat(frontend): add milestone drag-and-drop reordering
fix(judge): handle empty slide content in PPTX extraction
docs: update architecture diagram in README
ci: add CodeQL security analysis workflow
```

## Pull Request Process

1. **Update documentation** if your changes affect public APIs, configuration, or user-facing behavior.
2. **Add tests** for new functionality.
3. **Ensure CI passes** — all GitHub Actions checks must be green.
4. **Request review** from at least one maintainer.
5. **Squash commits** into logical units before merging if your PR contains fix-up commits.

### PR Title Format

Follow the same Conventional Commits format as commit messages:

```
feat(frontend): implement real-time team notifications
```

### PR Checklist

- [ ] Code follows the project's style guidelines.
- [ ] Self-review completed.
- [ ] Comments added for non-obvious logic.
- [ ] Documentation updated if applicable.
- [ ] Tests added or updated.
- [ ] No new warnings introduced.

## Code Standards

### TypeScript / Frontend

- **Strict mode** is enabled in `tsconfig.json`. Do not disable it.
- Use **named exports** over default exports.
- Prefer **functional components** with hooks.
- Use **Radix UI primitives** for accessible interactive elements.
- All user-facing strings must be descriptive and professional.

### Python

- Follow **PEP 8** conventions.
- Use **type hints** for all function signatures.
- Document public functions with docstrings.
- Handle exceptions explicitly — never use bare `except:`.

### SQL / Database

- All tables must have **Row Level Security** policies.
- Use **parameterized queries** — never interpolate user input.
- Add **indexes** for columns used in WHERE clauses and JOINs.

## Reporting Issues

Use the [issue templates](.github/ISSUE_TEMPLATE/) to report bugs or request features. Provide as much context as possible:

- Steps to reproduce (for bugs)
- Expected vs. actual behavior
- Environment details (OS, Node.js version, Python version)
- Screenshots or logs where applicable

---

Thank you for contributing to Ghost-PM.
