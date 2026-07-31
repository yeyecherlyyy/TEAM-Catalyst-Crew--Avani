import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, PenTool, Play, RotateCw } from "lucide-react";

export function FlowchartEngineTab() {
  const [activeNode, setActiveNode] = useState<number | null>(0);

  const nodes = [
    { id: 0, label: "IDEATION", icon: Lightbulb, code: "animation: pulseGlow 2s infinite;" },
    { id: 1, label: "DESIGN", icon: PenTool, code: "animation: slideIn 0.5s ease-out;" },
    { id: 2, label: "ANIMATE", icon: Play, code: "transition: { type: 'spring', stiffness: 100 };" },
    { id: 3, label: "ITERATE", icon: RotateCw, code: "whileHover={{ scale: 1.05 }}" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="bg-surface-2/30 rounded-2xl border border-border/50 p-6 min-h-[300px] flex items-center justify-center relative overflow-hidden">
        
        {/* Animated Background Paths */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(45, 212, 191, 0.4)" />
              <stop offset="100%" stopColor="rgba(6, 182, 212, 0.4)" />
            </linearGradient>
          </defs>
          <motion.path
            d="M 100,80 L 250,80 L 250,220 L 100,220 Z"
            fill="none"
            stroke="url(#line-grad)"
            strokeWidth="2"
            strokeDasharray="8 8"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 0 }}
            transition={{ duration: 4, ease: "linear", repeat: Infinity }}
          />
        </svg>

        {/* 2x2 Grid for Nodes */}
        <div className="grid grid-cols-2 gap-16 relative z-10">
          {nodes.map((node) => {
            const Icon = node.icon;
            const isActive = activeNode === node.id;
            return (
              <button
                key={node.id}
                onClick={() => setActiveNode(node.id)}
                className="flex flex-col items-center gap-3 relative outline-none"
              >
                <motion.div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
                    isActive 
                      ? "bg-cyan-500/10 border-2 border-cyan-400 text-cyan-400" 
                      : "bg-surface border border-border/50 text-muted-foreground hover:bg-surface-2 hover:border-cyan-500/30 hover:text-cyan-400/70"
                  }`}
                  animate={isActive ? { scale: [1, 1.05, 1], boxShadow: ["0 0 0px rgba(34,211,238,0)", "0 0 20px rgba(34,211,238,0.3)", "0 0 0px rgba(34,211,238,0)"] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>
                <span className={`text-[10px] font-bold tracking-widest ${isActive ? "text-cyan-400" : "text-muted-foreground"}`}>
                  {node.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Code Snippet Box */}
      <div className="bg-surface-2 rounded-xl border border-border/50 p-4">
        <label className="text-[10px] font-bold tracking-widest text-muted-foreground block mb-2">CODE SNIPPET</label>
        <div className="bg-[#0f172a] rounded-lg p-3 font-mono text-xs overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeNode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <span className="text-pink-400">const </span>
              <span className="text-yellow-200">config</span>
              <span className="text-gray-400"> = </span>
              <span className="text-cyan-300">{`{`}</span>
              <br />
              <span className="text-green-300 ml-4">{nodes.find(n => n.id === activeNode)?.code}</span>
              <br />
              <span className="text-cyan-300">{`}`}</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
