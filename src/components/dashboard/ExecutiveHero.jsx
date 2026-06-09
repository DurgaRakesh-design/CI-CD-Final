import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, TrendingUp, AlertCircle, Clock } from 'lucide-react';

export default function ExecutiveHero() {
  const readinessScore = 87;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-violet-600 to-purple-700 p-6 sm:p-8 text-white"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-white/80" />
            <span className="text-sm font-medium text-white/80">Release Readiness</span>
          </div>
          <h2 className="font-heading font-bold text-3xl sm:text-4xl">{readinessScore}%</h2>
          <p className="text-white/60 text-sm mt-1">Overall quality score across all pipelines</p>
        </div>

        <div className="flex gap-4 sm:gap-6">
          <div className="text-center">
            <div className="flex items-center gap-1 text-emerald-300">
              <TrendingUp className="w-4 h-4" />
              <span className="text-2xl font-bold">94.2%</span>
            </div>
            <span className="text-xs text-white/60">Success Rate</span>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-amber-300">
              <AlertCircle className="w-4 h-4" />
              <span className="text-2xl font-bold">3</span>
            </div>
            <span className="text-xs text-white/60">Active Issues</span>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-1 text-blue-300">
              <Clock className="w-4 h-4" />
              <span className="text-2xl font-bold">12m</span>
            </div>
            <span className="text-xs text-white/60">Avg Duration</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
