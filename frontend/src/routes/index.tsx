import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  Menu,
  Send,
  Sun,
  Moon,
  Loader2,
  LogOut,
  LogIn,
  UserPlus,
  Package,
  Shield,
  Network,
  Users,
  Plus,
  Copy,
  Check,
  Map,
  BarChart3,
} from "lucide-react";
import { AuthModal } from "../components/auth-gate";
import { ArtifactViewer, ArtifactListItem } from "../components/artifact-viewer";
import { CreateTeamModal, JoinTeamModal } from "../components/team-modals";
import { JudgePanel } from "../components/judge-panel";
import { CodeGraphPanel } from "../components/code-graph";
import { RoadmapPanel } from "../components/roadmap-panel";
import { CliBanner } from "../components/cli-banner";
import { useAuth } from "../lib/auth";
import { callGemini, type Artifact, type GeminiResponse } from "../lib/gemini";
import { saveArtifact, loadArtifacts, saveArtifactsLocal, loadArtifactsLocal } from "../lib/artifacts";
import {
  getOrCreateSession,
  saveMessage,
  loadHistory,
  loadFromLocal,
  saveToLocal,
} from "../lib/memory";
import { useRealtimeMessages } from "../lib/realtime";
import { supabase } from "../lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GhostPM — Hackathon Command Center" },
      {
        name: "description",
        content:
          "AI-powered hackathon project manager: turn problem statements into pitch-ready artifacts, practice with an AI judge, and visualize your codebase.",
      },
    ],
  }),
  component: Dashboard,
});

// ── View modes ───────────────────────────────────────
type ViewMode = "artifacts" | "judge" | "graph" | "roadmap";

const sidebarItems: { label: string; icon: typeof Menu; view: ViewMode }[] = [
  { label: "Artifacts", icon: Package, view: "artifacts" },
  { label: "Roadmap", icon: Map, view: "roadmap" },
  { label: "AI Judge", icon: Shield, view: "judge" },
  { label: "Code Graph", icon: Network, view: "graph" },
];

// ── Chat message type ────────────────────────────────
type ChatMessage = {
  role: "user" | "bot";
  text: string;
  artifacts?: Artifact[];
  loading?: boolean;
  fromRealtime?: boolean;
};

function Dashboard() {
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [allArtifacts, setAllArtifacts] = useState<Artifact[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [activeView, setActiveView] = useState<ViewMode>("artifacts");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Team state
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [selectedArtifactIndex, setSelectedArtifactIndex] = useState<number | null>(null);

  const WELCOME: ChatMessage = {
    role: "bot",
    text: "Drop a problem statement and I'll generate hackathon-ready artifacts. Use the sidebar to access the Roadmap, AI Judge, and Code Graph.",
  };

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Realtime: listen for messages from CLI/other team members ──
  useRealtimeMessages(sessionId, (msg) => {
    // Only add if it's not from the current user (avoid duplicates)
    if (msg.user_id === user?.id) return;
    setMessages((prev) => [
      ...prev,
      {
        role: msg.is_ai ? "bot" : "user",
        text: msg.content,
        fromRealtime: true,
      },
    ]);
  });

  // ── Load team, session, history on login ───────────
  useEffect(() => {
    if (!user) {
      setTeamId(null);
      setTeamName("");
      setTeamCode("");
      // Load from localStorage for guests
      const localMessages = loadFromLocal();
      if (localMessages.length > 0) {
        setMessages([WELCOME, ...localMessages.map((m) => ({ role: m.role, text: m.text }))]);
      }
      const localArtifacts = loadArtifactsLocal();
      if (localArtifacts.length > 0) setAllArtifacts(localArtifacts);
      return;
    }

    async function fetchTeam() {
      try {
        const { data: memberships } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user!.id)
          .limit(1);

        const tid = memberships?.[0]?.team_id;
        if (!tid) return;

        setTeamId(tid);

        // Team details
        const { data: team } = await supabase
          .from("teams")
          .select("name, team_code")
          .eq("id", tid)
          .single();

        if (team) {
          setTeamName(team.name);
          setTeamCode(team.team_code);
        }

        // Init session
        const sid = await getOrCreateSession(tid);
        if (sid) setSessionId(sid);

        // Load persisted artifacts from DB
        const saved = await loadArtifacts(tid);
        if (saved.length > 0) setAllArtifacts(saved);

        // Load chat history from DB — REPLACE default, don't append
        if (sid) {
          const history = await loadHistory(sid);
          if (history.length > 0) {
            const restored: ChatMessage[] = history.map((m) => ({
              role: m.is_ai ? ("bot" as const) : ("user" as const),
              text: m.content,
            }));
            setMessages([WELCOME, ...restored]);
          }
        }
      } catch (err) {
        console.warn("Team init skipped:", err);
      }
    }

    fetchTeam();
  }, [user]);

  // ── Send message ───────────────────────────────────
  const send = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || sending) return;

      setInput("");
      setSending(true);
      setActiveView("artifacts");

      const userMsg: ChatMessage = { role: "user", text };
      const loadingMsg: ChatMessage = { role: "bot", text: "", loading: true };
      setMessages((m) => [...m, userMsg, loadingMsg]);

      // Save user message to DB (with correct columns)
      if (sessionId && teamId) {
        saveMessage(sessionId, teamId, text, false, user?.id);
      }

      try {
        const history = messages
          .filter((m) => !m.loading)
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("model" as const),
            text: m.text,
          }));

        const response: GeminiResponse = await callGemini(text, history);

        const botMsg: ChatMessage = {
          role: "bot",
          text: response.message,
          artifacts: response.artifacts,
        };

        setMessages((m) => [...m.slice(0, -1), botMsg]);

        if (response.artifacts.length > 0) {
          setAllArtifacts((prev) => [...response.artifacts, ...prev]);
          // Auto-select the first new artifact
          setSelectedArtifactIndex(0);

          // Persist artifacts to DB
          if (teamId) {
            for (const art of response.artifacts) {
              saveArtifact(teamId, sessionId, art);
            }
          }
          // Always save to localStorage too
          saveArtifactsLocal([...response.artifacts, ...allArtifacts]);
        }

        // Save bot response to DB
        if (sessionId && teamId) {
          saveMessage(sessionId, teamId, response.message, true);
        }

        // Always save to localStorage as fallback
        const allMsgs = messages.filter((m) => !m.loading).concat([userMsg, botMsg]);
        saveToLocal(
          allMsgs
            .filter((m) => m.role !== undefined)
            .map((m) => ({ role: m.role, text: m.text }))
        );
      } catch (err) {
        console.error("Gemini error:", err);
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "bot", text: "Something went wrong. Please try again." },
        ]);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [input, sending, messages, sessionId, user, teamId, allArtifacts]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(e as unknown as React.FormEvent);
    }
  }

  function copyTeamCode() {
    navigator.clipboard.writeText(teamCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  // ── RENDER ─────────────────────────────────────────
  return (
    <div className="flex h-screen w-full gap-4 overflow-hidden p-4">
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside
        className={`panel flex shrink-0 flex-col overflow-hidden p-3 transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-16 lg:w-60"
        }`}
      >
        {/* Logo */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mb-4 flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-black text-primary-foreground">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          </span>
          {!collapsed && (
            <span className="hidden font-semibold tracking-tight lg:inline">GhostPM</span>
          )}
        </button>

        {/* Nav */}
        <nav className="flex flex-col gap-1">
          {sidebarItems.map(({ label, icon: Icon, view }) => (
            <button
              key={label}
              onClick={() => setActiveView(view)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                view === activeView
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="hidden lg:inline">{label}</span>}
            </button>
          ))}
        </nav>

        {/* Team info */}
        {user && teamId && !collapsed && (
          <div className="mt-4 space-y-2">
            <div className="rounded-xl border border-border bg-surface-2/50 p-2.5">
              <p className="hidden truncate text-[11px] font-semibold lg:block">
                {teamName || "Your Team"}
              </p>
              <div className="hidden items-center gap-1.5 lg:flex mt-1">
                <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest text-muted-foreground">
                  {teamCode}
                </span>
                <button onClick={copyTeamCode} className="text-muted-foreground/60 hover:text-foreground" title="Copy team code">
                  {codeCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                </button>
              </div>
            </div>
            {/* CLI Banner */}
            <div className="hidden lg:block">
              <CliBanner teamId={teamId} teamCode={teamCode} />
            </div>
          </div>
        )}

        {/* No team prompt */}
        {user && !teamId && !collapsed && (
          <div className="mt-4 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-2.5">
            <p className="hidden text-[11px] font-medium lg:block">No team yet</p>
            <div className="mt-2 flex gap-1.5">
              <button
                onClick={() => setShowCreateTeam(true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-semibold text-primary-foreground hover:opacity-90"
              >
                <Plus className="size-3" /> Create
              </button>
              <button
                onClick={() => setShowJoinTeam(true)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[10px] font-medium hover:bg-surface-2"
              >
                <Users className="size-3" /> Join
              </button>
            </div>
          </div>
        )}

        {/* Guest auth */}
        {!user && (
          <div className="mt-auto">
            <div className="rounded-xl border border-border bg-surface-2 p-3">
              {!collapsed ? (
                <>
                  <p className="hidden text-xs font-medium lg:block">Browsing as guest</p>
                  <p className="hidden mt-1 text-[11px] text-muted-foreground lg:block">Sign in to save & sync</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setAuthMode("login"); setShowAuth(true); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] font-medium hover:bg-surface">
                      <LogIn className="size-3" /> Log in
                    </button>
                    <button onClick={() => { setAuthMode("signup"); setShowAuth(true); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90">
                      <UserPlus className="size-3" /> Sign up
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={() => { setAuthMode("login"); setShowAuth(true); }} className="mx-auto block">
                  <LogIn className="size-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* User info + actions */}
        {user && (
          <div className="mt-auto space-y-2">
            {!collapsed && (
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="hidden truncate text-xs font-medium lg:block">
                  {user.user_metadata?.full_name || user.email}
                </p>
                <p className="hidden truncate text-[11px] text-muted-foreground lg:block">{user.email}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-1">
          <button onClick={() => setDark((d) => !d)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            {dark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
            {!collapsed && <span className="hidden lg:inline">{dark ? "Light" : "Dark"}</span>}
          </button>
          {user && (
            <button onClick={() => signOut()} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              <LogOut className="size-4 shrink-0" />
              {!collapsed && <span className="hidden lg:inline">Sign out</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ── Chat pane ────────────────────────────────── */}
      <section className="panel flex w-[380px] shrink-0 flex-col overflow-hidden p-4 max-md:hidden">
        <header className="flex items-center gap-3 border-b border-border pb-3">
          <span className="grid size-9 place-items-center rounded-xl bg-black text-primary-foreground">
            <img src="/logo.png" alt="Logo" className="w-5 h-5 rounded-md object-contain" />
          </span>
          <div>
            <p className="text-sm font-semibold">GhostPM Chat</p>
            <p className="text-[11px] text-muted-foreground">
              {sessionId ? "Session active · syncing to DB" : "Local mode · sign in to sync"}
            </p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
              <div className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-foreground"
              }`}>
                {m.loading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-3 animate-spin" />
                    <span className="text-muted-foreground">Generating artifacts...</span>
                  </div>
                ) : (
                  <>
                    {m.text}
                    {m.fromRealtime && (
                      <span className="ml-1 text-[9px] text-muted-foreground/50">(from teammate)</span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Quick actions */}
        <div className="mb-3 flex flex-wrap gap-2">
          {["Pitch deck", "Tech spec", "Roadmap", "Scorecard"].map((c) => (
            <button key={c} onClick={() => setInput(`Generate a ${c.toLowerCase()} for: `)} className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              {c}
            </button>
          ))}
        </div>

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
          <button type="submit" disabled={sending} className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </form>
      </section>

      {/* ── Center pane ──────────────────────────────── */}
      <main className="stage flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeView === "artifacts" && (
          <div className="flex h-full">
            {allArtifacts.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <div className="grid size-20 place-items-center rounded-3xl border border-border bg-surface/50">
                  <Package className="size-10 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No artifacts yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground/70">
                  Send a problem statement in the chat to generate pitch decks, specs, and architecture docs.
                </p>
              </div>
            ) : selectedArtifactIndex !== null && allArtifacts[selectedArtifactIndex] ? (
              /* ── Full artifact viewer ── */
              <div className="flex-1 overflow-hidden">
                <ArtifactViewer
                  artifact={allArtifacts[selectedArtifactIndex]}
                  onBack={() => setSelectedArtifactIndex(null)}
                  version={1}
                />
              </div>
            ) : (
              /* ── Artifact list (grid + list hybrid) ── */
              <div className="flex-1 overflow-y-auto overflow-x-hidden artifact-scroll px-6 py-6">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground">
                    Generated Artifacts
                    <span className="ml-2 rounded-md bg-surface-2 px-2 py-0.5 text-[10px]">{allArtifacts.length}</span>
                  </h2>
                </div>
                {/* Grid view for quick overview */}
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {allArtifacts.map((artifact, i) => (
                    <ArtifactListItem
                      key={`${artifact.type}-${i}`}
                      artifact={artifact}
                      isActive={false}
                      onClick={() => setSelectedArtifactIndex(i)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === "judge" && <JudgePanel />}
        {activeView === "graph" && <CodeGraphPanel teamId={teamId} />}
        {activeView === "roadmap" && <RoadmapPanel teamId={teamId} />}
      </main>

      {/* ── Modals ────────────────────────────────── */}
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} defaultMode={authMode} />

      <CreateTeamModal
        open={showCreateTeam}
        onClose={() => setShowCreateTeam(false)}
        onCreated={(tid, code) => {
          setTeamId(tid);
          setTeamCode(code);
          supabase.from("teams").select("name").eq("id", tid).single().then(({ data }) => {
            if (data) setTeamName(data.name);
          });
        }}
      />

      <JoinTeamModal
        open={showJoinTeam}
        onClose={() => setShowJoinTeam(false)}
        onJoined={(tid) => {
          setTeamId(tid);
          supabase.from("teams").select("name, team_code").eq("id", tid).single().then(({ data }) => {
            if (data) { setTeamName(data.name); setTeamCode(data.team_code); }
          });
        }}
      />
    </div>
  );
}
