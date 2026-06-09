import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Package, FileText, Search, ShieldCheck, GitBranch, BarChart3, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const workflowSteps = [
  { icon: Package, label: 'Package', color: 'bg-violet-100 text-violet-600' },
  { icon: FileText, label: 'Requirements', color: 'bg-blue-100 text-blue-600' },
  { icon: Search, label: 'Review', color: 'bg-cyan-100 text-cyan-600' },
  { icon: BarChart3, label: 'Gap Analysis', color: 'bg-amber-100 text-amber-600' },
  { icon: ShieldCheck, label: 'Approval', color: 'bg-emerald-100 text-emerald-600' },
  { icon: GitBranch, label: 'Pipeline', color: 'bg-purple-100 text-purple-600' },
  { icon: Zap, label: 'Execution', color: 'bg-orange-100 text-orange-600' },
  { icon: CheckCircle2, label: 'Reports', color: 'bg-green-100 text-green-600' },
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/5 via-primary/3 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-20 right-10 w-72 h-72 bg-violet-200/20 rounded-full blur-3xl animate-float" />
        <div className="absolute top-40 left-10 w-56 h-56 bg-blue-200/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-center mb-6"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent border border-primary/10 text-sm font-medium text-primary">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Quality Engineering
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-tight max-w-4xl mx-auto"
        >
          AI Assisted{' '}
          <span className="gradient-text">QA Delivery</span>{' '}
          Platform
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-center text-muted-foreground text-lg sm:text-xl max-w-2xl mx-auto mt-6 leading-relaxed"
        >
          Transform Java applications into validated requirements, AI-generated automation assets, BDD traceability, execution-ready pipelines, and actionable quality insights.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10"
        >
          <Link to="/workspace">
            <Button size="lg" className="h-12 px-8 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all">
              Start QA Workspace
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg" className="h-12 px-8 text-base font-semibold rounded-xl border-border hover:bg-muted">
              <Play className="w-4 h-4 mr-2" />
              View Dashboard
            </Button>
          </Link>
        </motion.div>

        {/* Workflow Pipeline Visual */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 sm:mt-20"
        >
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-border shadow-xl shadow-black/5 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-xs font-medium text-muted-foreground tracking-wide uppercase">QA Delivery Pipeline</span>
              </div>
              
              <div className="relative">
                {/* Connecting line behind icons */}
                <div className="hidden sm:block absolute top-6 left-6 right-6 h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                  {workflowSteps.map((step, i) => (
                    <motion.div
                      key={step.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.6 + i * 0.08 }}
                      className="flex flex-col items-center gap-2 relative"
                    >
                      <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center transition-transform hover:scale-110 relative z-10`}>
                        <step.icon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground text-center leading-tight">{step.label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
