import { portalConfig } from '@/config/portalConfig';
import {
  downloadArtifactArchive,
  getRepoFile,
  githubFetchBlob,
  getRepoTreeRecursive,
  listWorkflowRunArtifacts,
  listWorkflowRunJobs,
  listWorkflowRuns,
} from '@/services/githubApi';
import JSZip from 'jszip';

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
    livePipeline: null,
    preferredRunNumber: null,
  });
}

export async function loadDashboardSnapshot(options = {}) {
  const { selectedRunNumber = null } = options;
  const local = readLocalState();
  const livePipeline = await loadLivePipelineSnapshot({ selectedRunNumber });
  const remoteRuns = livePipeline?.runs || [];

  return buildDashboardSnapshot({
    workspaceState: local.workspaceState,
    documents: local.documents,
    gapResults: local.gapResults,
    latestRun: local.latestRun,
    history: local.history,
    remoteRuns,
    remoteAvailable: remoteRuns.length > 0,
    livePipeline,
    preferredRunNumber: selectedRunNumber,
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

function buildDashboardSnapshot({ workspaceState, documents, gapResults, latestRun, history, remoteRuns, remoteAvailable, livePipeline, preferredRunNumber = null }) {
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

  const runBundles = Array.isArray(livePipeline?.runBundles) ? livePipeline.runBundles : [];
  const bundleByRunId = new Map(runBundles.map((bundle) => [String(bundle.runId), bundle]));
  const remoteHistory = remoteRuns
    .map((run) => {
      const normalizedRun = normalizeRemoteRun(run, normalizedWorkspace);
      const bundle = bundleByRunId.get(String(run.id));
      return bundle
        ? hydrateRunFromLiveReports(normalizedRun, bundle.reports, bundle.manifest)
        : normalizedRun;
    })
    .filter(Boolean);
  const remoteSelectedRun = remoteHistory.find((run) => String(run.runNumber) === String(preferredRunNumber))
    || remoteHistory[0]
    || null;

  const localHistory = Array.isArray(history) ? history.filter(Boolean) : [];
  const runMap = new Map();

  const visibleHistory = remoteHistory.length
    ? remoteHistory
    : [...[localRun], ...localHistory].filter(Boolean);

  visibleHistory
    .filter(Boolean)
    .forEach((run) => {
      const key = `${run.source || 'local'}:${run.runNumber}:${run.createdAt || run.updatedAt || run.age}`;
      if (!runMap.has(key)) {
        runMap.set(key, run);
      }
    });

  const runs = [...runMap.values()].sort((a, b) => compareRuns(a, b));
  const selectedRun = remoteSelectedRun || localRun || runs[0] || null;
  const selectedBundle = selectedRun?.id
    ? bundleByRunId.get(String(selectedRun.id))
    : null;
  const liveReports = selectedBundle?.reports || {};
  const liveManifest = selectedBundle?.manifest || null;
  const liveJobs = Array.isArray(selectedBundle?.jobs) ? selectedBundle.jobs : [];
  const liveArtifacts = Array.isArray(selectedBundle?.artifacts) ? selectedBundle.artifacts : [];
  const workspaceArtifacts = Array.isArray(selectedBundle?.workspaceArtifacts) ? selectedBundle.workspaceArtifacts : [];
  const hydratedRun = hydrateRunFromLiveReports(selectedRun, liveReports, liveManifest);
  const pipelineJobs = liveJobs.length
    ? buildLivePipelineJobs(liveJobs)
    : buildPipelineJobs({
        selectedRun: hydratedRun,
        gapResults: gapState,
        documents: docList,
      });
  const hydratedRuns = runs.map((run) => {
    const bundle = bundleByRunId.get(String(run.id || ''));
    if (bundle?.reports || bundle?.manifest) {
      return {
        ...hydrateRunFromLiveReports(run, bundle.reports, bundle.manifest),
        pipelineJobs: buildLivePipelineJobs(bundle.jobs || []),
      };
    }
    return hydratedRun && isSamePipelineRun(run, hydratedRun)
      ? {
          ...mergeRunDetails(run, hydratedRun),
          pipelineJobs,
        }
      : run;
  });
  const statusSummary = buildStatusSummary({
    selectedRun: hydratedRun,
    approvedDocs,
    totalDocs,
    openFindings,
    coveredFindings,
    runHistory: hydratedRuns,
    gapResults: gapState,
  });
  const testRows = liveReports.qaReport
    ? buildLiveTestRows(liveReports.qaReport)
    : buildTestRows({ documents: docList, gapResults: gapState, workspaceState: normalizedWorkspace });
  const traceabilityReport = liveReports.requirementTraceability || liveReports.traceability;
  const bddScenarios = traceabilityReport
    ? buildLiveTraceabilityRows(traceabilityReport, liveReports.qaReport)
    : buildBddScenarios({ documents: docList, gapResults: gapState });
  const testScripts = liveReports.qaReport || liveReports.testScriptManifest
    ? buildLiveTestScripts(liveReports)
    : [];
  const reports = liveReports.reportFiles?.length
    ? buildLiveReports(liveReports.reportFiles, liveArtifacts)
    : buildReports({ selectedRun: hydratedRun, documents: docList, gapResults: gapState });
  const aiDetails = liveReports.qaReport || liveReports.progressStatus || liveReports.codeSuggestions
    ? buildLiveAiDetails(liveReports)
    : buildAiDetails({
        documents: docList,
        gapResults: gapState,
        latestRun: hydratedRun,
      });
  const codeQuality = liveReports.coverageGap || liveReports.codeSuggestions
    ? buildLiveCodeQuality(liveReports)
    : buildCodeQuality({
        workspaceState: normalizedWorkspace,
        documents: docList,
        gapResults: gapState,
      });
  const frontend = liveReports.browserSmoke || liveReports.frontendSmoke
    ? buildLiveFrontend(liveReports)
    : buildFrontend({
        workspaceState: normalizedWorkspace,
        documents: docList,
      });

  return {
    remoteAvailable,
    lastRefreshedAt: new Date().toISOString(),
    repo: {
      owner: portalConfig.owner,
      name: portalConfig.repo,
      updatedAt: formatRelativeTime(hydratedRun?.updatedAt || hydratedRun?.createdAt || new Date().toISOString()),
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
        selectedRun: hydratedRun,
        runHistory: hydratedRuns,
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
    workspace: liveManifest
      ? buildLiveWorkspace({
          manifest: liveManifest,
          artifacts: liveArtifacts,
          reports,
          selectedRun: hydratedRun,
          workspaceArtifacts,
        })
      : buildWorkspace({
          workspaceState: normalizedWorkspace,
          documents: docList,
          gapResults: gapState,
          selectedRun: hydratedRun,
        }),
    runs: hydratedRuns,
    selectedRun: hydratedRun
      ? {
          ...hydratedRun,
          pipelineJobs: hydratedRuns.find((run) => isSamePipelineRun(run, hydratedRun))?.pipelineJobs || pipelineJobs,
        }
      : null,
    pipelineJobs,
    testRows,
    bddScenarios,
    testScripts,
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

function buildLiveWorkspace({ manifest, artifacts, reports, selectedRun, workspaceArtifacts = [] }) {
  const metadata = manifest?.metadata || {};
  const gap = manifest?.gapAnalysis || null;
  const bdds = Array.isArray(manifest?.bdds) ? manifest.bdds : [];
  const source = formatRequirementSource(metadata.requirementSource);
  const uploadMode = inferUploadMode(manifest);
  const inferredPackageName = inferProjectNameFromReports(reports) || selectedRun?.projectName || selectedRun?.packageName || '';

  return {
    uploadSource: uploadMode,
    packageName: manifest?.packageName || inferredPackageName || 'GitHub package',
    platform: metadata.platform || 'Unknown',
    brdCount: Number(manifest?.brdCount || (manifest?.brd ? 1 : 0)),
    bddCount: Number(manifest?.bddCount || bdds.length),
    traceabilityStatus: selectedRun?.normalizedBddTotal
      ? `${selectedRun.normalizedBddTotal} total · ${selectedRun.bddFilteredOut || 0} filtered out · ${selectedRun.bddCovered || 0}/${selectedRun.bddTotal || 0} backend covered`
      : selectedRun?.bddTotal
        ? `${selectedRun.bddCovered}/${selectedRun.bddTotal} scenarios covered`
        : 'Waiting for report evidence',
    traceabilityStatus: selectedRun?.bddTotal
      ? `${selectedRun.bddCovered}/${selectedRun.bddTotal} backend scenarios covered`
      : 'Waiting for report evidence',
    gapCount: Number(gap?.openFindings || selectedRun?.openFindings || 0),
    approvalStatus: source,
    generatedAt: selectedRun?.updatedAt || selectedRun?.createdAt || manifest?.runId || 'Not available',
    requirementRoot: manifest?.requirementRoot || '',
    packagePath: manifest?.packagePath || '',
    manifestPath: manifest?.manifestPath || '',
    gapAnalysisPath: gap?.path || '',
    stages: [
      {
        label: 'Trigger',
        status: 'done',
        note: `${manifest?.triggeredBy || 'GitHub'} triggered ${selectedRun?.trigger || 'workflow'} for ${manifest?.packageName || 'the selected package'}`,
      },
      {
        label: 'Upload',
        status: manifest?.packagePath ? 'done' : 'warn',
        note: `${uploadMode}${manifest?.packagePath ? ` from ${manifest.packagePath}` : ''}`,
      },
      {
        label: 'Requirement selection',
        status: metadata.requirementSource ? 'done' : 'warn',
        note: `${source}${manifest?.requirementRoot ? ` under ${manifest.requirementRoot}` : ''}`,
      },
      {
        label: 'BRD',
        status: manifest?.brd ? 'done' : 'warn',
        note: manifest?.brd?.path || 'No BRD file recorded in the manifest',
      },
      {
        label: 'BDD',
        status: bdds.length ? 'done' : 'warn',
        note: `${bdds.length} BDD feature file${bdds.length === 1 ? '' : 's'} recorded`,
      },
      {
        label: 'Gap analysis',
        status: gap?.path ? 'done' : 'warn',
        note: gap?.path || 'No gap analysis file attached to this trigger',
      },
      {
        label: 'CI evidence',
        status: reports.length ? 'done' : 'warn',
        note: `${reports.length} report file${reports.length === 1 ? '' : 's'} available from GitHub Actions artifacts`,
      },
    ],
    artifacts: workspaceArtifacts.length
      ? workspaceArtifacts
      : [
          manifest?.manifestPath && buildRepoArtifact({ name: 'manifest.json', path: manifest.manifestPath, type: 'Manifest', size: manifest.runId || 'live repo file' }),
          manifest?.packagePath && buildRepoArtifact({ name: manifest.packageName || 'package', path: manifest.packagePath, type: 'Package', size: manifest.packagePath }),
          manifest?.brd?.path && buildRepoArtifact({ name: manifest.brd.name || 'BRD', path: manifest.brd.path, type: 'BRD', size: manifest.brd.path }),
          ...bdds.map((bdd, index) => buildRepoArtifact({
            name: bdd.name || `BDD feature ${index + 1}`,
            path: bdd.path,
            type: 'BDD',
            size: bdd.path || 'feature file',
          })),
          gap?.path && buildRepoArtifact({ name: gap.name || 'gap-analysis-report.md', path: gap.path, type: 'Gap analysis', size: `${gap.openFindings || 0} open findings` }),
        ].filter(Boolean),
  };
}

function buildRepoArtifact({ name, path, type, size }) {
  const filePath = String(path || '');
  return {
    name,
    path: filePath,
    size,
    type,
    viewHref: '',
    downloadHref: '',
    downloadName: filePath.split('/').pop() || name,
  };
}

function hydrateRunFromLiveReports(run, reports, manifest) {
  if (!run) return null;
  const qaSummary = reports?.qaReport?.summary || {};
  const traceabilityReport = reports?.requirementTraceability || reports?.traceability || {};
  const traceSummary = traceabilityReport?.summary || {};
  const aiMeta = reports?.generatedTestMeta || {};
  const frontend = reports?.browserSmoke || {};
  const rowSummary = summarizeQaRows(reports?.qaReport);
  const inferredProjectName = inferProjectNameFromReports(reports);
  const testsTotal = numberFrom(rowSummary.total, qaSummary.total_test_cases, qaSummary.plannedTestCases, qaSummary.total_unique_test_methods, run.testsTotal);
  const testsPassed = numberFrom(rowSummary.passed, qaSummary.passed, qaSummary.scripts_passed, run.testsPassed);
  const testsFailed = numberFrom(rowSummary.failed, qaSummary.failed, qaSummary.scripts_failed, qaSummary.errors, run.testsFailed);
  const testsSkipped = numberFrom(rowSummary.notRun, qaSummary.not_run, qaSummary.scripts_not_run, qaSummary.skipped, Math.max(0, testsTotal - testsPassed - testsFailed), run.testsSkipped);
  const bddTotal = numberFrom(traceSummary.scenarios, traceSummary.rows, traceSummary.scenarios_found, testsTotal, run.bddTotal);
  const bddCovered = numberFrom(traceSummary.covered_rows, traceSummary.covered_scenarios, qaSummary.covered_scenarios, testsPassed, run.bddCovered);
  const bddUncovered = numberFrom(traceSummary.uncovered_rows, traceSummary.uncovered_scenarios, qaSummary.uncovered_scenarios, Math.max(0, bddTotal - bddCovered), run.bddUncovered);
  const normalizedBddTotal = numberFrom(
    traceSummary.normalized_scenarios_total,
    Array.isArray(traceabilityReport?.normalized_scenarios) ? traceabilityReport.normalized_scenarios.length : undefined,
    Array.isArray(reports?.qaReport?.normalized_scenarios) ? reports.qaReport.normalized_scenarios.length : undefined,
    bddTotal,
    run.normalizedBddTotal
  );
  const bddFilteredOut = Math.max(0, normalizedBddTotal - bddTotal);
  const coverageAi = numberFrom(qaSummary.coverage_percent, bddTotal ? Math.round((bddCovered / bddTotal) * 100) : 0, run.coverageAi);
  return {
    ...run,
    projectName: cleanPackageName(manifest?.packageName) || inferredProjectName || run.projectName,
    packageName: manifest?.packageName || inferredProjectName || run.packageName,
    packagePath: manifest?.packagePath || run.packagePath,
    manifestPath: manifest?.manifestPath || run.manifestPath,
    gapAnalysisPath: manifest?.gapAnalysis?.path || run.gapAnalysisPath,
    bddPaths: Array.isArray(manifest?.bdds) ? manifest.bdds.map((bdd) => bdd.path).filter(Boolean) : run.bddPaths,
    testsTotal,
    testsPassed,
    testsFailed,
    testsSkipped,
    normalizedBddTotal,
    bddTotal,
    bddCovered,
    bddUncovered,
    bddFilteredOut,
    codeCoverage: numberFrom(reports?.coverageGap?.line_coverage, run.codeCoverage),
    coverageAi,
    openFindings: bddUncovered,
    coveredFindings: bddCovered,
    readinessScore: bddTotal ? clamp(Math.round((bddCovered / bddTotal) * 100), 0, 100) : run.readinessScore,
    frontendTotal: numberFrom(frontend.total_journeys),
    frontendPassed: numberFrom(frontend.passed_journeys),
    aiGenerated: numberFrom(qaSummary.generatedScriptCandidates, aiMeta.tests_generated_candidate_methods, qaSummary.generatedScripts),
    aiAccepted: numberFrom(qaSummary.acceptedGeneratedScripts, aiMeta.accepted_ai_tests, qaSummary.generatedScripts),
    aiRejected: numberFrom(qaSummary.rejectedGeneratedScripts, aiMeta.rejected_ai_tests),
  };
}

function summarizeQaRows(qaReport) {
  const rows = Array.isArray(qaReport?.trusted_test_cases)
    ? qaReport.trusted_test_cases
    : Array.isArray(qaReport?.test_cases)
      ? qaReport.test_cases
      : Array.isArray(qaReport?.tests)
        ? qaReport.tests
        : [];

  if (!rows.length) {
    return { total: 0, passed: 0, failed: 0, notRun: 0 };
  }

  return rows.reduce((summary, row) => {
    const status = normalizeExecutionStatus(row?.result || row?.executionStatus || row?.status);
    summary.total += 1;
    if (status === 'passed') {
      summary.passed += 1;
    } else if (status === 'failed') {
      summary.failed += 1;
    } else {
      summary.notRun += 1;
    }
    return summary;
  }, { total: 0, passed: 0, failed: 0, notRun: 0 });
}

function normalizeExecutionStatus(value) {
  const normalized = String(value || '').toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'passed' || normalized === 'success') return 'passed';
  if (normalized === 'failed' || normalized === 'failure' || normalized === 'error') return 'failed';
  if (normalized === 'skipped') return 'not_run';
  return 'not_run';
}

function isSamePipelineRun(left, right) {
  if (!left || !right) return false;
  if (left.id && right.id && String(left.id) === String(right.id)) return true;
  if (left.runNumber && right.runNumber && String(left.runNumber) === String(right.runNumber)) return true;
  return false;
}

function buildLivePipelineJobs(jobs) {
  return jobs
    .filter((job) => /detect|build|quality|publish|test|analysis/i.test(job.name || ''))
    .map((job) => {
      const conclusion = String(job.conclusion || '').toLowerCase();
      const status = String(job.status || '').toLowerCase();
      const normalizedStatus = status === 'completed'
        ? conclusion === 'success' || conclusion === 'skipped'
          ? 'success'
          : 'failure'
        : 'running';
      return {
        name: job.name || 'Pipeline job',
        status: normalizedStatus,
        duration: formatDurationBetween(job.started_at || job.created_at, job.completed_at || job.updated_at),
        summary: buildJobSummary(job),
        details: Array.isArray(job.steps)
          ? job.steps.slice(0, 5).map((step) => `${step.name}: ${step.conclusion || step.status || 'pending'}`)
          : [],
        artifacts: [],
      };
    });
}

function buildLiveTestRows(qaReport) {
  const rows = Array.isArray(qaReport?.trusted_test_cases)
    ? qaReport.trusted_test_cases
    : Array.isArray(qaReport?.test_cases)
      ? qaReport.test_cases
      : Array.isArray(qaReport?.tests)
        ? qaReport.tests
        : [];
  return rows.slice(0, 60).map((row) => ({
    id: row.testCaseId || row.id || row.title || row.scenario,
    suite: row.feature || row.class_name || row.testType || 'Test case',
    name: row.title || row.test_name || row.scenario || row.testCaseId || 'Recorded test',
    status: String(row.result || row.executionStatus || row.status || 'not_run').toLowerCase().replace(/\s+/g, '_'),
    type: row.testType || row.test_type || row.variantLabel || 'report-backed',
    source: row.source || row.automationStatus || 'GitHub artifact',
    testCaseId: row.testCaseId,
    scriptId: row.scriptId,
    scenarioId: row.scenarioId,
    automationTarget: row.automationTarget,
    automationReason: row.automationReason,
    automationStatus: row.automationStatus,
    priority: row.priority,
    preconditions: row.preconditions,
    steps: row.testSteps || row.steps,
    testData: row.testData || row.test_data,
    expectedResult: row.expectedResult || row.expected_result,
    description: row.description,
    technique: row.testDesignTechnique,
    failureReason: row.failureReason || row.failure_reason || row.reason,
    linkedScenarios: Array.isArray(row.linked_bdd_scenarios) ? row.linked_bdd_scenarios.length : undefined,
  }));
}

function buildLiveTraceabilityRows(traceability, qaReport) {
  const normalizedRows = Array.isArray(traceability?.normalized_scenarios)
    ? traceability.normalized_scenarios
    : Array.isArray(qaReport?.normalized_scenarios)
      ? qaReport.normalized_scenarios
      : [];
  const backendRows = Array.isArray(traceability?.scenario_records)
    ? traceability.scenario_records
    : Array.isArray(traceability?.records)
      ? traceability.records
      : [];
  const backendByScenarioId = new Map(
    backendRows
      .map((row) => [String(row?.scenarioId || '').trim(), row])
      .filter(([key]) => key)
  );
  const rows = normalizedRows.length ? normalizedRows : backendRows;
  return rows.slice(0, 120).map((row) => {
    const scenarioId = row.scenarioId || row.testCaseId || row.scriptId || row.scenario;
    const backendRow = backendByScenarioId.get(String(scenarioId || '').trim()) || null;
    const automationTarget = row.automationTarget || backendRow?.automationTarget || '';
    const isBackendScoped = ['backend', 'hybrid'].includes(String(automationTarget || '').toLowerCase());
    const isFilteredOut = normalizedRows.length ? !isBackendScoped : false;
    return {
      id: scenarioId,
      scenarioId,
      feature: row.feature || backendRow?.feature || row.featureId || 'Feature',
      name: row.scenario || backendRow?.scenario || row.name || row.scenarioId || 'Scenario',
      status: isFilteredOut
        ? 'filtered_out'
        : (isCoveredGap(backendRow || row) || String(backendRow?.coverageStatus || row.coverageStatus || '').toLowerCase() === 'covered'
          ? 'covered'
          : 'uncovered'),
      scenarioScope: isFilteredOut ? 'Filtered Out' : 'Backend / Hybrid',
      executionResult: isFilteredOut
        ? 'Filtered Out'
        : (backendRow?.executionStatus || row.executionResult || row.status || row.coverageStatus || 'Not recorded'),
      automationTarget,
      automationReason: row.automationReason || backendRow?.automationReason || '',
      priority: row.priority || backendRow?.priority || '',
      featureSequence: row.featureSequence,
      scenarioSequence: row.scenarioSequence,
      scenarioSequenceInFeature: row.scenarioSequenceInFeature,
      scriptType: backendRow?.scriptType || row.scriptType || row.test_type || row.type || 'traceability',
      testCaseId: backendRow?.testCaseId,
      scriptId: backendRow?.scriptId,
      file: backendRow?.file || row.file || row.sourceBddFile || row.source_feature_file,
      sourceBddFile: row.sourceBddFile || backendRow?.sourceBddFile || row.source_feature_file,
      sourceBrdFile: row.sourceBrdFile || backendRow?.sourceBrdFile,
      steps: row.steps || backendRow?.steps,
      expectedResult: row.expectedResult || row.expected_result || backendRow?.expectedResult || backendRow?.expected_result,
      coverageSource: isFilteredOut
        ? 'Removed from backend lane during normalization'
        : (backendRow?.coverageSource || backendRow?.coverage_source || row.coverageSource || row.coverage_source),
      linkedScripts: backendRow?.linkedScripts,
      linkedTestCaseIds: backendRow?.linkedTestCaseIds || [],
      linkedScriptIds: backendRow?.linkedScriptIds || [],
      isFilteredOut,
    };
  });
}

function buildLiveTestScripts(reports) {
  const manifestScripts = Array.isArray(reports?.testScriptManifest?.scripts) ? reports.testScriptManifest.scripts : [];
  const qaScripts = Array.isArray(reports?.qaReport?.test_scripts) ? reports.qaReport.test_scripts : [];
  const scripts = manifestScripts.length ? manifestScripts : qaScripts;
  return scripts.slice(0, 120).map((row) => ({
    id: row.scriptId || row.file || row.className,
    scriptId: row.scriptId,
    testCaseId: row.testCaseId,
    scenarioId: row.scenarioId,
    feature: row.feature || 'Feature',
    scenario: row.scenario || 'Scenario',
    file: row.file || row.generated_test_file || row.source_file,
    packageName: row.packageName,
    className: row.className,
    methodName: row.methodName || row.generated_test_method,
    qualifiedName: row.qualifiedName,
    scriptType: row.scriptType || row.testType,
    status: String(row.status || row.result || row.executionStatus || 'not_run').toLowerCase().replace(/\s+/g, '_'),
    result: row.result || row.executionResult || row.status,
    duration: row.duration || row.durationMs,
    failureReason: row.failureReason || row.reason,
  }));
}

function buildLiveReports(reportFiles, artifacts) {
  const artifactMap = new Map((artifacts || []).map((artifact) => [artifact.name, artifact]));
  return reportFiles
    .map((file) => (typeof file === 'string' ? { name: file } : file))
    .filter((file) => /\.(zip|json|html|xlsx|txt|xml|md|png|log|java)$/i.test(file.name || ''))
    .slice(0, 120)
    .map((file) => ({
      ...file,
      name: file.name,
      desc: describeReportFile(file.name),
      size: file.size ? formatBytes(file.size) : artifactMap.get(file.name)?.size_in_bytes ? formatBytes(artifactMap.get(file.name).size_in_bytes) : 'GitHub Actions artifact',
      type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
    }));
}

function buildLiveAiDetails(reports) {
  const summary = reports?.qaReport?.summary || {};
  const aiMeta = reports?.generatedTestMeta || {};
  const scriptManifest = reports?.testScriptManifest?.summary || {};
  const progress = reports?.progressStatus || {};
  const suggestions = Array.isArray(reports?.codeSuggestions?.findings) ? reports.codeSuggestions.findings : [];
  const generated = numberFrom(summary.generatedScriptCandidates, aiMeta.tests_generated_candidate_methods, scriptManifest.generatedScriptCandidates, summary.generatedScripts, progress.details?.generatedScripts);
  const executed = numberFrom(summary.acceptedGeneratedScripts, aiMeta.accepted_ai_tests, scriptManifest.acceptedGeneratedScripts, summary.automationReadyTestCases);
  const rejected = numberFrom(summary.rejectedGeneratedScripts, aiMeta.rejected_ai_tests, scriptManifest.rejectedGeneratedScripts, summary.automationRejectedTestCases, Math.max(0, generated - executed));
  return {
    generated,
    executed,
    rejected,
    accuracy: generated ? Math.round((executed / generated) * 100) : 0,
    progress: progress.status ? `${progress.phase || 'AI generation'} ${progress.status}` : 'No progress status artifact found',
    generationMode: aiMeta.generation_mode || reports?.generatedTestTraceability?.summary?.generation_mode || reports?.codeSuggestions?.generation_mode || 'artifact-driven',
    fallbackReason: reports?.codeSuggestions?.fallback_reason || '',
    rejectionReasons: Array.isArray(aiMeta.rejection_reasons) ? aiMeta.rejection_reasons : [],
    rejectionDetails: Array.isArray(aiMeta.rejection_details) ? aiMeta.rejection_details.slice(0, 12) : [],
    recommendations: suggestions.slice(0, 6).map((item) => ({
      severity: item.priority || 'medium',
      title: item.type || 'Quality recommendation',
      reason: item.message || String(item),
    })),
  };
}

function buildLiveCodeQuality(reports) {
  const coverage = reports?.coverageGap || {};
  const suggestions = Array.isArray(reports?.codeSuggestions?.findings) ? reports.codeSuggestions.findings : [];
  const classes = Array.isArray(coverage.classes_with_gaps) ? coverage.classes_with_gaps : [];
  const aiTests = Array.isArray(coverage.ai_tests) ? coverage.ai_tests.length : numberFrom(coverage.ai_tests);
  const existingTests = Array.isArray(coverage.existing_tests) ? coverage.existing_tests.length : numberFrom(coverage.existing_tests);
  return {
    coverageScope: coverage.coverage_scope || 'GitHub artifact',
    aiTests,
    existingTests,
    hotspotCount: classes.length,
    improvementCount: suggestions.length,
    verdict: classes.length ? 'Coverage gaps remain' : 'No coverage gap artifact findings',
    hotspots: classes.slice(0, 8).map((item) => ({
      name: item.class || item.name || 'Class',
      lineCoverage: numberFrom(item.line_coverage),
      branchCoverage: item.branch_coverage,
    })),
    findings: suggestions.slice(0, 8).map((item) => item.message || String(item)),
  };
}

function buildLiveFrontend(reports) {
  const smoke = reports?.browserSmoke || {};
  const detection = reports?.frontendSmoke || {};
  const qualitySummary = reports?.frontendQualitySummary || {};
  const testDesign = reports?.frontendTestDesign || {};
  const journeySuggestions = reports?.frontendJourneySuggestions || {};
  const traceability = reports?.frontendTraceability || {};
  const reportFiles = Array.isArray(reports?.reportFiles) ? reports.reportFiles : [];
  const reportByName = new Map(
    reportFiles.map((file) => [String(file?.name || '').split('/').pop(), file])
  );
  const journeys = Array.isArray(smoke.journeys) ? smoke.journeys : [];
  const designCases = Array.isArray(testDesign.frontend_test_cases) ? testDesign.frontend_test_cases : [];
  const traceabilityRecords = Array.isArray(traceability.records) ? traceability.records : [];
  const suggestedJourneys = Array.isArray(journeySuggestions.journeys) ? journeySuggestions.journeys : [];
  const screenshotGallery = journeys.flatMap((journey) => {
    const stepShots = Array.isArray(journey.steps)
      ? journey.steps
          .filter((step) => step?.screenshot)
          .map((step, index) => {
            const filename = String(step.screenshot || '').split('/').pop();
            const asset = reportByName.get(filename) || null;
            return {
              name: filename,
              journeyName: journey.name || 'Journey',
              stepName: step.name || `Step ${index + 1}`,
              stepType: step.type || '',
              status: step.status || journey.status || 'unknown',
              viewHref: asset?.viewHref || asset?.downloadHref || '',
              downloadHref: asset?.downloadHref || '',
              reportName: asset?.name || filename,
            };
          })
      : [];
    const failureFilename = String(journey.failure_screenshot || '').split('/').pop();
    const failureAsset = failureFilename ? reportByName.get(failureFilename) || null : null;
    const failureShot = failureFilename
      ? [{
          name: failureFilename,
          journeyName: journey.name || 'Journey',
          stepName: journey.failure_step || 'Failure evidence',
          stepType: 'failure',
          status: 'failure',
          viewHref: failureAsset?.viewHref || failureAsset?.downloadHref || '',
          downloadHref: failureAsset?.downloadHref || '',
          reportName: failureAsset?.name || failureFilename,
        }]
      : [];
    return [...stepShots, ...failureShot];
  });

  return {
    visual: smoke.status === 'pass' || detection.status === 'pass' ? 'Pass' : smoke.status || detection.status || 'No frontend artifact',
    detectionStatus: Array.isArray(detection.details) ? detection.details.join(', ') : detection.status || 'Not recorded',
    launchMode: smoke.launch_mode || 'Not recorded',
    url: smoke.url || '',
    title: smoke.title || '',
    applicationName: qualitySummary.application_name || smoke.application_name || 'Frontend application',
    configured: Boolean(smoke.configured),
    autoGeneratedConfigUsed: Boolean(smoke.auto_generated_config_used),
    journeyMode: smoke.journey_mode || '',
    configPath: smoke.config_path || '',
    contractVersion: smoke.contract_version || '',
    executionReason: smoke.reason || smoke.summary || '',
    totalJourneys: numberFrom(smoke.total_journeys),
    passedJourneys: numberFrom(smoke.passed_journeys),
    failedJourneys: numberFrom(smoke.failed_journeys),
    skippedJourneys: numberFrom(smoke.skipped_journeys),
    loadTime: smoke.summary || 'GitHub artifact',
    designSummary: testDesign.summary || qualitySummary.test_design_summary || {},
    journeySummary: journeySuggestions.summary || qualitySummary.journey_generation_summary || {},
    traceabilitySummary: traceability.summary || qualitySummary.traceability_summary || {},
    executionSummary: qualitySummary.execution_summary || smoke || {},
    journeys: journeys.map((journey) => ({
      ...journey,
      linkedTestCaseIds: Array.isArray(journey.frontend_test_case_ids) ? journey.frontend_test_case_ids : [],
      screenshots: screenshotGallery.filter((item) => item.journeyName === (journey.name || 'Journey')),
    })),
    designCases,
    traceabilityRecords,
    suggestedJourneys,
    screenshotGallery,
    frontendArtifactFiles: reportFiles.filter((file) => /^frontend\//i.test(String(file?.name || ''))),
    evidence: Array.isArray(smoke.journeys)
      ? smoke.journeys.flatMap((journey) => (journey.steps || []).map((step) => step.screenshot).filter(Boolean)).slice(0, 12)
      : [],
  };
}

function buildKeyMetrics({ workspaceState, documents, gapResults, selectedRun, runHistory, approvedDocs, totalDocs, openFindings, coveredFindings }) {
  if (Array.isArray(runHistory) && runHistory.some((run) => run?.source === 'github')) {
    const trustedRuns = runHistory.filter((run) => run?.source === 'github');
    const totalRuns = trustedRuns.length;
    const successCount = trustedRuns.filter((run) => run.status === 'success').length;
    const failureCount = trustedRuns.filter((run) => run.status === 'failure').length;
    const normalizedScenarios = trustedRuns.reduce((sum, run) => sum + Number(run.normalizedBddTotal || run.bddTotal || 0), 0);
    const coveredScenarios = trustedRuns.reduce((sum, run) => sum + Number(run.bddCovered || 0), 0);
    const totalScenarios = trustedRuns.reduce((sum, run) => sum + Number(run.bddTotal || 0), 0);
    const filteredScenarios = trustedRuns.reduce((sum, run) => sum + Number(run.bddFilteredOut || 0), 0);
    const totalTestCases = trustedRuns.reduce((sum, run) => sum + Number(run.testsTotal || 0), 0);
    const passedTestCases = trustedRuns.reduce((sum, run) => sum + Number(run.testsPassed || 0), 0);
    const notRunTestCases = trustedRuns.reduce((sum, run) => sum + Number(run.testsSkipped || 0), 0);
    const acceptedScripts = trustedRuns.reduce((sum, run) => sum + Number(run.aiAccepted || 0), 0);
    const generatedScripts = trustedRuns.reduce((sum, run) => sum + Number(run.aiGenerated || 0), 0);
    return [
      {
        icon: 'flask',
        label: 'Pipeline Runs',
        value: String(totalRuns),
        sub: `${successCount} successful · ${failureCount} failed`,
        tone: 'violet',
      },
      {
        icon: 'trend',
        label: 'Successful Runs',
        value: `${successCount}/${totalRuns || 1}`,
        sub: `${totalRuns ? Math.round((successCount / totalRuns) * 100) : 0}% success rate`,
        tone: 'emerald',
      },
      {
        icon: 'branch',
        label: 'Scenario Coverage',
        value: `${coveredScenarios}/${totalScenarios || 0}`,
        sub: `${Math.max(0, totalScenarios - coveredScenarios)} uncovered scenarios`,
        tone: 'indigo',
      },
      {
        icon: 'bot',
        label: 'Total Test Cases',
        value: String(totalTestCases),
        sub: `${passedTestCases} passed · ${notRunTestCases} not run`,
        tone: 'fuchsia',
      },
      {
        icon: 'shield',
        label: 'AI Generated Test Scripts',
        value: `${acceptedScripts}/${generatedScripts || 0}`,
        sub: 'accepted / generated',
        tone: 'teal',
      },
    ];
  }

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
  const liveRun = selectedRun?.source === 'github';
  const readyScore = liveRun
    ? Number(selectedRun?.readinessScore || selectedRun?.coverageAi || 0)
    : getReadinessScore({ gapResults, documents: [] });
  const activeOpenFindings = liveRun ? Number(selectedRun?.openFindings || 0) : openFindings;
  const activeCoveredFindings = liveRun ? Number(selectedRun?.coveredFindings || 0) : coveredFindings;
  const completedRuns = runHistory.filter((run) => ['success', 'failure'].includes(String(run?.status || '').toLowerCase()));
  const successRate = completedRuns.length
    ? Math.round((completedRuns.filter((run) => String(run.status).toLowerCase() === 'success').length / completedRuns.length) * 100)
    : totalDocs > 0
      ? Math.round((approvedDocs / totalDocs) * 100)
      : 0;
  const avgDuration = getAverageDuration(runHistory);
  const readinessLabel = readyScore >= 85
    ? 'Healthy'
    : activeOpenFindings > 0
      ? 'Needs Review'
      : approvedDocs > 0
        ? 'In Progress'
        : 'Draft';

  return {
    readiness: readyScore,
    readinessLabel,
    successRate,
    activeIssues: activeOpenFindings || Math.max(0, runHistory.filter((run) => String(run.status || '').toLowerCase() === 'failure').length),
    avgDuration,
    statusHeadline: liveRun
      ? readinessLabel === 'Healthy'
        ? 'Latest GitHub CI evidence is healthy'
        : 'Latest GitHub CI evidence needs review'
      : readinessLabel === 'Healthy'
        ? 'Release readiness is healthy'
        : readinessLabel === 'Needs Review'
          ? 'Release readiness needs attention'
          : 'Workspace is still being prepared',
    statusBody: buildStatusBody({
      selectedRun,
      approvedDocs,
      totalDocs,
      openFindings: activeOpenFindings,
      coveredFindings: activeCoveredFindings,
      readinessLabel,
    }),
  };
}

function buildStatusBody({ selectedRun, approvedDocs, totalDocs, openFindings, coveredFindings, readinessLabel }) {
  const packageName = selectedRun?.packageName || selectedRun?.projectName || 'the active workspace';
  if (selectedRun?.source === 'github') {
    return `${packageName} is populated from the latest main GitHub Actions run, including workflow jobs, repository manifest files, and published quality-report artifacts.`;
  }
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
  const displayTitle = String(run.display_title || '').trim();
  const workflowName = String(run.name || 'Main CI').trim();
  const workspacePackage = workspaceState.package_name || workspaceState.selected_package?.name || '';
  const runDisplayProject = /^ci pipeline$/i.test(displayTitle) ? '' : cleanPackageName(displayTitle);
  const projectName = runDisplayProject
    || cleanPackageName(workspacePackage)
    || portalConfig.repo;
  return {
    id: run.id,
    runNumber: Number(run.run_number || 0),
    projectName,
    workflowName,
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
    normalizedBddTotal: 0,
    bddTotal: 0,
    bddCovered: 0,
    bddUncovered: 0,
    bddFilteredOut: 0,
    codeCoverage: 0,
    coverageAi: 0,
    trigger: run.event || 'GitHub',
    createdAt: run.created_at || run.updated_at || new Date().toISOString(),
    updatedAt: run.updated_at || run.completed_at || run.created_at || new Date().toISOString(),
    source: 'github',
    packageName: workspacePackage || portalConfig.repo,
    packagePath: '',
    manifestPath: '',
    bddPaths: [],
    gapAnalysisPath: '',
    openFindings: 0,
    coveredFindings: 0,
    readinessScore: 0,
  };
}

async function loadLivePipelineSnapshot({ selectedRunNumber = null } = {}) {
  try {
    const primaryRuns = await listPrimaryWorkflowRunsSinceYesterday();
    const latestRun = primaryRuns.find((run) => String(run.run_number) === String(selectedRunNumber)) || primaryRuns[0] || null;
    if (!latestRun) {
      return { runs: [], jobs: [], artifacts: [], reports: {}, manifest: null, runBundles: [] };
    }

    const manifests = await loadRequirementManifests().catch(() => []);
    const runBundles = await Promise.all(
      primaryRuns.map(async (run) => {
        const [jobsPayload, artifactsPayload] = await Promise.all([
          listWorkflowRunJobs(run.id).catch(() => ({ jobs: [] })),
          listWorkflowRunArtifacts(run.id).catch(() => ({ artifacts: [] })),
        ]);
        const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
        const artifacts = Array.isArray(artifactsPayload?.artifacts) ? artifactsPayload.artifacts : [];
        const includeDownloads = run.id === latestRun.id;
        const reports = await loadQualityReportsFromArtifacts(artifacts, { includeDownloads }).catch(() => ({}));
        const manifest = pickManifestForRun({
          manifests,
          run,
          reportBundle: reports,
        });
        const workspaceArtifacts = includeDownloads
          ? await loadWorkspaceArtifactsForManifest(manifest).catch(() => [])
          : [];
        return {
          runId: run.id,
          jobs,
          artifacts,
          reports,
          manifest,
          workspaceArtifacts,
        };
      })
    );
    const selectedBundle = runBundles.find((bundle) => String(bundle.runId) === String(latestRun.id)) || {
      artifacts: [],
      reports: {},
      manifest: null,
      jobs: [],
      workspaceArtifacts: [],
    };

    return {
      runs: primaryRuns,
      selectedRun: latestRun,
      jobs: selectedBundle.jobs || [],
      artifacts: selectedBundle.artifacts,
      reports: selectedBundle.reports,
      manifest: selectedBundle.manifest,
      workspaceArtifacts: selectedBundle.workspaceArtifacts || [],
      runBundles,
    };
  } catch (_) {
    return { runs: [], jobs: [], artifacts: [], reports: {}, manifest: null, workspaceArtifacts: [], runBundles: [] };
  }
}

async function listPrimaryWorkflowRunsSinceYesterday() {
  const perPage = 50;
  const maxPages = 6;
  const cutoff = getYesterdayStart();
  const collected = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const payload = await listWorkflowRuns(perPage, page);
    const runs = Array.isArray(payload?.workflow_runs) ? payload.workflow_runs : [];
    if (!runs.length) break;

    for (const run of runs) {
      if (!isPrimaryCiWorkflowRun(run)) continue;
      const runDate = new Date(run.created_at || run.run_started_at || run.updated_at || 0);
      if (Number.isNaN(runDate.getTime())) continue;
      if (runDate < cutoff) {
        return collected;
      }
      collected.push(run);
    }

    if (runs.length < perPage) break;
  }

  return collected;
}

function getYesterdayStart(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 1);
  return start;
}

async function loadWorkspaceArtifactsForManifest(manifest) {
  if (!manifest) return [];
  const bdds = Array.isArray(manifest?.bdds) ? manifest.bdds : [];
  const gap = manifest?.gapAnalysis || null;
  const candidates = [
    manifest?.manifestPath && { name: 'manifest.json', path: manifest.manifestPath, type: 'Manifest', size: manifest.runId || 'live repo file' },
    manifest?.packagePath && { name: manifest.packageName || 'package', path: manifest.packagePath, type: 'Package', size: manifest.packagePath },
    manifest?.brd?.path && { name: manifest.brd.name || 'BRD', path: manifest.brd.path, type: 'BRD', size: manifest.brd.path },
    ...bdds.map((bdd, index) => ({
      name: bdd.name || `BDD feature ${index + 1}`,
      path: bdd.path,
      type: 'BDD',
      size: bdd.path || 'feature file',
    })),
    gap?.path && { name: gap.name || 'gap-analysis-report.md', path: gap.path, type: 'Gap analysis', size: `${gap.openFindings || 0} open findings` },
  ].filter(Boolean);

  return await Promise.all(candidates.map((candidate) => loadRepoArtifactContent(candidate)));
}

async function loadRepoArtifactContent({ name, path, type, size }) {
  const fallback = buildRepoArtifact({ name, path, type, size });
  try {
    const file = await getRepoFile(path, portalConfig.branch);
    const content = String(file?.content || '').replace(/\s/g, '');
    const mimeType = mimeTypeForFile(path || name);
    if (content) {
      const dataHref = `data:${mimeType};base64,${content}`;
      return {
        ...fallback,
        size: size || formatBytes(file?.size || 0),
        downloadHref: dataHref,
        viewHref: isViewableMimeType(mimeType) ? dataHref : '',
      };
    }
    if (file?.download_url) {
      const blob = await githubFetchBlob(file.download_url);
      const buffer = await blob.arrayBuffer();
      const dataHref = `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
      return {
        ...fallback,
        size: size || formatBytes(blob.size || 0),
        downloadHref: dataHref,
        viewHref: isViewableMimeType(mimeType) ? dataHref : '',
      };
    }
    return fallback;
  } catch (_) {
    return fallback;
  }
}

function isPrimaryCiWorkflowRun(run) {
  const workflowName = String(run?.name || '').toLowerCase();
  const workflowPath = String(run?.path || '').toLowerCase();
  return workflowName === 'ci pipeline' || workflowPath.endsWith('/ci.yml') || workflowPath.includes('.github/workflows/ci.yml');
}

async function loadRequirementManifests() {
  const treePayload = await getRepoTreeRecursive(portalConfig.branch);
  const tree = Array.isArray(treePayload?.tree) ? treePayload.tree : [];
  const manifestPaths = tree
    .filter((item) => item.type === 'blob' && new RegExp(`^${escapeRegExp(portalConfig.requirementDir)}/[^/]+/manifest\\.json$`).test(item.path || ''))
    .map((item) => item.path)
    .sort()
    .reverse()
    .slice(0, 20);

  const manifests = await Promise.all(
    manifestPaths.map(async (path) => {
      try {
        const file = await getRepoFile(path, portalConfig.branch);
        const parsed = parseRepoJsonFile(file);
        return parsed ? { ...parsed, manifestPath: path } : null;
      } catch (_) {
        return null;
      }
    })
  );
  return manifests.filter(Boolean);
}

async function loadQualityReportsFromArtifacts(artifacts, options = {}) {
  const { includeDownloads = true } = options;
  const qualityArtifact = [...artifacts]
    .filter((artifact) => /quality|report/i.test(artifact.name || ''))
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0];
  if (!qualityArtifact?.archive_download_url) {
    return { reportFiles: [] };
  }

  const blob = await downloadArtifactArchive(qualityArtifact.archive_download_url);
  const archiveBuffer = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(archiveBuffer);
  const reportEntryNames = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir)
    .sort();
  const reportFiles = includeDownloads
    ? [
        {
          name: `${qualityArtifact.name || 'quality-reports'}.zip`,
          size: archiveBuffer.byteLength,
          mimeType: 'application/zip',
          downloadName: `${qualityArtifact.name || 'quality-reports'}.zip`,
          downloadHref: `data:application/zip;base64,${arrayBufferToBase64(archiveBuffer)}`,
          bundle: true,
        },
        ...(await Promise.all(reportEntryNames.map(async (entryName) => {
          const name = stripFinalReportPrefix(entryName);
          const entry = zip.files[entryName];
          const base64 = await entry.async('base64');
          return {
            name,
            size: base64ToByteLength(base64),
            mimeType: mimeTypeForFile(name),
            downloadName: name.split('/').pop() || name,
            downloadHref: `data:${mimeTypeForFile(name)};base64,${base64}`,
          };
        }))),
      ]
    : [{ name: `${qualityArtifact.name || 'quality-reports'}.zip`, size: archiveBuffer.byteLength, bundle: true }];
  const readJson = async (patterns, options = {}) => {
    const entryName = findZipEntry(zip, patterns, options);
    if (!entryName) return null;
    try {
      return JSON.parse(await zip.files[entryName].async('string'));
    } catch (_) {
      return null;
    }
  };

  return {
    artifactName: qualityArtifact.name,
    artifactSize: qualityArtifact.size_in_bytes,
    reportFiles,
    qaReport: await readJson([/qa-test-case-report\.json$/i], { preferRoot: true }),
    traceability: await readJson([/traceability-validation-matrix\.json$/i, /requirement-traceability\.json$/i]),
    requirementTraceability: await readJson([/requirement-traceability\.json$/i]),
    generatedTestMeta: await readJson([/ai-generation\/GeneratedTestMeta\.json$/i, /GeneratedTestMeta\.json$/i]),
    generatedTestTraceability: await readJson([/ai-generation\/GeneratedTestTraceability\.json$/i, /GeneratedTestTraceability\.json$/i]),
    testScriptManifest: await readJson([/test-script-manifest\.json$/i]),
    coverageGap: await readJson([/coverage-gap-analysis\.json$/i]),
    codeSuggestions: await readJson([/code-improvement-suggestions\.json$/i]),
    progressStatus: await readJson([/ai-generation\/progress-status\.json$/i, /progress-status\.json$/i]),
    browserSmoke: await readJson([/frontend\/browser-smoke-report\.json$/i, /browser-smoke-report\.json$/i]),
    frontendSmoke: await readJson([/frontend\/frontend-smoke-report\.json$/i, /frontend-smoke-report\.json$/i]),
    frontendQualitySummary: await readJson([/frontend\/frontend-quality-summary\.json$/i, /frontend-quality-summary\.json$/i]),
    frontendTestDesign: await readJson([/frontend\/frontend-test-design\.json$/i, /frontend-test-design\.json$/i]),
    frontendJourneySuggestions: await readJson([/frontend\/frontend-journey-suggestions\.json$/i, /frontend-journey-suggestions\.json$/i]),
    frontendTraceability: await readJson([/frontend\/frontend-traceability\.json$/i, /frontend-traceability\.json$/i]),
  };
}

function base64ToByteLength(value) {
  const text = String(value || '');
  if (!text) return 0;
  const padding = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((text.length * 3) / 4) - padding);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function mimeTypeForFile(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.html')) return 'text/html';
  if (lower.endsWith('.md')) return 'text/markdown';
  if (lower.endsWith('.feature')) return 'text/plain';
  if (lower.endsWith('.txt') || lower.endsWith('.log')) return 'text/plain';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.java')) return 'text/plain';
  if (lower.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
}

function isViewableMimeType(mimeType) {
  return /^text\//.test(mimeType)
    || /^image\//.test(mimeType)
    || mimeType === 'application/json'
    || mimeType === 'text/markdown'
    || mimeType === 'application/pdf';
}

function repoBlobUrl(path) {
  return `https://github.com/${portalConfig.owner}/${portalConfig.repo}/blob/${portalConfig.branch}/${encodeURI(String(path || ''))}`;
}

function repoRawUrl(path) {
  return `https://raw.githubusercontent.com/${portalConfig.owner}/${portalConfig.repo}/${portalConfig.branch}/${encodeURI(String(path || ''))}`;
}

function findZipEntry(zip, patterns, options = {}) {
  const matches = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && patterns.some((pattern) => pattern.test(stripFinalReportPrefix(name))))
    .sort((left, right) => scoreZipEntry(left, options) - scoreZipEntry(right, options));
  return matches[0];
}

function scoreZipEntry(name, options = {}) {
  const normalized = stripFinalReportPrefix(name);
  const depth = normalized.split('/').length;
  const isAiGeneration = normalized.startsWith('ai-generation/');
  const isRoot = depth === 1;
  let score = depth * 10;
  if (options.preferRoot) {
    if (isRoot) score -= 50;
    if (isAiGeneration) score += 50;
  }
  return score;
}

function stripFinalReportPrefix(path) {
  return String(path || '').replace(/^final-quality-reports\//, '');
}

function pickManifestForRun({ manifests, run, reportBundle }) {
  if (!Array.isArray(manifests) || !manifests.length) return null;
  const runTitle = String(run?.display_title || '').toLowerCase();
  const titleMatch = manifests.find((manifest) => runTitle && runTitle.includes(String(manifest.runId || manifest.packageName || '').toLowerCase()));
  if (titleMatch) return titleMatch;

  const qaReportText = JSON.stringify(reportBundle?.qaReport || {});
  const reportMatch = manifests.find((manifest) => manifest.runId && qaReportText.includes(manifest.runId));
  if (reportMatch) return reportMatch;

  const traceabilityText = JSON.stringify(reportBundle?.requirementTraceability || reportBundle?.traceability || {});
  const traceabilityMatch = manifests.find((manifest) => {
    const requirementRoot = String(manifest.requirementRoot || '').trim();
    const packageName = String(manifest.packageName || '').trim();
    return (
      (requirementRoot && traceabilityText.includes(requirementRoot))
      || (packageName && traceabilityText.includes(packageName))
    );
  });
  if (traceabilityMatch) return traceabilityMatch;

  return null;
}

function parseRepoJsonFile(file) {
  try {
    const content = String(file?.content || '').replace(/\s/g, '');
    if (!content) return null;
    return JSON.parse(decodeBase64Utf8(content));
  } catch (_) {
    return null;
  }
}

function decodeBase64Utf8(value) {
  if (typeof atob === 'function') {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return '';
}

function numberFrom(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function cleanPackageName(value) {
  return String(value || '').replace(/\.(zip|jar|war|ear)$/i, '').trim();
}

function inferProjectNameFromReports(reports) {
  const candidates = [];
  const traceability = reports?.requirementTraceability || reports?.traceability || {};
  const normalized = Array.isArray(traceability?.normalized_scenarios) ? traceability.normalized_scenarios : [];
  const scenarioRecords = Array.isArray(traceability?.scenario_records) ? traceability.scenario_records : [];

  normalized.forEach((item) => {
    candidates.push(item?.sourceBddFile, item?.sourceBrdFile);
  });
  scenarioRecords.forEach((item) => {
    candidates.push(item?.sourceBddFile, item?.sourceBrdFile);
  });

  for (const value of candidates) {
    const text = String(value || '');
    const match = text.match(/packages\/requirements\/([^/]+)-\d{14}\//i);
    if (match?.[1]) return cleanPackageName(match[1]);
  }
  return '';
}

function formatRequirementSource(value) {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'uploaded') return 'Manual/uploaded requirements';
  if (normalized === 'generated') return 'AI-generated requirements';
  if (normalized === 'manual') return 'Manual requirement selection';
  return value ? String(value) : 'Requirement source not recorded';
}

function inferUploadMode(manifest) {
  const packagePath = String(manifest?.packagePath || '');
  if (packagePath.includes('/_chunks/')) return 'Fresh upload via chunked package upload';
  if (packagePath.startsWith(portalConfig.uploadDir)) return 'Fresh upload or selected uploaded package';
  if (manifest?.triggeredBy === 'react-portal') return 'VeriSpace portal trigger';
  return 'GitHub repository package';
}

function buildJobSummary(job) {
  const name = String(job?.name || '').toLowerCase();
  if (name.includes('detect')) return 'Resolves the package, BRD, BDD, gap-analysis inputs, and platform signals.';
  if (name.includes('backend')) return 'Generates backend test evidence, traceability, AI metadata, and quality reports.';
  if (name.includes('frontend')) return 'Runs frontend smoke and browser journey checks when UI signals are present.';
  if (name.includes('publish')) return 'Consolidates published quality reports into the GitHub Actions artifact bundle.';
  if (name.includes('build')) return 'Builds the detected Java/Maven project before quality evidence is published.';
  return 'Main CI workflow job from GitHub Actions.';
}

function describeReportFile(name) {
  const value = String(name || '');
  if (/quality-reports.*\.zip$/i.test(value)) return 'Complete GitHub Actions quality-report artifact bundle.';
  if (/qa-test-case-report\.json$/i.test(value)) return 'Test case execution and AI script acceptance evidence.';
  if (/qa-test-case-report\.xlsx$/i.test(value)) return 'Excel handoff version of the QA test report.';
  if (/traceability|requirement-traceability/i.test(value)) return 'BDD scenario, test case, script, and execution traceability evidence.';
  if (/coverage-gap-analysis/i.test(value)) return 'Class and method coverage gaps found after CI execution.';
  if (/code-improvement-suggestions/i.test(value)) return 'Generated quality recommendations for uncovered or weak areas.';
  if (/frontend-quality-summary/i.test(value)) return 'Phase-by-phase frontend quality summary across design, generation, traceability, and execution.';
  if (/frontend-test-design/i.test(value)) return 'Frontend test design cases derived from BRD, BDD, and UI-aware code analysis.';
  if (/frontend-journey-suggestions/i.test(value)) return 'AI-generated Selenium journey plan with confidence, selectors, and review notes.';
  if (/frontend-traceability/i.test(value)) return 'Frontend test-case-to-journey traceability evidence with coverage status.';
  if (/browser-smoke-report/i.test(value)) return 'Browser journey execution evidence and screenshots.';
  if (/frontend-smoke-report/i.test(value)) return 'Frontend detection and smoke readiness report.';
  if (/final-test-report\.html$/i.test(value)) return 'Published HTML summary report from the pipeline.';
  return 'Published file from the GitHub Actions quality-report artifact.';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readLocalState() {
  const storedWorkspace = readJsonStorage(STORAGE_KEYS.workspace, DEFAULT_WORKSPACE);
  const workspaceContainer = storedWorkspace && typeof storedWorkspace === 'object' ? storedWorkspace : {};
  const workspaceData = workspaceContainer.workspaceData && typeof workspaceContainer.workspaceData === 'object'
    ? workspaceContainer.workspaceData
    : workspaceContainer;
  return {
    workspaceState: sanitizeWorkspaceData(workspaceData),
    latestRun: readJsonStorage(STORAGE_KEYS.latestRun, null),
    history: readJsonStorage(STORAGE_KEYS.history, []),
    documents: Array.isArray(workspaceContainer.documents) ? workspaceContainer.documents : [],
    gapResults: workspaceContainer.gapResults || null,
  };
}

function mergeRunDetails(primary, fallback) {
  if (!primary && !fallback) return null;
  if (!primary) return fallback;
  if (!fallback) return primary;

  const merged = {
    ...fallback,
    ...primary,
  };

  const metricKeys = ['testsTotal', 'testsPassed', 'testsFailed', 'testsSkipped', 'normalizedBddTotal', 'bddFilteredOut', 'bddTotal', 'bddCovered', 'bddUncovered', 'codeCoverage', 'coverageAi', 'aiGenerated', 'aiAccepted', 'aiRejected'];
  for (const key of metricKeys) {
    const fallbackValue = Number(fallback[key]);
    const primaryValue = Number(primary[key]);
    if (Number.isFinite(fallbackValue) && fallbackValue > 0) {
      merged[key] = fallbackValue;
    } else if (Number.isFinite(primaryValue) && primaryValue > 0) {
      merged[key] = primaryValue;
    }
  }

  merged.status = primary.status || fallback.status || 'running';
  merged.age = primary.age || fallback.age || 'just now';
  merged.branch = primary.branch || fallback.branch || portalConfig.branch;
  merged.trigger = primary.trigger || fallback.trigger || 'GitHub Actions dispatch';
  merged.duration = primary.duration && primary.duration !== 'pending' ? primary.duration : fallback.duration || 'pending';
  merged.updatedAt = primary.updatedAt || fallback.updatedAt || new Date().toISOString();
  merged.createdAt = primary.createdAt || fallback.createdAt || merged.updatedAt;

  return merged;
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
