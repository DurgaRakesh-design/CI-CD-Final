import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Code2, ArrowRight, ArrowLeft, Edit3, CheckCircle2, RefreshCw, Download, Bot, Save, AlertTriangle, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const sampleBRD = `# Business Requirements Document
## Payment Processing Module

### 1. Overview
The payment processing module handles all payment-related transactions including credit card processing, refund management, and payment history tracking.

### 2. Business Requirements
**BR-001**: The system shall process credit card payments via Stripe gateway  
**BR-002**: The system shall support automatic retry for failed payments (max 3 attempts)  
**BR-003**: The system shall generate payment receipts in PDF format  
**BR-004**: The system shall maintain audit logs for all financial transactions  
**BR-005**: The system shall support partial refunds with approval workflow  

### 3. Acceptance Criteria
- Payment processing must complete within 3 seconds
- All transactions must be PCI DSS compliant
- Failed payments must trigger user notification`;

const sampleBDD = `Feature: Payment Processing
  As a customer
  I want to make payments securely
  So that I can purchase products

  Scenario: Successful credit card payment
    Given a customer has items in their cart
    And the cart total is "$49.99"
    When the customer enters valid credit card details
    And clicks "Pay Now"
    Then the payment should be processed successfully
    And a confirmation email should be sent
    And a receipt PDF should be generated

  Scenario: Failed payment with retry
    Given a customer submits a payment
    When the payment gateway returns a failure
    Then the system should retry up to 3 times
    And notify the customer if all retries fail

  Scenario: Partial refund processing
    Given a completed order exists
    When an admin initiates a partial refund of "$20.00"
    Then the refund should require approval
    And the refund amount should be credited within 5-7 days`;

const initialDocuments = [
  { id: 'brd-1', title: 'Payment Processing BRD', type: 'BRD', status: 'review', source: 'ai_generated' },
  { id: 'bdd-1', title: 'Payment Processing BDD', type: 'BDD', status: 'review', source: 'ai_generated' },
  { id: 'bdd-2', title: 'User Management BDD', type: 'BDD', status: 'review', source: 'ai_generated' },
  { id: 'bdd-3', title: 'Refund Flow BDD', type: 'BDD', status: 'review', source: 'ai_generated' },
];

// Maps gap relatedBDD titles to doc IDs
const gapDocMapping = {
  'Payment Processing BDD': ['bdd-1'],
  'User Management BDD': ['bdd-2'],
  'Refund Flow BDD': ['bdd-3'],
  'Payment Processing BRD': ['brd-1'],
};

const severityColors = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

export default function DocumentReviewStep({ onNext, onBack, gapResults }) {
  const [selectedDoc, setSelectedDoc] = useState(initialDocuments[0]);
  const [viewMode, setViewMode] = useState('business');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [docContents, setDocContents] = useState({});
  const [docStatuses, setDocStatuses] = useState(
    Object.fromEntries(initialDocuments.map(d => [d.id, d.status]))
  );
  const [regenerating, setRegenerating] = useState({});
  const [regeneratedDocs, setRegeneratedDocs] = useState(new Set());

  // When gap results arrive, set only docs WITH gaps to 'review'
  const prevGapResults = useRef(null);
  if (gapResults && gapResults !== prevGapResults.current) {
    prevGapResults.current = gapResults;
    const gapDocIds = new Set(
      gapResults.flatMap(gap => [
        ...(gapDocMapping[gap.relatedBDD] || []),
        ...(gapDocMapping[gap.relatedBRD] || []),
      ])
    );
    setDocStatuses(prev => {
      const updated = { ...prev };
      gapDocIds.forEach(id => { updated[id] = 'review'; });
      return updated;
    });
    setRegeneratedDocs(new Set());
  }

  const getContent = (doc) => docContents[doc.id] || (doc.type === 'BRD' ? sampleBRD : sampleBDD);

  const handleApprove = (docId) => {
    setDocStatuses(prev => ({ ...prev, [docId]: 'approved' }));
  };

  const handleRegenerate = (docId) => {
    setRegenerating(prev => ({ ...prev, [docId]: true }));
    setTimeout(() => {
      setRegenerating(prev => ({ ...prev, [docId]: false }));
      setDocStatuses(prev => ({ ...prev, [docId]: 'review' }));
      setRegeneratedDocs(prev => new Set([...prev, docId]));
    }, 1500);
  };

  const handleEditStart = () => {
    setEditContent(getContent(selectedDoc));
    setIsEditing(true);
  };

  const handleSave = () => {
    setDocContents(prev => ({ ...prev, [selectedDoc.id]: editContent }));
    // Reset approval if content was edited
    if (docStatuses[selectedDoc.id] === 'approved') {
      setDocStatuses(prev => ({ ...prev, [selectedDoc.id]: 'review' }));
    }
    setIsEditing(false);
  };

  const allApproved = initialDocuments.every(d => docStatuses[d.id] === 'approved');

  // Get gaps relevant to the selected document
  const docGaps = gapResults
    ? gapResults.filter(gap => {
        const mappedIds = [
          ...(gapDocMapping[gap.relatedBDD] || []),
          ...(gapDocMapping[gap.relatedBRD] || []),
        ];
        return mappedIds.includes(selectedDoc.id);
      })
    : [];

  const statusBadge = (status) => {
    const styles = {
      draft: 'bg-muted text-muted-foreground',
      review: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-50 text-red-700 border-red-200',
    };
    return <Badge variant="outline" className={`text-xs ${styles[status]}`}>{status}</Badge>;
  };

  // Compute which doc IDs have gaps
  const docsWithGaps = gapResults
    ? new Set(
        gapResults.flatMap(gap => [
          ...(gapDocMapping[gap.relatedBDD] || []),
          ...(gapDocMapping[gap.relatedBRD] || []),
        ])
      )
    : new Set();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="text-center mb-4">
        <h2 className="font-heading font-bold text-2xl">Document Review</h2>
        <p className="text-muted-foreground mt-1 text-sm">Review, edit, and approve your requirement documents</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[500px]">
        {/* Left Panel - Document Tree */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-border p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Requirement Tree</h3>

          {['BRD', 'BDD'].map(type => (
            <div key={type} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                {type === 'BRD' ? <FileText className="w-3.5 h-3.5 text-blue-500" /> : <Code2 className="w-3.5 h-3.5 text-violet-500" />}
                <span className="text-xs font-semibold uppercase tracking-wide">{type}</span>
                <span className="text-xs text-muted-foreground">
                  {type === 'BRD' ? '(1 file)' : `(${initialDocuments.filter(d => d.type === 'BDD').length} files)`}
                </span>
              </div>
              <div className="space-y-1 ml-2">
                {initialDocuments.filter(d => d.type === type).map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => { setSelectedDoc(doc); setIsEditing(false); }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                      selectedDoc.id === doc.id
                        ? 'bg-accent text-accent-foreground font-medium'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="truncate flex-1 text-left">{doc.title}</span>
                    <div className="flex items-center gap-1 ml-1">
                      {docsWithGaps.has(doc.id) && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      {statusBadge(docStatuses[doc.id])}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Bot className="w-3.5 h-3.5" />
              <span>AI Generated</span>
            </div>
          </div>
        </div>

        {/* Center Panel - Document Viewer */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-border flex flex-col">
          {/* Viewer toolbar */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{selectedDoc.title}</span>
            </div>
            <div className="flex items-center gap-1">
              {selectedDoc.type === 'BDD' && !isEditing && (
                <Tabs value={viewMode} onValueChange={setViewMode} className="mr-2">
                  <TabsList className="h-7">
                    <TabsTrigger value="business" className="text-xs h-6 px-2">Business</TabsTrigger>
                    <TabsTrigger value="gherkin" className="text-xs h-6 px-2">Gherkin</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {isEditing ? (
                <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleSave}>
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleEditStart}>
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                <Download className="w-3 h-3 mr-1" />
                DOCX
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-auto">
            {isEditing ? (
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                {viewMode === 'gherkin' && selectedDoc.type === 'BDD' ? (
                  <pre className="bg-muted/50 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    {getContent(selectedDoc)}
                  </pre>
                ) : (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                    {getContent(selectedDoc)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:col-span-3 bg-white rounded-xl border border-border p-4 space-y-4 overflow-auto">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Readiness</h3>

          {/* Document actions */}
          <div className="space-y-2">
            <Button
              size="sm"
              className="w-full rounded-lg h-9 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={() => handleApprove(selectedDoc.id)}
              disabled={docStatuses[selectedDoc.id] === 'approved'}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              Approve {selectedDoc.type}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full rounded-lg h-9 text-xs text-violet-600 border-violet-200 hover:bg-violet-50"
              onClick={() => handleRegenerate(selectedDoc.id)}
              disabled={regenerating[selectedDoc.id]}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${regenerating[selectedDoc.id] ? 'animate-spin' : ''}`} />
              {regenerating[selectedDoc.id] ? 'Regenerating...' : 'Re-generate'}
            </Button>
          </div>

          {/* Approval status overview */}
          <div className="pt-3 border-t border-border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground">Approval Status</h4>
            {initialDocuments.map(doc => (
              <div key={doc.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{doc.title.split(' ').slice(0, 2).join(' ')}</span>
                {statusBadge(docStatuses[doc.id])}
              </div>
            ))}
          </div>

          {/* Gap Analysis Results for selected doc */}
          {gapResults && (
            <div className="pt-3 border-t border-border space-y-2">
              {regeneratedDocs.has(selectedDoc.id) ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Gaps resolved. Document regenerated successfully.
                </div>
              ) : docGaps.length > 0 ? (
                <>
                  <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Detected Gaps ({docGaps.length})
                  </h4>
                  <div className="space-y-2">
                    {docGaps.map((gap, i) => (
                      <div key={i} className={`p-2.5 rounded-lg border text-xs ${severityColors[gap.severity]}`}>
                        <div className="font-semibold">{gap.title}</div>
                        <p className="mt-0.5 opacity-80 leading-snug">{gap.description}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 p-2.5 rounded-lg bg-violet-50 border border-violet-100 text-xs text-violet-700 flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Re-generate this document to address the gaps above.</span>
                  </div>
                </>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  No gaps detected for this document.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="rounded-xl h-11 px-5">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!allApproved}
          className="rounded-xl h-11 px-6"
        >
          Continue to Gap Analysis
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </motion.div>
  );
}
