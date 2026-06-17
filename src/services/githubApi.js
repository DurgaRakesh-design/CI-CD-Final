import { githubRepoApi, githubUploadApi, portalConfig } from '@/config/portalConfig';

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (_) {
      return { message: text };
    }
  }
  return text;
}

export async function githubFetch(target, options = {}) {
  const url = `${portalConfig.proxyPath}?target=${encodeURIComponent(target)}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    const message = formatGitHubError(body, response.statusText);
    throw new Error(`GitHub ${response.status}: ${message}`);
  }
  return body;
}

export async function githubFetchBlob(target, options = {}) {
  const url = `${portalConfig.proxyPath}?target=${encodeURIComponent(target)}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await parseResponse(response);
    const message = formatGitHubError(body, response.statusText);
    throw new Error(`GitHub ${response.status}: ${message}`);
  }
  return await response.blob();
}

export function repoApi(path) {
  return `${githubRepoApi}${path}`;
}

export async function getRepoFile(path, branch = portalConfig.branch) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return await githubFetch(repoContentsApi(cleanPath, branch));
}

export async function putRepoFile({ path, contentBase64, message, branch = portalConfig.branch, sha }) {
  validateRepoUpload({ path, contentBase64, message });
  const body = {
    message,
    content: contentBase64,
    branch,
  };
  if (sha) body.sha = sha;
  return await githubFetch(repoApi(`/contents/${encodeURIComponentPath(path)}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function upsertRepoFile({ path, contentBase64, message, branch = portalConfig.branch }) {
  validateRepoUpload({ path, contentBase64, message });
  const retryablePattern = /GitHub (409|422)/;
  let lastError;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let sha;
    try {
      const current = await getRepoFile(path, branch);
      sha = current?.sha;
    } catch (error) {
      if (!String(error.message || '').includes('404')) {
        throw new Error(`GitHub lookup failed for ${path}: ${error.message}`);
      }
    }

    try {
      return await putRepoFile({ path, contentBase64, message, branch, sha });
    } catch (error) {
      lastError = error;
      const messageText = String(error?.message || '');
      if (!retryablePattern.test(messageText) || attempt === 3) {
        throw new Error(`GitHub upload failed for ${path}: ${messageText}`);
      }
      await sleep(250 * (attempt + 1));
    }
  }

  throw lastError;
}

export async function listRepoContents(path, branch = portalConfig.branch) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const data = await githubFetch(repoContentsApi(cleanPath, branch));
  return Array.isArray(data) ? data : [];
}

export async function dispatchWorkflow(inputs, branch = portalConfig.branch) {
  return await githubFetch(repoApi(`/actions/workflows/${encodeURIComponent(portalConfig.ciWorkflow)}/dispatches`), {
    method: 'POST',
    body: JSON.stringify({ ref: branch, inputs }),
  });
}

export async function dispatchRepositoryEvent(eventType, clientPayload) {
  try {
    return await githubFetch(repoApi('/dispatches'), {
      method: 'POST',
      body: JSON.stringify({
        event_type: eventType,
        client_payload: clientPayload,
      }),
    });
  } catch (error) {
    throw new Error(`GitHub dispatch failed for ${eventType}: ${error.message}`);
  }
}

export async function listWorkflowRuns(limit = 20) {
  return await githubFetch(repoApi(`/actions/runs?per_page=${limit}`));
}

export async function listWorkflowRunJobs(runId) {
  if (!runId) return { jobs: [] };
  return await githubFetch(repoApi(`/actions/runs/${encodeURIComponent(runId)}/jobs?per_page=100`));
}

export async function listWorkflowRunArtifacts(runId) {
  if (!runId) return { artifacts: [] };
  return await githubFetch(repoApi(`/actions/runs/${encodeURIComponent(runId)}/artifacts?per_page=100`));
}

export async function downloadArtifactArchive(archiveDownloadUrl) {
  if (!archiveDownloadUrl) throw new Error('Artifact archive URL is missing.');
  return await githubFetchBlob(archiveDownloadUrl);
}

export async function getRepoTreeRecursive(branch = portalConfig.branch) {
  return await githubFetch(repoApi(`/git/trees/${encodeURIComponent(branch)}?recursive=1`));
}

export async function createUploadRelease({ tagName, name, branch = portalConfig.branch }) {
  return await githubFetch(repoApi('/releases'), {
    method: 'POST',
    body: JSON.stringify({
      tag_name: tagName,
      target_commitish: branch,
      name,
      draft: false,
      prerelease: true,
    }),
  });
}

export async function uploadReleaseAsset({ releaseId, name, file, contentType = 'application/zip' }) {
  if (!releaseId) throw new Error('GitHub release id is missing for large package upload.');
  if (!name) throw new Error('GitHub release asset name is missing for large package upload.');
  if (!file) throw new Error('GitHub release asset file is missing.');
  return await githubFetch(`${githubUploadApi}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
    },
    body: await file.arrayBuffer(),
  });
}

function encodeURIComponentPath(path) {
  return String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function repoContentsApi(path, branch) {
  return repoApi(`/contents/${encodeURIComponentPath(path)}?ref=${encodeURIComponent(branch)}`);
}

function validateRepoUpload({ path, contentBase64, message }) {
  if (!String(path || '').trim()) {
    throw new Error('GitHub upload path is missing.');
  }
  if (!String(message || '').trim()) {
    throw new Error(`GitHub commit message is missing for ${path}.`);
  }
  if (!String(contentBase64 || '').trim()) {
    throw new Error(`GitHub upload content is empty for ${path}.`);
  }
}

function formatGitHubError(body, statusText = '') {
  if (typeof body === 'string') return body || statusText || 'Request failed';
  const messages = [];
  if (body?.message) messages.push(body.message);
  if (body?.documentation_url) messages.push(`Docs: ${body.documentation_url}`);
  if (Array.isArray(body?.errors) && body.errors.length) {
    const details = body.errors
      .map((item) => {
        if (typeof item === 'string') return item;
        return [item.resource, item.field, item.code, item.message].filter(Boolean).join(' ');
      })
      .filter(Boolean)
      .join('; ');
    if (details) messages.push(details);
  }
  if (body?.error) messages.push(body.error);
  return messages.filter(Boolean).join(' | ') || statusText || 'Request failed with no response body';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
