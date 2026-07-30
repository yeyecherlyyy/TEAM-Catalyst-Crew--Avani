// ── Shared memory: conversation history via Supabase ──
import { supabase } from "./supabase";

export interface StoredMessage {
  id: string;
  session_id: string;
  sender_id: string | null;
  content: string;
  is_ai: boolean;
  classification: string | null;
  created_at: string;
}

// Get or create a CLI-style chat session for the team
export async function getOrCreateSession(
  teamId: string
): Promise<string | null> {
  // Try to find existing chat session
  const { data: existing } = await supabase
    .from("brainstorm_sessions")
    .select("id")
    .eq("team_id", teamId)
    .eq("topic", "ghostpm-web-chat")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existing?.id) return existing.id;

  // Create a new session
  const { data: created, error } = await supabase
    .from("brainstorm_sessions")
    .insert({
      team_id: teamId,
      topic: "ghostpm-web-chat",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create chat session:", error);
    return null;
  }

  return created?.id ?? null;
}

// Save a message to the shared memory
export async function saveMessage(
  sessionId: string,
  content: string,
  isAi: boolean,
  senderId?: string
): Promise<void> {
  const { error } = await supabase.from("brainstorm_messages").insert({
    session_id: sessionId,
    sender_id: isAi ? null : senderId,
    content,
    is_ai: isAi,
    classification: isAi ? "artifact" : null,
  });

  if (error) {
    console.error("Failed to save message:", error);
  }
}

// Load conversation history for a session
export async function loadHistory(
  sessionId: string,
  limit = 50
): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("brainstorm_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to load history:", error);
    return [];
  }

  return (data ?? []) as StoredMessage[];
}

// Convert stored messages to Gemini conversation format
export function toGeminiHistory(
  messages: StoredMessage[]
): { role: "user" | "model"; text: string }[] {
  return messages.map((m) => ({
    role: m.is_ai ? ("model" as const) : ("user" as const),
    text: m.content,
  }));
}
