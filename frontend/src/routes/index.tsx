import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Menu,
  History,
  Rocket,
  Trophy,
  Settings,
  Sparkle,
  Send,
  Sun,
  Moon,
  Loader2,
  LogOut,
  LogIn,
  UserPlus,
  Package,
} from "lucide-react";
import { AuthModal } from "../components/auth-gate";
import { ArtifactGrid } from "../components/artifact-card";
import { useAuth } from "../lib/auth";
import { callGemini, type Artifact, type GeminiResponse } from "../lib/gemini";
import {
  getOrCreateSession,
  saveMessage,
  loadHistory,
  toGeminiHistory,
} from "../lib/memory";

export const Route = createFileRoute("/")(  {
  head: () => ({
    meta: [
      { title: "GhostPM — Hackathon Artifact Studio" },
      {
        name: "description",
        content:
          "AI-powered hackathon project manager: turn problem statements into pitch-ready artifacts in seconds.",
      },
      { property: "og:title", content: "GhostPM — Hackathon Artifact Studio" },
      {
        property: "og:description",
        content:
          "Turn hackathon problem statements into pitch decks, specs and code scaffolds in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

// ── Sidebar menu items ───────────────────────────────
const menuItems = [
  { label: "Menu", icon: Menu },
  { label: "History", icon: History },
  { label: "Projects", icon: Rocket },
  { label: "Leaderboard", icon: Trophy },
  { label: "Settings", icon: Settings },
];

// ── Chat message type ────────────────────────────────
type ChatMessage = {
  role: "user" | "bot";
  text: string;
  artifacts?: Artifact[];
  loading?: boolean;
};

function Dashboard() {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true); // default dark mode
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Drop a problem statement and I'll generate hackathon-ready artifacts: pitch deck, tech spec, architecture, and more.",
    },
  ]);

  // Dark mode toggle
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize session and load history
  useEffect(() => {
    if (!user) return;

    // For now, use a hardcoded team ID approach
    // In production, this would come from the team selection flow
    async function initSession() {
      try {
        // Try to get team memberships
        const { data: memberships } = await (
          await import("../lib/supabase")
        ).supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user!.id)
          .limit(1);

        const teamId = memberships?.[0]?.team_id;
        if (!teamId) return;

        const sid = await getOrCreateSession(teamId);
        if (!sid) return;
        setSessionId(sid);

        // Load existing history
        const history = await loadHistory(sid);
        if (history.length > 0) {
          const restored: ChatMessage[] = history.map((m) => ({
            role: m.is_ai ? ("bot" as const) : ("user" as const),
            text: m.content,
          }));
          setMessages((prev) => [...prev, ...restored]);
        }
      } catch (err) {
        console.warn("Session init skipped:", err);
      }
    }

    initSession();
  }, [user]);

  // ── Send message ───────────────────────────────────
  const send = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || sending) return;

      setInput("");
      setSending(true);

      // Add user message + loading indicator
      setMessages((m) => [
        ...m,
        { role: "user", text },
        { role: "bot", text: "", loading: true },
      ]);

      // Save user message to memory
      if (sessionId && user) {
        saveMessage(sessionId, text, false, user.id);
      }

      try {
        // Build conversation history from current messages
        const history = messages
          .filter((m) => !m.loading)
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("model" as const),
            text: m.text,
          }));

        const response: GeminiResponse = await callGemini(text, history);

        // Remove loading, add AI response
        setMessages((m) => [
          ...m.slice(0, -1), // remove loading
          {
            role: "bot",
            text: response.message,
            artifacts: response.artifacts,
          },
        ]);

        // Add artifacts to the center pane collection
        if (response.artifacts.length > 0) {
          setAllArtifacts((prev) => [...response.artifacts, ...prev]);
        }

        // Save AI response to memory
        if (sessionId) {
          saveMessage(sessionId, JSON.stringify(response), true);
        }
      } catch (err) {
        console.error("Gemini error:", err);
        setMessages((m) => [
          ...m.slice(0, -1),
          {
            role: "bot",
            text: "Something went wrong. Please try again.",
          },
        ]);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [input, sending, messages, sessionId, user]
  );

  // ── Handle Enter key ──────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(e as unknown as React.FormEvent);
    }
  }

  // ── Render ─────────────────────────────────────────
  return (
    <div className="flex h-screen w-full gap-4 overflow-hidden p-4">
      {/* ── Left sidebar (nav) ──────────────────────── */}
      <aside
        className={`panel flex shrink-0 flex-col overflow-hidden p-3 transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-16 lg:w-60"
        }`}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Toggle menu"
          className="mb-4 flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkle className="size-4" />
          </span>
          {!collapsed && (
            <span className="hidden font-semibold tracking-tight lg:inline">
              GhostPM
            </span>
          )}
        </button>

        <nav className="flex flex-col gap-1">
          {menuItems.map(({ label, icon: Icon }, i) => (
            <button
              key={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                i === 0
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && (
                <span className="hidden lg:inline">{label}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User info or login/signup */}
        {user ? (
          <>
            {!collapsed && (
              <div className="mt-auto space-y-2">
                <div className="rounded-xl bg-surface-2 p-3">
                  <p className="hidden truncate text-xs font-medium lg:block">
                    {user.user_metadata?.full_name || user.email}
                  </p>
                  <p className="hidden truncate text-[11px] text-muted-foreground lg:block">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-auto space-y-2">
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              {!collapsed ? (
                <>
                  <p className="hidden text-xs font-medium lg:block">Browsing as guest</p>
                  <p className="hidden mt-1 text-[11px] text-muted-foreground lg:block">Sign in to save artifacts</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => { setAuthMode("login"); setShowAuth(true); }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium transition-colors hover:bg-surface"
                    >
                      <LogIn className="size-3" />
                      Log in
                    </button>
                    <button
                      onClick={() => { setAuthMode("signup"); setShowAuth(true); }}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <UserPlus className="size-3" />
                      Sign up
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => { setAuthMode("login"); setShowAuth(true); }}
                  className="mx-auto block">
                  <LogIn className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1">
          <button
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle dark mode"
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            {dark ? (
              <Sun className="size-4 shrink-0" />
            ) : (
              <Moon className="size-4 shrink-0" />
            )}
            {!collapsed && (
              <span className="hidden lg:inline">
                {dark ? "Light" : "Dark"}
              </span>
            )}
          </button>

          {user && (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" />
              {!collapsed && (
                <span className="hidden lg:inline">Sign out</span>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* ── Left chat pane ──────────────────────────── */}
      <section className="panel flex w-[380px] shrink-0 flex-col overflow-hidden p-4 max-md:hidden">
        <header className="flex items-center gap-3 border-b border-border pb-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Sparkle className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">GhostPM Chat</p>
            <p className="text-[11px] text-muted-foreground">
              Ask anything → get structured artifacts
            </p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex"}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-foreground"
                }`}
              >
                {m.loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" />
                    <span className="text-muted-foreground">Generating artifacts...</span>
                  </div>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Quick actions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {["Pitch deck", "Tech spec", "Roadmap", "Scorecard"].map((c) => (
            <button
              key={c}
              onClick={() =>
                setInput(`Generate a ${c.toLowerCase()} for: `)
              }
              className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {c}
            </button>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={send} className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Describe the problem statement…"
            disabled={sending}
            className="flex-1 resize-none rounded-xl border border-input bg-surface-2 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={sending}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </form>
      </section>

      {/* ── Center: Artifacts ONLY ──────────────────── */}
      <main className="stage flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 py-6">
        {allArtifacts.length === 0 ? (
          /* Empty state — subtle, no hero text */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="grid size-20 place-items-center rounded-3xl border border-border bg-surface/50">
              <Package className="size-10 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No artifacts yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                Send a problem statement in the chat to generate pitch decks,
                specs, and architecture docs.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Generated Artifacts
                <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-[10px]">
                  {allArtifacts.length}
                </span>
              </h2>
            </div>
            <ArtifactGrid artifacts={allArtifacts} />
          </div>
        )}
      </main>

      {/* Auth modal — only shown when user clicks login/signup */}
      <AuthModal
        open={showAuth}
        onClose={() => setShowAuth(false)}
        defaultMode={authMode}
      />
    </div>
  );
}
