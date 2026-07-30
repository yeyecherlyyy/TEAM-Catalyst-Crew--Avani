"""Ghost-PM Git Hook Installer.

Programmatically installs pre-commit and post-commit hooks
into the .git/hooks/ directory. Backs up existing hooks.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path


PRE_COMMIT_SCRIPT = '''#!/usr/bin/env python3
"""Ghost-PM pre-commit hook — Scope Guard.

Checks if the staged changes align with the current active milestone.
Blocks the commit if scope creep is detected (unless overridden).
"""
import subprocess
import sys
from pathlib import Path

def main():
    # Find .ghost directory
    ghost_dir = Path.cwd() / ".ghost"
    if not ghost_dir.is_dir():
        # Ghost-PM not initialized, allow commit
        sys.exit(0)

    # Check for override
    override_path = ghost_dir / ".scope_override"
    if override_path.exists():
        override_path.unlink()
        print("[Ghost-PM] ⚠ Scope override consumed. This commit bypasses the scope guard.")
        sys.exit(0)

    # Run the actual scope check
    try:
        result = subprocess.run(
            [sys.executable, "-m", "ghost_pm.hooks.pre_commit"],
            capture_output=True, text=True,
            cwd=str(Path.cwd()),
        )
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)
        sys.exit(result.returncode)
    except Exception as e:
        # If the hook fails to run, allow the commit (fail open)
        print(f"[Ghost-PM] ⚠ Scope check error: {e}. Allowing commit.")
        sys.exit(0)

if __name__ == "__main__":
    main()
'''

POST_COMMIT_SCRIPT = '''#!/usr/bin/env python3
"""Ghost-PM post-commit hook — Progress Tracker.

Updates state.json with commit data, rebuilds code graph,
and syncs to Supabase.
"""
import subprocess
import sys
from pathlib import Path

def main():
    ghost_dir = Path.cwd() / ".ghost"
    if not ghost_dir.is_dir():
        sys.exit(0)

    try:
        result = subprocess.run(
            [sys.executable, "-m", "ghost_pm.hooks.post_commit"],
            capture_output=True, text=True,
            cwd=str(Path.cwd()),
        )
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)
    except Exception as e:
        print(f"[Ghost-PM] ⚠ Post-commit error: {e}")

    sys.exit(0)  # Never block post-commit

if __name__ == "__main__":
    main()
'''


def install_hooks(project_root: Path) -> None:
    """Install Ghost-PM git hooks into .git/hooks/.

    Backs up existing hooks with a .backup extension.
    """
    hooks_dir = project_root / ".git" / "hooks"
    if not hooks_dir.is_dir():
        hooks_dir.mkdir(parents=True, exist_ok=True)

    for hook_name, script_content in [
        ("pre-commit", PRE_COMMIT_SCRIPT),
        ("post-commit", POST_COMMIT_SCRIPT),
    ]:
        hook_path = hooks_dir / hook_name

        # Backup existing hook
        if hook_path.exists():
            backup_path = hooks_dir / f"{hook_name}.backup"
            hook_path.rename(backup_path)

        # Write new hook
        hook_path.write_text(script_content)

        # Make executable
        st = os.stat(hook_path)
        os.chmod(hook_path, st.st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)


def uninstall_hooks(project_root: Path) -> None:
    """Remove Ghost-PM hooks and restore backups if they exist."""
    hooks_dir = project_root / ".git" / "hooks"

    for hook_name in ("pre-commit", "post-commit"):
        hook_path = hooks_dir / hook_name
        backup_path = hooks_dir / f"{hook_name}.backup"

        if hook_path.exists():
            hook_path.unlink()

        if backup_path.exists():
            backup_path.rename(hook_path)
