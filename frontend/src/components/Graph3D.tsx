import { useState, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Sphere, Html } from "@react-three/drei";
import * as THREE from "three";
import type { GraphNode, GraphEdge } from "./code-graph";

const COMMUNITY_COLORS = [
  "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16",
];

function useForceLayout3D(nodes: GraphNode[], edges: GraphEdge[], size: number) {
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; z: number }>>(
    new Map()
  );

  useEffect(() => {
    if (nodes.length === 0) return;

    const pos = new Map<string, { x: number; y: number; z: number }>();
    nodes.forEach((n) => {
      pos.set(n.id, {
        x: (Math.random() - 0.5) * size,
        y: (Math.random() - 0.5) * size,
        z: (Math.random() - 0.5) * size,
      });
    });

    for (let iter = 0; iter < 40; iter++) {
      const cooling = 1 - iter / 50;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos.get(nodes[i].id)!;
          const b = pos.get(nodes[j].id)!;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz), 1);
          const force = (100 * cooling) / dist;
          a.x -= (dx / dist) * force;
          a.y -= (dy / dist) * force;
          a.z -= (dz / dist) * force;
          b.x += (dx / dist) * force;
          b.y += (dy / dist) * force;
          b.z += (dz / dist) * force;
        }
      }

      edges.forEach((e) => {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const force = (dist - 40) * 0.03 * cooling;
        a.x += (dx / dist) * force;
        a.y += (dy / dist) * force;
        a.z += (dz / dist) * force;
        b.x -= (dx / dist) * force;
        b.y -= (dy / dist) * force;
        b.z -= (dz / dist) * force;
      });

      nodes.forEach((n) => {
        const p = pos.get(n.id)!;
        p.x *= 0.95;
        p.y *= 0.95;
        p.z *= 0.95;
      });
    }
    setPositions(new Map(pos));
  }, [nodes, edges, size]);

  return positions;
}

function Scene({
  nodes,
  edges,
  godNodes,
  hoveredNode,
  setHoveredNode,
  setSelectedNode,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  godNodes: GraphNode[];
  hoveredNode: string | null;
  setHoveredNode: (id: string | null) => void;
  setSelectedNode: (n: GraphNode) => void;
}) {
  const positions = useForceLayout3D(nodes, edges, 200);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05;
      groupRef.current.rotation.x += delta * 0.02;
    }
  });

  if (positions.size === 0) return null;

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.5} />
      <pointLight position={[100, 100, 100]} intensity={1} />
      <pointLight position={[-100, -100, -100]} intensity={0.5} color="#06b6d4" />

      {edges.map((e, i) => {
        const from = positions.get(e.source);
        const to = positions.get(e.target);
        if (!from || !to) return null;
        
        const isHighlighted = hoveredNode === e.source || hoveredNode === e.target;
        
        return (
          <Line
            key={`edge-${i}`}
            points={[
              [from.x, from.y, from.z],
              [to.x, to.y, to.z],
            ]}
            color={isHighlighted ? "#8b5cf6" : "#ffffff"}
            opacity={isHighlighted ? 0.8 : 0.15}
            transparent
            lineWidth={isHighlighted ? 2 : 0.5}
          />
        );
      })}

      {nodes.map((n) => {
        const pos = positions.get(n.id);
        if (!pos) return null;
        const isGod = godNodes.some((g) => g.id === n.id);
        const radius = Math.max(2, Math.min(8, n.connections * 0.5 + 1));
        const color = COMMUNITY_COLORS[n.community % COMMUNITY_COLORS.length];
        const isHovered = hoveredNode === n.id;
        
        return (
          <group key={n.id} position={[pos.x, pos.y, pos.z]}>
            <Sphere
              args={[radius, 16, 16]}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredNode(n.id); }}
              onPointerOut={() => setHoveredNode(null)}
              onClick={(e) => { e.stopPropagation(); setSelectedNode(n); }}
            >
              <meshStandardMaterial
                color={color}
                emissive={isGod ? "#ef4444" : color}
                emissiveIntensity={isGod ? 1 : isHovered ? 0.8 : 0.2}
                transparent
                opacity={hoveredNode && !isHovered ? 0.3 : 0.9}
              />
            </Sphere>
            
            {/* Glow effect for god nodes or hovered nodes */}
            {(isGod || isHovered) && (
              <Sphere args={[radius * 1.5, 16, 16]}>
                <meshBasicMaterial
                  color={isGod ? "#ef4444" : color}
                  transparent
                  opacity={0.3}
                  depthWrite={false}
                />
              </Sphere>
            )}

            {(isHovered || radius > 5) && (
              <Html distanceFactor={150} zIndexRange={[100, 0]} className="pointer-events-none">
                <div className="text-[10px] font-bold text-white whitespace-nowrap bg-black/50 px-1 rounded backdrop-blur-sm -translate-x-1/2 mt-2">
                  {n.label.split("/").pop()?.split(".")[0] || n.label}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function Graph3D({
  nodes,
  edges,
  godNodes,
  selectedNode,
  setSelectedNode,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  godNodes: GraphNode[];
  selectedNode: GraphNode | null;
  setSelectedNode: (n: GraphNode) => void;
}) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  return (
    <div className="w-full h-full bg-[#0a0a0a] rounded-xl overflow-hidden relative border border-border/50">
      <Canvas camera={{ position: [0, 0, 300], fov: 60 }}>
        <color attach="background" args={["#050505"]} />
        <Scene
          nodes={nodes}
          edges={edges}
          godNodes={godNodes}
          hoveredNode={hoveredNode}
          setHoveredNode={setHoveredNode}
          setSelectedNode={setSelectedNode}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
