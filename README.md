# QA Pipeline Portal

React/Vite frontend for the AI-assisted QA pipeline portal.

## MVP 1 Scope

- Home page and QA Workspace.
- Fresh package upload or repository package selection.
- Package signal detection for uploaded Java ZIP files.
- Single BRD and multiple BDD documents.
- AI-backed BRD/BDD generation through Netlify Functions.
- AI-backed package-to-document gap analysis through Netlify Functions.
- Approval-gated pipeline trigger.
- GitHub package/document upload and GitHub Actions dispatch through a Netlify GitHub proxy.

Dashboard reporting remains an MVP 2 area.

## Local Setup

```bash
npm install
npm run build
```

For local development:

```bash
npm run dev
```

## Netlify Environment Variables

Set these in Netlify, not in frontend code:

```text
GITHUB_PAT=<fine-grained GitHub token>
GITHUB_OWNER=ManishShamlani98
GITHUB_REPO=qa-pipeline-prod
OPENAI_API_KEY=<OpenAI key>
OPENAI_MODEL=gpt-4.1
```

Optional frontend build variables are documented in `.env.example`.
