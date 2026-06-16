import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Check, Loader2, Package, FileText, Fingerprint, ArrowRight, ArrowLeft, AlertTriangle, ExternalLink, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { portalConfig } from '@/config/portalConfig';
import { uploadWorkspaceInputs } from '@/services/pipelineService';
import { recordPipelineRunSnapshot } from '@/services/dashboardService';
import WorkspaceActionBar from './WorkspaceActionBar';

const stages = [
  { name: 'Upload package', key: 'package' },
  { name: 'Upload BRD', key: 'brd' },
  { name: 'Upload BDD features', key: 'bdd' },
  { name: 'Upload gap analysis', key: 'gap-analysis' },
  { name: 'Dispatch GitHub Actions', key: 'dispatch' },
];

export default function PipelineTriggerStep({ workspaceData, documents, gapResults, onBack, onReset }) {
  const navigate = useNavigate();
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const bddCount = documents.filter(doc => doc.type === 'BDD').length;
  const brdCount = documents.filter(doc => doc.type === 'BRD').length;
  const bddNames = documents.filter((doc) => doc.type === 'BDD').map((doc) => doc.title);
  const brdNames = documents.filter((doc) => doc.type === 'BRD').map((doc) => doc.title);
  const hasGapReport = Array.isArray(gapResults?.findings) && !gapResults?.skipped;
  const openGapCount = hasGapReport ? gapResults.findings.filter((gap) => !isCoveredGap(gap)).length : 0;
  const visibleStages = hasGapReport ? stages : stages.filter((stage) => stage.key !== 'gap-analysis');

  const triggerPipeline = async () => {
    setTriggering(true);
    setError('');
    setResult(null);
    try {
      const payload = await uploadWorkspaceInputs({
        packageFile: workspaceData.package_file,
        selectedPackage: workspaceData.selected_package,
        documents,
        gapResults,
        metadata: {
          platform: workspaceData.platform,
          version: workspaceData.version,
          environment: workspaceData.environment || 'dev',
          requirementSource: workspaceData.requirement_source,
        },
      });
      recordPipelineRunSnapshot({
        result: payload,
        workspaceData,
        documents,
        gapResults,
      });
      setResult(payload);
    } catch (err) {
      setError(err.message || 'Pipeline trigger failed.');
    } finally {
      setTriggering(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-6 pb-24">
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-2xl">Pipeline Execution</h2>
        <p className="text-muted-foreground mt-2">Send approved inputs to GitHub Actions</p>
      </div>

      <div className="p-4 rounded-xl bg-white border border-border space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline Inputs</h3>
        <InputRow icon={Package} label="Java Package" value={workspaceData.package_name || 'Selected package'} />
        <InputRow icon={FileText} label="BRD" value={`${brdCount} document${brdCount === 1 ? '' : 's'}`} />
        <InputRow icon={FileText} label="BDD Features" value={`${bddCount} feature file${bddCount === 1 ? '' : 's'}`} />
        <InputRow icon={BarChart3} label="Gap Analysis" value={hasGapReport ? `1 report · ${openGapCount} open finding${openGapCount === 1 ? '' : 's'}` : 'Not generated'} />
        <InputRow icon={Fingerprint} label="Target Repository" value={`${portalConfig.owner}/${portalConfig.repo} · ${portalConfig.branch}`} />
        <div className="grid gap-2 pt-2">
          {brdNames.length > 0 && <DetailList label="BRD artifacts" items={brdNames} />}
          {bddNames.length > 0 && <DetailList label="BDD feature artifacts" items={bddNames} />}
          {hasGapReport && <DetailList label="Gap analysis artifact" items={[`gap-analysis-report.md · ${openGapCount} open finding${openGapCount === 1 ? '' : 's'}`]} />}
        </div>
      </div>

      {triggering && (
        <div className="space-y-3">
          {visibleStages.map((stage) => (
            <div key={stage.key} className="flex items-center gap-3 p-3 rounded-xl border bg-primary/5 border-primary/20">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm font-medium">{stage.name}</span>
              <Badge className="ml-auto bg-primary/10 text-primary text-xs">Working</Badge>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 border border-red-100 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <Check className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-sm text-emerald-800 text-center">Pipeline Triggered</p>
            <p className="text-xs text-emerald-700 mt-2 text-center">Package, BRD, and BDD files were sent to GitHub. The CI workflow has been dispatched.</p>
          </div>
          <div className="p-3 rounded-xl bg-white border border-border text-xs text-muted-foreground space-y-1">
            <p><strong>Package:</strong> {result.packagePath}</p>
            {result.brdPath && <p><strong>BRD:</strong> {result.brdPath}</p>}
            <p><strong>BDD:</strong> {result.bddPaths.join('; ')}</p>
            {result.gapAnalysisPath && <p><strong>Gap Analysis:</strong> {result.gapAnalysisPath}</p>}
            {result.manifestPath && <p><strong>Manifest:</strong> {result.manifestPath}</p>}
          </div>
        </motion.div>
      )}
      <WorkspaceActionBar
        onReset={onReset}
        left={(
          <Button variant="outline" onClick={onBack} disabled={triggering} className="rounded-xl h-11 px-5">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        right={result ? (
          <>
            <Button asChild variant="outline" className="rounded-xl h-11 px-6">
              <a href={`https://github.com/${portalConfig.owner}/${portalConfig.repo}/actions`} target="_blank" rel="noreferrer">
                Open GitHub Actions
                <ExternalLink className="w-4 h-4 ml-2" />
              </a>
            </Button>
            <Button onClick={() => navigate('/dashboard')} className="rounded-xl h-11 px-6">
              View Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </>
        ) : (
          <Button onClick={triggerPipeline} disabled={triggering} className="rounded-xl h-11 px-6">
            {triggering ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            {triggering ? 'Triggering Pipeline...' : 'Trigger Pipeline'}
          </Button>
        )}
      />
    </motion.div>
  );
}

function InputRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground">{label}:</span>
      <Badge variant="secondary" className="font-mono text-xs truncate">{value}</Badge>
    </div>
  );
}

function isCoveredGap(gap) {
  const status = String(gap?.status || gap?.coverageStatus || '').toLowerCase();
  return status === 'covered' || status.includes('covered_after_regeneration');
}

function DetailList({ label, items }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item} className="truncate text-xs text-foreground/80">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
