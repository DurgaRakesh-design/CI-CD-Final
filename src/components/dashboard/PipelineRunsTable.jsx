import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ChevronDown, ChevronRight, GitBranch, Clock, CheckCircle2, XCircle, Loader2, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RunDetailTabs from './RunDetailTabs';

const runs = [
  {
    id: 'run-1',
    number: 47,
    branch: 'main',
    status: 'success',
    duration: '11m 23s',
    timestamp: '2 hours ago',
    package: 'payment-service',
    tests: { total: 312, passed: 305, failed: 4, skipped: 3 },
    successRate: 97.8,
    bddCoverage: 92,
    codeCoverage: 81,
  },
  {
    id: 'run-2',
    number: 46,
    branch: 'develop',
    status: 'failed',
    duration: '8m 45s',
    timestamp: '5 hours ago',
    package: 'user-management-api',
    tests: { total: 245, passed: 218, failed: 22, skipped: 5 },
    successRate: 89.0,
    bddCoverage: 85,
    codeCoverage: 72,
  },
  {
    id: 'run-3',
    number: 45,
    branch: 'release/3.1',
    status: 'success',
    duration: '14m 12s',
    timestamp: '1 day ago',
    package: 'inventory-module',
    tests: { total: 428, passed: 420, failed: 3, skipped: 5 },
    successRate: 98.1,
    bddCoverage: 94,
    codeCoverage: 79,
  },
  {
    id: 'run-4',
    number: 44,
    branch: 'main',
    status: 'success',
    duration: '10m 05s',
    timestamp: '2 days ago',
    package: 'payment-service',
    tests: { total: 298, passed: 290, failed: 5, skipped: 3 },
    successRate: 97.3,
    bddCoverage: 91,
    codeCoverage: 78,
  },
];

export default function PipelineRunsTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRun, setExpandedRun] = useState(null);

  const filtered = runs.filter(run => {
    const matchSearch = run.package.toLowerCase().includes(search.toLowerCase()) ||
      run.branch.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || run.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusIcon = (status) => {
    if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-600" />;
    return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  };

  const statusBadge = (status) => {
    const styles = {
      success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      failed: 'bg-red-50 text-red-700 border-red-200',
      running: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return (
      <Badge variant="outline" className={`text-xs ${styles[status]}`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-heading font-semibold text-lg">Pipeline Runs</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search runs..."
                className="pl-9 h-9 text-sm rounded-lg"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 h-9 text-sm rounded-lg">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-8" />
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Run</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Package</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Branch</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tests</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((run) => (
              <React.Fragment key={run.id}>
                <tr
                  className={`border-b border-border cursor-pointer transition-colors ${
                    expandedRun === run.id ? 'bg-accent' : 'hover:bg-muted/30'
                  }`}
                  onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                >
                  <td className="px-4 py-3">
                    {expandedRun === run.id ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono text-sm font-medium">{run.number}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{run.package}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm font-mono">{run.branch}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(run.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      {run.duration}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-emerald-600 font-medium">{run.tests.passed}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-red-600 font-medium">{run.tests.failed}</span>
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">{run.tests.total}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{run.timestamp}</td>
                </tr>
                <AnimatePresence>
                  {expandedRun === run.id && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-b border-border"
                        >
                          <div className="p-5 bg-muted/20">
                            <RunDetailTabs run={run} />
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
