import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function TextVelocityTab() {
  const [animationType, setAnimationType] = useState<"FADE" | "SCALE" | "STREAM">("FADE");
  const [velocity, setVelocity] = useState(0.5); // 0.1 (fast) to 2.0 (slow)
  const [trigger, setTrigger] = useState(0);

  const duration = 2.1 - velocity; // invert so slider right = fast = lower duration

  const variants = {
    FADE: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration } },
    },
    SCALE: {
      initial: { opacity: 0, scale: 0.5 },
      animate: { opacity: 1, scale: 1, transition: { duration, type: "spring" } },
    },
    STREAM: {
      initial: { opacity: 0, x: -50, filter: "blur(10px)" },
      animate: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration, ease: "easeOut" } },
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex-1 bg-surface-2/30 rounded-2xl border border-border/50 flex flex-col items-center justify-center min-h-[250px] p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${animationType}-${trigger}`}
            initial="initial"
            animate="animate"
            exit="initial"
            variants={variants[animationType]}
            className="text-4xl md:text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-teal-400 to-cyan-500"
          >
            CONNECTIVITY
          </motion.div>
        </AnimatePresence>
        
        <div className="flex gap-2 mt-12 bg-surface p-1 rounded-full border border-border/50">
          {["FADE", "SCALE", "STREAM"].map((type) => (
            <button
              key={type}
              onClick={() => { setAnimationType(type as any); setTrigger(t => t + 1); }}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider transition-all ${animationType === type ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-[11px] font-bold tracking-widest text-muted-foreground">VELOCITY</label>
            <span className="text-[10px] text-cyan-500 font-mono">{(2.1 - duration).toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground">Slow</span>
            <input 
              type="range" 
              min="0.1" max="2.0" step="0.1" 
              value={velocity}
              onChange={(e) => { setVelocity(parseFloat(e.target.value)); setTrigger(t => t + 1); }}
              className="flex-1 accent-cyan-500 h-1 bg-surface-2 rounded-full appearance-none cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground">Fast</span>
          </div>
        </div>

        <button 
          onClick={() => setTrigger(t => t + 1)}
          className="w-full py-3 rounded-xl bg-surface-2 border border-border/50 text-[12px] font-bold tracking-widest hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 transition-all active:scale-[0.98]"
        >
          PREVIEW
        </button>
      </div>
    </div>
  );
}
