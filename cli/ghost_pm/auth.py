"""Ghost-PM Authentication.

Handles Supabase Auth from the CLI terminal.
Supports email/password login and token refresh.
Stores session in .ghost/config.json.
"""

from __future__ import annotations

import json
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
import questionary
from questionary import Choice

from ghost_pm.config import GhostConfig, GHOST_UI_URL

console = Console()

# ── Unicode chars ─────────────────────────────────────
CHECK = "✓"
CROSS = "✗"
WARN = "⚠"
SPARK = "⚡"

# Custom style for Questionary to match Ghost-PM cyan/magenta
custom_style = questionary.Style([
    ('qmark', 'fg:#00ffff bold'),       # cyan
    ('question', 'bold'),
    ('answer', 'fg:#00ffff bold'),
    ('pointer', 'fg:#ff00ff bold'),     # magenta
    ('highlighted', 'fg:#00ffff bold'), # cyan
    ('selected', 'fg:#00ffff'),
    ('separator', 'fg:#666666'),
    ('instruction', 'fg:#666666 italic'),
    ('text', ''),
])


def login_with_email(config: GhostConfig) -> GhostConfig | None:
    """Authenticate via email/password against Supabase Auth."""
    try:
        from supabase import create_client
    except ImportError:
        console.print(f"  [red]{CROSS} supabase package not installed.[/red]")
        return None

    console.print()
    console.print(Panel(
        "[bold]Ghost-PM Login[/bold]\n"
        "[dim]Use the same credentials as the web dashboard.[/dim]",
        expand=False, border_style="cyan",
    ))

    email = questionary.text(
        "Email:", 
        style=custom_style
    ).ask()
    
    if not email:
        return None

    password = questionary.password(
        "Password:", 
        style=custom_style
    ).ask()
    
    if not password:
        return None

    console.print("  [dim]Authenticating...[/dim]")

    try:
        client = create_client(config.supabase_url, config.supabase_key)
        result = client.auth.sign_in_with_password({
            "email": email.strip(),
            "password": password,
        })

        if result.user is None:
            console.print(f"  [red]{CROSS} Login failed. Check your credentials.[/red]")
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

        console.print(f"  [green]{CHECK} Logged in as [bold]{config.member_name}[/bold][/green]")
        return config

    except Exception as e:
        error_msg = str(e)
        if "email_not_confirmed" in error_msg.lower() or "email not confirmed" in error_msg.lower():
            console.print(f"\n  [yellow]{WARN} Email not confirmed.[/yellow]")
            console.print(
                "  [dim]Your account exists but email confirmation is required.\n"
                "  Either confirm your email, or go to Supabase Dashboard →\n"
                "  Authentication → Providers → Email → disable 'Confirm email'.[/dim]"
            )
        elif "invalid login" in error_msg.lower() or "invalid" in error_msg.lower():
            console.print(f"  [red]{CROSS} Invalid email or password.[/red]")
        else:
            console.print(f"  [red]{CROSS} Auth error: {error_msg}[/red]")
        return None


def signup_with_email(config: GhostConfig) -> GhostConfig | None:
    """Create a new account via email/password."""
    try:
        from supabase import create_client
    except ImportError:
        console.print(f"  [red]{CROSS} supabase package not installed.[/red]")
        return None

    console.print()
    console.print(Panel(
        "[bold]Ghost-PM Signup[/bold]\n"
        "[dim]Create your account to join a hackathon team.[/dim]",
        expand=False, border_style="cyan",
    ))

    name = questionary.text("Display name:", style=custom_style).ask()
    if not name:
        return None

    email = questionary.text("Email:", style=custom_style).ask()
    if not email:
        return None

    password = questionary.password("Password (min 6 chars):", style=custom_style).ask()
    if not password:
        return None
    
    if len(password) < 6:
        console.print(f"  [red]{CROSS} Password must be at least 6 characters.[/red]")
        return None

    confirm = questionary.password("Confirm password:", style=custom_style).ask()
    if not confirm:
        return None
        
    if password != confirm:
        console.print(f"  [red]{CROSS} Passwords don't match.[/red]")
        return None

    console.print("  [dim]Creating account...[/dim]")

    try:
        client = create_client(config.supabase_url, config.supabase_key)
        result = client.auth.sign_up({
            "email": email.strip(),
            "password": password,
            "options": {
                "data": {"full_name": name.strip()},
            },
        })

        if result.user is None:
            console.print(f"  [red]{CROSS} Signup failed.[/red]")
            return None

        if result.session is None:
            # Email confirmation required
            console.print(
                f"\n  [yellow]{WARN} Account created but email confirmation is required.[/yellow]\n"
                "  [dim]Check your inbox and confirm, then run:[/dim] [bold]ghostpm login[/bold]\n"
                "  [dim](Or disable 'Confirm email' in Supabase Auth settings to bypass.)[/dim]"
            )
            return None

        # Auto-login after signup (email confirmation disabled)
        config.access_token = result.session.access_token
        config.refresh_token = result.session.refresh_token
        config.user_id = result.user.id
        config.member_name = name.strip()
        config.save_ghost_config()

        console.print(f"  [green]{CHECK} Account created and logged in as [bold]{config.member_name}[/bold][/green]")
        return config

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower():
            console.print(f"  [yellow]{WARN} This email is already registered.[/yellow]")
            console.print("  [dim]Use:[/dim] [bold]ghostpm login[/bold]")
        else:
            console.print(f"  [red]{CROSS} Signup error: {error_msg}[/red]")
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
        console.print(f"  [yellow]{WARN} Session expired. Please log in again.[/yellow]")

    # Not authenticated — offer options
    console.print()
    console.print(Panel(
        "[bold]Authentication Required[/bold]\n"
        "[dim]Use arrow keys to select an option[/dim]",
        expand=False, border_style="cyan",
    ))

    choice = questionary.select(
        "Choose an action:",
        choices=[
            Choice("Login with email/password", value="login"),
            Choice("Create a new account", value="signup"),
            Choice("Sign up on the web (opens link)", value="web"),
            Choice("Cancel", value="cancel"),
        ],
        style=custom_style
    ).ask()

    if choice == "login":
        return login_with_email(config)
    elif choice == "signup":
        return signup_with_email(config)
    elif choice == "web":
        console.print(
            f"\n  Visit [bold cyan]{config.ui_url}/signup[/bold cyan] to create an account.\n"
            "  Then run: [bold]ghostpm login[/bold]\n"
        )
        return None
    else:
        console.print("  [dim]Cancelled.[/dim]")
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
        console.print(f"  [red]{CROSS} Failed to create authenticated client: {e}[/red]")
        return None
