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

  if (packageFile) {
    await upsertRepoFile({
      path: packagePath,
      contentBase64: await fileToBase64(packageFile),
      message: `Portal upload package ${packageName}`,
    });
  }

  const brdFile = buildBrdUploadFile(documents);
  let brdPath = '';
  if (brdFile?.content) {
    brdPath = `${requirementRoot}/brd/${safeFileName(brdFile.name, 'brd.md')}`;
    await upsertRepoFile({
      path: brdPath,
      contentBase64: toBase64(brdFile.content),
      message: `Portal upload BRD for ${packageName}`,
    });
  }

  const bddFiles = buildBddUploadFiles(documents).filter((item) => item.content?.trim());
  if (!bddFiles.length) {
    throw new Error('At least one BDD feature file is required before triggering the pipeline.');
  }

  const bddPaths = [];
  for (const [index, bdd] of bddFiles.entries()) {
    const bddPath = `${requirementRoot}/bdd/${String(index + 1).padStart(2, '0')}-${safeFileName(bdd.name, `bdd-${index + 1}.feature`)}`;
    await upsertRepoFile({
      path: bddPath,
      contentBase64: toBase64(bdd.content),
      message: `Portal upload BDD ${index + 1} for ${packageName}`,
    });
    bddPaths.push(bddPath);
  }

  const inputs = {
    triggered_by: 'react-portal',
    file_name: packageName,
    platform: metadata.platform || 'Java',
    environment: metadata.environment || 'dev',
    version: metadata.version || 'unversioned',
    commit_sha: metadata.commitSha || '',
    bdd_file_name: bddFiles[0]?.name || '',
    bdd_file_path: bddPaths.join(';'),
    brd_file_name: brdFile?.name || '',
    brd_file_path: brdPath,
    requirement_source: metadata.requirementSource || 'generated',
  };

  await dispatchWorkflow(inputs, portalConfig.branch);
  return { runId, packagePath, brdPath, bddPaths, inputs };
}
