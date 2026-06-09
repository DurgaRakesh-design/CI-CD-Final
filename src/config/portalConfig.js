export const portalConfig = {
  owner: import.meta.env.VITE_GITHUB_OWNER || 'ManishShamlani98',
  repo: import.meta.env.VITE_GITHUB_REPO || 'qa-pipeline-prod',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'develop',
  uploadDir: import.meta.env.VITE_UPLOAD_DIR || 'packages/uploads',
  requirementDir: import.meta.env.VITE_REQUIREMENT_DIR || 'packages/requirements',
  ciWorkflow: import.meta.env.VITE_CI_WORKFLOW || 'ci.yml',
  proxyPath: import.meta.env.VITE_GITHUB_PROXY || '/.netlify/functions/github-proxy',
};

export const githubRepoApi = `https://api.github.com/repos/${portalConfig.owner}/${portalConfig.repo}`;
