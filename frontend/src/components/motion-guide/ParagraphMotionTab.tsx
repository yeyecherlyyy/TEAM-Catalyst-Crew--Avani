import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function ParagraphMotionTab() {
  const [transitionType, setTransitionType] = useState<"STAGGERED" | "FADE IN">("STAGGERED");
  const [trigger, setTrigger] = useState(0);

  const lines = [
    "MOTION DESIGN:",
    "Clean reveals, fluid kinetic",
    "energy, and smooth,",
    "staggered transitions. Improve",
    "flow and engagement."
  ];

  // Timeline representation logic
  const delays = lines.map((_, i) => transitionType === "STAGGERED" ? i * 0.08 : 0);
  const totalDuration = transitionType === "STAGGERED" ? 0.5 + (lines.length - 1) * 0.08 : 0.5;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: transitionType === "STAGGERED" ? 0.08 : 0,
        delayChildren: 0.1,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Canvas */}
      <div className="bg-surface-2/30 rounded-2xl border border-border/50 p-6 min-h-[200px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${transitionType}-${trigger}`}
            variants={containerVariants}
            initial="hidden"
            animate="show"
            exit="hidden"
            className="text-[15px] leading-[1.6] text-foreground/80 font-medium"
          >
            {lines.map((line, i) => (
              <motion.div key={i} variants={itemVariants as any}>
                {i === 0 ? <span className="font-bold text-cyan-400">{line}</span> : line}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="space-y-6">
        <div>
          <label className="text-[11px] font-bold tracking-widest text-muted-foreground block mb-3">TRANSITION TYPE</label>
          <div className="grid grid-cols-2 gap-3">
            {(["STAGGERED", "FADE IN"] as const).map((type) => (
              <button
                key={type}
                onClick={() => { setTransitionType(type); setTrigger(t => t + 1); }}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border transition-all ${
                  transitionType === type
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                    : "bg-surface-2/50 border-border/50 text-muted-foreground hover:bg-surface-2"
                }`}
              >
                {type === "STAGGERED" ? (
                  <div className="flex flex-col gap-1 w-8">
                    <div className="h-1 bg-current rounded-full w-full" />
                    <div className="h-1 bg-current rounded-full w-[80%] ml-[10%]" />
                    <div className="h-1 bg-current rounded-full w-[60%] ml-[20%]" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 w-8 opacity-70">
                    <div className="h-1 bg-current rounded-full w-full" />
                    <div className="h-1 bg-current rounded-full w-full" />
                    <div className="h-1 bg-current rounded-full w-full" />
                  </div>
                )}
                <span className="text-[10px] font-bold tracking-wider mt-1">{type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Visualizer */}
        <div>
          <label className="text-[11px] font-bold tracking-widest text-muted-foreground block mb-3">TIMELINE</label>
          <div className="bg-surface-2/30 rounded-xl p-4 border border-border/50 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 px-4 py-4 flex justify-between pointer-events-none opacity-20">
              {[0,1,2,3,4].map(i => <div key={i} className="w-[1px] h-full bg-muted-foreground" />)}
            </div>
            
            <div className="relative z-10 flex flex-col gap-2">
              {delays.map((delay, i) => (
                <div key={i} className="h-3 relative rounded-full bg-surface" style={{ width: '100%' }}>
                  <motion.div
                    className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-teal-400 to-cyan-500"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: `${(0.5 / totalDuration) * 100}%`, opacity: 1 }}
                    style={{ left: `${(delay / totalDuration) * 100}%` }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={() => setTrigger(t => t + 1)}
          className="w-full py-3 rounded-xl bg-surface-2 border border-border/50 text-[12px] font-bold tracking-widest hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all active:scale-[0.98]"
        >
          REPLAY
        </button>
      </div>
    </div>
  );
}
