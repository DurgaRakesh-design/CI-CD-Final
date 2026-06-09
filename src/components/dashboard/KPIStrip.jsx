import React from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, CheckCircle2, XCircle, SkipForward, TrendingUp, GitPullRequest, Code2, Bot, Monitor } from 'lucide-react';

const kpis = [
  { label: 'Executed Tests', value: '1,247', icon: FlaskConical, color: 'text-primary', bg: 'bg-primary/5' },
  { label: 'Passed', value: '1,173', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'Failed', value: '42', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  { label: 'Skipped', value: '32', icon: SkipForward, color: 'text-amber-600', bg: 'bg-amber-50' },
  { label: 'Success Rate', value: '94.2%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { label: 'BDD Coverage', value: '89%', icon: GitPullRequest, color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Code Coverage', value: '76%', icon: Code2, color: 'text-blue-600', bg: 'bg-blue-50' },
  { label: 'AI Generated', value: '312', icon: Bot, color: 'text-purple-600', bg: 'bg-purple-50' },
  { label: 'Frontend', value: 'Passed', icon: Monitor, color: 'text-emerald-600', bg: 'bg-emerald-50' },
];

export default function KPIStrip() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="p-3 rounded-xl bg-white border border-border hover:shadow-md transition-shadow"
        >
          <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center mb-2`}>
            <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
          </div>
          <p className="font-bold text-lg leading-tight">{kpi.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
