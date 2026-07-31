"""
app.py — Web interface for Judge Agent.

Runs a Flask server that wraps the judge_pitch() core function,
providing a browser-based UI for evaluating hackathon submissions.

Usage:
    python app.py
    # Then open http://localhost:5000 in your browser
"""

import json
import os
import tempfile
import traceback

from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

from judge_agent import judge_pitch, assemble_input, CALIBRATION_IDEA
from extractors import extract_pitch_text, summarize_repo, check_text_quality, research_idea

# Load .env for API key
load_dotenv()

app = Flask(__name__, template_folder="templates", static_folder="static")

# Allow large file uploads (50MB max)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024


@app.route("/")
def index():
    """Serve the main web interface."""
    return render_template("index.html")


@app.route("/api/judge", methods=["POST"])
def api_judge():
    """API endpoint for judging submissions.

    Accepts multipart form data with:
      - idea_text: string (optional)
      - ppt_file: file upload .pptx/.docx (optional)
      - repo_path: string path to local repo (optional)
      - api_key: string (optional, falls back to env/dotenv)
      - model: string (optional, default gemini-2.0-flash)

    Returns JSON matching the judge output contract.
    """
    try:
        # --- Resolve API key ---
        api_key = request.form.get("api_key", "").strip()
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return jsonify({"error": "No API key provided. Set GEMINI_API_KEY in .env or enter it in the form."}), 400

        model = request.form.get("model", "gemini-2.0-flash").strip()
        if not model:
            model = "gemini-2.0-flash"

        # --- Extract inputs ---
        idea_text = None
        deck_text = None
        warnings = []

        # Idea text
        idea_input = request.form.get("idea_text", "").strip()
        if idea_input:
            idea_text = idea_input

        # PPT/DOCX file upload
        ppt_file = request.files.get("ppt_file")
        if ppt_file and ppt_file.filename:
            ext = os.path.splitext(ppt_file.filename)[1].lower()
            if ext not in (".pptx", ".docx"):
                return jsonify({"error": f"Unsupported file format: {ext}. Use .pptx or .docx"}), 400

            # Save to temp file for extraction
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                ppt_file.save(tmp.name)
                tmp_path = tmp.name

            try:
                deck_text = extract_pitch_text(tmp_path)
                word_count = len(deck_text.split())
                if word_count < 50:
                    warnings.append(f"Deck extracted only {word_count} words. Judgment may be less reliable.")
            finally:
                os.unlink(tmp_path)

        # Web research (Tavily)
        research_text = None
        enable_research = request.form.get("enable_research", "").strip().lower() in ("true", "1", "on", "yes")
        if enable_research and idea_text:
            tavily_key = os.environ.get("TAVILY_API_KEY", "")
            if tavily_key:
                research_text = research_idea(idea_text, tavily_key)
            else:
                warnings.append("Web research requested but TAVILY_API_KEY not configured. Skipping.")

        # --- Validate at least one input ---
        if not any([idea_text, deck_text]):
            return jsonify({"error": "At least one input is required: idea description or pitch deck file."}), 400

        # --- Assemble and judge ---
        assembled, inputs_used = assemble_input(
            idea=idea_text, deck_text=deck_text,
            research_text=research_text,
        )

        result = judge_pitch(assembled, api_key=api_key, model=model)
        result["inputs_used"] = inputs_used

        if warnings:
            result["warnings"] = warnings

        return jsonify(result)

    except ValueError as e:
        return jsonify({"error": f"Judging error: {str(e)}"}), 500
    except RuntimeError as e:
        return jsonify({"error": f"API error: {str(e)}"}), 500
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Unexpected error: {str(e)}"}), 500


@app.route("/api/test", methods=["POST"])
def api_test():
    """Run the built-in calibration test (fridge-recipe app)."""
    try:
        api_key = request.form.get("api_key", "").strip()
        if not api_key:
            api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return jsonify({"error": "No API key provided."}), 400

        model = request.form.get("model", "gemini-2.0-flash").strip()

        assembled, inputs_used = assemble_input(idea=CALIBRATION_IDEA)
        result = judge_pitch(assembled, api_key=api_key, model=model)
        result["inputs_used"] = inputs_used
        result["calibration_note"] = "This is the built-in calibration test (fridge-recipe app). Scores should cluster around 4-5, not 7-9."

        return jsonify(result)

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/extract", methods=["POST"])
def api_extract():
    """Preview extracted text without judging (equivalent to --show-extracted)."""
    try:
        idea_text = None
        deck_text = None
        repo_text = None

        idea_input = request.form.get("idea_text", "").strip()
        if idea_input:
            idea_text = idea_input

        ppt_file = request.files.get("ppt_file")
        if ppt_file and ppt_file.filename:
            ext = os.path.splitext(ppt_file.filename)[1].lower()
            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                ppt_file.save(tmp.name)
                tmp_path = tmp.name
            try:
                deck_text = extract_pitch_text(tmp_path)
            finally:
                os.unlink(tmp_path)

        repo_path = request.form.get("repo_path", "").strip()
        if repo_path and os.path.isdir(repo_path):
            repo_text = summarize_repo(repo_path)

        assembled, inputs_used = assemble_input(
            idea=idea_text, deck_text=deck_text, repo_text=repo_text
        )

        return jsonify({
            "extracted_text": assembled,
            "inputs_used": inputs_used,
            "word_count": len(assembled.split()),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("\n  Judge Agent Web Interface")
    print("  ========================")
    print("  Open http://localhost:5000 in your browser\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
