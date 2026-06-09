import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Lightbulb, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { runGapAnalysis } from '@/services/documentService';

const severityColors = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function GapAnalysisStep({ workspaceData, documents, setDocuments, onNext, onBack, onGapsFound }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    setRunning(true);
    setError('');
    try {
      const payload = await runGapAnalysis({ packageSignals: workspaceData.package_signals, documents });
      setResult(payload);
      onGapsFound?.(payload);
      setDocuments?.(prev => prev.map((doc) => ({
        ...doc,
        approved: false,
        status: 'review',
        lastEdited: new Date().toISOString(),
      })));
    } catch (err) {
      setError(err.message || 'Gap analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const findings = result?.findings || [];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-2xl">Gap Analysis</h2>
        <p className="text-muted-foreground mt-2">Compare package signals with reviewed BRD and BDD documents</p>
      </div>

      {!result && (
        <div className="text-center py-8">
          {!running ? (
            <div className="space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-4">Run a production-grade review before allowing the pipeline trigger.</p>
                <Button onClick={runAnalysis} className="rounded-xl h-11 px-6">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Run Gap Analysis
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Analyzing package-to-document coverage...</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 border border-red-100 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard label="High" value={result.summary?.high || 0} tone="red" />
            <SummaryCard label="Medium" value={result.summary?.medium || 0} tone="amber" />
            <SummaryCard label="Low" value={result.summary?.low || 0} tone="blue" />
            <SummaryCard label="Readiness" value={result.summary?.readiness || 'Ready'} tone="emerald" />
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Coverage Findings</h3>
            {findings.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                No major gaps detected. Review is ready for approval.
              </div>
            ) : findings.map((gap, i) => (
              <div key={i} className={`p-4 rounded-xl border ${severityColors[gap.severity] || severityColors.medium}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{gap.title}</p>
                    <p className="text-xs mt-1 opacity-80">{gap.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {gap.module && <Badge variant="outline" className="text-xs">{gap.module}</Badge>}
                      {gap.relatedDocument && <Badge variant="outline" className="text-xs">{gap.relatedDocument}</Badge>}
                    </div>
                    {gap.recommendedFix && <p className="text-xs mt-2 font-medium">Fix: {gap.recommendedFix}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
              <Lightbulb className="w-4 h-4" />
              Recommendations
            </div>
            <ul className="space-y-1.5">
              {(result.recommendations || []).map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-violet-700">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        {result && (
          <Button onClick={onNext} className="rounded-xl h-11 px-6">
            Continue to Approval
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function SummaryCard({ label, value, tone }) {
  const colors = {
    red: 'bg-red-50 border-red-100 text-red-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  };
  return (
    <div className={`p-4 rounded-xl border text-center ${colors[tone]}`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}
