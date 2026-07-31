import { useState, useEffect, useRef } from "react";
import {
  Map,
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  Scissors,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  Flag,
  ArrowRight,
  Sparkles,
  GripVertical,
  BarChart3,
} from "lucide-react";
import {
  loadRoadmap,
  loadTasks,
  createRoadmap,
  createTask,
  updateTaskStatus,
  deleteTask,
  computeProgress,
  type Roadmap,
  type RoadmapTask,
  type TaskStatus,
} from "../lib/roadmap";
import { InteractiveRoadmap } from "./InteractiveRoadmap";

// ── Status config ────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string; bg: string }> = {
  not_started: { label: "To Do", icon: Circle, color: "text-muted-foreground", bg: "bg-muted-foreground/10" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10" },
  done: { label: "Done", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  cut: { label: "Cut", icon: Scissors, color: "text-red-400", bg: "bg-red-400/10" },
};

const STATUS_ORDER: TaskStatus[] = ["not_started", "in_progress", "done", "cut"];

// Phase accent colors for visual distinction
const PHASE_COLORS = [
  { accent: "rgb(99,102,241)", bg: "rgba(99,102,241,0.1)", border: "rgba(99,102,241,0.2)" },
  { accent: "rgb(59,130,246)", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)" },
  { accent: "rgb(16,185,129)", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" },
  { accent: "rgb(234,179,8)", bg: "rgba(234,179,8,0.1)", border: "rgba(234,179,8,0.2)" },
  { accent: "rgb(236,72,153)", bg: "rgba(236,72,153,0.1)", border: "rgba(236,72,153,0.2)" },
  { accent: "rgb(249,115,22)", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.2)" },
];

// ── Interactive Task Card ────────────────────────────
function TaskCard({
  task,
  onStatusChange,
  onDelete,
  phaseColor,
}: {
  task: RoadmapTask;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  phaseColor: string;
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md ${
        task.status === "done"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : task.status === "in_progress"
            ? "border-blue-500/20 bg-blue-500/5"
            : "border-border/50 bg-surface/40"
      }`}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{ backgroundColor: task.status === "done" ? "rgb(16,185,129)" : task.status === "in_progress" ? "rgb(59,130,246)" : phaseColor }}
      />

      <div className="flex items-start gap-3 px-4 py-3">
        {/* Status button */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`mt-0.5 shrink-0 rounded-lg p-1 ${config.bg} ${config.color} transition-all hover:scale-110`}
            title={`Status: ${config.label}`}
          >
            <Icon className="size-4" />
          </button>

          {/* Status dropdown */}
          {showStatusMenu && (
            <div className="absolute left-0 top-full z-10 mt-1 w-36 rounded-xl border border-border bg-surface p-1 shadow-xl">
              {STATUS_ORDER.map((s) => {
                const sc = STATUS_CONFIG[s];
                const SI = sc.icon;
                return (
                  <button
                    key={s}
                    onClick={() => {
                      onStatusChange(task.id, s);
                      setShowStatusMenu(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] transition-colors hover:bg-surface-2 ${
                      task.status === s ? "bg-surface-2 font-semibold" : ""
                    }`}
                  >
                    <SI className={`size-3.5 ${sc.color}`} />
                    <span>{sc.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[12px] font-medium leading-tight ${
              task.status === "done"
                ? "text-muted-foreground line-through"
                : task.status === "cut"
                  ? "text-muted-foreground/50 line-through"
                  : "text-foreground"
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            {task.predicted_hours && (
              <span className="flex items-center gap-1 rounded-md bg-surface-2/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground/70">
                <Clock className="size-2.5" />
                {task.predicted_hours}h
              </span>
            )}
            <span
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${config.bg} ${config.color}`}
            >
              {config.label}
            </span>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 rounded-lg p-1 opacity-0 transition-all group-hover:opacity-100 text-muted-foreground/30 hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Add Task Form ────────────────────────────────────
function AddTaskForm({
  phaseIndex,
  onAdd,
  phaseColor,
}: {
  phaseIndex: number;
  onAdd: (title: string, desc: string, phase: number) => void;
  phaseColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/50 px-4 py-2.5 text-[11px] text-muted-foreground/50 transition-all hover:border-primary/30 hover:bg-surface-2/30 hover:text-muted-foreground"
      >
        <Plus className="size-3.5" />
        Add task
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-3 space-y-2"
      style={{ borderColor: `${phaseColor}40`, backgroundColor: `${phaseColor}08` }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full rounded-lg bg-surface px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-primary/30"
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim()) {
            onAdd(title.trim(), desc.trim(), phaseIndex);
            setTitle("");
            setDesc("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Description (optional)"
        className="w-full rounded-lg bg-surface px-3 py-1.5 text-[10px] outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (title.trim()) {
              onAdd(title.trim(), desc.trim(), phaseIndex);
              setTitle("");
              setDesc("");
              setOpen(false);
            }
          }}
          className="rounded-lg bg-primary px-3 py-1 text-[10px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
        >
          Add Task
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-1 text-[10px] text-muted-foreground hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Phase progress ring ──────────────────────────────
function ProgressRing({ percent, size = 40, stroke = 3, color }: { percent: number; size?: number; stroke?: number; color: string }) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-surface-2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

// ── Create Roadmap Form ──────────────────────────────
function CreateRoadmapForm({ teamId, onCreated }: { teamId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [phasesText, setPhasesText] = useState("Research & Planning\nCore Build\nPolish & Testing\nPresentation Prep");
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-12 px-4">
      <div className="text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-border bg-surface/50" style={{ animation: "pulse-glow 2s ease-in-out infinite" }}>
          <Map className="size-8 text-primary/60" />
        </div>
        <h3 className="text-base font-bold">Create Your Roadmap</h3>
        <p className="mt-1 text-xs text-muted-foreground">Define your hackathon phases, then track every task to the finish line.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Roadmap Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. 24h Sprint Plan"
            className="w-full rounded-xl border border-input bg-surface-2 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring transition-all"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Phases (one per line)</label>
          <textarea
            value={phasesText}
            onChange={(e) => setPhasesText(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-xl border border-input bg-surface-2 px-4 py-2.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-ring font-mono transition-all"
          />
        </div>
        <button
          onClick={async () => {
            if (!title.trim()) return;
            setCreating(true);
            try {
              const phases = phasesText
                .split("\n")
                .filter((l) => l.trim())
                .map((name) => ({ name: name.trim() }));
              const created = await createRoadmap(teamId, title.trim(), phases);
              if (created) {
                onCreated();
              } else {
                console.error("Failed to create roadmap — Supabase insert returned null");
              }
            } catch (err) {
              console.error("Roadmap creation error:", err);
            } finally {
              setCreating(false);
            }
          }}
          disabled={creating || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {creating ? "Creating..." : "Create Roadmap"}
        </button>
      </div>
    </div>
  );
}

// ── Main Roadmap Panel ───────────────────────────────
interface RoadmapPanelProps {
  teamId: string | null;
}

export function RoadmapPanel({ teamId }: RoadmapPanelProps) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [tasks, setTasks] = useState<RoadmapTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"timeline" | "board" | "journey">("journey");

  // Load roadmap + tasks
  useEffect(() => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    async function load() {
      const [rm, ts] = await Promise.all([loadRoadmap(teamId!), loadTasks(teamId!)]);
      setRoadmap(rm);
      setTasks(ts);
      if (rm?.phases) {
        setExpandedPhases(new Set(rm.phases.map((_: unknown, i: number) => i)));
      }
      setLoading(false);
    }
    load();
  }, [teamId]);

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    await updateTaskStatus(taskId, status);
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : null } : t
      )
    );
  }

  async function handleAddTask(title: string, description: string, phaseIndex: number) {
    if (!teamId || !roadmap) return;
    const task = await createTask(roadmap.id, teamId, { title, description, phase_index: phaseIndex });
    if (task) setTasks((prev) => [...prev, task]);
  }

  async function handleDeleteTask(taskId: string) {
    await deleteTask(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function togglePhase(idx: number) {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading roadmap...
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <Map className="size-10 text-muted-foreground/30" />
        <p className="text-xs">Create or join a team to use the roadmap</p>
      </div>
    );
  }

  const progress = computeProgress(tasks);
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <ProgressRing percent={progress} size={48} stroke={3} color="rgb(16,185,129)" />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-emerald-500">
              {progress}%
            </span>
          </div>
          <div>
            <h2 className="text-sm font-bold">{roadmap?.title || "Roadmap"}</h2>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Target className="size-3" />
                {totalTasks} tasks
              </span>
              <span className="flex items-center gap-1 text-emerald-500">
                <CheckCircle2 className="size-3" />
                {doneTasks} done
              </span>
              <span className="flex items-center gap-1 text-blue-500">
                <Clock className="size-3" />
                {inProgressTasks} active
              </span>
            </div>
          </div>
        </div>

        {/* View toggle */}
        {roadmap && (
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/50 p-1">
            <button
              onClick={() => setViewMode("journey")}
              className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-all ${
                viewMode === "journey"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Journey
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-all ${
                viewMode === "timeline"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode("board")}
              className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-all ${
                viewMode === "board"
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Board
            </button>
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────── */}
      <div className={`flex-1 overflow-y-auto artifact-scroll ${viewMode === "journey" ? "" : "px-6 py-5"}`}>
        {!roadmap ? (
          <CreateRoadmapForm
            teamId={teamId!}
            onCreated={async () => {
              if (!teamId) return;
              const rm = await loadRoadmap(teamId);
              if (rm) {
                setRoadmap(rm);
                setExpandedPhases(new Set(rm.phases.map((_: unknown, i: number) => i)));
              }
            }}
          />
        ) : viewMode === "journey" ? (
          <InteractiveRoadmap roadmap={roadmap} tasks={tasks} />
        ) : viewMode === "board" ? (
          /* ── Board View ─────────────────────────── */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_ORDER.map((status) => {
              const sc = STATUS_CONFIG[status];
              const SI = sc.icon;
              const statusTasks = tasks.filter((t) => t.status === status);
              return (
                <div key={status} className="rounded-xl border border-border bg-surface/30 p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <SI className={`size-4 ${sc.color}`} />
                    <span className="text-[11px] font-bold">{sc.label}</span>
                    <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                      {statusTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-lg border border-border/40 bg-surface/50 px-3 py-2 text-[11px]"
                      >
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">{task.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Timeline View ──────────────────────── */
          <div className="relative space-y-0">
            {(roadmap.phases as { name: string; description?: string }[]).map((phase, idx) => {
              const phaseTasks = tasks.filter((t) => t.phase_index === idx);
              const phaseComplete = phaseTasks.length > 0
                ? Math.round((phaseTasks.filter((t) => t.status === "done").length / phaseTasks.length) * 100)
                : 0;
              const expanded = expandedPhases.has(idx);
              const colors = PHASE_COLORS[idx % PHASE_COLORS.length];
              const isLast = idx === (roadmap.phases as unknown[]).length - 1;

              return (
                <div key={idx} className="relative">
                  {/* Timeline connector line */}
                  {!isLast && (
                    <div
                      className="absolute left-[23px] top-[56px] w-[2px]"
                      style={{
                        height: expanded ? "calc(100% - 24px)" : "24px",
                        background: `linear-gradient(180deg, ${colors.accent}, ${colors.accent}40)`,
                        transition: "height 0.3s ease-out",
                      }}
                    />
                  )}

                  {/* Phase node */}
                  <div className="roadmap-node mb-4 rounded-xl border overflow-hidden" style={{ borderColor: colors.border }}>
                    <button
                      onClick={() => togglePhase(idx)}
                      className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors"
                      style={{ background: expanded ? colors.bg : "transparent" }}
                    >
                      {/* Phase circle */}
                      <div
                        className="relative grid size-[46px] shrink-0 place-items-center rounded-xl"
                        style={{ backgroundColor: colors.bg, border: `2px solid ${colors.accent}30` }}
                      >
                        {phaseComplete === 100 ? (
                          <CheckCircle2 className="size-5" style={{ color: colors.accent }} />
                        ) : (
                          <span className="text-sm font-bold" style={{ color: colors.accent }}>
                            {idx + 1}
                          </span>
                        )}
                        {/* Mini progress */}
                        {phaseComplete > 0 && phaseComplete < 100 && (
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-1 w-8 rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${phaseComplete}%`, backgroundColor: colors.accent }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Phase info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest"
                            style={{ backgroundColor: `${colors.accent}15`, color: colors.accent }}
                          >
                            Phase {idx + 1}
                          </span>
                          {phaseComplete === 100 && (
                            <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-500">
                              <CheckCircle2 className="size-3" /> Complete
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 text-[13px] font-semibold">{phase.name}</h3>
                        <p className="text-[10px] text-muted-foreground">
                          {phaseTasks.filter((t) => t.status === "done").length}/{phaseTasks.length} tasks done
                          {phaseComplete > 0 && ` · ${phaseComplete}%`}
                        </p>
                      </div>

                      {/* Expand indicator + progress ring */}
                      <div className="flex items-center gap-3">
                        <ProgressRing percent={phaseComplete} size={32} stroke={2.5} color={colors.accent} />
                        {expanded ? (
                          <ChevronDown className="size-4 text-muted-foreground/50" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground/50" />
                        )}
                      </div>
                    </button>

                    {/* Tasks */}
                    {expanded && (
                      <div
                        className="space-y-2 px-5 pb-4"
                        style={{ animation: "artifact-slide-up 0.3s ease-out" }}
                      >
                        {phaseTasks.length === 0 && (
                          <p className="rounded-lg border border-dashed border-border/40 px-4 py-3 text-center text-[11px] text-muted-foreground/50">
                            No tasks in this phase yet
                          </p>
                        )}
                        {phaseTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDeleteTask}
                            phaseColor={colors.accent}
                          />
                        ))}
                        <AddTaskForm phaseIndex={idx} onAdd={handleAddTask} phaseColor={colors.accent} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Finish line */}
            <div className="flex items-center gap-3 pl-3 pt-2">
              <div className="grid size-[34px] place-items-center rounded-full border-2 border-emerald-500/30 bg-emerald-500/10">
                <Flag className="size-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-emerald-500">Finish Line</p>
                <p className="text-[10px] text-muted-foreground">{progress}% overall progress</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
