// ── Code Graph parser + visualization ────────────────
// Ported from cli/ghost_pm/graph_parser.py

import { useState, useEffect, useRef } from "react";
import { Network, AlertTriangle, FileCode, Box, Maximize2, Minimize2, View } from "lucide-react";
import { Graph3D } from "./Graph3D";
import { supabase } from "../lib/supabase";

// ── Types ────────────────────────────────────────────
export interface GraphNode {
  id: string;
  label: string;
  type: "file" | "function" | "class" | "module" | "other";
  language: string;
  community: number;
  connections: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

export interface GraphSummary {
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: { id: number; name: string; files: string[]; size: number }[];
  godNodes: GraphNode[];
  stats: { totalNodes: number; totalEdges: number; totalFiles: number; languages: string[] };
}

// ── Community colors ─────────────────────────────────
const COMMUNITY_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

// ── Parser ───────────────────────────────────────────
export function parseGraphJson(raw: unknown): GraphSummary {
  const data = raw as Record<string, unknown>;
  const nodesRaw = (data.nodes || []) as Record<string, unknown>[];
  const edgesRaw = (data.edges || data.links || []) as Record<string, unknown>[];

  const nodes: GraphNode[] = nodesRaw.map((n, i) => ({
    id: String(n.id || n.name || i),
    label: String(n.label || n.name || n.id || `node-${i}`),
    type: (n.type as GraphNode["type"]) || "other",
    language: String(n.language || ""),
    community: Number(n.community || n.group || 0),
    connections: Number(n.degree || n.connections || 0),
  }));

  const edges: GraphEdge[] = edgesRaw.map((e) => ({
    source: String(e.source || e.from || ""),
    target: String(e.target || e.to || ""),
    type: String(e.type || e.relationship || "depends_on"),
  }));

  // Count connections
  const connMap = new Map<string, number>();
  edges.forEach((e) => {
    connMap.set(e.source, (connMap.get(e.source) || 0) + 1);
    connMap.set(e.target, (connMap.get(e.target) || 0) + 1);
  });
  nodes.forEach((n) => {
    n.connections = connMap.get(n.id) || n.connections;
  });

  // Extract communities
  const commMap = new Map<number, string[]>();
  nodes.forEach((n) => {
    const arr = commMap.get(n.community) || [];
    arr.push(n.label);
    commMap.set(n.community, arr);
  });
  const communities = Array.from(commMap.entries()).map(([id, files]) => ({
    id,
    name: `Cluster ${id}`,
    files,
    size: files.length,
  }));

  // God nodes (top 5 most connected)
  const godNodes = [...nodes].sort((a, b) => b.connections - a.connections).slice(0, 5);

  // Languages
  const langSet = new Set(nodes.map((n) => n.language).filter(Boolean));

  return {
    nodes,
    edges,
    communities,
    godNodes,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalFiles: nodes.filter((n) => n.type === "file").length,
      languages: Array.from(langSet),
    },
  };
}

// ── Demo graph reflecting the actual project structure ──
function buildDemoGraph(): GraphSummary {
  const demoNodes: GraphNode[] = [
    // CLI core (community 0)
    { id: "cli.py", label: "cli/ghost_pm/cli.py", type: "file", language: "python", community: 0, connections: 8 },
    { id: "repl.py", label: "cli/ghost_pm/repl.py", type: "file", language: "python", community: 0, connections: 7 },
    { id: "config.py", label: "cli/ghost_pm/config.py", type: "file", language: "python", community: 0, connections: 6 },
    { id: "state.py", label: "cli/ghost_pm/state.py", type: "file", language: "python", community: 0, connections: 5 },
    { id: "daemon.py", label: "cli/ghost_pm/daemon.py", type: "file", language: "python", community: 0, connections: 4 },
    // AI & Sync (community 1)
    { id: "ai_advisor.py", label: "cli/ghost_pm/ai_advisor.py", type: "file", language: "python", community: 1, connections: 4 },
    { id: "sync_client.py", label: "cli/ghost_pm/sync/client.py", type: "file", language: "python", community: 1, connections: 6 },
    { id: "auditor.py", label: "cli/ghost_pm/auditor.py", type: "file", language: "python", community: 1, connections: 3 },
    { id: "graph_parser.py", label: "cli/ghost_pm/graph_parser.py", type: "file", language: "python", community: 1, connections: 3 },
    // Hooks (community 2)
    { id: "pre_commit.py", label: "hooks/pre_commit.py", type: "file", language: "python", community: 2, connections: 3 },
    { id: "post_commit.py", label: "hooks/post_commit.py", type: "file", language: "python", community: 2, connections: 3 },
    { id: "installer.py", label: "hooks/installer.py", type: "file", language: "python", community: 2, connections: 2 },
    // Frontend routes (community 3)
    { id: "index.tsx", label: "routes/index.tsx", type: "file", language: "typescript", community: 3, connections: 9 },
    { id: "root.tsx", label: "routes/__root.tsx", type: "file", language: "typescript", community: 3, connections: 3 },
    // Frontend components (community 4)
    { id: "code-graph.tsx", label: "components/code-graph.tsx", type: "file", language: "typescript", community: 4, connections: 4 },
    { id: "roadmap-panel.tsx", label: "components/roadmap-panel.tsx", type: "file", language: "typescript", community: 4, connections: 5 },
    { id: "judge-panel.tsx", label: "components/judge-panel.tsx", type: "file", language: "typescript", community: 4, connections: 3 },
    { id: "artifact-viewer.tsx", label: "components/artifact-viewer.tsx", type: "file", language: "typescript", community: 4, connections: 5 },
    { id: "auth-gate.tsx", label: "components/auth-gate.tsx", type: "file", language: "typescript", community: 4, connections: 3 },
    { id: "Graph3D.tsx", label: "components/Graph3D.tsx", type: "file", language: "typescript", community: 4, connections: 2 },
    // Frontend libs (community 5)
    { id: "gemini.ts", label: "lib/gemini.ts", type: "file", language: "typescript", community: 5, connections: 4 },
    { id: "roadmap.ts", label: "lib/roadmap.ts", type: "file", language: "typescript", community: 5, connections: 3 },
    { id: "judge.ts", label: "lib/judge.ts", type: "file", language: "typescript", community: 5, connections: 2 },
    { id: "auth.ts", label: "lib/auth.ts", type: "file", language: "typescript", community: 5, connections: 3 },
    { id: "realtime.ts", label: "lib/realtime.ts", type: "file", language: "typescript", community: 5, connections: 2 },
    { id: "supabase.ts", label: "lib/supabase.ts", type: "file", language: "typescript", community: 5, connections: 5 },
  ];

  const demoEdges: GraphEdge[] = [
    // CLI internal
    { source: "cli.py", target: "repl.py", type: "imports" },
    { source: "cli.py", target: "config.py", type: "imports" },
    { source: "cli.py", target: "state.py", type: "imports" },
    { source: "cli.py", target: "sync_client.py", type: "imports" },
    { source: "cli.py", target: "ai_advisor.py", type: "imports" },
    { source: "cli.py", target: "daemon.py", type: "imports" },
    { source: "cli.py", target: "auditor.py", type: "imports" },
    { source: "cli.py", target: "graph_parser.py", type: "imports" },
    { source: "repl.py", target: "config.py", type: "imports" },
    { source: "repl.py", target: "state.py", type: "imports" },
    { source: "repl.py", target: "sync_client.py", type: "imports" },
    { source: "repl.py", target: "ai_advisor.py", type: "imports" },
    { source: "repl.py", target: "auditor.py", type: "imports" },
    { source: "repl.py", target: "graph_parser.py", type: "imports" },
    { source: "daemon.py", target: "config.py", type: "imports" },
    { source: "daemon.py", target: "state.py", type: "imports" },
    { source: "daemon.py", target: "ai_advisor.py", type: "imports" },
    { source: "sync_client.py", target: "config.py", type: "imports" },
    { source: "sync_client.py", target: "state.py", type: "imports" },
    { source: "ai_advisor.py", target: "config.py", type: "imports" },
    { source: "ai_advisor.py", target: "state.py", type: "imports" },
    { source: "auditor.py", target: "config.py", type: "imports" },
    { source: "auditor.py", target: "state.py", type: "imports" },
    { source: "graph_parser.py", target: "state.py", type: "imports" },
    // Hooks
    { source: "pre_commit.py", target: "config.py", type: "imports" },
    { source: "pre_commit.py", target: "state.py", type: "imports" },
    { source: "post_commit.py", target: "config.py", type: "imports" },
    { source: "post_commit.py", target: "sync_client.py", type: "imports" },
    { source: "installer.py", target: "pre_commit.py", type: "imports" },
    { source: "installer.py", target: "post_commit.py", type: "imports" },
    // Frontend routes → components
    { source: "index.tsx", target: "code-graph.tsx", type: "imports" },
    { source: "index.tsx", target: "roadmap-panel.tsx", type: "imports" },
    { source: "index.tsx", target: "judge-panel.tsx", type: "imports" },
    { source: "index.tsx", target: "artifact-viewer.tsx", type: "imports" },
    { source: "index.tsx", target: "auth-gate.tsx", type: "imports" },
    { source: "index.tsx", target: "gemini.ts", type: "imports" },
    { source: "index.tsx", target: "auth.ts", type: "imports" },
    { source: "index.tsx", target: "realtime.ts", type: "imports" },
    { source: "index.tsx", target: "supabase.ts", type: "imports" },
    // Components → libs
    { source: "code-graph.tsx", target: "supabase.ts", type: "imports" },
    { source: "code-graph.tsx", target: "Graph3D.tsx", type: "imports" },
    { source: "roadmap-panel.tsx", target: "roadmap.ts", type: "imports" },
    { source: "roadmap-panel.tsx", target: "supabase.ts", type: "imports" },
    { source: "judge-panel.tsx", target: "judge.ts", type: "imports" },
    { source: "artifact-viewer.tsx", target: "gemini.ts", type: "imports" },
    { source: "auth-gate.tsx", target: "auth.ts", type: "imports" },
    { source: "auth-gate.tsx", target: "supabase.ts", type: "imports" },
    { source: "roadmap.ts", target: "supabase.ts", type: "imports" },
    { source: "judge.ts", target: "supabase.ts", type: "imports" },
    { source: "auth.ts", target: "supabase.ts", type: "imports" },
    { source: "realtime.ts", target: "supabase.ts", type: "imports" },
  ];

  return parseGraphJson({ nodes: demoNodes, edges: demoEdges });
}

// ── Force-directed layout (simple spring model) ──────
function useForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    new Map()
  );

  useEffect(() => {
    if (nodes.length === 0) return;

    // Initialize random positions
    const pos = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => {
      pos.set(n.id, {
        x: width / 2 + (Math.random() - 0.5) * width * 0.8,
        y: height / 2 + (Math.random() - 0.5) * height * 0.8,
      });
    });

    // Simple force simulation (30 iterations)
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (let iter = 0; iter < 40; iter++) {
      const cooling = 1 - iter / 50;

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id)!;
          const b = pos.get(nodes[j].id)!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (80 * cooling) / dist;
          a.x -= (dx / dist) * force;
          a.y -= (dy / dist) * force;
          b.x += (dx / dist) * force;
          b.y += (dy / dist) * force;
        }
      }

      // Attraction along edges
      edges.forEach((e) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = (dist - 60) * 0.02 * cooling;
        a.x += (dx / dist) * force;
        a.y += (dy / dist) * force;
        b.x -= (dx / dist) * force;
        b.y -= (dy / dist) * force;
      });

      // Center gravity
      nodes.forEach((n) => {
        const p = pos.get(n.id)!;
        p.x += (width / 2 - p.x) * 0.01;
        p.y += (height / 2 - p.y) * 0.01;
        // Clamp
        p.x = Math.max(20, Math.min(width - 20, p.x));
        p.y = Math.max(20, Math.min(height - 20, p.y));
      });
    }

    setPositions(new Map(pos));
  }, [nodes, edges, width, height]);

  return positions;
}

// ── Graph Visualization Component ────────────────────
export function CodeGraphPanel({ teamId }: { teamId?: string | null }) {
  const [graphData, setGraphData] = useState<GraphSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 800, H = 500;

  // Load graph data
  useEffect(() => {
    async function load() {
      if (!teamId) {
        // No team — use demo graph
        setGraphData(buildDemoGraph());
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        // Fetch from Supabase
        const { data, error } = await supabase
          .from("code_graph_snapshots")
          .select("graph_data")
          .eq("team_id", teamId)
          .order("snapshot_at", { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          // Fallback to demo if no snapshot pushed yet
          setGraphData(buildDemoGraph());
          setLoading(false);
          return;
        }
        
        const raw = data.graph_data;
        const summary = parseGraphJson(raw);
        // Limit to 80 most connected nodes for performance
        const topNodes = [...summary.nodes]
          .sort((a, b) => b.connections - a.connections)
          .slice(0, 80);
        const topIds = new Set(topNodes.map((n) => n.id));
        const topEdges = summary.edges.filter(
          (e) => topIds.has(e.source) && topIds.has(e.target)
        );
        setGraphData({ ...summary, nodes: topNodes, edges: topEdges });
      } catch {
        // Fallback to demo graph on any error
        setGraphData(buildDemoGraph());
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [teamId]);

  const [viewMode, setViewMode] = useState<"2D" | "3D">("3D");

  const positions = useForceLayout(
    graphData?.nodes || [],
    graphData?.edges || [],
    W,
    H
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Network className="mr-2 size-5 animate-pulse" />
        Loading code graph...
      </div>
    );
  }

  if (error || !graphData) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
        <AlertTriangle className="size-8 text-yellow-500/60" />
        <p className="max-w-xs text-center text-xs">{error || "No graph data"}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
            <Network className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Codebase Graph</h2>
            <p className="text-[11px] text-muted-foreground">
              {graphData.stats.totalNodes} nodes · {graphData.stats.totalEdges} edges ·{" "}
              {graphData.stats.languages.join(", ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/50 p-1">
          <button
            onClick={() => setViewMode("3D")}
            className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-all ${
              viewMode === "3D"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            3D View
          </button>
          <button
            onClick={() => setViewMode("2D")}
            className={`rounded-lg px-3 py-1 text-[10px] font-medium transition-all ${
              viewMode === "2D"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            2D View
          </button>
        </div>
      </div>

      {/* Graph Visualizer */}
      <div className="flex-1 overflow-hidden px-4 py-3">
        {viewMode === "3D" ? (
          <Graph3D
            nodes={graphData.nodes}
            edges={graphData.edges}
            godNodes={graphData.godNodes}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
          />
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-full w-full rounded-xl border border-border bg-surface-2/20"
          >
            {/* Edges */}
            {graphData.edges.map((e, i) => {
              const from = positions.get(e.source);
              const to = positions.get(e.target);
              if (!from || !to) return null;
              const isHighlighted =
                hoveredNode === e.source || hoveredNode === e.target;
              return (
                <line
                  key={i}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={isHighlighted ? "rgba(139,92,246,0.6)" : "rgba(128,128,128,0.15)"}
                  strokeWidth={isHighlighted ? 1.5 : 0.5}
                />
              );
            })}

            {/* Nodes */}
            {graphData.nodes.map((n) => {
              const pos = positions.get(n.id);
              if (!pos) return null;
              const isGod = graphData.godNodes.some((g) => g.id === n.id);
              const r = Math.max(3, Math.min(12, n.connections * 0.8 + 2));
              const color = COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length];

              return (
                <g
                  key={n.id}
                  onMouseEnter={() => setHoveredNode(n.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(n)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={r}
                    fill={color}
                    opacity={hoveredNode && hoveredNode !== n.id ? 0.3 : 0.8}
                    stroke={isGod ? "#ef4444" : "none"}
                    strokeWidth={isGod ? 2 : 0}
                  />
                  {(hoveredNode === n.id || r > 6) && (
                    <text
                      x={pos.x}
                      y={pos.y - r - 4}
                      textAnchor="middle"
                      className="fill-foreground text-[6px] font-medium"
                    >
                      {n.label.split("/").pop()?.split(".")[0] || n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Stats Bar */}
      <div className="border-t border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            {graphData.godNodes.slice(0, 3).map((g) => (
              <span
                key={g.id}
                className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-red-400"
              >
                <AlertTriangle className="size-2.5" />
                {g.label.split("/").pop()} ({g.connections})
              </span>
            ))}
          </div>
          <span className="ml-auto text-[9px] text-muted-foreground/60">
            Red outlines = God nodes (high coupling risk)
          </span>
        </div>

        {selectedNode && (() => {
          // Find connected nodes
          const incoming = graphData.edges
            .filter((e) => e.target === selectedNode.id)
            .map((e) => graphData.nodes.find((n) => n.id === e.source))
            .filter(Boolean) as GraphNode[];
          const outgoing = graphData.edges
            .filter((e) => e.source === selectedNode.id)
            .map((e) => graphData.nodes.find((n) => n.id === e.target))
            .filter(Boolean) as GraphNode[];
          const isGodNode = graphData.godNodes.some((g) => g.id === selectedNode.id);

          return (
            <div className="mt-2 rounded-xl border border-border bg-surface-2/30 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileCode className="size-4 text-primary" />
                <span className="text-[12px] font-bold">{selectedNode.label}</span>
                <span className="rounded-md bg-surface px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                  {selectedNode.type}
                </span>
                {selectedNode.language && (
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                    {selectedNode.language}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground ml-auto">
                  {selectedNode.connections} connections
                </span>
                {isGodNode && (
                  <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                    ⚠ God Node
                  </span>
                )}
              </div>
              {(incoming.length > 0 || outgoing.length > 0) && (
                <div className="flex gap-4 text-[9px]">
                  {incoming.length > 0 && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Imported by: </span>
                      {incoming.slice(0, 5).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNode(n)}
                          className="inline-block mr-1 rounded bg-surface px-1.5 py-0.5 text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        >
                          {n.label.split("/").pop()}
                        </button>
                      ))}
                      {incoming.length > 5 && <span className="text-muted-foreground/50">+{incoming.length - 5} more</span>}
                    </div>
                  )}
                  {outgoing.length > 0 && (
                    <div>
                      <span className="font-semibold text-muted-foreground">Imports: </span>
                      {outgoing.slice(0, 5).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => setSelectedNode(n)}
                          className="inline-block mr-1 rounded bg-surface px-1.5 py-0.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                        >
                          {n.label.split("/").pop()}
                        </button>
                      ))}
                      {outgoing.length > 5 && <span className="text-muted-foreground/50">+{outgoing.length - 5} more</span>}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
