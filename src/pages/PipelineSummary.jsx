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
  FileText,
  GitBranch,
  Layers,
  Monitor,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
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

const tabOptions = [
  { id: 'workspace', label: 'Workspace Details', icon: Layers },
  { id: 'pipeline', label: 'Pipeline Details', icon: ActivityIcon },
];

function ActivityIcon(props) {
  return <Zap {...props} />;
}

const statusTone = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  failure: 'text-rose-700 bg-rose-50 border-rose-200',
  running: 'text-blue-700 bg-blue-50 border-blue-200',
};

function StatusBadge({ status }) {
  const label = status === 'failure' ? 'Needs Review' : status === 'running' ? 'Running' : 'Success';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase ${statusTone[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function ReadinessGauge({ value, status }) {
  const color = status === 'failure' ? '#f59e0b' : status === 'running' ? '#6366f1' : '#10b981';
  return (
    <div className="flex items-center gap-5">
      <div
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${value * 3.6}deg, hsl(220 16% 92%) 0deg)` }}
      >
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white shadow-inner">
          <span className="font-heading text-3xl font-black" style={{ color }}>{value}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Readiness</p>
        <p className="mt-1 font-heading text-xl font-black">{status === 'failure' ? 'Needs Review' : 'Production Ready'}</p>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, tone = 'bg-white' }) {
  return (
    <div className={`rounded-3xl border border-border p-5 shadow-sm ${tone}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-3 font-heading text-3xl font-black text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function WorkspaceTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-600">VerSpace Details</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">From upload to quality delivery</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              This view keeps the AI-generated BRD, BDD, gap analysis, approval status, traceability, and artifacts together
              so the pipeline run always has business context.
            </p>
          </div>
          <Package className="h-8 w-8 text-primary" />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Upload', workspace.uploadSource],
            ['Package', workspace.packageName],
            ['Platform', workspace.platform],
            ['BRD', `${workspace.brdCount} requirements`],
            ['BDD', `${workspace.bddCount} scenarios`],
            ['Traceability', workspace.traceabilityStatus],
            ['Gaps', `${workspace.gapCount} findings`],
            ['Approval', workspace.approvalStatus],
            ['Generated', workspace.generatedAt],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-gradient-to-br from-white to-muted/40 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
              <p className="mt-2 font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <h3 className="font-heading text-lg font-black">Delivery timeline</h3>
          <div className="mt-4 space-y-4">
            {workspace.stages.map((stage, index) => (
              <div key={stage.label} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`grid h-9 w-9 place-items-center rounded-full ${
                    stage.status === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {stage.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  {index < workspace.stages.length - 1 && <div className="h-full w-px bg-border" />}
                </div>
                <div className="pb-4">
                  <p className="font-bold text-foreground">{stage.label}</p>
                  <p className="text-sm text-muted-foreground">{stage.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Generated</p>
              <h3 className="mt-1 font-heading text-xl font-black">Workspace artifacts</h3>
            </div>
            <Button variant="ghost" className="rounded-full text-primary">Download all</Button>
          </div>
          <div className="mt-5 space-y-3">
            {workspace.artifacts.map((artifact) => (
              <div key={artifact.name} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-700">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{artifact.name}</p>
                    <p className="text-xs text-muted-foreground">{artifact.type} · {artifact.size}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-amber-200 bg-amber-50/60 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Next Actions</p>
          <h3 className="mt-2 font-heading text-xl font-black">Recommendations & notes</h3>
          <div className="mt-5 space-y-3">
            {aiDetails.recommendations.map((item) => (
              <div key={item.title} className="rounded-2xl border border-amber-100 bg-white/80 p-4">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PipelineTab({ run }) {
  const passRate = Math.round((run.testsPassed / Math.max(run.testsTotal, 1)) * 100);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Run #{run.runNumber}</p>
            <h2 className="mt-2 font-heading text-3xl font-black tracking-tight">Pipeline execution evidence</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Execution metrics, BDD traceability, AI details, code quality, frontend evidence, reports, and pipeline jobs.
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

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <MetricCard label="Total" value={run.testsTotal} sub="Automated tests" tone="bg-violet-50/70" />
          <MetricCard label="Passed" value={run.testsPassed} sub={`${passRate}% pass rate`} tone="bg-emerald-50/70" />
          <MetricCard label="Failed" value={run.testsFailed} sub="Need review" tone="bg-rose-50/70" />
          <MetricCard label="Skipped" value={run.testsSkipped} sub="Deferred" tone="bg-amber-50/70" />
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-border">
          <div className="grid grid-cols-[1fr_1.3fr_100px_80px] bg-muted/70 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">
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
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold ${
                  row.status === 'failed'
                    ? 'bg-rose-50 text-rose-700'
                    : row.status === 'skipped'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {row.status === 'failed' ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {row.status}
                </span>
                <span className="text-right text-muted-foreground">{row.duration}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-border bg-secondary/60 p-5">
          <h3 className="font-heading text-lg font-black">BDD traceability</h3>
          <div className="mt-4 grid gap-3">
            {bddScenarios.map((scenario) => (
              <div key={`${scenario.feature}-${scenario.name}`} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3">
                <div>
                  <p className="font-semibold text-foreground">{scenario.name}</p>
                  <p className="text-xs text-muted-foreground">{scenario.feature}</p>
                </div>
                <Badge className={`rounded-full ${
                  scenario.status === 'covered'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-50'
                }`}>
                  {scenario.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Quality Stack</p>
          <div className="mt-5 grid gap-3">
            {[
              [Bot, 'AI Coverage', `${run.coverageAi}%`, `${aiDetails.accuracy}% accuracy`],
              [Code2, 'Code Quality', codeQuality.verdict, `${codeQuality.coverage}% coverage`],
              [Monitor, 'Frontend', frontend.visual, `${frontend.accessibility}% accessibility`],
              [BarChart3, 'Reports', reports.length, 'Published artifacts'],
            ].map(([Icon, label, value, sub]) => (
              <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-white p-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
                  <p className="font-heading text-xl font-black">{value}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Pipeline Jobs</p>
          <div className="mt-5 space-y-3">
            {pipelineJobs.map((job) => {
              const failed = run.status === 'failure' && job.name === 'Test';
              return (
                <div key={job.name} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                  failed ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'
                }`}>
                  <span className="font-semibold text-foreground">{job.name}</span>
                  <span className={`text-xs font-black uppercase ${failed ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {failed ? 'Failure' : job.status} · {job.duration}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm backdrop-blur-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-muted-foreground">Reports</p>
          <div className="mt-5 space-y-3">
            {reports.map((report) => (
              <div key={report.name} className="rounded-2xl border border-border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{report.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{report.desc}</p>
                  </div>
                  <FileBarChart className="h-5 w-5 shrink-0 text-primary" />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{report.type} · {report.size}</span>
                  <Button variant="ghost" size="sm" className="h-7 rounded-full px-2 text-primary">Download</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

export default function PipelineSummary() {
  const { runNumber } = useParams();
  const run = useMemo(
    () => runs.find((item) => String(item.runNumber) === String(runNumber)) ?? runs[0],
    [runNumber]
  );
  const [tab, setTab] = useState('workspace');
  const readiness = run.status === 'failure' ? 64 : run.status === 'running' ? 78 : 92;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(245_90%_97%),transparent_32rem),linear-gradient(180deg,hsl(220_20%_99%),hsl(245_65%_98%))] pb-16 pt-24">
      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Button asChild variant="outline" className="mb-5 rounded-full bg-white/80">
          <Link to="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        <section className="rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_24px_90px_-50px_rgba(79,70,229,.55)] backdrop-blur-2xl md:p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-violet-50 px-3 py-1 text-violet-700 hover:bg-violet-50">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Pipeline Summary
                </Badge>
                <StatusBadge status={run.status} />
                <Badge variant="outline" className="rounded-full">Run #{run.runNumber} · {run.mode}</Badge>
              </div>
              <h1 className="mt-5 font-heading text-4xl font-black tracking-tight md:text-5xl">{run.projectName}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Run #{run.runNumber} packaged source, requirements, BDD coverage, execution evidence, and reports.
                Readiness is <span className="font-semibold text-amber-600">{run.status === 'failure' ? 'Needs Review' : 'Healthy'}</span>
                {' '}before promotion.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2"><GitBranch className="h-4 w-4" />{run.branch}</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" />{run.duration}</span>
                <span className="inline-flex items-center gap-2"><Play className="h-4 w-4" />{run.trigger}</span>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
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

          <div className="mt-7 grid gap-4 md:grid-cols-4">
            <MetricCard label="Executed Tests" value={`${run.testsPassed}/${run.testsTotal}`} sub={`${run.testsFailed} failed · ${run.testsSkipped} skipped`} tone="bg-violet-50/70" />
            <MetricCard label="BDD Coverage" value={`${Math.round((run.bddCovered / Math.max(run.bddTotal, 1)) * 100)}%`} sub={`${run.bddCovered}/${run.bddTotal} scenarios`} tone="bg-indigo-50/70" />
            <MetricCard label="Code Coverage" value={`${run.codeCoverage}%`} sub={codeQuality.verdict} tone="bg-emerald-50/70" />
            <MetricCard label="AI Coverage" value={`${run.coverageAi}%`} sub={`${aiDetails.accuracy}% accuracy`} tone="bg-amber-50/70" />
          </div>
        </section>

        <section className="mt-7 rounded-[2rem] border border-white/80 bg-white/70 p-2 shadow-sm backdrop-blur-xl">
          <div className="grid gap-2 sm:grid-cols-2">
            {tabOptions.map((option) => {
              const Icon = option.icon;
              const active = tab === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTab(option.id)}
                  className={`flex items-center justify-center gap-2 rounded-3xl px-5 py-4 text-sm font-black transition-all ${
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
          {tab === 'workspace' ? <WorkspaceTab /> : <PipelineTab run={run} />}
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-sm backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-lg font-black">Ready to promote?</p>
                <p className="text-sm text-muted-foreground">Resolve failing tests and uncovered scenarios, then re-run to refresh readiness.</p>
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
