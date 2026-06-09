import React from 'react';
import { motion } from 'framer-motion';
import ExecutiveHero from '../components/dashboard/ExecutiveHero';
import KPIStrip from '../components/dashboard/KPIStrip';
import EnhancementWidgets from '../components/dashboard/EnhancementWidgets';
import PipelineRunsTable from '../components/dashboard/PipelineRunsTable';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-heading font-bold text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Quality engineering overview and pipeline analytics</p>
        </motion.div>

        {/* Executive Status Hero */}
        <ExecutiveHero />

        {/* KPI Strip */}
        <KPIStrip />

        {/* Enhancement Widgets */}
        <EnhancementWidgets />

        {/* Pipeline Runs */}
        <PipelineRunsTable />
      </div>
    </div>
  );
}
