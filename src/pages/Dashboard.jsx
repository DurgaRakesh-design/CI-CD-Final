import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Clock,
  Download,
  ExternalLink,
  Filter,
  GitBranch,
  Radio,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { overview, repo, runs } from '@/data/dashboardData';

const statusStyles = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failure: 'bg-rose-50 text-rose-700 border-rose-200',
  running: 'bg-blue-50 text-blue-700 border-blue-200',
};

const statusCopy = {
  success: 'Success',
  failure: 'Needs Review',
  running: 'Running',
};

const metricTones = {
  violet: 'from-violet-50 via-white to-violet-50 border-violet-100 text-violet-700',
  emerald: 'from-emerald-50 via-white to-emerald-50 border-emerald-100 text-emerald-700',
  indigo: 'from-indigo-50 via-white to-indigo-50 border-indigo-100 text-indigo-700',
  fuchsia: 'from-fuchsia-50 via-white to-fuchsia-50 border-fuchsia-100 text-fuchsia-700',
  teal: 'from-teal-50 via-white to-teal-50 border-teal-100 text-teal-700',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusStyles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusCopy[status]}
    </span>
  );
}

function SectionLabel({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</p>}
        <h2 className="mt-1 font-heading text-lg font-black tracking-tight text-foreground md:text-xl">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RunCard({ run, selected, onClick }) {
  const coverage = Math.round((run.bddCovered / Math.max(run.bddTotal, 1)) * 100);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        selected ? 'border-primary/40 ring-4 ring-primary/10' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-sm font-black text-foreground">
            #{run.runNumber} · {run.projectName}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {run.branch} · {run.age}
          </p>
        </div>
        <StatusPill status={run.status} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
        <div className="rounded-2xl bg-violet-50/80 px-3 py-2">
          <span className="block font-black text-foreground">{run.testsTotal}</span>
          tests
        </div>
        <div className="rounded-2xl bg-emerald-50/80 px-3 py-2">
          <span className="block font-black text-foreground">{coverage}%</span>
          BDD
        </div>
        <div className="rounded-2xl bg-amber-50/80 px-3 py-2">
          <span className="block font-black text-foreground">{run.duration}</span>
          duration
        </div>
      </div>
    </button>
  );
}

function PipelineStage({ name, duration, success }) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
        success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4" />
        <span className="font-semibold text-foreground">{name}</span>
      </div>
      <span className="text-[11px] font-black uppercase">{duration}</span>
    </div>
  );
}

export default function Dashboard() {
  const [selectedRunNumber, setSelectedRunNumber] = useState(runs[1]?.runNumber ?? runs[0].runNumber);
  const [query, setQuery] = useState('');
  const selectedRun = runs.find((run) => run.runNumber === selectedRunNumber) ?? runs[0];

  const filteredRuns = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return runs;
    return runs.filter((run) =>
      [run.projectName, run.branch, String(run.runNumber), run.status].some((item) =>
        item.toLowerCase().includes(normalized)
      )
    );
  }, [query]);

  const failedCount = runs.reduce((total, run) => total + run.testsFailed, 0);
  const bddCoverage = Math.round((selectedRun.bddCovered / Math.max(selectedRun.bddTotal, 1)) * 100);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_95%_97%),transparent_28rem),radial-gradient(circle_at_top_right,hsl(156_80%_96%),transparent_26rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(248_70%_98%))] pb-16 pt-16 md:pt-20">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-[0_24px_90px_-50px_rgba(79,70,229,.55)] backdrop-blur-2xl md:p-8">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
                  <Radio className="mr-1.5 h-3.5 w-3.5" />
                  Artifact-backed live dashboard
                </Badge>
                <Badge variant="outline" className="rounded-full bg-white/80 px-3 py-1">
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                  Live pipeline view
                </Badge>
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-primary">Live Pipeline View</p>
              <h1 className="mt-2 font-heading text-2xl font-black tracking-tight text-foreground md:text-4xl">
                Pipeline operations in one place
              </h1>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground md:text-sm">
                Open any workflow run, inspect structured QA test cases, move through BDD coverage, review packaged reports,
                and download artifacts directly from the portal.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
                  <GitBranch className="h-4 w-4" />
                  {repo.owner} / {repo.name}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
                  <Clock className="h-4 w-4" />
                  Updated {repo.updatedAt}
                </span>
              </div>
            </div>
            <Button className="h-11 rounded-full px-5 shadow-lg shadow-primary/20">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-rose-100 bg-white/90 p-4 shadow-sm backdrop-blur-xl md:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-100 text-rose-600">
                <Zap className="h-5 w-5" />
              </div>
              <div>
              <h2 className="font-heading text-xs font-black uppercase tracking-tight md:text-sm">Needs Review</h2>
                <p className="text-xs text-muted-foreground md:text-sm">
                  Latest failing run has {selectedRun.testsFailed} failed tests and {selectedRun.bddUncovered} uncovered BDD scenarios.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selectedRun.status} />
              <Badge variant="outline" className="rounded-full text-[11px]">
                Run #{selectedRun.runNumber}
              </Badge>
              <Badge variant="outline" className="rounded-full text-[11px]">
                {selectedRun.projectName}
              </Badge>
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-4 md:grid-cols-5">
          {overview.keyMetrics.map((metric) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border bg-gradient-to-br p-4 shadow-sm md:p-5 ${metricTones[metric.tone]}`}
            >
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
              <p className="mt-2 font-heading text-xl font-black text-foreground md:text-2xl">{metric.value}</p>
              <p className="mt-1 text-xs text-muted-foreground md:text-sm">{metric.sub}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-10 grid gap-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
            <SectionLabel
              eyebrow="Pipeline Runs"
              title={`${filteredRuns.length} runs`}
              action={<Filter className="h-5 w-5 text-muted-foreground" />}
            />
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by package, branch, or run #"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-[640px] space-y-3 overflow-y-auto pr-1">
              {filteredRuns.map((run) => (
                <RunCard
                  key={run.runNumber}
                  run={run}
                  selected={run.runNumber === selectedRun.runNumber}
                  onClick={() => setSelectedRunNumber(run.runNumber)}
                />
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl md:p-7">
            <div className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">Selected Pipeline</p>
                <h2 className="mt-2 font-heading text-xl font-black tracking-tight md:text-2xl">
                  Run #{selectedRun.runNumber} · {selectedRun.projectName}
                </h2>
                <p className="mt-2 text-xs text-muted-foreground md:text-sm">
                  Triggered {selectedRun.age} · {selectedRun.duration} · {selectedRun.branch} · {selectedRun.mode}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full">
                  <Download className="mr-2 h-4 w-4" />
                  Artifacts
                </Button>
                <Button variant="outline" className="rounded-full">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open CI
                </Button>
                <Button asChild className="rounded-full shadow-lg shadow-primary/20">
                  <Link to={`/summary/${selectedRun.runNumber}`}>
                    View Summary
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              {[
                ['Run Status', statusCopy[selectedRun.status], 'Packaged release status'],
                ['Executed Tests', selectedRun.testsTotal, `${selectedRun.testsPassed} passed · ${selectedRun.testsFailed} failed`],
                ['BDD Coverage', `${selectedRun.bddCovered}/${selectedRun.bddTotal}`, `${selectedRun.bddUncovered} scenarios uncovered`],
                ['Coverage / AI', `${selectedRun.coverageAi}%`, `${selectedRun.codeCoverage}% code coverage`],
              ].map(([label, value, sub], index) => (
                <div
                  key={label}
                  className={`rounded-3xl border border-border bg-gradient-to-br from-white to-muted/60 p-4 md:p-5 ${
                    index === 0 ? 'ring-1 ring-primary/10' : ''
                  }`}
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                  <p className="mt-2 font-heading text-xl font-black text-foreground md:text-2xl">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground md:text-sm">{sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-secondary/60 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-sm font-black md:text-base">Pipeline stages</h3>
                <span className="text-xs text-muted-foreground md:text-sm">
                  BDD coverage {bddCoverage}% · {failedCount} failures across recent runs
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Detect', '0.8s', true],
                  ['Build', '2m 15s', true],
                  ['Test', '5m 30s', selectedRun.status !== 'failure'],
                  ['Analyse', '1m 45s', true],
                  ['Reports', '0.5s', true],
                  ['Publish', '0.3s', true],
                ].map(([name, duration, success]) => (
                  <PipelineStage key={name} name={name} duration={duration} success={success} />
                ))}
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
