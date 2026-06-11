export const repo = {
  owner: 'ManishShamlani98',
  name: 'qa-pipeline-prod',
  updatedAt: 'just now',
  refreshIntervalSeconds: 30,
};

export const overview = {
  readiness: 87,
  readinessLabel: 'Healthy',
  successRate: 94.2,
  activeIssues: 3,
  avgDuration: '—',
  statusHeadline: 'Release readiness is healthy',
  statusBody:
    'Traceability holds across requirements, BDD scenarios, generated automation, and execution evidence.',
  keyMetrics: [
    { label: 'Executed Tests', value: '1,247', sub: '1,173 passed', tone: 'violet' },
    { label: 'Success Rate', value: '94.2%', sub: '+2.1% vs last week', tone: 'emerald' },
    { label: 'BDD Coverage', value: '89%', sub: 'Scenarios traced', tone: 'indigo' },
    { label: 'AI Generated', value: '312', sub: 'Assets this cycle', tone: 'fuchsia' },
    { label: 'Release Readiness', value: '87%', sub: 'Healthy', tone: 'teal' },
  ],
  coverage: [
    { label: 'BRD Coverage', value: 91 },
    { label: 'BDD Coverage', value: 89 },
    { label: 'Test Coverage', value: 76 },
  ],
  recommendations: [
    'Add error boundary tests for payment module',
    'Increase code coverage for RefundController',
    'Add performance benchmarks for inventory API',
    'Review 3 deprecated test dependencies',
  ],
};

export const deliveryStages = [
  { label: 'Discovery', step: 1, tone: 'bg-violet-500' },
  { label: 'Requirements', step: 2, tone: 'bg-fuchsia-500' },
  { label: 'BDD', step: 3, tone: 'bg-rose-500' },
  { label: 'Automation', step: 4, tone: 'bg-amber-500' },
  { label: 'Execution', step: 5, tone: 'bg-emerald-500' },
  { label: 'Insights', step: 6, tone: 'bg-indigo-500' },
];

export const workspace = {
  uploadSource: 'GitHub repository',
  packageName: 'user-management-api',
  platform: 'Java 17 · Maven',
  brdCount: 48,
  bddCount: 28,
  traceabilityStatus: 'Complete',
  gapCount: 4,
  approvalStatus: 'Pending review',
  generatedAt: 'Jun 11, 2026 · 12:41 PM',
  stages: [
    {
      label: 'Discovery',
      status: 'done',
      note: 'Source scanned · 142 files · 38k LOC',
    },
    {
      label: 'Requirements',
      status: 'done',
      note: '48 BRD requirements extracted and approved',
    },
    {
      label: 'BDD',
      status: 'done',
      note: '28 scenarios authored across 5 features',
    },
    {
      label: 'Automation',
      status: 'done',
      note: 'Step definitions and pipeline assets packaged',
    },
    {
      label: 'Execution',
      status: 'warn',
      note: 'Failed steps detected — inspect pipeline details',
    },
    {
      label: 'Insights',
      status: 'warn',
      note: '4 gaps flagged for review',
    },
  ],
  artifacts: [
    { name: 'BRD-UserMgmt-v3.docx', size: '112 KB', type: 'BRD' },
    { name: 'BDD-Features-Bundle.zip', size: '84 KB', type: 'BDD' },
    { name: 'Traceability-Matrix.xlsx', size: '36 KB', type: 'Matrix' },
    { name: 'Gap-Analysis-Report.pdf', size: '52 KB', type: 'Gaps' },
    { name: 'Automation-Skeleton.zip', size: '148 KB', type: 'Automation' },
  ],
};

export const runs = [
  {
    runNumber: 47,
    projectName: 'payment-service',
    status: 'success',
    age: '2 hours ago',
    branch: 'main',
    mode: 'standard',
    duration: '—',
    testsTotal: 312,
    testsPassed: 305,
    testsFailed: 4,
    testsSkipped: 3,
    bddTotal: 36,
    bddCovered: 34,
    bddUncovered: 2,
    codeCoverage: 81,
    coverageAi: 82,
    trigger: 'Scheduled',
  },
  {
    runNumber: 46,
    projectName: 'user-management-api',
    status: 'failure',
    age: '5 hours ago',
    branch: 'develop',
    mode: 'ai-bdd-batched',
    duration: '—',
    testsTotal: 245,
    testsPassed: 218,
    testsFailed: 22,
    testsSkipped: 5,
    bddTotal: 28,
    bddCovered: 24,
    bddUncovered: 4,
    codeCoverage: 76,
    coverageAi: 72,
    trigger: 'PR validation',
  },
  {
    runNumber: 45,
    projectName: 'inventory-module',
    status: 'success',
    age: '1 day ago',
    branch: 'release/3.1',
    mode: 'standard',
    duration: '—',
    testsTotal: 428,
    testsPassed: 420,
    testsFailed: 3,
    testsSkipped: 5,
    bddTotal: 52,
    bddCovered: 49,
    bddUncovered: 3,
    codeCoverage: 84,
    coverageAi: 88,
    trigger: 'Release candidate',
  },
  {
    runNumber: 44,
    projectName: 'payment-service',
    status: 'success',
    age: '2 days ago',
    branch: 'main',
    mode: 'standard',
    duration: '—',
    testsTotal: 296,
    testsPassed: 290,
    testsFailed: 5,
    testsSkipped: 1,
    bddTotal: 34,
    bddCovered: 32,
    bddUncovered: 2,
    codeCoverage: 79,
    coverageAi: 79,
    trigger: 'Merge to main',
  },
  {
    runNumber: 43,
    projectName: 'notifications-svc',
    status: 'running',
    age: '3 days ago',
    branch: 'feature/email-v2',
    mode: 'ai-bdd-batched',
    duration: '—',
    testsTotal: 142,
    testsPassed: 96,
    testsFailed: 0,
    testsSkipped: 0,
    bddTotal: 22,
    bddCovered: 14,
    bddUncovered: 8,
    codeCoverage: 68,
    coverageAi: 64,
    trigger: 'Manual',
  },
];

export const pipelineJobs = [
  { name: 'Detect', status: 'success', duration: '—' },
  { name: 'Build', status: 'success', duration: '—' },
  { name: 'Test', status: 'failure', duration: '—' },
  { name: 'Analyse', status: 'success', duration: '—' },
  { name: 'Reports', status: 'success', duration: '—' },
  { name: 'Publish', status: 'success', duration: '—' },
];

export const testRows = [
  { suite: 'PaymentController', name: 'should_process_card_payment', status: 'passed', duration: '—' },
  { suite: 'PaymentController', name: 'should_decline_expired_card', status: 'passed', duration: '—' },
  { suite: 'PaymentController', name: 'should_retry_on_gateway_timeout', status: 'failed', duration: '—' },
  { suite: 'RefundController', name: 'should_issue_full_refund', status: 'passed', duration: '—' },
  { suite: 'RefundController', name: 'should_block_partial_when_disputed', status: 'failed', duration: '—' },
  { suite: 'WebhookService', name: 'should_verify_signature', status: 'passed', duration: '—' },
  { suite: 'AuthMiddleware', name: 'should_reject_expired_jwt', status: 'skipped', duration: '—' },
  { suite: 'InventorySync', name: 'should_reserve_stock_atomically', status: 'failed', duration: '—' },
];

export const bddScenarios = [
  { feature: 'Checkout', name: 'Customer pays with saved card', status: 'covered' },
  { feature: 'Checkout', name: 'Customer applies promo code', status: 'covered' },
  { feature: 'Checkout', name: 'Customer encounters gateway timeout', status: 'uncovered' },
  { feature: 'Refunds', name: 'Operator issues full refund', status: 'covered' },
  { feature: 'Refunds', name: 'Operator issues partial refund', status: 'uncovered' },
  { feature: 'Webhooks', name: 'Replayed webhook is rejected', status: 'uncovered' },
  { feature: 'Auth', name: 'User logs in via SSO', status: 'uncovered' },
];

export const reports = [
  { name: 'QA Test Report', desc: 'Executive HTML report with failing test deep-links', size: '62 KB', type: 'HTML' },
  { name: 'BDD Coverage Bundle', desc: 'Gherkin features and traceability matrix', size: '41 KB', type: 'ZIP' },
  { name: 'Frontend Visual Diff', desc: 'Browser snapshots and diagnostics', size: '28 KB', type: 'ZIP' },
  { name: 'Code Quality Summary', desc: 'SonarQube export and AI recommendations', size: '17 KB', type: 'PDF' },
];

export const aiDetails = {
  generated: 312,
  executed: 298,
  rejected: 14,
  accuracy: 94,
  recommendations: [
    { severity: 'high', title: 'Add error boundary tests for payment module', reason: 'Detected 3 unhandled gateway errors in last 7 runs.' },
    { severity: 'medium', title: 'Increase code coverage for RefundController', reason: 'Coverage at 68% â€” below 80% threshold.' },
    { severity: 'medium', title: 'Add performance benchmarks for inventory API', reason: 'P95 latency drifted +18% across two releases.' },
    { severity: 'low', title: 'Review 3 deprecated test dependencies', reason: 'JUnit 4 references found alongside JUnit 5.' },
  ],
};

export const codeQuality = {
  coverage: 76,
  duplication: 2.1,
  smells: 14,
  bugs: 2,
  vulnerabilities: 0,
  verdict: 'Acceptable',
  mode: 'Full SonarQube + AI review',
};

export const frontend = {
  visual: 'Pass',
  accessibility: 98,
  loadTime: '1.24s',
  browsers: ['Chrome', 'Firefox', 'Safari', 'Edge'],
  evidence: [
    'home-baseline.png',
    'checkout-diff.png',
    'refund-snapshot.png',
    'a11y-report.json',
  ],
};


