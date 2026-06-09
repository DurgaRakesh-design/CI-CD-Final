import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, ArrowLeft, CheckCircle2, FileText, Code2, Lock, Unlock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const docs = [
  { id: 'brd-1', title: 'Payment Processing BRD', type: 'BRD' },
  { id: 'bdd-1', title: 'Payment Processing BDD', type: 'BDD' },
  { id: 'bdd-2', title: 'User Management BDD', type: 'BDD' },
  { id: 'bdd-3', title: 'Refund Flow BDD', type: 'BDD' },
];

export default function ApprovalStep({ onNext, onBack, onData }) {
  const [approvals, setApprovals] = useState({});

  const toggleApproval = (id) => {
    setApprovals(prev => {
      const updated = { ...prev };
      if (updated[id]) {
        delete updated[id];
      } else {
        updated[id] = true;
      }
      return updated;
    });
  };

  const approveAll = () => {
    setApprovals(Object.fromEntries(docs.map(d => [d.id, true])));
  };

  const allBDDApproved = docs.filter(d => d.type === 'BDD').every(d => approvals[d.id]);
  const allApproved = docs.every(d => approvals[d.id]);

  const handleProceed = () => {
    onData({ brd_approved: true, bdd_approved: true, pipeline_unlocked: allBDDApproved });
    onNext();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-6"
    >
      <div className="text-center mb-6">
        <h2 className="font-heading font-bold text-2xl">Document Approval</h2>
        <p className="text-muted-foreground mt-2">Approve documents to unlock pipeline execution</p>
      </div>

      <div className="space-y-2">
        {docs.map((doc) => (
          <motion.div
            key={doc.id}
            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
              approvals[doc.id]
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-white border-border hover:border-primary/20'
            }`}
          >
            <div className="flex items-center gap-3">
              {doc.type === 'BRD' ? (
                <FileText className={`w-5 h-5 ${approvals[doc.id] ? 'text-emerald-600' : 'text-blue-500'}`} />
              ) : (
                <Code2 className={`w-5 h-5 ${approvals[doc.id] ? 'text-emerald-600' : 'text-violet-500'}`} />
              )}
              <div>
                <p className="font-medium text-sm">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.type}</p>
              </div>
            </div>
            <Button
              size="sm"
              variant={approvals[doc.id] ? 'default' : 'outline'}
              className={`rounded-lg h-8 text-xs ${
                approvals[doc.id] ? 'bg-emerald-600 hover:bg-emerald-700' : ''
              }`}
              onClick={() => toggleApproval(doc.id)}
            >
              {approvals[doc.id] ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Approved
                </>
              ) : (
                'Approve'
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {!allApproved && (
        <Button variant="outline" className="w-full rounded-xl h-10 text-sm" onClick={approveAll}>
          <ShieldCheck className="w-4 h-4 mr-2" />
          Approve All Documents
        </Button>
      )}

      {/* Pipeline Gate Status */}
      <div className={`p-4 rounded-xl border ${
        allBDDApproved
          ? 'bg-emerald-50 border-emerald-200'
          : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center gap-3">
          {allBDDApproved ? (
            <Unlock className="w-5 h-5 text-emerald-600" />
          ) : (
            <Lock className="w-5 h-5 text-amber-600" />
          )}
          <div>
            <p className="font-semibold text-sm">{allBDDApproved ? 'Pipeline Unlocked' : 'Pipeline Locked'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allBDDApproved
                ? 'All BDD documents approved. You can now trigger the pipeline.'
                : 'Approve all BDD documents to unlock pipeline execution.'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Editing an approved document will reset its approval status.
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={handleProceed}
          disabled={!allBDDApproved}
          className="rounded-xl h-11 px-6"
        >
          Continue to Pipeline
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
