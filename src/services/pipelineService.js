import { portalConfig } from '@/config/portalConfig';
import { dispatchRepositoryEvent, listRepoContents, upsertRepoFile } from '@/services/githubApi';
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
  const packagePath = packageFile
    ? `${portalConfig.uploadDir}/${packageName}`
    : selectedPackage?.path || `${portalConfig.uploadDir}/${packageName}`;
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

  const brdFile = buildBrdUploadFile(documents);
  const brdPath = brdFile?.content ? `${requirementRoot}/brd/${safeFileName(brdFile.name, 'brd.md')}` : '';
  const brdContentBase64 = brdFile?.content ? toBase64(brdFile.content) : '';

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
  };
  const manifestPath = `${requirementRoot}/manifest.json`;

  const uploads = [];
  if (packageFile) {
    uploads.push(upsertRepoFile({
      path: packagePath,
      contentBase64: packageContentBase64,
      message: `chore: upload package ${packageName}`,
      branch: portalConfig.branch,
    }));
  }

  if (brdFile?.content) {
    uploads.push(upsertRepoFile({
      path: brdPath,
      contentBase64: brdContentBase64,
      message: `chore: upload BRD ${brdFile.name}`,
      branch: portalConfig.branch,
    }));
  }

  bddFiles.forEach((bdd, index) => {
    const path = bddPaths[index];
    const contentBase64 = bddContent[index];
    if (!path || !contentBase64) return;
    uploads.push(upsertRepoFile({
      path,
      contentBase64,
      message: `chore: upload BDD ${bdd.name}`,
      branch: portalConfig.branch,
    }));
  });

  uploads.push(upsertRepoFile({
    path: manifestPath,
    contentBase64: toBase64(JSON.stringify(manifest, null, 2)),
    message: `chore: upload manifest for ${runId}`,
    branch: portalConfig.branch,
  }));

  await Promise.all(uploads);

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
      platform: artifactMeta.metadata.platform,
      environment: artifactMeta.metadata.environment,
      version: artifactMeta.metadata.version,
      commit_sha: metadata.commitSha || '',
      requirement_source: artifactMeta.metadata.requirementSource,
      branch: portalConfig.branch,
      env: artifactMeta.metadata.environment,
      uploadMethod: packageFile ? 'contents' : 'existing',
    })),
  };

  await dispatchRepositoryEvent('portal-upload', payload);
  return { runId, packagePath, brdPath, bddPaths, manifestPath, inputs: payload, manifest };
}
