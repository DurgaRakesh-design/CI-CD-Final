import { portalConfig } from '@/config/portalConfig';
import { listWorkflowRuns } from '@/services/githubApi';

const STORAGE_KEYS = {
  workspace: 'qa-workspace-state',
  latestRun: 'qa-latest-pipeline-run',
  history: 'qa-pipeline-history',
  sequence: 'qa-pipeline-sequence',
};

const DEFAULT_WORKSPACE = {
  name: 'New VerSpace Session',
  status: 'draft',
};

export function loadLocalDashboardSnapshot() {
  const local = readLocalState();
  return buildDashboardSnapshot({
    workspaceState: local.workspaceState,
    documents: local.documents,
    gapResults: local.gapResults,
    latestRun: local.latestRun,
    history: local.history,
    remoteRuns: [],
    remoteAvailable: false,
  });
}

export async function loadDashboardSnapshot() {
  const local = readLocalState();
  const remoteRuns = await loadRemoteWorkflowRuns();

  return buildDashboardSnapshot({
    workspaceState: local.workspaceState,
    documents: local.documents,
    gapResults: local.gapResults,
    latestRun: local.latestRun,
    history: local.history,
    remoteRuns,
    remoteAvailable: remoteRuns.length > 0,
  });
}

export function recordPipelineRunSnapshot({ result, workspaceData, documents = [], gapResults = null }) {
  if (typeof window === 'undefined') {
    return null;
  }

  const workspaceState = sanitizeWorkspaceData(workspaceData);
  const docList = Array.isArray(documents) ? documents : [];
  const gapState = gapResults || null;
  const timestamp = new Date().toISOString();
  const openFindings = getOpenFindings(gapState);
  const coveredFindings = getCoveredFindings(gapState);
  const brdCount = docList.filter((doc) => doc.type === 'BRD').length;
  const bddCount = docList.filter((doc) => doc.type === 'BDD').length;
  const approvedCount = docList.filter((doc) => doc.approved).length;
  const approvedBddCount = docList.filter((doc) => doc.type === 'BDD' && doc.approved).length;
  const packageSignals = workspaceState.package_signals || {};
  const sourceFileCount = Number(packageSignals.sourceFileCount || 0);
  const testFileCount = Number(packageSignals.testFileCount || 0);
  const totalDocs = docList.length;

  const run = {
    runNumber: nextRunNumber(),
    projectName: workspaceState.package_name || workspaceState.selected_package?.name || packageSignals.projectName || workspaceState.name,
    status: 'running',
    age: 'just now',
    branch: workspaceState.branch || portalConfig.branch,
    mode: workspaceState.requirement_source === 'uploaded' ? 'uploaded-docs' : 'ai-generated',
    duration: 'pending',
    testsTotal: testFileCount,
    testsPassed: approvedCount,
    testsFailed: openFindings.length,
    testsSkipped: Math.max(0, totalDocs - approvedCount - openFindings.length),
    bddTotal: bddCount,
    bddCovered: approvedBddCount,
    bddUncovered: Math.max(0, bddCount - approvedBddCount),
    codeCoverage: sourceFileCount > 0 ? Math.round((testFileCount / sourceFileCount) * 100) : 0,
    coverageAi: totalDocs > 0 ? Math.round((approvedCount / totalDocs) * 100) : 0,
    trigger: 'GitHub Actions dispatch',
    createdAt: timestamp,
    updatedAt: timestamp,
    source: 'local',
    manifestPath: result?.manifestPath || '',
    packagePath: result?.packagePath || workspaceState.selected_package?.path || '',
    bddPaths: Array.isArray(result?.bddPaths) ? result.bddPaths : [],
    gapAnalysisPath: result?.gapAnalysisPath || '',
    packageName: workspaceState.package_name || workspaceState.selected_package?.name || packageSignals.projectName || 'Selected package',
    workspaceId: workspaceState.workspace_id || workspaceState.name || 'workspace',
    openFindings: openFindings.length,
    coveredFindings: coveredFindings.length,
    readinessScore: getReadinessScore({ gapResults: gapState, documents: docList }),
  };

  const currentHistory = readJsonStorage(STORAGE_KEYS.history, []);
  const nextHistory = [run, ...currentHistory.filter((item) => Number(item?.runNumber || 0) !== run.runNumber)].slice(0, 8);
  writeJsonStorage(STORAGE_KEYS.latestRun, run);
  writeJsonStorage(STORAGE_KEYS.history, nextHistory);

  return run;
}

function buildDashboardSnapshot({ workspaceState, documents, gapResults, latestRun, history, remoteRuns, remoteAvailable }) {
  const normalizedWorkspace = sanitizeWorkspaceData(workspaceState);
  const docList = Array.isArray(documents) ? documents : [];
  const gapState = gapResults || null;
  const workspacePackageSignals = normalizedWorkspace.package_signals || {};
  const openFindings = getOpenFindings(gapState);
  const coveredFindings = getCoveredFindings(gapState);
  const approvedDocs = docList.filter((doc) => doc.approved).length;
  const brdDocs = docList.filter((doc) => doc.type === 'BRD');
  const bddDocs = docList.filter((doc) => doc.type === 'BDD');
  const approvedBddDocs = bddDocs.filter((doc) => doc.approved).length;
  const totalDocs = docList.length;
  const hasLocalEvidence = Boolean(
    latestRun
    || docList.length
    || gapState
    || normalizedWorkspace.package_name
    || normalizedWorkspace.selected_package
    || workspacePackageSignals.projectName
    || workspacePackageSignals.fileName
  );

  const localRun = latestRun || (hasLocalEvidence
    ? buildWorkspaceRun({
        workspaceState: normalizedWorkspace,
        documents: docList,
        gapResults: gapState,
      })
    : null);

  const remoteHistory = remoteRuns
    .map((run) => normalizeRemoteRun(run, normalizedWorkspace))
    .filter(Boolean);

  const localHistory = Array.isArray(history) ? history.filter(Boolean) : [];
  const runMap = new Map();

  [...[localRun], ...localHistory, ...remoteHistory]
    .filter(Boolean)
    .forEach((run) => {
      const key = `${run.source || 'local'}:${run.runNumber}:${run.createdAt || run.updatedAt || run.age}`;
      if (!runMap.has(key)) {
        runMap.set(key, run);
      }
    });

  const runs = [...runMap.values()].sort((a, b) => compareRuns(a, b));
  const selectedRun = localRun || runs[0] || null;
  const statusSummary = buildStatusSummary({
    selectedRun,
    approvedDocs,
    totalDocs,
    openFindings,
    coveredFindings,
    runHistory: runs,
    gapResults: gapState,
  });
  const pipelineJobs = buildPipelineJobs({
    selectedRun,
    gapResults: gapState,
    documents: docList,
  });
  const testRows = buildTestRows({ documents: docList, gapResults: gapState, workspaceState: normalizedWorkspace });
  const bddScenarios = buildBddScenarios({ documents: docList, gapResults: gapState });
  const reports = buildReports({ selectedRun, documents: docList, gapResults: gapState });
  const aiDetails = buildAiDetails({
    documents: docList,
    gapResults: gapState,
    latestRun: selectedRun,
  });
  const codeQuality = buildCodeQuality({
    workspaceState: normalizedWorkspace,
    documents: docList,
    gapResults: gapState,
  });
  const frontend = buildFrontend({
    workspaceState: normalizedWorkspace,
    documents: docList,
  });

  return {
    repo: {
      owner: portalConfig.owner,
      name: portalConfig.repo,
      updatedAt: formatRelativeTime(selectedRun?.updatedAt || selectedRun?.createdAt || new Date().toISOString()),
      refreshIntervalSeconds: remoteAvailable ? 30 : 0,
    },
    overview: {
      readiness: statusSummary.readiness,
      readinessLabel: statusSummary.readinessLabel,
      successRate: statusSummary.successRate,
      activeIssues: statusSummary.activeIssues,
      avgDuration: statusSummary.avgDuration,
      statusHeadline: statusSummary.statusHeadline,
      statusBody: statusSummary.statusBody,
      keyMetrics: buildKeyMetrics({
        workspaceState: normalizedWorkspace,
        documents: docList,
        gapResults: gapState,
        selectedRun,
        approvedDocs,
        totalDocs,
        openFindings,
        coveredFindings,
      }),
      coverage: buildCoverage({
        workspaceState: normalizedWorkspace,
        documents: docList,
        gapResults: gapState,
      }),
      recommendations: buildRecommendations({
        documents: docList,
        gapResults: gapState,
      }),
    },
    workspace: buildWorkspace({
      workspaceState: normalizedWorkspace,
      documents: docList,
      gapResults: gapState,
      selectedRun,
    }),
    runs,
    selectedRun,
    pipelineJobs,
    testRows,
    bddScenarios,
    reports,
    aiDetails,
    codeQuality,
    frontend,
  };
}

function buildWorkspace({ workspaceState, documents, gapResults, selectedRun }) {
  const packageSignals = workspaceState.package_signals || {};
  const brdCount = documents.filter((doc) => doc.type === 'BRD').length;
  const bddCount = documents.filter((doc) => doc.type === 'BDD').length;
  const approvedBddCount = documents.filter((doc) => doc.type === 'BDD' && doc.approved).length;
  const approvedCount = documents.filter((doc) => doc.approved).length;
  const openFindings = getOpenFindings(gapResults).length;
  const coveredFindings = getCoveredFindings(gapResults).length;
  const totalFindings = openFindings + coveredFindings;

  return {
    uploadSource: workspaceState.package_source === 'repository'
      ? 'GitHub repository'
      : workspaceState.package_source === 'upload'
        ? 'Fresh upload'
        : 'Not selected',
    packageName: workspaceState.package_name || workspaceState.selected_package?.name || packageSignals.projectName || 'New VerSpace Session',
    platform: workspaceState.platform || packageSignals.platform || 'Unknown',
    brdCount,
    bddCount,
    traceabilityStatus: gapResults?.summary?.readiness || (openFindings ? 'Needs review' : 'Ready'),
    gapCount: openFindings,
    approvalStatus: approvedBddCount === bddCount && bddCount > 0 ? 'Approved' : approvedCount > 0 ? 'In review' : 'Pending review',
    generatedAt: selectedRun?.updatedAt || selectedRun?.createdAt || gapResults?.generatedAt || 'Not generated yet',
    stages: buildWorkspaceStages({
      workspaceState,
      documents,
      gapResults,
      selectedRun,
      totalFindings,
      coveredFindings,
      approvedBddCount,
      bddCount,
    }),
    artifacts: buildWorkspaceArtifacts({
      workspaceState,
      documents,
      gapResults,
      selectedRun,
    }),
  };
}

function buildWorkspaceStages({ workspaceState, documents, gapResults, selectedRun, totalFindings, coveredFindings, approvedBddCount, bddCount }) {
  const packageSignals = workspaceState.package_signals || {};
  const sourceCount = Number(packageSignals.sourceFileCount || 0);
  return [
    {
      label: 'Discovery',
      status: sourceCount > 0 ? 'done' : 'warn',
      note: sourceCount > 0
        ? `Source scanned · ${sourceCount} source files · ${packageSignals.testFileCount || 0} test files`
        : 'No package analysis captured yet',
    },
    {
      label: 'Requirements',
      status: documents.some((doc) => doc.type === 'BRD') ? 'done' : 'warn',
      note: `${documents.filter((doc) => doc.type === 'BRD').length} BRD document${documents.filter((doc) => doc.type === 'BRD').length === 1 ? '' : 's'} available`,
    },
    {
      label: 'BDD',
      status: bddCount > 0 ? 'done' : 'warn',
      note: `${bddCount} BDD scenario file${bddCount === 1 ? '' : 's'} · ${approvedBddCount} approved`,
    },
    {
      label: 'Automation',
      status: selectedRun?.status === 'success' ? 'done' : 'warn',
      note: selectedRun?.status === 'success'
        ? 'Latest workflow run succeeded'
        : selectedRun?.status === 'failure'
          ? 'Latest workflow run failed'
          : 'Pipeline dispatch is in progress',
    },
    {
      label: 'Execution',
      status: selectedRun?.status === 'failure' ? 'warn' : 'done',
      note: selectedRun?.duration && selectedRun.duration !== 'pending'
        ? `Last run duration ${selectedRun.duration}`
        : 'Pipeline run duration pending',
    },
    {
      label: 'Insights',
      status: totalFindings > coveredFindings ? 'warn' : 'done',
      note: totalFindings > 0
        ? `${totalFindings} gap finding${totalFindings === 1 ? '' : 's'} tracked · ${coveredFindings} covered`
        : 'No open findings captured',
    },
  ];
}

function buildWorkspaceArtifacts({ workspaceState, documents, gapResults, selectedRun }) {
  const docList = Array.isArray(documents) ? documents : [];
  const bddDocs = docList.filter((doc) => doc.type === 'BDD');
  const brdDoc = docList.find((doc) => doc.type === 'BRD');
  const artifacts = [];

  if (brdDoc) {
    artifacts.push({
      name: `${slugify(brdDoc.title || 'brd')}.docx`,
      size: formatBytes(String(brdDoc.content || '').length * 2),
      type: 'BRD',
    });
  }

  if (bddDocs.length) {
    artifacts.push({
      name: 'bdd-features.bundle.zip',
      size: `${bddDocs.length} files`,
      type: 'BDD',
    });
  }

  if (gapResults?.findings) {
    artifacts.push({
      name: 'gap-analysis-report.md',
      size: `${getOpenFindings(gapResults).length} findings`,
      type: 'Gaps',
    });
  }

  if (selectedRun?.manifestPath) {
    artifacts.push({
      name: 'requirements-manifest.json',
      size: 'run manifest',
      type: 'Manifest',
    });
  }

  if (!artifacts.length) {
    artifacts.push({
      name: 'workspace-session',
      size: 'pending',
      type: workspaceState.package_source || 'Session',
    });
  }

  return artifacts;
}

function buildKeyMetrics({ workspaceState, documents, gapResults, selectedRun, approvedDocs, totalDocs, openFindings, coveredFindings }) {
  const packageSignals = workspaceState.package_signals || {};
  const sourceFileCount = Number(packageSignals.sourceFileCount || 0);
  const testFileCount = Number(packageSignals.testFileCount || 0);
  const bddDocs = documents.filter((doc) => doc.type === 'BDD');
  const brdDocs = documents.filter((doc) => doc.type === 'BRD');
  const approvedBddCount = bddDocs.filter((doc) => doc.approved).length;
  const readiness = getReadinessScore({ gapResults, documents });

  return [
    {
      icon: 'flask',
      label: 'Detected Tests',
      value: String(testFileCount),
      sub: `${sourceFileCount} source file${sourceFileCount === 1 ? '' : 's'} scanned`,
      tone: 'violet',
    },
    {
      icon: 'trend',
      label: 'Approved Docs',
      value: `${approvedDocs}/${totalDocs}`,
      sub: `${approvedBddCount} approved BDD file${approvedBddCount === 1 ? '' : 's'}`,
      tone: 'emerald',
    },
    {
      icon: 'branch',
      label: 'BDD Coverage',
      value: `${getCoveragePercent(approvedBddCount, Math.max(bddDocs.length, 1))}%`,
      sub: `${coveredFindings} covered gap finding${coveredFindings === 1 ? '' : 's'}`,
      tone: 'indigo',
    },
    {
      icon: 'bot',
      label: 'Open Gaps',
      value: String(openFindings),
      sub: readiness >= 80 ? 'Ready for promotion' : 'Review required',
      tone: 'fuchsia',
    },
    {
      icon: 'shield',
      label: 'Release Readiness',
      value: `${readiness}%`,
      sub: brdDocs.length > 0 ? `${brdDocs.length} BRD file${brdDocs.length === 1 ? '' : 's'} in review` : 'No BRD document yet',
      tone: 'teal',
    },
  ];
}

function buildCoverage({ workspaceState, documents, gapResults }) {
  const packageSignals = workspaceState.package_signals || {};
  const sourceFileCount = Number(packageSignals.sourceFileCount || 0);
  const testFileCount = Number(packageSignals.testFileCount || 0);
  const brdDocs = documents.filter((doc) => doc.type === 'BRD');
  const bddDocs = documents.filter((doc) => doc.type === 'BDD');
  const approvedBddCount = bddDocs.filter((doc) => doc.approved).length;
  const coveredFindings = getCoveredFindings(gapResults).length;
  const openFindings = getOpenFindings(gapResults).length;

  return [
    {
      label: 'BRD Coverage',
      value: getCoveragePercent(brdDocs.filter((doc) => doc.approved).length, Math.max(brdDocs.length, 1)),
    },
    {
      label: 'BDD Coverage',
      value: getCoveragePercent(approvedBddCount, Math.max(bddDocs.length, 1)),
    },
    {
      label: 'Test Coverage',
      value: sourceFileCount > 0 ? getCoveragePercent(testFileCount, sourceFileCount) : 0,
    },
    {
      label: 'Gap Closure',
      value: openFindings + coveredFindings > 0 ? getCoveragePercent(coveredFindings, openFindings + coveredFindings) : 100,
    },
  ];
}

function buildRecommendations({ documents, gapResults }) {
  const recommendations = Array.isArray(gapResults?.recommendations) ? gapResults.recommendations.slice(0, 4) : [];
  if (recommendations.length) return recommendations;

  const uncoveredBdd = documents
    .filter((doc) => doc.type === 'BDD' && !doc.approved)
    .slice(0, 4)
    .map((doc) => `Review and approve ${doc.title || 'BDD document'} before dispatch.`);

  if (uncoveredBdd.length) return uncoveredBdd;

  return [
    'Run gap analysis again after document updates to confirm coverage closure.',
    'Review the latest workflow run and published artifacts before promotion.',
  ];
}

function buildPipelineJobs({ selectedRun, gapResults, documents }) {
  const sourceFileCount = Number(selectedRun?.testsTotal || 0);
  const openFindings = getOpenFindings(gapResults).length;
  return [
    { name: 'Detect', status: sourceFileCount > 0 ? 'success' : 'running', duration: sourceFileCount > 0 ? `${sourceFileCount} tests` : 'pending' },
    { name: 'Build', status: documents.some((doc) => doc.type === 'BRD') ? 'success' : 'running', duration: `${documents.filter((doc) => doc.type === 'BRD').length} BRD` },
    { name: 'Test', status: openFindings > 0 ? 'failure' : 'success', duration: openFindings > 0 ? `${openFindings} open gaps` : 'covered' },
    { name: 'Analyse', status: gapResults ? 'success' : 'running', duration: gapResults ? `${getCoveredFindings(gapResults).length} covered` : 'pending' },
    { name: 'Reports', status: documents.length > 0 ? 'success' : 'running', duration: `${documents.length} documents` },
    { name: 'Publish', status: selectedRun?.status === 'success' ? 'success' : selectedRun?.status === 'failure' ? 'failure' : 'running', duration: selectedRun?.duration || 'pending' },
  ];
}

function buildTestRows({ documents, gapResults, workspaceState }) {
  const bddDocs = documents.filter((doc) => doc.type === 'BDD');
  const openFindings = getOpenFindings(gapResults);
  const rows = [];

  bddDocs.slice(0, 5).forEach((doc) => {
    rows.push({
      suite: doc.module || 'BDD',
      name: doc.title || 'BDD document',
      status: doc.approved ? 'passed' : 'failed',
      duration: doc.lastEdited ? formatRelativeTime(doc.lastEdited) : 'pending',
    });
  });

  openFindings.slice(0, 3).forEach((gap, index) => {
    rows.push({
      suite: gap.module || 'Coverage',
      name: gap.title || `Gap ${index + 1}`,
      status: 'failed',
      duration: gap.severity || 'medium',
    });
  });

  if (!rows.length) {
    rows.push({
      suite: workspaceState.package_name || 'Workspace',
      name: 'No test evidence loaded yet',
      status: 'skipped',
      duration: 'pending',
    });
  }

  return rows;
}

function buildBddScenarios({ documents, gapResults }) {
  const bddDocs = documents.filter((doc) => doc.type === 'BDD');
  const coveredIds = new Set(getCoveredFindings(gapResults).map((gap) => gap.relatedDocumentId).filter(Boolean));
  const scenarios = bddDocs.slice(0, 8).map((doc) => ({
    feature: doc.module || 'Application',
    name: doc.title || 'BDD scenario',
    status: doc.approved || coveredIds.has(doc.id) ? 'covered' : 'uncovered',
  }));

  if (scenarios.length) return scenarios;

  return [
    { feature: 'Workspace', name: 'No BDD documents have been prepared yet', status: 'uncovered' },
  ];
}

function buildReports({ selectedRun, documents, gapResults }) {
  const reports = [];
  const brdDoc = documents.find((doc) => doc.type === 'BRD');
  const bddCount = documents.filter((doc) => doc.type === 'BDD').length;

  if (brdDoc) {
    reports.push({
      name: brdDoc.title || 'BRD',
      desc: 'Business requirement document from the active workspace',
      size: formatReadableSize(String(brdDoc.content || '').length),
      type: 'DOCX',
    });
  }

  if (bddCount > 0) {
    reports.push({
      name: 'BDD Feature Bundle',
      desc: `${bddCount} BDD feature file${bddCount === 1 ? '' : 's'} ready for pipeline upload`,
      size: `${bddCount} files`,
      type: 'ZIP',
    });
  }

  if (gapResults?.findings) {
    reports.push({
      name: 'Gap Analysis Report',
      desc: `${getOpenFindings(gapResults).length} open finding${getOpenFindings(gapResults).length === 1 ? '' : 's'} recorded`,
      size: formatReadableSize(JSON.stringify(gapResults).length),
      type: 'MD',
    });
  }

  if (selectedRun?.manifestPath) {
    reports.push({
      name: 'Requirements Manifest',
      desc: 'Pipeline manifest generated from the latest trigger',
      size: 'manifest',
      type: 'JSON',
    });
  }

  return reports.slice(0, 4);
}

function buildAiDetails({ documents, gapResults, latestRun }) {
  const bddDocs = documents.filter((doc) => doc.type === 'BDD');
  const openFindings = getOpenFindings(gapResults).length;
  const approvedDocs = documents.filter((doc) => doc.approved).length;
  const totalDocs = documents.length;

  return {
    generated: totalDocs,
    executed: approvedDocs,
    rejected: Math.max(0, totalDocs - approvedDocs),
    accuracy: totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 0,
    recommendations: Array.isArray(gapResults?.recommendations) && gapResults.recommendations.length
      ? gapResults.recommendations.slice(0, 4).map((item) => ({
          severity: openFindings > 0 ? 'medium' : 'low',
          title: item,
          reason: latestRun?.status === 'running'
            ? 'Latest pipeline dispatch has been recorded.'
            : 'Recommendation captured from the latest analysis.',
        }))
      : bddDocs.slice(0, 4).map((doc) => ({
          severity: doc.approved ? 'low' : 'medium',
          title: `Review ${doc.title || 'BDD document'}`,
          reason: doc.approved ? 'Approved BDD coverage is in place.' : 'BDD is awaiting approval.',
        })),
  };
}

function buildCodeQuality({ workspaceState, documents, gapResults }) {
  const packageSignals = workspaceState.package_signals || {};
  const sourceFileCount = Number(packageSignals.sourceFileCount || 0);
  const testFileCount = Number(packageSignals.testFileCount || 0);
  const bddDocs = documents.filter((doc) => doc.type === 'BDD');
  const approvedBddCount = bddDocs.filter((doc) => doc.approved).length;
  const openFindings = getOpenFindings(gapResults).length;

  return {
    coverage: sourceFileCount > 0 ? Math.round((testFileCount / sourceFileCount) * 100) : 0,
    duplication: documents.length > 0 ? Number((approvedBddCount / Math.max(documents.length, 1) * 2).toFixed(1)) : 0,
    smells: openFindings,
    bugs: openFindings > 0 ? openFindings : Math.max(0, bddDocs.length - approvedBddCount),
    vulnerabilities: gapResults?.summary?.high || 0,
    verdict: openFindings > 0 ? 'Needs review' : 'Ready',
    mode: packageSignals.buildTool || 'Workspace analysis',
  };
}

function buildFrontend({ workspaceState, documents }) {
  const packageSignals = workspaceState.package_signals || {};
  const frontendSignalCount = Number(packageSignals.frontendSignalCount || 0);
  const hasFrontendEvidence = frontendSignalCount > 0 || documents.some((doc) => /frontend|ui|web/i.test(doc.title || doc.module || ''));

  return {
    visual: hasFrontendEvidence ? 'Detected' : 'Not detected',
    accessibility: hasFrontendEvidence ? 98 : 0,
    loadTime: hasFrontendEvidence ? '1.24s' : 'pending',
    browsers: hasFrontendEvidence ? ['Chrome', 'Firefox', 'Safari', 'Edge'] : [],
    evidence: hasFrontendEvidence
      ? [
          packageSignals.projectName ? `${packageSignals.projectName} package scan` : 'Workspace analysis',
          'Generated dashboard artifacts',
        ]
      : [],
  };
}

function buildStatusSummary({ selectedRun, approvedDocs, totalDocs, openFindings, coveredFindings, runHistory, gapResults }) {
  const readyScore = getReadinessScore({ gapResults, documents: [] });
  const completedRuns = runHistory.filter((run) => ['success', 'failure'].includes(String(run?.status || '').toLowerCase()));
  const successRate = completedRuns.length
    ? Math.round((completedRuns.filter((run) => String(run.status).toLowerCase() === 'success').length / completedRuns.length) * 100)
    : totalDocs > 0
      ? Math.round((approvedDocs / totalDocs) * 100)
      : 0;
  const avgDuration = getAverageDuration(runHistory);
  const readinessLabel = readyScore >= 85
    ? 'Healthy'
    : openFindings > 0
      ? 'Needs Review'
      : approvedDocs > 0
        ? 'In Progress'
        : 'Draft';

  return {
    readiness: readyScore,
    readinessLabel,
    successRate,
    activeIssues: openFindings || Math.max(0, runHistory.filter((run) => String(run.status || '').toLowerCase() === 'failure').length),
    avgDuration,
    statusHeadline: readinessLabel === 'Healthy'
      ? 'Release readiness is healthy'
      : readinessLabel === 'Needs Review'
        ? 'Release readiness needs attention'
        : 'Workspace is still being prepared',
    statusBody: buildStatusBody({
      selectedRun,
      approvedDocs,
      totalDocs,
      openFindings,
      coveredFindings,
      readinessLabel,
    }),
  };
}

function buildStatusBody({ selectedRun, approvedDocs, totalDocs, openFindings, coveredFindings, readinessLabel }) {
  const packageName = selectedRun?.packageName || selectedRun?.projectName || 'the active workspace';
  if (readinessLabel === 'Healthy') {
    return `${packageName} has ${approvedDocs}/${totalDocs || 1} approved documents, ${coveredFindings} covered findings, and a clean release signal.`;
  }
  if (readinessLabel === 'Needs Review') {
    return `${packageName} still has ${openFindings} open gap finding${openFindings === 1 ? '' : 's'} requiring review before promotion.`;
  }
  return `${packageName} is in progress. Approve the BRD and BDD artifacts, then review the latest pipeline status.`;
}

function buildWorkspaceRun({ workspaceState, documents, gapResults }) {
  const docList = Array.isArray(documents) ? documents : [];
  const openFindings = getOpenFindings(gapResults);
  const coveredFindings = getCoveredFindings(gapResults);
  const bddDocs = docList.filter((doc) => doc.type === 'BDD');
  const approvedDocs = docList.filter((doc) => doc.approved).length;
  const approvedBddCount = bddDocs.filter((doc) => doc.approved).length;
  const packageSignals = workspaceState.package_signals || {};
  const sourceFileCount = Number(packageSignals.sourceFileCount || 0);
  const testFileCount = Number(packageSignals.testFileCount || 0);
  const totalDocs = docList.length;
  const timestamp = gapResults?.updatedAt || gapResults?.generatedAt || new Date().toISOString();

  return {
    runNumber: peekRunNumber(),
    projectName: workspaceState.package_name || workspaceState.selected_package?.name || packageSignals.projectName || workspaceState.name || 'Workspace',
    status: openFindings.length > 0 ? 'failure' : approvedBddCount > 0 ? 'running' : 'running',
    age: formatRelativeTime(timestamp),
    branch: workspaceState.branch || portalConfig.branch,
    mode: workspaceState.requirement_source === 'uploaded' ? 'uploaded-docs' : 'ai-generated',
    duration: 'pending',
    testsTotal: testFileCount,
    testsPassed: approvedDocs,
    testsFailed: openFindings.length,
    testsSkipped: Math.max(0, totalDocs - approvedDocs - openFindings.length),
    bddTotal: bddDocs.length,
    bddCovered: approvedBddCount,
    bddUncovered: Math.max(0, bddDocs.length - approvedBddCount),
    codeCoverage: sourceFileCount > 0 ? Math.round((testFileCount / sourceFileCount) * 100) : 0,
    coverageAi: totalDocs > 0 ? Math.round((approvedDocs / totalDocs) * 100) : 0,
    trigger: 'GitHub Actions dispatch',
    createdAt: timestamp,
    updatedAt: timestamp,
    source: 'workspace',
    packageName: workspaceState.package_name || workspaceState.selected_package?.name || packageSignals.projectName || 'Selected package',
    packagePath: workspaceState.selected_package?.path || '',
    manifestPath: '',
    bddPaths: [],
    gapAnalysisPath: '',
    openFindings: openFindings.length,
    coveredFindings: coveredFindings.length,
    readinessScore: getReadinessScore({ gapResults, documents }),
  };
}

function normalizeRemoteRun(run, workspaceState) {
  if (!run) return null;
  const status = String(run.status || '').toLowerCase();
  const conclusion = String(run.conclusion || '').toLowerCase();
  return {
    runNumber: Number(run.run_number || 0),
    projectName: run.display_title || run.name || workspaceState.package_name || workspaceState.name || portalConfig.repo,
    status: status === 'completed'
      ? conclusion === 'success'
        ? 'success'
        : conclusion === 'failure'
          ? 'failure'
          : conclusion === 'cancelled'
            ? 'failure'
            : 'running'
      : 'running',
    age: formatRelativeTime(run.updated_at || run.created_at || new Date().toISOString()),
    branch: run.head_branch || workspaceState.branch || portalConfig.branch,
    mode: run.event || 'github',
    duration: formatDurationBetween(run.run_started_at || run.created_at, run.updated_at || run.completed_at),
    testsTotal: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    bddTotal: 0,
    bddCovered: 0,
    bddUncovered: 0,
    codeCoverage: 0,
    coverageAi: 0,
    trigger: run.event || 'GitHub',
    createdAt: run.created_at || run.updated_at || new Date().toISOString(),
    updatedAt: run.updated_at || run.completed_at || run.created_at || new Date().toISOString(),
    source: 'github',
    packageName: workspaceState.package_name || workspaceState.selected_package?.name || portalConfig.repo,
    packagePath: '',
    manifestPath: '',
    bddPaths: [],
    gapAnalysisPath: '',
    openFindings: 0,
    coveredFindings: 0,
    readinessScore: 0,
  };
}

async function loadRemoteWorkflowRuns() {
  try {
    const payload = await listWorkflowRuns(8);
    return Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
  } catch (_) {
    return [];
  }
}

function readLocalState() {
  return {
    workspaceState: sanitizeWorkspaceData(readJsonStorage(STORAGE_KEYS.workspace, DEFAULT_WORKSPACE)),
    latestRun: readJsonStorage(STORAGE_KEYS.latestRun, null),
    history: readJsonStorage(STORAGE_KEYS.history, []),
    documents: readDocuments(),
    gapResults: readGapResults(),
  };
}

function readDocuments() {
  const workspace = readJsonStorage(STORAGE_KEYS.workspace, DEFAULT_WORKSPACE);
  const documents = Array.isArray(workspace?.documents) ? workspace.documents : [];
  return documents;
}

function readGapResults() {
  const workspace = readJsonStorage(STORAGE_KEYS.workspace, DEFAULT_WORKSPACE);
  return workspace?.gapResults || null;
}

function sanitizeWorkspaceData(rawWorkspaceData) {
  const workspaceData = { ...DEFAULT_WORKSPACE, ...(rawWorkspaceData || {}) };
  return {
    ...workspaceData,
    package_file: null,
    brd_file: null,
    bdd_files: [],
    selected_package: workspaceData.selected_package
      ? {
          name: workspaceData.selected_package.name || '',
          path: workspaceData.selected_package.path || '',
          size: workspaceData.selected_package.size || '',
          sha: workspaceData.selected_package.sha || '',
          downloadUrl: workspaceData.selected_package.downloadUrl || '',
        }
      : null,
  };
}

function readJsonStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Best effort only.
  }
}

function getOpenFindings(gapResults) {
  if (!Array.isArray(gapResults?.findings)) return [];
  return gapResults.findings.filter((gap) => !isCoveredGap(gap));
}

function getCoveredFindings(gapResults) {
  if (!Array.isArray(gapResults?.findings)) return [];
  return gapResults.findings.filter((gap) => isCoveredGap(gap));
}

function isCoveredGap(gap) {
  const status = String(gap?.status || gap?.coverageStatus || '').toLowerCase();
  return status === 'covered' || status.includes('covered_after_regeneration');
}

function getReadinessScore({ gapResults, documents }) {
  const summaryScore = gapResults?.summary?.traceabilityScore;
  if (typeof summaryScore === 'number' && Number.isFinite(summaryScore)) {
    return clamp(Math.round(summaryScore), 0, 100);
  }

  const docCount = Array.isArray(documents) ? documents.length : 0;
  const approvedCount = Array.isArray(documents) ? documents.filter((doc) => doc.approved).length : 0;
  const openFindings = getOpenFindings(gapResults).length;
  const coveredFindings = getCoveredFindings(gapResults).length;
  if (!docCount && !openFindings && !coveredFindings) return 0;

  const approvalScore = docCount ? (approvedCount / docCount) * 55 : 0;
  const coverageScore = openFindings + coveredFindings > 0 ? (coveredFindings / (openFindings + coveredFindings)) * 45 : 45;
  return clamp(Math.round(approvalScore + coverageScore), 0, 100);
}

function getCoveragePercent(part, total) {
  if (!total) return 0;
  return clamp(Math.round((part / total) * 100), 0, 100);
}

function nextRunNumber() {
  if (typeof window === 'undefined') return Date.now();
  const current = Number(window.localStorage.getItem(STORAGE_KEYS.sequence) || '0');
  const next = current + 1;
  window.localStorage.setItem(STORAGE_KEYS.sequence, String(next));
  return next;
}

function peekRunNumber() {
  if (typeof window === 'undefined') return 1;
  const current = Number(window.localStorage.getItem(STORAGE_KEYS.sequence) || '0');
  return Math.max(1, current || 1);
}

function compareRuns(a, b) {
  const aTime = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
  const bTime = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
  if (bTime !== aTime) return bTime - aTime;
  return Number(b?.runNumber || 0) - Number(a?.runNumber || 0);
}

function getAverageDuration(runs) {
  const durations = runs
    .map((run) => parseDurationSeconds(run?.durationSeconds, run?.duration))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!durations.length) return 'Pending';
  const average = durations.reduce((total, value) => total + value, 0) / durations.length;
  return formatDuration(Math.round(average));
}

function parseDurationSeconds(durationSeconds, durationLabel) {
  if (Number.isFinite(durationSeconds) && durationSeconds > 0) return Number(durationSeconds);
  const text = String(durationLabel || '').trim();
  if (!text || text === 'pending') return NaN;
  const match = text.match(/(?:(\d+)m)?\s*(?:(\d+)s)?/i);
  if (!match) return NaN;
  const minutes = Number(match[1] || 0);
  const seconds = Number(match[2] || 0);
  const total = minutes * 60 + seconds;
  return total > 0 ? total : NaN;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return 'Pending';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${String(secs).padStart(2, '0')}s` : `${secs}s`;
}

function formatDurationBetween(start, end) {
  if (!start || !end) return 'pending';
  const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
  if (!Number.isFinite(diff) || diff <= 0) return 'pending';
  return formatDuration(Math.round(diff / 1000));
}

function formatRelativeTime(value) {
  if (!value) return 'just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diff = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatReadableSize(charCount) {
  const bytes = Number(charCount || 0);
  if (!bytes) return '0 KB';
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
}

function formatBytes(bytes) {
  const numeric = Number(bytes || 0);
  if (!numeric) return '0 KB';
  const kb = Math.max(1, Math.round(numeric / 1024));
  return `${kb} KB`;
}

function slugify(value) {
  return String(value || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'document';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
