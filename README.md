# Ghost-PM Hackathon Assistant (TEAM Catalyst Crew)

A comprehensive headless hackathon coaching system and AI advisor.

## Repository Contents

This workspace contains two main modules:

1. **Ghost-PM Web Application & API Gateway**: A Next.js project integrated with Supabase Auth, Gemini API client pool (round-robin keys, rate limiting handlers), AI advisor engine, and interactive REPL chat.
2. **Judge Agent (CLI & Web Interface)**: A standalone, evidence-based AI judge that evaluates hackathon submissions (pitch deck, description, and web research) to prepare teams for real judging pressure.

---

## ⚖️ Judge Agent

Judge Agent evaluates a hackathon team's **idea description** and/or **pitch deck** (.pptx/.docx), automatically performing online web research (via Tavily) to verify competitors. It scores the idea across 6 dimensions, generates 6 progressive judge-style questions, and summarizes team readiness.

### Ingestion Paths
- **Idea Text**: Plain description.
- **Pitch Deck**: Automatic text extractor for PowerPoint (.pptx) and Word (.docx).
- **Web Research**: Auto-searches for existing competitors and similar projects using Tavily.

### Installation & Run

1. **Install requirements**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and fill in your keys:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   TAVILY_API_KEY=your_tavily_api_key
   ```

3. **Run the local Web Server**:
   ```bash
   python app.py
   ```
   Open **http://localhost:5000** in your browser.

4. **Or run via CLI**:
   ```bash
   python judge_agent.py --idea "fridge-recipe app" --pretty --research
   ```

### Running Tests
```bash
python -m unittest test_judge_agent -v
```

---

## 🚀 Getting Started (Next.js Application)

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
