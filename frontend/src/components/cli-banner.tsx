import { useState, useEffect } from "react";
import { Terminal, X, Copy, Check, GitCommit } from "lucide-react";
import { supabase } from "../lib/supabase";

interface CliBannerProps {
  teamId: string | null;
  teamCode: string;
}

export function CliBanner({ teamId, teamCode }: CliBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [cliConnected, setCliConnected] = useState(false);
  const [commitCount, setCommitCount] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) return;

    async function checkCli() {
      const { data, error } = await supabase
        .from("commits")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId);

      if (!error && data) {
        const count = (data as unknown[]).length;
        setCliConnected(count > 0);
        setCommitCount(count);
      }
    }

    checkCli();
  }, [teamId]);

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!teamId || dismissed) return null;

  // If CLI is connected, show a small green indicator instead
  if (cliConnected) {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-medium text-emerald-400">CLI Connected</span>
          <span className="text-[9px] text-muted-foreground/60">
            {commitCount} commit{commitCount !== 1 ? "s" : ""} tracked
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-border bg-surface-2/30 p-3">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 text-muted-foreground/40 hover:text-foreground"
      >
        <X className="size-3" />
      </button>

      <div className="flex items-center gap-2 mb-2">
        <Terminal className="size-3.5 text-violet-400" />
        <span className="text-[10px] font-semibold text-foreground">Install GhostPM CLI</span>
      </div>

      <p className="text-[9px] text-muted-foreground mb-2">
        Track commits, run code audits, and get terminal-based AI advice. Your team data syncs in real time.
      </p>

      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <code className="flex-1 rounded-md bg-surface px-2 py-1 text-[9px] font-mono text-muted-foreground">
            pip install ghost-pm
          </code>
          <button
            onClick={() => copyText("pip install ghost-pm", "pip")}
            className="shrink-0 text-muted-foreground/60 hover:text-foreground"
          >
            {copied === "pip" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <code className="flex-1 rounded-md bg-surface px-2 py-1 text-[9px] font-mono text-muted-foreground">
            ghostpm join {teamCode}
          </code>
          <button
            onClick={() => copyText(`ghostpm join ${teamCode}`, "join")}
            className="shrink-0 text-muted-foreground/60 hover:text-foreground"
          >
            {copied === "join" ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>
    </div>
  );
}
