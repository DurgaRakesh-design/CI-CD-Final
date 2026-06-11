import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  FlaskConical,
  GitBranch,
  Lightbulb,
  Package,
  Play,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Workflow,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { overview, repo, runs } from '@/data/dashboardData';

const STAGES = [
  { n: 1, label: 'Discovery', tint: 'bg-violet-500' },
  { n: 2, label: 'Requirements', tint: 'bg-fuchsia-500' },
  { n: 3, label: 'BDD', tint: 'bg-rose-500' },
  { n: 4, label: 'Automation', tint: 'bg-amber-500' },
  { n: 5, label: 'Execution', tint: 'bg-emerald-500' },
  { n: 6, label: 'Insights', tint: 'bg-indigo-500' },
];

const stageTintMap = {
  violet: { bg: 'bg-violet-50', ic: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500' },
  rose: { bg: 'bg-rose-50', ic: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' },
  amber: { bg: 'bg-amber-50', ic: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  emerald: { bg: 'bg-emerald-50', ic: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
};

const stageIcons = [Package, GitBranch, Search, Rocket];

const metricIcons = {
  flask: FlaskConical,
  trend: TrendingUp,
  branch: GitBranch,
  bot: Brain,
  shield: ShieldCheck,
};

const qualityIntelligence = {
  release_readiness: {
    value: overview.readiness,
    delta: '+4%',
    remaining: '3 items remaining for full readiness',
  },
  requirement_coverage: overview.coverage,
  ai_insights: [
    '312 tests auto-generated',
    '47 improvement suggestions',
    '8 gaps auto-detected',
    '94% AI accuracy rate',
  ],
  recommendations: overview.recommendations,
};

const verispaceGeneration = {
  project: 'user-management-api',
  run: 46,
  stages_complete: '4 of 4 stages complete',
  stages: [
    {
      label: 'BRD Generated',
      tag: 'Stage 1',
      sub: '12 sections · 48 requirements',
      progress: 100,
      tint: 'violet',
      note: 'Business requirements extracted from package source and approved by reviewer.',
    },
    {
      label: 'BDD Scenarios',
      tag: 'Stage 2',
      sub: '18 scenarios · 5 features',
      progress: 100,
      tint: 'rose',
      note: 'Gherkin scenarios generated and traced back to BRD requirements.',
    },
    {
      label: 'Gap Analysis',
      tag: 'Stage 3',
      sub: '3 gaps detected · resolved',
      progress: 100,
      tint: 'amber',
      note: 'AI-driven gap detection between BRD and BDD coverage with auto-resolution suggestions.',
    },
    {
      label: 'Pipeline Triggered',
      tag: 'Stage 4',
      sub: 'Run #47 · main',
      progress: 100,
      tint: 'emerald',
      note: 'CI/CD pipeline triggered with generated automation assets and traceability matrix.',
    },
  ],
};

const heroMetrics = [
  { icon: TrendingUp, label: 'Success Rate', value: `${overview.successRate}%` },
  { icon: AlertCircle, label: 'Active Issues', value: String(overview.activeIssues) },
  { icon: Clock, label: 'Avg Duration', value: overview.avgDuration },
];

function StatusPill({ status }) {
  const map = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failure: 'bg-rose-50 text-rose-700 ring-rose-200',
    running: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  };
  const label = status === 'success' ? 'Success' : status === 'failure' ? 'Failed' : 'Running';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${map[status]}`}
    >
      {label}
    </span>
  );
}

function SectionLabel({ children, inline = false }) {
  return (
    <div className={inline ? 'mb-0' : 'mb-3'}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{children}</div>
    </div>
  );
}

function ReadinessRing({ value, label }) {
  return (
    <div className="relative h-24 w-24 shrink-0 rounded-full bg-white/15 p-2 backdrop-blur">
      <div
        className="flex h-full w-full items-center justify-center rounded-full border-[6px] border-white/25"
        style={{
          background: `conic-gradient(rgba(255,255,255,.95) ${value}%, rgba(255,255,255,.15) 0)`,
        }}
      >
        <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-white/15 text-center">
          <div>
            <div className="text-2xl font-extrabold">{value}%</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/80">{label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value }) {
  return (
    <div className="min-w-[132px] rounded-2xl bg-white/10 p-3 text-left backdrop-blur">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{value}</div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function DashboardPage() {
  const [selectedId, setSelectedId] = useState(runs[1].runNumber);
  const [query, setQuery] = useState('');

  const selectedRun = runs.find((run) => run.runNumber === selectedId) ?? runs[0];

  const filtered = useMemo(
    () =>
      runs.filter((run) =>
        !query || `${run.runNumber} ${run.projectName} ${run.branch}`.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  );

  const runPassRate = Math.round((selectedRun.testsPassed / Math.max(selectedRun.testsTotal, 1)) * 100);
  const selectedBddCoverage = Math.round((selectedRun.bddCovered / Math.max(selectedRun.bddTotal, 1)) * 100);

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)] font-sans text-foreground antialiased">
      <main className="mx-auto max-w-[1200px] px-6 pb-20 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Artifact-backed live dashboard
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
              <Radio className="h-3 w-3" /> Live pipeline view
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Activity className="h-3.5 w-3.5" />
            Last updated <span className="font-semibold text-foreground">{repo.updatedAt}</span>
            <button className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card hover:bg-secondary">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <section className="mt-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700">
            <Sparkles className="h-3 w-3" /> VeriSphere AI · Quality Intelligence
          </div>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
            Understand any application.
            <br />
            <span className="bg-[image:var(--gradient-hero)] bg-clip-text text-transparent">
              Generate everything needed for quality delivery.
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            From code discovery to validated delivery — track requirements, BDD, automation, execution and quality insights in one unified console.
          </p>

          <div className="mt-6 rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3 overflow-x-auto">
              {STAGES.map((stage, index) => (
                <div key={stage.n} className="flex flex-1 items-center gap-2">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${stage.tint}`}>
                    {stage.n}
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold">{stage.label}</span>
                  {index < STAGES.length - 1 && <div className="h-px flex-1 bg-border" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-3xl bg-[image:var(--gradient-hero)] p-7 text-white shadow-[var(--shadow-glow)]">
          <div className="flex flex-wrap items-center gap-7">
            <ReadinessRing value={overview.readiness} label={overview.readinessLabel} />
            <div className="min-w-[260px] flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                <CheckCircle2 className="h-3 w-3" /> Overall Run Status
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">{overview.statusHeadline}</h2>
              <p className="mt-1 max-w-xl text-sm text-white/85">{overview.statusBody}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-50 ring-1 ring-emerald-300/40">
                  <CheckCircle2 className="h-3 w-3" /> {overview.readinessLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium">
                  Production-ready candidate
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {heroMetrics.map((metric) => (
                <HeroMetric key={metric.label} icon={metric.icon} label={metric.label} value={metric.value} />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8">
          <SectionLabel>Key Metrics</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {overview.keyMetrics.map((metric) => {
              const Icon = metricIcons[metric.icon] ?? FlaskConical;
              const tone =
                metric.tone === 'violet'
                  ? 'bg-violet-50 text-violet-700'
                  : metric.tone === 'emerald'
                    ? 'bg-emerald-50 text-emerald-700'
                    : metric.tone === 'indigo'
                      ? 'bg-indigo-50 text-indigo-700'
                      : metric.tone === 'fuchsia'
                        ? 'bg-fuchsia-50 text-fuchsia-700'
                        : 'bg-teal-50 text-teal-700';
              return (
                <KpiTile
                  key={metric.label}
                  icon={Icon}
                  label={metric.label}
                  value={metric.value}
                  sub={metric.sub}
                  tone={tone}
                />
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between">
            <SectionLabel>Quality Intelligence</SectionLabel>
            <span className="text-[11px] text-muted-foreground">AI-driven coverage & readiness</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-emerald-200/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Release Readiness
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-emerald-600">{qualityIntelligence.release_readiness.value}%</span>
                <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                  <TrendingUp className="h-3 w-3" />
                  {qualityIntelligence.release_readiness.delta}
                </span>
              </div>
              <div className="mt-3 h-1.5 w-full rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${qualityIntelligence.release_readiness.value}%` }}
                />
              </div>
              <p className="mt-3 text-[12px] text-muted-foreground">{qualityIntelligence.release_readiness.remaining}</p>
            </div>

            <div className="rounded-2xl border border-violet-200/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                <GitBranch className="h-3.5 w-3.5" /> Requirement Coverage
              </div>
              <ul className="mt-3 space-y-2.5">
                {qualityIntelligence.requirement_coverage.map((coverage) => (
                  <li key={coverage.label}>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-muted-foreground">{coverage.label}</span>
                      <span className="font-semibold">{coverage.value}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-secondary">
                      <div className="h-full rounded-full bg-[image:var(--gradient-hero)]" style={{ width: `${coverage.value}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-fuchsia-200/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-fuchsia-700">
                <Brain className="h-3.5 w-3.5" /> AI Insights
              </div>
              <ul className="mt-3 space-y-2 text-[13px]">
                {qualityIntelligence.ai_insights.map((item, index) => (
                  <li key={item} className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                        ['bg-violet-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-emerald-500'][index]
                      }`}
                    />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-amber-200/70 bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-amber-700">
                <Lightbulb className="h-3.5 w-3.5" /> Recommendations
              </div>
              <ul className="mt-3 space-y-2 text-[13px]">
                {qualityIntelligence.recommendations.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700">
                <Sparkles className="h-3 w-3" /> VeriSpace Generation
              </span>
              <h3 className="mt-3 text-2xl font-extrabold tracking-tight">
                Discovery → Delivery for <span className="text-violet-700">{verispaceGeneration.project}</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                VeriSpace generates BRD, BDD scenarios, runs gap analysis, then triggers the pipeline. Run #{verispaceGeneration.run}.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> {verispaceGeneration.stages_complete}
            </span>
          </div>

          <div className="mt-5 grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
            {verispaceGeneration.stages.map((stage, index) => {
              const tint = stageTintMap[stage.tint];
              const Icon = stageIcons[index] ?? Package;
              return (
                <div key={stage.label} className="contents">
                  <div className={`rounded-2xl ${tint.bg} border border-border/60 p-4`}>
                    <div className="flex items-center justify-between">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint.ic}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stage.tag}</div>
                    <div className="text-sm font-bold">{stage.label}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{stage.sub}</div>
                    <div className="mt-3 h-1.5 w-full rounded-full bg-white/60">
                      <div className={`h-full rounded-full ${tint.bar}`} style={{ width: `${stage.progress}%` }} />
                    </div>
                  </div>
                  {index < verispaceGeneration.stages.length - 1 && (
                    <div className="hidden items-center justify-center md:flex">
                      <ArrowRight className="h-4 w-4 rotate-0 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {verispaceGeneration.stages.map((stage) => {
              const tint = stageTintMap[stage.tint];
              return (
                <div key={`note-${stage.label}`} className="rounded-xl border border-border bg-background p-3.5">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className={`h-2 w-2 rounded-full ${tint.bar}`} />
                    {stage.label}
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{stage.note}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by package, branch, or run #"
                  className="h-10 w-full rounded-full border border-border bg-card pl-9 pr-3 text-[13px] placeholder:text-muted-foreground focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
                <Filter className="h-3.5 w-3.5" /> All Status
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold">Pipeline Runs</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                {filtered.length} results
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-5 lg:grid-cols-[400px_1fr]">
            <div className="space-y-2">
              {filtered.map((run) => {
                const active = run.runNumber === selectedId;
                return (
                  <button
                    key={run.runNumber}
                    type="button"
                    onClick={() => setSelectedId(run.runNumber)}
                    className={`w-full rounded-3xl border bg-card p-4 text-left transition-all hover:shadow-md ${
                      active ? 'border-violet-400 ring-2 ring-violet-200' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-extrabold tracking-tight">
                          #{run.runNumber} · {run.projectName}
                        </h3>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <GitBranch className="h-3 w-3" /> {run.branch}
                          <Clock className="ml-1 h-3 w-3" /> {run.duration}
                          <span>{run.age}</span>
                        </div>
                      </div>
                      <StatusPill status={run.status} />
                    </div>

                    <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                      <div className="flex gap-2 text-[11px] font-semibold">
                        <span className="text-emerald-600">{run.testsPassed}P</span>
                        <span className="text-rose-600">{run.testsFailed}F</span>
                        <span className="text-orange-500">{run.testsSkipped}S</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{run.testsTotal} total</div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight">
                    Run #{selectedRun.runNumber} · {selectedRun.projectName}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Triggered {selectedRun.age}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" /> {selectedRun.branch}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5" /> {selectedRun.trigger}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="rounded-full">
                    <Play className="mr-2 h-4 w-4" /> Re-run
                  </Button>
                  <Button variant="outline" className="rounded-full">
                    <Download className="mr-2 h-4 w-4" /> Artifacts
                  </Button>
                  <Button asChild className="rounded-full bg-violet-600 text-white shadow-[var(--shadow-glow)] hover:bg-violet-700">
                    <Link to={`/summary/${selectedRun.runNumber}`}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Open Summary
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-2xl bg-rose-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Run Status</div>
                  <div className="mt-2 text-3xl font-extrabold tracking-tight text-rose-700">
                    {selectedRun.status === 'failure' ? 'Failed' : selectedRun.status === 'success' ? 'Success' : 'Running'}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Packaged release status for this run</p>
                </div>

                <div className="rounded-2xl bg-violet-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Executed Tests</div>
                  <div className="mt-2 text-3xl font-extrabold tracking-tight text-violet-700">{selectedRun.testsTotal}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedRun.testsPassed} passed · {selectedRun.testsFailed} failed
                  </p>
                </div>

                <div className="rounded-2xl bg-indigo-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">BDD Coverage</div>
                  <div className="mt-2 text-3xl font-extrabold tracking-tight text-indigo-700">{selectedBddCoverage}%</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedRun.bddCovered}/{selectedRun.bddTotal} scenarios
                  </p>
                </div>

                <div className="rounded-2xl bg-amber-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Coverage / AI</div>
                  <div className="mt-2 text-3xl font-extrabold tracking-tight text-orange-600">{selectedRun.coverageAi}%</div>
                  <p className="mt-1 text-sm text-muted-foreground">{runPassRate}% success rate</p>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <SectionLabel inline>Pipeline Stages</SectionLabel>
                  <Link to={`/summary/${selectedRun.runNumber}`} className="text-sm font-semibold text-violet-600 hover:underline">
                    Open full pipeline summary <ArrowRight className="ml-1 inline-block h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {[
                    ['Detect', '0.8s', true],
                    ['Build', '2m 15s', true],
                    ['Test', '5m 30s', selectedRun.status !== 'failure'],
                    ['Analyse', '1m 45s', true],
                    ['Reports', '0.5s', true],
                    ['Publish', '0.3s', false],
                  ].map(([name, duration, success]) => (
                    <div
                      key={name}
                      className={`flex items-center justify-between rounded-full border px-4 py-3 ${
                        success ? 'border-emerald-200 bg-emerald-50' : name === 'Test' ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`h-4 w-4 ${success ? 'text-emerald-600' : name === 'Test' ? 'text-rose-600' : 'text-slate-500'}`}
                        />
                        <span className="font-semibold">{name}</span>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">{duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-violet-200 bg-violet-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-100 text-violet-700">
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-base font-bold">Full pipeline insights live in the Summary</div>
                      <p className="text-sm text-muted-foreground">
                        Test rows, BDD traceability, AI details, code quality, frontend evidence & report bundles.
                      </p>
                    </div>
                  </div>
                  <Button asChild className="rounded-full bg-violet-600 text-white hover:bg-violet-700">
                    <Link to={`/summary/${selectedRun.runNumber}`}>
                      View Summary <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;
