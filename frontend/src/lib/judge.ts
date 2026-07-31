// ── Judge Agent — Client-side Gemini implementation ───
// Ported from judge_agent.py's JUDGE_SYSTEM_PROMPT

const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1,
  import.meta.env.VITE_GEMINI_KEY_2,
  import.meta.env.VITE_GEMINI_KEY_3,
  import.meta.env.VITE_GEMINI_KEY_4,
  import.meta.env.VITE_GEMINI_KEY_5,
  import.meta.env.VITE_GEMINI_KEY_6,
  import.meta.env.VITE_GEMINI_KEY_7,
  import.meta.env.VITE_GEMINI_KEY_8,
].filter(Boolean) as string[];

let keyIdx = 0;
function nextKey(): string {
  const k = GEMINI_KEYS[keyIdx % GEMINI_KEYS.length];
  keyIdx++;
  return k;
}

// ── Types ────────────────────────────────────────────
export interface ScoreDimension {
  score: number;
  justification: string;
}

export interface JudgeQuestion {
  difficulty: string;
  question: string;
}

export interface JudgeResult {
  scores: {
    idea_innovation: ScoreDimension;
    technical_feasibility: ScoreDimension;
    scalability: ScoreDimension;
    relatability_market_fit: ScoreDimension;
    execution_clarity: ScoreDimension;
    presentation_clarity: ScoreDimension;
  };
  questions: JudgeQuestion[];
  readiness_summary: string;
}

// ── System Prompt (ported from judge_agent.py) ───────
const JUDGE_SYSTEM_PROMPT = `You are a skeptical, experienced hackathon judge evaluating a team's submission.
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
4. "medium-hard" — differentiation: names a real competitor or existing pattern
5. "hard" — scalability/edge case: what breaks this at 10x–100x scale
6. "hardest" — business/ethical/viability: whichever is weakest

CRITICAL: At least one question MUST pressure-test the HIGHEST-scored dimension.

READINESS SUMMARY:
Write a short, plain-English critical read (2–4 sentences).
Do NOT produce a numeric percentage or "chance of winning."

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
}`;

// ── Main judge function ──────────────────────────────
export async function judgePitch(ideaText: string): Promise<JudgeResult> {
  if (GEMINI_KEYS.length === 0) {
    throw new Error("No API keys configured");
  }

  const contents = [
    {
      role: "user",
      parts: [{ text: `IDEA:\n${ideaText}\n\nEvaluate this hackathon submission.` }],
    },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = nextKey();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: JUDGE_SYSTEM_PROMPT }] },
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
              maxOutputTokens: 2048,
            },
          }),
        }
      );

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (!res.ok) {
        lastError = `API error ${res.status}`;
        continue;
      }

      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.find((p: Record<string, unknown>) => typeof p.text === "string");
      let text = textPart?.text ?? "";
      
      try {
        let cleanText = text.trim();
        const firstBrace = cleanText.indexOf("{");
        const lastBrace = cleanText.lastIndexOf("}");
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
          cleanText = cleanText.slice(firstBrace, lastBrace + 1);
        }
        return JSON.parse(cleanText) as JudgeResult;
      } catch (e) {
        return JSON.parse(text) as JudgeResult;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
    }
  }

  throw new Error(`Judge failed: ${lastError}`);
}
