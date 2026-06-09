import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FlaskConical, GitPullRequest, Bot, Code2, Monitor, FileBarChart, GitBranch,
  CheckCircle2, XCircle, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RunDetailTabs({ run }) {
  return (
    <Tabs defaultValue="test-results" className="w-full">
      <TabsList className="bg-white border border-border h-9 p-1 rounded-lg mb-4 flex-wrap">
        <TabsTrigger value="test-results" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <FlaskConical className="w-3 h-3 mr-1" />Test Results
        </TabsTrigger>
        <TabsTrigger value="bdd-traceability" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <GitPullRequest className="w-3 h-3 mr-1" />BDD Traceability
        </TabsTrigger>
        <TabsTrigger value="ai-details" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Bot className="w-3 h-3 mr-1" />AI Details
        </TabsTrigger>
        <TabsTrigger value="code-quality" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Code2 className="w-3 h-3 mr-1" />Code Quality
        </TabsTrigger>
        <TabsTrigger value="frontend" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Monitor className="w-3 h-3 mr-1" />Frontend
        </TabsTrigger>
        <TabsTrigger value="reports" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <FileBarChart className="w-3 h-3 mr-1" />Reports
        </TabsTrigger>
        <TabsTrigger value="pipeline" className="text-xs h-7 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <GitBranch className="w-3 h-3 mr-1" />Pipeline
        </TabsTrigger>
      </TabsList>

      {/* Test Results */}
      <TabsContent value="test-results" className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Tests" value={run.tests.total} color="text-foreground" />
          <MetricCard label="Passed" value={run.tests.passed} color="text-emerald-600" />
          <MetricCard label="Failed" value={run.tests.failed} color="text-red-600" />
          <MetricCard label="Skipped" value={run.tests.skipped} color="text-amber-600" />
        </div>
        <div className="space-y-2">
          {[
            { name: 'PaymentProcessingTest', status: 'passed', duration: '2.3s' },
            { name: 'RefundFlowTest', status: 'failed', duration: '1.8s' },
            { name: 'UserAuthenticationTest', status: 'passed', duration: '3.1s' },
            { name: 'InventoryCheckTest', status: 'passed', duration: '1.2s' },
            { name: 'AuditLogTest', status: 'passed', duration: '0.9s' },
          ].map(test => (
            <div key={test.name} className="flex items-center justify-between p-3 rounded-lg bg-white border border-border">
              <div className="flex items-center gap-2">
                {test.status === 'passed' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                <span className="text-sm font-mono">{test.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{test.duration}</span>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* BDD Traceability */}
      <TabsContent value="bdd-traceability" className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-center p-3 rounded-lg bg-violet-50 border border-violet-100 flex-1">
            <p className="text-2xl font-bold text-violet-700">{run.bddCoverage}%</p>
            <p className="text-xs text-violet-600">BDD Coverage</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100 flex-1">
            <p className="text-2xl font-bold text-blue-700">5</p>
            <p className="text-xs text-blue-600">Features Mapped</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-emerald-50 border border-emerald-100 flex-1">
            <p className="text-2xl font-bold text-emerald-700">18</p>
            <p className="text-xs text-emerald-600">Scenarios Traced</p>
          </div>
        </div>
        <div className="space-y-2">
          {['Payment Processing', 'User Management', 'Refund Flow', 'Audit Logging', 'Inventory Check'].map((feature, i) => (
            <div key={feature} className="flex items-center justify-between p-3 rounded-lg bg-white border border-border">
              <span className="text-sm font-medium">{feature}</span>
              <div className="flex items-center gap-2">
                <Progress value={[92, 85, 78, 95, 88][i]} className="w-20 h-2" />
                <span className="text-xs font-mono text-muted-foreground">{[92, 85, 78, 95, 88][i]}%</span>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* AI Details */}
      <TabsContent value="ai-details" className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
            <p className="text-xl font-bold text-purple-700">312</p>
            <p className="text-xs text-purple-600">AI Generated Tests</p>
          </div>
          <div className="p-3 rounded-lg bg-violet-50 border border-violet-100 text-center">
            <p className="text-xl font-bold text-violet-700">94%</p>
            <p className="text-xs text-violet-600">AI Accuracy</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <p className="text-xl font-bold text-blue-700">47</p>
            <p className="text-xs text-blue-600">AI Recommendations</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white border border-border">
          <h4 className="text-sm font-semibold mb-3">AI Coverage Insights</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2"><Bot className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />Generated 15 additional edge case scenarios for payment timeout handling</li>
            <li className="flex items-start gap-2"><Bot className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />Identified 3 untested API endpoints in user management module</li>
            <li className="flex items-start gap-2"><Bot className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />Suggested BDD scenarios for concurrent transaction handling</li>
          </ul>
        </div>
      </TabsContent>

      {/* Code Quality */}
      <TabsContent value="code-quality" className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <p className="text-xl font-bold text-blue-700">{run.codeCoverage}%</p>
            <p className="text-xs text-blue-600">Code Coverage</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-xl font-bold text-emerald-700">A</p>
            <p className="text-xs text-emerald-600">Quality Grade</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
            <p className="text-xl font-bold text-amber-700">12</p>
            <p className="text-xs text-amber-600">Code Smells</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { file: 'PaymentService.java', coverage: 92, complexity: 'Low' },
            { file: 'RefundController.java', coverage: 78, complexity: 'Medium' },
            { file: 'UserRepository.java', coverage: 85, complexity: 'Low' },
            { file: 'AuditInterceptor.java', coverage: 96, complexity: 'Low' },
          ].map(file => (
            <div key={file.file} className="flex items-center justify-between p-3 rounded-lg bg-white border border-border">
              <span className="text-sm font-mono">{file.file}</span>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-xs ${file.complexity === 'Low' ? 'text-emerald-600' : 'text-amber-600'}`}>{file.complexity}</Badge>
                <span className="text-xs font-mono">{file.coverage}%</span>
              </div>
            </div>
          ))}
        </div>
      </TabsContent>

      {/* Frontend Testing */}
      <TabsContent value="frontend" className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-xl font-bold text-emerald-700">Passed</p>
            <p className="text-xs text-emerald-600">Visual Regression</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
            <p className="text-xl font-bold text-emerald-700">98</p>
            <p className="text-xs text-emerald-600">Accessibility Score</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
            <p className="text-xl font-bold text-blue-700">1.2s</p>
            <p className="text-xs text-blue-600">Load Time</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-white border border-border text-sm text-muted-foreground">
          <p>Cross-browser tests passed for Chrome, Firefox, Safari, and Edge. No visual regression detected. All WCAG 2.1 AA criteria met.</p>
        </div>
      </TabsContent>

      {/* Reports */}
      <TabsContent value="reports" className="space-y-3">
        {[
          { name: 'Full Report Bundle', type: 'ZIP' },
          { name: 'Excel Report', type: 'XLSX' },
          { name: 'HTML Report', type: 'HTML' },
          { name: 'Traceability JSON', type: 'JSON' },
          { name: 'Generated Scripts', type: 'ZIP' },
          { name: 'Frontend Evidence', type: 'ZIP' },
          { name: 'Execution Artifacts', type: 'ZIP' },
        ].map(report => (
          <div key={report.name} className="flex items-center justify-between p-3 rounded-lg bg-white border border-border">
            <div className="flex items-center gap-2">
              <FileBarChart className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{report.name}</span>
              <Badge variant="secondary" className="text-xs">{report.type}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <Download className="w-3 h-3 mr-1" />
              Download
            </Button>
          </div>
        ))}
      </TabsContent>

      {/* Pipeline Progress */}
      <TabsContent value="pipeline" className="space-y-3">
        {['Detect', 'Build', 'Test', 'Analyse', 'Reports', 'Publish'].map((stage, i) => (
          <div key={stage} className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">{stage}</span>
            <span className="ml-auto text-xs text-emerald-600">{['0.8s', '2m 15s', '5m 30s', '1m 45s', '0.5s', '0.3s'][i]}</span>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="p-3 rounded-lg bg-white border border-border text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
