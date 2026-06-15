import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, ArrowRight, ArrowLeft, AlertTriangle, CheckCircle2, Lightbulb, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { runGapAnalysis } from '@/services/documentService';
import AiLoadingVisual from './AiLoadingVisual';
import WorkspaceActionBar from './WorkspaceActionBar';

const severityColors = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

const gapStatusMeta = {
  retained: {
    label: 'Current Analysis',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    text: 'This report is saved for this workspace. It will stay here when you go back or continue.',
  },
  updated: {
    label: 'Updated After Regeneration',
    tone: 'bg-blue-50 text-blue-700 border-blue-200',
    text: 'This report was updated after document regeneration. Re-run analysis when you want AI to verify closure.',
  },
  rerun: {
    label: 'Re-run Available',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'Documents changed after this analysis. Re-run only when you want a fresh source-to-document check.',
  },
  skipped: {
    label: 'Gap Analysis Skipped',
    tone: 'bg-slate-50 text-slate-700 border-slate-200',
    text: 'The source-to-document traceability audit was skipped by the user. You can continue, or come back and run it later.',
  },
};

export default function GapAnalysisStep({ workspaceData, documents, setDocuments, gapResults, onNext, onBack, onGapsFound, onReset }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const result = gapResults || null;
  const statusMeta = getGapStatusMeta(result);

  const runAnalysis = async () => {
    setRunning(true);
    setError('');
    try {
      const payload = await runGapAnalysis({
        packageSignals: workspaceData.package_signals,
        packageFile: workspaceData.package_file,
        documents,
      });
      const stampedPayload = stampGapResult(payload, documents, 'fresh');
      onGapsFound?.(stampedPayload);
      setDocuments?.(prev => {
        const impactedIds = findImpactedDocumentIds(stampedPayload, prev);
        if (!impactedIds.size) return prev;
        return prev.map((doc) => impactedIds.has(doc.id) ? ({
          ...doc,
          approved: false,
          status: 'review',
          lastEdited: new Date().toISOString(),
        }) : doc);
      });
    } catch (err) {
      setError(err.message || 'Gap analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const skipAnalysis = () => {
    const skippedPayload = stampGapResult({
      skipped: true,
      findings: [],
      recommendations: [
        'Gap analysis was skipped for this run. Review documents manually before approving if this is a production package.',
      ],
      qualityNotes: [
        'No source-to-BRD/BDD traceability audit was executed for this workspace state.',
      ],
      summary: {
        totalFindings: 0,
        high: 0,
        medium: 0,
        low: 0,
        covered: 0,
        readiness: 'Skipped by user',
      },
    }, documents, 'skipped');
    onGapsFound?.(skippedPayload);
    onNext?.();
  };

  const activeFindings = result?.findings?.filter((gap) => !isCoveredGap(gap)) || [];
  const coveredFindings = result?.findings?.filter(isCoveredGap) || [];
  const summary = buildDisplaySummary(result, activeFindings, coveredFindings);
  const canDownload = Boolean(result);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-2xl">Gap Analysis</h2>
          <p className="text-muted-foreground mt-2">Compare source-code evidence with reviewed BRD and BDD documents</p>
        </div>
        {result && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => downloadGapAnalysis(result, workspaceData)} className="rounded-xl h-10 px-4" disabled={!canDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
            <Button variant="outline" onClick={runAnalysis} disabled={running} className="rounded-xl h-10 px-4">
              <RefreshCw className={`w-4 h-4 mr-2 ${running ? 'animate-spin' : ''}`} />
              Re-run Analysis
            </Button>
          </div>
        )}
      </div>

      {!result && (
        <div className="text-center py-8">
          {!running ? (
            <div className="space-y-6">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-4">Run a production-grade review before allowing the pipeline trigger.</p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <Button variant="outline" onClick={skipAnalysis} className="rounded-xl h-11 px-6">
                    Skip for now
                  </Button>
                  <Button onClick={runAnalysis} className="rounded-xl h-11 px-6">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Run Gap Analysis
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <AiLoadingVisual
              title="Analyzing Package-to-Document Coverage"
              description="Reviewing the evidence in the background. This can take a bit longer for large projects."
            />
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 text-red-700 border border-red-100 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className={`rounded-xl border p-4 ${statusMeta.tone}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{statusMeta.label}</p>
                <p className="text-xs mt-1 opacity-90">{statusMeta.text}</p>
              </div>
              <p className="text-xs font-medium shrink-0">{formatTimestamp(result.generatedAt || result.updatedAt)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="High" value={summary.high || 0} tone="red" />
            <SummaryCard label="Medium" value={summary.medium || 0} tone="amber" />
            <SummaryCard label="Low" value={summary.low || 0} tone="blue" />
            <SummaryCard label="Readiness" value={readinessLabel(summary.readiness)} tone="emerald" />
          </div>

          {hasTraceabilityScores(result) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ScoreCard label="Traceability" value={result.summary?.traceabilityScore} />
              <ScoreCard label="Document Coverage" value={result.summary?.documentCoverageScore} />
              <ScoreCard label="BDD Quality" value={result.summary?.bddQualityScore} />
            </div>
          )}

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-800">
            <p className="text-xs font-semibold uppercase tracking-wide">Readiness Summary</p>
            <p className="mt-1 text-sm leading-relaxed">{summary.readiness || 'Ready'}</p>
          </div>

          {Array.isArray(result.coverageMatrix) && result.coverageMatrix.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-semibold text-sm">Source-to-BRD/BDD Traceability Matrix</h3>
                <p className="text-xs text-muted-foreground mt-1">Capability coverage verified against source evidence and reviewed documents.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {result.coverageMatrix.slice(0, 8).map((row, index) => (
                  <div key={`${row.capability}-${index}`} className="p-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] text-xs">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{row.capability || 'Capability'}</p>
                      <p className="text-muted-foreground mt-1 line-clamp-2">{(row.sourceEvidence || []).join(' | ') || 'Source evidence not specified'}</p>
                    </div>
                    <TraceBadge label="BRD" value={row.brdCoverage} />
                    <TraceBadge label="BDD" value={row.bddCoverage} />
                    <div>
                      <Badge variant="outline" className="text-xs">{formatCoverageStatus(row.coverageStatus)}</Badge>
                      <p className="text-muted-foreground mt-2 line-clamp-2">{row.notes}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Coverage Findings</h3>
            {activeFindings.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {result.skipped ? 'Gap analysis was skipped. You can still continue to manual approval.' : 'No open gaps detected. Review is ready for approval.'}
              </div>
            ) : activeFindings.map((gap, i) => (
              <div key={i} className={`p-4 rounded-xl border ${severityColors[gap.severity] || severityColors.medium}`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{gap.title}</p>
                    <p className="text-xs mt-1 opacity-80">{gap.description}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {gap.module && <Badge variant="outline" className="text-xs">{gap.module}</Badge>}
                      {gap.relatedDocument && <Badge variant="outline" className="text-xs">{gap.relatedDocument}</Badge>}
                    </div>
                    {gap.recommendedFix && <p className="text-xs mt-2 font-medium">Fix: {gap.recommendedFix}</p>}
                    {Array.isArray(gap.sourceEvidence) && gap.sourceEvidence.length > 0 && (
                      <p className="text-xs mt-2 opacity-80">Source: {gap.sourceEvidence.slice(0, 3).join(' | ')}</p>
                    )}
                    {Array.isArray(gap.documentEvidence) && gap.documentEvidence.length > 0 && (
                      <p className="text-xs mt-1 opacity-80">Document: {gap.documentEvidence.slice(0, 3).join(' | ')}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {coveredFindings.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                Covered After Document Updates
              </div>
              <p className="text-xs text-emerald-700">
                {coveredFindings.length} previous finding{coveredFindings.length === 1 ? '' : 's'} marked covered by regeneration or document updates.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {coveredFindings.slice(0, 4).map((gap, index) => (
                  <div key={`${gap.title}-${index}`} className="rounded-lg border border-emerald-100 bg-white/70 p-3 text-xs text-emerald-800">
                    <p className="font-semibold line-clamp-1">{gap.title || 'Covered finding'}</p>
                    <p className="mt-1 line-clamp-2">{gap.resolutionNote || 'Document updated from this finding.'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-800">
              <Lightbulb className="w-4 h-4" />
              Recommendations
            </div>
            <ul className="space-y-1.5">
              {(result.recommendations || []).map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-violet-700">
                  <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {Array.isArray(result.qualityNotes) && result.qualityNotes.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-sm font-semibold text-slate-800">Quality Notes</div>
              <ul className="space-y-1.5">
                {result.qualityNotes.map((note, index) => (
                  <li key={index} className="text-xs text-slate-700 flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </motion.div>
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
          <>
          {!result && (
            <>
              <Button variant="outline" onClick={skipAnalysis} disabled={running} className="rounded-xl h-11 px-6">
                Skip Analysis
              </Button>
              <Button onClick={runAnalysis} disabled={running} className="rounded-xl h-11 px-6">
                <BarChart3 className="w-4 h-4 mr-2" />
                Run Analysis
              </Button>
            </>
          )}
          {result && (
            <Button onClick={onNext} className="rounded-xl h-11 px-6">
              Continue to Approval
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
          </>
        )}
      />
    </motion.div>
  );
}

function stampGapResult(payload, documents, source) {
  return {
    ...payload,
    generatedAt: new Date().toISOString(),
    analysisSource: source,
    documentSignature: buildDocumentSignature(documents),
  };
}

function getGapStatusMeta(result) {
  if (!result) return gapStatusMeta.retained;
  if (result.skipped || result.analysisSource === 'skipped') return gapStatusMeta.skipped;
  if (result.analysisSource === 'regeneration_update') return gapStatusMeta.updated;
  return gapStatusMeta.retained;
}

function buildDisplaySummary(result, activeFindings, coveredFindings) {
  if (!result) {
    return {
      totalFindings: 0,
      high: 0,
      medium: 0,
      low: 0,
      covered: 0,
      readiness: 'Ready',
    };
  }
  const high = activeFindings.filter((item) => item.severity === 'high').length;
  const medium = activeFindings.filter((item) => item.severity === 'medium').length;
  const low = activeFindings.filter((item) => item.severity === 'low').length;
  return {
    ...(result.summary || {}),
    totalFindings: activeFindings.length,
    high,
    medium,
    low,
    covered: coveredFindings.length,
    readiness: result.skipped
      ? 'Skipped by user'
      : high
        ? 'Blocked'
        : medium
          ? 'Needs Review'
          : low
            ? 'Partial'
            : coveredFindings.length
              ? 'Ready after document updates - re-run to verify'
              : result.summary?.readiness || 'Ready',
  };
}

function isCoveredGap(gap) {
  const status = String(gap?.status || gap?.coverageStatus || '').toLowerCase();
  return status === 'covered' || status.includes('covered_after_regeneration');
}

function buildDocumentSignature(documents) {
  return documents
    .map((doc) => `${doc.id}:${doc.lastEdited || ''}:${doc.approved ? '1' : '0'}`)
    .join('|');
}

function downloadGapAnalysis(result, workspaceData) {
  const activeFindings = Array.isArray(result.findings) ? result.findings.filter((gap) => !isCoveredGap(gap)) : [];
  const coveredFindings = Array.isArray(result.findings) ? result.findings.filter(isCoveredGap) : [];
  const summary = buildDisplaySummary(result, activeFindings, coveredFindings);
  const lines = [
    '# Gap Analysis Report',
    '',
    `Project: ${workspaceData?.package_signals?.projectName || workspaceData?.name || 'VerSpace'}`,
    `Generated: ${formatTimestamp(result.generatedAt || result.updatedAt)}`,
    '',
    '## Summary',
    `- High: ${summary.high || 0}`,
    `- Medium: ${summary.medium || 0}`,
    `- Low: ${summary.low || 0}`,
    `- Covered: ${summary.covered || 0}`,
    `- Readiness: ${summary.readiness || 'Ready'}`,
    ...(hasTraceabilityScores(result)
      ? [
          `- Traceability Score: ${formatScore(result.summary?.traceabilityScore)}`,
          `- Document Coverage Score: ${formatScore(result.summary?.documentCoverageScore)}`,
          `- BDD Quality Score: ${formatScore(result.summary?.bddQualityScore)}`,
        ]
      : []),
    '',
    '## Source-to-BRD/BDD Traceability Matrix',
    ...(Array.isArray(result.coverageMatrix) && result.coverageMatrix.length
      ? result.coverageMatrix.flatMap((row, index) => [
          `${index + 1}. ${row.capability || 'Capability'}`,
          `   Source Evidence: ${(row.sourceEvidence || []).join(' | ')}`,
          `   BRD Coverage: ${row.brdCoverage || 'Not specified'}`,
          `   BDD Coverage: ${row.bddCoverage || 'Not specified'}`,
          `   Status: ${formatCoverageStatus(row.coverageStatus)}`,
          `   Confidence: ${row.confidence || 'Not specified'}`,
          `   Notes: ${row.notes || ''}`,
          '',
        ])
      : ['No traceability matrix returned.', '']),
    '',
    '## Findings',
    ...(activeFindings.length
      ? activeFindings.flatMap((gap, index) => [
          `${index + 1}. ${gap.gapId ? `${gap.gapId}: ` : ''}${gap.title || 'Coverage finding'}`,
          `   Gap Type: ${gap.gapType || 'Not specified'}`,
          `   Severity: ${gap.severity || 'medium'}`,
          `   Confidence: ${gap.confidence || 'Not specified'}`,
          `   Module: ${gap.module || 'Application'}`,
          `   Related Document: ${gap.relatedDocument || gap.relatedDocumentId || 'Unlinked'}`,
          `   Evidence: ${gap.packageSignal || 'Not specified'}`,
          ...(Array.isArray(gap.sourceEvidence) && gap.sourceEvidence.length
            ? [`   Source Evidence: ${gap.sourceEvidence.join(' | ')}`]
            : []),
          ...(Array.isArray(gap.documentEvidence) && gap.documentEvidence.length
            ? [`   Document Evidence: ${gap.documentEvidence.join(' | ')}`]
            : []),
          ...(Array.isArray(gap.evidenceAnchors) && gap.evidenceAnchors.length
            ? [`   Evidence Anchors: ${gap.evidenceAnchors.join(' | ')}`]
            : []),
          ...(Array.isArray(gap.missingScenarios) && gap.missingScenarios.length
            ? [`   Missing Scenarios: ${gap.missingScenarios.join(' | ')}`]
            : []),
          `   Description: ${gap.description || ''}`,
          `   Recommended Fix: ${gap.recommendedFix || ''}`,
          '',
        ])
      : ['No open findings.', '']),
    '## Covered Findings',
    ...(coveredFindings.length
      ? coveredFindings.flatMap((gap, index) => [
          `${index + 1}. ${gap.gapId ? `${gap.gapId}: ` : ''}${gap.title || 'Covered finding'}`,
          `   Status: ${gap.status || gap.coverageStatus || 'covered'}`,
          `   Covered At: ${formatTimestamp(gap.coveredAt)}`,
          `   Resolution: ${gap.resolutionNote || 'Document updated from this finding.'}`,
          '',
        ])
      : ['No covered findings.', '']),
    '## Recommendations',
    ...(result.recommendations || []).map((item) => `- ${item}`),
    '',
    '## Quality Notes',
    ...(result.qualityNotes || []).map((item) => `- ${item}`),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `gap-analysis-${new Date().toISOString().slice(0, 10)}.md`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatTimestamp(value) {
  if (!value) return 'Saved report';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch (_) {
    return value;
  }
}

function readinessLabel(value) {
  const normalized = String(value || 'Ready').toLowerCase();
  if (normalized.includes('blocked')) return 'Blocked';
  if (normalized.includes('partial')) return 'Partial';
  if (normalized.includes('review')) return 'Needs Review';
  if (normalized.includes('ready')) return 'Ready';
  return 'Review';
}

function findImpactedDocumentIds(gapResults, documents) {
  const impacted = new Set();
  const findings = Array.isArray(gapResults?.findings)
    ? gapResults.findings.filter((gap) => !isCoveredGap(gap))
    : [];
  findings.forEach((gap) => {
    const matched = findMatchingDocument(gap, documents);
    if (matched) impacted.add(matched.id);
  });
  return impacted;
}

function findMatchingDocument(gap, documents) {
  if (gap?.linkStatus === 'unlinked' || gap?.actionType === 'create_bdd') return null;
  const explicitId = String(gap?.relatedDocumentId || '').trim();
  if (explicitId) {
    const byId = documents.find((doc) => doc.id === explicitId);
    if (byId) return byId;
  }
  const related = normalize(`${gap?.relatedDocument || ''} ${gap?.module || ''}`);
  if (!related || related === 'brd bdd' || related === 'bdd' || related === 'brd') return null;
  return documents.find((doc) => {
    const title = normalize(doc.title);
    const module = normalize(doc.module);
    return title.includes(related) || module.includes(related) || related.includes(title) || related.includes(module);
  }) || null;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function SummaryCard({ label, value, tone }) {
  const colors = {
    red: 'bg-red-50 border-red-100 text-red-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  };
  return (
    <div className={`h-28 rounded-xl border p-4 text-center flex flex-col justify-center ${colors[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-1">{label}</p>
    </div>
  );
}

function ScoreCard({ label, value }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{label}</p>
      <p className="mt-2 text-2xl font-bold text-violet-900">{formatScore(value)}</p>
    </div>
  );
}

function TraceBadge({ label, value }) {
  const normalized = String(value || '').toLowerCase();
  const tone = normalized.includes('covered')
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : normalized.includes('partial')
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-700 border-red-200';
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <Badge variant="outline" className={`mt-1 text-xs ${tone}`}>{value || 'Not specified'}</Badge>
    </div>
  );
}

function hasTraceabilityScores(result) {
  return ['traceabilityScore', 'documentCoverageScore', 'bddQualityScore']
    .some((key) => typeof result?.summary?.[key] === 'number');
}

function formatScore(value) {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '—';
}

function formatCoverageStatus(value) {
  return String(value || 'review')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
