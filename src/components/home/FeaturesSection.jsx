import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  GitPullRequest,
  Bot,
  BarChart3,
  GitBranch,
  Code2,
  Monitor,
  FileBarChart
} from 'lucide-react';

const features = [
  {
    icon: Brain,
    title: 'Requirement Intelligence',
    description: 'AI-powered extraction and analysis of business requirements from Java source code, configurations, and annotations.',
    color: 'bg-violet-50 text-violet-600 border-violet-100',
  },
  {
    icon: GitPullRequest,
    title: 'BDD Traceability',
    description: 'Full bidirectional traceability from business requirements to Gherkin scenarios to test execution results.',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    icon: Bot,
    title: 'AI Test Generation',
    description: 'Automatically generate comprehensive BDD scenarios, step definitions, and test automation code from requirements.',
    color: 'bg-cyan-50 text-cyan-600 border-cyan-100',
  },
  {
    icon: BarChart3,
    title: 'Gap Analysis',
    description: 'Intelligent comparison of code signals, package metadata, BRD, and BDD to identify missing requirements and coverage gaps.',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    icon: GitBranch,
    title: 'Pipeline Automation',
    description: 'GitHub Actions integration with automated build, test, analyze, and publish stages with live progress tracking.',
    color: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    icon: Code2,
    title: 'Code Quality',
    description: 'Static analysis, code coverage metrics, complexity scores, and AI-powered code quality recommendations.',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    icon: Monitor,
    title: 'Frontend Testing',
    description: 'Visual regression testing, accessibility audits, performance metrics, and cross-browser compatibility validation.',
    color: 'bg-orange-50 text-orange-600 border-orange-100',
  },
  {
    icon: FileBarChart,
    title: 'Enterprise Reporting',
    description: 'Executive dashboards, release readiness scores, downloadable report bundles, and audit-ready documentation.',
    color: 'bg-rose-50 text-rose-600 border-rose-100',
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary tracking-wide uppercase">Capabilities</span>
          <h2 className="mt-3 font-heading font-bold text-3xl sm:text-4xl tracking-tight">
            Everything you need for
            <br />
            <span className="gradient-text">quality delivery</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            A comprehensive platform that turns application understanding into requirements, scenarios, automation, traceability, pipelines, and release insight.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="group p-6 rounded-2xl bg-white border border-border hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className={`w-11 h-11 rounded-xl ${feature.color} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-semibold text-base mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
