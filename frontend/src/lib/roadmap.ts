// ── Roadmap & Task CRUD via Supabase ─────────────────
import { supabase } from "./supabase";

// ── Types ────────────────────────────────────────────
export type TaskStatus = "not_started" | "in_progress" | "done" | "cut";

export interface Roadmap {
  id: string;
  team_id: string;
  title: string;
  phases: { name: string; description?: string; hours?: number }[];
  total_predicted_hours: number | null;
  version: number;
  created_at: string;
}

export interface RoadmapTask {
  id: string;
  roadmap_id: string;
  team_id: string;
  phase_index: number;
  title: string;
  description: string | null;
  predicted_hours: number | null;
  status: TaskStatus;
  assigned_to: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProgressCheckin {
  id: string;
  team_id: string;
  roadmap_id: string | null;
  predicted_percent: number | null;
  actual_percent: number;
  notes: string | null;
  checked_in_by: string | null;
  created_at: string;
}

// ── Roadmap CRUD ─────────────────────────────────────
export async function createRoadmap(
  teamId: string,
  title: string,
  phases: Roadmap["phases"],
  totalHours?: number
): Promise<Roadmap | null> {
  const { data, error } = await supabase
    .from("roadmaps")
    .insert({
      team_id: teamId,
      title,
      phases,
      total_predicted_hours: totalHours || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create roadmap:", error);
    return null;
  }
  return data as Roadmap;
}

export async function loadRoadmap(teamId: string): Promise<Roadmap | null> {
  const { data, error } = await supabase
    .from("roadmaps")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as Roadmap;
}

// ── Task CRUD ────────────────────────────────────────
export async function createTask(
  roadmapId: string,
  teamId: string,
  task: { title: string; description?: string; phase_index: number; predicted_hours?: number }
): Promise<RoadmapTask | null> {
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .insert({
      roadmap_id: roadmapId,
      team_id: teamId,
      title: task.title,
      description: task.description || null,
      phase_index: task.phase_index,
      predicted_hours: task.predicted_hours || null,
      status: "not_started",
    })
    .select("*")
    .single();

  if (error) {
    console.error("Failed to create task:", error);
    return null;
  }
  return data as RoadmapTask;
}

export async function loadTasks(teamId: string): Promise<RoadmapTask[]> {
  const { data, error } = await supabase
    .from("roadmap_tasks")
    .select("*")
    .eq("team_id", teamId)
    .order("phase_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];
  return data as RoadmapTask[];
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<boolean> {
  const { error } = await supabase
    .from("roadmap_tasks")
    .update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    })
    .eq("id", taskId);

  if (error) {
    console.error("Failed to update task:", error);
    return false;
  }
  return true;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase.from("roadmap_tasks").delete().eq("id", taskId);
  return !error;
}

// ── Progress Check-ins ───────────────────────────────
export async function checkIn(
  teamId: string,
  roadmapId: string | null,
  actualPercent: number,
  notes?: string,
  userId?: string
): Promise<boolean> {
  const { error } = await supabase.from("progress_checkins").insert({
    team_id: teamId,
    roadmap_id: roadmapId,
    actual_percent: actualPercent,
    notes: notes || null,
    checked_in_by: userId || null,
  });

  if (error) {
    console.error("Failed to check in:", error);
    return false;
  }
  return true;
}

export async function loadCheckins(teamId: string): Promise<ProgressCheckin[]> {
  const { data, error } = await supabase
    .from("progress_checkins")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as ProgressCheckin[];
}

// ── Computed progress from tasks ─────────────────────
export function computeProgress(tasks: RoadmapTask[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 100);
}
