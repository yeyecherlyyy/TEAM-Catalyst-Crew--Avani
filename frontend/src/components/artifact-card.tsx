import {
  FileCode2,
  Presentation,
  LayoutDashboard,
  Play,
  Award,
  Map,
  BookOpen,
  Users,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from "lucide-react";
import { useState, useCallback } from "react";
import type { Artifact, ArtifactSection, ArtifactType } from "../lib/gemini";

// ── Icon + color mapping per artifact type ───────────
const TYPE_META: Record<
  ArtifactType,
  { icon: typeof FileCode2; label: string; gradient: string; border: string }
> = {
  pitch_deck: {
    icon: Presentation,
    label: "Pitch Deck",
    gradient: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(168,85,247,0.06))",
    border: "rgba(139,92,246,0.3)",
  },
  tech_spec: {
    icon: FileCode2,
    label: "Tech Spec",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(6,182,212,0.06))",
    border: "rgba(59,130,246,0.3)",
  },
  architecture: {
    icon: LayoutDashboard,
    label: "Architecture",
    gradient: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(20,184,166,0.06))",
    border: "rgba(16,185,129,0.3)",
  },
  demo_script: {
    icon: Play,
    label: "Demo Script",
    gradient: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(245,158,11,0.06))",
    border: "rgba(249,115,22,0.3)",
  },
  scorecard: {
    icon: Award,
    label: "Scorecard",
    gradient: "linear-gradient(135deg, rgba(234,179,8,0.12), rgba(132,204,22,0.06))",
    border: "rgba(234,179,8,0.3)",
  },
  roadmap: {
    icon: Map,
    label: "Roadmap",
    gradient: "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(244,63,94,0.06))",
    border: "rgba(236,72,153,0.3)",
  },
  solution_brief: {
    icon: BookOpen,
    label: "Solution Brief",
    gradient: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.06))",
    border: "rgba(99,102,241,0.3)",
  },
  user_stories: {
    icon: Users,
    label: "User Stories",
    gradient: "linear-gradient(135deg, rgba(217,70,239,0.12), rgba(236,72,153,0.06))",
    border: "rgba(217,70,239,0.3)",
  },
};

// ── Section renderer ─────────────────────────────────
function SectionBlock({ section }: { section: ArtifactSection }) {
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    if (section.code) {
      navigator.clipboard.writeText(section.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [section.code]);

  return (
    <div className="space-y-1.5">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {section.heading}
      </h4>

      {section.body && (
        <p className="text-[13px] leading-relaxed text-foreground/85">
          {section.body}
        </p>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="space-y-1 pl-0.5">
          {section.bullets.map((b, i) => (
            <li
              key={i}
              className="flex gap-2 text-[13px] leading-relaxed text-foreground/80"
            >
              <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/50" />
              {b}
            </li>
          ))}
        </ul>
      )}

      {section.code && (
        <div className="group relative">
          <button
            onClick={copyCode}
            className="absolute right-2 top-2 rounded-md bg-surface/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Copy code"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3 text-muted-foreground" />
            )}
          </button>
          <pre className="overflow-x-auto rounded-lg border border-border/50 bg-surface-2/50 p-3 text-[11px] leading-relaxed">
            <code>{section.code}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Main artifact card ───────────────────────────────
export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_META[artifact.type] ?? TYPE_META.tech_spec;
  const Icon = meta.icon;

  return (
    <div
      className="overflow-hidden rounded-xl transition-all duration-200 hover:shadow-md"
      style={{
        background: meta.gradient,
        border: `1px solid ${meta.border}`,
      }}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <div
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.border} 30%, transparent)` }}
        >
          <Icon className="size-4 text-foreground/80" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-surface/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              {meta.label}
            </span>
            {artifact.confidence != null && (
              <span className="text-[9px] font-medium text-muted-foreground/70">
                {artifact.confidence}%
              </span>
            )}
          </div>
          <h3 className="mt-1 text-[13px] font-semibold leading-tight text-foreground">
            {artifact.title}
          </h3>
          {!expanded && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/80 line-clamp-1">
              {artifact.summary}
            </p>
          )}
        </div>

        <div className="shrink-0 pt-1 text-muted-foreground/60">
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </div>
      </button>

      {/* Expandable content */}
      {expanded && (
        <div className="space-y-3 border-t border-border/30 px-4 pb-4 pt-3">
          <p className="text-[12px] italic text-muted-foreground/70">
            {artifact.summary}
          </p>

          {artifact.sections.map((section, i) => (
            <SectionBlock key={i} section={section} />
          ))}

          {artifact.tags && artifact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {artifact.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-surface/40 px-2 py-0.5 text-[9px] font-medium text-muted-foreground/80"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Artifact grid ────────────────────────────────────
export function ArtifactGrid({ artifacts }: { artifacts: Artifact[] }) {
  if (artifacts.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
      {artifacts.map((artifact, i) => (
        <ArtifactCard key={`${artifact.type}-${i}`} artifact={artifact} />
      ))}
    </div>
  );
}
