import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Menu,
  History,
  Rocket,
  Trophy,
  Settings,
  Sparkle,
  Send,
  FileCode2,
  LogIn,
  UserPlus,
  Sun,
  Moon,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GhostPM — Hackathon Artifact Studio" },
      {
        name: "description",
        content:
          "A dark, playful hackathon dashboard: browse your build history and turn any problem statement into ready-to-ship artifacts.",
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

const menuItems = [
  { label: "Menu", icon: Menu },
  { label: "History", icon: History },
  { label: "Projects", icon: Rocket },
  { label: "Leaderboard", icon: Trophy },
  { label: "Settings", icon: Settings },
];

const historyItems = [
  "Smart campus energy tracker",
  "AI triage for rural clinics",
  "Zero-waste food routing",
];

type ChatMessage = { role: "user" | "bot"; text: string };

function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      text: "Drop a problem statement and I'll spin up artifacts: pitch, spec, architecture and a starter repo.",
    },
  ]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      { role: "user", text },
      {
        role: "bot",
        text: `Cooking artifacts for "${text}" — problem framing, solution spec and a demo script. (Connect the AI backend to make this live.)`,
      },
    ]);
    setInput("");
  }

  return (
    <div className="flex min-h-screen w-full gap-4 p-4">
      {/* Left rail */}
      <aside
        className={`panel flex shrink-0 flex-col p-3 transition-all duration-300 ${
          collapsed ? "w-[68px]" : "w-60"
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
          {!collapsed && <span className="font-semibold tracking-tight">GhostPM</span>}
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
              {!collapsed && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {!collapsed && (
          <div className="mt-6">
            <p className="px-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Recent
            </p>
            <ul className="mt-2 space-y-1">
              {historyItems.map((h) => (
                <li key={h}>
                  <button className="w-full truncate rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => setDark((d) => !d)}
          aria-label="Toggle dark mode"
          className="mt-auto mb-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          {dark ? <Sun className="size-4 shrink-0" /> : <Moon className="size-4 shrink-0" />}
          {!collapsed && <span>{dark ? "Light mode" : "Dark mode"}</span>}
        </button>

        <div className="rounded-xl border border-border bg-surface-2 p-3">

          {collapsed ? (
            <Trophy className="mx-auto size-4 text-lime" />
          ) : (
            <>
              <p className="text-xs font-medium">Hack Season 26</p>
              <p className="mt-1 text-[11px] text-muted-foreground">3 artifacts left today</p>
            </>
          )}
        </div>
      </aside>

      {/* Center */}
      <main className="stage flex min-w-0 flex-1 flex-col items-center justify-center gap-8 px-6 py-10 text-center">
        <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          🏆 Build fast. Ship louder.
        </span>
        <div>
          <h1 className="text-gradient-hero text-6xl font-black tracking-tight sm:text-8xl">
            Hello
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
            Paste a problem statement on the right and GhostPM turns it into pitch-ready artifacts.
          </p>
        </div>

        {/* Sign in / Log in — middle-right of the dashboard */}
        <div className="flex w-full justify-end">
          <div className="panel glow-ring flex items-center gap-3 p-3">
            <div className="hidden pl-2 pr-1 text-left sm:block">
              <p className="text-xs font-medium">You're browsing as a guest</p>
              <p className="text-[11px] text-muted-foreground">Save artifacts to your team</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2">
              <LogIn className="size-4" />
              Log in
            </button>
            <button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              <UserPlus className="size-4" />
              Sign in
            </button>
          </div>
        </div>
      </main>

      {/* Right chatbot */}
      <section className="panel flex w-[360px] shrink-0 flex-col p-4 max-lg:hidden">
        <header className="flex items-center gap-3 border-b border-border pb-3">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground">
            <FileCode2 className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Artifact Bot</p>
            <p className="text-[11px] text-muted-foreground">Problem statement → artifacts</p>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex"}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {["Pitch deck", "Tech spec", "Demo script"].map((c) => (
            <button
              key={c}
              onClick={() => setInput(`Generate a ${c.toLowerCase()} for: `)}
              className="rounded-full border border-border px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {c}
            </button>
          ))}
        </div>

        <form onSubmit={send} className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Describe the problem statement…"
            className="flex-1 resize-none rounded-xl border border-input bg-surface-2 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            aria-label="Send"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Send className="size-4" />
          </button>
        </form>
      </section>
    </div>
  );
}
