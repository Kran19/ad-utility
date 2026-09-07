import React from 'react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-12 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center py-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
            U
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Utility Platform</span>
        </div>
        <div className="flex items-center space-x-4 text-sm font-medium text-slate-400">
          <span className="flex items-center space-x-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs text-slate-300">Phase 1: Foundation Active</span>
          </span>
        </div>
      </header>

      {/* Hero Section */}
      <main className="my-12 space-y-8">
        <div className="space-y-4 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-sky-950/60 border border-sky-800/40 text-sky-400 text-xs font-semibold uppercase tracking-wider">
            Docker Containerized Monorepo Architecture
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
            High-Performance <span className="bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Utility & Ad Engine</span>
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            A centralized single-domain platform hosting scalable web utilities, real-time ad targeting, AI Gateway services, and privacy-first analytics telemetry.
          </p>
        </div>

        {/* System Services Container Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-6">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Backend API</div>
            <div className="text-lg font-bold text-white">NestJS REST API</div>
            <div className="text-xs text-sky-400 font-mono">Port 4000 (/api/v1)</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Database</div>
            <div className="text-lg font-bold text-white">PostgreSQL 16</div>
            <div className="text-xs text-emerald-400 font-mono">Port 5432 (Prisma)</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Cache & Queue</div>
            <div className="text-lg font-bold text-white">Redis 7</div>
            <div className="text-xs text-indigo-400 font-mono">Port 6379</div>
          </div>
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Frontend Web</div>
            <div className="text-lg font-bold text-white">Next.js App Router</div>
            <div className="text-xs text-purple-400 font-mono">Port 3000</div>
          </div>
        </div>

        {/* Feature Execution Roadmap */}
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <h2 className="text-xl font-bold text-white">13-Phase Monorepo Roadmap</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 flex items-center justify-between">
              <span>Phase 0: Docs & Audit</span>
              <span className="text-xs bg-emerald-900/60 px-2 py-0.5 rounded font-mono">COMPLETED</span>
            </div>
            <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-800/40 text-sky-300 flex items-center justify-between">
              <span>Phase 1: Foundation & Docker</span>
              <span className="text-xs bg-sky-900/60 px-2 py-0.5 rounded font-mono">IN PROGRESS</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-between">
              <span>Phase 2: PostgreSQL & Prisma</span>
              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded font-mono">NEXT</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-800 text-center text-xs text-slate-500">
        Utility + Ad Platform &copy; {new Date().getFullYear()} — Enterprise Monorepo Architecture
      </footer>
    </div>
  );
}
