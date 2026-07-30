// ── Gemini API with round-robin key pool ─────────────
// Keys rotate on every call to distribute rate limits.

const GEMINI_KEYS = [
  import.meta.env.VITE_GEMINI_KEY_1,
  import.meta.env.VITE_GEMINI_KEY_2,
  import.meta.env.VITE_GEMINI_KEY_3,
  import.meta.env.VITE_GEMINI_KEY_4,
].filter(Boolean) as string[];

if (GEMINI_KEYS.length === 0) {
  console.warn("No VITE_GEMINI_KEY_* env vars found — AI features disabled.");
}

let keyIndex = 0;

function nextKey(): string {
  const key = GEMINI_KEYS[keyIndex % GEMINI_KEYS.length];
  keyIndex++;
  return key;
}

// ── Artifact types ───────────────────────────────────
export type ArtifactType =
  | "pitch_deck"
  | "tech_spec"
  | "architecture"
  | "demo_script"
  | "scorecard"
  | "roadmap"
  | "solution_brief"
  | "user_stories";

export interface ArtifactSection {
  heading: string;
  bullets?: string[];
  body?: string;
  code?: string;
  language?: string;
}

export interface Artifact {
  type: ArtifactType;
  title: string;
  summary: string;
  sections: ArtifactSection[];
  tags?: string[];
  confidence?: number; // 0-100
}

export interface GeminiResponse {
  message: string;
  artifacts: Artifact[];
}

// ── System prompt ────────────────────────────────────
const SYSTEM_PROMPT = `You are GhostPM, a hackathon project manager AI. When the user gives you a problem statement or asks about their hackathon project, you MUST respond in STRICT JSON only.

Your response format MUST be:
{
  "message": "A brief conversational reply (1-2 sentences max)",
  "artifacts": [
    {
      "type": "pitch_deck" | "tech_spec" | "architecture" | "demo_script" | "scorecard" | "roadmap" | "solution_brief" | "user_stories",
      "title": "Artifact title",
      "summary": "One-line summary",
      "sections": [
        {
          "heading": "Section heading",
          "bullets": ["point 1", "point 2"],
          "body": "Optional paragraph text",
          "code": "Optional code block",
          "language": "Optional language for code"
        }
      ],
      "tags": ["tag1", "tag2"],
      "confidence": 85
    }
  ]
}

Rules:
- ALWAYS respond with valid JSON. No markdown, no plain text.
- Generate 1-3 artifacts per response depending on the query.
- For problem statements: generate pitch_deck + tech_spec + architecture.
- For implementation questions: generate tech_spec or roadmap.
- For review requests: generate scorecard.
- Keep each artifact actionable and hackathon-ready.
- confidence is 0-100 reflecting how well the artifact matches the query.`;

// ── Chat history format for context ──────────────────
interface ChatEntry {
  role: "user" | "model";
  text: string;
}

// ── Main API call ────────────────────────────────────
export async function callGemini(
  userMessage: string,
  conversationHistory: ChatEntry[] = []
): Promise<GeminiResponse> {
  if (GEMINI_KEYS.length === 0) {
    return {
      message: "AI is not configured. Add VITE_GEMINI_KEY_* to .env.",
      artifacts: [],
    };
  }

  const apiKey = nextKey();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  // Build contents array with history
  const contents = [
    // System instruction as first user turn
    { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
    {
      role: "model",
      parts: [
        {
          text: JSON.stringify({
            message:
              "Understood. I will respond in strict JSON with artifacts.",
            artifacts: [],
          }),
        },
      ],
    },
    // Conversation history
    ...conversationHistory.map((entry) => ({
      role: entry.role === "user" ? "user" : "model",
      parts: [{ text: entry.text }],
    })),
    // Current message
    { role: "user", parts: [{ text: userMessage }] },
  ];

  // Try all keys before giving up
  let lastError = "";
  for (let attempt = 0; attempt < GEMINI_KEYS.length; attempt++) {
    const key = attempt === 0 ? apiKey : nextKey();
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
              maxOutputTokens: 8192,
            },
          }),
        }
      );

      if (res.status === 429) {
        // Rate limited — parse retry delay
        try {
          const errData = await res.json();
          const retryDetail = errData?.error?.details?.find(
            (d: { "@type": string }) =>
              d["@type"]?.includes("RetryInfo")
          );
          const retryDelay = retryDetail?.retryDelay ?? "30s";
          const isDailyQuota = errData?.error?.message?.includes("PerDay");
          lastError = isDailyQuota
            ? `Daily API quota exhausted on key ${attempt + 1}. Quota resets at midnight PT.`
            : `Rate limited on key ${attempt + 1}. Retry in ${retryDelay}.`;
          console.warn(`Gemini key ${attempt + 1}: ${lastError}`);
        } catch {
          lastError = `Rate limited on key ${attempt + 1}.`;
        }
        // Wait briefly before trying next key
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        lastError = `API error ${res.status}: ${errText.slice(0, 200)}`;
        console.warn(`Gemini key ${attempt + 1}: ${lastError}`);
        continue;
      }

      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      // Parse JSON response
      const parsed: GeminiResponse = JSON.parse(text);
      return parsed;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.warn(`Gemini attempt ${attempt + 1} error:`, err);
    }
  }

  // All attempts failed — show specific error
  return {
    message: `⚠️ ${lastError || "AI service temporarily unavailable."}`,
    artifacts: [],
  };
}
