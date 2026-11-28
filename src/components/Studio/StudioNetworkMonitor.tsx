import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Check,
  FileText,
  Trash2,
  UploadCloud,
  XCircle
} from 'lucide-react';
import {
  clearMediaNetworkLogs,
  getMediaNetworkLogs,
  MediaNetworkLifecyclePhase,
  MediaNetworkRequestLog,
  subscribeMediaNetworkLogs
} from '../../services/api';

interface StudioNetworkMonitorProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onAutoOpen?: () => void;
}

const PHASE_STEPS: Array<{ key: MediaNetworkLifecyclePhase; label: string }> = [
  { key: 'request_init', label: 'Init' },
  { key: 'uploading', label: 'Uploading' },
  { key: 'awaiting_response', label: 'Server' },
  { key: 'completed', label: 'Done' }
];

function getPhaseRank(phase: MediaNetworkLifecyclePhase): number {
  switch (phase) {
    case 'queued':
      return 0;
    case 'request_init':
      return 1;
    case 'uploading':
      return 2;
    case 'awaiting_response':
      return 3;
    case 'completed':
    case 'failed':
      return 4;
    default:
      return 0;
  }
}

function formatPrettyBody(raw?: string): string {
  if (!raw || !raw.trim()) return '(empty response body)';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

function getStatusBadgeStyle(entry: MediaNetworkRequestLog): string {
  if (entry.phase === 'uploading' || entry.phase === 'awaiting_response' || entry.phase === 'request_init' || entry.phase === 'queued') {
    return 'bg-sky-500/20 border-sky-400/50 text-sky-200';
  }
  if (entry.ok) {
    return 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200';
  }
  return 'bg-rose-500/20 border-rose-400/50 text-rose-200';
}

function formatHttpStatusLabel(entry: MediaNetworkRequestLog): string {
  if (entry.phase !== 'completed' && entry.phase !== 'failed') {
    if (entry.phase === 'uploading') return `Uploading ${entry.progressPct}%`;
    if (entry.phase === 'awaiting_response') return 'Awaiting Response';
    if (entry.phase === 'request_init') return 'Connecting';
    return 'Queued';
  }
  if (entry.preFlightBlocked) {
    return `Pre-Flight Blocked (${entry.serverErrorCode || 'VALIDATION'})`;
  }
  if (entry.httpStatus !== undefined && entry.httpStatus > 0) {
    return `HTTP ${entry.httpStatus}${entry.httpStatusText ? ` ${entry.httpStatusText}` : ''}`;
  }
  return entry.httpStatusText || 'Network Error';
}

export const StudioNetworkMonitor: React.FC<StudioNetworkMonitorProps> = ({
  isOpen,
  onToggleOpen,
  onAutoOpen
}) => {
  const [logs, setLogs] = useState<MediaNetworkRequestLog[]>(() => getMediaNetworkLogs());
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const initial = getMediaNetworkLogs();
    return initial[0]?.id || null;
  });
  const [filterMode, setFilterMode] = useState<'all' | 'failed'>('all');
  const [mobilePane, setMobilePane] = useState<'requests' | 'logs'>('requests');
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeMediaNetworkLogs((nextLogs, latest) => {
      setLogs(nextLogs);
      if (latest) {
        if (latest.phase === 'request_init' || latest.phase === 'failed') {
          setSelectedId(latest.id);
        }
        if (latest.phase === 'failed') {
          setMobilePane('logs');
          onAutoOpen?.();
        }
      }
    });
  }, [onAutoOpen]);

  const filteredLogs = useMemo(() => {
    if (filterMode === 'failed') {
      return logs.filter((l) => !l.ok && l.phase === 'failed');
    }
    return logs;
  }, [logs, filterMode]);

  const activeUploads = useMemo(
    () =>
      logs.filter(
        (l) =>
          l.phase === 'queued' ||
          l.phase === 'request_init' ||
          l.phase === 'uploading' ||
          l.phase === 'awaiting_response'
      ),
    [logs]
  );

  const failedCount = useMemo(
    () => logs.filter((l) => l.phase === 'failed').length,
    [logs]
  );

  const selectedEntry = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    return filteredLogs.find((l) => l.id === selectedId) || filteredLogs[0];
  }, [filteredLogs, selectedId]);

  const handleCopyLog = (entry: MediaNetworkRequestLog) => {
    const payload = {
      transport: entry.transport.toUpperCase(),
      method: entry.method,
      url: entry.url,
      mediaKind: entry.mediaKind,
      fileName: entry.fileName,
      fileSizeBytes: entry.fileSizeBytes,
      phase: entry.phase,
      httpStatus: entry.httpStatus ?? null,
      httpStatusText: entry.httpStatusText ?? null,
      durationMs: entry.durationMs ?? null,
      requestHeaders: entry.requestHeaders,
      responseHeaders: entry.responseHeaders ?? {},
      serverErrorCode: entry.serverErrorCode ?? null,
      serverErrorMessage: entry.serverErrorMessage ?? null,
      responseBody: entry.responseBody ?? ''
    };
    try {
      navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
      setCopiedLogId(entry.id);
      setTimeout(() => {
        setCopiedLogId((prev) => (prev === entry.id ? null : prev));
      }, 1800);
    } catch {}
  };

  return (
    <section
      aria-label="Media Upload Network Monitor"
      className={`bg-slate-900 border rounded-2xl shadow-lg overflow-hidden transition-colors ${
        failedCount > 0
          ? 'border-rose-500/50'
          : activeUploads.length > 0
          ? 'border-sky-500/50'
          : 'border-slate-800'
      }`}
    >
      {/* Top Bar */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/60 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <Activity
            className={`w-4 h-4 shrink-0 ${
              activeUploads.length > 0
                ? 'text-sky-400 animate-pulse'
                : failedCount > 0
                ? 'text-rose-400'
                : 'text-emerald-400'
            }`}
          />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Network Monitor
          </h3>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 uppercase">
            XHR / Fetch Media Lifecycle
          </span>

          {activeUploads.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-[10px] font-black text-sky-200 animate-pulse">
              {activeUploads.length} Active Upload
            </span>
          )}
          {failedCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-[10px] font-black text-rose-200">
              {failedCount} Failed
            </span>
          )}
          {activeUploads.length === 0 && failedCount === 0 && (
            <span className="text-[11px] text-slate-400">
              {logs.length} {logs.length === 1 ? 'request' : 'requests'} captured
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {isOpen && (
            <>
              <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterMode === 'all'
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({logs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('failed')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterMode === 'failed'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Failed ({failedCount})
                </button>
              </div>

              {logs.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearMediaNetworkLogs();
                    setLogs([]);
                    setSelectedId(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 flex items-center gap-1"
                  title="Clear Network Monitor logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onToggleOpen}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wide border flex items-center gap-1.5 transition-colors ${
              isOpen
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600'
                : failedCount > 0
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400'
                : 'bg-sky-600/20 hover:bg-sky-600/30 text-sky-200 border-sky-500/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isOpen ? 'Hide Monitor' : 'Open Logs'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-3">
          {/* Mobile Pane Switcher */}
          <div className="flex lg:hidden gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setMobilePane('requests')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                mobilePane === 'requests'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              XHR / Fetch Lifecycle ({filteredLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('logs')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-colors ${
                mobilePane === 'logs'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Logs Pane
            </button>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center space-y-2">
              <UploadCloud className="w-7 h-7 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">
                {filterMode === 'failed'
                  ? 'No failed media uploads recorded yet.'
                  : 'Waiting for media upload requests...'}
              </div>
              <p className="text-[11px] text-slate-400 max-w-xl mx-auto">
                Upload a video, audio clip, image, or APK in any Studio tab to monitor live XHR/Fetch progress, HTTP status codes, request headers, and server validation response bodies in the Logs pane.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left: XHR/Fetch Lifecycle List */}
              <div
                className={`lg:col-span-5 space-y-2 max-h-[420px] overflow-y-auto pr-0.5 ${
                  mobilePane === 'logs' ? 'hidden lg:block' : 'block'
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                  XHR / Fetch Lifecycle ({filteredLogs.length})
                </div>

                {filteredLogs.map((entry) => {
                  const isSelected = selectedEntry?.id === entry.id;
                  const rank = getPhaseRank(entry.phase);
                  const isInFlight =
                    entry.phase !== 'completed' && entry.phase !== 'failed';

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(entry.id);
                        setMobilePane('logs');
                      }}
                      className={`w-full text-left rounded-xl p-3 border transition-all space-y-2 ${
                        isSelected
                          ? 'bg-slate-800/90 border-sky-400/70 shadow-md'
                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] font-black text-sky-300 uppercase">
                              {entry.transport}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-slate-300">
                              {entry.method}
                            </span>
                            <span className="text-xs font-bold text-white truncate max-w-[180px]" title={entry.fileName}>
                              {entry.fileName}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5" title={entry.url}>
                            {entry.url}
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md border font-mono text-[10px] font-bold shrink-0 ${getStatusBadgeStyle(
                            entry
                          )}`}
                        >
                          {formatHttpStatusLabel(entry)}
                        </span>
                      </div>

                      {/* Lifecycle Stepper */}
                      <div className="grid grid-cols-4 gap-1 text-[10px] font-mono">
                        {PHASE_STEPS.map((step, idx) => {
                          const stepNum = idx + 1;
                          const isLast = step.key === 'completed';
                          const done = isLast
                            ? entry.phase === 'completed' || entry.phase === 'failed'
                            : rank > stepNum;
                          const active = isLast
                            ? false
                            : rank === stepNum && isInFlight;
                          const failedHere = isLast && entry.phase === 'failed';

                          return (
                            <div
                              key={step.key}
                              className={`px-1.5 py-0.5 rounded text-center border truncate ${
                                failedHere
                                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 font-bold'
                                  : active
                                  ? 'bg-sky-500/25 border-sky-400/60 text-sky-100 font-bold animate-pulse'
                                  : done
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-slate-900/80 border-slate-800 text-slate-500'
                              }`}
                            >
                              {failedHere
                                ? 'Failed'
                                : step.key === 'uploading' && active
                                ? `${entry.progressPct}%`
                                : step.label}
                            </div>
                          );
                        })}
                      </div>

                      {/* Live Upload Progress Bar */}
                      {isInFlight && (
                        <progress
                          value={Math.max(4, entry.progressPct)}
                          max={100}
                          aria-label={`Upload progress for ${entry.fileName}`}
                          className="w-full h-1.5 rounded-full overflow-hidden bg-slate-900 border border-slate-800 [&::-webkit-progress-bar]:bg-slate-900 [&::-webkit-progress-value]:bg-sky-400 [&::-moz-progress-bar]:bg-sky-400"
                        />
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>
                          {entry.fileSizeMb} MB • {entry.mediaKind}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {entry.durationMs !== undefined
                            ? `${entry.durationMs} ms`
                            : 'In progress'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right: Dedicated Logs Pane */}
              <div
                className={`lg:col-span-7 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col max-h-[420px] ${
                  mobilePane === 'requests' ? 'hidden lg:flex' : 'flex'
                }`}
              >
                <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      Logs
                    </span>
                    {selectedEntry && (
                      <span className="text-[11px] font-mono text-slate-400 truncate max-w-[220px]">
                        • {selectedEntry.fileName}
                      </span>
                    )}
                  </div>

                  {selectedEntry && (
                    <button
                      type="button"
                      onClick={() => handleCopyLog(selectedEntry)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center gap-1.5"
                    >
                      {copiedLogId === selectedEntry.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Log</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {selectedEntry ? (
                  <div className="p-3.5 space-y-3.5 overflow-y-auto text-xs">
                    {/* Status Summary */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedEntry.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : selectedEntry.phase === 'failed' ? (
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <Activity className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-black ${getStatusBadgeStyle(
                            selectedEntry
                          )}`}
                        >
                          {formatHttpStatusLabel(selectedEntry)}
                        </span>
                        {selectedEntry.serverErrorCode && (
                          <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-500/40 font-mono text-[10px] font-bold text-rose-200">
                            {selectedEntry.serverErrorCode}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {new Date(selectedEntry.startedAt).toLocaleTimeString()}
                        {selectedEntry.durationMs !== undefined
                          ? ` • ${selectedEntry.durationMs} ms`
                          : ''}
                      </span>
                    </div>

                    {/* Failure / Server Validation Callout */}
                    {selectedEntry.phase === 'failed' && selectedEntry.serverErrorMessage && (
                      <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                            {selectedEntry.preFlightBlocked
                              ? 'Client Validation Rejection'
                              : 'Server Validation / Error Message'}
                          </div>
                          <div className="text-xs font-semibold text-rose-100 mt-0.5 break-words">
                            {selectedEntry.serverErrorMessage}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Request Headers */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Request Headers ({selectedEntry.method} {selectedEntry.url})
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 font-mono text-[11px] space-y-1">
                        {Object.entries(selectedEntry.requestHeaders).map(([k, v]) => (
                          <div key={k} className="flex flex-wrap gap-x-2">
                            <span className="text-sky-300 font-bold">{k}:</span>
                            <span className="text-slate-200 break-all">{v || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Response Headers */}
                    {selectedEntry.responseHeaders &&
                      Object.keys(selectedEntry.responseHeaders).length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            Response Headers
                          </div>
                          <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 font-mono text-[11px] space-y-1 max-h-32 overflow-y-auto">
                            {Object.entries(selectedEntry.responseHeaders).map(([k, v]) => (
                              <div key={k} className="flex flex-wrap gap-x-2">
                                <span className="text-emerald-300 font-bold">{k}:</span>
                                <span className="text-slate-300 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Response Body */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Response Body
                      </div>
                      <pre
                        className={`rounded-xl p-3 font-mono text-[11px] whitespace-pre-wrap break-words border overflow-x-auto max-h-48 ${
                          selectedEntry.phase === 'failed'
                            ? 'bg-rose-950/25 border-rose-500/40 text-rose-100'
                            : 'bg-slate-900 border-slate-800 text-slate-200'
                        }`}
                      >
                        {selectedEntry.phase === 'completed' || selectedEntry.phase === 'failed'
                          ? formatPrettyBody(selectedEntry.responseBody)
                          : 'Waiting for server response...'}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-xs text-slate-500 text-center">
                    Select a request to inspect its HTTP status code, request headers, and response body.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
