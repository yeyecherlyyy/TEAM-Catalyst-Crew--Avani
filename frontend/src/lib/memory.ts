// ── Shared memory: conversation history via Supabase ──
import { supabase } from "./supabase";

// Matches the actual brainstorm_messages table schema
export interface StoredMessage {
  id: string;
  session_id: string;
  team_id: string;
  user_id: string | null;
  content: string;
  is_ai: boolean;
  created_at: string;
}

const STORAGE_KEY = "ghostpm_chat_history";
const SESSION_KEY = "ghostpm_session_id";

// ── localStorage fallback ────────────────────────────
export function saveToLocal(messages: { role: "user" | "bot"; text: string }[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {}
}

export function loadFromLocal(): { role: "user" | "bot"; text: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearLocal() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SESSION_KEY);
}

// ── Session management ───────────────────────────────
export async function getOrCreateSession(
  teamId: string
): Promise<string | null> {
  // Check localStorage for a cached session ID first
  const cached = localStorage.getItem(SESSION_KEY);
  if (cached) {
    // Verify it still exists
    const { data } = await supabase
      .from("brainstorm_sessions")
      .select("id")
      .eq("id", cached)
      .eq("team_id", teamId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  // Try to find existing web chat session
  const { data: existing } = await supabase
    .from("brainstorm_sessions")
    .select("id")
    .eq("team_id", teamId)
    .eq("anchor_text", "__web_chat__")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    localStorage.setItem(SESSION_KEY, existing.id);
    return existing.id;
  }

  // Create a new session
  const { data: created, error } = await supabase
    .from("brainstorm_sessions")
    .insert({
      team_id: teamId,
      anchor_text: "__web_chat__",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create chat session:", error);
    return null;
  }

  const sid = created?.id ?? null;
  if (sid) localStorage.setItem(SESSION_KEY, sid);
  return sid;
}

// ── Save a message ───────────────────────────────────
// Uses the ACTUAL brainstorm_messages columns: team_id, user_id, session_id, content, is_ai
export async function saveMessage(
  sessionId: string,
  teamId: string,
  content: string,
  isAi: boolean,
  userId?: string
): Promise<void> {
  const { error } = await supabase.from("brainstorm_messages").insert({
    session_id: sessionId,
    team_id: teamId,
    user_id: isAi ? null : (userId || null),
    content,
    is_ai: isAi,
  });

  if (error) {
    console.error("Failed to save message:", error);
  }
}

// ── Load conversation history ────────────────────────
export async function loadHistory(
  sessionId: string,
  limit = 50
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("brainstorm_messages")
    .select("id, session_id, team_id, user_id, content, is_ai, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to load history:", error);
    return [];
  }

  return (data ?? []) as StoredMessage[];
}

// ── Convert to Gemini format ─────────────────────────
export function toGeminiHistory(
  messages: StoredMessage[]
): { role: "user" | "model"; text: string }[] {
  return messages.map((m) => ({
    role: m.is_ai ? ("model" as const) : ("user" as const),
    text: m.content,
  }));
}
