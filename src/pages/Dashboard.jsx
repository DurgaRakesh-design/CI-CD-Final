import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Layers3,
  Package,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import RunDetailTabs from '../components/dashboard/RunDetailTabs';

const portalStages = [
  { label: 'Discovery', short: '1', tone: 'bg-indigo-500 text-white' },
  { label: 'Requirements', short: '2', tone: 'bg-violet-500 text-white' },
  { label: 'BDD', short: '3', tone: 'bg-fuchsia-500 text-white' },
  { label: 'Automation', short: '4', tone: 'bg-orange-500 text-white' },
  { label: 'Execution', short: '5', tone: 'bg-amber-500 text-white' },
  { label: 'Insights', short: '6', tone: 'bg-emerald-500 text-white' },
];

const projects = [
  {
    id: 'user-management-api',
    title: 'User Management API',
    packageName: 'user-management-api.zip',
    packageSource: 'Repository package',
    platform: 'Java / Spring Boot',
    branch: 'develop',
    status: 'failed',
    statusLabel: 'Failed',
    lastUpdated: '2 hours ago',
    readiness: 87,
    successRate: 94.2,
    activeIssues: 3,
    duration: '6m 57s',
    aiAssets: 312,
    releaseNotes: 'Discovery is complete. BDD coverage is strong, but approval and execution still surface a small regression cluster.',
    workspace: {
      upload: 'Repository package selected',
      brd: '1 BRD generated',
      bdd: '5 BDD documents generated',
      traceability: '18 scenarios traced',
      gaps: '3 gaps detected',
      approvals: '5 / 6 approved',
    },
    summaryCards: [
      { label: 'Source Scan', value: '32 files' },
      { label: 'BRD', value: '12 sections' },
      { label: 'BDD', value: '18 scenarios' },
      { label: 'Traceability', value: 'High' },
    ],
    stages: [
      { title: 'Discovery', detail: 'Package uploaded and module boundaries inferred from source code.', status: 'complete' },
      { title: 'Requirements', detail: 'BRD drafted from package signals and business intent.', status: 'complete' },
      { title: 'BDD', detail: 'BDD scenarios generated for the primary user journeys.', status: 'complete' },
      { title: 'Automation', detail: 'Scripts and traceability assets prepared for execution.', status: 'complete' },
      { title: 'Execution', detail: 'Pipeline run detected a failed smoke path in a dependent job.', status: 'attention' },
      { title: 'Insights', detail: 'Recommendations highlighted a few remaining coverage gaps.', status: 'attention' },
    ],
    gaps: [
      { title: 'No authentication guard on sensitive routes', severity: 'high' },
      { title: 'Visit scheduling lacks automated BDD coverage', severity: 'medium' },
      { title: 'Internationalization tests are thin', severity: 'low' },
    ],
    recommendations: [
      'Add authentication checks around sensitive operations.',
      'Generate BDD coverage for Visit Scheduling and approval paths.',
      'Expand locale coverage for the message bundle flow.',
    ],
    reports: [
      'BRD draft',
      'BDD pack',
      'Traceability matrix',
      'Gap analysis report',
      'Execution artifact bundle',
    ],
    artifacts: [
      'brd-user-management.docx',
      'bdd-user-management.zip',
      'gap-analysis-user-management.md',
      'traceability-matrix.xlsx',
    ],
    jobs: [
      { name: 'Detect Platforms', status: 'success', duration: '7s' },
      { name: 'Build (Java)', status: 'success', duration: '17s' },
      { name: 'Smoke Test (Frontend)', status: 'success', duration: '10s' },
      { name: 'Test (Java)', status: 'success', duration: '4m 17s' },
      { name: 'Browser Smoke (Frontend)', status: 'success', duration: '54s' },
      { name: 'Code Analysis (Java)', status: 'success', duration: '37s' },
      { name: 'Publish (Java)', status: 'success', duration: '29s' },
    ],
    run: {
      number: 47,
      status: 'failed',
      branch: 'develop',
      commit: '1f84266',
      duration: '8m 45s',
      artifacts: 4,
      tests: { total: 245, passed: 218, failed: 22, skipped: 5 },
      bddCoverage: 85,
      codeCoverage: 72,
    },
  },
  {
    id: 'payment-service',
    title: 'Payment Service',
    packageName: 'payment-service.zip',
    packageSource: 'Uploaded package',
    platform: 'Java / Spring Boot',
    branch: 'main',
    status: 'success',
    statusLabel: 'Success',
    lastUpdated: 'Today, 11:14 AM',
    readiness: 94,
    successRate: 97.8,
    activeIssues: 1,
    duration: '11m 23s',
    aiAssets: 278,
    releaseNotes: 'This project is close to production readiness with a healthy execution signal and only one open recommendation.',
    workspace: {
      upload: 'ZIP uploaded from local device',
      brd: '1 BRD generated',
      bdd: '6 BDD documents generated',
      traceability: '21 scenarios traced',
      gaps: '1 gap detected',
      approvals: '6 / 6 approved',
    },
    summaryCards: [
      { label: 'Source Scan', value: '28 files' },
      { label: 'BRD', value: '10 sections' },
      { label: 'BDD', value: '21 scenarios' },
      { label: 'Traceability', value: 'Full' },
    ],
    stages: [
      { title: 'Discovery', detail: 'Package analyzed and service boundaries extracted.', status: 'complete' },
      { title: 'Requirements', detail: 'BRD captured payment flows and error boundaries.', status: 'complete' },
      { title: 'BDD', detail: 'Scenarios generated for retry, timeout, and refund paths.', status: 'complete' },
      { title: 'Automation', detail: 'Automation assets compiled and packaged.', status: 'complete' },
      { title: 'Execution', detail: 'All jobs completed successfully with stable timing.', status: 'complete' },
      { title: 'Insights', detail: 'Only one recommendation remains before final release.', status: 'complete' },
    ],
    gaps: [
      { title: 'Add one more timeout regression case', severity: 'medium' },
    ],
    recommendations: [
      'Add an extra boundary test for payment retries.',
      'Keep the approval gate on the final artifact bundle.',
    ],
    reports: [
      'BRD draft',
      'BDD pack',
      'Traceability matrix',
      'Execution report',
      'Release bundle',
    ],
    artifacts: [
      'brd-payment.docx',
      'bdd-payment.zip',
      'execution-report.html',
      'release-artifacts.zip',
    ],
    jobs: [
      { name: 'Detect Platforms', status: 'success', duration: '6s' },
      { name: 'Build (Java)', status: 'success', duration: '22s' },
      { name: 'Test (Java)', status: 'success', duration: '5m 30s' },
      { name: 'Code Analysis (Java)', status: 'success', duration: '37s' },
      { name: 'Publish (Java)', status: 'success', duration: '29s' },
    ],
    run: {
      number: 48,
      status: 'success',
      branch: 'main',
      commit: '8ab1f72',
      duration: '6m 57s',
      artifacts: 4,
      tests: { total: 312, passed: 305, failed: 4, skipped: 3 },
      bddCoverage: 92,
      codeCoverage: 81,
    },
  },
  {
    id: 'inventory-module',
    title: 'Inventory Module',
    packageName: 'inventory-module.zip',
    packageSource: 'Repository package',
    platform: 'Java / Spring Boot',
    branch: 'release/3.1',
    status: 'success',
    statusLabel: 'Success',
    lastUpdated: '1 day ago',
    readiness: 91,
    successRate: 98.1,
    activeIssues: 2,
    duration: '14m 12s',
    aiAssets: 264,
    releaseNotes: 'This workspace is balanced, with strong coverage and a good signal for release readiness.',
    workspace: {
      upload: 'Repository package selected',
      brd: '1 BRD generated',
      bdd: '4 BDD documents generated',
      traceability: '15 scenarios traced',
      gaps: '2 gaps detected',
      approvals: '6 / 6 approved',
    },
    summaryCards: [
      { label: 'Source Scan', value: '24 files' },
      { label: 'BRD', value: '9 sections' },
      { label: 'BDD', value: '15 scenarios' },
      { label: 'Traceability', value: 'Strong' },
    ],
    stages: [
      { title: 'Discovery', detail: 'Inventory package, controllers, and services mapped.', status: 'complete' },
      { title: 'Requirements', detail: 'BRD converted into a concise requirements set.', status: 'complete' },
      { title: 'BDD', detail: 'BDD coverage spans stock, threshold, and update flows.', status: 'complete' },
      { title: 'Automation', detail: 'Generated assets were aligned to the test harness.', status: 'complete' },
      { title: 'Execution', detail: 'Execution completed with green status across jobs.', status: 'complete' },
      { title: 'Insights', detail: 'Only low-priority improvements remain.', status: 'complete' },
    ],
    gaps: [
      { title: 'A few slow paths need monitoring', severity: 'low' },
      { title: 'Optional security audit logging', severity: 'low' },
    ],
    recommendations: [
      'Add a lightweight performance benchmark to the inventory update flow.',
      'Consider extra audit logging around bulk updates.',
    ],
    reports: [
      'BRD draft',
      'BDD pack',
      'Traceability matrix',
      'Execution report',
      'Release bundle',
    ],
    artifacts: [
      'brd-inventory.docx',
      'bdd-inventory.zip',
      'traceability.xlsx',
      'release-bundle.zip',
    ],
    jobs: [
      { name: 'Detect Platforms', status: 'success', duration: '7s' },
      { name: 'Build (Java)', status: 'success', duration: '17s' },
      { name: 'Test (Java)', status: 'success', duration: '4m 17s' },
      { name: 'Browser Smoke (Frontend)', status: 'success', duration: '54s' },
      { name: 'Publish (Java)', status: 'success', duration: '29s' },
    ],
    run: {
      number: 45,
      status: 'success',
      branch: 'release/3.1',
      commit: '2f9c7d1',
      duration: '14m 12s',
      artifacts: 4,
      tests: { total: 428, passed: 420, failed: 3, skipped: 5 },
      bddCoverage: 94,
      codeCoverage: 79,
    },
  },
];

export default function Dashboard() {
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [selectedProjectId]
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="font-heading font-bold text-2xl sm:text-3xl">
                {selectedProject ? selectedProject.title : 'VeriSphere AI Dashboard'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                {selectedProject
                  ? 'A full delivery summary from upload to pipeline execution.'
                  : 'Understand any application. Generate everything needed for quality delivery in one unified console.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">
                Artifact-backed live dashboard
              </Badge>
              <Badge variant="outline" className="rounded-full bg-violet-50 text-violet-700 border-violet-200">
                Live pipeline view
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white text-muted-foreground border-border">
                Last updated just now
              </Badge>
            </div>
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {!selectedProject ? (
            <motion.div
              key="dashboard-overview"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-8"
            >
              <OverviewHero />

              <div className="rounded-2xl border border-border bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Delivery pipeline</p>
                    <h2 className="mt-1 font-heading font-semibold text-lg">From discovery to insights</h2>
                  </div>
                  <Badge variant="outline" className="rounded-full bg-muted/40 text-muted-foreground">
                    6 stages
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {portalStages.map((stage) => (
                    <div key={stage.label} className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                      <div className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${stage.tone}`}>
                        {stage.short}
                      </div>
                      <p className="mt-2 text-xs font-semibold">{stage.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Projects Tracked" value="3" detail="Delivery workspaces in motion" icon={Layers3} tone="indigo" />
                <KpiCard label="Ready for Release" value="2" detail="Workspaces above 90% readiness" icon={ShieldCheck} tone="emerald" />
                <KpiCard label="AI Assets Generated" value="854" detail="BRD, BDD, traceability, and reports" icon={Bot} tone="violet" />
                <KpiCard label="Active Issues" value="6" detail="Open items across selected projects" icon={BarChart3} tone="amber" />
              </div>

              <section className="space-y-4">
                <SectionHeader
                  title="Workspace details"
                  subtitle="How each project is assembled from upload through BRD, BDD, and approval."
                />
                <div className="grid gap-4 xl:grid-cols-3">
                  {projects.map((project) => (
                    <WorkspacePreviewCard
                      key={project.id}
                      project={project}
                      onOpen={() => setSelectedProjectId(project.id)}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader
                  title="Pipeline details"
                  subtitle="Select a pipeline to inspect the full run summary, jobs, artifacts, and reports."
                />
                <div className="rounded-3xl border border-border bg-white p-4 sm:p-5">
                  <div className="space-y-3">
                    {projects.map((project) => (
                      <PipelineRailRow
                        key={project.id}
                        project={project}
                        onOpen={() => setSelectedProjectId(project.id)}
                      />
                    ))}
                  </div>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key={`dashboard-detail-${selectedProject.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" className="rounded-xl h-10 px-4" onClick={() => setSelectedProjectId(null)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to dashboard
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full bg-white border-border text-muted-foreground">
                    Workspace summary
                  </Badge>
                  <Badge variant="outline" className="rounded-full bg-white border-border text-muted-foreground">
                    Pipeline summary
                  </Badge>
                </div>
              </div>

              <DetailHero project={selectedProject} />

              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <section className="space-y-4">
                  <SectionHeader
                    title="VerSpace details"
                    subtitle="This section captures the full delivery story from package upload through document generation."
                  />
                  <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {selectedProject.summaryCards.map((card) => (
                        <MiniStatCard key={card.label} label={card.label} value={card.value} />
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3">
                      {selectedProject.stages.map((stage) => (
                        <StageBlock key={stage.title} stage={stage} />
                      ))}
                    </div>

                    <div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-violet-900">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="w-4 h-4" />
                        Delivery notes
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-violet-800">{selectedProject.releaseNotes}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">Workspace artifacts</h3>
                        <p className="text-xs text-muted-foreground mt-1">Everything generated during the delivery flow.</p>
                      </div>
                      <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">
                        {selectedProject.workspace.approvals}
                      </Badge>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selectedProject.artifacts.map((artifact) => (
                        <ArtifactRow key={artifact} label={artifact} />
                      ))}
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <SectionHeader
                    title="Pipeline details"
                    subtitle="The right side drills into execution, quality signals, and report artifacts."
                  />
                  <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                    <div className="grid gap-3 sm:grid-cols-4">
                      <MiniStatCard label="Run" value={`#${selectedProject.run.number}`} />
                      <MiniStatCard label="Status" value={selectedProject.run.statusLabel || selectedProject.run.status} />
                      <MiniStatCard label="Tests" value={`${selectedProject.run.tests.passed}/${selectedProject.run.tests.total}`} />
                      <MiniStatCard label="Artifacts" value={`${selectedProject.run.artifacts}`} />
                    </div>

                    <div className="mt-5 rounded-2xl bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600 p-5 text-white shadow-lg shadow-primary/20">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="max-w-md">
                          <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Run summary</p>
                          <h3 className="mt-2 font-heading text-2xl font-bold">Release readiness is at {selectedProject.readiness}%</h3>
                          <p className="mt-2 text-sm text-white/75">
                            {selectedProject.packageName} on {selectedProject.run.branch} completed in {selectedProject.run.duration}.
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <RadialScore score={selectedProject.readiness} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <MetricPill label="BDD coverage" value={`${selectedProject.run.bddCoverage}%`} />
                      <MetricPill label="Code coverage" value={`${selectedProject.run.codeCoverage}%`} />
                      <MetricPill label="AI assets" value={String(selectedProject.aiAssets)} />
                    </div>

                    <div className="mt-5 space-y-2">
                      <h4 className="text-sm font-semibold">Pipeline jobs</h4>
                      {selectedProject.jobs.map((job) => (
                        <JobRow key={job.name} job={job} />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                    <h3 className="font-semibold">Selected run detail</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the tabs below for tests, traceability, AI details, code quality, frontend, reports, and pipeline state.
                    </p>
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-muted/20 p-3">
                      <RunDetailTabs
                        run={{
                          tests: selectedProject.run.tests,
                          bddCoverage: selectedProject.run.bddCoverage,
                          codeCoverage: selectedProject.run.codeCoverage,
                        }}
                      />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">Reports and insights</h3>
                        <p className="text-xs text-muted-foreground mt-1">Quick access to artifacts and next-step guidance.</p>
                      </div>
                      <Button variant="outline" size="sm" className="rounded-xl">
                        <Download className="w-4 h-4 mr-2" />
                        Download bundle
                      </Button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <InsightCard title="Reports" items={selectedProject.reports} />
                      <InsightCard title="Recommendations" items={selectedProject.recommendations} />
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function OverviewHero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary via-violet-600 to-fuchsia-600 p-6 sm:p-8 text-white shadow-xl shadow-primary/20"
    >
      <div className="absolute top-0 right-0 h-56 w-56 -translate-y-1/2 translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-40 w-40 translate-y-1/2 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
            <Sparkles className="w-3.5 h-3.5" />
            VeriSphere AI quality intelligence
          </div>
          <h2 className="mt-4 max-w-3xl font-heading text-3xl font-bold sm:text-4xl lg:text-5xl">
            Understand any application.
            <span className="block text-white/90">Generate everything needed for quality delivery.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
            From source discovery to validated delivery, this dashboard surfaces requirements, BRD, BDD, automation, execution, and insights in one place.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <HeroStat label="Success rate" value="94.2%" />
          <HeroStat label="Readiness" value="87%" />
          <HeroStat label="AI assets" value="854" />
        </div>
      </div>
    </motion.div>
  );
}

function DetailHero({ project }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-border bg-white p-6 shadow-sm"
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="flex items-center gap-5">
          <RadialScore score={project.readiness} compact />
          <div>
            <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">
              {project.statusLabel}
            </Badge>
            <h2 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">{project.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">{project.releaseNotes}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile label="Package" value={project.packageName} />
          <InfoTile label="Branch" value={project.branch} />
          <InfoTile label="Duration" value={project.duration} />
          <InfoTile label="Updated" value={project.lastUpdated} />
        </div>
      </div>
    </motion.div>
  );
}

function WorkspacePreviewCard({ project, onOpen }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -2 }}
      className="group rounded-3xl border border-border bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">VerSpace details</p>
          <h3 className="mt-1 truncate font-heading text-lg font-semibold">{project.title}</h3>
          <p className="truncate text-sm text-muted-foreground">{project.packageName}</p>
        </div>
        <Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-violet-700">
          {project.readiness}%
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MiniStatCard label="BRD" value={project.workspace.brd} compact />
        <MiniStatCard label="BDD" value={project.workspace.bdd} compact />
        <MiniStatCard label="Gaps" value={project.workspace.gaps} compact />
        <MiniStatCard label="Approvals" value={project.workspace.approvals} compact />
      </div>

      <div className="mt-4 rounded-2xl bg-muted/30 p-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Package className="w-3.5 h-3.5" />
          {project.packageSource}
        </div>
        <p className="mt-2 text-sm leading-relaxed">{project.workspace.upload}</p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Open full summary</span>
        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </div>
    </motion.button>
  );
}

function PipelineRailRow({ project, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-4 text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full bg-white text-muted-foreground">
            {project.statusLabel}
          </Badge>
          <span className="text-sm font-semibold">{project.title}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {project.packageName} | {project.branch} | {project.duration}
        </p>
      </div>
      <div className="grid gap-3 text-sm sm:grid-cols-3 sm:items-center">
        <MetricPill label="Readiness" value={`${project.readiness}%`} />
        <MetricPill label="BDD coverage" value={`${project.run.bddCoverage}%`} />
        <MetricPill label="Tests" value={`${project.run.tests.passed}/${project.run.tests.total}`} />
      </div>
    </button>
  );
}

function KpiCard({ label, value, detail, icon: Icon, tone }) {
  const tones = {
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-wide text-white/70">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function MiniStatCard({ label, value, compact = false }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-semibold ${compact ? 'text-sm' : 'text-base'}`}>{value}</p>
    </div>
  );
}

function StageBlock({ stage }) {
  const tones = {
    complete: 'bg-emerald-50 border-emerald-100 text-emerald-800',
    attention: 'bg-amber-50 border-amber-100 text-amber-800',
  };
  return (
    <div className={`rounded-2xl border p-4 ${tones[stage.status] || tones.complete}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">{stage.title}</p>
          <p className="mt-1 text-sm leading-relaxed">{stage.detail}</p>
        </div>
        <Badge variant="outline" className="rounded-full border-current bg-white/70 text-current">
          {stage.status === 'attention' ? 'Review' : 'Complete'}
        </Badge>
      </div>
    </div>
  );
}

function ArtifactRow({ label }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/20 p-3">
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="truncate text-sm">{label}</span>
      </div>
      <Button variant="ghost" size="sm" className="h-8 px-3">
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Download
      </Button>
    </div>
  );
}

function JobRow({ job }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white p-3">
      <div className="flex items-center gap-2 min-w-0">
        {job.status === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        )}
        <span className="truncate text-sm font-medium">{job.name}</span>
      </div>
      <span className="text-xs text-muted-foreground">{job.duration}</span>
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-3 text-center">
      <p className="text-xl font-bold leading-none text-primary">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div>
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium leading-relaxed">{value}</p>
    </div>
  );
}

function InsightCard({ title, items }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-4">
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RadialScore({ score, compact = false }) {
  const size = compact ? 'h-24 w-24' : 'h-28 w-28';
  const inner = compact ? 'h-16 w-16' : 'h-20 w-20';
  return (
    <div
      className={`relative flex items-center justify-center rounded-full ${size}`}
      style={{
        background: `conic-gradient(rgb(99, 102, 241) ${score * 3.6}deg, rgba(226, 232, 240, 0.8) 0deg)`,
      }}
    >
      <div className={`flex flex-col items-center justify-center rounded-full bg-white ${inner} shadow-inner`}>
        <span className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-foreground`}>{score}%</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ready</span>
      </div>
    </div>
  );
}
