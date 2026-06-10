import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, FileText, Code2, Lock, Unlock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import WorkspaceActionBar from './WorkspaceActionBar';

export default function ApprovalStep({ documents, setDocuments, onNext, onBack, onData, onReset }) {
  const allBDDApproved = documents.filter(d => d.type === 'BDD').every(d => d.approved);
  const allApproved = documents.every(d => d.approved);

  const toggleApproval = (id) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? {
      ...doc,
      approved: !doc.approved,
      status: doc.approved ? 'review' : 'approved',
      lastEdited: new Date().toISOString(),
    } : doc));
  };

  const approveAll = () => {
    setDocuments(prev => prev.map(doc => ({ ...doc, approved: true, status: 'approved', lastEdited: new Date().toISOString() })));
  };

  const handleProceed = () => {
    onData({ brd_approved: true, bdd_approved: allBDDApproved, pipeline_unlocked: allBDDApproved });
    onNext();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-6 pb-24">
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-2xl">Document Approval</h2>
        <p className="text-muted-foreground mt-2">Approve reviewed documents to unlock pipeline execution</p>
      </div>

      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              doc.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-border hover:border-primary/20'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              {doc.type === 'BRD'
                ? <FileText className={`w-5 h-5 shrink-0 ${doc.approved ? 'text-emerald-600' : 'text-blue-500'}`} />
                : <Code2 className={`w-5 h-5 shrink-0 ${doc.approved ? 'text-emerald-600' : 'text-violet-500'}`} />}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.type} - {doc.module}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant={doc.approved ? 'default' : 'outline'}
              className={`rounded-lg h-8 text-xs ${doc.approved ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
              onClick={() => toggleApproval(doc.id)}
            >
              {doc.approved ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Approved
                </>
              ) : 'Approve'}
            </Button>
          </div>
        ))}
      </div>

      {!allApproved && (
        <Button variant="outline" className="w-full rounded-xl h-10 text-sm" onClick={approveAll}>
          <ShieldCheck className="w-4 h-4 mr-2" />
          Approve All Documents
        </Button>
      )}

      <div className={`p-4 rounded-xl border ${allBDDApproved ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-3">
          {allBDDApproved ? <Unlock className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5 text-amber-600" />}
          <div>
            <p className="font-semibold text-sm">{allBDDApproved ? 'Pipeline Unlocked' : 'Pipeline Locked'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allBDDApproved
                ? 'Approved BDD feature files are ready to send to GitHub Actions.'
                : 'Approve all BDD documents to unlock pipeline execution.'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Editing an approved document resets its approval state.
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
          <Button onClick={handleProceed} disabled={!allBDDApproved} className="rounded-xl h-11 px-6">
            Continue to Pipeline
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      />
    </motion.div>
  );
}
