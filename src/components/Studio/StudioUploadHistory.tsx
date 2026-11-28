import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileWarning,
  History,
  Repeat,
  Server,
  Trash2,
  WifiOff
} from 'lucide-react';
import {
  clearFailedUploadHistory,
  FailedUploadHistoryEntry,
  FailedUploadSource,
  getFailedUploadHistory,
  subscribeFailedUploadHistory
} from '../../services/api';

interface StudioUploadHistoryProps {
  isOpen: boolean;
  onToggleOpen: () => void;
  onAutoOpen?: () => void;
}

interface ErrorPatternSummary {
  errorCode: string;
  count: number;
  hasServerFailure: boolean;
  latestHttpStatus?: number;
  latestTimestamp: number;
}

function formatTimestamp(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

function formatRelativeAge(ts: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function getSourceMeta(source: FailedUploadSource): {
  label: string;
  badgeClass: string;
} {
  switch (source) {
    case 'server':
      return {
        label: 'Server-Side',
        badgeClass: 'bg-rose-500/20 border-rose-400/50 text-rose-200'
      };
    case 'network':
      return {
        label: 'Network',
        badgeClass: 'bg-amber-500/20 border-amber-400/50 text-amber-200'
      };
    case 'firebase':
      return {
        label: 'Firebase',
        badgeClass: 'bg-orange-500/20 border-orange-400/50 text-orange-200'
      };
    case 'client':
      return {
        label: 'Validation',
        badgeClass: 'bg-slate-800 border-slate-600 text-slate-300'
      };
  }
}

function getDiagnosticHint(errorCode: string, httpStatus?: number): string | null {
  const code = errorCode.toUpperCase();
  if (code === 'INVALID_ADMIN_PIN' || code === 'MISSING_ADMIN_PIN' || httpStatus === 401) {
    return 'Repeated 401/PIN rejections: verify the Admin PIN matches the server configuration and unlock Studio Admin again.';
  }
  if (code === 'FILE_TOO_LARGE' || httpStatus === 413) {
    return 'Repeated 413 payload limits: uploaded media exceeds the 60 MB server limit or reverse-proxy body cap.';
  }
  if (code === 'UNSUPPORTED_FORMAT' || code === 'UNSUPPORTED_MIME_TYPE' || code === 'BAD_MEDIA_PAYLOAD') {
    return 'Repeated 400 format rejections: verify file extension & MIME type (MP4, WebM, MOV, MKV, PNG, JPG, WEBP supported).';
  }
  if (code === 'EMPTY_PAYLOAD' || code === 'EMPTY_FILE') {
    return 'Repeated 0-byte upload payloads: check source file integrity or whether a proxy stripped the request body.';
  }
  if (
    code === 'SERVER_HTTP_ERROR' ||
    code.startsWith('HTTP_5') ||
    (httpStatus !== undefined && httpStatus >= 500)
  ) {
    return 'Recurring 5xx server failure: check Express backend logs, disk space, or write permissions on the media storage directory.';
  }
  if (code === 'XHR_TIMEOUT' || code === 'XHR_STALL_TIMEOUT' || httpStatus === 408) {
    return 'Recurring upload timeouts: file upload stalled or exceeded the request timeout.';
  }
  if (code === 'XHR_NETWORK_ERROR' || code === 'FETCH_NETWORK_ERROR' || code === 'NETWORK_ERROR') {
    return 'Recurring network drops: check backend server availability, CORS headers, or unstable network connectivity.';
  }
  if (code.startsWith('STORAGE/') || code.includes('FIREBASE')) {
    return 'Recurring Firebase Storage failure: verify Google Admin sign-in and Firebase Storage bucket rules/quota.';
  }
  return null;
}

export const StudioUploadHistory: React.FC<StudioUploadHistoryProps> = ({
  isOpen,
  onToggleOpen,
  onAutoOpen
}) => {
  const [entries, setEntries] = useState<FailedUploadHistoryEntry[]>(() =>
    getFailedUploadHistory()
  );
  const [filterMode, setFilterMode] = useState<'all' | 'server'>('all');
  const [selectedCodeFilter, setSelectedCodeFilter] = useState<string | null>(null);
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    let prevCount = getFailedUploadHistory().length;
    return subscribeFailedUploadHistory((nextEntries) => {
      setEntries(nextEntries);
      setNowMs(Date.now());
      if (nextEntries.length > 0 && nextEntries.length >= prevCount) {
        onAutoOpen?.();
      }
      prevCount = nextEntries.length;
    });
  }, [onAutoOpen]);

  useEffect(() => {
    if (!isOpen || entries.length === 0) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen, entries.length]);

  const errorPatterns = useMemo<ErrorPatternSummary[]>(() => {
    const map = new Map<string, ErrorPatternSummary>();
    for (const item of entries) {
      const key = item.errorCode || 'UNKNOWN_ERROR';
      const existing = map.get(key);
      const isServer =
        item.source === 'server' || (item.httpStatus !== undefined && item.httpStatus >= 400);
      if (existing) {
        existing.count += 1;
        existing.hasServerFailure = existing.hasServerFailure || isServer;
        if (!existing.latestHttpStatus && item.httpStatus) {
          existing.latestHttpStatus = item.httpStatus;
        }
        if (item.timestamp > existing.latestTimestamp) {
          existing.latestTimestamp = item.timestamp;
        }
      } else {
        map.set(key, {
          errorCode: key,
          count: 1,
          hasServerFailure: isServer,
          latestHttpStatus: item.httpStatus,
          latestTimestamp: item.timestamp
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (a.hasServerFailure !== b.hasServerFailure) return a.hasServerFailure ? -1 : 1;
      return b.latestTimestamp - a.latestTimestamp;
    });
  }, [entries]);

  const countByCode = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pattern of errorPatterns) {
      counts[pattern.errorCode] = pattern.count;
    }
    return counts;
  }, [errorPatterns]);

  const recurringPatterns = useMemo(
    () => errorPatterns.filter((p) => p.count >= 2),
    [errorPatterns]
  );

  const serverErrorCount = useMemo(
    () => entries.filter((item) => item.source === 'server').length,
    [entries]
  );

  const visibleEntries = useMemo(() => {
    return entries.filter((item) => {
      if (filterMode === 'server' && item.source !== 'server') return false;
      if (selectedCodeFilter && item.errorCode !== selectedCodeFilter) return false;
      return true;
    });
  }, [entries, filterMode, selectedCodeFilter]);

  const topPattern = recurringPatterns[0] || errorPatterns.find((p) => p.hasServerFailure) || null;
  const topHint = topPattern
    ? getDiagnosticHint(topPattern.errorCode, topPattern.latestHttpStatus)
    : null;

  const handleCopyReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      totalFailuresTracked: entries.length,
      serverSideFailures: serverErrorCount,
      recurringPatterns: recurringPatterns.map((p) => ({
        errorCode: p.errorCode,
        occurrences: p.count,
        httpStatus: p.latestHttpStatus ?? null,
        serverSide: p.hasServerFailure
      })),
      last10FailedUploads: entries.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        fileName: e.fileName,
        fileSizeMb: e.fileSizeMb,
        mediaKind: e.mediaKind,
        source: e.source,
        errorCode: e.errorCode,
        httpStatus: e.httpStatus ?? null,
        endpoint: e.endpoint ?? null,
        message: e.message
      }))
    };
    try {
      navigator.clipboard?.writeText(JSON.stringify(report, null, 2));
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 1800);
    } catch {}
  };

  const handleClearHistory = () => {
    clearFailedUploadHistory();
    setSelectedCodeFilter(null);
    setExpandedEntryId(null);
  };

  return (
    <section
      aria-label="Upload History"
      className={`bg-slate-900 border rounded-2xl shadow-lg overflow-hidden transition-colors ${
        recurringPatterns.length > 0
          ? 'border-rose-500/55'
          : entries.length > 0
          ? 'border-amber-500/45'
          : 'border-slate-800'
      }`}
    >
      {/* Collapsible Header Bar */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/60 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <History
            className={`w-4 h-4 shrink-0 ${
              recurringPatterns.length > 0
                ? 'text-rose-400'
                : entries.length > 0
                ? 'text-amber-400'
                : 'text-slate-400'
            }`}
          />
          <h3 className="text-xs font-black uppercase tracking-wider text-white">
            Upload History
          </h3>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-300 uppercase">
            Last 10 Failed Uploads
          </span>

          {entries.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-400/40 text-[10px] font-black text-rose-200 tabular-nums">
              {entries.length}/10 Failed
            </span>
          )}

          {serverErrorCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-[10px] font-black text-amber-200 tabular-nums flex items-center gap-1">
              <Server className="w-3 h-3" />
              <span>{serverErrorCount} Server-Side</span>
            </span>
          )}

          {recurringPatterns.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-rose-600/25 border border-rose-400/60 text-[10px] font-black text-rose-100 flex items-center gap-1">
              <Repeat className="w-3 h-3 text-rose-300" />
              <span>
                Recurring: {recurringPatterns[0].errorCode} (×{recurringPatterns[0].count})
              </span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          {isOpen && entries.length > 0 && (
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
                  All ({entries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('server')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    filterMode === 'server'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Server-Side ({serverErrorCount})
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopyReport}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-200 flex items-center gap-1"
                title="Copy JSON report of failed uploads"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Report</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleClearHistory}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-rose-300 flex items-center gap-1"
                title="Clear failed upload history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleOpen}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5"
          >
            <span>{isOpen ? 'Hide History' : `Open History (${entries.length})`}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center space-y-1.5">
              <FileWarning className="w-6 h-6 text-slate-500 mx-auto" />
              <div className="text-xs font-bold text-slate-300">
                No failed uploads recorded in history
              </div>
              <p className="text-[11px] text-slate-400 max-w-xl mx-auto">
                The last 10 failed video, image, audio, or APK uploads will appear here automatically with their exact error codes, HTTP status, timestamps, and recurring server-side failure patterns.
              </p>
            </div>
          ) : (
            <>
              {/* Recurring Issue Pattern Summary */}
              {errorPatterns.length > 0 && (
                <div className="rounded-xl bg-slate-950/85 border border-slate-800 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-300">
                      <AlertOctagon
                        className={`w-3.5 h-3.5 ${
                          recurringPatterns.length > 0 ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <span>
                        {recurringPatterns.length > 0
                          ? 'Recurring Error Code Breakdown (Click code to filter)'
                          : 'Error Code Breakdown (Click code to filter)'}
                      </span>
                    </div>
                    {selectedCodeFilter && (
                      <button
                        type="button"
                        onClick={() => setSelectedCodeFilter(null)}
                        className="text-[11px] font-bold text-sky-300 hover:text-sky-200"
                      >
                        Reset code filter ({selectedCodeFilter})
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {errorPatterns.map((pattern) => {
                      const active = selectedCodeFilter === pattern.errorCode;
                      const isRecurring = pattern.count >= 2;
                      return (
                        <button
                          key={pattern.errorCode}
                          type="button"
                          onClick={() =>
                            setSelectedCodeFilter((prev) =>
                              prev === pattern.errorCode ? null : pattern.errorCode
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                            active
                              ? 'bg-sky-600/30 border-sky-400 text-sky-100'
                              : isRecurring
                              ? 'bg-rose-950/50 border-rose-500/60 text-rose-200 hover:border-rose-400'
                              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span>{pattern.errorCode}</span>
                          {pattern.latestHttpStatus !== undefined && pattern.latestHttpStatus > 0 && (
                            <span className="text-[10px] text-amber-300">
                              [{pattern.latestHttpStatus}]
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-black tabular-nums ${
                              isRecurring
                                ? 'bg-rose-500/30 text-rose-100'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            ×{pattern.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {topHint && topPattern && (
                    <div className="rounded-lg bg-amber-950/30 border border-amber-500/35 px-3 py-2 text-[11px] text-amber-100 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black text-amber-300">
                          {topPattern.count >= 2
                            ? `Pattern (${topPattern.errorCode} ×${topPattern.count}): `
                            : `Latest Server Hint (${topPattern.errorCode}): `}
                        </span>
                        <span>{topHint}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* List of Last 10 Failed Uploads */}
              {visibleEntries.length === 0 ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                  No failed uploads match the active filter.
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-0.5">
                  {visibleEntries.map((entry, idx) => {
                    const sourceMeta = getSourceMeta(entry.source);
                    const occurrences = countByCode[entry.errorCode] || 1;
                    const isExpanded = expandedEntryId === entry.id;

                    return (
                      <div
                        key={entry.id}
                        className={`rounded-xl border p-3 space-y-2 transition-colors ${
                          occurrences >= 2
                            ? 'bg-rose-950/20 border-rose-500/45'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[10px] font-black text-slate-400 tabular-nums shrink-0 mt-0.5">
                              #{idx + 1}
                            </span>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className="text-xs font-bold text-white truncate max-w-[240px]"
                                  title={entry.fileName}
                                >
                                  {entry.fileName}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  ({entry.fileSizeMb} MB • {entry.mediaKind.replace('_', ' ').toUpperCase()})
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-rose-950/80 border border-rose-500/50 font-mono text-[10px] font-black text-rose-200">
                                  {entry.errorCode}
                                </span>

                                {entry.httpStatus !== undefined && entry.httpStatus > 0 && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-amber-500/40 font-mono text-[10px] font-bold text-amber-300">
                                    HTTP {entry.httpStatus}
                                    {entry.httpStatusText ? ` ${entry.httpStatusText}` : ''}
                                  </span>
                                )}

                                <span
                                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 ${sourceMeta.badgeClass}`}
                                >
                                  {entry.source === 'network' && <WifiOff className="w-2.5 h-2.5" />}
                                  {entry.source === 'server' && <Server className="w-2.5 h-2.5" />}
                                  <span>{sourceMeta.label}</span>
                                </span>

                                {occurrences >= 2 && (
                                  <span className="px-2 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/50 text-[10px] font-black text-rose-100 flex items-center gap-1">
                                    <Repeat className="w-2.5 h-2.5" />
                                    <span>Recurring ×{occurrences}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span
                              className="text-[11px] font-mono text-slate-300 flex items-center gap-1"
                              title={new Date(entry.timestamp).toISOString()}
                            >
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatTimestamp(entry.timestamp)}</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {formatRelativeAge(entry.timestamp, nowMs)}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-rose-100/95 break-words pl-8">
                          {entry.message}
                        </p>

                        {(entry.endpoint || entry.responseSnippet) && (
                          <div className="pl-8 space-y-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))
                              }
                              className="text-[10px] font-bold text-sky-300 hover:text-sky-200 flex items-center gap-1"
                            >
                              <span>
                                {isExpanded
                                  ? 'Hide Server Response Details'
                                  : 'Inspect Endpoint & Response Details'}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>

                            {isExpanded && (
                              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1.5 font-mono text-[10px]">
                                {entry.endpoint && (
                                  <div className="text-slate-300 break-all">
                                    <span className="text-slate-500">Endpoint: </span>
                                    {entry.endpoint}
                                  </div>
                                )}
                                {entry.responseSnippet && (
                                  <pre className="text-rose-200 whitespace-pre-wrap break-words max-h-28 overflow-y-auto bg-slate-950/80 rounded p-2 border border-slate-800">
                                    {entry.responseSnippet}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
};
