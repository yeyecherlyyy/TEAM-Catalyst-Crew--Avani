import { useState } from "react";
import {
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Send,
  Sparkle,
} from "lucide-react";
import { judgePitch, type JudgeResult } from "../lib/judge";

// ── Difficulty badge colors ──────────────────────────
const DIFF_COLORS: Record<string, string> = {
  easy: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  "easy-medium": "bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30",
  medium: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  "medium-hard": "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  hard: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  hardest: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

// ── Score label prettifier ───────────────────────────
const SCORE_LABELS: Record<string, string> = {
  idea_innovation: "Innovation",
  technical_feasibility: "Feasibility",
  scalability: "Scalability",
  relatability_market_fit: "Market Fit",
  execution_clarity: "Execution",
  presentation_clarity: "Presentation",
};

// ── Radar Chart (Pure CSS/SVG) ───────────────────────
function RadarChart({ scores }: { scores: JudgeResult["scores"] }) {
  const dims = Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[];
  const n = dims.length;
  const cx = 120, cy = 120, maxR = 90;

  // Calculate polygon points for a given set of values
  function polyPoints(values: number[]): string {
    return values
      .map((v, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const r = (v / 10) * maxR;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      })
      .join(" ");
  }

  const scoreValues = dims.map(
    (d) => (scores[d as keyof JudgeResult["scores"]]?.score ?? 0)
  );

  // Grid rings
  const rings = [2, 4, 6, 8, 10];

  return (
    <svg viewBox="0 0 240 240" className="mx-auto h-52 w-52">
      {/* Grid rings */}
      {rings.map((r) => (
        <polygon
          key={r}
          points={polyPoints(Array(n).fill(r))}
          fill="none"
          stroke="currentColor"
          className="text-border"
          strokeWidth="0.5"
        />
      ))}

      {/* Axis lines */}
      {dims.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + maxR * Math.cos(angle)}
            y2={cy + maxR * Math.sin(angle)}
            stroke="currentColor"
            className="text-border"
            strokeWidth="0.5"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polyPoints(scoreValues)}
        fill="rgba(139,92,246,0.2)"
        stroke="rgb(139,92,246)"
        strokeWidth="2"
      />

      {/* Data points + labels */}
      {dims.map((d, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        const score = scoreValues[i];
        const r = (score / 10) * maxR;
        const lx = cx + (maxR + 18) * Math.cos(angle);
        const ly = cy + (maxR + 18) * Math.sin(angle);

        return (
          <g key={d}>
            <circle
              cx={cx + r * Math.cos(angle)}
              cy={cy + r * Math.sin(angle)}
              r="3"
              fill="rgb(139,92,246)"
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted-foreground text-[7px] font-medium"
            >
              {SCORE_LABELS[d]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Score Bar ─────────────────────────────────────────
function ScoreBar({
  label,
  score,
  justification,
}: {
  label: string;
  score: number;
  justification: string;
}) {
  const [open, setOpen] = useState(false);
  const color =
    score >= 7 ? "bg-emerald-500" : score >= 5 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="w-24 shrink-0 text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <div className="h-2 flex-1 rounded-full bg-surface-2">
          <div
            className={`h-full rounded-full transition-all duration-700 ${color}`}
            style={{ width: `${score * 10}%` }}
          />
        </div>
        <span className="w-6 text-right text-xs font-bold text-foreground">{score}</span>
        {open ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
      </button>
      {open && (
        <p className="ml-26 mt-1 rounded-lg bg-surface-2/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {justification}
        </p>
      )}
    </div>
  );
}

// ── Main Judge Panel ─────────────────────────────────
export function JudgePanel() {
  const [ideaText, setIdeaText] = useState("");
  const [judging, setJudging] = useState(false);
  const [result, setResult] = useState<JudgeResult | null>(null);
  const [error, setError] = useState("");

  async function handleJudge(e: React.FormEvent) {
    e.preventDefault();
    if (!ideaText.trim() || judging) return;
    setJudging(true);
    setError("");
    setResult(null);

    try {
      const res = await judgePitch(ideaText.trim());
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Judging failed");
    } finally {
      setJudging(false);
    }
  }

  const totalScore = result
    ? Math.round(
        Object.values(result.scores).reduce((s, d) => s + d.score, 0) /
          Object.values(result.scores).length * 10
      ) / 10
    : 0;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="grid size-9 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
          <Shield className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">AI Judge Simulator</h2>
          <p className="text-[11px] text-muted-foreground">
            Practice your pitch against a skeptical AI judge
          </p>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleJudge} className="border-b border-border px-6 py-4">
        <textarea
          value={ideaText}
          onChange={(e) => setIdeaText(e.target.value)}
          placeholder="Paste your idea description, pitch deck text, or project summary here..."
          rows={5}
          className="w-full resize-none rounded-xl border border-input bg-surface-2 px-3 py-2.5 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={judging || !ideaText.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {judging ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Judging...
            </>
          ) : (
            <>
              <Sparkle className="size-4" />
              Judge My Pitch
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertTriangle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-5 px-6 py-5">
          {/* Radar Chart */}
          <div className="rounded-xl border border-border bg-surface-2/30 p-4">
            <RadarChart scores={result.scores} />
            <p className="mt-2 text-center text-lg font-bold text-foreground">
              {totalScore}
              <span className="text-sm font-normal text-muted-foreground"> / 10 avg</span>
            </p>
          </div>

          {/* Score Bars */}
          <div className="space-y-2.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Dimension Scores
            </h3>
            {Object.entries(result.scores).map(([key, dim]) => (
              <ScoreBar
                key={key}
                label={SCORE_LABELS[key] || key}
                score={dim.score}
                justification={dim.justification}
              />
            ))}
          </div>

          {/* Readiness Summary */}
          <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
              Readiness Summary
            </h3>
            <p className="text-[13px] leading-relaxed text-foreground/90">
              {result.readiness_summary}
            </p>
          </div>

          {/* Progressive Questions */}
          <div className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Practice Questions (by difficulty)
            </h3>
            {result.questions.map((q, i) => (
              <div
                key={i}
                className="flex gap-3 rounded-xl border border-border bg-surface-2/30 px-3 py-2.5"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                    DIFF_COLORS[q.difficulty] || "bg-surface-2 text-muted-foreground border-border"
                  }`}
                >
                  {q.difficulty}
                </span>
                <p className="text-[12px] leading-relaxed text-foreground/85">
                  {q.question}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
