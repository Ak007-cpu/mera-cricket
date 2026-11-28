import React, { useMemo, useState } from 'react';
import { AppDownloadConfig } from '../../types/cricket';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { buildApiUrl, logAppDownloadIntent } from '../../services/api';
import { extractApkFilename, sanitizePublicApkUrl } from '../../utils/apkLinks';
import { Download, Smartphone, Share, X, CheckCircle2, ExternalLink } from 'lucide-react';

interface AppDownloadButtonProps {
  config?: AppDownloadConfig;
  variant?: 'banner' | 'compact' | 'mini';
  siteName?: string;
  onOpenMobileApp?: () => void;
  className?: string;
}

function isInsideAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const w = window as unknown as Record<string, unknown>;
    const cap = w.Capacitor as { isNativePlatform?: () => boolean } | undefined;
    if (cap?.isNativePlatform?.() || w.Capacitor || w.cordova || w.AndroidBridge) {
      return true;
    }

    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return true;
    if (document.referrer?.startsWith('android-app://')) return true;
    if (/; wv\)/i.test(navigator.userAgent || '')) return true;
  } catch {
    return false;
  }
  return false;
}

export const AppDownloadButton: React.FC<AppDownloadButtonProps> = ({
  config,
  variant = 'banner',
  siteName = 'Live Cricket HD',
  onOpenMobileApp,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const insideApp = useMemo(() => isInsideAppEnvironment(), []);
  const isInsideIframe = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  if (insideApp) return null;

  const isEnabled = config?.enabled ?? true;
  if (!isEnabled) return null;

  const apkUrl = sanitizePublicApkUrl(config?.apkUrl, buildApiUrl);
  const version = (config?.version || '').trim();
  const hasApkLink = apkUrl.length > 0;
  const downloadFilename = hasApkLink ? extractApkFilename(apkUrl, 'live-cricket-app.apk') : 'live-cricket-app.apk';

  const trackDownloadIntent = (action: 'apk_download' | 'pwa_install' | 'install_modal') => {
    logAppDownloadIntent({
      elementId: 'app-download-button',
      variant,
      action,
      fileUrl: apkUrl || undefined,
      version: version || undefined,
      siteName
    });
  };

  const handlePrimaryClick = async () => {
    trackDownloadIntent(isInstallable ? 'pwa_install' : 'install_modal');
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        setJustInstalled(true);
        return;
      }
    }
    setIsModalOpen(true);
  };

  const renderModal = () => {
    if (!isModalOpen) return null;
    return (
      <div
        className="fixed inset-0 z-[90] bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setIsModalOpen(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-white dark:bg-[#071022] border border-slate-300 dark:border-slate-700/80 p-5 shadow-2xl space-y-4 text-slate-950 dark:text-white font-sans"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-400 dark:border-emerald-400/45 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-950 dark:text-white flex items-center gap-2">
                  <span>{siteName} App</span>
                  {version && (
                    <span className="text-[11px] font-score font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-400 dark:border-emerald-400/40 text-emerald-800 dark:text-emerald-300">
                      v{version}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Mobile par fast live score, sound alerts aur HD graphics payein
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2.5">
            {hasApkLink && (
              <a
                href={apkUrl}
                target={isInsideIframe ? '_blank' : undefined}
                rel={isInsideIframe ? 'noopener noreferrer' : undefined}
                download={downloadFilename}
                onClick={() => {
                  trackDownloadIntent('apk_download');
                  setIsModalOpen(false);
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition"
              >
                <Download className="w-4 h-4" />
                <span>Download Android APK {version ? `(v${version})` : ''}</span>
              </a>
            )}

            {isInstallable && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await install();
                  if (ok) {
                    setJustInstalled(true);
                    setIsModalOpen(false);
                  }
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black text-sm flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                <span>Install App Directly (1-Click)</span>
              </button>
            )}

            {onOpenMobileApp && (
              <button
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  onOpenMobileApp();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <ExternalLink className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Open Mobile App View Now</span>
              </button>
            )}
          </div>

          {!hasApkLink && !isInstallable && (
            <div className="rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
              {isIOS ? (
                <>
                  <div className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                    <Share className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> iPhone / iPad par Install karne ka tarika:
                  </div>
                  <p>
                    Safari browser mein neeche <strong>Share</strong> icon dabaye aur{' '}
                    <strong className="text-sky-700 dark:text-sky-300">&ldquo;Add to Home Screen&rdquo;</strong> select karein.
                  </p>
                </>
              ) : (
                <>
                  <div className="font-bold text-slate-950 dark:text-white flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Phone par App Install karne ka tarika:
                  </div>
                  <p>
                    Chrome browser ke top-right <strong>Menu (⋮)</strong> par click karein aur{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">&ldquo;Install app&rdquo;</strong> ya{' '}
                    <strong className="text-emerald-700 dark:text-emerald-300">&ldquo;Add to Home screen&rdquo;</strong> dabayein.
                  </p>
                </>
              )}
            </div>
          )}

          {hasApkLink && (
            <p className="text-[11px] text-slate-600 dark:text-slate-400 text-center">
              APK install ke liye phone ki settings mein &lsquo;Unknown sources&rsquo; allow karni par sakti hai.
            </p>
          )}
        </div>
      </div>
    );
  };

  if (variant === 'mini') {
    if (hasApkLink) {
      return (
        <>
          <a
            href={apkUrl}
            target={isInsideIframe ? '_blank' : undefined}
            rel={isInsideIframe ? 'noopener noreferrer' : undefined}
            download={downloadFilename}
            onClick={() => trackDownloadIntent('apk_download')}
            title={`Download ${siteName} Android App${version ? ` v${version}` : ''}`}
            className={`min-h-[34px] px-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 border border-emerald-200/80 text-slate-950 font-sans font-black text-[10px] sm:text-[11px] flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.35)] transition shrink-0 ${className}`}
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>Get App</span>
          </a>
          {renderModal()}
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={handlePrimaryClick}
          title={`Download / Install ${siteName} App`}
          className={`min-h-[34px] px-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-95 border border-emerald-200/80 text-slate-950 font-sans font-black text-[10px] sm:text-[11px] flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.35)] transition shrink-0 ${className}`}
        >
          {justInstalled || isInstalled ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>{justInstalled || isInstalled ? 'Installed' : 'Get App'}</span>
        </button>
        {renderModal()}
      </>
    );
  }

  if (variant === 'compact') {
    if (hasApkLink) {
      return (
        <>
          <a
            href={apkUrl}
            target={isInsideIframe ? '_blank' : undefined}
            rel={isInsideIframe ? 'noopener noreferrer' : undefined}
            download={downloadFilename}
            onClick={() => trackDownloadIntent('apk_download')}
            title={`Download ${siteName} Android App${version ? ` v${version}` : ''}`}
            className={`inline-flex items-center gap-1.5 font-sans text-xs sm:text-sm font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200/80 shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all shrink-0 ${className}`}
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>Download App</span>
            {version && (
              <span className="hidden md:inline font-score text-[10px] bg-slate-950/15 px-1.5 py-0.5 rounded">
                v{version}
              </span>
            )}
          </a>
          {renderModal()}
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={handlePrimaryClick}
          title={`Download / Install ${siteName} App`}
          className={`inline-flex items-center gap-1.5 font-sans text-xs sm:text-sm font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200/80 shadow-[0_0_16px_rgba(16,185,129,0.35)] transition-all shrink-0 ${className}`}
        >
          {justInstalled || isInstalled ? (
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          ) : (
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          )}
          <span>{justInstalled || isInstalled ? 'App Installed' : 'Download App'}</span>
        </button>
        {renderModal()}
      </>
    );
  }

  return (
    <>
      <div
        id="app-download-button"
        className={`fixed bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-4 z-40 pointer-events-none flex justify-end scale-90 origin-bottom-right animate-download-bounce-in ${className}`}
      >
        <div className="pointer-events-auto w-auto max-w-[calc(100vw-1.25rem)] sm:max-w-md bg-white/95 dark:bg-[#0a1329]/92 backdrop-blur-md border border-emerald-500/50 dark:border-emerald-500/40 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2.5 sm:gap-3">
          <div className="text-[11px] text-slate-700 dark:text-slate-200 leading-tight min-w-0">
            <div className="font-bold text-slate-950 dark:text-white truncate">{siteName} Mobile App</div>
            <p className="hidden sm:block text-[10px] text-slate-600 dark:text-slate-300 mt-0.5 truncate max-w-[200px]">
              {hasApkLink
                ? "Enable 'Unknown sources' if prompted."
                : 'Fast live score & sound alerts.'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasApkLink ? (
              <a
                href={apkUrl}
                target={isInsideIframe ? '_blank' : undefined}
                rel={isInsideIframe ? 'noopener noreferrer' : undefined}
                download={downloadFilename}
                onClick={() => trackDownloadIntent('apk_download')}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-cricket font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-300/80 shadow-[0_0_14px_rgba(16,185,129,0.3)] transition shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>Download Android App</span>
                {version && (
                  <span className="font-score text-[10px] font-bold bg-slate-950/15 px-1.5 py-0.5 rounded">
                    v{version}
                  </span>
                )}
              </a>
            ) : (
              <button
                type="button"
                onClick={handlePrimaryClick}
                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-cricket font-bold text-xs flex items-center justify-center gap-1.5 border border-emerald-300/80 shadow-[0_0_14px_rgba(16,185,129,0.28)] transition shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{isInstallable ? 'Install App' : 'Download App'}</span>
                {version && (
                  <span className="font-score text-[10px] font-bold bg-slate-950/15 px-1.5 py-0.5 rounded">
                    v{version}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {renderModal()}
    </>
  );
};
