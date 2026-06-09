import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Code2, ArrowRight, ArrowLeft, Edit3, CheckCircle2, Download, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { generateRequirementSuite } from '@/services/documentService';
import { fileToText } from '@/services/encoding';

export default function DocumentReviewStep({ workspaceData, documents, setDocuments, onNext, onBack }) {
  const [selectedId, setSelectedId] = useState('');
  const [viewMode, setViewMode] = useState('business');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function prepareDocs() {
      if (documents.length) {
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
          });
        }
        if (!cancelled) {
          setDocuments(nextDocs);
          setSelectedId(nextDocs[0]?.id || '');
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
  }, [workspaceData.requirement_source]);

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedId) || documents[0],
    [documents, selectedId]
  );
  const allBddApproved = documents.filter((doc) => doc.type === 'BDD').every((doc) => doc.approved);

  const updateDoc = (docId, patch) => {
    setDocuments(prev => prev.map(doc => doc.id === docId ? { ...doc, ...patch, lastEdited: new Date().toISOString() } : doc));
  };

  const handleApprove = (docId) => updateDoc(docId, { approved: true, status: 'approved' });

  const handleEditStart = () => {
    setEditContent(selectedDoc?.type === 'BDD' && viewMode === 'gherkin' ? selectedDoc.gherkinContent : selectedDoc?.content || '');
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

  const downloadDoc = (doc) => {
    const content = doc.type === 'BDD' ? doc.gherkinContent || doc.content : doc.content;
    const extension = doc.type === 'BDD' ? 'feature' : 'md';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${doc.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
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
        <p className="text-muted-foreground mt-1 text-sm">Review, edit, and approve BRD and BDD documents before launch</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        <div className="lg:col-span-3 bg-white rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Requirement Documents</h3>
          <div className="space-y-2">
            {documents.map((doc) => (
              <button
                key={doc.id}
                onClick={() => { setSelectedId(doc.id); setIsEditing(false); }}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  selectedDoc?.id === doc.id ? 'bg-accent border-primary/30' : 'bg-white hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                      {doc.type === 'BRD' ? <FileText className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
                      {doc.type}
                    </div>
                    <p className="font-medium text-sm mt-1 truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{doc.module}</p>
                  </div>
                  {doc.approved && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                </div>
                <Badge variant="outline" className={`text-xs mt-3 ${doc.approved ? 'text-emerald-700 border-emerald-200 bg-emerald-50' : 'text-amber-700 border-amber-200 bg-amber-50'}`}>
                  {doc.approved ? 'Approved' : 'Needs Review'}
                </Badge>
              </button>
            ))}
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
                  Download
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 p-6 overflow-auto">
            {isEditing ? (
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="min-h-[420px] font-mono text-sm" />
            ) : (
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/80">
                {selectedDoc?.type === 'BDD' && viewMode === 'gherkin' ? selectedDoc?.gherkinContent : selectedDoc?.content}
              </pre>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border border-border p-4 space-y-4">
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
          <div className={`p-3 rounded-lg text-xs border ${allBddApproved ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
            {allBddApproved ? 'Pipeline gate is ready. Approved BDD files can be sent to CI.' : 'Pipeline stays locked until all BDD documents are approved.'}
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
    });
  }
  return docs;
}

function inferFeatureModule(text, fileName) {
  const feature = String(text || '').match(/^\s*Feature:\s*(.+)$/im)?.[1];
  return feature || fileName.replace(/\.[^.]+$/, '');
}
