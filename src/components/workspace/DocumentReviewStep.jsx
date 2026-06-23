import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Code2, ArrowRight, ArrowLeft, Edit3, CheckCircle2, Download, Save, Loader2, AlertTriangle, RefreshCw, TriangleAlert, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { generateRequirementSuite } from '@/services/documentService';
import { fileToText } from '@/services/encoding';
import { createDocumentDocxBlob } from '@/services/docx';
import AiLoadingVisual from './AiLoadingVisual';
import AiJobTimeline from './AiJobTimeline';
import WorkspaceActionBar from './WorkspaceActionBar';

const DOCUMENT_PAGE_SIZE = 6;

export default function DocumentReviewStep({ workspaceData, documents, setDocuments, onNext, onBack, gapResults, onGapResultsChange, onReset }) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState('');
  const [viewMode, setViewMode] = useState('business');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [docPage, setDocPage] = useState(1);
  const [gapPage, setGapPage] = useState(1);
  const [jobStatus, setJobStatus] = useState(null);
  const activeGenerationRef = useRef({ signature: '', status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    async function prepareDocs() {
      const signature = workspaceData.requirement_signature || 'default';
      const docsMatchSignature =
        documents.length > 0 &&
        documents.every((doc) => (doc.source_signature || '') === signature);

      if (docsMatchSignature) {
        activeGenerationRef.current = { signature, status: 'completed' };
        setSelectedId(prev => prev || documents[0].id);
        return;
      }
      if (!workspaceData.requirement_source) return;
      if (
        activeGenerationRef.current.signature === signature &&
        activeGenerationRef.current.status === 'running'
      ) {
        return;
      }
      if (
        workspaceData.requirement_source === 'ai_generated' &&
        !workspaceData.package_file &&
        !workspaceData.package_signals?.projectName &&
        !workspaceData.package_signals?.fileName
      ) {
        setError('Package context is missing for AI generation. Please go back, reselect the package, and try again.');
        return;
      }
      activeGenerationRef.current = { signature, status: 'running' };
      setLoading(true);
      setError('');
      setJobStatus({
        status: 'running',
        stage: 'queued',
        progress: 1,
        message: 'Preparing the AI document generation job.',
        logs: [],
        updatedAt: new Date().toISOString(),
      });
      try {
        let nextDocs;
        if (workspaceData.requirement_source === 'uploaded') {
          nextDocs = await buildUploadedDocuments(workspaceData);
        } else {
          nextDocs = await generateRequirementSuite({
            packageSignals: workspaceData.package_signals,
            packageFile: workspaceData.package_file,
            uploadedRequirements: [],
            gapResults,
            onStatusUpdate: setJobStatus,
          });
        }
        if (!cancelled) {
          const stampedDocs = nextDocs.map((doc) => ({
            ...doc,
            source_signature: signature,
          }));
          activeGenerationRef.current = { signature, status: 'completed' };
          setDocuments(stampedDocs);
          setSelectedId(stampedDocs[0]?.id || '');
        }
      } catch (err) {
        activeGenerationRef.current = { signature, status: 'failed' };
        if (!cancelled) setError(err.message || 'Could not prepare documents.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    prepareDocs();
    return () => {
      cancelled = true;
    };
  }, [
    documents,
    gapResults,
    setDocuments,
    workspaceData.package_file,
    workspaceData.package_signals,
    workspaceData.requirement_signature,
    workspaceData.requirement_source,
  ]);

  const gapModel = useMemo(() => buildGapModel(gapResults, documents), [gapResults, documents]);
  const selectedUnlinkedGaps = selectedId === 'unlinked-gaps';
  const selectedDoc = useMemo(
    () => selectedUnlinkedGaps ? null : documents.find((doc) => doc.id === selectedId) || documents[0],
    [documents, selectedUnlinkedGaps, selectedId]
  );
  const allBddApproved = documents.filter((doc) => doc.type === 'BDD').every((doc) => doc.approved);
  const selectedGaps = selectedDoc ? gapModel.docGapMap.get(selectedDoc.id) || [] : [];
  const visibleGaps = selectedUnlinkedGaps ? gapModel.unlinkedGaps : selectedGaps;
  const totalGapPages = Math.max(1, visibleGaps.length);
  const activeGap = visibleGaps[Math.min(gapPage - 1, totalGapPages - 1)];
  const hasGapAnalysis = Array.isArray(gapResults?.findings);
  const documentSourceLabel = workspaceData.requirement_source === 'uploaded' ? 'Manual upload' : 'AI generated';
  const orderedDocuments = useMemo(
    () => [...documents.filter((doc) => doc.type === 'BRD'), ...documents.filter((doc) => doc.type === 'BDD')],
    [documents]
  );
  const totalDocPages = Math.max(1, Math.ceil(orderedDocuments.length / DOCUMENT_PAGE_SIZE));
  const pagedDocuments = orderedDocuments.slice((docPage - 1) * DOCUMENT_PAGE_SIZE, docPage * DOCUMENT_PAGE_SIZE);
  const isLastDocPage = docPage >= totalDocPages;

  useEffect(() => {
    setDocPage((page) => Math.min(page, totalDocPages));
  }, [totalDocPages]);

  useEffect(() => {
    setGapPage(1);
  }, [selectedId]);

  useEffect(() => {
    setGapPage((page) => Math.min(page, totalGapPages));
  }, [totalGapPages]);

  const updateDoc = (docId, patch) => {
    setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, ...patch, lastEdited: new Date().toISOString() } : doc));
  };

  const handleApprove = (docId) => updateDoc(docId, { approved: true, status: 'approved' });

  const handleEditStart = () => {
    setEditContent(
      selectedDoc?.type === 'BDD' && viewMode === 'gherkin'
        ? selectedDoc.gherkinContent || selectedDoc.content || ''
        : selectedDoc?.content || ''
    );
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!selectedDoc) return;
    const patch = selectedDoc.type === 'BDD' && viewMode === 'gherkin'
      ? { gherkinContent: editContent, approved: false, status: 'review' }
      : { content: editContent, approved: false, status: 'review' };
    updateDoc(selectedDoc.id, patch);
    setIsEditing(false);
  };

  const regenerateSelectedDoc = async () => {
    if (!selectedDoc) return;
    setRegenLoading(true);
    setError('');
    try {
      const nextDocs = await generateRequirementSuite({
        packageSignals: workspaceData.package_signals,
        uploadedRequirements: [],
        gapResults: { findings: selectedGaps },
        generationMode: 'regenerate_document',
        targetDocument: selectedDoc,
      });
      const replacement = pickReplacementDoc(nextDocs, selectedDoc);
      const mergedReplacement = mergeRegeneratedDocument(selectedDoc, replacement);
      setDocuments(prev => prev.map((doc) => doc.id === selectedDoc.id ? {
        ...doc,
        content: mergedReplacement.content || doc.content,
        gherkinContent: mergedReplacement.gherkinContent || doc.gherkinContent,
        module: replacement.module || doc.module,
        approved: false,
        status: 'review',
        source: replacement.source || doc.source,
        lastEdited: new Date().toISOString(),
      } : doc));
      setViewMode('business');
      setIsEditing(false);
      markGapFindingsCovered(selectedGaps, {
        resolutionType: 'document_regeneration',
        resolutionNote: `${selectedDoc.type} regenerated with linked findings.`,
      });
      toast({
        title: `${selectedDoc.type} regenerated`,
        description: 'Linked gap findings were applied to this document. Please review and approve it again.',
      });
    } catch (err) {
      setError(err.message || 'Could not regenerate the selected document.');
    } finally {
      setRegenLoading(false);
    }
  };

  const generateAllUnlinkedGaps = async () => {
    if (!gapModel.unlinkedGaps.length) return;
    setRegenLoading(true);
    setError('');
    try {
      const nextDocs = await generateRequirementSuite({
        packageSignals: workspaceData.package_signals,
        uploadedRequirements: [],
        gapResults: { findings: gapModel.unlinkedGaps },
        generationMode: 'generate_from_unlinked_gaps',
      });
      const generated = nextDocs
        .filter((doc) => doc.type === 'BDD')
        .map((doc, index) => ({
          ...doc,
          id: `${doc.id || 'bdd-gap'}-${Date.now()}-${index}`,
          approved: false,
          status: 'review',
          source_signature: workspaceData.requirement_signature || 'default',
        }));
      if (!generated.length) throw new Error('No BDD files were generated from the unlinked gaps.');
      setDocuments(prev => [...prev, ...generated]);
      setSelectedId(generated[0].id);
      setViewMode('business');
      setIsEditing(false);
      markGapFindingsCovered(gapModel.unlinkedGaps, {
        resolutionType: 'bdd_gap_generation',
        resolutionNote: `${generated.length} BDD document${generated.length === 1 ? '' : 's'} generated for unlinked findings.`,
      });
      toast({
        title: 'BDD coverage generated',
        description: `${generated.length} BDD document${generated.length === 1 ? '' : 's'} created from unlinked gap findings.`,
      });
    } catch (err) {
      setError(err.message || 'Could not generate BDD files from unlinked gaps.');
    } finally {
      setRegenLoading(false);
    }
  };

  const markGapFindingsCovered = (resolvedGaps, resolution = {}) => {
    if (!onGapResultsChange || !Array.isArray(gapResults?.findings)) return;
    const resolvedKeys = new Set(resolvedGaps.map(gapKey));
    const updatedFindings = gapResults.findings.map((gap) => resolvedKeys.has(gapKey(gap))
      ? {
          ...gap,
          status: 'covered',
          coverageStatus: 'covered_after_regeneration',
          coveredAt: new Date().toISOString(),
          resolutionType: resolution.resolutionType || 'document_update',
          resolutionNote: resolution.resolutionNote || 'Document was updated from this finding.',
        }
      : gap);
    const activeFindings = updatedFindings.filter((gap) => !isCoveredGap(gap));
    const coveredFindings = updatedFindings.filter(isCoveredGap);
    onGapResultsChange({
      ...gapResults,
      findings: updatedFindings,
      summary: {
        ...(gapResults.summary || {}),
        ...summarizeFindings(activeFindings),
        covered: coveredFindings.length,
      },
      updatedAt: new Date().toISOString(),
      analysisSource: 'regeneration_update',
      recommendations: activeFindings.length
        ? gapResults.recommendations || []
        : ['All previously discovered gaps are marked covered by document updates. Re-run gap analysis to verify closure against source code.'],
    });
  };

  const downloadDoc = async (doc) => {
    const blob = await createDocumentDocxBlob(doc);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${doc.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.docx`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4 pb-24">
        <AiLoadingVisual
          title="Preparing Review Documents"
          description="Generating production-grade BRD and BDD drafts in the background. This can take a bit longer for large projects."
        />
        {jobStatus && (
          <AiJobTimeline
            status={jobStatus}
            title="Document generation progress"
            description="Track package upload, OpenAI file handling, and BRD/BDD generation stages live while the workspace prepares your review set."
          />
        )}
        <WorkspaceActionBar
          onReset={onReset}
          left={(
            <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          )}
          right={(
            <Button disabled className="rounded-xl h-11 px-6">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating Documents
            </Button>
          )}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-10 space-y-4">
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 border border-red-100 text-sm">
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
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pb-24">
      <div className="text-center mb-4">
        <h2 className="font-heading font-bold text-2xl">Document Review</h2>
        <p className="text-muted-foreground mt-1 text-sm">Review, edit, and approve your requirement documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_360px] gap-4 items-stretch">
        <div className="bg-white rounded-xl border border-border p-4 h-[700px] overflow-hidden flex flex-col">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Requirement Tree</h3>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
            <TreeGroup
              label="BRD"
              count={documents.filter((d) => d.type === 'BRD').length}
              icon={<FileText className="w-4 h-4 text-blue-500" />}
            >
              {pagedDocuments.filter((doc) => doc.type === 'BRD').map((doc) => renderTreeItem(doc, gapModel.docGapMap.get(doc.id) || [], selectedDoc?.id === doc.id, () => { setSelectedId(doc.id); setIsEditing(false); }))}
            </TreeGroup>
            <TreeGroup
              label="BDD"
              count={documents.filter((d) => d.type === 'BDD').length}
              icon={<Code2 className="w-4 h-4 text-violet-500" />}
            >
              {pagedDocuments.filter((doc) => doc.type === 'BDD').map((doc) => renderTreeItem(doc, gapModel.docGapMap.get(doc.id) || [], selectedDoc?.id === doc.id, () => { setSelectedId(doc.id); setIsEditing(false); }))}
            </TreeGroup>
            {gapModel.unlinkedGaps.length > 0 && isLastDocPage && (
              <TreeGroup
                label="Unlinked Gaps"
                count={gapModel.unlinkedGaps.length}
                icon={<TriangleAlert className="w-4 h-4 text-amber-500" />}
              >
                {renderGapGroupItem(gapModel.unlinkedGaps, selectedUnlinkedGaps, () => { setSelectedId('unlinked-gaps'); setIsEditing(false); })}
              </TreeGroup>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-border/60 space-y-2 text-xs text-muted-foreground shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5" />
                <span>{documentSourceLabel}</span>
              </div>
              <span>{orderedDocuments.length} docs</span>
            </div>
            {orderedDocuments.length > DOCUMENT_PAGE_SIZE && (
              <DocumentPager page={docPage} totalPages={totalDocPages} onPageChange={setDocPage} />
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border flex flex-col h-[700px]">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
            <span className="font-semibold text-sm truncate">{selectedUnlinkedGaps ? 'Unlinked Gap Findings' : selectedDoc?.title}</span>
            <div className="flex items-center gap-1">
              {selectedDoc?.type === 'BDD' && !isEditing && (
                <Tabs value={viewMode} onValueChange={setViewMode} className="mr-2">
                  <TabsList className="h-7">
                    <TabsTrigger value="business" className="text-xs h-6 px-2">Business</TabsTrigger>
                    <TabsTrigger value="gherkin" className="text-xs h-6 px-2">Gherkin</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {selectedDoc && (isEditing ? (
                <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleEditStart}>
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              ))}
              {selectedDoc && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => downloadDoc(selectedDoc)}>
                  <Download className="w-3 h-3 mr-1" />
                  DOCX
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 p-6 overflow-auto">
            {selectedUnlinkedGaps ? (
              <UnlinkedGapDetail
                gaps={gapModel.unlinkedGaps}
                loading={regenLoading}
                onGenerate={generateAllUnlinkedGaps}
              />
            ) : isEditing ? (
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[520px] font-mono text-sm" />
            ) : (
              selectedDoc?.content?.trim() || selectedDoc?.gherkinContent?.trim() ? (
                <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/80">
                  {selectedDoc?.type === 'BDD' && viewMode === 'gherkin'
                    ? selectedDoc?.gherkinContent || selectedDoc?.content || ''
                    : selectedDoc?.content || ''}
                </pre>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground bg-muted/20">
                  No document content was generated for this item. Regenerate the workspace documents or upload a source file to continue.
                </div>
              )
            )}
          </div>
        </div>

        <div className="space-y-4 h-[700px] overflow-y-auto pr-1">
          <div className="bg-white rounded-xl border border-border p-4 space-y-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Readiness</h3>
            <div>
              <p className="text-3xl font-bold">{documents.filter((doc) => doc.approved).length}<span className="text-base font-normal text-muted-foreground"> / {documents.length}</span></p>
              <p className="text-xs text-muted-foreground mt-1">Approved documents</p>
            </div>
            {selectedDoc && (
              <Button
                size="sm"
                className="w-full rounded-lg h-10 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleApprove(selectedDoc.id)}
                disabled={selectedDoc.approved}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Approve {selectedDoc.type}
              </Button>
            )}
            {hasGapAnalysis && selectedDoc && selectedGaps.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full rounded-lg h-10 text-xs border-violet-200 text-violet-700"
                onClick={regenerateSelectedDoc}
                disabled={regenLoading}
              >
                {regenLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                {regenLoading ? 'Regenerating...' : 'Regenerate with findings'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-lg h-10 text-xs"
              onClick={() => setDocuments(prev => prev.map(doc => ({ ...doc, approved: true, status: 'approved' })))}
            >
              Approve All
            </Button>
            <div className={`p-3 rounded-lg text-xs border ${allBddApproved ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
              {allBddApproved ? 'Pipeline gate is ready. Approved BDD files can be sent to CI.' : 'Pipeline stays locked until all BDD documents are approved.'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detected Gaps</h3>
              {visibleGaps.length > 1 && (
                <span className="text-[11px] text-muted-foreground">Finding {Math.min(gapPage, totalGapPages)} of {totalGapPages}</span>
              )}
            </div>
            {activeGap ? (
              <div className="space-y-3">
                <div className={`p-3 rounded-xl border break-words ${severityBadge(activeGap.severity)}`}>
                  <div className="flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{activeGap.title}</p>
                      <p className="text-xs mt-1 leading-relaxed opacity-90">{activeGap.description}</p>
                      {activeGap.recommendedFix && (
                        <p className="text-xs mt-2 font-medium opacity-90">Fix: {activeGap.recommendedFix}</p>
                      )}
                    </div>
                  </div>
                </div>
                {visibleGaps.length > 1 && (
                  <GapPager page={gapPage} totalPages={totalGapPages} onPageChange={setGapPage} />
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl border bg-blue-50 border-blue-100 text-blue-700 text-xs">
                No specific gap is linked to the selected file. If the analysis found unrelated gaps, open Unlinked Gaps from the requirement tree.
              </div>
            )}
          </div>
        </div>
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
          <Button onClick={onNext} disabled={!allBddApproved} className="rounded-xl h-11 px-6">
            Continue to Gap Analysis
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      />
    </motion.div>
  );
}

async function buildUploadedDocuments(workspaceData) {
  const now = new Date().toISOString();
  const signature = workspaceData.requirement_signature || 'uploaded';
  const docs = [];
  if (workspaceData.brd_file) {
    docs.push({
      id: 'brd-uploaded',
      title: workspaceData.brd_file.name.replace(/\.[^.]+$/, ''),
      type: 'BRD',
      module: 'Application',
      status: 'review',
      approved: false,
      source: 'uploaded',
      content: await fileToText(workspaceData.brd_file),
      gherkinContent: '',
      lastEdited: now,
      source_signature: signature,
    });
  }
  for (const [index, file] of (workspaceData.bdd_files || []).entries()) {
    const text = await fileToText(file);
    docs.push({
      id: `bdd-uploaded-${index + 1}`,
      title: file.name.replace(/\.[^.]+$/, ''),
      type: 'BDD',
      module: inferFeatureModule(text, file.name),
      status: 'review',
      approved: false,
      source: 'uploaded',
      content: text,
      gherkinContent: text,
      lastEdited: now,
      source_signature: signature,
    });
  }
  return docs;
}

function inferFeatureModule(text, fileName) {
  const feature = String(text || '').match(/^\s*Feature:\s*(.+)$/im)?.[1];
  return feature || fileName.replace(/\.[^.]+$/, '');
}

function TreeGroup({ label, count, icon, children }) {
  if (!React.Children.count(children)) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {icon}
        <span>{label}</span>
        <span className="normal-case text-muted-foreground">({count} file{count === 1 ? '' : 's'})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DocumentPager({ page, totalPages, onPageChange }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Page {page} of {totalPages}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          <ChevronLeft className="w-3.5 h-3.5 mr-1" />
          Prev
        </Button>
        <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Next
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function renderTreeItem(doc, gaps = [], selected = false, onSelect = () => {}) {
  return (
    <button
      key={doc.id}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        selected ? 'bg-accent border-primary/30' : 'bg-white hover:bg-muted/40'
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{doc.title}</p>
          <p className="text-xs text-muted-foreground truncate">{doc.module}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {gaps.length > 0 && <TriangleAlert className="w-4 h-4 text-amber-500" />}
          <Badge variant="outline" className={`text-xs ${doc.approved ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
            {doc.approved ? 'approved' : 'review'}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function renderGapGroupItem(gaps, selected = false, onSelect = () => {}) {
  const highCount = gaps.filter((gap) => gap.severity === 'high').length;
  return (
    <button
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        selected ? 'bg-amber-50 border-amber-300' : 'bg-white hover:bg-muted/40'
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">Unlinked requirement gaps</p>
          <p className="text-xs text-muted-foreground truncate">{gaps.length} finding{gaps.length === 1 ? '' : 's'} need BDD coverage</p>
        </div>
        <Badge variant="outline" className={`text-xs shrink-0 ${highCount ? severityBadge('high') : severityBadge('medium')}`}>
          {highCount ? `${highCount} high` : 'review'}
        </Badge>
      </div>
    </button>
  );
}

function UnlinkedGapDetail({ gaps, loading, onGenerate }) {
  return (
    <div className="space-y-5 text-sm">
      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-violet-800">
        <p className="text-xs font-semibold uppercase tracking-wide">Unlinked Gap Coverage</p>
        <h3 className="font-semibold text-lg mt-2">Generate BDD coverage for all unlinked findings</h3>
        <p className="mt-2 leading-relaxed">
          These findings are not confidently owned by an existing BRD or BDD. Review them together, then generate a focused BDD set for the missing coverage.
        </p>
        <Button className="mt-4 rounded-xl h-10 px-5" onClick={onGenerate} disabled={loading}>
          {loading ? <img src="/ai-loading.gif" alt="" aria-hidden="true" className="w-4 h-4 mr-2 object-contain" /> : <PlusCircle className="w-4 h-4 mr-2" />}
          {loading ? 'Generating BDD coverage...' : 'Generate BDDs for unlinked gaps'}
        </Button>
      </div>
      <div className="space-y-3">
        {gaps.map((gap) => (
          <div key={gap.uiId} className={`rounded-xl border p-4 ${severityBadge(gap.severity)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{gap.title}</p>
                <p className="mt-1 text-xs leading-relaxed">{gap.description}</p>
              </div>
              <Badge variant="outline" className={`text-xs shrink-0 ${severityBadge(gap.severity)}`}>
                {gap.severity || 'medium'}
              </Badge>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <InfoTile label="Module" value={gap.module || 'Application'} />
              <InfoTile label="Recommended Fix" value={gap.recommendedFix || 'Create BDD coverage for this gap.'} />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 text-violet-800">
        <p className="font-semibold">Suggested next step</p>
        <p className="mt-1 text-xs leading-relaxed">
          If these findings are valid, generate BDD coverage for all unlinked gaps together. If a finding is not in scope, go back and update the BRD/BDD manually, then run gap analysis again to confirm closure.
        </p>
      </div>
    </div>
  );
}

function gapKey(gap) {
  return [
    gap?.title,
    gap?.description,
    gap?.module,
    gap?.relatedDocumentId,
    gap?.actionType,
  ].map((value) => String(value || '').trim().toLowerCase()).join('|');
}

function GapPager({ page, totalPages, onPageChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Prev
      </Button>
      <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
        Next
        <ChevronRight className="w-3.5 h-3.5 ml-1" />
      </Button>
    </div>
  );
}

function isCoveredGap(gap) {
  const status = String(gap?.status || gap?.coverageStatus || '').toLowerCase();
  return status === 'covered' || status.includes('covered_after_regeneration');
}

function summarizeFindings(findings) {
  const high = findings.filter((item) => item.severity === 'high').length;
  const medium = findings.filter((item) => item.severity === 'medium').length;
  const low = findings.filter((item) => item.severity === 'low').length;
  return {
    totalFindings: findings.length,
    high,
    medium,
    low,
    readiness: high ? 'Blocked' : medium ? 'Needs Review' : 'Ready',
  };
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function buildGapModel(gapResults, documents) {
  const docGapMap = new Map(documents.map((doc) => [doc.id, []]));
  const unlinkedGaps = [];
  const findings = Array.isArray(gapResults?.findings)
    ? gapResults.findings.filter((gap) => !isCoveredGap(gap))
    : [];
  findings.forEach((gap, index) => {
    const normalizedGap = { ...gap, uiId: `gap-${index}` };
    const matches = findMatchingDocuments(normalizedGap, documents);
    if (matches.length) {
      matches.forEach((match) => {
        docGapMap.set(match.id, [...(docGapMap.get(match.id) || []), normalizedGap]);
      });
    } else {
      unlinkedGaps.push(normalizedGap);
    }
  });
  return { docGapMap, unlinkedGaps };
}

function findMatchingDocument(gap, documents) {
  return findMatchingDocuments(gap, documents)[0] || null;
}

function findMatchingDocuments(gap, documents) {
  const bddMissingGap = isMissingBddGap(gap);
  const candidateDocs = bddMissingGap ? documents.filter((doc) => doc.type === 'BDD') : documents;
  const explicitId = String(gap?.relatedDocumentId || '').trim();
  if (explicitId) {
    const byId = candidateDocs.find((doc) => doc.id === explicitId);
    if (byId) return [byId];
  }
  const relatedTokens = [
    gap?.relatedDocument,
    gap?.module,
    gap?.title,
    ...(Array.isArray(gap?.documentEvidence) ? gap.documentEvidence : []),
    ...(Array.isArray(gap?.evidenceAnchors) ? gap.evidenceAnchors : []),
    ...(Array.isArray(gap?.missingScenarios) ? gap.missingScenarios : []),
  ].map(normalizeGapText).filter(Boolean);
  const meaningfulTokens = relatedTokens.filter((token) => !isGenericDocumentToken(token));
  const matches = candidateDocs.filter((doc) => {
    const title = normalizeGapText(doc.title);
    const module = normalizeGapText(doc.module);
    return meaningfulTokens.some((token) => tokenIncludesDocument(token, title, module));
  });
  if (matches.length) return matches;
  if (bddMissingGap || gap?.linkStatus === 'unlinked' || gap?.actionType === 'create_bdd') return [];
  return [];
}

function pickReplacementDoc(nextDocs, selectedDoc) {
  return nextDocs.find((doc) => doc.id === selectedDoc.id)
    || nextDocs.find((doc) => doc.type === selectedDoc.type && normalizeGapText(doc.module) === normalizeGapText(selectedDoc.module))
    || nextDocs.find((doc) => doc.type === selectedDoc.type)
    || selectedDoc;
}

function mergeRegeneratedDocument(existingDoc, replacementDoc) {
  const existingContent = String(existingDoc?.content || '').trim();
  const replacementContent = String(replacementDoc?.content || '').trim();
  const existingGherkin = String(existingDoc?.gherkinContent || '').trim();
  const replacementGherkin = String(replacementDoc?.gherkinContent || '').trim();
  return {
    ...replacementDoc,
    content: preserveRegeneratedContent({
      existing: existingContent,
      replacement: replacementContent,
      heading: 'Regeneration Addendum - Findings Coverage',
      minRetentionRatio: existingDoc?.type === 'BRD' ? 0.9 : 0.75,
    }),
    gherkinContent: preserveRegeneratedContent({
      existing: existingGherkin,
      replacement: replacementGherkin,
      heading: 'Regenerated finding coverage',
      minRetentionRatio: 0.75,
      commentPrefix: '# ',
    }),
  };
}

function preserveRegeneratedContent({ existing, replacement, heading, minRetentionRatio, commentPrefix = '' }) {
  if (!replacement) return existing;
  if (!existing) return replacement;
  if (replacement.length >= existing.length * minRetentionRatio) return replacement;
  if (existing.includes(replacement)) return existing;
  const headingLine = commentPrefix ? `${commentPrefix}${heading}` : `## ${heading}`;
  return `${existing}\n\n---\n\n${headingLine}\n${replacement}`;
}

function normalizeGapText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isGenericDocumentToken(value) {
  return [
    'brd',
    'bdd',
    'brd bdd',
    'requirement',
    'requirements',
    'business requirements document',
    'traceability matrix',
    'risk register',
  ].includes(value);
}

function isMissingBddGap(gap) {
  const text = [
    gap?.gapType,
    gap?.coverageStatus,
    gap?.actionType,
    gap?.title,
    gap?.description,
    gap?.recommendedFix,
  ].map(normalizeGapText).join(' ');
  return text.includes('missing bdd')
    || text.includes('no bdd')
    || text.includes('bdd coverage')
    || text.includes('create bdd')
    || text.includes('generate bdd');
}

function tokenIncludesDocument(token, title, module) {
  if (!token) return false;
  return title && (title.includes(token) || token.includes(title))
    || module && (module.includes(token) || token.includes(module));
}

function severityBadge(severity) {
  if (severity === 'high') return 'bg-red-50 border-red-200 text-red-700';
  if (severity === 'low') return 'bg-blue-50 border-blue-200 text-blue-700';
  return 'bg-amber-50 border-amber-200 text-amber-700';
}
