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
  ChevronUp,
  Tag,
} from "lucide-react";
import { useState } from "react";
import type { Artifact, ArtifactSection, ArtifactType } from "../lib/gemini";

// ── Icon + color mapping per artifact type ───────────
const TYPE_META: Record<
  ArtifactType,
  { icon: typeof FileCode2; label: string; accent: string }
> = {
  pitch_deck: {
    icon: Presentation,
    label: "Pitch Deck",
    accent: "from-violet-500/20 to-purple-500/20 border-violet-500/30",
  },
  tech_spec: {
    icon: FileCode2,
    label: "Technical Spec",
    accent: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
  },
  architecture: {
    icon: LayoutDashboard,
    label: "Architecture",
    accent: "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
  },
  demo_script: {
    icon: Play,
    label: "Demo Script",
    accent: "from-orange-500/20 to-amber-500/20 border-orange-500/30",
  },
  scorecard: {
    icon: Award,
    label: "Scorecard",
    accent: "from-yellow-500/20 to-lime-500/20 border-yellow-500/30",
  },
  roadmap: {
    icon: Map,
    label: "Roadmap",
    accent: "from-pink-500/20 to-rose-500/20 border-pink-500/30",
  },
  solution_brief: {
    icon: BookOpen,
    label: "Solution Brief",
    accent: "from-indigo-500/20 to-blue-500/20 border-indigo-500/30",
  },
  user_stories: {
    icon: Users,
    label: "User Stories",
    accent: "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-500/30",
  },
};

// ── Section renderer ─────────────────────────────────
function SectionBlock({ section }: { section: ArtifactSection }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {section.heading}
      </h4>

      {section.body && (
        <p className="text-sm leading-relaxed text-foreground/90">
          {section.body}
        </p>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="space-y-1.5 pl-1">
          {section.bullets.map((b, i) => (
            <li
              key={i}
              className="flex gap-2 text-sm leading-relaxed text-foreground/85"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
              {b}
            </li>
          ))}
        </ul>
      )}

      {section.code && (
        <pre className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed">
          <code>{section.code}</code>
        </pre>
      )}
    </div>
  );
}

// ── Confidence bar ───────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-yellow-500"
        : "bg-orange-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}

// ── Main artifact card ───────────────────────────────
export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [expanded, setExpanded] = useState(true);
  const meta = TYPE_META[artifact.type] ?? TYPE_META.tech_spec;
  const Icon = meta.icon;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-gradient-to-br ${meta.accent} backdrop-blur-sm transition-all duration-300 hover:shadow-lg`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface/80 backdrop-blur-sm">
          <Icon className="size-5 text-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-surface/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {meta.label}
            </span>
            {artifact.confidence != null && (
              <span className="text-[10px] text-muted-foreground">
                {artifact.confidence}% match
              </span>
            )}
          </div>
          <h3 className="mt-1 text-sm font-semibold leading-tight text-foreground">
            {artifact.title}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {artifact.summary}
          </p>
        </div>

        <div className="shrink-0 pt-1 text-muted-foreground">
          {expanded ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="space-y-4 border-t border-border/50 px-4 pb-4 pt-3">
          {artifact.sections.map((section, i) => (
            <SectionBlock key={i} section={section} />
          ))}

          {artifact.tags && artifact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {artifact.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-surface/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {artifact.confidence != null && (
            <div className="pt-1">
              <ConfidenceBar value={artifact.confidence} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Artifact grid (renders multiple artifacts) ───────
export function ArtifactGrid({ artifacts }: { artifacts: Artifact[] }) {
  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
      {artifacts.map((artifact, i) => (
        <ArtifactCard key={`${artifact.type}-${i}`} artifact={artifact} />
      ))}
    </div>
  );
}
