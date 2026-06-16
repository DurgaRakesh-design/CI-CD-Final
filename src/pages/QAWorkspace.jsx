import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import WorkflowStepper from '../components/workspace/WorkflowStepper';
import PackageSourceStep from '../components/workspace/PackageSourceStep';
import PackageDetectionStep from '../components/workspace/PackageDetectionStep';
import RequirementSourceStep from '../components/workspace/RequirementSourceStep';
import DocumentReviewStep from '../components/workspace/DocumentReviewStep';
import GapAnalysisStep from '../components/workspace/GapAnalysisStep';
import ApprovalStep from '../components/workspace/ApprovalStep';
import PipelineTriggerStep from '../components/workspace/PipelineTriggerStep';

export default function QAWorkspace() {
  const [persisted] = useState(() => loadPersistedState());
  const [internalStep, setInternalStep] = useState(persisted.internalStep);
  const [workspaceData, setWorkspaceData] = useState(persisted.workspaceData);
  const [gapResults, setGapResults] = useState(persisted.gapResults);
  const [documents, setDocuments] = useState(persisted.documents);

  const updateData = (data) => {
    setWorkspaceData(prev => ({ ...prev, ...data }));
  };

  const clearDownstream = () => {
    setDocuments([]);
    setGapResults(null);
  };

  const resetWorkspace = () => {
    const next = {
      name: 'New VerSpace Session',
      status: 'draft',
    };
    setInternalStep(0);
    setWorkspaceData(next);
    setGapResults(null);
    setDocuments([]);
    try {
      window.sessionStorage.removeItem('qa-workspace-state');
    } catch (_) {
      // ignore
    }
  };

  const internalGoNext = () => setInternalStep(prev => prev + 1);
  const internalGoBack = () => setInternalStep(prev => Math.max(prev - 1, 0));

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        'qa-workspace-state',
        JSON.stringify({
          internalStep,
          workspaceData: serializeWorkspaceData(workspaceData),
          gapResults,
          documents,
        })
      );
    } catch (_) {
      // Persistence is best effort only.
    }
  }, [internalStep, workspaceData, gapResults, documents]);

  // Map internal steps to stepper steps
  const stepperStep = internalStep <= 0 ? 0 : internalStep <= 1 ? 0 : internalStep <= 2 ? 1 : internalStep - 1;

  const renderStep = () => {
    switch (internalStep) {
      case 0:
        return <PackageSourceStep workspaceData={workspaceData} onNext={internalGoNext} onData={updateData} onResetArtifacts={clearDownstream} />;
      case 1:
        return <PackageDetectionStep workspaceData={workspaceData} onNext={internalGoNext} onBack={internalGoBack} onData={updateData} onReset={resetWorkspace} />;
      case 2:
        return <RequirementSourceStep workspaceData={workspaceData} onNext={internalGoNext} onBack={internalGoBack} onData={updateData} onResetArtifacts={clearDownstream} onReset={resetWorkspace} />;
      case 3:
        return <DocumentReviewStep workspaceData={workspaceData} documents={documents} setDocuments={setDocuments} onNext={internalGoNext} onBack={internalGoBack} gapResults={gapResults} onGapResultsChange={setGapResults} onReset={resetWorkspace} />;
      case 4:
        return <GapAnalysisStep workspaceData={workspaceData} documents={documents} setDocuments={setDocuments} gapResults={gapResults} onNext={internalGoNext} onBack={internalGoBack} onGapsFound={setGapResults} onReset={resetWorkspace} />;
      case 5:
        return <ApprovalStep documents={documents} setDocuments={setDocuments} onNext={internalGoNext} onBack={internalGoBack} onData={updateData} onReset={resetWorkspace} />;
      case 6:
        return <PipelineTriggerStep workspaceData={workspaceData} documents={documents} gapResults={gapResults} onBack={internalGoBack} onReset={resetWorkspace} />;
      default:
        return null;
    }
  };

  const mapToStepper = () => {
    if (internalStep <= 1) return 0;
    if (internalStep === 2) return 1;
    if (internalStep === 3) return 2;
    if (internalStep === 4) return 3;
    if (internalStep === 5) return 4;
    return 5;
  };

  const handleStepClick = (stepIdx) => {
    // Map stepper index back to internal step
    const mapping = [0, 2, 3, 4, 5, 6];
    if (mapping[stepIdx] !== undefined && mapping[stepIdx] <= internalStep) {
      setInternalStep(mapping[stepIdx]);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-2xl">VerSpace</h1>
              <p className="text-sm text-muted-foreground mt-1">From code discovery to quality delivery</p>
            </div>
          </div>
        </motion.div>

        {/* Stepper */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 p-4 bg-white rounded-2xl border border-border"
        >
          <WorkflowStepper currentStep={mapToStepper()} onStepClick={handleStepClick} />
        </motion.div>

        {/* Step Content */}
        <div className="min-h-[500px]">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}

function loadPersistedState() {
  const fallback = {
    internalStep: 0,
    workspaceData: {
      name: 'New VerSpace Session',
      status: 'draft',
    },
    gapResults: null,
    documents: [],
  };

  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.sessionStorage.getItem('qa-workspace-state');
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      internalStep: Number.isInteger(parsed.internalStep) ? parsed.internalStep : fallback.internalStep,
      workspaceData: sanitizeWorkspaceData(parsed.workspaceData),
      gapResults: parsed.gapResults || null,
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    };
  } catch (_) {
    return fallback;
  }
}

function serializeWorkspaceData(workspaceData) {
  const selectedPackage = workspaceData?.selected_package
    ? {
        name: workspaceData.selected_package.name || '',
        path: workspaceData.selected_package.path || '',
        size: workspaceData.selected_package.size || '',
        sha: workspaceData.selected_package.sha || '',
        downloadUrl: workspaceData.selected_package.downloadUrl || '',
      }
    : null;

  return {
    ...workspaceData,
    package_file: null,
    brd_file: null,
    bdd_files: [],
    selected_package: selectedPackage,
  };
}

function sanitizeWorkspaceData(rawWorkspaceData) {
  const fallbackWorkspace = {
    name: 'New VerSpace Session',
    status: 'draft',
  };
  const workspaceData = { ...fallbackWorkspace, ...(rawWorkspaceData || {}) };
  return {
    ...workspaceData,
    package_file: null,
    brd_file: null,
    bdd_files: [],
    selected_package: workspaceData.selected_package
      ? {
          name: workspaceData.selected_package.name || '',
          path: workspaceData.selected_package.path || '',
          size: workspaceData.selected_package.size || '',
          sha: workspaceData.selected_package.sha || '',
          downloadUrl: workspaceData.selected_package.downloadUrl || '',
        }
      : null,
  };
}
