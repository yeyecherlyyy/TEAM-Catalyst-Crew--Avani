import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TextVelocityTab } from "./TextVelocityTab";
import { ParagraphMotionTab } from "./ParagraphMotionTab";
import { FlowchartEngineTab } from "./FlowchartEngineTab";

type Tab = "TEXT" | "PARAGRAPH" | "FLOWCHART";

export function MotionGuide() {
  const [activeTab, setActiveTab] = useState<Tab>("TEXT");

  const tabs: Tab[] = ["TEXT", "PARAGRAPH", "FLOWCHART"];

  return (
    <div className="flex flex-col h-full bg-background/50 rounded-xl overflow-hidden border border-border/50 backdrop-blur-xl">
      {/* Header */}
      <div className="p-4 border-b border-border/50 flex flex-col items-center gap-4">
        <h2 className="text-sm font-black tracking-widest text-foreground">MOTION GUIDE</h2>
        
        {/* Segmented Control */}
        <div className="flex bg-surface-2/50 p-1 rounded-full border border-border/50 relative w-full max-w-sm mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-[10px] font-bold tracking-widest relative z-10 transition-colors ${
                  isActive ? "text-cyan-950 dark:text-cyan-50" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabMotionGuide"
                    className="absolute inset-0 bg-cyan-400 dark:bg-cyan-500 rounded-full shadow-sm"
                    initial={false}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 h-full"
          >
            {activeTab === "TEXT" && <TextVelocityTab />}
            {activeTab === "PARAGRAPH" && <ParagraphMotionTab />}
            {activeTab === "FLOWCHART" && <FlowchartEngineTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
