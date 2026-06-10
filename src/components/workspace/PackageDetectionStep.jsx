import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Check, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { analyzePackageFile } from '@/services/packageAnalyzer';
import WorkspaceActionBar from './WorkspaceActionBar';

export default function PackageDetectionStep({ workspaceData, onNext, onBack, onData, onReset }) {
  const [detecting, setDetecting] = useState(true);
  const [error, setError] = useState('');
  const [signals, setSignals] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function detect() {
      setDetecting(true);
      setError('');
      try {
        let result;
        if (workspaceData.package_file) {
          result = await analyzePackageFile(workspaceData.package_file);
        } else {
          result = {
            fileName: workspaceData.package_name,
            projectName: workspaceData.package_name?.replace(/\.(zip|jar|war)$/i, '') || 'Repository Package',
            platform: 'Java',
            buildTool: 'Repository package',
            sourceFileCount: 0,
            testFileCount: 0,
            bddFileCount: 0,
            modules: ['Repository Package'],
            endpoints: [],
            classes: [],
          };
        }
        if (!cancelled) {
          setSignals(result);
          onData({
            package_signals: result,
            platform: result.platform,
            tech_stack: `${result.platform}${result.buildTool ? ` / ${result.buildTool}` : ''}`,
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Package detection failed.');
      } finally {
        if (!cancelled) setDetecting(false);
      }
    }
    detect();
    return () => {
      cancelled = true;
    };
  }, [workspaceData.package_file, workspaceData.package_name]);

  const detectedProps = [
    { label: 'Project', value: signals?.projectName || workspaceData.package_name || 'Unknown' },
    { label: 'Platform', value: signals?.platform || 'Java' },
    { label: 'Build Tool', value: signals?.buildTool || 'Unknown' },
    { label: 'Source Files', value: String(signals?.sourceFileCount ?? 0) },
    { label: 'Existing Tests', value: String(signals?.testFileCount ?? 0) },
    { label: 'BDD Files in Package', value: String(signals?.bddFileCount ?? 0) },
    { label: 'Detected Modules', value: (signals?.modules || []).slice(0, 3).join(', ') || 'Pending review' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-6 pb-24"
    >
      <div className="text-center mb-8">
        <h2 className="font-heading font-bold text-2xl">Package Detection</h2>
        <p className="text-muted-foreground mt-2">Analyzing package structure and QA signals</p>
      </div>

      {detecting ? (
        <motion.div className="flex flex-col items-center gap-6 py-10">
          <div className="w-20 h-20 rounded-2xl bg-accent flex items-center justify-center">
            <Cpu className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground text-center">Scanning Java package metadata...</p>
        </motion.div>
      ) : error ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          <WorkspaceActionBar
            onReset={onReset}
            left={(
              <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {detectedProps.map((prop, i) => (
            <motion.div
              key={prop.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between gap-3 p-4 rounded-xl bg-white border border-border"
            >
              <span className="text-sm font-medium text-muted-foreground">{prop.label}</span>
              <Badge variant="secondary" className="font-mono text-xs text-right max-w-[260px] truncate">{prop.value}</Badge>
            </motion.div>
          ))}

          <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
            <Check className="w-4 h-4" />
            <span className="font-medium">Package analysis complete</span>
          </div>

          <WorkspaceActionBar
            onReset={onReset}
            left={(
              <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            right={(
              <Button onClick={onNext} className="rounded-xl h-11 px-6">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
