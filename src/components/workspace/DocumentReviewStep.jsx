import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Code2, ArrowRight, ArrowLeft, Edit3, CheckCircle2, Download, Save, Loader2, AlertTriangle, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateRequirementSuite } from '@/services/documentService';
import { fileToText } from '@/services/encoding';
import { createDocumentDocxBlob } from '@/services/docx';

export default function DocumentReviewStep({ workspaceData, documents, setDocuments, onNext, onBack, gapResults, onGapClear }) {
  const [selectedId, setSelectedId] = useState('');
  const [viewMode, setViewMode] = useState('business');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function prepareDocs() {
      const signature = workspaceData.requirement_signature || 'default';
      const docsMatchSignature =
        documents.length > 0 &&
        documents.every((doc) => (doc.source_signature || '') === signature);

      if (docsMatchSignature) {
        setSelectedId(prev => prev || documents[0].id);
        return;
      }
      setLoading(true);
      setError('');
      try {
        let nextDocs;
        if (workspaceData.requirement_source === 'uploaded') {
          nextDocs = await buildUploadedDocuments(workspaceData);
        } else {
          nextDocs = await generateRequirementSuite({
            packageSignals: workspaceData.package_signals,
            uploadedRequirements: [],
            gapResults,
          });
        }
        if (!cancelled) {
          const stampedDocs = nextDocs.map((doc) => ({
            ...doc,
            source_signature: signature,
          }));
          setDocuments(stampedDocs);
          setSelectedId(stampedDocs[0]?.id || '');
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not prepare documents.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    prepareDocs();
    return () => {
      cancelled = true;
    };
  }, [documents, gapResults, setDocuments, workspaceData]);

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedId) || documents[0],
    [documents, selectedId]
  );
  const allBddApproved = documents.filter((doc) => doc.type === 'BDD').every((doc) => doc.approved);
  const docGapMap = useMemo(() => buildGapMap(gapResults, documents), [gapResults, documents]);
  const selectedGaps = docGapMap.get(selectedDoc?.id || '') || [];

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

  const regenerateDocs = async () => {
    setRegenLoading(true);
    setError('');
    try {
      let nextDocs;
      if (workspaceData.requirement_source === 'uploaded') {
        nextDocs = await buildUploadedDocuments(workspaceData);
      } else {
        nextDocs = await generateRequirementSuite({
          packageSignals: workspaceData.package_signals,
          uploadedRequirements: [],
          gapResults,
        });
      }
      const stampedDocs = nextDocs.map((doc) => ({
        ...doc,
        approved: false,
        status: 'review',
        source_signature: workspaceData.requirement_signature || 'default',
      }));
      setDocuments(stampedDocs);
      setSelectedId(stampedDocs[0]?.id || '');
      setViewMode('business');
      setIsEditing(false);
      onGapClear?.();
    } catch (err) {
      setError(err.message || 'Could not regenerate documents.');
    } finally {
      setRegenLoading(false);
    }
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
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
        <h2 className="font-heading font-bold text-2xl">Preparing Review Documents</h2>
        <p className="text-sm text-muted-foreground">Generating production-grade BRD and BDD drafts from package signals.</p>
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
        <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="text-center mb-4">
        <h2 className="font-heading font-bold text-2xl">Document Review</h2>
        <p className="text-muted-foreground mt-1 text-sm">Review, edit, and approve your requirement documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        <div className="lg:col-span-3 bg-white rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Requirement Tree</h3>
          <div className="space-y-2">
            <TreeGroup
              label="BRD"
              count={documents.filter((d) => d.type === 'BRD').length}
              icon={<FileText className="w-4 h-4 text-blue-500" />}
            >
              {documents.filter((doc) => doc.type === 'BRD').map((doc) => renderTreeItem(doc, [], selectedDoc?.id === doc.id, () => { setSelectedId(doc.id); setIsEditing(false); }))}
            </TreeGroup>
            <TreeGroup
              label="BDD"
              count={documents.filter((d) => d.type === 'BDD').length}
              icon={<Code2 className="w-4 h-4 text-violet-500" />}
            >
              {documents.filter((doc) => doc.type === 'BDD').map((doc) => renderTreeItem(doc, docGapMap.get(doc.id) || [], selectedDoc?.id === doc.id, () => { setSelectedId(doc.id); setIsEditing(false); }))}
            </TreeGroup>
            <div className="pt-3 mt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5" />
                <span>AI Generated</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white rounded-xl border border-border flex flex-col">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
            <span className="font-semibold text-sm truncate">{selectedDoc?.title}</span>
            <div className="flex items-center gap-1">
              {selectedDoc?.type === 'BDD' && !isEditing && (
                <Tabs value={viewMode} onValueChange={setViewMode} className="mr-2">
                  <TabsList className="h-7">
                    <TabsTrigger value="business" className="text-xs h-6 px-2">Business</TabsTrigger>
                    <TabsTrigger value="gherkin" className="text-xs h-6 px-2">Gherkin</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {isEditing ? (
                <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleEditStart}>
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
              {selectedDoc && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => downloadDoc(selectedDoc)}>
                  <Download className="w-3 h-3 mr-1" />
                  DOCX
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            {isEditing ? (
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[420px] font-mono text-sm" />
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

        <div className="lg:col-span-3 space-y-4">
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
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-lg h-10 text-xs"
              onClick={() => setDocuments(prev => prev.map(doc => ({ ...doc, approved: true, status: 'approved' })))}
            >
              Approve All
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-lg h-10 text-xs border-violet-200 text-violet-700"
              onClick={regenerateDocs}
              disabled={regenLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regenLoading ? 'animate-spin' : ''}`} />
              Re-generate
            </Button>
            <div className={`p-3 rounded-lg text-xs border ${allBddApproved ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
              {allBddApproved ? 'Pipeline gate is ready. Approved BDD files can be sent to CI.' : 'Pipeline stays locked until all BDD documents are approved.'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Approval Status</h3>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-muted-foreground">{doc.title}</span>
                  <Badge variant="outline" className={`text-xs ${doc.approved ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
                    {doc.approved ? 'approved' : 'review'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Detected Gaps</h3>
            {selectedGaps.length > 0 ? (
              <div className="space-y-2">
                {selectedGaps.map((gap, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${severityBadge(gap.severity)}`}>
                    <div className="flex items-start gap-2">
                      <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{gap.title}</p>
                        <p className="text-xs mt-1 opacity-90">{gap.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-xl border bg-blue-50 border-blue-100 text-blue-700 text-xs">
                No specific gap is linked to the selected file yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!allBddApproved} className="rounded-xl h-11 px-6">
          Continue to Gap Analysis
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
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

function buildGapMap(gapResults, documents) {
  const map = new Map();
  const findings = Array.isArray(gapResults?.findings) ? gapResults.findings : [];
  for (const doc of documents) {
    const docFindings = findings.filter((gap) => {
      const related = String(gap?.relatedDocument || gap?.module || gap?.title || '').toLowerCase();
      const title = String(doc?.title || '').toLowerCase();
      const module = String(doc?.module || '').toLowerCase();
      return related.includes(title) || related.includes(module) || title.includes(related) || module.includes(related);
    });
    map.set(doc.id, docFindings);
  }
  return map;
}

function severityBadge(severity) {
  if (severity === 'high') return 'bg-red-50 border-red-200 text-red-700';
  if (severity === 'low') return 'bg-blue-50 border-blue-200 text-blue-700';
  return 'bg-amber-50 border-amber-200 text-amber-700';
}
