import { useState } from "react";
import { X, Users, Rocket, Clock, Sparkle } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";

type HackathonFormat =
  | "ideathon"
  | "prototype_build"
  | "ppt_presentation"
  | "build_pitch_hybrid"
  | "research_innovation"
  | "mixed";

type DurationBracket = "lt_8hrs" | "24hrs" | "36_48hrs" | "multi_week";

const FORMAT_OPTIONS: { value: HackathonFormat; label: string; desc: string }[] = [
  { value: "ideathon", label: "Ideathon", desc: "Idea presentation only" },
  { value: "prototype_build", label: "Prototype Build", desc: "Working demo required" },
  { value: "ppt_presentation", label: "PPT Presentation", desc: "Slide deck judging" },
  { value: "build_pitch_hybrid", label: "Build + Pitch", desc: "Demo + presentation" },
  { value: "research_innovation", label: "Research / Innovation", desc: "Research paper style" },
  { value: "mixed", label: "Mixed", desc: "Multiple formats" },
];

const DURATION_OPTIONS: { value: DurationBracket; label: string }[] = [
  { value: "lt_8hrs", label: "< 8 hours" },
  { value: "24hrs", label: "24 hours" },
  { value: "36_48hrs", label: "36-48 hours" },
  { value: "multi_week", label: "Multi-week" },
];

function generateTeamCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

interface CreateTeamModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (teamId: string, teamCode: string) => void;
}

export function CreateTeamModal({ open, onClose, onCreated }: CreateTeamModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<HackathonFormat>("build_pitch_hybrid");
  const [duration, setDuration] = useState<DurationBracket>("24hrs");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setSubmitting(true);
    setError("");

    const teamCode = generateTeamCode();

    try {
      // Create team
      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .insert({
          name: name.trim(),
          team_code: teamCode,
          owner_id: user.id,
          hackathon_format: format,
          duration_bracket: duration,
          onboarding_complete: true,
        })
        .select("id")
        .single();

      if (teamErr) throw new Error(teamErr.message);

      // Add owner as team member
      const { error: memberErr } = await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: user.id,
        role: "owner",
      });

      if (memberErr) throw new Error(memberErr.message);

      onCreated(team.id, teamCode);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Rocket className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Create Your Team</h2>
            <p className="text-[11px] text-muted-foreground">
              Set up your hackathon workspace
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Team Name
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-input bg-surface-2 px-3 py-2">
              <Users className="size-4 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Team Catalyst"
                required
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </div>

          {/* Hackathon Format */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              Hackathon Format
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={`rounded-lg border px-2.5 py-2 text-left transition-all ${
                    format === opt.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-surface-2/50 text-muted-foreground hover:bg-surface-2"
                  }`}
                >
                  <p className="text-[11px] font-medium">{opt.label}</p>
                  <p className="text-[9px] text-muted-foreground/70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
              <Clock className="mr-1 inline size-3" />
              Duration
            </label>
            <div className="flex gap-1.5">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuration(opt.value)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-all ${
                    duration === opt.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-surface-2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Sparkle className="size-4" />
            {submitting ? "Creating..." : "Create Team & Start"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Join Team Modal ──────────────────────────────────
interface JoinTeamModalProps {
  open: boolean;
  onClose: () => void;
  onJoined: (teamId: string) => void;
}

export function JoinTeamModal({ open, onClose, onJoined }: JoinTeamModalProps) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !code.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      // Use the secure RPC to join the team by code
      const { data: teamId, error: joinErr } = await supabase
        .rpc("join_team_by_code", { p_team_code: code.trim().toUpperCase() });

      if (joinErr) throw new Error(joinErr.message);
      if (!teamId) throw new Error("Team not found. Check the code and try again.");

      onJoined(teamId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join team");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Users className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Join a Team</h2>
            <p className="text-[11px] text-muted-foreground">
              Enter the 6-character team code
            </p>
          </div>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="E.g. A3B7K2"
            maxLength={6}
            required
            className="w-full rounded-xl border border-input bg-surface-2 px-4 py-3 text-center text-lg font-mono font-bold tracking-[0.3em] outline-none placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-ring"
          />

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length < 4}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Joining..." : "Join Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
