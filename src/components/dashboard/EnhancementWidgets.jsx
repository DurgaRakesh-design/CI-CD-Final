import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, GitPullRequest, Bot, Lightbulb, TrendingUp } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function EnhancementWidgets() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Release Readiness Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-5 rounded-xl bg-white border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Release Readiness</span>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-emerald-600">87%</span>
          <span className="text-xs text-emerald-600 flex items-center gap-1 mb-1">
            <TrendingUp className="w-3 h-3" />+4%
          </span>
        </div>
        <Progress value={87} className="h-2 mt-3" />
        <p className="text-xs text-muted-foreground mt-2">3 items remaining for full readiness</p>
      </motion.div>

      {/* Requirement Coverage */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-5 rounded-xl bg-white border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <GitPullRequest className="w-4 h-4 text-violet-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Requirement Coverage</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">BRD Coverage</span>
            <span className="font-medium">91%</span>
          </div>
          <Progress value={91} className="h-1.5" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">BDD Coverage</span>
            <span className="font-medium">89%</span>
          </div>
          <Progress value={89} className="h-1.5" />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Test Coverage</span>
            <span className="font-medium">76%</span>
          </div>
          <Progress value={76} className="h-1.5" />
        </div>
      </motion.div>

      {/* AI Coverage Insights */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="p-5 rounded-xl bg-white border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Bot className="w-4 h-4 text-purple-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Insights</span>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>312 tests auto-generated</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span>47 improvement suggestions</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>8 gaps auto-detected</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>94% AI accuracy rate</span>
          </div>
        </div>
      </motion.div>

      {/* AI Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="p-5 rounded-xl bg-white border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recommendations</span>
        </div>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            Add error boundary tests for payment module
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            Increase code coverage for RefundController
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            Add performance benchmarks for inventory API
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            Review 3 deprecated test dependencies
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
