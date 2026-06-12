import { portalConfig } from '@/config/portalConfig';
import { dispatchWorkflow, listRepoContents, upsertRepoFile } from '@/services/githubApi';
import { fileToBase64, safeFileName, toBase64, uniquePortalRunId } from '@/services/encoding';
import { buildBddUploadFiles, buildBrdUploadFile } from '@/services/documentService';

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

export async function uploadWorkspaceInputs({ packageFile, selectedPackage, documents, metadata = {} }) {
  if (!packageFile && !selectedPackage?.name) {
    throw new Error('Select or upload a package before triggering the pipeline.');
  }

  const packageName = safeFileName(packageFile?.name || selectedPackage.name);
  const runId = uniquePortalRunId(packageName);
  const packagePath = `${portalConfig.uploadDir}/${packageName}`;
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
  const packageContentBase64 = packageFile ? await fileToBase64(packageFile) : '';

  const withGitHubRetry = async (operation, attempts = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (!isRetryableGitHubError(error) || attempt === attempts) {
          throw error;
        }
        await sleep(650 * attempt);
      }
    }
    throw lastError;
  };

  if (packageFile) {
    await withGitHubRetry(() => upsertRepoFile({
      path: packagePath,
      contentBase64: packageContentBase64,
      message: `Portal upload package ${packageName}`,
    }));
  }

  const brdFile = buildBrdUploadFile(documents);
  let brdPath = '';
  if (brdFile?.content) {
    brdPath = `${requirementRoot}/brd/${safeFileName(brdFile.name, 'brd.md')}`;
    await withGitHubRetry(() => upsertRepoFile({
      path: brdPath,
      contentBase64: toBase64(brdFile.content),
      message: `Portal upload BRD for ${packageName}`,
    }));
  }

  const bddFiles = buildBddUploadFiles(documents).filter((item) => item.content?.trim());
  if (!bddFiles.length) {
    throw new Error('At least one BDD feature file is required before triggering the pipeline.');
  }

  const bddPaths = [];
  for (const [index, bdd] of bddFiles.entries()) {
    const bddPath = `${requirementRoot}/bdd/${String(index + 1).padStart(2, '0')}-${safeFileName(bdd.name, `bdd-${index + 1}.feature`)}`;
    await withGitHubRetry(() => upsertRepoFile({
      path: bddPath,
      contentBase64: toBase64(bdd.content),
      message: `Portal upload BDD ${index + 1} for ${packageName}`,
    }));
    bddPaths.push(bddPath);
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
  };
  const manifestPath = `${requirementRoot}/manifest.json`;
  await withGitHubRetry(() => upsertRepoFile({
    path: manifestPath,
    contentBase64: toBase64(JSON.stringify(manifest, null, 2)),
    message: `Portal upload manifest for ${packageName}`,
  }));

  const inputs = {
    triggered_by: 'react-portal',
    file_name: packageName,
    platform: artifactMeta.metadata.platform,
    environment: artifactMeta.metadata.environment,
    version: artifactMeta.metadata.version,
    commit_sha: metadata.commitSha || '',
    bdd_file_name: bddFiles[0]?.name || '',
    bdd_file_path: bddPaths.join(';'),
    brd_file_name: brdFile?.name || '',
    brd_file_path: brdPath,
    requirement_source: artifactMeta.metadata.requirementSource,
  };

  await withGitHubRetry(() => dispatchWorkflow(inputs, portalConfig.branch));
  return { runId, packagePath, brdPath, bddPaths, manifestPath, inputs, manifest };
}

function isRetryableGitHubError(error) {
  const message = String(error?.message || '');
  return /GitHub (5\d\d|429)|Internal Error|Bad Gateway|Gateway Timeout|Service Unavailable/i.test(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
