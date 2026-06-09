import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Lightbulb, FileText, Code2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const gaps = [
  {
    severity: 'high',
    title: 'Missing Error Handling Requirement',
    description: 'Payment timeout scenarios not covered in BRD-001. Add error handling for gateway timeouts.',
    relatedBRD: 'BR-001',
    relatedBDD: 'Payment Processing BDD',
  },
  {
    severity: 'medium',
    title: 'Incomplete Refund Scenarios',
    description: 'BDD missing scenarios for full refund flow and multi-currency refunds.',
    relatedBRD: 'BR-005',
    relatedBDD: 'Payment Processing BDD',
  },
  {
    severity: 'low',
    title: 'Audit Log Coverage',
    description: 'BDD scenarios exist but could be more granular for different transaction types.',
    relatedBRD: 'BR-004',
    relatedBDD: 'Payment Processing BDD',
  },
];

const recommendations = [
  'Add timeout handling scenarios to payment BDD feature files',
  'Create additional refund scenarios for edge cases (multi-currency, expired orders)',
  'Enhance audit log BDD with specific transaction type coverage',
  'Consider adding performance-related BDD scenarios for 3-second SLA',
];

export default function GapAnalysisStep({ onNext, onBack, onGapsFound }) {
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [progress, setProgress] = useState(0);

  const runAnalysis = () => {
    setRunning(true);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setRunning(false);
          setComplete(true);
          if (onGapsFound) onGapsFound(gaps);
          return 100;
        }
        return p + 4;
      });
    }, 100);
  };

  const severityColors = {
    high: 'bg-red-50 text-red-700 border-red-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-2xl">Gap Analysis</h2>
        <p className="text-muted-foreground mt-2">Compare code signals, package metadata, BRD, and BDD</p>
      </div>

      {!complete && (
        <div className="text-center py-8">
          {!running ? (
            <div className="space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-4">Analyze your package against generated requirements to find coverage gaps.</p>
                <Button onClick={runAnalysis} className="rounded-xl h-11 px-6">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Run Gap Analysis
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Analyzing coverage gaps...</p>
              <div className="max-w-xs mx-auto">
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          )}
        </div>
      )}

      {complete && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-center">
              <p className="text-2xl font-bold text-red-700">1</p>
              <p className="text-xs text-red-600 font-medium">High</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 text-center">
              <p className="text-2xl font-bold text-amber-700">1</p>
              <p className="text-xs text-amber-600 font-medium">Medium</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
              <p className="text-2xl font-bold text-blue-700">1</p>
              <p className="text-xs text-blue-600 font-medium">Low</p>
            </div>
          </div>

          {/* Gaps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Coverage Gaps</h3>
            {gaps.map((gap, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-xl border ${severityColors[gap.severity]}`}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{gap.title}</p>
                    <p className="text-xs mt-1 opacity-80">{gap.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs gap-1">
                        <FileText className="w-3 h-3" />{gap.relatedBRD}
                      </Badge>
                      <Badge variant="outline" className="text-xs gap-1">
                        <Code2 className="w-3 h-3" />{gap.relatedBDD}
                      </Badge>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
              <Lightbulb className="w-4 h-4" />
              AI Recommendations
            </div>
            <ul className="space-y-1.5">
              {recommendations.map((rec, i) => (
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
        {complete && (
          <Button onClick={onNext} className="rounded-xl h-11 px-6">
            Continue to Approval
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
