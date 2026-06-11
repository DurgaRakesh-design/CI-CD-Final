import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Code2,
  Download,
  ExternalLink,
  FileBarChart,
  GitBranch,
  Layers,
  Monitor,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  aiDetails,
  bddScenarios,
  codeQuality,
  frontend,
  pipelineJobs,
  reports,
  runs,
  testRows,
  workspace,
} from '@/data/dashboardData';

const topTabs = [
  { id: 'workspace', label: 'Workspace Details', icon: Layers },
  { id: 'pipeline', label: 'Pipeline Details', icon: Zap },
];

const pipelineTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'tests', label: 'Test Results' },
  { id: 'bdd', label: 'BDD Traceability' },
  { id: 'ai', label: 'AI Details' },
  { id: 'quality', label: 'Code Quality' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'reports', label: 'Reports' },
  { id: 'jobs', label: 'Pipeline' },
];

const statusTone = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  failure: 'text-rose-700 bg-rose-50 border-rose-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
};

function StatusBadge({ status }) {
  const label = status === 'failure' ? 'Needs Review' : status === 'running' ? 'Running' : 'Success';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusTone[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
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
          <span className="font-heading text-2xl font-black md:text-3xl" style={{ color }}>{value}</span>
        </div>
      </div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">Readiness</p>
        <p className="mt-1 font-heading text-lg font-black md:text-xl">
          {status === 'failure' ? 'Needs Review' : 'Production Ready'}
        </p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone = 'bg-white' }) {
  return (
    <div className={`rounded-3xl border border-border p-4 shadow-sm md:p-5 ${tone}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-2xl font-black text-foreground md:text-[28px]">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground md:text-sm">{sub}</p>
    </div>
  );
}

function WorkspaceTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-600">Workspace Details</p>
            <h2 className="mt-2 font-heading text-2xl font-black tracking-tight md:text-3xl">From upload to quality delivery</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              AI-generated requirements, BDD, gap analysis, approval, traceability, and artifacts stay together as one delivery context.
            </p>
          </div>
          <Package className="h-7 w-7 text-primary md:h-8 md:w-8" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Upload', workspace.uploadSource, 'bg-violet-50'],
            ['Package', workspace.packageName, 'bg-fuchsia-50'],
            ['Platform', workspace.platform, 'bg-indigo-50'],
            ['BRD', `${workspace.brdCount} requirements`, 'bg-emerald-50'],
            ['BDD', `${workspace.bddCount} scenarios`, 'bg-amber-50'],
            ['Traceability', workspace.traceabilityStatus, 'bg-cyan-50'],
            ['Gaps', `${workspace.gapCount} findings`, 'bg-rose-50'],
            ['Approval', workspace.approvalStatus, 'bg-lime-50'],
            ['Generated', workspace.generatedAt, 'bg-slate-50'],
          ].map(([label, value, tone]) => (
            <div key={label} className={`rounded-2xl border border-border p-4 ${tone}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="font-heading text-base font-black md:text-lg">Delivery timeline</h3>
          <div className="mt-4 space-y-3">
            {workspace.stages.map((stage) => (
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
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">Generated</p>
              <h3 className="mt-1 font-heading text-lg font-black md:text-xl">Workspace artifacts</h3>
            </div>
            <Button variant="ghost" className="rounded-full px-2 text-primary">Download all</Button>
          </div>
          <div className="mt-4 space-y-2">
            {workspace.artifacts.map((artifact) => (
              <div key={artifact.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{artifact.name}</p>
                  <p className="text-[11px] text-muted-foreground">{artifact.type} · {artifact.size}</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-amber-200 bg-amber-50/60 p-5 shadow-sm md:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-700">Next Actions</p>
          <h3 className="mt-1 font-heading text-lg font-black md:text-xl">Recommendations & notes</h3>
          <div className="mt-4 space-y-3">
            {aiDetails.recommendations.map((item) => (
              <div key={item.title} className="rounded-2xl border border-amber-100 bg-white/85 p-4">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PipelineOverviewTab({ run }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">Run #{run.runNumber}</p>
            <h2 className="mt-2 font-heading text-2xl font-black tracking-tight md:text-3xl">Pipeline execution evidence</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Deep execution summary across tests, BDD, AI, code quality, frontend evidence, reports, and pipeline jobs.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open CI
            </Button>
            <Button className="rounded-full">
              <Download className="mr-2 h-4 w-4" />
              Bundle
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <MetricCard label="Total" value={run.testsTotal} sub="Automated tests" tone="bg-violet-50/70" />
          <MetricCard label="Passed" value={run.testsPassed} sub={`${Math.round((run.testsPassed / Math.max(run.testsTotal, 1)) * 100)}% pass rate`} tone="bg-emerald-50/70" />
          <MetricCard label="Failed" value={run.testsFailed} sub="Need review" tone="bg-rose-50/70" />
          <MetricCard label="Skipped" value={run.testsSkipped} sub="Deferred" tone="bg-amber-50/70" />
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">Quality stack</p>
          <div className="mt-4 grid gap-3">
            {[
              [Bot, 'AI Coverage', `${run.coverageAi}%`, `${aiDetails.accuracy}% accuracy`],
              [Code2, 'Code Quality', codeQuality.verdict, `${codeQuality.coverage}% coverage`],
              [Monitor, 'Frontend', frontend.visual, `${frontend.accessibility}% accessibility`],
              [BarChart3, 'Reports', reports.length, 'Published artifacts'],
            ].map(([Icon, label, value, sub]) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                  <p className="font-heading text-lg font-black">{value}</p>
                  <p className="text-[11px] text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PipelineTestsTab() {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">Test Results</h3>
      <div className="mt-4 overflow-hidden rounded-3xl border border-border">
        <div className="grid grid-cols-[1fr_1.3fr_100px_80px] bg-muted/70 px-4 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          <span>Suite</span>
          <span>Test</span>
          <span>Status</span>
          <span className="text-right">Dur.</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {testRows.map((row) => (
            <div key={`${row.suite}-${row.name}`} className="grid grid-cols-[1fr_1.3fr_100px_80px] items-center border-t border-border px-4 py-3 text-sm">
              <span className="font-semibold text-foreground">{row.suite}</span>
              <span className="truncate text-muted-foreground">{row.name}</span>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ${
                row.status === 'failed'
                  ? 'bg-rose-50 text-rose-700'
                  : row.status === 'skipped'
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-emerald-50 text-emerald-700'
              }`}>
                {row.status === 'failed' ? 'Fail' : row.status}
              </span>
              <span className="text-right text-muted-foreground">{row.duration}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PipelineBddTab() {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">BDD Traceability</h3>
      <div className="mt-4 grid gap-3">
        {bddScenarios.map((scenario) => (
          <div key={`${scenario.feature}-${scenario.name}`} className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3">
            <div>
              <p className="font-semibold text-foreground">{scenario.name}</p>
              <p className="text-[11px] text-muted-foreground">{scenario.feature}</p>
            </div>
            <Badge className={`rounded-full text-[11px] ${
              scenario.status === 'covered'
                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-50'
            }`}>
              {scenario.status}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineAiTab() {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">AI Details</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <MetricCard label="Generated" value={aiDetails.generated} sub="AI assets" tone="bg-violet-50/70" />
        <MetricCard label="Executed" value={aiDetails.executed} sub="Used in pipeline" tone="bg-emerald-50/70" />
        <MetricCard label="Rejected" value={aiDetails.rejected} sub="Filtered out" tone="bg-rose-50/70" />
        <MetricCard label="Accuracy" value={`${aiDetails.accuracy}%`} sub="Model output quality" tone="bg-amber-50/70" />
      </div>
      <div className="mt-4 space-y-3">
        {aiDetails.recommendations.map((item) => (
          <div key={item.title} className="rounded-2xl border border-border bg-white p-4">
            <p className="font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineQualityTab() {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">Code Quality</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Coverage" value={`${codeQuality.coverage}%`} sub={codeQuality.verdict} tone="bg-violet-50/70" />
        <MetricCard label="Duplication" value={`${codeQuality.duplication}%`} sub="Detected" tone="bg-emerald-50/70" />
        <MetricCard label="Smells" value={codeQuality.smells} sub="Lint / maintainability" tone="bg-amber-50/70" />
        <MetricCard label="Bugs" value={codeQuality.bugs} sub="Known issues" tone="bg-rose-50/70" />
      </div>
    </section>
  );
}

function PipelineFrontendTab() {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">Frontend</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MetricCard label="Visual" value={frontend.visual} sub="Regression checks" tone="bg-violet-50/70" />
        <MetricCard label="Accessibility" value={`${frontend.accessibility}%`} sub="Audit score" tone="bg-emerald-50/70" />
        <MetricCard label="Load Time" value={frontend.loadTime} sub="Measured build" tone="bg-amber-50/70" />
      </div>
    </section>
  );
}

function PipelineReportsTab() {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">Reports</h3>
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
            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{report.type} · {report.size}</span>
              <Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-primary">Download</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineJobsTab({ run }) {
  return (
    <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
      <h3 className="font-heading text-lg font-black">Pipeline</h3>
      <div className="mt-4 space-y-3">
        {pipelineJobs.map((job) => {
          const failed = run.status === 'failure' && job.name === 'Test';
          return (
            <div
              key={job.name}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                failed ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <span className="font-semibold text-foreground">{job.name}</span>
              <span className={`text-[11px] font-black uppercase ${failed ? 'text-rose-700' : 'text-emerald-700'}`}>
                {failed ? 'Failure' : job.status} · {job.duration}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function PipelineSummary() {
  const { runNumber } = useParams();
  const run = useMemo(
    () => runs.find((item) => String(item.runNumber) === String(runNumber)) ?? runs[0],
    [runNumber]
  );
  const [topTab, setTopTab] = useState('workspace');
  const [pipelineTab, setPipelineTab] = useState('overview');
  const readiness = run.status === 'failure' ? 64 : run.status === 'running' ? 78 : 92;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_95%_97%),transparent_28rem),radial-gradient(circle_at_top_right,hsl(156_80%_96%),transparent_26rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(248_70%_98%))] pb-16 pt-24">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Button asChild variant="outline" className="mb-5 rounded-full bg-white/80 text-sm">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_90px_-50px_rgba(79,70,229,.55)] backdrop-blur-2xl md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Pipeline Summary
                </Badge>
                <StatusBadge status={run.status} />
                <Badge variant="outline" className="rounded-full text-[11px]">
                  Run #{run.runNumber} · {run.mode}
                </Badge>
              </div>
              <h1 className="mt-4 font-heading text-3xl font-black tracking-tight md:text-5xl">{run.projectName}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-[15px]">
                Run #{run.runNumber} packaged source, requirements, BDD coverage, execution evidence, and reports.
                Readiness is <span className="font-semibold text-amber-600">{run.status === 'failure' ? 'Needs Review' : 'Healthy'}</span> before promotion.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:text-sm">
                <span className="inline-flex items-center gap-2"><GitBranch className="h-4 w-4" />{run.branch}</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />{run.duration}</span>
                <span className="inline-flex items-center gap-2"><Play className="h-4 w-4" />{run.trigger}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button className="rounded-full shadow-lg shadow-primary/20">
                  <Download className="mr-2 h-4 w-4" />
                  Download Bundle
                </Button>
                <Button variant="outline" className="rounded-full bg-white">
                  <FileBarChart className="mr-2 h-4 w-4" />
                  Excel Export
                </Button>
                <Button variant="outline" className="rounded-full bg-white">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-run
                </Button>
                <Button variant="outline" className="rounded-full bg-white">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open in CI
                </Button>
              </div>
            </div>
            <ReadinessGauge value={readiness} status={run.status} />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard label="Executed Tests" value={`${run.testsPassed}/${run.testsTotal}`} sub={`${run.testsFailed} failed · ${run.testsSkipped} skipped`} tone="bg-violet-50/70" />
            <MetricCard label="BDD Coverage" value={`${Math.round((run.bddCovered / Math.max(run.bddTotal, 1)) * 100)}%`} sub={`${run.bddCovered}/${run.bddTotal} scenarios`} tone="bg-indigo-50/70" />
            <MetricCard label="Code Coverage" value={`${run.codeCoverage}%`} sub={codeQuality.verdict} tone="bg-emerald-50/70" />
            <MetricCard label="AI Coverage" value={`${run.coverageAi}%`} sub={`${aiDetails.accuracy}% accuracy`} tone="bg-amber-50/70" />
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-white/80 bg-white/70 p-2 shadow-sm backdrop-blur-xl">
          <div className="grid gap-2 sm:grid-cols-2">
            {topTabs.map((option) => {
              const Icon = option.icon;
              const active = topTab === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTopTab(option.id)}
                  className={`flex items-center justify-center gap-2 rounded-3xl px-5 py-3 text-sm font-black transition-all ${
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
            <WorkspaceTab />
          ) : (
            <div className="space-y-6">
              <section className="rounded-[2rem] border border-white/80 bg-white/90 p-4 shadow-sm backdrop-blur-xl md:p-5">
                <div className="flex flex-wrap gap-2">
                  {pipelineTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPipelineTab(tab.id)}
                      className={`rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition-all ${
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
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
                    <h3 className="font-heading text-lg font-black">Pipeline Overview</h3>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <MetricCard label="Total" value={run.testsTotal} sub="Automated tests" tone="bg-violet-50/70" />
                      <MetricCard label="Passed" value={run.testsPassed} sub="Successful execution" tone="bg-emerald-50/70" />
                      <MetricCard label="Failed" value={run.testsFailed} sub="Need review" tone="bg-rose-50/70" />
                      <MetricCard label="Skipped" value={run.testsSkipped} sub="Deferred" tone="bg-amber-50/70" />
                    </div>
                  </section>
                  <section className="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl md:p-6">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">Quality Stack</p>
                    <div className="mt-4 grid gap-3">
                      {[
                        [Bot, 'AI Coverage', `${run.coverageAi}%`, `${aiDetails.accuracy}% accuracy`],
                        [Code2, 'Code Quality', codeQuality.verdict, `${codeQuality.coverage}% coverage`],
                        [Monitor, 'Frontend', frontend.visual, `${frontend.accessibility}% accessibility`],
                        [BarChart3, 'Reports', reports.length, 'Published artifacts'],
                      ].map(([Icon, label, value, sub]) => (
                        <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                            <p className="font-heading text-lg font-black">{value}</p>
                            <p className="text-[11px] text-muted-foreground">{sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {pipelineTab === 'tests' && <PipelineTestsTab />}
              {pipelineTab === 'bdd' && <PipelineBddTab />}
              {pipelineTab === 'ai' && <PipelineAiTab />}
              {pipelineTab === 'quality' && <PipelineQualityTab />}
              {pipelineTab === 'frontend' && <PipelineFrontendTab />}
              {pipelineTab === 'reports' && <PipelineReportsTab />}
              {pipelineTab === 'jobs' && <PipelineJobsTab run={run} />}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-base font-black">Ready to promote?</p>
                <p className="text-sm text-muted-foreground">
                  Resolve failing tests and uncovered scenarios, then re-run to refresh readiness.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button className="rounded-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Trigger Re-run
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
