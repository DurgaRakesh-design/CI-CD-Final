import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  FlaskConical,
  GitBranch,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadDashboardSnapshot, loadLocalDashboardSnapshot } from '@/services/dashboardService';

const metricIcons = {
  flask: FlaskConical,
  trend: TrendingUp,
  branch: GitBranch,
  bot: Brain,
  shield: ShieldCheck,
};

const RUNS_PER_PAGE = 4;

function StatusPill({ status }) {
  const map = {
    success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    failure: 'bg-rose-50 text-rose-700 ring-rose-200',
    running: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  };
  const label = status === 'success' ? 'Success' : status === 'failure' ? 'Failed' : 'Running';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ring-1 ${map[status] || map.running}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function SectionLabel({ children, inline = false }) {
  return (
    <div className={inline ? 'mb-0' : 'mb-3'}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{children}</div>
    </div>
  );
}

function ReadinessRing({ value, label }) {
  return (
    <div
      className="grid h-24 w-24 shrink-0 place-items-center rounded-full p-2"
      style={{ background: `conic-gradient(rgba(255,255,255,.95) ${value * 3.6}deg, rgba(255,255,255,.22) 0deg)` }}
    >
      <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white/15 text-center shadow-inner backdrop-blur">
        <div>
          <div className="font-heading text-xl font-bold leading-none">{value}%</div>
          <div className="mt-1 text-[9px] font-semibold uppercase text-white/75">{label}</div>
        </div>
      </div>
    </div>
  );
}

function HeroMetric({ icon: Icon, label, value }) {
  return (
    <div className="min-w-[126px] rounded-xl bg-white/10 p-3 text-left backdrop-blur">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-white/80">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 font-heading text-xl font-bold">{value}</div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 font-heading text-xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: snapshot = loadLocalDashboardSnapshot(), isFetching, refetch } = useQuery({
    queryKey: ['dashboard-snapshot'],
    queryFn: loadDashboardSnapshot,
    initialData: loadLocalDashboardSnapshot(),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const overview = snapshot.overview;
  const runs = snapshot.runs || [];
  const repo = snapshot.repo || {};
  const hasRemoteRuns = Boolean(snapshot.remoteAvailable);
  const hasLocalRuns = runs.length > 0;
  const sourceLabel = hasRemoteRuns
    ? 'GitHub workflow runs'
    : hasLocalRuns
      ? 'Local workspace snapshot'
      : 'No pipeline data yet';
  const sourceBody = hasRemoteRuns
    ? 'Dashboard values are coming from the latest GitHub workflow runs.'
    : hasLocalRuns
      ? 'GitHub workflow data is unavailable right now, so the dashboard is showing the local workspace snapshot.'
      : 'No pipeline run has been captured yet. Trigger a run from Workspace to populate the dashboard.';

  const [selectedId, setSelectedId] = useState(() => snapshot.selectedRun?.runNumber || runs[0]?.runNumber || 1);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!runs.length) return;
    if (!runs.some((run) => run.runNumber === selectedId)) {
      setSelectedId(snapshot.selectedRun?.runNumber || runs[0].runNumber);
    }
  }, [runs, selectedId, snapshot.selectedRun]);

  const selectedRun = runs.find((run) => run.runNumber === selectedId) ?? snapshot.selectedRun ?? runs[0] ?? null;
  const aiExecuted = snapshot.aiDetails?.executed || 0;
  const aiGenerated = snapshot.aiDetails?.generated || 0;

  const filtered = useMemo(
    () =>
      runs.filter((run) =>
        !query || `${run.runNumber} ${run.projectName} ${run.branch}`.toLowerCase().includes(query.toLowerCase())
      ),
    [runs, query]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / RUNS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedRuns = filtered.slice((currentPage - 1) * RUNS_PER_PAGE, currentPage * RUNS_PER_PAGE);
  const selectedBddCoverage = Math.round((selectedRun?.bddCovered || 0) / Math.max(selectedRun?.bddTotal || 1, 1) * 100);
  const combined = useMemo(() => {
    const totalRuns = runs.length;
    const successCount = runs.filter((run) => run.status === 'success').length;
    const covered = runs.reduce((sum, run) => sum + Number(run.bddCovered || 0), 0);
    const total = runs.reduce((sum, run) => sum + Number(run.bddTotal || 0), 0);
    const acceptedScripts = runs.reduce((sum, run) => sum + Number(run.aiAccepted || 0), 0);
    const generatedScripts = runs.reduce((sum, run) => sum + Number(run.aiGenerated || 0), 0);
    return { totalRuns, successCount, covered, total, acceptedScripts, generatedScripts };
  }, [runs]);
  const heroMetrics = [
    { icon: TrendingUp, label: 'Successful Runs', value: `${combined.successCount}/${combined.totalRuns || 0}` },
    { icon: AlertCircle, label: 'Scenario Coverage', value: `${combined.covered}/${combined.total || 0}` },
    { icon: Clock, label: 'AI Scripts', value: `${combined.acceptedScripts}/${combined.generatedScripts || 0}` },
  ];

  const handleQueryChange = (event) => {
    setQuery(event.target.value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-soft)] text-foreground antialiased">
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-2xl bg-[image:var(--gradient-hero)] p-6 text-white shadow-[var(--shadow-glow)] md:p-7">
          <div className="flex flex-wrap items-center gap-6">
            <ReadinessRing value={overview.readiness} label={overview.readinessLabel} />
            <div className="min-w-[260px] flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold backdrop-blur">
                <CheckCircle2 className="h-3 w-3" /> Overall Run Status
              </span>
              <h1 className="mt-3 font-heading text-2xl font-bold leading-tight md:text-3xl">{overview.statusHeadline}</h1>
              <p className="mt-1 max-w-xl text-sm leading-6 text-white/85">{overview.statusBody}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-50 ring-1 ring-emerald-300/40">
                  <CheckCircle2 className="h-3 w-3" /> {overview.readinessLabel}
                </span>
                <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium">
                  {repo.owner || 'Repo'}/{repo.name || 'workspace'} - refreshed {repo.updatedAt || 'just now'}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {heroMetrics.map((metric) => (
                <HeroMetric key={metric.label} icon={metric.icon} label={metric.label} value={metric.value} />
              ))}
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 text-white/90 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-white/70">Data source</div>
                <div className="mt-1 font-heading text-lg font-bold">{sourceLabel}</div>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-white/80">{sourceBody}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${hasRemoteRuns ? 'bg-emerald-400/20 text-emerald-50 ring-1 ring-emerald-300/40' : 'bg-amber-400/20 text-amber-50 ring-1 ring-amber-300/40'}`}>
                {hasRemoteRuns ? 'Connected' : hasLocalRuns ? 'Fallback active' : 'Waiting for run'}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <SectionLabel>Key Metrics</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {(overview.keyMetrics || []).map((metric) => {
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
              return <KpiTile key={metric.label} icon={Icon} label={metric.label} value={metric.value} sub={metric.sub} tone={tone} />;
            })}
          </div>
        </section>

        <section className="mt-7">
          <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
            <aside className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SectionLabel inline>Pipeline Runs</SectionLabel>
                  <p className="mt-1 text-xl font-heading font-bold">{filtered.length} runs</p>
                </div>
                <Button variant="outline" size="sm" className="h-9 rounded-xl px-3" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  {isFetching ? 'Refreshing' : 'Refresh'}
                </Button>
              </div>

              <div className="mt-4 flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={handleQueryChange}
                    placeholder="Search package, branch, run"
                    className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-secondary">
                  <Filter className="h-3.5 w-3.5" /> Main CI
                </button>
              </div>

              <div className="mt-4 space-y-2">
                {pagedRuns.map((run) => {
                  const active = run.runNumber === selectedId;
                  return (
                    <button
                      key={`${run.source || 'run'}-${run.runNumber}`}
                      type="button"
                      onClick={() => setSelectedId(run.runNumber)}
                      className={`w-full rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm ${
                        active ? 'border-primary ring-2 ring-primary/15' : 'border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold">
                            #{run.runNumber} - {run.projectName}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <GitBranch className="h-3 w-3" /> {run.branch}
                            <Clock className="h-3 w-3" /> {run.duration}
                            <span>{run.workflowName || 'Main CI'}</span>
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

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg px-3"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </aside>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionLabel inline>Selected Pipeline</SectionLabel>
                  <h2 className="mt-1 font-heading text-2xl font-bold leading-tight">
                    Run #{selectedRun?.runNumber || '0'} - {selectedRun?.projectName || 'Workspace'}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> Triggered {selectedRun?.age || 'just now'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" /> {selectedRun?.branch || 'develop'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Play className="h-3.5 w-3.5" /> {selectedRun?.workflowName || selectedRun?.trigger || 'dispatch'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="rounded-xl shadow-[var(--shadow-glow)]">
                    <Link to={`/summary/${selectedRun?.runNumber || 1}`}>
                      <ExternalLink className="mr-2 h-4 w-4" /> Open Summary
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-rose-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Run Status</div>
                  <div className="mt-2 font-heading text-2xl font-bold text-rose-700">
                    {selectedRun?.status === 'failure' ? 'Failed' : selectedRun?.status === 'success' ? 'Success' : 'Running'}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedRun?.workflowName || 'Main CI workflow'}</p>
                </div>

                <div className="rounded-xl bg-violet-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Test Cases</div>
                  <div className="mt-2 font-heading text-2xl font-bold text-violet-700">{selectedRun?.testsTotal || 0}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedRun?.testsPassed || 0} passed · {selectedRun?.testsSkipped || 0} not run</p>
                </div>

                <div className="rounded-xl bg-indigo-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Scenario Coverage</div>
                  <div className="mt-2 font-heading text-2xl font-bold text-indigo-700">{selectedRun?.bddCovered || 0}/{selectedRun?.bddTotal || 0}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedBddCoverage}% covered · {selectedRun?.bddUncovered || 0} uncovered</p>
                </div>

                <div className="rounded-xl bg-amber-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">AI Generated Test Scripts</div>
                  <div className="mt-2 font-heading text-2xl font-bold text-orange-600">{selectedRun?.aiAccepted || aiExecuted}/{selectedRun?.aiGenerated || aiGenerated}</div>
                  <p className="mt-1 text-xs text-muted-foreground">accepted / generated</p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-background p-4">
                <div className="flex items-center justify-between">
                  <SectionLabel inline>Pipeline Stages</SectionLabel>
                  <Link to={`/summary/${selectedRun?.runNumber || 1}`} className="text-sm font-semibold text-primary hover:underline">
                    Open full pipeline summary <ArrowRight className="ml-1 inline-block h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  {(snapshot.pipelineJobs || []).map((job) => {
                    const success = job.status !== 'failure';
                    return (
                      <div
                        key={job.name}
                        className={`rounded-xl border px-4 py-4 ${
                          success ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className={`mt-0.5 h-4 w-4 ${success ? 'text-emerald-600' : 'text-rose-600'}`} />
                            <div>
                              <span className="text-sm font-semibold">{job.name}</span>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{job.summary || 'Primary CI stage'}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{job.duration}</span>
                        </div>
                        {job.artifacts?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {job.artifacts.slice(0, 3).map((artifact) => (
                              <span key={artifact} className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-black/5">
                                {artifact}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-100 text-violet-700">
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">Full pipeline insights live in the Summary</div>
                      <p className="text-sm text-muted-foreground">
                        Test rows, traceability outcomes, AI execution details, frontend evidence, and the published report bundle.
                      </p>
                    </div>
                  </div>
                  <Button asChild className="rounded-xl">
                    <Link to={`/summary/${selectedRun?.runNumber || 1}`}>
                      View Summary <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
