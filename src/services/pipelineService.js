import { portalConfig } from '@/config/portalConfig';
import { createUploadRelease, dispatchRepositoryEvent, listRepoContents, uploadReleaseAsset, upsertRepoFile } from '@/services/githubApi';
import { fileToBase64, safeFileName, slugSafeId, toBase64, uniquePortalRunId } from '@/services/encoding';
import { buildBddUploadFiles, buildBrdUploadFile } from '@/services/documentService';

const LARGE_PACKAGE_RELEASE_THRESHOLD_BYTES = 20 * 1024 * 1024;

export async function listUploadedPackages() {
  const items = await listRepoContents(portalConfig.uploadDir, portalConfig.branch);
  return items
    .filter((item) => item.type === 'file' && /\.(zip|jar|war|ear)$/i.test(item.name))
    .map((item) => ({
      name: item.name,
      path: item.path,
      size: item.size,
      sha: item.sha,
      downloadUrl: item.download_url,
    }));
}

export async function uploadWorkspaceInputs({ packageFile, selectedPackage, documents, gapResults, metadata = {} }) {
  if (!packageFile && !selectedPackage?.name) {
    throw new Error('Select or upload a package before triggering the pipeline.');
  }

  const packageName = safeFileName(packageFile?.name || selectedPackage.name);
  const runId = uniquePortalRunId(packageName);
  const packagePath = packageFile
    ? `${portalConfig.uploadDir}/${packageName}`
    : selectedPackage?.path || `${portalConfig.uploadDir}/${packageName}`;
  const useReleasePackageUpload = Boolean(packageFile && packageFile.size > LARGE_PACKAGE_RELEASE_THRESHOLD_BYTES);
  const requirementRoot = `${portalConfig.requirementDir}/${runId}`;
  const artifactMeta = {
    triggeredBy: 'react-portal',
    packageName,
    runId,
    requirementRoot,
    packagePath,
    brdCount: documents.filter((doc) => doc.type === 'BRD').length,
    bddCount: documents.filter((doc) => doc.type === 'BDD').length,
    metadata: {
      platform: metadata.platform || 'Java',
      version: metadata.version || 'unversioned',
      environment: metadata.environment || 'dev',
      requirementSource: metadata.requirementSource || 'generated',
    },
  };
  const packageContentBase64 = packageFile && !useReleasePackageUpload ? await fileToBase64(packageFile) : '';
  const releaseUpload = useReleasePackageUpload
    ? await uploadLargePackageToRelease({ packageFile, packageName, runId })
    : null;

  const brdFile = buildBrdUploadFile(documents);
  const brdPath = brdFile?.content ? `${requirementRoot}/brd/${safeFileName(brdFile.name, 'brd.md')}` : '';
  const brdContentBase64 = brdFile?.content ? toBase64(brdFile.content) : '';
  const gapAnalysisFile = buildGapAnalysisUploadFile(gapResults, { packageName, runId, requirementRoot });
  const gapAnalysisPath = gapAnalysisFile?.content
    ? `${requirementRoot}/gap-analysis/${safeFileName(gapAnalysisFile.name, 'gap-analysis-report.md')}`
    : '';
  const gapAnalysisContentBase64 = gapAnalysisFile?.content ? toBase64(gapAnalysisFile.content) : '';

  const bddFiles = buildBddUploadFiles(documents).filter((item) => item.content?.trim());
  if (!bddFiles.length) {
    throw new Error('At least one BDD feature file is required before triggering the pipeline.');
  }

  const bddPaths = [];
  const bddContent = [];
  for (const [index, bdd] of bddFiles.entries()) {
    const bddPath = `${requirementRoot}/bdd/${String(index + 1).padStart(2, '0')}-${safeFileName(bdd.name, `bdd-${index + 1}.feature`)}`;
    bddPaths.push(bddPath);
    bddContent.push(toBase64(bdd.content));
  }

  const manifest = {
    ...artifactMeta,
    brd: brdFile ? {
      name: brdFile.name,
      path: brdPath,
    } : null,
    bdds: bddPaths.map((path, index) => ({
      name: bddFiles[index]?.name || `bdd-${index + 1}.feature`,
      path,
    })),
    gapAnalysis: gapAnalysisFile ? {
      name: gapAnalysisFile.name,
      path: gapAnalysisPath,
      openFindings: gapAnalysisFile.openFindings,
      coveredFindings: gapAnalysisFile.coveredFindings,
    } : null,
  };
  const manifestPath = `${requirementRoot}/manifest.json`;

  const uploads = [];
  if (packageFile && !useReleasePackageUpload) {
    uploads.push({
      label: 'source package',
      path: packagePath,
      contentBase64: packageContentBase64,
      message: `chore: upload package ${packageName}`,
      branch: portalConfig.branch,
    });
  }

  if (brdFile?.content) {
    uploads.push({
      label: 'BRD artifact',
      path: brdPath,
      contentBase64: brdContentBase64,
      message: `chore: upload BRD ${brdFile.name}`,
      branch: portalConfig.branch,
    });
  }

  bddFiles.forEach((bdd, index) => {
    const path = bddPaths[index];
    const contentBase64 = bddContent[index];
    if (!path || !contentBase64) return;
    uploads.push({
      label: `BDD artifact ${index + 1}`,
      path,
      contentBase64,
      message: `chore: upload BDD ${bdd.name}`,
      branch: portalConfig.branch,
    });
  });

  if (gapAnalysisFile?.content) {
    uploads.push({
      label: 'gap analysis artifact',
      path: gapAnalysisPath,
      contentBase64: gapAnalysisContentBase64,
      message: `chore: upload gap analysis for ${runId}`,
      branch: portalConfig.branch,
    });
  }

  uploads.push({
    label: 'requirements manifest',
    path: manifestPath,
    contentBase64: toBase64(JSON.stringify(manifest, null, 2)),
    message: `chore: upload manifest for ${runId}`,
    branch: portalConfig.branch,
  });

  for (const upload of uploads) {
    try {
      await upsertRepoFile(upload);
    } catch (error) {
      throw new Error(`Unable to upload ${upload.label || 'artifact'} (${upload.path}): ${error.message}`);
    }
  }

  const payload = {
    triggered_by: 'react-portal',
    artifact_bundle: toBase64(JSON.stringify({
      file_name: packageName,
      file_path: packagePath,
      runId,
      requirementRoot,
      packagePath,
      manifestPath,
      brdFileName: brdFile?.name || '',
      brdFilePath: brdPath,
      bddFileName: bddFiles.map((bdd) => bdd.name).join(';'),
      bddFilePath: bddPaths.join(';'),
      gapAnalysisFileName: gapAnalysisFile?.name || '',
      gapAnalysisFilePath: gapAnalysisPath,
      releaseId: releaseUpload?.releaseId || '',
      releaseAssetName: releaseUpload?.assetName || '',
      platform: artifactMeta.metadata.platform,
      environment: artifactMeta.metadata.environment,
      version: artifactMeta.metadata.version,
      commit_sha: metadata.commitSha || '',
      requirement_source: artifactMeta.metadata.requirementSource,
      branch: portalConfig.branch,
      env: artifactMeta.metadata.environment,
      uploadMethod: releaseUpload ? 'release' : packageFile ? 'contents' : 'existing',
    })),
  };

  try {
    await dispatchRepositoryEvent('portal-upload', payload);
  } catch (error) {
    throw new Error(`Uploaded artifacts, but failed to dispatch GitHub Actions: ${error.message}`);
  }
  return { runId, packagePath, brdPath, bddPaths, gapAnalysisPath, manifestPath, inputs: payload, manifest };
}

async function uploadLargePackageToRelease({ packageFile, packageName, runId }) {
  const releaseTag = `portal-upload-${slugSafeId(runId)}`;
  const releaseName = `Portal upload ${runId}`;
  let release;
  try {
    release = await createUploadRelease({
      tagName: releaseTag,
      name: releaseName,
      branch: portalConfig.branch,
    });
  } catch (error) {
    throw new Error(`Unable to create large package release for ${packageName}: ${error.message}`);
  }

  try {
    await uploadReleaseAsset({
      releaseId: release.id,
      name: packageName,
      file: packageFile,
      contentType: packageFile.type || 'application/zip',
    });
  } catch (error) {
    throw new Error(`Unable to upload large package release asset ${packageName}: ${error.message}`);
  }

  return {
    releaseId: String(release.id || ''),
    assetName: packageName,
    tagName: releaseTag,
  };
}

function buildGapAnalysisUploadFile(gapResults, context = {}) {
  if (!gapResults || gapResults.skipped || !Array.isArray(gapResults.findings)) return null;
  const openFindings = gapResults.findings.filter((gap) => !isCoveredGap(gap));
  const coveredFindings = gapResults.findings.filter(isCoveredGap);
  const summary = gapResults.summary || {};
  const lines = [
    '# Gap Analysis Report',
    '',
    `Package: ${context.packageName || 'Selected package'}`,
    `Run ID: ${context.runId || 'Not assigned'}`,
    `Requirement Root: ${context.requirementRoot || 'Not assigned'}`,
    `Generated: ${formatTimestamp(gapResults.generatedAt || gapResults.updatedAt)}`,
    `Analysis Source: ${gapResults.analysisSource || 'gap_analysis'}`,
    '',
    '## Summary',
    '',
    `- Readiness: ${summary.readiness || 'Needs Review'}`,
    `- High: ${summary.high ?? openFindings.filter((gap) => gap.severity === 'high').length}`,
    `- Medium: ${summary.medium ?? openFindings.filter((gap) => gap.severity === 'medium').length}`,
    `- Low: ${summary.low ?? openFindings.filter((gap) => gap.severity === 'low').length}`,
    `- Open Findings: ${openFindings.length}`,
    `- Covered Findings: ${coveredFindings.length}`,
    '',
    '## Open Findings',
    '',
    ...(openFindings.length ? openFindings.flatMap((gap, index) => formatGapMarkdown(gap, index)) : ['No open findings.', '']),
    '## Covered Findings',
    '',
    ...(coveredFindings.length ? coveredFindings.flatMap((gap, index) => [
      `${index + 1}. ${gap.gapId ? `${gap.gapId}: ` : ''}${gap.title || 'Covered finding'}`,
      `   Status: ${gap.status || gap.coverageStatus || 'covered'}`,
      `   Covered At: ${formatTimestamp(gap.coveredAt)}`,
      `   Resolution: ${gap.resolutionNote || 'Document updated from this finding.'}`,
      '',
    ]) : ['No covered findings.', '']),
    '## Recommendations',
    '',
    ...(gapResults.recommendations || []).map((item) => `- ${item}`),
    '',
    '## Quality Notes',
    '',
    ...(gapResults.qualityNotes || []).map((item) => `- ${item}`),
    '',
  ];
  return {
    name: 'gap-analysis-report.md',
    content: lines.join('\n'),
    openFindings: openFindings.length,
    coveredFindings: coveredFindings.length,
  };
}

function formatGapMarkdown(gap, index) {
  return [
    `${index + 1}. ${gap.gapId ? `${gap.gapId}: ` : ''}${gap.title || 'Coverage finding'}`,
    `   Gap Type: ${gap.gapType || 'Not specified'}`,
    `   Severity: ${gap.severity || 'medium'}`,
    `   Confidence: ${gap.confidence || 'Not specified'}`,
    `   Module: ${gap.module || 'Application'}`,
    `   Related Document: ${gap.relatedDocument || gap.relatedDocumentId || 'Unlinked'}`,
    ...(Array.isArray(gap.sourceEvidence) && gap.sourceEvidence.length ? [`   Source Evidence: ${gap.sourceEvidence.join(' | ')}`] : []),
    ...(Array.isArray(gap.documentEvidence) && gap.documentEvidence.length ? [`   Document Evidence: ${gap.documentEvidence.join(' | ')}`] : []),
    ...(Array.isArray(gap.evidenceAnchors) && gap.evidenceAnchors.length ? [`   Evidence Anchors: ${gap.evidenceAnchors.join(' | ')}`] : []),
    ...(Array.isArray(gap.missingScenarios) && gap.missingScenarios.length ? [`   Missing Scenarios: ${gap.missingScenarios.join(' | ')}`] : []),
    `   Description: ${gap.description || ''}`,
    `   Recommended Fix: ${gap.recommendedFix || ''}`,
    '',
  ];
}

function isCoveredGap(gap) {
  const status = String(gap?.status || gap?.coverageStatus || '').toLowerCase();
  return status === 'covered' || status.includes('covered_after_regeneration');
}

function formatTimestamp(value) {
  if (!value) return new Date().toISOString();
  try {
    return new Date(value).toISOString();
  } catch (_) {
    return String(value);
  }
}
