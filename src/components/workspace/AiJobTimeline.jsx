import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Loader2, Sparkles, Waves, ScanSearch, UploadCloud } from 'lucide-react';

const stageCatalog = [
  { key: 'queued', label: 'Queued', short: 'Queued', icon: Sparkles, accent: 'from-slate-500 via-violet-500 to-cyan-500', surface: 'bg-slate-50/90', border: 'border-slate-200', glow: 'shadow-[0_18px_45px_rgba(99,102,241,0.12)]' },
  { key: 'package-upload', label: 'Uploading Source Package', short: 'Upload Done', icon: UploadCloud, accent: 'from-fuchsia-500 via-violet-500 to-sky-500', surface: 'bg-violet-50/80', border: 'border-violet-200', glow: 'shadow-[0_22px_55px_rgba(139,92,246,0.18)]' },
  { key: 'planning', label: 'Planning The Review', short: 'Plan Built', icon: Waves, accent: 'from-cyan-500 via-sky-500 to-indigo-500', surface: 'bg-cyan-50/80', border: 'border-cyan-200', glow: 'shadow-[0_22px_55px_rgba(34,211,238,0.16)]' },
  { key: 'file-analysis', label: 'Reading File Evidence', short: 'Evidence Read', icon: ScanSearch, accent: 'from-indigo-500 via-violet-500 to-fuchsia-500', surface: 'bg-indigo-50/80', border: 'border-indigo-200', glow: 'shadow-[0_22px_55px_rgba(79,70,229,0.16)]' },
  { key: 'analyzing', label: 'Generating With AI', short: 'Analysis Done', icon: Activity, accent: 'from-violet-500 via-fuchsia-500 to-cyan-500', surface: 'bg-fuchsia-50/80', border: 'border-fuchsia-200', glow: 'shadow-[0_26px_60px_rgba(168,85,247,0.18)]' },
  { key: 'verifying', label: 'Verifying Output Quality', short: 'Verified', icon: CheckCircle2, accent: 'from-emerald-500 via-teal-500 to-cyan-500', surface: 'bg-emerald-50/80', border: 'border-emerald-200', glow: 'shadow-[0_22px_55px_rgba(16,185,129,0.18)]' },
  { key: 'done', label: 'Completed', short: 'Completed', icon: CheckCircle2, accent: 'from-emerald-500 via-lime-500 to-cyan-500', surface: 'bg-emerald-50/90', border: 'border-emerald-200', glow: 'shadow-[0_24px_60px_rgba(34,197,94,0.16)]' },
  { key: 'failed', label: 'Failed', short: 'Failed', icon: AlertTriangle, accent: 'from-rose-500 via-red-500 to-orange-500', surface: 'bg-rose-50/90', border: 'border-rose-200', glow: 'shadow-[0_24px_60px_rgba(244,63,94,0.16)]' },
];

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

export default function AiJobTimeline({
  status,
  title = 'Live AI job activity',
  description = 'Background stages are streamed as the job progresses.',
}) {
  const logs = Array.isArray(status?.logs) ? status.logs : [];
  const progress = typeof status?.progress === 'number' ? Math.max(0, Math.min(100, status.progress)) : 0;
  const stageKey = status?.stage || 'queued';
  const currentStageMeta = getStageMeta(stageKey, status?.status);
  const currentMessage = status?.message || 'Waiting for background progress updates.';
  const tone = statusTone[status?.status] || statusTone.queued;
  const recentLogs = useMemo(() => [...logs].slice(-6).reverse(), [logs]);
  const latestInteraction = recentLogs[0] || null;
  const completedStages = useMemo(
    () => getCompletedStages(logs, stageKey, status?.status).map((key) => getStageMeta(key)),
    [logs, stageKey, status?.status],
  );
  const spotlightIcon = currentStageMeta.icon;
  const stageNarrative = buildNarrative({ stage: currentStageMeta.label, status: status?.status, progress, message: currentMessage });

  return (
    <div className="mx-auto mt-2 w-full max-w-8xl overflow-hidden rounded-[34px] border border-violet-100 bg-white/95 shadow-[0_28px_90px_rgba(91,78,255,0.14)]">
      <div className="bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(34,211,238,0.18),_transparent_24%),linear-gradient(135deg,rgba(248,245,255,0.98),rgba(240,253,255,0.94))] p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              Live AI Journey
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
              <p className="mx-auto mt-1.5 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}>
            {status?.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : status?.status === 'failed' ? <AlertTriangle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            {formatToken(status?.status || 'queued')}
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.88fr)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${stageKey}-${status?.status || 'running'}`}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className={`relative overflow-hidden rounded-[28px] border ${currentStageMeta.border} ${currentStageMeta.surface} ${currentStageMeta.glow} p-5`}
            >
              <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${currentStageMeta.accent}`} />
              <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/50 blur-3xl" />
              <div className="relative">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-4">
                    <AnimatedAiOrb accent={currentStageMeta.accent} icon={spotlightIcon} running={status?.status === 'running'} />
                    <div className="max-w-xl">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Active Stage</p>
                      <h4 className="mt-1 text-2xl font-semibold text-slate-950">{currentStageMeta.label}</h4>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">{currentMessage}</p>
                    </div>
                  </div>
                  <div className="min-w-[130px] rounded-3xl border border-white/80 bg-white/80 px-4 py-3 text-right shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Progress</p>
                    <p className="mt-1 text-3xl font-bold text-slate-950">{progress}%</p>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="relative h-3 overflow-hidden rounded-full bg-white/70 ring-1 ring-white/80">
                    <motion.div
                      className={`h-full rounded-full bg-gradient-to-r ${currentStageMeta.accent}`}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                    />
                    {status?.status === 'running' && (
                      <motion.div
                        className="absolute inset-y-0 w-24 rounded-full bg-white/35 blur-md"
                        animate={{ x: ['-30%', '430%'] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <MicroStat label="Current stage" value={currentStageMeta.label} />
                  <MicroStat label="Updated" value={formatTime(status?.updatedAt)} />
                  <MicroStat label="Events streamed" value={`${logs.length}`} />
                </div>

                {completedStages.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Completed in the background</p>
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      <AnimatePresence>
                        {completedStages.map((stage, index) => {
                          const Icon = stage.icon;
                          return (
                            <motion.div
                              key={`${stage.key}-${index}`}
                              initial={{ opacity: 0, scale: 0.92, y: 8 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.92, y: -8 }}
                              transition={{ duration: 0.25, ease: 'easeOut' }}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-2 text-xs font-medium text-emerald-800 shadow-sm"
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {stage.short}
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="rounded-[28px] border border-slate-900/5 bg-slate-950 p-5 text-white shadow-inner">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Runtime Pulse</p>
                <p className="mt-1 text-sm font-semibold text-white">Operational snapshot</p>
              </div>
              <Clock3 className="h-4 w-4 text-cyan-300" />
            </div>
            <div className="mt-4 space-y-3">
              <SnapshotStat label="Status" value={formatToken(status?.status || 'queued')} />
              <SnapshotStat label="Stage" value={currentStageMeta.label} />
              <SnapshotStat label="Updated" value={formatTime(status?.updatedAt)} />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-white px-6 py-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Live interaction</p>
            <p className="text-xs text-slate-500">The latest background messages and the current AI interpretation are surfaced here as the job works through your package.</p>
          </div>
        </div>
        {latestInteraction && (
          <div className="mb-4 rounded-[26px] border border-violet-100 bg-[linear-gradient(135deg,rgba(245,243,255,0.95),rgba(236,254,255,0.92))] p-4 shadow-[0_16px_40px_rgba(91,78,255,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 text-white shadow-md">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-600">AI says</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{latestInteraction.message}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-700">
                  {getStageMeta(latestInteraction.stage).label}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                  {formatTime(latestInteraction.at)}
                </span>
              </div>
            </div>
            <div className="mt-4 rounded-[22px] border border-white/80 bg-white/75 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-600">AI interpretation</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {stageNarrative}
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {recentLogs.length > 0 ? recentLogs.map((entry, index) => (
            <motion.div
              key={`${entry.at || 'log'}-${index}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut', delay: index * 0.03 }}
              className={`rounded-2xl border p-4 ${logTone[entry.level] || logTone.info}`}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-900/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                      {getStageMeta(entry.stage).label}
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
            </motion.div>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 lg:col-span-2">
              Waiting for the first detailed event from the background job.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MicroStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-white/80 px-3.5 py-2.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || 'Pending'}</p>
    </div>
  );
}

function AnimatedAiOrb({ accent, icon: Icon, running }) {
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center">
      <motion.div
        animate={running ? { scale: [1, 1.16, 1], opacity: [0.42, 0.18, 0.42] } : { scale: 1, opacity: 0.28 }}
        transition={{ repeat: running ? Infinity : 0, duration: 2.1, ease: 'easeInOut' }}
        className={`absolute inset-0 rounded-[22px] bg-gradient-to-br ${accent} blur-md`}
      />
      <motion.div
        animate={running ? { rotate: [0, 180, 360] } : { rotate: 0 }}
        transition={{ repeat: running ? Infinity : 0, duration: 6, ease: 'linear' }}
        className="absolute inset-1 rounded-[20px] border border-white/40"
      />
      <motion.div
        animate={running ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ repeat: running ? Infinity : 0, duration: 1.9, ease: 'easeInOut' }}
        className={`relative flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br ${accent} text-white shadow-lg`}
      >
        <Icon className="h-6 w-6" />
      </motion.div>
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

function getStageMeta(stageKey, status = '') {
  const normalizedKey = String(stageKey || '').trim();
  if (status === 'failed') {
    return stageCatalog.find((item) => item.key === 'failed');
  }
  return stageCatalog.find((item) => item.key === normalizedKey) || {
    key: normalizedKey || 'queued',
    label: formatToken(normalizedKey || 'queued'),
    short: formatToken(normalizedKey || 'queued'),
    icon: Activity,
    accent: 'from-violet-500 via-indigo-500 to-cyan-500',
    surface: 'bg-violet-50/80',
    border: 'border-violet-200',
    glow: 'shadow-[0_22px_55px_rgba(99,102,241,0.15)]',
  };
}

function getCompletedStages(logs, currentStage, status) {
  const seen = new Set();
  for (const entry of Array.isArray(logs) ? logs : []) {
    const stage = String(entry?.stage || '').trim();
    if (stage) seen.add(stage);
  }
  if (status === 'completed') seen.add('done');
  if (status === 'failed') seen.add('failed');
  const currentKey = status === 'completed' ? 'done' : status === 'failed' ? 'failed' : currentStage;
  return stageCatalog
    .map((item) => item.key)
    .filter((key) => seen.has(key) && key !== currentKey && key !== 'failed');
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

function buildNarrative({ stage, status, progress, message }) {
  if (status === 'completed') {
    return 'The background AI job has finished. The completed stage chips above show what already moved through the pipeline, while the feed below keeps the full audit trail.';
  }
  if (status === 'failed') {
    return `The job stopped during ${stage}. The latest message was: ${message}`;
  }
  if (progress < 15) {
    return 'The job is still warming up and preparing context. Upload and queue work usually happen first before the deeper model stage begins.';
  }
  if (progress < 75) {
    return 'The AI is in its main working phase right now. This is typically where package reading, code understanding, and structured generation consume most of the time.';
  }
  return 'The job is in the closing phase now, tightening the final output and storing the completed result back into the workspace.';
}
