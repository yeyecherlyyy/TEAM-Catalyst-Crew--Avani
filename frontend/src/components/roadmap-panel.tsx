import { useState, useEffect } from "react";
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

// ── Status config ────────────────────────────────────
const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  not_started: { label: "To Do", icon: Circle, color: "text-muted-foreground" },
  in_progress: { label: "In Progress", icon: Clock, color: "text-blue-500" },
  done: { label: "Done", icon: CheckCircle2, color: "text-emerald-500" },
  cut: { label: "Cut", icon: Scissors, color: "text-red-400" },
};

const STATUS_ORDER: TaskStatus[] = ["not_started", "in_progress", "done", "cut"];

// ── Task Card ────────────────────────────────────────
function TaskCard({
  task,
  onStatusChange,
  onDelete,
}: {
  task: RoadmapTask;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const config = STATUS_CONFIG[task.status];
  const Icon = config.icon;

  return (
    <div className="group relative rounded-lg border border-border bg-surface-2/30 px-3 py-2 transition-colors hover:bg-surface-2/60">
      <div className="flex items-start gap-2">
        <button
          onClick={() => {
            const next = STATUS_ORDER[(STATUS_ORDER.indexOf(task.status) + 1) % STATUS_ORDER.length];
            onStatusChange(task.id, next);
          }}
          className={`mt-0.5 shrink-0 ${config.color} hover:opacity-70`}
          title={`Status: ${config.label} (click to cycle)`}
        >
          <Icon className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[9px] text-muted-foreground/60">
            {task.predicted_hours && <span>{task.predicted_hours}h</span>}
            <span className={config.color}>{config.label}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive transition-opacity"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}

// ── Add Task Form ────────────────────────────────────
function AddTaskForm({
  phaseIndex,
  onAdd,
}: {
  phaseIndex: number;
  onAdd: (title: string, desc: string, phase: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[10px] text-muted-foreground/60 hover:border-primary/30 hover:text-muted-foreground transition-colors"
      >
        <Plus className="size-3" /> Add task
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-surface-2/40 p-2 space-y-1.5">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full rounded-md bg-surface px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/50"
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
        className="w-full rounded-md bg-surface px-2 py-1 text-[10px] outline-none placeholder:text-muted-foreground/50"
      />
      <div className="flex gap-1.5">
        <button
          onClick={() => {
            if (title.trim()) {
              onAdd(title.trim(), desc.trim(), phaseIndex);
              setTitle("");
              setDesc("");
              setOpen(false);
            }
          }}
          className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground"
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-surface"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Create Roadmap Form ──────────────────────────────
function CreateRoadmapForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [phasesText, setPhasesText] = useState("Research & Planning\nCore Build\nPolish & Testing\nPresentation Prep");
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-md space-y-4 pt-8">
      <div className="text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl border border-border bg-surface/50">
          <Map className="size-7 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-semibold">Create a Roadmap</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Define your hackathon phases and track progress</p>
      </div>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Roadmap title (e.g. 24h Sprint Plan)"
          className="w-full rounded-xl border border-input bg-surface-2 px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
        />
        <div>
          <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Phases (one per line)</label>
          <textarea
            value={phasesText}
            onChange={(e) => setPhasesText(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-xl border border-input bg-surface-2 px-3 py-2 text-xs leading-relaxed outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          onClick={async () => {
            if (!title.trim()) return;
            setCreating(true);
            const phases = phasesText
              .split("\n")
              .filter((l) => l.trim())
              .map((name) => ({ name: name.trim() }));
            // teamId is set by the parent — this calls the lib function
            onCreated();
            setCreating(false);
          }}
          disabled={creating || !title.trim()}
          className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
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
      // Expand all phases by default
      if (rm?.phases) {
        setExpandedPhases(new Set(rm.phases.map((_, i) => i)));
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

  async function handleCreateRoadmap(title: string, phases: { name: string }[]) {
    if (!teamId) return;
    const rm = await createRoadmap(teamId, title, phases);
    if (rm) {
      setRoadmap(rm);
      setExpandedPhases(new Set(phases.map((_, i) => i)));
    }
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

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-blue-500/15 text-blue-500">
            <Map className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{roadmap?.title || "Roadmap"}</h2>
            <p className="text-[11px] text-muted-foreground">
              {tasks.length} tasks · {progress}% complete
            </p>
          </div>
        </div>

        {/* Progress bar */}
        {roadmap && (
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-bold text-emerald-500">{progress}%</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!roadmap ? (
          <CreateRoadmapForm
            onCreated={async () => {
              // Reload
              if (!teamId) return;
              const rm = await loadRoadmap(teamId);
              if (rm) {
                setRoadmap(rm);
                setExpandedPhases(new Set(rm.phases.map((_: unknown, i: number) => i)));
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            {(roadmap.phases as { name: string; description?: string }[]).map((phase, idx) => {
              const phaseTasks = tasks.filter((t) => t.phase_index === idx);
              const phaseComplete = phaseTasks.length > 0
                ? Math.round((phaseTasks.filter((t) => t.status === "done").length / phaseTasks.length) * 100)
                : 0;
              const expanded = expandedPhases.has(idx);

              return (
                <div key={idx} className="rounded-xl border border-border">
                  <button
                    onClick={() => togglePhase(idx)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    {expanded ? (
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-400">
                      Phase {idx + 1}
                    </span>
                    <span className="flex-1 text-xs font-medium">{phase.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {phaseTasks.filter((t) => t.status === "done").length}/{phaseTasks.length}
                    </span>
                    <div className="h-1.5 w-12 rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${phaseComplete}%` }}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="space-y-1.5 px-4 pb-3">
                      {phaseTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDeleteTask}
                        />
                      ))}
                      <AddTaskForm phaseIndex={idx} onAdd={handleAddTask} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
