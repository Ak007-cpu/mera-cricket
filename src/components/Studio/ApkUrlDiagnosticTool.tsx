import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert
} from 'lucide-react';
import {
  ApkUrlVerifyResult,
  buildApiUrl,
  fetchMonetizationConfig,
  verifyApkDownloadUrl
} from '../../services/api';

interface ApkUrlDiagnosticToolProps {
  adminPin: string;
  appApkUrl?: string;
  gameApkUrl?: string;
  onSelectGameUrl?: (url: string) => void;
}

type DiagnosticStatus = 'idle' | 'checking' | 'active' | 'broken' | 'unconfigured';

interface DiagnosticProbeState {
  url: string;
  status: DiagnosticStatus;
  httpStatus: number;
  statusText: string;
  is200Ok: boolean;
  methodUsed: 'HEAD' | 'GET_RANGE' | 'LOCAL';
  latencyMs?: number;
  contentLength?: number;
  contentType?: string;
  finalUrl?: string;
  error?: string;
  checkedAt?: number;
}

function formatFileSizeMb(bytes?: number): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return 'Size N/A';
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function getSizeDiagnosticHint(probe: DiagnosticProbeState): string | null {
  if (probe.status !== 'active') return null;
  if (probe.contentLength === undefined) {
    return 'Server did not send a Content-Length header — mobile download progress bar may appear unknown.';
  }
  if (probe.contentLength === 0) {
    return 'Warning: Content-Length is 0.00 MB (empty file) — APK installation will fail on mobile.';
  }
  const mb = probe.contentLength / (1024 * 1024);
  if (mb >= 50) {
    return `Large APK (${mb.toFixed(2)} MB) — downloads may be slow or time out on weak mobile data connections.`;
  }
  return null;
}

function isSameOriginUrl(rawUrl: string): boolean {
  if (rawUrl.startsWith('/')) return true;
  if (typeof window === 'undefined') return false;
  try {
    const parsed = new URL(rawUrl, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export const ApkUrlDiagnosticTool: React.FC<ApkUrlDiagnosticToolProps> = ({
  adminPin,
  appApkUrl,
  gameApkUrl,
  onSelectGameUrl
}) => {
  const [isFetchingUrls, setIsFetchingUrls] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState('');

  const [appProbe, setAppProbe] = useState<DiagnosticProbeState>({
    url: '',
    status: 'idle',
    httpStatus: 0,
    statusText: '',
    is200Ok: false,
    methodUsed: 'HEAD'
  });

  const [gameProbe, setGameProbe] = useState<DiagnosticProbeState>({
    url: '',
    status: 'idle',
    httpStatus: 0,
    statusText: '',
    is200Ok: false,
    methodUsed: 'HEAD'
  });

  const [customProbe, setCustomProbe] = useState<DiagnosticProbeState | null>(null);

  const probeSingleUrl = useCallback(
    async (rawUrl: string): Promise<DiagnosticProbeState> => {
      const target = rawUrl.trim();
      if (!target) {
        return {
          url: '',
          status: 'unconfigured',
          httpStatus: 0,
          statusText: 'Not Configured',
          is200Ok: false,
          methodUsed: 'HEAD',
          checkedAt: Date.now()
        };
      }

      // Same-origin URLs can be checked directly via browser fetch HEAD first
      if (isSameOriginUrl(target)) {
        const startedAt = performance.now();
        try {
          const resolved = target.startsWith('/') ? buildApiUrl(target) : target;
          const response = await fetch(resolved, { method: 'HEAD', cache: 'no-store' });
          const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
          const lenHeader = response.headers.get('Content-Length');
          const contentLength = lenHeader !== null ? Number(lenHeader) : undefined;
          const is200Ok = response.status === 200;

          return {
            url: target,
            status: is200Ok ? 'active' : 'broken',
            httpStatus: response.status,
            statusText: response.statusText || (is200Ok ? 'OK' : 'Error'),
            is200Ok,
            methodUsed: 'HEAD',
            latencyMs,
            contentLength: Number.isFinite(contentLength) ? contentLength : undefined,
            contentType: response.headers.get('content-type') || undefined,
            finalUrl: response.url || resolved,
            error: is200Ok ? undefined : `HEAD request returned HTTP ${response.status}`,
            checkedAt: Date.now()
          };
        } catch {
          // Fall through to server-side HEAD probe
        }
      }

      // Cross-origin URLs (e.g., GitHub Releases / CDN) use server-side HEAD probe to avoid CORS blocks
      try {
        const result: ApkUrlVerifyResult = await verifyApkDownloadUrl(target, adminPin);
        const is200Ok =
          typeof result.is200Ok === 'boolean'
            ? result.is200Ok
            : result.status === 200 && result.valid;
        const isActive = Boolean(result.valid && (is200Ok || result.status === 206));

        return {
          url: target,
          status: isActive ? 'active' : 'broken',
          httpStatus: result.status,
          statusText: result.statusText || (isActive ? 'OK' : 'Error'),
          is200Ok,
          methodUsed: result.methodUsed || 'HEAD',
          latencyMs: result.latencyMs,
          contentLength: result.contentLength,
          contentType: result.contentType,
          finalUrl: result.finalUrl,
          error: isActive
            ? undefined
            : result.error || `HEAD request returned HTTP ${result.status || 0}`,
          checkedAt: result.checkedAt || Date.now()
        };
      } catch (err: any) {
        return {
          url: target,
          status: 'broken',
          httpStatus: 0,
          statusText: 'Request Failed',
          is200Ok: false,
          methodUsed: 'HEAD',
          error: err?.message || 'Unable to execute HEAD diagnostic request',
          checkedAt: Date.now()
        };
      }
    },
    [adminPin]
  );

  const runDiagnosticsFromServer = useCallback(async () => {
    setIsFetchingUrls(true);
    setFetchError(null);
    setAppProbe((prev) => ({ ...prev, status: 'checking' }));
    setGameProbe((prev) => ({ ...prev, status: 'checking' }));

    try {
      const cfg = await fetchMonetizationConfig();
      const fetchedAppUrl =
        (typeof appApkUrl === 'string' && appApkUrl.trim()) ||
        cfg?.broadcastSettings?.appDownload?.apkUrl?.trim() ||
        '';
      const fetchedGameUrl =
        (typeof gameApkUrl === 'string' && gameApkUrl.trim()) ||
        cfg?.broadcastSettings?.sixProCricket?.apkUrl?.trim() ||
        '';

      const [nextApp, nextGame] = await Promise.all([
        probeSingleUrl(fetchedAppUrl),
        probeSingleUrl(fetchedGameUrl)
      ]);
      setAppProbe(nextApp);
      setGameProbe(nextGame);
    } catch (err: any) {
      setFetchError(err?.message || 'Failed to fetch saved APK configuration');
      const fallbackAppUrl = (appApkUrl || '').trim();
      const fallbackGameUrl = (gameApkUrl || '').trim();
      const [nextApp, nextGame] = await Promise.all([
        probeSingleUrl(fallbackAppUrl),
        probeSingleUrl(fallbackGameUrl)
      ]);
      setAppProbe(nextApp);
      setGameProbe(nextGame);
    } finally {
      setIsFetchingUrls(false);
    }
  }, [appApkUrl, gameApkUrl, probeSingleUrl]);

  useEffect(() => {
    void runDiagnosticsFromServer();
  }, [runDiagnosticsFromServer]);

  const handleRunCustomProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = customUrlInput.trim();
    if (!target) return;
    setCustomProbe({
      url: target,
      status: 'checking',
      httpStatus: 0,
      statusText: 'Checking...',
      is200Ok: false,
      methodUsed: 'HEAD'
    });
    const res = await probeSingleUrl(target);
    setCustomProbe(res);
  };

  const renderStatusBadge = (probe: DiagnosticProbeState) => {
    if (probe.status === 'checking' || probe.status === 'idle') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-[11px] font-black uppercase tracking-wider">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Checking HEAD...</span>
        </span>
      );
    }
    if (probe.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Active · {probe.httpStatus} {probe.statusText || 'OK'}</span>
        </span>
      );
    }
    if (probe.status === 'broken') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/50 text-rose-300 text-[11px] font-black uppercase tracking-wider">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Broken{probe.httpStatus ? ` · HTTP ${probe.httpStatus}` : ''}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-black uppercase tracking-wider">
        <AlertTriangle className="w-3.5 h-3.5" />
        <span>Unconfigured</span>
      </span>
    );
  };

  const renderSizeBadge = (probe: DiagnosticProbeState) => {
    if (probe.status === 'idle' || probe.status === 'checking' || probe.status === 'unconfigured') {
      return null;
    }
    const hasBytes =
      probe.contentLength !== undefined && Number.isFinite(probe.contentLength);
    const mbValue = hasBytes ? (probe.contentLength as number) / (1024 * 1024) : 0;
    const isLarge = hasBytes && mbValue >= 50;
    const isEmpty = hasBytes && probe.contentLength === 0;

    return (
      <span
        title={
          hasBytes
            ? `Content-Length: ${probe.contentLength?.toLocaleString()} bytes`
            : 'Content-Length header not returned by server'
        }
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-score font-bold tabular-nums ${
          isEmpty
            ? 'bg-rose-500/15 border-rose-500/45 text-rose-300'
            : isLarge
            ? 'bg-amber-500/15 border-amber-500/45 text-amber-300'
            : hasBytes
            ? 'bg-sky-500/15 border-sky-500/40 text-sky-200'
            : 'bg-slate-800/80 border-slate-700 text-slate-400'
        }`}
      >
        <span>{formatFileSizeMb(probe.contentLength)}</span>
      </span>
    );
  };

  const renderProbeCard = (
    title: string,
    subtitle: string,
    probe: DiagnosticProbeState,
    onRecheck: () => void
  ) => {
    const sizeHint = getSizeDiagnosticHint(probe);
    return (
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-black text-white uppercase tracking-wide">{title}</div>
            <div className="text-[11px] text-slate-400">{subtitle}</div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {renderStatusBadge(probe)}
            {renderSizeBadge(probe)}
            <button
              type="button"
              disabled={probe.status === 'checking' || !probe.url}
              onClick={onRecheck}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${probe.status === 'checking' ? 'animate-spin' : ''}`} />
              <span>HEAD</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] font-mono break-all rounded-lg bg-slate-900/90 border border-slate-800 px-3 py-2 text-slate-300">
          {probe.url || 'No APK URL configured — public button stays in safe Coming Soon / Web Install mode.'}
        </div>

        {probe.status !== 'unconfigured' && probe.status !== 'idle' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1">
              {probe.status === 'active' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : probe.status === 'broken' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>
                Method: <strong className="text-slate-200">{probe.methodUsed}</strong>
              </span>
            </span>
            {typeof probe.latencyMs === 'number' && (
              <span>
                Latency: <strong className="text-slate-200 tabular-nums">{probe.latencyMs} ms</strong>
              </span>
            )}
            <span>
              Content-Length:{' '}
              <strong className="text-slate-200 tabular-nums">{formatFileSizeMb(probe.contentLength)}</strong>
            </span>
            {probe.checkedAt && (
              <span>
                Checked: <strong className="text-slate-300">{new Date(probe.checkedAt).toLocaleTimeString()}</strong>
              </span>
            )}
          </div>
        )}

        {sizeHint && (
          <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {sizeHint}
          </div>
        )}

        {probe.status === 'broken' && probe.error && (
          <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {probe.error}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-sky-500/35 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="font-black text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            <span>APK Download URL Diagnostic Utility (HEAD 200 OK Check)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configured APK URLs fetch karke HTTP HEAD request bhejta hai aur turant Active (200 OK) ya Broken status dikhata hai.
          </p>
        </div>

        <button
          type="button"
          disabled={isFetchingUrls}
          onClick={runDiagnosticsFromServer}
          className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetchingUrls ? 'animate-spin' : ''}`} />
          <span>{isFetchingUrls ? 'Checking HEAD...' : 'Fetch & Check HEAD'}</span>
        </button>
      </div>

      {fetchError && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/35 px-3.5 py-2 text-xs text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {renderProbeCard(
          'SIX PRO 3D CRICKET APK URL',
          'Fixed gaming download banner target',
          gameProbe,
          async () => {
            setGameProbe((prev) => ({ ...prev, status: 'checking' }));
            setGameProbe(await probeSingleUrl(gameProbe.url));
          }
        )}

        {renderProbeCard(
          'Website / Mobile App APK URL',
          'Header Get App & #app-download-button target',
          appProbe,
          async () => {
            setAppProbe((prev) => ({ ...prev, status: 'checking' }));
            setAppProbe(await probeSingleUrl(appProbe.url));
          }
        )}
      </div>

      {/* Custom / Candidate URL HEAD Tester */}
      <form
        onSubmit={handleRunCustomProbe}
        className="rounded-xl bg-slate-950/80 border border-slate-800 p-3.5 space-y-2.5"
      >
        <label className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          <span>Test Any APK Download URL (Live HEAD 200 OK Probe)</span>
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={customUrlInput}
            onChange={(e) => setCustomUrlInput(e.target.value)}
            placeholder="https://github.com/<user>/<repo>/releases/download/<tag>/app-release.apk"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!customUrlInput.trim() || customProbe?.status === 'checking'}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Run HEAD Check</span>
          </button>
        </div>

        {customProbe && (
          <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {renderStatusBadge(customProbe)}
              {renderSizeBadge(customProbe)}
              {customProbe.status === 'active' && (
                <span className="text-emerald-300 text-[11px]">
                  Verified {customProbe.httpStatus} OK ({formatFileSizeMb(customProbe.contentLength)}
                  {customProbe.latencyMs ? ` · ${customProbe.latencyMs} ms` : ''})
                </span>
              )}
              {customProbe.status === 'broken' && (
                <span className="text-rose-300 text-[11px]">
                  {customProbe.error || `HTTP ${customProbe.httpStatus}`}
                </span>
              )}
            </div>

            {customProbe.status === 'active' && onSelectGameUrl && (
              <button
                type="button"
                onClick={() => onSelectGameUrl(customProbe.finalUrl || customProbe.url)}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black"
              >
                Use for SIX PRO 3D CRICKET
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  );
};
