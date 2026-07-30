"""Ghost-PM Authentication.

Handles Supabase Auth from the CLI terminal.
Supports email/password login and token refresh.
Stores session in .ghost/config.json.
"""

from __future__ import annotations

import json
import getpass
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from ghost_pm.config import GhostConfig, GHOST_UI_URL

console = Console()


def login_with_email(config: GhostConfig) -> GhostConfig | None:
    """Authenticate via email/password against Supabase Auth."""
    try:
        from supabase import create_client
    except ImportError:
        console.print("[red]supabase package not installed.[/red]")
        return None

    console.print()
    console.print(Panel(
        "[bold]Ghost-PM Login[/bold]\n"
        "[dim]Use the same credentials as the web dashboard.[/dim]",
        expand=False,
    ))

    email = console.input("[cyan]Email:[/cyan] ").strip()
    if not email:
        console.print("[red]Email is required.[/red]")
        return None

    password = getpass.getpass("Password: ")
    if not password:
        console.print("[red]Password is required.[/red]")
        return None

    console.print("[dim]Authenticating...[/dim]")

    try:
        client = create_client(config.supabase_url, config.supabase_key)
        result = client.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })

        if result.user is None:
            console.print("[red]Login failed. Check your credentials.[/red]")
            return None

        # Update config with auth tokens
        config.access_token = result.session.access_token
        config.refresh_token = result.session.refresh_token
        config.user_id = result.user.id

        # Extract display name
        meta = result.user.user_metadata or {}
        config.member_name = (
            meta.get("full_name")
            or meta.get("name")
            or email.split("@")[0]
        )

        config.save_ghost_config()

        console.print(f"[green]Logged in as {config.member_name}[/green]")
        return config

    except Exception as e:
        error_msg = str(e)
        if "Invalid login" in error_msg or "invalid" in error_msg.lower():
            console.print("[red]Invalid email or password.[/red]")
        else:
            console.print(f"[red]Auth error: {error_msg}[/red]")
        return None


def signup_with_email(config: GhostConfig) -> GhostConfig | None:
    """Create a new account via email/password."""
    try:
        from supabase import create_client
    except ImportError:
        console.print("[red]supabase package not installed.[/red]")
        return None

    console.print()
    console.print(Panel(
        "[bold]Ghost-PM Signup[/bold]\n"
        "[dim]Create your account to join a hackathon team.[/dim]",
        expand=False,
    ))

    name = console.input("[cyan]Your name:[/cyan] ").strip()
    if not name:
        console.print("[red]Name is required.[/red]")
        return None

    email = console.input("[cyan]Email:[/cyan] ").strip()
    if not email:
        console.print("[red]Email is required.[/red]")
        return None

    password = getpass.getpass("Password (min 6 chars): ")
    if len(password) < 6:
        console.print("[red]Password must be at least 6 characters.[/red]")
        return None

    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        console.print("[red]Passwords don't match.[/red]")
        return None

    console.print("[dim]Creating account...[/dim]")

    try:
        client = create_client(config.supabase_url, config.supabase_key)
        result = client.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {"full_name": name},
            },
        })

        if result.user is None:
            console.print("[red]Signup failed.[/red]")
            return None

        if result.session is None:
            console.print(
                "[yellow]Account created. Check your email to confirm, "
                "then run:[/yellow] [bold]ghostpm login[/bold]"
            )
            return None

        # Auto-login after signup
        config.access_token = result.session.access_token
        config.refresh_token = result.session.refresh_token
        config.user_id = result.user.id
        config.member_name = name
        config.save_ghost_config()

        console.print(f"[green]Account created and logged in as {name}[/green]")
        return config

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            console.print("[yellow]This email is already registered. Use:[/yellow] [bold]ghostpm login[/bold]")
        else:
            console.print(f"[red]Signup error: {error_msg}[/red]")
        return None


def refresh_session(config: GhostConfig) -> GhostConfig | None:
    """Refresh the auth session using the stored refresh token."""
    if not config.refresh_token:
        return None

    try:
        from supabase import create_client

        client = create_client(config.supabase_url, config.supabase_key)
        result = client.auth.refresh_session(config.refresh_token)

        if result.session:
            config.access_token = result.session.access_token
            config.refresh_token = result.session.refresh_token
            config.save_ghost_config()
            return config
    except Exception:
        pass

    return None


def ensure_authenticated(config: GhostConfig) -> GhostConfig | None:
    """Ensure the user is authenticated. Prompts login if not.

    Returns updated config with valid tokens, or None if auth failed.
    """
    # Already has a token — try to refresh it
    if config.access_token:
        refreshed = refresh_session(config)
        if refreshed:
            return refreshed
        # Token expired and refresh failed — need to re-login
        console.print("[yellow]Session expired. Please log in again.[/yellow]")

    # Not authenticated — offer options
    console.print()
    console.print(Panel(
        "[bold]Authentication Required[/bold]\n\n"
        f"  [cyan]1.[/cyan] Login with email/password\n"
        f"  [cyan]2.[/cyan] Create a new account\n"
        f"  [cyan]3.[/cyan] Sign up on the web: [link]{config.ui_url}[/link]\n",
        expand=False,
    ))

    choice = console.input("[cyan]Choose (1/2/3):[/cyan] ").strip()

    if choice == "1":
        return login_with_email(config)
    elif choice == "2":
        return signup_with_email(config)
    elif choice == "3":
        console.print(
            f"\n  Visit [bold cyan]{config.ui_url}/signup[/bold cyan] to create an account.\n"
            "  Then run: [bold]ghostpm login[/bold]\n"
        )
        return None
    else:
        console.print("[dim]Cancelled.[/dim]")
        return None


def get_authenticated_client(config: GhostConfig):
    """Get a Supabase client authenticated with the user's session."""
    try:
        from supabase import create_client

        client = create_client(config.supabase_url, config.supabase_key)

        if config.access_token:
            client.auth.set_session(config.access_token, config.refresh_token)

        return client
    except Exception as e:
        console.print(f"[red]Failed to create authenticated client: {e}[/red]")
        return None
