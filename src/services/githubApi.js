import { githubRepoApi, portalConfig } from '@/config/portalConfig';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  return await response.text();
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
    const message = typeof body === 'string' ? body : body?.message;
    throw new Error(`GitHub ${response.status}: ${message || response.statusText}`);
  }
  return body;
}

export function repoApi(path) {
  return `${githubRepoApi}${path}`;
}

export async function getRepoFile(path, branch = portalConfig.branch) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  return await githubFetch(repoContentsApi(cleanPath, branch));
}

export async function putRepoFile({ path, contentBase64, message, branch = portalConfig.branch, sha }) {
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
  try {
    return await putRepoFile({ path, contentBase64, message, branch });
  } catch (error) {
    const messageText = String(error?.message || '');
    if (!/GitHub (409|422)/.test(messageText)) {
      throw error;
    }
  }

  let sha;
  try {
    const current = await getRepoFile(path, branch);
    sha = current?.sha;
  } catch (error) {
    if (!String(error.message || '').includes('404')) {
      throw error;
    }
  }

  return await putRepoFile({ path, contentBase64, message, branch, sha });
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
  return await githubFetch(repoApi('/dispatches'), {
    method: 'POST',
    body: JSON.stringify({
      event_type: eventType,
      client_payload: clientPayload,
    }),
  });
}

export async function listWorkflowRuns(limit = 20) {
  return await githubFetch(repoApi(`/actions/runs?per_page=${limit}`));
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
