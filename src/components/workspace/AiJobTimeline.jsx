import React, { useMemo } from 'react';
import { Activity, CheckCircle2, Clock3, Loader2, Sparkles, AlertTriangle } from 'lucide-react';

const stageLabels = {
  queued: 'Queued',
  'package-upload': 'Package Upload',
  planning: 'Planning',
  'file-analysis': 'File Analysis',
  analyzing: 'Analyzing',
  verifying: 'Verifying',
  done: 'Completed',
  failed: 'Failed',
};

const statusTone = {
  running: 'border-violet-200 bg-violet-50 text-violet-800',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-red-200 bg-red-50 text-red-800',
  queued: 'border-slate-200 bg-slate-50 text-slate-700',
};

const logTone = {
  info: 'border-slate-200 bg-white text-slate-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  warn: 'border-amber-200 bg-amber-50 text-amber-700',
};

export default function AiJobTimeline({ status, title = 'Live AI job activity', description = 'Background stages are streamed as the job progresses.' }) {
  const logs = Array.isArray(status?.logs) ? status.logs : [];
  const progress = typeof status?.progress === 'number' ? Math.max(0, Math.min(100, status.progress)) : 0;
  const currentStage = stageLabels[status?.stage] || formatToken(status?.stage || 'queued');
  const currentMessage = status?.message || 'Waiting for background progress updates.';
  const tone = statusTone[status?.status] || statusTone.queued;
  const recentLogs = useMemo(() => [...logs].slice(-8).reverse(), [logs]);

  return (
    <div className="mx-auto mt-6 w-full max-w-4xl overflow-hidden rounded-[28px] border border-violet-100 bg-white/95 shadow-[0_20px_70px_rgba(91,78,255,0.12)]">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.16),_transparent_35%),linear-gradient(135deg,rgba(245,243,255,0.96),rgba(236,254,255,0.9))] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              Live AI Timeline
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}>
            {status?.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : status?.status === 'failed' ? <AlertTriangle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {formatToken(status?.status || 'queued')}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="rounded-3xl border border-white/70 bg-white/80 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current Stage</p>
                <p className="mt-1 text-base font-semibold text-slate-900">{currentStage}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Progress</p>
                <p className="mt-1 text-2xl font-bold text-violet-700">{progress}%</p>
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-violet-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#6d28d9,#2563eb,#06b6d4)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50/80 p-4 text-left">
              <div className="flex items-start gap-3">
                <Activity className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">Latest Update</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{currentMessage}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-slate-950 p-4 text-slate-100 shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Job Snapshot</p>
                <p className="mt-1 text-sm font-semibold text-white">{logs.length} timeline event{logs.length === 1 ? '' : 's'}</p>
              </div>
              <Clock3 className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="mt-4 space-y-3">
              <SnapshotStat label="Stage" value={currentStage} />
              <SnapshotStat label="Status" value={formatToken(status?.status || 'queued')} />
              <SnapshotStat label="Updated" value={formatTime(status?.updatedAt)} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white px-5 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Stage-by-stage activity</p>
            <p className="text-xs text-slate-500">These are the same status messages flowing through `ai-job-status`.</p>
          </div>
        </div>
        <div className="grid gap-3">
          {recentLogs.length > 0 ? recentLogs.map((entry, index) => (
            <div key={`${entry.at || 'log'}-${index}`} className={`rounded-2xl border p-4 ${logTone[entry.level] || logTone.info}`}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {stageLabels[entry.stage] || formatToken(entry.stage || 'step')}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] opacity-70">
                      {formatToken(entry.level || 'info')}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6">{entry.message}</p>
                  {entry.meta && Object.keys(entry.meta).length > 0 && (
                    <p className="mt-2 text-xs opacity-70">{formatMeta(entry.meta)}</p>
                  )}
                </div>
                <span className="shrink-0 text-[11px] font-medium opacity-70">{formatTime(entry.at)}</span>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Waiting for the first detailed event from the background job.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SnapshotStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value || 'Pending'}</p>
    </div>
  );
}

function formatToken(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Pending';
}

function formatTime(value) {
  if (!value) return 'Waiting';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMeta(meta) {
  return Object.entries(meta)
    .slice(0, 4)
    .map(([key, value]) => `${formatToken(key)}: ${formatMetaValue(value)}`)
    .join(' | ');
}

function formatMetaValue(value) {
  if (Array.isArray(value)) return value.slice(0, 3).join(', ');
  if (value && typeof value === 'object') return Object.entries(value).slice(0, 2).map(([k, v]) => `${k}=${v}`).join(', ');
  return String(value);
}
