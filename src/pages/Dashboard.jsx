import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
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
import { overview, repo, runs, workspace } from '@/data/dashboardData';

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
  violet: 'from-violet-50 to-white border-violet-100 text-violet-700',
  emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700',
  indigo: 'from-indigo-50 to-white border-indigo-100 text-indigo-700',
  fuchsia: 'from-fuchsia-50 to-white border-fuchsia-100 text-fuchsia-700',
  teal: 'from-teal-50 to-white border-teal-100 text-teal-700',
};

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusCopy[status]}
    </span>
  );
}

function ReadinessRing({ value }) {
  const angle = Math.round((value / 100) * 360);
  return (
    <div
      className="grid h-24 w-24 place-items-center rounded-full"
      style={{ background: `conic-gradient(hsl(var(--primary)) ${angle}deg, rgba(255,255,255,.28) 0deg)` }}
    >
      <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white/15 text-center text-white backdrop-blur-md">
        <div>
          <div className="text-2xl font-black">{value}%</div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-white/75">Ready</div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ eyebrow, title, action }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p>}
        <h2 className="mt-1 font-heading text-2xl font-black tracking-tight text-foreground">{title}</h2>
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
          <h3 className="font-heading text-base font-black text-foreground">
            #{run.runNumber} · {run.projectName}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{run.branch} · {run.age}</p>
        </div>
        <StatusPill status={run.status} />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="rounded-2xl bg-muted/60 px-3 py-2">
          <span className="block font-bold text-foreground">{run.testsTotal}</span>
          tests
        </div>
        <div className="rounded-2xl bg-muted/60 px-3 py-2">
          <span className="block font-bold text-foreground">{coverage}%</span>
          BDD
        </div>
        <div className="rounded-2xl bg-muted/60 px-3 py-2">
          <span className="block font-bold text-foreground">{run.duration}</span>
          duration
        </div>
      </div>
    </button>
  );
}

function PipelineStage({ job }) {
  const isFailed = job.status === 'failure';
  return (
    <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
      isFailed ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }`}>
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" />
        <span className="font-semibold text-foreground">{job.name}</span>
      </div>
      <span className="text-xs font-bold uppercase">{job.duration}</span>
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
  const selectedBddCoverage = Math.round((selectedRun.bddCovered / Math.max(selectedRun.bddTotal, 1)) * 100);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_90%_97%),transparent_32rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(245_65%_98%))] pb-16 pt-24">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 p-7 shadow-[0_24px_90px_-50px_rgba(79,70,229,.55)] backdrop-blur-2xl md:p-10">
          <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">
                  <Radio className="mr-1.5 h-3.5 w-3.5" />
                  Artifact-backed live dashboard
                </Badge>
                <Badge variant="outline" className="rounded-full bg-white/70 px-3 py-1">
                  <Activity className="mr-1.5 h-3.5 w-3.5" />
                  Live pipeline view
                </Badge>
              </div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Live Pipeline View</p>
              <h1 className="mt-3 font-heading text-4xl font-black tracking-tight text-foreground md:text-6xl">
                Pipeline operations in one place
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                Open any workflow run, inspect structured QA test cases, move through BDD coverage, review packaged reports,
                and download artifacts directly from the portal.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
            <Button className="h-12 rounded-full px-5 shadow-lg shadow-primary/20">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-600">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-black uppercase tracking-tight">Needs Review</h2>
                <p className="text-sm text-muted-foreground">
                  Latest failing run has {selectedRun.testsFailed} failed tests and {selectedRun.bddUncovered} uncovered BDD scenarios.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selectedRun.status} />
              <Badge variant="outline" className="rounded-full">Run #{selectedRun.runNumber}</Badge>
              <Badge variant="outline" className="rounded-full">{selectedRun.projectName}</Badge>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-5">
          {overview.keyMetrics.map((metric) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-3xl border bg-gradient-to-br p-5 shadow-sm ${metricTones[metric.tone]}`}
            >
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">{metric.label}</p>
              <p className="mt-3 font-heading text-3xl font-black text-foreground">{metric.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{metric.sub}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_20px_70px_-45px_rgba(79,70,229,.45)] backdrop-blur-xl md:p-8">
          <SectionLabel
            eyebrow="VerSpace Generation"
            title={`Discovery → Delivery for ${workspace.packageName}`}
            action={<Badge className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700 hover:bg-emerald-50">4 of 4 stages complete</Badge>}
          />
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ['BRD Generated', `${workspace.brdCount} requirements`, 'bg-violet-50 border-violet-100 text-violet-700'],
              ['BDD Scenarios', `${workspace.bddCount} scenarios`, 'bg-rose-50 border-rose-100 text-rose-700'],
              ['Gap Analysis', `${workspace.gapCount} gaps flagged`, 'bg-amber-50 border-amber-100 text-amber-700'],
              ['Pipeline Triggered', `Run #${selectedRun.runNumber}`, 'bg-emerald-50 border-emerald-100 text-emerald-700'],
            ].map(([title, sub, tone], index) => (
              <div key={title} className={`relative min-h-40 rounded-3xl border p-5 ${tone}`}>
                <p className="text-xs font-black uppercase tracking-[0.18em]">Stage {index + 1}</p>
                <h3 className="mt-7 font-heading text-lg font-black text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
                <div className="absolute bottom-5 left-5 right-5 h-1.5 rounded-full bg-current/80" />
              </div>
            ))}
          </div>
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
            <div className="flex flex-col gap-4 border-b border-border pb-6 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Selected Pipeline</p>
                <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">
                  Run #{selectedRun.runNumber} · {selectedRun.projectName}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
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

            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {[
                ['Run Status', statusCopy[selectedRun.status], 'Packaged release status'],
                ['Executed Tests', selectedRun.testsTotal, `${selectedRun.testsPassed} passed · ${selectedRun.testsFailed} failed`],
                ['BDD Coverage', `${selectedRun.bddCovered}/${selectedRun.bddTotal}`, `${selectedRun.bddUncovered} scenarios uncovered`],
                ['Coverage / AI', `${selectedRun.coverageAi}%`, `${selectedRun.codeCoverage}% code coverage`],
              ].map(([label, value, sub]) => (
                <div key={label} className="rounded-3xl border border-border bg-gradient-to-br from-white to-muted/60 p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                  <p className="mt-3 font-heading text-3xl font-black text-foreground">{value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-3xl bg-secondary/70 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-heading text-lg font-black">Pipeline stages</h3>
                <span className="text-sm text-muted-foreground">BDD coverage {selectedBddCoverage}% · {failedCount} failures across recent runs</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {['Detect', 'Build', 'Test', 'Analyse', 'Reports', 'Publish'].map((name, index) => (
                  <PipelineStage
                    key={name}
                    job={{
                      name,
                      status: selectedRun.status === 'failure' && name === 'Test' ? 'failure' : 'success',
                      duration: ['0.8s', '2m 15s', '5m 30s', '1m 45s', '0.5s', '0.3s'][index],
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
