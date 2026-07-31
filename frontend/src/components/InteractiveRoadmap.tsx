import { useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";
import { Check, Navigation, Rocket, Smartphone, Globe, Code, Sparkles } from "lucide-react";
import type { Roadmap, RoadmapTask } from "../lib/roadmap";

// Fixed icons for journey mode
const ICONS = [Rocket, Code, Smartphone, Globe, Sparkles];

export function InteractiveRoadmap({
  roadmap,
  tasks,
}: {
  roadmap: Roadmap;
  tasks: RoadmapTask[];
}) {
  // Determine phase progress
  const phases = (roadmap.phases as { name: string; description?: string }[]).map((phase, idx) => {
    const phaseTasks = tasks.filter((t) => t.phase_index === idx);
    const total = phaseTasks.length;
    const done = phaseTasks.filter((t) => t.status === "done").length;
    let status: "COMPLETED" | "CURRENT" | "UPCOMING" = "UPCOMING";
    
    if (total > 0 && done === total) {
      status = "COMPLETED";
    } else if (done > 0 || total === 0) {
      // If some tasks are done or we are the first non-completed phase
      status = "CURRENT";
    }

    return {
      id: idx,
      title: phase.name,
      description: phase.description || "Hackathon milestone phase.",
      status,
      total,
      done,
      timeline: `Phase ${idx + 1}`
    };
  });

  // Ensure only one CURRENT phase (the earliest non-completed one)
  let foundCurrent = false;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].status !== "COMPLETED") {
      if (!foundCurrent) {
        phases[i].status = "CURRENT";
        foundCurrent = true;
      } else {
        phases[i].status = "UPCOMING";
      }
    }
  }

  const currentIndex = phases.findIndex(p => p.status === "CURRENT");
  const activePhaseIndex = currentIndex >= 0 ? currentIndex : phases.length - 1;
  const [selectedPhase, setSelectedPhase] = useState(activePhaseIndex);

  // Position logic
  const NODE_HEIGHT = 140; // spacing between nodes

  // Cursor animation
  const y = useMotionValue(0);
  const springY = useSpring(y, { stiffness: 80, damping: 15 });

  useEffect(() => {
    y.set(selectedPhase * NODE_HEIGHT);
  }, [selectedPhase, y]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] rounded-xl overflow-hidden relative">
      
      <div className="flex-1 overflow-y-auto relative px-8 py-12 scroll-smooth">
        <div className="relative w-full max-w-sm mx-auto min-h-[600px]">
          
          {/* The Road */}
          <div className="absolute left-1/2 -translate-x-1/2 top-4 bottom-12 w-12 bg-surface-2 rounded-full border border-surface-2 shadow-inner overflow-hidden">
            {/* Center dashed line */}
            <div 
              className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSIyMCIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIi8+PC9zdmc+')] opacity-50"
            />
            {/* Completed Road Fill */}
            <motion.div 
              className="absolute left-0 right-0 top-0 bg-cyan-500/20 backdrop-blur-md"
              initial={{ height: 0 }}
              animate={{ height: selectedPhase * NODE_HEIGHT + 60 }}
              transition={{ stiffness: 80, damping: 15, type: "spring" }}
            />
          </div>

          {/* Nodes */}
          {phases.map((phase, i) => {
            const Icon = ICONS[i % ICONS.length];
            const isCompleted = phase.status === "COMPLETED";
            const isCurrent = phase.status === "CURRENT";
            const isSelected = selectedPhase === i;

            return (
              <div 
                key={i} 
                className="absolute w-full flex items-center justify-center -translate-y-1/2 cursor-pointer"
                style={{ top: i * NODE_HEIGHT + 40 }}
                onClick={() => setSelectedPhase(i)}
              >
                {/* Hitbox */}
                <div className="absolute inset-0 h-20 -translate-y-4 z-20" />
                
                <motion.div
                  className={`relative z-10 size-[68px] rounded-full flex items-center justify-center transition-colors duration-500 ${
                    isCompleted 
                      ? "bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] border-2 border-cyan-400" 
                      : isCurrent
                        ? "bg-[#111] border-2 border-cyan-400 text-cyan-400"
                        : "bg-[#111] border-2 border-border/50 text-muted-foreground grayscale opacity-50"
                  }`}
                  animate={
                    isCurrent 
                      ? { boxShadow: ["0 0 0px rgba(6,182,212,0)", "0 0 30px rgba(6,182,212,0.5)", "0 0 0px rgba(6,182,212,0)"] } 
                      : {}
                  }
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Icon className="size-7" />

                  {isCompleted && (
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-1 border-2 border-[#0a0a0a]">
                      <Check className="size-3 text-white" />
                    </div>
                  )}
                </motion.div>
                
                {/* Tooltip on right */}
                <div className={`absolute left-1/2 ml-14 w-32 transition-all duration-300 ${isSelected ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none"}`}>
                  <div className="text-[10px] font-bold tracking-widest text-cyan-400 mb-0.5">{phase.timeline}</div>
                  <div className="text-sm font-bold text-white leading-tight">{phase.title}</div>
                </div>
              </div>
            );
          })}

          {/* Animated Cursor */}
          <motion.div 
            className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
            style={{ top: 40, y: springY }}
          >
            <div className="size-10 bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)] grid place-items-center relative">
              <Navigation className="size-5 text-cyan-950 fill-cyan-950" />
              <div className="absolute inset-0 rounded-full border border-white animate-ping opacity-50" />
            </div>
          </motion.div>

        </div>
      </div>

      {/* State Panel */}
      <div className="bg-surface/90 backdrop-blur-xl border-t border-border p-6 rounded-b-xl z-40">
        <div className="max-w-sm mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedPhase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${
                  phases[selectedPhase].status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400" :
                  phases[selectedPhase].status === "CURRENT" ? "bg-cyan-500/20 text-cyan-400" :
                  "bg-surface-2 text-muted-foreground"
                }`}>
                  {phases[selectedPhase].status}
                </span>
                <span className="text-[11px] font-semibold text-muted-foreground">{phases[selectedPhase].timeline}</span>
              </div>
              <h3 className="text-xl font-black text-white mb-2">{phases[selectedPhase].title}</h3>
              <p className="text-sm text-muted-foreground/80 leading-relaxed">
                {phases[selectedPhase].description}
              </p>
              <div className="mt-4 flex gap-2">
                 <div className="bg-surface-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white">
                   {phases[selectedPhase].done} / {phases[selectedPhase].total} Tasks
                 </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      
    </div>
  );
}
