import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileUp, Bot, ArrowRight, ArrowLeft, FileText, CheckCircle2, File, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import WorkspaceActionBar from './WorkspaceActionBar';

export default function RequirementSourceStep({ workspaceData, onNext, onBack, onData, onResetArtifacts, onReset }) {
  const [source, setSource] = useState(
    workspaceData?.requirement_source === 'uploaded'
      ? 'attach'
      : workspaceData?.requirement_source === 'ai_generated'
        ? 'generate'
        : null
  );
  const [brdFile, setBrdFile] = useState(workspaceData?.brd_file || null);
  const [bddFiles, setBddFiles] = useState(workspaceData?.bdd_files || []);
  const lastSignatureRef = useRef('');

  const handleBrdUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) setBrdFile(file);
    e.target.value = '';
  };

  const handleBddUpload = (e) => {
    const newFiles = Array.from(e.target.files || []);
    setBddFiles(prev => {
      const existing = new Set(prev.map(file => file.name));
      const toAdd = newFiles.filter(f => !existing.has(f.name));
      return [...prev, ...toAdd];
    });
    e.target.value = '';
  };

  const removeBdd = (name) => setBddFiles(prev => prev.filter(f => f.name !== name));
  const removeBrd = () => setBrdFile(null);

  const canProceed =
    source === 'generate' ||
    (source === 'attach' && brdFile !== null && bddFiles.length > 0);

  const requirementSignature = useMemo(() => {
    if (source === 'attach') {
      const brdName = brdFile?.name || 'no-brd';
      const bddNames = bddFiles.map((file) => file.name).join('|') || 'no-bdd';
      return `uploaded|brd:${brdName}|bdd:${bddNames}`;
    }
    const packageName = workspaceData?.package_name || workspaceData?.selected_package?.name || workspaceData?.package_file?.name || 'package';
    const packageSource = workspaceData?.package_source || 'unknown';
    const platform = workspaceData?.platform || 'Java';
    const version = workspaceData?.version || 'unversioned';
    return `generated|package:${packageName}|source:${packageSource}|platform:${platform}|version:${version}`;
  }, [bddFiles, brdFile, source, workspaceData]);

  useEffect(() => {
    if (!source) return;
    const signature = requirementSignature;
    if (lastSignatureRef.current && lastSignatureRef.current !== signature) {
      onResetArtifacts?.();
    }
    lastSignatureRef.current = signature;
    onData({
      requirement_source: source === 'attach' ? 'uploaded' : 'ai_generated',
      brd_file: brdFile,
      bdd_files: bddFiles,
      requirement_signature: requirementSignature,
    });
  }, [source, brdFile, bddFiles, requirementSignature, onData]);

  const handleProceed = () => {
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6 pb-24"
    >
      <div className="text-center mb-8">
        <h2 className="font-heading font-bold text-2xl">Requirement Source</h2>
        <p className="text-muted-foreground mt-2">Provide existing requirements or let AI generate them</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            source === 'attach' ? 'border-primary ring-2 ring-primary/20 bg-accent' : 'hover:border-primary/30'
          }`}
          onClick={() => setSource('attach')}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
              <FileUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Attach Existing Files</h3>
              <p className="text-xs text-muted-foreground mt-1">Upload your BRD and BDD documents</p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-6 cursor-pointer transition-all hover:shadow-md ${
            source === 'generate' ? 'border-primary ring-2 ring-primary/20 bg-accent' : 'hover:border-primary/30'
          }`}
          onClick={() => setSource('generate')}
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center">
              <Bot className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Generate with AI</h3>
              <p className="text-xs text-muted-foreground mt-1">AI generates BRD and BDD from package</p>
            </div>
          </div>
        </Card>
      </div>

      <AnimatePresence>
        {source === 'attach' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            {/* BRD - single file */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-700 border-0 text-xs font-semibold">BRD</Badge>
                <span className="text-xs text-muted-foreground">Business Requirements Document - single file only</span>
              </div>
              {!brdFile ? (
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 cursor-pointer hover:bg-blue-50 transition-colors">
                  <FileUp className="w-5 h-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-700">Upload BRD file</p>
                    <p className="text-xs text-muted-foreground">.docx, .pdf, .md, .txt</p>
                  </div>
                  <input type="file" accept=".docx,.pdf,.md,.txt" className="hidden" onChange={handleBrdUpload} />
                </label>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-white border border-border">
                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{brdFile.name}</span>
                  <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 shrink-0">BRD</Badge>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <button onClick={removeBrd} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* BDDs - multiple files */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-violet-100 text-violet-700 border-0 text-xs font-semibold">BDD</Badge>
                <span className="text-xs text-muted-foreground">Behavior-Driven Documents - multiple files allowed</span>
              </div>
              <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 cursor-pointer hover:bg-violet-50 transition-colors">
                <Plus className="w-5 h-5 text-violet-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-violet-700">Upload BDD / Feature files</p>
                  <p className="text-xs text-muted-foreground">.feature, .docx, .pdf, .md</p>
                </div>
                <input type="file" multiple accept=".feature,.docx,.pdf,.md,.txt" className="hidden" onChange={handleBddUpload} />
              </label>
              {bddFiles.length > 0 && (
                <div className="space-y-1.5">
                  {bddFiles.map((f) => (
                    <div key={f.name} className="flex items-center gap-2 p-3 rounded-xl bg-white border border-border">
                      <File className="w-4 h-4 text-violet-500 shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">{f.name}</span>
                      <Badge variant="outline" className="text-xs text-violet-600 border-violet-200 shrink-0">BDD</Badge>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <button onClick={() => removeBdd(f.name)} className="ml-1 text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(!brdFile || bddFiles.length === 0) && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <span>⚠</span>
                {!brdFile && bddFiles.length === 0
                  ? 'Upload 1 BRD file and at least 1 BDD file to continue.'
                  : !brdFile
                  ? 'Upload a BRD file to continue.'
                  : 'Upload at least 1 BDD file to continue.'}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {source === 'generate' && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="p-6 rounded-2xl bg-violet-50/50 border border-violet-100"
          >
            <div className="flex items-start gap-3">
              <Bot className="w-5 h-5 text-violet-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-violet-800">AI Generation Ready</p>
                <p className="text-xs text-violet-600 mt-1">
                  Our AI will analyze your package structure, annotations, controllers, and services to generate a comprehensive BRD and multiple BDD feature files.
                </p>
                <div className="mt-3 flex gap-2">
                  <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">1 BRD</Badge>
                  <Badge className="bg-violet-100 text-violet-700 border-0 text-xs">Multiple BDDs</Badge>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <WorkspaceActionBar
        onReset={onReset}
        left={(
          <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        )}
        right={(
          <Button onClick={handleProceed} disabled={!canProceed} className="rounded-xl h-11 px-6">
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      />
    </motion.div>
  );
}
