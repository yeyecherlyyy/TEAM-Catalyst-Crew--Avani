// ── Gemini API with round-robin key pool ─────────────
// Keys rotate on every call to distribute rate limits.

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
  | "user_stories"
  | "motion_guide";

export interface ArtifactSection {
  heading: string;
  body?: string;
  bullets?: string[];
  code?: string;
}

export interface Artifact {
  type: ArtifactType;
  title: string;
  summary: string;
  sections: ArtifactSection[];
  tags?: string[];
  confidence?: number;
}

export interface GeminiResponse {
  message: string;
  artifacts: Artifact[];
}

// ── System Prompt ────────────────────────────────────
const SYSTEM_PROMPT = `You are GhostPM — a senior hackathon product manager and strategist.

RESPONSE FORMAT — you MUST return ONLY a single valid JSON object:
{
  "message": "<your conversational reply — be helpful, concise, max 3 sentences>",
  "artifacts": [ ...array of artifact objects, or empty [] ]
}

ARTIFACT GENERATION RULES:
1. Generate artifacts ONLY when the user provides a problem statement, project idea, or explicitly asks for a deliverable (e.g., "make me a pitch deck", "give me a roadmap").
2. For casual conversation, follow-up questions, greetings, or clarifications — set "artifacts" to []. Just respond with a helpful "message".
3. Generate AT MOST 2 artifacts per response. Pick the 2 most relevant.
4. Each artifact must be genuinely useful and hackathon-ready. No filler content.
5. Keep each artifact FOCUSED — maximum 4 sections per artifact. Each section should have EITHER "body" text OR "bullets" (not both unless truly needed). Use "code" only for actual code snippets.
6. Sections should contain real, actionable content — not generic advice.

ARTIFACT OBJECT SHAPE:
{
  "type": "pitch_deck" | "tech_spec" | "architecture" | "demo_script" | "scorecard" | "roadmap" | "solution_brief" | "user_stories" | "motion_guide",
  "title": "Short descriptive title",
  "summary": "One-line summary of what this artifact covers",
  "confidence": 75-99,
  "tags": ["2-4 relevant tags"],
  "sections": [
    {
      "heading": "Section Title",
      "body": "Paragraph of content (use for explanations)",
      "bullets": ["Use for lists of points"],
      "code": "Use ONLY for actual code"
    }
  ]
}

TYPE SELECTION GUIDE:
- Problem statement → "solution_brief" (what to build) + "architecture" (how to build it)
- "Pitch deck" request → "pitch_deck"
- Technical question → "tech_spec"
- Planning question → "roadmap"
- Review/feedback → "scorecard"
- User flow question → "user_stories"

CRITICAL: Return ONLY the JSON object. No markdown fences, no explanation outside the JSON.`;

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

  // Build contents array with history — merge consecutive same-role turns
  const rawContents = [
    // Conversation history
    ...conversationHistory.map((entry) => ({
      role: entry.role === "user" ? "user" : "model",
      parts: [{ text: entry.text }],
    })),
    // Current message
    { role: "user", parts: [{ text: userMessage }] },
  ];

  // Merge consecutive same-role messages (API rejects them)
  const contents: typeof rawContents = [];
  for (const msg of rawContents) {
    const last = contents[contents.length - 1];
    if (last && last.role === msg.role) {
      last.parts.push(...msg.parts);
    } else {
      contents.push({ ...msg, parts: [...msg.parts] });
    }
  }

  // Try all keys before giving up
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
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.6,
              maxOutputTokens: 4096,
            },
          }),
        }
      );

      if (res.status === 429) {
        try {
          const errData = await res.json();
          const retryDetail = errData?.error?.details?.find(
            (d: { "@type": string }) => d["@type"]?.includes("RetryInfo")
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
      // Extract text from the first part that actually has a 'text' field (skip thinking parts)
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const textPart = parts.find((p: Record<string, unknown>) => typeof p.text === "string");
      const text = textPart?.text ?? "";

      // Parse JSON response
      try {
        let cleanText = text.trim();
        const firstBrace = cleanText.indexOf("{");
        const lastBrace = cleanText.lastIndexOf("}");
        
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
          cleanText = cleanText.slice(firstBrace, lastBrace + 1);
        }
        
        const parsed: GeminiResponse = JSON.parse(cleanText);
        // Validate structure
        if (!parsed.message && !parsed.artifacts) {
          return { message: text, artifacts: [] };
        }
        return {
          message: parsed.message || "",
          artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
        };
      } catch {
        // If JSON parsing fails, treat as plain text
        return { message: text || "Response received but could not parse.", artifacts: [] };
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.warn(`Gemini attempt ${attempt + 1} error:`, err);
    }
  }

  // All attempts failed
  return {
    message: `⚠️ ${lastError || "AI service temporarily unavailable."}`,
    artifacts: [],
  };
}
