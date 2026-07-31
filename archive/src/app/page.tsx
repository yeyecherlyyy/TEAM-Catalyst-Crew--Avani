'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Brain,
  MessageSquare,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
  Ghost,
  Sparkles,
  Target,
  Clock,
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Problem Statement Advisor',
    description:
      'Rate & compare problem statements with a 6-axis AI rubric. Get brutally honest scores on uniqueness, feasibility, and competition.',
    gradient: 'from-violet-500 to-purple-600',
  },
  {
    icon: MessageSquare,
    title: 'AI-Moderated Brainstorm',
    description:
      'Real-time drift detection catches circular discussions. AI nudges keep your team focused without micromanaging.',
    gradient: 'from-indigo-500 to-blue-600',
  },
  {
    icon: Target,
    title: 'Structured Artifacts',
    description:
      'Scorecards, roadmaps, flowcharts, briefs — auto-generated and version-tracked. No more disconnected docs.',
    gradient: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Users,
    title: 'Shared Workspace',
    description:
      'One place to think, document, and build. Real-time collaboration with resource directory and shared links.',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Clock,
    title: 'Time & Progress Tracking',
    description:
      'Predicted completion curves vs reality. Smart notifications tell you when to re-scope before it\'s too late.',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    icon: Sparkles,
    title: 'Prior Art Intelligence',
    description:
      'Web search grounded scoring. Know exactly what exists before you build. Get specific differentiation angles.',
    gradient: 'from-rose-500 to-pink-600',
  },
];

const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' as const } },
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-600/8 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-2/3 left-1/2 w-72 h-72 bg-purple-600/6 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-sm">
            <Ghost className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            <span className="gradient-text">GHOST</span>{' '}
            <span className="text-muted-foreground">PM</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg gradient-primary hover:opacity-90 transition-opacity glow-sm"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-16 text-center"
      >
        <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-violet-300">AI-Powered Hackathon Copilot</span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]"
        >
          Stop drifting.
          <br />
          <span className="gradient-text">Start shipping.</span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          GHOST PM rates your problem statements, moderates brainstorms in real time,
          and gives your team one shared workspace to go from idea to demo.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 px-7 py-3.5 text-base font-semibold text-white rounded-xl gradient-primary hover:opacity-90 transition-all glow animate-pulse-glow"
          >
            Start Building
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 text-base font-medium text-foreground rounded-xl border border-border hover:bg-secondary transition-colors"
          >
            Sign In
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={fadeUp}
          className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto"
        >
          {[
            { value: '6', label: 'Rating Axes' },
            { value: '10', label: 'Artifact Types' },
            { value: '2', label: 'Drift Stages' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </motion.section>

      {/* Features Grid */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
        variants={stagger}
        className="relative z-10 max-w-7xl mx-auto px-6 pb-24"
      >
        <motion.h2
          variants={fadeUp}
          className="text-3xl font-bold text-center mb-4"
        >
          Everything your team needs
        </motion.h2>
        <motion.p
          variants={fadeUp}
          className="text-muted-foreground text-center mb-12 max-w-xl mx-auto"
        >
          From problem statement selection to final demo, GHOST PM keeps your hackathon on track.
        </motion.p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              className="group card-elevated p-6 hover:border-violet-500/30 transition-all duration-300 cursor-default"
            >
              <div
                className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="card-elevated p-12 text-center gradient-border">
          <Ghost className="w-12 h-12 text-violet-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold mb-3">Ready to build?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Create your team, invite your squad, and let GHOST PM handle the rest.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white rounded-xl gradient-primary hover:opacity-90 transition-opacity glow"
          >
            <Sparkles className="w-4 h-4" />
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Ghost className="w-4 h-4" />
            GHOST PM
          </div>
          <p className="text-xs text-muted-foreground">
            Built for hackathons. Powered by AI.
          </p>
        </div>
      </footer>
    </div>
  );
}
