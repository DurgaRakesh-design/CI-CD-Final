import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Play, Check, Loader2, Package, FileText, Fingerprint, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

const stages = [
  { name: 'Detect', status: 'pending' },
  { name: 'Build', status: 'pending' },
  { name: 'Test', status: 'pending' },
  { name: 'Analyse', status: 'pending' },
  { name: 'Reports', status: 'pending' },
  { name: 'Publish', status: 'pending' },
];

export default function PipelineTriggerStep({ workspaceData }) {
  const navigate = useNavigate();
  const [triggered, setTriggered] = useState(false);
  const [pipelineStages, setPipelineStages] = useState(stages);
  const [currentStageIdx, setCurrentStageIdx] = useState(-1);

  const triggerPipeline = () => {
    setTriggered(true);
    setCurrentStageIdx(0);
  };

  useEffect(() => {
    if (currentStageIdx >= 0 && currentStageIdx < pipelineStages.length) {
      setPipelineStages(prev => prev.map((s, i) => ({
        ...s,
        status: i === currentStageIdx ? 'running' : i < currentStageIdx ? 'success' : 'pending'
      })));
      
      const timer = setTimeout(() => {
        setPipelineStages(prev => prev.map((s, i) => ({
          ...s,
          status: i <= currentStageIdx ? 'success' : 'pending'
        })));
        setCurrentStageIdx(prev => prev + 1);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStageIdx]);

  const allDone = pipelineStages.every(s => s.status === 'success');

  const stageIcon = (status) => {
    if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    if (status === 'success') return <Check className="w-4 h-4 text-emerald-600" />;
    return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-2xl">Pipeline Execution</h2>
        <p className="text-muted-foreground mt-2">Trigger GitHub Actions CI/CD pipeline</p>
      </div>

      {/* Pipeline Inputs */}
      <div className="p-4 rounded-xl bg-white border border-border space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline Inputs</h3>
        <div className="flex items-center gap-3 text-sm">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Java Package:</span>
          <Badge variant="secondary" className="font-mono text-xs">{workspaceData.package_name || 'payment-service'}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">BDD Features:</span>
          <Badge variant="secondary" className="font-mono text-xs">2 feature files (Gherkin)</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Fingerprint className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Traceability:</span>
          <Badge variant="secondary" className="font-mono text-xs">Metadata attached</Badge>
        </div>
      </div>

      {!triggered ? (
        <div className="text-center py-6">
          <Button onClick={triggerPipeline} size="lg" className="rounded-xl h-12 px-8 shadow-lg shadow-primary/20">
            <Play className="w-5 h-5 mr-2" />
            Trigger Pipeline
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pipeline Stages</h3>
          {pipelineStages.map((stage, i) => (
            <motion.div
              key={stage.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                stage.status === 'running'
                  ? 'bg-primary/5 border-primary/20'
                  : stage.status === 'success'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-muted/50 border-border'
              }`}
            >
              {stageIcon(stage.status)}
              <span className={`text-sm font-medium ${
                stage.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'
              }`}>{stage.name}</span>
              {stage.status === 'running' && (
                <Badge className="ml-auto bg-primary/10 text-primary text-xs">Running</Badge>
              )}
              {stage.status === 'success' && (
                <Badge className="ml-auto bg-emerald-100 text-emerald-700 text-xs">Complete</Badge>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {allDone && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 pt-4"
        >
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <p className="font-semibold text-sm text-emerald-800">Pipeline Complete!</p>
            <p className="text-xs text-emerald-600 mt-1">All stages completed successfully.</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="rounded-xl h-11 px-6">
            View Dashboard
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

function CheckCircle(props) {
  return <Check {...props} />;
}
