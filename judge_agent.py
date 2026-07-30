"""
judge_agent.py — AI Judge for hackathon submissions.

Evaluates an idea, pitch deck (PPT/DOCX), and/or prototype (local repo)
the way a skeptical professional judge would — producing scored,
evidence-based criticism and progressive judge-style questions.

Part of the Ghost-PM headless hackathon coaching system.

Usage:
    python judge_agent.py --idea "Your idea description here"
    python judge_agent.py --idea-file idea.md --ppt deck.pptx
    python judge_agent.py --idea "..." --ppt deck.pptx --repo ./myproject
    python judge_agent.py --test --api-key YOUR_KEY

Core function `judge_pitch()` is importable for use by other Ghost-PM
components (Scope Guard, Diff Diary, etc.).
"""

import argparse
import json
import os
import sys
import textwrap

from dotenv import load_dotenv

from extractors import (
    check_text_quality,
    extract_pitch_text,
    read_idea_file,
    research_idea,
    summarize_repo,
)


# ---------------------------------------------------------------------------
# Judging prompt — the rubric and rules that make the judge skeptical
# ---------------------------------------------------------------------------

JUDGE_SYSTEM_PROMPT = textwrap.dedent("""\
You are a skeptical, experienced hackathon judge evaluating a team's submission.
You are NOT a cheerleader. You are NOT trying to make the team feel good.
You are trying to surface every weakness a real judging panel would find,
so the team can fix them before the actual round.

SCORING RULES (read these carefully):
- Score each dimension 1–10.
- An average, unremarkable submission scores 4–5. NOT 7.
- A score of 7+ means genuinely impressive on that dimension — rare.
- A score of 9–10 means best-in-class at a competitive hackathon — extremely rare.
- Every single score MUST include a "justification" that cites SPECIFIC evidence
  from the submitted material. No generic feedback like "good job" or "needs improvement."
  Name the exact claim, slide, feature, or gap you're referencing.

SCORING DIMENSIONS:
1. idea_innovation (uniqueness): Is this genuinely novel, or a known pattern rebranded?
2. technical_feasibility: Does the approach realistically work with the stated stack?
3. scalability: Holds up beyond a demo, or hits hardcoded limits at scale?
4. relatability_market_fit: Target user is specific and real, or vague?
5. execution_clarity: What's actually built vs. what's aspirational?
6. presentation_clarity: Explainable in one breath? Does the deck match the narrative?

QUESTION GENERATION RULES:
Generate exactly 6 questions, ordered by difficulty:
1. "easy" — framing: what problem, for whom
2. "easy-medium" — mechanics: how it actually works step by step
3. "medium" — technical depth: targets the lowest-scored technical claim
4. "medium-hard" — differentiation: names a real competitor or existing pattern if plausible
5. "hard" — scalability/edge case: what breaks this at 10x–100x scale
6. "hardest" — business/ethical/viability: whichever is weakest in the material

CRITICAL: At least one question MUST pressure-test the HIGHEST-scored dimension,
not just weak spots. Real judges probe strengths too.

READINESS SUMMARY:
Write a short, plain-English critical read (2–4 sentences).
Example: "Idea is strong and well-differentiated, but the repo shows no test
coverage and the deck claims 'production-ready' — expect judges to open with
a reliability question."
Do NOT produce a numeric percentage or "chance of winning."

CROSS-REFERENCING (when multiple input sections are present):
If the input contains IDEA, DECK, and/or REPO sections, actively cross-check:
- Does the DECK oversell relative to the IDEA?
- Does the DECK claim something the REPO doesn't actually implement?
- Does the IDEA's claimed differentiation hold up given what's in the REPO?
Flag any inconsistencies explicitly in your justifications.

RESPOND WITH ONLY THIS EXACT JSON STRUCTURE (no markdown fences, no extra text):
{
  "scores": {
    "idea_innovation": {"score": <int 1-10>, "justification": "<specific evidence>"},
    "technical_feasibility": {"score": <int 1-10>, "justification": "<specific evidence>"},
    "scalability": {"score": <int 1-10>, "justification": "<specific evidence>"},
    "relatability_market_fit": {"score": <int 1-10>, "justification": "<specific evidence>"},
    "execution_clarity": {"score": <int 1-10>, "justification": "<specific evidence>"},
    "presentation_clarity": {"score": <int 1-10>, "justification": "<specific evidence>"}
  },
  "questions": [
    {"difficulty": "easy", "question": "<text>"},
    {"difficulty": "easy-medium", "question": "<text>"},
    {"difficulty": "medium", "question": "<text>"},
    {"difficulty": "medium-hard", "question": "<text>"},
    {"difficulty": "hard", "question": "<text>"},
    {"difficulty": "hardest", "question": "<text>"}
  ],
  "readiness_summary": "<2-4 sentence critical read>"
}
""")

RETRY_CORRECTION = (
    "Your previous response was not valid JSON. "
    "Return ONLY the valid JSON object exactly matching the schema above. "
    "No markdown code fences, no explanation, no extra text — just the JSON."
)

# ---------------------------------------------------------------------------
# Built-in calibration example (for --test)
# ---------------------------------------------------------------------------

CALIBRATION_IDEA = textwrap.dedent("""\
Fridge Recipe App — an app that lets you take a photo of your fridge contents
and suggests recipes based on what you have. Uses a phone camera and basic
image recognition to identify ingredients, then matches them against a recipe
database. Target users are busy home cooks who want to reduce food waste.
The tech stack is React Native for the frontend and a Python Flask backend
with a simple SQLite database of recipes. Image recognition is handled by
a pre-trained model from an open-source library. The app is currently a
prototype with 50 hardcoded recipes and image recognition that works for
about 20 common ingredients. No user accounts, no payment system, no
integration with grocery delivery services. The team has been working on
it for 36 hours at the hackathon.
""").strip()


# ---------------------------------------------------------------------------
# Core judging function — importable by other Ghost-PM components
# ---------------------------------------------------------------------------

def judge_pitch(text: str, api_key: str, model: str = "gemini-2.0-flash") -> dict:
    """Evaluate a hackathon submission using the Gemini API.

    This is the single, stable core function. Every ingestion path
    (idea, deck, repo) feeds assembled text into this function.

    Args:
        text: The assembled input text to judge (may contain labeled
              IDEA/DECK/REPO sections).
        api_key: Google Gemini API key.
        model: Gemini model name (default: gemini-2.0-flash).

    Returns:
        A dict matching the output contract:
        {
            "scores": {...},
            "questions": [...],
            "readiness_summary": "..."
        }

    Raises:
        ValueError: If the response cannot be parsed as valid JSON
                    after one retry.
        RuntimeError: If the API call fails.
    """
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    config = types.GenerateContentConfig(
        system_instruction=JUDGE_SYSTEM_PROMPT,
        temperature=0.4,  # Low for consistent, grounded scoring
        response_mime_type="application/json",
    )

    # First attempt
    try:
        response = client.models.generate_content(
            model=model,
            contents=text,
            config=config,
        )
    except Exception as e:
        raise RuntimeError(f"Gemini API call failed: {e}") from e

    # Try parsing the response
    result = _try_parse_json(response.text)
    if result is not None:
        return result

    # Retry once with explicit correction
    print("  [~] First response was not valid JSON. Retrying with correction...")
    try:
        retry_response = client.models.generate_content(
            model=model,
            contents=f"{text}\n\n{RETRY_CORRECTION}",
            config=config,
        )
    except Exception as e:
        raise RuntimeError(f"Gemini API retry call failed: {e}") from e

    result = _try_parse_json(retry_response.text)
    if result is not None:
        return result

    raise ValueError(
        "Failed to get valid JSON from the model after retry.\n"
        f"Last response (first 500 chars): {retry_response.text[:500]}"
    )


def _try_parse_json(text: str) -> dict | None:
    """Attempt to parse JSON from model output, stripping markdown fences."""
    if text is None:
        return None

    cleaned = text.strip()

    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json or ```) and last line (```)
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
        cleaned = "\n".join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# ---------------------------------------------------------------------------
# Input assembly — merges all available sources into one labeled block
# ---------------------------------------------------------------------------

def assemble_input(
    idea: str | None = None,
    deck_text: str | None = None,
    repo_text: str | None = None,
    research_text: str | None = None,
) -> tuple[str, list[str]]:
    """Assemble available input sections into a single labeled text block.

    Args:
        idea: Idea description text (if provided).
        deck_text: Extracted deck/PPT text (if provided).
        repo_text: Summarized repo text (if provided).
        research_text: Web research results (if provided).

    Returns:
        A tuple of (assembled_text, inputs_used_list).
        Example: ("IDEA:\\n...\\n\\nDECK:\\n...", ["idea", "ppt"])
    """
    sections = []
    inputs_used = []

    if idea:
        sections.append(f"IDEA:\n{idea}")
        inputs_used.append("idea")

    if deck_text:
        sections.append(f"DECK:\n{deck_text}")
        inputs_used.append("ppt")

    if repo_text:
        sections.append(f"REPO:\n{repo_text}")
        inputs_used.append("repo")

    if research_text:
        sections.append(f"WEB RESEARCH (existing competitors/similar products found online):\n{research_text}")
        inputs_used.append("web_research")

    assembled = "\n\n".join(sections)
    return assembled, inputs_used


# ---------------------------------------------------------------------------
# Pretty output formatter
# ---------------------------------------------------------------------------

# ANSI color codes for terminal output
class _Colors:
    BOLD = "\033[1m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    GREEN = "\033[92m"
    CYAN = "\033[96m"
    MAGENTA = "\033[95m"
    DIM = "\033[2m"
    RESET = "\033[0m"
    BG_DARK = "\033[48;5;236m"


def _score_color(score: int) -> str:
    """Return a color code based on score value."""
    if score <= 3:
        return _Colors.RED
    elif score <= 5:
        return _Colors.YELLOW
    elif score <= 7:
        return _Colors.GREEN
    else:
        return _Colors.CYAN


def _score_bar(score: int, max_score: int = 10) -> str:
    """Create a visual bar for the score."""
    filled = "#" * score
    empty = "-" * (max_score - score)
    return f"[{filled}{empty}]"


def format_pretty(result: dict) -> str:
    """Format judge output as a human-readable, colored console string.

    Args:
        result: The judge output dict (scores, questions, readiness_summary).

    Returns:
        A formatted string with ANSI color codes.
    """
    lines = []
    c = _Colors

    # Header
    lines.append("")
    lines.append(f"{c.BOLD}{c.CYAN}{'=' * 60}{c.RESET}")
    lines.append(f"{c.BOLD}{c.CYAN}  [JUDGE] JUDGE AGENT -- EVALUATION REPORT{c.RESET}")
    lines.append(f"{c.BOLD}{c.CYAN}{'=' * 60}{c.RESET}")
    lines.append("")

    # Scores
    lines.append(f"{c.BOLD}  SCORES{c.RESET}")
    lines.append(f"  {c.DIM}{'-' * 56}{c.RESET}")

    dimension_labels = {
        "idea_innovation": "[*] Idea/Innovation",
        "technical_feasibility": "[>] Technical Feasibility",
        "scalability": "[^] Scalability",
        "relatability_market_fit": "[o] Market Fit",
        "execution_clarity": "[+] Execution Clarity",
        "presentation_clarity": "[=] Presentation Clarity",
    }

    scores = result.get("scores", {})
    for key, label in dimension_labels.items():
        entry = scores.get(key, {})
        score = entry.get("score", 0)
        justification = entry.get("justification", "N/A")
        color = _score_color(score)
        bar = _score_bar(score)

        lines.append(f"  {c.BOLD}{label:<28}{c.RESET} {color}{score:>2}/10{c.RESET}  {c.DIM}{bar}{c.RESET}")
        # Wrap justification to fit terminal
        wrapped = textwrap.fill(justification, width=52, initial_indent="     ", subsequent_indent="     ")
        lines.append(f"  {c.DIM}{wrapped}{c.RESET}")
        lines.append("")

    # Average score
    all_scores = [s.get("score", 0) for s in scores.values() if isinstance(s, dict)]
    if all_scores:
        avg = sum(all_scores) / len(all_scores)
        avg_color = _score_color(int(avg))
        lines.append(f"  {c.BOLD}{'AVERAGE':<28}{c.RESET} {avg_color}{avg:.1f}/10{c.RESET}")
        lines.append("")

    # Questions
    lines.append(f"{c.BOLD}{c.CYAN}{'-' * 60}{c.RESET}")
    lines.append(f"{c.BOLD}  JUDGE QUESTIONS (easy -> hardest){c.RESET}")
    lines.append(f"  {c.DIM}{'-' * 56}{c.RESET}")

    difficulty_icons = {
        "easy": "[1]",
        "easy-medium": "[2]",
        "medium": "[3]",
        "medium-hard": "[4]",
        "hard": "[5]",
        "hardest": "[!]",
    }

    questions = result.get("questions", [])
    for i, q in enumerate(questions, start=1):
        difficulty = q.get("difficulty", "")
        question = q.get("question", "")
        icon = difficulty_icons.get(difficulty, "•")
        diff_label = f"[{difficulty}]"

        lines.append(f"  {icon} {c.BOLD}Q{i}{c.RESET} {c.DIM}{diff_label:<15}{c.RESET}")
        wrapped = textwrap.fill(question, width=52, initial_indent="     ", subsequent_indent="     ")
        lines.append(f"     {wrapped}")
        lines.append("")

    # Readiness summary
    lines.append(f"{c.BOLD}{c.CYAN}{'-' * 60}{c.RESET}")
    lines.append(f"{c.BOLD}{c.MAGENTA}  READINESS SUMMARY{c.RESET}")
    lines.append(f"  {c.DIM}{'-' * 56}{c.RESET}")
    summary = result.get("readiness_summary", "N/A")
    wrapped = textwrap.fill(summary, width=54, initial_indent="  ", subsequent_indent="  ")
    lines.append(f"  {wrapped}")
    lines.append("")

    # Inputs used
    inputs_used = result.get("inputs_used", [])
    if inputs_used:
        labels = {"idea": "Idea", "ppt": "Deck", "repo": "Repo"}
        used_str = ", ".join(labels.get(i, i) for i in inputs_used)
        lines.append(f"  {c.DIM}Evidence sources: {used_str}{c.RESET}")

    lines.append(f"{c.BOLD}{c.CYAN}{'=' * 60}{c.RESET}")
    lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# API key resolution
# ---------------------------------------------------------------------------

def resolve_api_key(cli_key: str | None = None) -> str:
    """Resolve the Gemini API key from available sources.

    Priority order:
      1. --api-key CLI flag
      2. GEMINI_API_KEY environment variable
      3. .env file (loaded by python-dotenv)

    Args:
        cli_key: API key passed via CLI flag (if any).

    Returns:
        The resolved API key string.

    Raises:
        SystemExit: If no API key can be found.
    """
    # 1. CLI flag
    if cli_key:
        return cli_key

    # 2. Environment variable
    env_key = os.environ.get("GEMINI_API_KEY")
    if env_key:
        return env_key

    # 3. .env file
    load_dotenv()
    dotenv_key = os.environ.get("GEMINI_API_KEY")
    if dotenv_key:
        return dotenv_key

    print(
        "[ERROR] No API key found.\n"
        "   Provide one via:\n"
        "     --api-key YOUR_KEY\n"
        "     GEMINI_API_KEY environment variable\n"
        "     .env file with GEMINI_API_KEY=your-key\n"
    )
    sys.exit(1)


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser for Judge Agent CLI."""
    parser = argparse.ArgumentParser(
        prog="judge_agent",
        description=(
            "Judge Agent — AI-powered hackathon submission evaluator.\n"
            "Scores across 6 dimensions, generates progressive judge questions,\n"
            "and produces a critical readiness summary."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              python judge_agent.py --idea "An app that..."
              python judge_agent.py --idea-file idea.md --ppt deck.pptx
              python judge_agent.py --idea "..." --ppt deck.pptx --repo ./project
              python judge_agent.py --test --api-key YOUR_KEY
        """),
    )

    # Input sources (composable)
    inputs = parser.add_argument_group("Input sources (at least one required)")
    inputs.add_argument(
        "--idea", type=str, default=None,
        help="Inline idea description string.",
    )
    inputs.add_argument(
        "--idea-file", type=str, default=None,
        help="Path to idea description file (.txt or .md).",
    )
    inputs.add_argument(
        "--ppt", type=str, default=None,
        help="Path to pitch deck file (.pptx or .docx).",
    )
    inputs.add_argument(
        "--repo", type=str, default=None,
        help="Path to a local repository to summarize and evaluate.",
    )

    # Configuration
    config = parser.add_argument_group("Configuration")
    config.add_argument(
        "--api-key", type=str, default=None,
        help="Gemini API key (overrides env var and .env file).",
    )
    config.add_argument(
        "--model", type=str, default="gemini-2.0-flash",
        help="Gemini model to use (default: gemini-2.0-flash).",
    )

    # Output modes
    output = parser.add_argument_group("Output options")
    output.add_argument(
        "--pretty", action="store_true",
        help="Print human-readable colored output instead of raw JSON.",
    )
    output.add_argument(
        "--show-extracted", action="store_true",
        help="Print assembled extracted text and exit (no judging).",
    )

    # Utility
    utils = parser.add_argument_group("Utilities")
    utils.add_argument(
        "--test", action="store_true",
        help="Run the built-in calibration example (fridge-recipe app).",
    )
    utils.add_argument(
        "--research", action="store_true",
        help="Enable web research via Tavily to find competitors (requires TAVILY_API_KEY).",
    )

    return parser


def main():
    """CLI entrypoint for Judge Agent."""
    parser = build_parser()
    args = parser.parse_args()

    # ── Handle --test mode ──────────────────────────────────────────
    if args.test:
        api_key = resolve_api_key(args.api_key)
        print("[TEST] Running calibration test (fridge-recipe app)...")
        print(f"   Model: {args.model}")
        print()

        assembled, inputs_used = assemble_input(idea=CALIBRATION_IDEA)
        result = judge_pitch(assembled, api_key=api_key, model=args.model)
        result["inputs_used"] = inputs_used

        if args.pretty:
            print(format_pretty(result))
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    # ── Validate: at least one input source ─────────────────────────
    has_input = any([args.idea, args.idea_file, args.ppt, args.repo])
    if not has_input:
        parser.error(
            "At least one input source is required: "
            "--idea, --idea-file, --ppt, or --repo"
        )

    # ── Extract from each source ────────────────────────────────────
    idea_text = None
    deck_text = None
    repo_text = None

    # Idea (inline or file)
    if args.idea and args.idea_file:
        parser.error("Use --idea OR --idea-file, not both.")

    if args.idea:
        idea_text = args.idea

    if args.idea_file:
        try:
            idea_text = read_idea_file(args.idea_file)
        except (FileNotFoundError, ValueError) as e:
            print(f"[ERROR] Error reading idea file: {e}")
            sys.exit(1)

    # PPT/deck
    if args.ppt:
        try:
            print(f"[DECK] Extracting deck: {args.ppt}")
            deck_text = extract_pitch_text(args.ppt)
            if not check_text_quality(deck_text, "PPT deck"):
                print("   Aborted by user.")
                sys.exit(0)
            print(f"   [OK] Extracted {len(deck_text.split())} words from deck.")
        except (FileNotFoundError, ValueError) as e:
            print(f"[ERROR] Error extracting deck: {e}")
            sys.exit(1)

    # Repo
    if args.repo:
        try:
            print(f"[REPO] Summarizing repo: {args.repo}")
            repo_text = summarize_repo(args.repo)
            if not check_text_quality(repo_text, "Repo summary"):
                print("   Aborted by user.")
                sys.exit(0)
            print(f"   [OK] Summarized repo ({len(repo_text.split())} words).")
        except (FileNotFoundError, ValueError) as e:
            print(f"[ERROR] Error summarizing repo: {e}")
            sys.exit(1)

    # Web research (Tavily)
    research_text = None
    if args.research and idea_text:
        tavily_key = os.environ.get("TAVILY_API_KEY", "")
        if not tavily_key:
            load_dotenv()
            tavily_key = os.environ.get("TAVILY_API_KEY", "")
        if tavily_key:
            print("[RESEARCH] Searching for competitors online...")
            research_text = research_idea(idea_text, tavily_key)
            print(f"   [OK] Research complete ({len(research_text.split())} words).")
        else:
            print("[WARN] --research flag set but no TAVILY_API_KEY found. Skipping.")
    elif args.research and not idea_text:
        print("[WARN] --research requires idea text to search. Skipping.")

    # ── Assemble ────────────────────────────────────────────────────
    assembled, inputs_used = assemble_input(
        idea=idea_text, deck_text=deck_text, repo_text=repo_text,
        research_text=research_text,
    )

    # ── --show-extracted: print and exit ────────────────────────────
    if args.show_extracted:
        print(f"\n{'=' * 60}")
        print("  ASSEMBLED INPUT (what the judge will see)")
        print(f"{'=' * 60}\n")
        print(assembled)
        print(f"\n{'=' * 60}")
        print(f"  Inputs used: {', '.join(inputs_used)}")
        print(f"  Total words: {len(assembled.split())}")
        print(f"{'=' * 60}\n")
        return

    # ── Resolve API key ─────────────────────────────────────────────
    api_key = resolve_api_key(args.api_key)

    # ── Judge ───────────────────────────────────────────────────────
    print(f"\n[JUDGE] Judging with {args.model}...")
    print(f"   Evidence sources: {', '.join(inputs_used)}")
    print()

    try:
        result = judge_pitch(assembled, api_key=api_key, model=args.model)
    except (ValueError, RuntimeError) as e:
        print(f"[ERROR] Judging failed: {e}")
        sys.exit(1)

    # Add inputs_used to the output
    result["inputs_used"] = inputs_used

    # ── Output ──────────────────────────────────────────────────────
    if args.pretty:
        print(format_pretty(result))
    else:
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
