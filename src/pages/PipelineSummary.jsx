import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileBarChart,
  GitBranch,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { loadDashboardSnapshot } from '@/services/dashboardService';

const pipelineTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'bdd', label: 'BDD Scenarios' },
  { id: 'test-cases', label: 'Test Cases' },
  { id: 'test-scripts', label: 'Test Scripts' },
  { id: 'quality', label: 'Quality' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'reports', label: 'Reports' },
  { id: 'stages', label: 'Stages' },
];

const PAGE_SIZE = 12;

const statusTone = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  failure: 'text-rose-700 bg-rose-50 border-rose-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
};

function SummaryLoading() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_95%_97%),transparent_28rem),radial-gradient(circle_at_top_right,hsl(156_80%_96%),transparent_26rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(248_70%_98%))] pb-16 pt-16 md:pt-20">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-6">
          <div className="h-12 w-44 rounded-full bg-white/80 shadow-sm" />
          <div className="h-80 rounded-2xl bg-white/80 shadow-sm" />
          <div className="h-20 rounded-2xl bg-white/80 shadow-sm" />
          <div className="h-[720px] rounded-2xl bg-white/80 shadow-sm" />
        </div>
      </main>
    </div>
  );
}

function formatDetailedDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function PipelineSummary() {
  const { runNumber } = useParams();
  const { data: snapshot, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['dashboard-snapshot', String(runNumber || 'latest')],
    queryFn: () => loadDashboardSnapshot({ selectedRunNumber: runNumber }),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const [pipelineTab, setPipelineTab] = useState('overview');

  const run = useMemo(() => {
    const matched = (snapshot?.runs || []).find((item) => String(item.runNumber) === String(runNumber));
    return matched || snapshot?.selectedRun || snapshot?.runs?.[0] || null;
  }, [runNumber, snapshot?.runs, snapshot?.selectedRun]);

  const workspace = snapshot?.workspace || {};
  const testRows = snapshot?.testRows || [];
  const bddScenarios = snapshot?.bddScenarios || [];
  const testScripts = snapshot?.testScripts || [];
  const aiDetails = snapshot?.aiDetails || { recommendations: [] };
  const codeQuality = snapshot?.codeQuality || {};
  const frontend = snapshot?.frontend || {};
  const reports = snapshot?.reports || [];
  const pipelineJobs = run?.pipelineJobs || snapshot?.pipelineJobs || [];
  const visiblePipelineTabs = useMemo(
    () => pipelineTabs.filter((tab) => {
      if (tab.id === 'quality') {
        return Boolean((codeQuality.hotspotCount || 0) || (codeQuality.improvementCount || 0) || (codeQuality.aiTests || 0) || (codeQuality.existingTests || 0));
      }
      if (tab.id === 'frontend') {
        return Boolean((frontend.totalJourneys || 0) || (frontend.totalDesignCases || 0) || (frontend.totalTraceabilityRows || 0) || (frontend.screenshots || []).length);
      }
      if (tab.id === 'reports') {
        return reports.length > 0;
      }
      return true;
    }),
    [codeQuality, frontend, reports]
  );
  useEffect(() => {
    if (!visiblePipelineTabs.some((tab) => tab.id === pipelineTab)) {
      setPipelineTab(visiblePipelineTabs[0]?.id || 'overview');
    }
  }, [pipelineTab, visiblePipelineTabs]);

  const readiness = typeof run?.readinessScore === 'number'
    ? run.readinessScore
    : run?.status === 'failure'
      ? 64
      : run?.status === 'running'
        ? 78
        : 92;

  if (isLoading || !snapshot) {
    return <SummaryLoading />;
  }

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
          <div className="rounded-[28px] bg-[linear-gradient(135deg,rgba(79,70,229,.12),rgba(168,85,247,.08),rgba(16,185,129,.08))] p-5 md:p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 max-w-4xl flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-violet-100 px-3 py-1 text-violet-700 hover:bg-violet-100">
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
                  <Button variant="outline" className="rounded-full bg-white/90 shadow-sm" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {isFetching ? 'Refreshing' : 'Refresh'}
                  </Button>
                </div>
                <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{run.projectName || 'Workspace'}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Live CI summary backed by the selected workflow run and published evidence bundle.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500 md:text-sm">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5"><GitBranch className="h-4 w-4" />{run.branch || 'develop'}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5"><Clock className="h-4 w-4" />{run.duration || 'pending'}</span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/75 px-3 py-1.5"><BarChart3 className="h-4 w-4" />{isFetching ? 'Refreshing...' : 'Live snapshot'}</span>
                </div>
              </div>
              <ReadinessGauge value={readiness} status={run.status} covered={run.bddCovered || 0} total={run.bddTotal || 0} />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <MetricCard label="Test Cases" value={run.testsTotal || 0} sub={`${run.testsPassed || 0} passed | ${run.testsFailed || 0} failed | ${run.testsSkipped || 0} not run`} tone="bg-[linear-gradient(135deg,rgba(139,92,246,.12),rgba(99,102,241,.06))]" />
            <MetricCard label="Scenario Coverage" value={`${run.bddCovered || 0}/${run.bddTotal || 0}`} sub={`${run.bddUncovered || 0} uncovered`} tone="bg-[linear-gradient(135deg,rgba(99,102,241,.12),rgba(59,130,246,.06))]" />
            <MetricCard label="AI Test Scripts" value={`${aiDetails.executed || 0}/${aiDetails.generated || 0}`} sub="accepted / generated" tone="bg-[linear-gradient(135deg,rgba(245,158,11,.14),rgba(251,191,36,.06))]" />
            <MetricCard label="Frontend Journeys" value={`${frontend.passedJourneys || 0}/${frontend.totalJourneys || 0}`} sub={frontend.visual || 'Not detected'} tone="bg-[linear-gradient(135deg,rgba(16,185,129,.14),rgba(45,212,191,.06))]" />
            <MetricCard label="Published Reports" value={reports.length} sub="artifact files available" tone="bg-[linear-gradient(135deg,rgba(236,72,153,.12),rgba(217,70,239,.06))]" />
          </div>
        </section>

        <section className="mt-7">
          <div className="space-y-6">
            <section className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-xl md:p-5">
              <div className="flex flex-wrap gap-2">
                {visiblePipelineTabs.map((tab) => (
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

            {pipelineTab === 'overview' && <OverviewTab workspace={workspace} run={run} />}
            {pipelineTab === 'bdd' && <BddScenariosTab rows={bddScenarios} run={run} reports={reports} />}
            {pipelineTab === 'test-cases' && <TestCasesTab rows={testRows} run={run} reports={reports} />}
            {pipelineTab === 'test-scripts' && <TestScriptsTab rows={testScripts} reports={reports} />}
            {pipelineTab === 'frontend' && <FrontendTab frontend={frontend} reports={reports} />}
            {pipelineTab === 'quality' && <QualityTab codeQuality={codeQuality} reports={reports} />}
            {pipelineTab === 'reports' && <ReportsTab reports={reports} />}
            {pipelineTab === 'stages' && <StagesTab pipelineJobs={pipelineJobs} />}
          </div>
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

function OverviewTab({ workspace, run }) {
  const requirementEvidence = buildRequirementEvidence(workspace);
  return (
    <WorkflowPackagePanel workspace={workspace} evidence={requirementEvidence} run={run} />
  );
}

function WorkspaceTab({ workspace, reports }) {
  const publishedReports = Array.isArray(reports) ? reports.slice(0, 4) : [];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-violet-600">Workspace Details</p>
            <h2 className="mt-2 font-heading text-xl font-bold tracking-tight md:text-2xl">VeriSpace flow and published evidence</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This view follows the portal flow: upload or repository selection, AI/manual requirement selection, BRD/BDD generation, gap analysis, and CI evidence.
            </p>
          </div>
          <Package className="h-7 w-7 text-primary md:h-8 md:w-8" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Flow trigger', workspace.uploadSource || 'Not selected', 'bg-violet-50'],
            ['Selected package', workspace.packageName || 'Pending', 'bg-fuchsia-50'],
            ['Platform', workspace.platform || 'Unknown', 'bg-indigo-50'],
            ['BRD source', `${workspace.brdCount || 0} requirement file`, 'bg-emerald-50'],
            ['BDD scenarios', `${workspace.bddCount || 0} feature files`, 'bg-amber-50'],
            ['Traceability result', workspace.traceabilityStatus || 'Review', 'bg-cyan-50'],
            ['Gap analysis', `${workspace.gapCount || 0} uncovered scenarios`, 'bg-rose-50'],
            ['Requirement selection', workspace.approvalStatus || 'Pending review', 'bg-lime-50'],
            ['Generated at', workspace.generatedAt || 'Not generated yet', 'bg-slate-50'],
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

        {publishedReports.length ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm md:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">Published bundle</p>
            <h3 className="mt-1 font-heading text-base font-bold md:text-lg">Report-backed artifacts</h3>
            <div className="mt-4 space-y-3">
              {publishedReports.map((report) => (
                <div key={report.name} className="rounded-2xl border border-amber-100 bg-white/85 p-4">
                  <p className="text-sm font-semibold text-foreground">{report.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
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

function TestCasesTab({ rows, run, reports }) {
  const downloads = findReports(reports, [/qa-test-case-report\.xlsx$/i, /qa-test-case-report\.json$/i]);
  const { pageRows, page, totalPages, setPage } = usePagination(rows, PAGE_SIZE);
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="Detailed test cases"
        eyebrow="QA workbook evidence"
        description="Each row comes from the QA test-case report and includes scenario, steps, data, expected result, execution status, and linked script IDs when available."
        downloads={downloads}
      />
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Total tests" value={run.testsTotal || 0} tone="bg-violet-50/70" />
        <MetricCard label="Passed" value={run.testsPassed || 0} tone="bg-emerald-50/70" />
        <MetricCard label="Failed" value={run.testsFailed || 0} tone="bg-rose-50/70" />
        <MetricCard label="Not run" value={run.testsSkipped || 0} tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 space-y-2">
        {pageRows.map((row) => (
          <div key={`${row.testCaseId || row.id || row.suite}-${row.name}`} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{row.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{row.suite}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {[row.testCaseId, row.requirementId, row.scenarioId, row.type, row.priority].filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5">{item}</span>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">{row.status}</Badge>
            </div>
            {row.description ? <p className="mt-3 text-sm text-muted-foreground">{row.description}</p> : null}
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <DetailBlock label="Preconditions" value={row.preconditions} />
              <DetailBlock label="Steps" value={row.steps} />
              <DetailBlock label="Test data / expected result" value={[row.testData, row.expectedResult].filter(Boolean).join('\n')} />
            </div>
            {row.failureReason ? <div className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{row.failureReason}</div> : null}
          </div>
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} />
    </section>
  );
}

function BddScenariosTab({ rows, run, reports }) {
  const downloads = findReports(reports, [/traceability-validation-matrix\.json$/i, /requirement-traceability\.json$/i, /qa-test-case-report\.xlsx$/i]);
  const { pageRows, page, totalPages, setPage } = usePagination(rows, PAGE_SIZE);
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="Normalized BDD scenarios"
        eyebrow="Requirement coverage"
        description="Normalized BDD scenarios with requirement IDs, feature names, source files, execution status, traceability, and linked scripts."
        downloads={downloads}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Coverage" value={`${run.bddTotal ? Math.round(((run.bddCovered || 0) / run.bddTotal) * 100) : 0}%`} tone="bg-violet-50/70" />
        <MetricCard label="Features" value={new Set(rows.map((item) => item.feature)).size} tone="bg-blue-50/70" />
        <MetricCard label="Covered" value={rows.filter((item) => item.status === 'covered').length} tone="bg-emerald-50/70" />
        <MetricCard label="Uncovered" value={rows.filter((item) => item.status !== 'covered').length} tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 space-y-2">
        {pageRows.map((row) => (
          <div key={`${row.id || row.feature}-${row.name}`} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{row.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{row.feature}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {[row.requirementId, row.testCaseId, row.scriptId, row.executionResult || row.status].filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5">{item}</span>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">{row.status}</Badge>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <DetailBlock label="Source BDD" value={row.sourceBddFile || row.file} />
              <DetailBlock label="Steps" value={row.steps} />
              <DetailBlock label="Expected result / source" value={[row.expectedResult, row.coverageSource].filter(Boolean).join('\n')} />
            </div>
          </div>
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} />
    </section>
  );
}

function TestScriptsTab({ rows, reports }) {
  const downloads = findReports(reports, [/test-script-manifest\.json$/i, /^generated-tests\//i, /^test-scripts\//i, /^rejected-ai-tests\//i]).slice(0, 8);
  const { pageRows, page, totalPages, setPage } = usePagination(rows, PAGE_SIZE);
  const accepted = rows.filter((row) => /pass|accepted|success/i.test(row.status || row.result || '')).length;
  const rejected = rows.filter((row) => /reject|fail|error/i.test(row.status || row.result || '')).length;
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="Generated test scripts"
        eyebrow="Script manifest"
        description="Script-level details from the manifest: file, Java class, method, linked scenario, status, duration, and failure reason."
        downloads={downloads}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Scripts" value={rows.length} tone="bg-violet-50/70" />
        <MetricCard label="Accepted / passed" value={accepted} tone="bg-emerald-50/70" />
        <MetricCard label="Rejected / failed" value={rejected} tone="bg-rose-50/70" />
      </div>
      <div className="mt-4 space-y-2">
        {pageRows.map((row) => (
          <div key={`${row.id}-${row.file}`} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold">{row.className || row.file || row.scriptId}</div>
                <div className="mt-1 break-words text-xs text-muted-foreground">{row.file}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {[row.scriptId, row.testCaseId, row.scenarioId, row.scriptType].filter(Boolean).map((item) => (
                    <span key={item} className="rounded-full bg-slate-100 px-2 py-0.5">{item}</span>
                  ))}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">{row.status}</Badge>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <DetailBlock label="Feature / scenario" value={[row.feature, row.scenario].filter(Boolean).join('\n')} />
              <DetailBlock label="Java method" value={[row.packageName, row.methodName, row.qualifiedName].filter(Boolean).join('\n')} />
              <DetailBlock label="Execution" value={[row.result, row.duration, row.failureReason].filter(Boolean).join('\n')} />
            </div>
          </div>
        ))}
      </div>
      <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} />
    </section>
  );
}

function AiTab({ aiDetails, reports }) {
  const downloads = findReports(reports, [/GeneratedTestMeta\.json$/i, /GeneratedTestTraceability\.json$/i, /test-script-manifest\.json$/i, /^generated-tests\//i, /^rejected-ai-tests\//i]).slice(0, 10);
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="AI execution details"
        eyebrow="Generated script lifecycle"
        description="This tab only shows AI generation, accepted/rejected scripts, and related metadata from the report bundle."
        downloads={downloads}
      />
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
      {aiDetails.rejectionDetails?.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {aiDetails.rejectionDetails.map((item) => (
            <div key={`${item.file}-${item.scenario}`} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
              <p className="text-sm font-semibold text-foreground">{item.scenario || item.file}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.file}</p>
              <p className="mt-2 text-xs text-rose-700">{item.reason || 'Rejected during validation'}</p>
            </div>
          ))}
        </div>
      ) : null}
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

function FrontendTab({ frontend, reports }) {
  const downloads = findReports(reports, [
    /frontend-quality-summary/i,
    /frontend-test-design/i,
    /frontend-journey-suggestions/i,
    /frontend-traceability/i,
    /frontend-smoke-report/i,
    /browser-smoke-report/i,
  ]);
  const [journeyFilter, setJourneyFilter] = useState('all');
  const [caseFilter, setCaseFilter] = useState('all');
  const filteredJourneys = useMemo(() => {
    const journeys = Array.isArray(frontend.journeys) ? frontend.journeys : [];
    if (journeyFilter === 'passing') return journeys.filter((item) => item.status === 'pass');
    if (journeyFilter === 'failing') return journeys.filter((item) => item.status === 'fail');
    return journeys;
  }, [frontend.journeys, journeyFilter]);
  const mergedCases = useMemo(() => mergeFrontendCases(frontend), [frontend]);
  const filteredCases = useMemo(() => {
    if (caseFilter === 'generated') return mergedCases.filter((item) => item.linkedJourneys.length > 0);
    if (caseFilter === 'missing') return mergedCases.filter((item) => item.linkedJourneys.length === 0);
    return mergedCases;
  }, [caseFilter, mergedCases]);
  const { pageRows: pagedJourneys, page: journeyPage, totalPages: journeyPages, setPage: setJourneyPage } = usePagination(filteredJourneys, 4);
  const { pageRows: pagedCases, page: casePage, totalPages: casePages, setPage: setCasePage } = usePagination(filteredCases, 6);
  const phaseCards = [
    {
      label: 'Frontend test cases',
      value: frontend.designSummary?.total_cases ?? frontend.designCases?.length ?? 0,
      sub: `${frontend.designSummary?.frontend_executable_cases ?? 0} selected as UI-automatable`,
      tone: 'bg-[linear-gradient(135deg,rgba(99,102,241,.12),rgba(79,70,229,.06))]',
    },
    {
      label: 'Journeys generated',
      value: frontend.journeySummary?.suggested_journeys ?? frontend.suggestedJourneys?.length ?? 0,
      sub: `${mergedCases.filter((item) => item.linkedJourneys.length > 0).length} cases linked to a journey`,
      tone: 'bg-[linear-gradient(135deg,rgba(168,85,247,.12),rgba(217,70,239,.06))]',
    },
    {
      label: 'Journeys executed',
      value: `${frontend.passedJourneys || 0}/${frontend.totalJourneys || 0}`,
      sub: `${frontend.failedJourneys || 0} failed, ${frontend.skippedJourneys || 0} skipped`,
      tone: 'bg-[linear-gradient(135deg,rgba(45,212,191,.14),rgba(16,185,129,.06))]',
    },
    {
      label: 'Screenshots captured',
      value: frontend.screenshotGallery?.length ?? 0,
      sub: 'Visual proof attached to executed journey steps',
      tone: 'bg-[linear-gradient(135deg,rgba(245,158,11,.14),rgba(251,191,36,.06))]',
    },
  ];
  const frontendArtifacts = (frontend.frontendArtifactFiles || []).slice(0, 12);
  const journeyFilters = [
    ['all', 'All journeys'],
    ['passing', 'Passing'],
    ['failing', 'Failing'],
  ];
  const caseFilters = [
    ['all', 'All cases'],
    ['generated', 'Journey generated'],
    ['missing', 'Not generated'],
  ];
  const executionNote = summarizeExecutionNote(frontend.executionReason);

  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="Frontend quality"
        eyebrow="Test cases, journeys, and screenshots"
        description="This tab keeps the frontend story simple: what UI cases were identified, which Selenium journeys were generated, how they executed, and what screenshots were captured."
        downloads={downloads}
      />
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <div className="rounded-[28px] border border-violet-100 bg-[linear-gradient(135deg,rgba(238,242,255,.98),rgba(255,255,255,.96),rgba(236,253,245,.92))] p-5 shadow-[0_24px_80px_-54px_rgba(79,70,229,.48)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${frontendVisualTone(frontend.visual)}`}>
                  {frontend.visual || 'Pending'}
                </span>
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {frontend.applicationName || 'Frontend application'}
                </Badge>
              </div>
              <h4 className="mt-3 font-heading text-xl font-bold tracking-tight text-slate-950">
                Frontend automation summary
              </h4>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Use this view to review UI-facing test cases, the Selenium journeys created for them, and the execution proof attached to each journey.
              </p>
            </div>
            <div className="grid min-w-[180px] gap-2 rounded-2xl bg-white/80 p-3 ring-1 ring-violet-100">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Execution status</p>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-2xl font-bold text-foreground">{frontend.passedJourneys || 0}</span>
                <span className="text-xs text-muted-foreground">passed</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {frontend.failedJourneys || 0} failed, {frontend.skippedJourneys || 0} skipped
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {phaseCards.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} sub={item.sub} tone={item.tone} />
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-border bg-white/95 p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Execution context</p>
          <div className="mt-4 space-y-3">
            {[
              ['Detection', frontend.detectionStatus || 'Not available'],
              ['Launch mode', frontend.launchMode || 'Not available'],
              ['Journey source', frontend.journeyMode || 'Not available'],
              ['Runtime config', frontend.autoGeneratedConfigUsed ? 'Auto-generated for this run' : frontend.configured ? 'Config file provided' : 'Not recorded'],
              ['URL', frontend.url || 'Not available'],
              ['Page title', frontend.title || 'Not available'],
              ['Config path', frontend.configPath || 'Not recorded'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-1 break-words text-xs font-medium leading-5 text-foreground">{value}</p>
              </div>
            ))}
          </div>
          {executionNote ? (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800">Execution note</p>
              <p className="mt-1 text-xs leading-5 text-amber-900">{executionNote}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Journey explorer</p>
              <h4 className="mt-1 font-heading text-base font-bold">Executable UI flows</h4>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Review every generated journey with all recorded steps and its related screenshots.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {journeyFilters.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setJourneyFilter(value);
                    setJourneyPage(1);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${journeyFilter === value ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-muted-foreground hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {pagedJourneys.length ? pagedJourneys.map((journey) => (
              <div key={journey.slug || journey.name} className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.94))] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{journey.name}</p>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${frontendStatusTone(journey.status)}`}>
                        {journey.status || 'unknown'}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{journey.description || 'No journey description recorded.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {[journey.start_path, `${(journey.steps || []).length} steps`, ...(journey.linkedTestCaseIds || [])].filter(Boolean).map((item) => (
                        <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-[160px] rounded-2xl bg-slate-50 p-3 ring-1 ring-border">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Execution</p>
                    <p className="mt-1 text-xs leading-5 text-foreground">
                      {(journey.steps || []).filter((step) => step.status === 'pass').length} step pass
                      {' · '}
                      {(journey.steps || []).filter((step) => step.status === 'fail').length} step fail
                    </p>
                    {journey.failure_message ? (
                      <p className="mt-2 text-xs leading-5 text-rose-700">{summarizeExecutionNote(journey.failure_message)}</p>
                    ) : null}
                  </div>
                </div>

                {(journey.steps || []).length ? (
                  <div className="mt-4 grid gap-2">
                    {(journey.steps || []).map((step, index) => (
                      <div key={`${journey.slug || journey.name}-${step.name || index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/90 px-3 py-2 ring-1 ring-border">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-foreground">{step.name || `Step ${index + 1}`}</p>
                          <p className="mt-0.5 break-words text-[11px] text-muted-foreground">{step.message || step.type || 'No step message recorded'}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${frontendStatusTone(step.status)}`}>
                            {step.status || 'pending'}
                          </span>
                          {step.screenshot ? <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground">shot</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {journey.screenshots?.length ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {journey.screenshots.map((shot) => (
                      <ScreenshotPreviewCard key={`${journey.slug || journey.name}-${shot.name}-${shot.stepName}`} item={shot} />
                    ))}
                  </div>
                ) : null}
              </div>
            )) : (
              <EmptyStateCard message="No frontend journeys matched the selected filter." />
            )}
          </div>
          <PaginationControls page={journeyPage} totalPages={journeyPages} onPageChange={setJourneyPage} totalItems={filteredJourneys.length} />
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Frontend artifacts</p>
          <h4 className="mt-1 font-heading text-base font-bold">Published bundle files</h4>
          <div className="mt-4 space-y-2">
            {frontendArtifacts.length ? frontendArtifacts.map((file) => (
              <div key={file.name} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-border">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{file.name.split('/').pop()}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{file.desc}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <ReportDownloadButton report={file} compact />
                </div>
              </div>
            )) : (
              <EmptyStateCard message="No dedicated frontend artifact files were found in the report bundle." />
            )}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Frontend test cases</p>
              <h4 className="mt-1 font-heading text-base font-bold">Cases linked to generated journeys</h4>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Each row shows the UI-focused test case, its linked BDD scenario, generated journey status, and any available reason when a journey was not created.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {caseFilters.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCaseFilter(value);
                    setCasePage(1);
                  }}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition ${caseFilter === value ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-muted-foreground hover:bg-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pagedCases.length ? pagedCases.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.94))] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.testCaseId} · {item.module || 'Module not recorded'}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {[item.priority, item.scenarioType, item.recommendedPath].filter(Boolean).map((chip) => (
                        <span key={chip} className="rounded-full bg-slate-100 px-2.5 py-1">{chip}</span>
                      ))}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${frontendCoverageTone(item.status)}`}>
                    {item.statusLabel}
                  </span>
                </div>
                {item.businessGoal ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.businessGoal}</p> : null}
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <DetailBlock label="Linked BDD scenario" value={item.linkedBddScenario} />
                  <DetailBlock label="Linked journey" value={item.linkedJourneys.length ? item.linkedJourneys : ['Not generated']} />
                  <DetailBlock label="Reason / notes" value={item.reason} />
                </div>
              </div>
            )) : (
              <EmptyStateCard message="No frontend test cases matched the selected filter." />
            )}
          </div>
          <PaginationControls page={casePage} totalPages={casePages} onPageChange={setCasePage} totalItems={filteredCases.length} />
        </section>
      </div>
    </section>
  );
}
function ScreenshotPreviewCard({ item }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group overflow-hidden rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,250,252,.94))] text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="aspect-[16/10] overflow-hidden bg-slate-100">
            {item.viewHref ? (
              <img
                src={item.viewHref}
                alt={`${item.journeyName} ${item.stepName}`}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
            ) : (
              <div className="grid h-full place-items-center text-xs text-muted-foreground">Preview not available</div>
            )}
          </div>
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{item.journeyName}</p>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">{item.stepName}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${frontendStatusTone(item.status)}`}>
                {item.status || 'unknown'}
              </span>
            </div>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl border-white/80 bg-white/98 p-4 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>{item.journeyName}</DialogTitle>
          <DialogDescription>
            {item.stepName} {item.stepType ? `· ${item.stepType}` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-hidden rounded-2xl border border-border bg-slate-50">
          {item.viewHref ? (
            <img src={item.viewHref} alt={`${item.journeyName} ${item.stepName}`} className="max-h-[75vh] w-full object-contain" />
          ) : (
            <div className="grid min-h-[320px] place-items-center text-sm text-muted-foreground">Preview not available</div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">{item.reportName || item.name}</div>
          <div className="flex gap-2">
            {item.viewHref ? (
              <Button asChild variant="outline" size="sm" className="rounded-full bg-white">
                <a href={item.viewHref} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  Open
                </a>
              </Button>
            ) : null}
            {item.downloadHref ? (
              <Button asChild variant="outline" size="sm" className="rounded-full bg-white">
                <a href={item.downloadHref} download={item.name}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyStateCard({ message }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function summarizeExecutionNote(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= 220) return text;
  return `${text.slice(0, 217)}...`;
}

function mergeFrontendCases(frontend) {
  const designCases = Array.isArray(frontend?.designCases) ? frontend.designCases : [];
  const traceabilityRecords = Array.isArray(frontend?.traceabilityRecords) ? frontend.traceabilityRecords : [];
  const traceabilityById = new Map();
  const traceabilityByTitle = new Map();

  for (const row of traceabilityRecords) {
    const idKey = String(row?.test_case_id || row?.testCaseId || '').trim().toLowerCase();
    const titleKey = String(row?.title || row?.name || '').trim().toLowerCase();
    if (idKey && !traceabilityById.has(idKey)) traceabilityById.set(idKey, row);
    if (titleKey && !traceabilityByTitle.has(titleKey)) traceabilityByTitle.set(titleKey, row);
  }

  return designCases.map((item, index) => {
    const id = String(item?.test_case_id || item?.testCaseId || `frontend-case-${index + 1}`);
    const title = item?.title || item?.name || id;
    const trace = traceabilityById.get(id.toLowerCase()) || traceabilityByTitle.get(String(title).trim().toLowerCase()) || null;
    const linkedJourneys = Array.isArray(trace?.linked_journey_names)
      ? trace.linked_journey_names.filter(Boolean)
      : [];
    const status = linkedJourneys.length
      ? 'covered'
      : String(trace?.coverage_status || trace?.status || 'missing').toLowerCase();
    const linkedBddScenario = Array.isArray(item?.linked_bdd_scenarios) && item.linked_bdd_scenarios.length
      ? item.linked_bdd_scenarios.join('\n')
      : item?.bdd_scenario
        || item?.bddScenario
        || item?.scenario_title
        || item?.scenario_name
        || 'Not recorded';
    const reason = trace?.reason
      || trace?.notes
      || item?.notes
      || (linkedJourneys.length ? 'Journey generated for this test case.' : 'Not generated');

    return {
      id,
      title,
      testCaseId: id,
      module: item?.module || trace?.module || '',
      priority: item?.priority || '',
      scenarioType: item?.scenario_type || item?.scenarioType || '',
      recommendedPath: item?.recommended_start_path || trace?.recommended_start_path || '',
      businessGoal: item?.business_goal || '',
      linkedBddScenario,
      linkedJourneys,
      status,
      statusLabel: linkedJourneys.length ? 'Journey generated' : 'Not generated',
      reason,
    };
  });
}

function frontendVisualTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pass' || normalized === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'fail' || normalized === 'failure') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function frontendStatusTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pass' || normalized === 'success') return 'bg-emerald-50 text-emerald-700';
  if (normalized === 'fail' || normalized === 'failure' || normalized === 'error') return 'bg-rose-50 text-rose-700';
  if (normalized === 'skip' || normalized === 'skipped') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function frontendScopeTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'frontend-executable') return 'bg-emerald-50 text-emerald-700';
  if (normalized === 'manual-review') return 'bg-amber-50 text-amber-700';
  if (normalized === 'backend-only') return 'bg-slate-100 text-slate-600';
  return 'bg-violet-50 text-violet-700';
}

function frontendCoverageTone(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'covered') return 'bg-emerald-50 text-emerald-700';
  if (normalized.includes('without') || normalized.includes('missing') || normalized.includes('unmapped')) return 'bg-rose-50 text-rose-700';
  return 'bg-amber-50 text-amber-700';
}

function QualityTab({ codeQuality, reports }) {
  const downloads = findReports(reports, [/coverage-gap-analysis\.json$/i, /code-improvement-suggestions\.json$/i, /qa-test-case-report\.xlsx$/i]);
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="Quality findings"
        eyebrow="Coverage gaps and suggestions"
        description="Coverage hotspots and improvement suggestions come from their own quality files, not from AI or traceability tabs."
        downloads={downloads}
      />
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
  const groups = groupReports(reports);
  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <TabHeader
        title="Reports and downloads"
        eyebrow="Published artifact bundle"
        description="Reports are grouped by purpose. Use the complete quality bundle for handoff, or download focused report groups/files as needed."
        downloads={reports.filter((report) => report.bundle || /qa-test-case-report\.xlsx$|final-test-report\.html$/i.test(report.name || '')).slice(0, 3)}
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-heading text-sm font-bold text-foreground">{group.title}</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {group.files.length} file{group.files.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {group.files.slice(0, 8).map((report) => (
                <div key={report.name} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-border">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{report.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{report.type} - {report.size}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <ReportDownloadButton report={report} compact />
                    <FileBarChart className="h-5 w-5 text-primary" />
                  </div>
                </div>
              ))}
              {group.files.length > 8 ? (
                <p className="text-xs text-muted-foreground">Showing 8 of {group.files.length} files. Download the complete bundle for all files.</p>
              ) : null}
              {!group.files.length ? (
                <div className="rounded-xl border border-dashed border-border bg-slate-50 px-3 py-3 text-xs text-muted-foreground">
                  No files published for this group.
                </div>
              ) : null}
              </div>
            </div>
        ))}
      </div>
    </section>
  );
}

function WorkflowPackagePanel({ workspace, evidence, run }) {
  const packageArtifact = evidence.packageArtifact;
  const manifestArtifact = evidence.manifestArtifact;
  const gapStatus = workspace.gapAnalysisPath ? 'Run and attached' : 'Skipped or not attached';
  const triggeredAt = formatDetailedDateTime(run?.createdAt || workspace.generatedAt);
  const detailRows = [
    ['Package source', workspace.uploadSource || 'Not recorded'],
    ['Selected package', workspace.packageName || 'Not recorded'],
    ['Requirements used', workspace.approvalStatus || 'Not recorded'],
    ['Gap analysis', gapStatus],
    ['Triggered at', triggeredAt],
    ['Platform', workspace.platform || 'Unknown'],
    ['Requirement root', workspace.requirementRoot || 'Not recorded'],
    ['Package path', workspace.packagePath || packageArtifact?.path || 'Not recorded'],
    ['Manifest', workspace.manifestPath || 'Not recorded'],
  ];

  return (
    <section className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_24px_80px_-54px_rgba(79,70,229,.45)] backdrop-blur-xl md:p-6">
      <TabHeader
        title="Workflow package and requirements"
        eyebrow="Actual VeriSpace selections"
        description="This overview shows the package source, requirement selection, gap-analysis usage, and the exact BRD and BDD files attached to this run."
      />
      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-violet-100 bg-[linear-gradient(180deg,rgba(245,243,255,.95),rgba(255,255,255,.95))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Package details</p>
              <h4 className="mt-2 font-heading text-lg font-bold text-foreground">{workspace.packageName || 'Selected package'}</h4>
            </div>
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-4 space-y-2">
            {detailRows.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white px-3 py-2 ring-1 ring-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-1 break-words text-xs font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {manifestArtifact ? (
              <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Manifest file</p>
                <p className="mt-1 break-words text-xs font-medium text-foreground">{manifestArtifact.path || manifestArtifact.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <EvidenceActionButtons item={manifestArtifact} />
                </div>
              </div>
            ) : null}
            {packageArtifact ? (
              <div className="rounded-xl bg-white px-3 py-3 ring-1 ring-border">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Package file</p>
                <p className="mt-1 break-words text-xs font-medium text-foreground">{packageArtifact.path || packageArtifact.name}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <EvidenceActionButtons item={packageArtifact} />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <RequirementFileGroup title="BRD" description="Business requirement document selected for this workflow." items={evidence.brd} empty="No BRD file was recorded in the manifest." tone="border-emerald-100 bg-[linear-gradient(180deg,rgba(236,253,245,.8),rgba(255,255,255,.96))]" />
          <RequirementFileGroup title="BDD feature files" description="Feature files generated or selected for the workflow." items={evidence.bdds} empty="No BDD feature files were recorded in the manifest." pageSize={5} tone="border-indigo-100 bg-[linear-gradient(180deg,rgba(238,242,255,.84),rgba(255,255,255,.96))]" />
          <RequirementFileGroup title="Gap analysis" description="Requirement gap analysis attached to the selected workflow." items={evidence.gaps} empty="No gap analysis report was attached to this workflow." tone="border-amber-100 bg-[linear-gradient(180deg,rgba(255,251,235,.84),rgba(255,255,255,.96))]" />
        </div>
      </div>
    </section>
  );
}

function RequirementFileGroup({ title, description, items, empty, tone = 'border-border bg-white', pageSize = PAGE_SIZE }) {
  const { pageRows, page, totalPages, setPage } = usePagination(items, pageSize);
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-heading text-sm font-bold text-foreground">{title}</h4>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {items.length} file{items.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length ? pageRows.map((item) => <RequirementFileRow key={`${item.type}-${item.name}-${item.path}`} item={item} />) : (
          <div className="rounded-xl border border-dashed border-border bg-slate-50 px-3 py-3 text-xs text-muted-foreground">
            {empty}
          </div>
        )}
      </div>
      {items.length > pageSize ? <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={items.length} /> : null}
    </div>
  );
}

function RequirementFileRow({ item }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-slate-50/70 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{item.path || item.size}</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <EvidenceActionButtons item={item} />
      </div>
    </div>
  );
}

function EvidenceActionButtons({ item }) {
  return (
    <>
      {item.viewHref ? (
        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3">
          <a href={item.viewHref} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View
          </a>
        </Button>
      ) : null}
      {item.downloadHref ? (
        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg bg-white px-3">
          <a href={item.downloadHref} download={item.downloadName || item.name}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download
          </a>
        </Button>
      ) : null}
    </>
  );
}

function DetailBlock({ label, value }) {
  const display = Array.isArray(value) ? value.filter(Boolean).join('\n') : value;
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 ring-1 ring-border">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 whitespace-pre-line break-words text-xs leading-5 text-foreground">{display || 'Not recorded'}</p>
    </div>
  );
}

function PaginationControls({ page, totalPages, onPageChange, totalItems }) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages} · {totalItems} total
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="h-8 rounded-lg" disabled={page <= 1} onClick={() => onPageChange((value) => Math.max(1, value - 1))}>
          Prev
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-lg" disabled={page >= totalPages} onClick={() => onPageChange((value) => Math.min(totalPages, value + 1))}>
          Next
        </Button>
      </div>
    </div>
  );
}

function usePagination(rows, pageSize) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil((rows?.length || 0) / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = (rows || []).slice((safePage - 1) * pageSize, safePage * pageSize);
  return { pageRows, page: safePage, totalPages, setPage };
}

function TabHeader({ title, eyebrow, description, downloads = [] }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p> : null}
        <h3 className="mt-1 font-heading text-base font-bold md:text-lg">{title}</h3>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {downloads.length ? (
        <div className="flex flex-wrap gap-2 md:justify-end">
          {downloads.slice(0, 4).map((report) => (
            <ReportDownloadButton key={report.name} report={report} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReportDownloadButton({ report, compact = false }) {
  if (!report?.downloadHref) return null;
  return (
    <Button asChild variant="outline" size="sm" className={`${compact ? 'h-8 px-2' : 'rounded-full'} bg-white`}>
      <a href={report.downloadHref} download={report.downloadName || report.name}>
        <Download className={`${compact ? 'mr-0' : 'mr-2'} h-3.5 w-3.5`} />
        {compact ? <span className="sr-only">Download {report.name}</span> : `Download ${shortReportLabel(report.name)}`}
      </a>
    </Button>
  );
}

function findReports(reports, patterns) {
  const list = Array.isArray(reports) ? reports : [];
  return list.filter((report) => patterns.some((pattern) => pattern.test(String(report?.name || ''))));
}

function buildRequirementEvidence(workspace) {
  const artifacts = Array.isArray(workspace?.artifacts) ? workspace.artifacts : [];
  return {
    manifestArtifact: artifacts.find((artifact) => artifact.type === 'Manifest') || null,
    packageArtifact: artifacts.find((artifact) => artifact.type === 'Package') || null,
    brd: artifacts.filter((artifact) => artifact.type === 'BRD'),
    bdds: artifacts.filter((artifact) => artifact.type === 'BDD'),
    gaps: artifacts.filter((artifact) => artifact.type === 'Gap analysis'),
  };
}

function groupReports(reports) {
  const list = Array.isArray(reports) ? reports : [];
  const groups = [
    {
      title: 'Complete quality bundle',
      description: 'Full GitHub Actions artifact bundle for offline handoff.',
      test: (name, report) => report.bundle || /quality-reports.*\.zip$/i.test(name),
    },
    {
      title: 'Executive and QA reports',
      description: 'Human-readable QA workbook and final HTML summary.',
      test: (name) => /qa-test-case-report\.xlsx$|final-test-report\.html$/i.test(name),
    },
    {
      title: 'Traceability reports',
      description: 'Requirement, BDD, scenario, test case, and script mapping files.',
      test: (name) => /traceability|requirement-traceability/i.test(name),
    },
    {
      title: 'AI generation reports',
      description: 'AI generation metadata, capability maps, normalized requirements, and rejected attempts.',
      test: (name) => /^ai-generation\//i.test(name) || /GeneratedTest|NormalizedRequirements|CodeCapabilityMap|ScriptGenerationFailures/i.test(name),
    },
    {
      title: 'Quality analysis reports',
      description: 'Coverage gaps, improvement suggestions, build logs, and quality signals.',
      test: (name) => /coverage-gap-analysis|code-improvement-suggestions|maven-test-output/i.test(name),
    },
    {
      title: 'Generated and copied scripts',
      description: 'Accepted, rejected, and copied Java test scripts from the artifact bundle.',
      test: (name) => /^(generated-tests|test-scripts|rejected-ai-tests)\//i.test(name),
    },
    {
      title: 'Frontend evidence',
      description: 'Browser smoke reports, screenshots, and frontend journey evidence.',
      test: (name) => /^frontend\//i.test(name) || /frontend-smoke|browser-smoke/i.test(name),
    },
  ];

  const grouped = groups.map((group) => ({
    ...group,
    files: list.filter((report) => group.test(String(report.name || ''), report)),
  }));
  const groupedNames = new Set(grouped.flatMap((group) => group.files.map((file) => file.name)));
  const other = list.filter((report) => !groupedNames.has(report.name));
  if (other.length) {
    grouped.push({
      title: 'Other published files',
      description: 'Additional raw files available in the artifact bundle.',
      files: other,
    });
  }
  return grouped.filter((group) => group.files.length);
}

function shortReportLabel(name) {
  const value = String(name || '').split('/').pop() || 'file';
  if (value.length <= 24) return value;
  return `${value.slice(0, 18)}...${value.split('.').pop() || ''}`;
}

function ReadinessGauge({ value, status, covered = 0, total = 0 }) {
  const color = status === 'failure' ? '#f59e0b' : status === 'running' ? '#6366f1' : '#10b981';
  return (
    <div className="rounded-3xl bg-white/80 p-4 shadow-sm">
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
        <p className="mt-2 max-w-[220px] text-xs leading-5 text-muted-foreground">
          Calculated from scenario coverage: {covered} covered of {total || 0} total scenarios.
        </p>
      </div>
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

