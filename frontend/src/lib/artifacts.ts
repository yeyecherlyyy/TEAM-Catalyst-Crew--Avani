// ── Artifact persistence via Supabase ─────────────────
import { supabase } from "./supabase";
import type { Artifact } from "./gemini";

export async function saveArtifact(
  teamId: string,
  sessionId: string | null,
  artifact: Artifact,
  userId?: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("artifacts")
      .insert({
        team_id: teamId,
        session_id: sessionId,
        artifact_type: mapTypeToEnum(artifact.type),
        title: artifact.title,
        version: 1,
        content: {
          summary: artifact.summary,
          sections: artifact.sections,
          tags: artifact.tags,
          confidence: artifact.confidence,
          original_type: artifact.type,
        },
        created_by: userId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.warn("Failed to save artifact:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn("Artifact save error:", err);
    return null;
  }
}

export async function loadArtifacts(teamId: string): Promise<Artifact[]> {
  try {
    const { data, error } = await supabase
      .from("artifacts")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((row: Record<string, unknown>) => {
      const content = row.content as Record<string, unknown> | null;
      return {
        type: (content?.original_type as string) || mapEnumToType(row.artifact_type as string),
        title: (row.title as string) || "Untitled",
        summary: (content?.summary as string) || "",
        sections: (content?.sections as Artifact["sections"]) || [],
        tags: (content?.tags as string[]) || [],
        confidence: (content?.confidence as number) || undefined,
      } as Artifact;
    });
  } catch {
    return [];
  }
}

export async function deleteArtifact(artifactId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("artifacts").delete().eq("id", artifactId);
    return !error;
  } catch {
    return false;
  }
}

// Map our frontend types to the DB enum
function mapTypeToEnum(type: string): string {
  const map: Record<string, string> = {
    pitch_deck: "brief",
    tech_spec: "code",
    architecture: "flowchart",
    demo_script: "note",
    scorecard: "scorecard",
    roadmap: "roadmap",
    solution_brief: "brief",
    user_stories: "note",
  };
  return map[type] || "note";
}

function mapEnumToType(dbType: string): string {
  const map: Record<string, string> = {
    brief: "solution_brief",
    code: "tech_spec",
    flowchart: "architecture",
    scorecard: "scorecard",
    roadmap: "roadmap",
    note: "demo_script",
  };
  return map[dbType] || "tech_spec";
}
