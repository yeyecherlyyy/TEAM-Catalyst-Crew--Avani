# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 2.x (current) | Yes |
| 1.x | No |

## Reporting a Vulnerability

If you discover a security vulnerability in Ghost-PM, please report it responsibly. **Do not open a public issue.**

### Reporting Process

1. **Email**: Send a detailed report to **team-catalyst-crew@proton.me** with the subject line `[SECURITY] Brief description`.
2. **Include**:
   - Description of the vulnerability.
   - Steps to reproduce.
   - Potential impact assessment.
   - Suggested fix (if any).
3. **Response time**: We will acknowledge receipt within 48 hours and provide an initial assessment within 7 days.

### What Happens Next

- We will investigate and validate the report.
- If confirmed, we will develop and test a fix.
- A security advisory will be published once the fix is released.
- Credit will be given to the reporter (unless anonymity is requested).

## Security Practices

### Authentication and Authorization

- All user authentication is handled through **Supabase Auth** with secure session management.
- **Row Level Security (RLS)** policies enforce data isolation between teams at the database level.
- API keys are never exposed to the client. Server-side routes proxy all AI service calls.

### Data Protection

- Environment variables and API keys are excluded from version control via `.gitignore`.
- The `.env.example` file contains only placeholder values, never real credentials.
- All Supabase connections use TLS encryption in transit.

### Dependency Management

- **Dependabot** is configured to automatically check for dependency vulnerabilities.
- **CodeQL** analysis runs on every push and pull request to detect security anti-patterns.
- Frontend dependencies enforce a 24-hour minimum release age (`bunfig.toml`) to mitigate supply chain attacks.

### Input Validation

- All user inputs are validated on both client and server sides.
- AI prompt injection is mitigated through envelope prompting with strict system instructions.
- Document extraction (PPTX/DOCX) uses sandboxed parsing libraries without code execution.

### CSRF Protection

- TanStack Start server functions are protected by CSRF middleware (`createCsrfMiddleware`).
- All state-mutating API endpoints validate request origin.

## Scope

This security policy applies to the Ghost-PM repository and all associated services (web dashboard, judge engine, CLI, and daemon).
