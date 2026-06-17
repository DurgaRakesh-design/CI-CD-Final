import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  FileBarChart,
  GitBranch,
  Layers,
  Monitor,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TestTube2,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { loadDashboardSnapshot, loadLocalDashboardSnapshot } from '@/services/dashboardService';

const topTabs = [
  { id: 'pipeline', label: 'Pipeline Details', icon: Zap },
  { id: 'workspace', label: 'Workspace Details', icon: Layers },
];

const pipelineTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'stages', label: 'Stages' },
  { id: 'tests', label: 'Tests' },
  { id: 'traceability', label: 'Traceability' },
  { id: 'ai', label: 'AI' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'quality', label: 'Quality' },
  { id: 'reports', label: 'Reports' },
];

const statusTone = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  failure: 'text-rose-700 bg-rose-50 border-rose-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
};

export default function PipelineSummary() {
  const { runNumber } = useParams();
  const { data: snapshot = loadLocalDashboardSnapshot(), isFetching, refetch } = useQuery({
    queryKey: ['dashboard-snapshot'],
    queryFn: loadDashboardSnapshot,
    initialData: loadLocalDashboardSnapshot(),
    staleTime: 30_000,
  });
  const [topTab, setTopTab] = useState('pipeline');
  const [pipelineTab, setPipelineTab] = useState('overview');

  const run = useMemo(() => {
    const matched = (snapshot.runs || []).find((item) => String(item.runNumber) === String(runNumber));
    return matched || snapshot.selectedRun || snapshot.runs?.[0] || null;
  }, [runNumber, snapshot.runs, snapshot.selectedRun]);

  const workspace = snapshot.workspace || {};
  const pipelineJobs = snapshot.pipelineJobs || [];
  const testRows = snapshot.testRows || [];
  const bddScenarios = snapshot.bddScenarios || [];
  const aiDetails = snapshot.aiDetails || { recommendations: [] };
  const codeQuality = snapshot.codeQuality || {};
  const frontend = snapshot.frontend || {};
  const reports = snapshot.reports || [];
  const hasRemoteRuns = Boolean(snapshot.remoteAvailable);
  const hasLocalRuns = Boolean(snapshot.selectedRun || (snapshot.runs || []).length);
  const sourceLabel = hasRemoteRuns
    ? 'GitHub workflow runs'
    : hasLocalRuns
      ? 'Local workspace snapshot'
      : 'No pipeline data yet';
  const sourceBody = hasRemoteRuns
    ? 'This summary is populated from the latest GitHub workflow run data.'
    : hasLocalRuns
      ? 'GitHub workflow data is not reachable right now, so this summary is using the local workspace snapshot.'
      : 'Trigger a run from Workspace to generate a populated summary.';

  const readiness = typeof run?.readinessScore === 'number'
    ? run.readinessScore
    : run?.status === 'failure'
      ? 64
      : run?.status === 'running'
        ? 78
        : 92;

  if (!run) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_95%_97%),transparent_28rem),radial-gradient(circle_at_top_right,hsl(156_80%_96%),transparent_26rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(248_70%_98%))] pt-16">
        <main className="mx-auto max-w-4xl px-4">
          <div className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-sm">
            <h1 className="font-heading text-2xl font-bold">No pipeline data yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Trigger a pipeline from the workspace to generate a live summary.
            </p>
            <div className="mt-4">
              <Button asChild>
                <Link to="/workspace">Go to Workspace</Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_95%_97%),transparent_28rem),radial-gradient(circle_at_top_right,hsl(156_80%_96%),transparent_26rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(248_70%_98%))] pb-16 pt-16 md:pt-20">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Button asChild variant="outline" className="mb-5 rounded-full bg-white/80 text-sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <section className="rounded-2xl border border-white/80 bg-white/90 p-6 shadow-[0_24px_90px_-50px_rgba(79,70,229,.55)] backdrop-blur-2xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Pipeline Summary
                </Badge>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusTone[run.status] || statusTone.running}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {run.status === 'failure' ? 'Needs Review' : run.status === 'running' ? 'Running' : 'Success'}
                </span>
                <Badge variant="outline" className="rounded-full text-[11px]">
                  Run #{run.runNumber} - {run.mode || 'workspace'}
                </Badge>
              </div>
              <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight md:text-3xl">{run.projectName || 'Workspace'}</h1>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground md:text-sm">
                This summary only shows data that is backed by the active CI workflow and the published report bundle.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:text-sm">
                <span className="inline-flex items-center gap-2"><GitBranch className="h-4 w-4" />{run.branch || 'develop'}</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />{run.duration || 'pending'}</span>
                <span className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4" />{isFetching ? 'Refreshing...' : 'Live snapshot'}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" className="rounded-full bg-white" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isFetching ? 'Refreshing' : 'Refresh'}
                </Button>
              </div>
            </div>
            <ReadinessGauge value={readiness} status={run.status} />
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Data source</p>
                <h3 className="mt-1 font-heading text-base font-bold">{sourceLabel}</h3>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sourceBody}</p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${hasRemoteRuns ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'}`}>
                {hasRemoteRuns ? 'Connected' : hasLocalRuns ? 'Fallback active' : 'Waiting for run'}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard label="Executed Tests" value={`${run.testsPassed || 0}/${run.testsTotal || 0}`} sub={`${run.testsSkipped || 0} scenarios not run`} tone="bg-violet-50/70" />
            <MetricCard label="Traceability" value={`${run.bddCovered || 0}/${run.bddTotal || 0}`} sub={`${run.bddUncovered || 0} uncovered scenarios`} tone="bg-indigo-50/70" />
            <MetricCard label="AI Scripts" value={`${aiDetails.executed || 0}/${aiDetails.generated || 0}`} sub={`${aiDetails.rejected || 0} rejected`} tone="bg-amber-50/70" />
            <MetricCard label="Frontend Journeys" value={`${frontend.passedJourneys || 0}/${frontend.totalJourneys || 0}`} sub={frontend.visual || 'No evidence'} tone="bg-emerald-50/70" />
          </div>
        </section>

        <section className="mt-7 rounded-2xl border border-white/80 bg-white/70 p-2 shadow-sm backdrop-blur-xl">
          <div className="grid gap-2 sm:grid-cols-2">
            {topTabs.map((option) => {
              const Icon = option.icon;
              const active = topTab === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTopTab(option.id)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'text-muted-foreground hover:bg-white hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7">
          {topTab === 'workspace' ? (
            <WorkspaceTab workspace={workspace} reports={reports} />
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-xl md:p-5">
                <div className="flex flex-wrap gap-2">
                  {pipelineTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPipelineTab(tab.id)}
                      className={`rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-all ${
                        pipelineTab === tab.id
                          ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                          : 'bg-white text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </section>

              {pipelineTab === 'overview' && (
                <OverviewTab run={run} pipelineJobs={pipelineJobs} reports={reports} aiDetails={aiDetails} frontend={frontend} />
              )}
              {pipelineTab === 'stages' && <StagesTab pipelineJobs={pipelineJobs} />}
              {pipelineTab === 'tests' && <TestResultsTab rows={testRows} run={run} />}
              {pipelineTab === 'traceability' && <TraceabilityTab rows={bddScenarios} run={run} />}
              {pipelineTab === 'ai' && <AiTab aiDetails={aiDetails} />}
              {pipelineTab === 'frontend' && <FrontendTab frontend={frontend} />}
              {pipelineTab === 'quality' && <QualityTab codeQuality={codeQuality} />}
              {pipelineTab === 'reports' && <ReportsTab reports={reports} />}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-bold md:text-base">Next focus</p>
                <p className="text-sm text-muted-foreground">
                  Use uncovered scenarios, AI rejections, and quality hotspots to tighten the next CI run.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}

function OverviewTab({ run, pipelineJobs, reports, aiDetails, frontend }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
        <h3 className="font-heading text-base font-bold">Primary CI workflow</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Stages" value={pipelineJobs.length} sub="Main workflow stages" tone="bg-violet-50/70" />
          <MetricCard label="Reports" value={reports.length} sub="Published report artifacts" tone="bg-emerald-50/70" />
          <MetricCard label="AI accepted" value={aiDetails.executed || 0} sub={`${aiDetails.rejected || 0} rejected`} tone="bg-amber-50/70" />
          <MetricCard label="Frontend" value={`${frontend.passedJourneys || 0}/${frontend.totalJourneys || 0}`} sub="Browser journeys passed" tone="bg-indigo-50/70" />
        </div>
      </section>
      <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Run focus</p>
        <div className="mt-4 grid gap-3">
          {[
            [Zap, 'Workflow', 'CI Pipeline', 'Only the main CI workflow is shown'],
            [TestTube2, 'Backend tests', `${run.testsPassed || 0}/${run.testsTotal || 0}`, `${run.testsSkipped || 0} scenarios not run`],
            [WandSparkles, 'Traceability', `${run.bddCovered || 0}/${run.bddTotal || 0}`, `${run.bddUncovered || 0} uncovered scenarios`],
            [Monitor, 'Frontend', frontend.visual || 'Pending', `${frontend.passedJourneys || 0}/${frontend.totalJourneys || 0} journeys passed`],
          ].map(([Icon, label, value, sub]) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                <p className="font-heading text-base font-bold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function WorkspaceTab({ workspace, reports }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Workspace Details</p>
            <h2 className="mt-2 font-heading text-xl font-bold tracking-tight md:text-2xl">Requirement payload and published evidence</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This view is limited to workspace fields that can be verified from the active manifest and published reports.
            </p>
          </div>
          <Package className="h-7 w-7 text-primary md:h-8 md:w-8" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Upload', workspace.uploadSource || 'Not selected', 'bg-violet-50'],
            ['Package', workspace.packageName || 'Pending', 'bg-fuchsia-50'],
            ['Platform', workspace.platform || 'Unknown', 'bg-indigo-50'],
            ['BRD', `${workspace.brdCount || 0} requirement file`, 'bg-emerald-50'],
            ['BDD', `${workspace.bddCount || 0} feature files`, 'bg-amber-50'],
            ['Traceability', workspace.traceabilityStatus || 'Review', 'bg-cyan-50'],
            ['Gaps', `${workspace.gapCount || 0} uncovered scenarios`, 'bg-rose-50'],
            ['Approval', workspace.approvalStatus || 'Pending review', 'bg-lime-50'],
            ['Generated', workspace.generatedAt || 'Not generated yet', 'bg-slate-50'],
          ].map(([label, value, tone]) => (
            <div key={label} className={`rounded-2xl border border-border p-4 ${tone}`}>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="font-heading text-sm font-bold md:text-base">Delivery timeline</h3>
          <div className="mt-4 space-y-3">
            {(workspace.stages || []).map((stage) => (
              <div key={stage.label} className="flex gap-3 rounded-2xl border border-border bg-white p-3">
                <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                  stage.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {stage.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{stage.label}</p>
                  <p className="text-xs text-muted-foreground">{stage.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Generated</p>
            <h3 className="mt-1 font-heading text-base font-bold md:text-lg">Workspace artifacts</h3>
          </div>
          <div className="mt-4 space-y-2">
            {(workspace.artifacts || []).map((artifact) => (
              <div key={artifact.name} className="rounded-2xl border border-border bg-white p-3">
                <p className="truncate text-sm font-semibold text-foreground">{artifact.name}</p>
                <p className="text-[11px] text-muted-foreground">{artifact.type} - {artifact.size}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm md:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">Published bundle</p>
          <h3 className="mt-1 font-heading text-base font-bold md:text-lg">Report-backed artifacts</h3>
          <div className="mt-4 space-y-3">
            {reports.slice(0, 4).map((report) => (
              <div key={report.name} className="rounded-2xl border border-amber-100 bg-white/85 p-4">
                <p className="text-sm font-semibold text-foreground">{report.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function StagesTab({ pipelineJobs }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">Pipeline stages</h3>
      <div className="mt-4 space-y-3">
        {pipelineJobs.map((job) => {
          const success = job.status !== 'failure';
          return (
            <div
              key={job.name}
              className={`rounded-2xl border p-4 ${
                success ? 'border-emerald-200 bg-emerald-50/70' : 'border-rose-200 bg-rose-50/70'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className={`h-4 w-4 ${success ? 'text-emerald-600' : 'text-rose-600'}`} />
                    <span className="font-semibold text-foreground">{job.name}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{job.summary}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-muted-foreground">{job.duration}</span>
              </div>
              {job.details?.length ? (
                <div className="mt-3 grid gap-2">
                  {job.details.map((detail) => (
                    <div key={detail} className="rounded-xl bg-white/80 px-3 py-2 text-xs text-muted-foreground">
                      {detail}
                    </div>
                  ))}
                </div>
              ) : null}
              {job.artifacts?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.artifacts.map((artifact) => (
                    <span key={artifact} className="rounded-full bg-white px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-black/5">
                      {artifact}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TestResultsTab({ rows, run }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">Test results</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Total tests" value={run.testsTotal || 0} tone="bg-violet-50/70" />
        <MetricCard label="Passed" value={run.testsPassed || 0} tone="bg-emerald-50/70" />
        <MetricCard label="Failed" value={run.testsFailed || 0} tone="bg-rose-50/70" />
        <MetricCard label="Not run" value={run.testsSkipped || 0} tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={`${row.suite}-${row.name}`} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white p-3">
            <div>
              <div className="font-semibold">{row.suite}</div>
              <div className="text-xs text-muted-foreground">{row.name}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{row.type || 'test'} - {row.source || 'report-backed'}</div>
            </div>
            <Badge variant="outline" className="text-xs">{row.status}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function TraceabilityTab({ rows, run }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">BDD traceability</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Coverage" value={`${run.bddTotal ? Math.round(((run.bddCovered || 0) / run.bddTotal) * 100) : 0}%`} tone="bg-violet-50/70" />
        <MetricCard label="Features" value={new Set(rows.map((item) => item.feature)).size} tone="bg-blue-50/70" />
        <MetricCard label="Covered" value={rows.filter((item) => item.status === 'covered').length} tone="bg-emerald-50/70" />
        <MetricCard label="Uncovered" value={rows.filter((item) => item.status !== 'covered').length} tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={`${row.feature}-${row.name}`} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-white p-3">
            <div>
              <div className="font-semibold">{row.name}</div>
              <div className="text-xs text-muted-foreground">{row.feature}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{row.scriptType || 'scenario'} - {row.executionResult || row.status}</div>
            </div>
            <Badge variant="outline" className="text-xs">{row.status}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function AiTab({ aiDetails }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">AI execution details</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Generated" value={aiDetails.generated || 0} tone="bg-violet-50/70" />
        <MetricCard label="Executed" value={aiDetails.executed || 0} tone="bg-emerald-50/70" />
        <MetricCard label="Rejected" value={aiDetails.rejected || 0} tone="bg-rose-50/70" />
        <MetricCard label="Acceptance" value={`${aiDetails.accuracy || 0}%`} tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-4 text-sm text-muted-foreground">
        <div><strong className="text-foreground">Progress:</strong> {aiDetails.progress || 'Not available'}</div>
        <div className="mt-1"><strong className="text-foreground">Mode:</strong> {aiDetails.generationMode || 'Not available'}</div>
        <div className="mt-1"><strong className="text-foreground">Fallback:</strong> {aiDetails.fallbackReason || 'None recorded'}</div>
      </div>
      <div className="mt-4 space-y-3">
        {(aiDetails.recommendations || []).map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-white p-4">
            <p className="font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FrontendTab({ frontend }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">Frontend evidence</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Visual" value={frontend.visual || 'Pending'} tone="bg-violet-50/70" />
        <MetricCard label="Journeys" value={`${frontend.passedJourneys || 0}/${frontend.totalJourneys || 0}`} tone="bg-emerald-50/70" />
        <MetricCard label="Launch mode" value={frontend.launchMode || 'Unknown'} tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-4 text-sm text-muted-foreground">
        <div><strong className="text-foreground">Detection:</strong> {frontend.detectionStatus || 'Not available'}</div>
        <div className="mt-1"><strong className="text-foreground">URL:</strong> {frontend.url || 'Not available'}</div>
        <div className="mt-1"><strong className="text-foreground">Page title:</strong> {frontend.title || 'Not available'}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(frontend.evidence || []).map((item) => (
          <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-muted-foreground">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function QualityTab({ codeQuality }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">Quality findings</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="AI tests" value={codeQuality.aiTests || 0} tone="bg-violet-50/70" />
        <MetricCard label="Existing tests" value={codeQuality.existingTests || 0} tone="bg-emerald-50/70" />
        <MetricCard label="Hotspots" value={codeQuality.hotspotCount || 0} tone="bg-amber-50/70" />
        <MetricCard label="Suggestions" value={codeQuality.improvementCount || 0} tone="bg-rose-50/70" />
      </div>
      <div className="mt-4 rounded-2xl border border-border bg-slate-50 p-4 text-sm text-muted-foreground">
        <div><strong className="text-foreground">Coverage scope:</strong> {codeQuality.coverageScope || 'Not available'}</div>
        <div className="mt-1"><strong className="text-foreground">Verdict:</strong> {codeQuality.verdict || 'Review'}</div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          {(codeQuality.hotspots || []).map((item) => (
            <div key={item.name} className="rounded-2xl border border-border bg-white p-4">
              <p className="font-semibold text-foreground">{item.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Line coverage {item.lineCoverage}% - Branch coverage {item.branchCoverage ?? 'n/a'}%
              </p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {(codeQuality.findings || []).map((item) => (
            <div key={item} className="rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground">
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ReportsTab({ reports }) {
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-base font-bold">Published reports</h3>
      <div className="mt-4 space-y-3">
        {reports.map((report) => (
          <div key={report.name} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{report.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
              </div>
              <FileBarChart className="h-5 w-5 shrink-0 text-primary" />
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              {report.type} - {report.size}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReadinessGauge({ value, status }) {
  const color = status === 'failure' ? '#f59e0b' : status === 'running' ? '#6366f1' : '#10b981';
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-24 w-24 place-items-center rounded-full md:h-28 md:w-28"
        style={{ background: `conic-gradient(${color} ${value * 3.6}deg, hsl(220 16% 92%) 0deg)` }}
      >
        <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-inner md:h-20 md:w-20">
          <span className="font-heading text-2xl font-bold md:text-3xl" style={{ color }}>{value}</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Readiness</p>
        <p className="mt-1 font-heading text-lg font-bold md:text-xl">
          {status === 'failure' ? 'Needs Review' : 'Production Ready'}
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone = 'bg-white' }) {
  return (
    <div className={`rounded-xl border border-border p-4 shadow-sm md:p-5 ${tone}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-lg font-bold text-foreground md:text-xl">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground md:text-sm">{sub}</p> : null}
    </div>
  );
}
