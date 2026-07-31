import { useState, useCallback, useEffect, useRef } from "react";
import {
  Copy,
  Check,
  Download,
  Share2,
  ChevronLeft,
  FileCode2,
  Presentation,
  LayoutDashboard,
  Play,
  Award,
  Map,
  BookOpen,
  Users,
  Clock,
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  MonitorPlay,
} from "lucide-react";
import { MotionGuide } from "./motion-guide/MotionGuide";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import type { Artifact, ArtifactSection, ArtifactType } from "../lib/gemini";

// Register languages
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);

// ── Type metadata ────────────────────────────────────
const TYPE_META: Record<
  ArtifactType,
  {
    icon: typeof FileCode2;
    label: string;
    accentColor: string;
    gradient: string;
  }
> = {
  pitch_deck: {
    icon: Presentation,
    label: "PITCH DECK",
    accentColor: "rgb(139,92,246)",
    gradient: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(168,85,247,0.05))",
  },
  tech_spec: {
    icon: FileCode2,
    label: "TECH SPEC",
    accentColor: "rgb(59,130,246)",
    gradient: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.05))",
  },
  architecture: {
    icon: LayoutDashboard,
    label: "ARCHITECTURE",
    accentColor: "rgb(16,185,129)",
    gradient: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(20,184,166,0.05))",
  },
  demo_script: {
    icon: Play,
    label: "DEMO SCRIPT",
    accentColor: "rgb(249,115,22)",
    gradient: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(245,158,11,0.05))",
  },
  scorecard: {
    icon: Award,
    label: "SCORECARD",
    accentColor: "rgb(234,179,8)",
    gradient: "linear-gradient(135deg, rgba(234,179,8,0.15), rgba(132,204,22,0.05))",
  },
  roadmap: {
    icon: Map,
    label: "ROADMAP",
    accentColor: "rgb(236,72,153)",
    gradient: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(244,63,94,0.05))",
  },
  solution_brief: {
    icon: BookOpen,
    label: "SOLUTION BRIEF",
    accentColor: "rgb(99,102,241)",
    gradient: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(59,130,246,0.05))",
  },
  user_stories: {
    icon: Users,
    label: "USER STORIES",
    accentColor: "rgb(217,70,239)",
    gradient: "linear-gradient(135deg, rgba(217,70,239,0.15), rgba(236,72,153,0.05))",
  },
  motion_guide: {
    icon: MonitorPlay,
    label: "MOTION GUIDE",
    accentColor: "rgb(45,212,191)", // Teal/Cyan
    gradient: "linear-gradient(135deg, rgba(45,212,191,0.15), rgba(6,182,212,0.05))",
  }
};

// ── Code highlighter ─────────────────────────────────
function highlightCode(code: string): string {
  try {
    const result = hljs.highlightAuto(code);
    return result.value;
  } catch {
    return code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

// ── Section renderer ─────────────────────────────────
function ArtifactSectionBlock({
  section,
  index,
}: {
  section: ArtifactSection;
  index: number;
}) {
  const [copied, setCopied] = useState(false);

  const copyContent = useCallback(() => {
    const text = [
      section.heading,
      section.body,
      section.bullets?.join("\n"),
      section.code,
    ]
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [section]);

  return (
    <div
      className="artifact-section group relative rounded-xl border border-border/40 bg-surface/30 p-5 transition-all hover:border-border/60 hover:bg-surface/50"
      style={{ animationDelay: `${index * 0.07 + 0.05}s` }}
    >
      {/* Copy button */}
      <button
        onClick={copyContent}
        className="absolute right-3 top-3 rounded-lg border border-border/40 bg-surface-2/80 p-1.5 opacity-0 transition-all group-hover:opacity-100 hover:bg-surface-2"
        title="Copy section"
      >
        {copied ? (
          <Check className="size-3 text-emerald-500" />
        ) : (
          <Copy className="size-3 text-muted-foreground" />
        )}
      </button>

      {/* Section heading */}
      <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-foreground/90">
        {section.heading}
      </h3>

      {/* Body text */}
      {section.body && (
        <p className="mb-3 text-[13px] leading-[1.8] text-foreground/80">
          {section.body}
        </p>
      )}

      {/* Bullet list */}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="mb-3 space-y-2 pl-1">
          {section.bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-[13px] leading-[1.7] text-foreground/80"
            >
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Code block */}
      {section.code && (
        <div className="artifact-code mt-3">
          <pre>
            <code
              dangerouslySetInnerHTML={{
                __html: highlightCode(section.code),
              }}
            />
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Confidence bar ───────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? "bg-emerald-500"
      : value >= 75
        ? "bg-primary"
        : value >= 60
          ? "bg-yellow-500"
          : "bg-red-400";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
        <div
          className={`h-full rounded-full ${color}`}
          style={{
            width: `${value}%`,
            animation: "progress-fill 0.8s ease-out",
          }}
        />
      </div>
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
        {value}%
      </span>
    </div>
  );
}

// ── Main Artifact Viewer ─────────────────────────────
export function ArtifactViewer({
  artifact,
  onBack,
  onVersionChange,
  version = 1,
}: {
  artifact: Artifact;
  onBack: () => void;
  onVersionChange?: (v: number) => void;
  version?: number;
}) {
  const meta = TYPE_META[artifact.type] ?? TYPE_META.tech_spec;
  const Icon = meta.icon;
  const [fullscreen, setFullscreen] = useState(false);
  const [allCopied, setAllCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const copyAll = useCallback(() => {
    const text = artifact.sections
      .map((s) =>
        [
          `## ${s.heading}`,
          s.body,
          s.bullets?.map((b) => `• ${b}`).join("\n"),
          s.code ? `\`\`\`\n${s.code}\n\`\`\`` : null,
        ]
          .filter(Boolean)
          .join("\n\n")
      )
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(`# ${artifact.title}\n\n${artifact.summary}\n\n${text}`);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }, [artifact]);

  const exportHTML = useCallback(() => {
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>${artifact.title}</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.7}
h1{border-bottom:2px solid #e5e7eb;padding-bottom:0.5rem}
h2{color:#4b5563;margin-top:2rem;font-size:1.1rem;text-transform:uppercase;letter-spacing:0.05em}
pre{background:#f3f4f6;padding:1rem;border-radius:8px;overflow-x:auto;font-size:0.85rem}
ul{padding-left:1.5rem}li{margin-bottom:0.5rem}
.badge{display:inline-block;background:#818cf8;color:white;padding:2px 10px;border-radius:12px;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em}
.confidence{color:#6b7280;font-size:0.85rem}
</style></head><body>
<span class="badge">${meta.label}</span>
<h1>${artifact.title}</h1>
<p class="confidence">Confidence: ${artifact.confidence ?? "N/A"}%</p>
<p><em>${artifact.summary}</em></p>
${artifact.sections
  .map(
    (s) => `
<h2>${s.heading}</h2>
${s.body ? `<p>${s.body}</p>` : ""}
${s.bullets ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>` : ""}
${s.code ? `<pre><code>${s.code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>` : ""}
`
  )
  .join("")}
${artifact.tags ? `<p style="margin-top:2rem;color:#9ca3af;font-size:0.8rem">Tags: ${artifact.tags.join(", ")}</p>` : ""}
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, "_").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [artifact, meta.label]);

  return (
    <div
      className={`flex flex-col overflow-hidden ${fullscreen ? "fixed inset-0 z-50 bg-background" : "h-full"}`}
    >
      {/* ── Shell Header ────────────────────────── */}
      <header
        className="flex items-center gap-3 border-b border-border px-5 py-3"
        style={{ background: meta.gradient }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          className="grid size-8 shrink-0 place-items-center rounded-lg border border-border/50 bg-surface/60 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>

        {/* Type icon */}
        <div
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${meta.accentColor} 20%, transparent)` }}
        >
          <Icon className="size-4" style={{ color: meta.accentColor }} />
        </div>

        {/* Type + title */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-widest"
              style={{
                backgroundColor: `color-mix(in srgb, ${meta.accentColor} 15%, transparent)`,
                color: meta.accentColor,
              }}
            >
              {meta.label}
            </span>
            {artifact.confidence != null && (
              <ConfidenceBar value={artifact.confidence} />
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Clock className="size-3" />
              v{version}
            </span>
          </div>
          <h2 className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {artifact.title}
          </h2>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={copyAll}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/60 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            title="Copy all content"
          >
            {allCopied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
            {allCopied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={exportHTML}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface/60 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            title="Download as HTML"
          >
            <Download className="size-3" />
            Export
          </button>
          <button
            onClick={() => setFullscreen((f) => !f)}
            className="grid size-7 place-items-center rounded-lg border border-border/50 bg-surface/60 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? (
              <Minimize2 className="size-3" />
            ) : (
              <Maximize2 className="size-3" />
            )}
          </button>
          {fullscreen && (
            <button
              onClick={() => { setFullscreen(false); onBack(); }}
              className="grid size-7 place-items-center rounded-lg border border-border/50 bg-surface/60 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </header>

      {/* ── Document Body ───────────────────────── */}
      <div
        ref={scrollRef}
        className="artifact-scroll flex-1 overflow-y-auto px-6 py-5"
      >
        {/* Summary */}
        <div className="artifact-section mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary/70" />
            <p className="text-[13px] italic leading-relaxed text-foreground/70">
              {artifact.summary}
            </p>
          </div>
        </div>

        {/* Conditional Renderer for Motion Guide */}
        {artifact.type === "motion_guide" ? (
          <div className="h-[600px] mb-8">
            <MotionGuide />
          </div>
        ) : (
          <div className="space-y-4">
            {artifact.sections.map((section, i) => (
              <ArtifactSectionBlock key={i} section={section} index={i} />
            ))}
          </div>
        )}

        {/* Tags */}
        {artifact.tags && artifact.tags.length > 0 && (
          <div className="artifact-section mt-6 flex flex-wrap gap-1.5">
            {artifact.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border/40 bg-surface-2/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground/80"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>
    </div>
  );
}

// ── Compact Artifact List Item ───────────────────────
export function ArtifactListItem({
  artifact,
  isActive,
  onClick,
}: {
  artifact: Artifact;
  isActive: boolean;
  onClick: () => void;
}) {
  const meta = TYPE_META[artifact.type] ?? TYPE_META.tech_spec;
  const Icon = meta.icon;

  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
        isActive
          ? "border border-primary/30 bg-primary/8 shadow-sm"
          : "border border-transparent hover:border-border/40 hover:bg-surface-2/50"
      }`}
    >
      <div
        className="grid size-9 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105"
        style={{
          backgroundColor: `color-mix(in srgb, ${meta.accentColor} 15%, transparent)`,
        }}
      >
        <Icon className="size-4" style={{ color: meta.accentColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="rounded px-1 py-0.5 text-[8px] font-bold tracking-widest"
            style={{
              backgroundColor: `color-mix(in srgb, ${meta.accentColor} 12%, transparent)`,
              color: meta.accentColor,
            }}
          >
            {meta.label}
          </span>
          {artifact.confidence != null && (
            <span className="text-[9px] font-medium text-muted-foreground/60">
              {artifact.confidence}%
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] font-medium text-foreground/90">
          {artifact.title}
        </p>
        <p className="truncate text-[10px] text-muted-foreground/60">
          {artifact.summary}
        </p>
      </div>
      <ChevronLeft className="size-3 shrink-0 rotate-180 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
    </button>
  );
}
