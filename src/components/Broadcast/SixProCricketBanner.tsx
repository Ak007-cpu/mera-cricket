import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, Gamepad2 } from 'lucide-react';
import { SixProCricketConfig } from '../../types/cricket';
import { buildApiUrl, logAppDownloadIntent } from '../../services/api';
import { extractApkFilename, sanitizePublicApkUrl } from '../../utils/apkLinks';
import bannerArtwork from '../../assets/images/six_pro_cricket_banner_1795611190808.jpg';
import gameIconArtwork from '../../assets/images/six_pro_cricket_icon_1795611190577.jpg';

interface SixProCricketBannerProps {
  config?: SixProCricketConfig | null;
  variant?: 'banner' | 'mobile';
  layout?: 'fixed' | 'inline';
  className?: string;
}

export const SixProCricketBanner: React.FC<SixProCricketBannerProps> = ({
  config,
  variant = 'banner',
  layout = 'fixed',
  className = ''
}) => {
  const [bannerFailed, setBannerFailed] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [pendingNoticeOpen, setPendingNoticeOpen] = useState(false);

  const isInsideIframe = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  if (config?.enabled === false) {
    return null;
  }

  const apkUrl = sanitizePublicApkUrl(config?.apkUrl, buildApiUrl);
  const hasApkLink = apkUrl.length > 0;
  const sizeLabel = (config?.sizeLabel || '').trim() || '12 MB';
  const downloadFilename = hasApkLink
    ? extractApkFilename(apkUrl, 'six-pro-3d-cricket.apk')
    : 'six-pro-3d-cricket.apk';

  const handleDownloadClick = () => {
    logAppDownloadIntent({
      elementId: 'six-pro-3d-cricket-banner',
      variant: variant === 'mobile' ? 'mini' : 'banner',
      action: 'apk_download',
      fileUrl: apkUrl,
      siteName: 'SIX PRO 3D CRICKET'
    });
    setDownloadStarted(true);
    window.setTimeout(() => {
      setDownloadStarted(false);
    }, 5000);
  };

  const handlePendingClick = () => {
    setPendingNoticeOpen((prev) => !prev);
  };

  if (layout === 'inline') {
    return (
      <section
        aria-label="SIX PRO 3D CRICKET Android APK Download"
        className={`relative overflow-hidden rounded-xl border border-emerald-500/45 bg-[#06121f] text-white shadow-md ${className}`}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#040d18] via-[#071929] to-emerald-950/80"
        >
          {!bannerFailed && (
            <img
              src={bannerArtwork}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setBannerFailed(true)}
              className="h-full w-full object-cover object-center opacity-35"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#040d18]/95 via-[#040d18]/85 to-[#040d18]/65" />
        </div>

        <div className="relative z-10 px-3 py-2.5 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-400/60 bg-slate-950 shrink-0 flex items-center justify-center">
              {!iconFailed ? (
                <img
                  src={gameIconArtwork}
                  alt="SIX PRO 3D CRICKET icon"
                  referrerPolicy="no-referrer"
                  onError={() => setIconFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Gamepad2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xs font-black tracking-tight text-white truncate">
                SIX PRO 3D CRICKET
              </h2>
              <p className="text-[11px] font-semibold text-emerald-300 tabular-nums truncate">
                {!hasApkLink
                  ? pendingNoticeOpen
                    ? 'Set valid APK URL in Admin Panel'
                    : `Android APK · ${sizeLabel} · Link Pending`
                  : downloadStarted
                  ? `Downloading APK (${sizeLabel})...`
                  : `Android APK · Size: ${sizeLabel}`}
              </p>
            </div>
          </div>

          {hasApkLink ? (
            <a
              href={apkUrl}
              download={downloadFilename}
              target={isInsideIframe ? '_blank' : undefined}
              rel={isInsideIframe ? 'noopener noreferrer' : undefined}
              onClick={handleDownloadClick}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black text-xs tracking-wide inline-flex items-center justify-center gap-1.5 border border-emerald-300/80 shadow-[0_4px_14px_rgba(16,185,129,0.38)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 whitespace-nowrap shrink-0"
            >
              {downloadStarted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>STARTED</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>DOWNLOAD NOW</span>
                </>
              )}
            </a>
          ) : (
            <button
              type="button"
              onClick={handlePendingClick}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 font-black text-[11px] tracking-wide inline-flex items-center justify-center gap-1.5 border border-amber-400/50 transition whitespace-nowrap shrink-0"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>APK PENDING</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  const isMobile = variant === 'mobile';

  return (
    <aside
      aria-label="SIX PRO 3D CRICKET Official Android APK Download"
      className={
        isMobile
          ? `fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-2 pb-2 pointer-events-none ${className}`
          : `fixed bottom-0 inset-x-0 z-40 px-2.5 pb-2 sm:px-5 sm:pb-2.5 pointer-events-none ${className}`
      }
    >
      <div
        className={`pointer-events-auto relative overflow-hidden rounded-xl border border-emerald-500/55 bg-[#06121f]/95 backdrop-blur-md text-white shadow-[0_-6px_26px_rgba(0,0,0,0.48)] ${
          isMobile ? 'w-full' : 'max-w-[960px] mx-auto'
        }`}
      >
        {/* Subtle Stadium Key Art Backdrop */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#040d18] via-[#071929] to-emerald-950/80"
        >
          {!bannerFailed && (
            <img
              src={bannerArtwork}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setBannerFailed(true)}
              className="h-full w-full object-cover object-center opacity-35 sm:opacity-45"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#040d18]/95 via-[#040d18]/82 to-[#040d18]/60" />
        </div>

        <div
          className={`relative z-10 flex items-center justify-between gap-2.5 ${
            isMobile ? 'px-2.5 py-1.5' : 'px-3 py-2 sm:px-4 sm:py-2 sm:gap-4'
          }`}
        >
          {/* Left: Compact Game Icon + Title + Size */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`rounded-lg overflow-hidden border border-emerald-400/70 bg-slate-950 shadow-sm shrink-0 flex items-center justify-center ${
                isMobile ? 'w-9 h-9' : 'w-9 h-9 sm:w-11 sm:h-11'
              }`}
            >
              {!iconFailed ? (
                <img
                  src={gameIconArtwork}
                  alt="SIX PRO 3D CRICKET emblem"
                  referrerPolicy="no-referrer"
                  onError={() => setIconFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Gamepad2 className="w-5 h-5 text-emerald-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <h2
                  className={`font-black tracking-tight text-white truncate leading-tight ${
                    isMobile ? 'text-xs' : 'text-xs sm:text-sm'
                  }`}
                >
                  SIX PRO 3D CRICKET
                </h2>
              </div>
              <p
                className={`font-semibold tabular-nums truncate leading-tight mt-0.5 ${
                  hasApkLink
                    ? 'text-emerald-300'
                    : pendingNoticeOpen
                    ? 'text-amber-300'
                    : 'text-slate-300'
                } ${isMobile ? 'text-[10px]' : 'text-[10px] sm:text-xs'}`}
              >
                {!hasApkLink
                  ? pendingNoticeOpen
                    ? 'Replace APK link in Admin Panel → Site & Mobile'
                    : `Android APK · ${sizeLabel} · Link update pending`
                  : downloadStarted
                  ? `Downloading ${downloadFilename} (${sizeLabel})...`
                  : `Android APK · ${sizeLabel}`}
              </p>
            </div>
          </div>

          {/* Right: Green Direct DOWNLOAD NOW Button (when verified URL configured) */}
          {hasApkLink ? (
            <a
              href={apkUrl}
              download={downloadFilename}
              target={isInsideIframe ? '_blank' : undefined}
              rel={isInsideIframe ? 'noopener noreferrer' : undefined}
              onClick={handleDownloadClick}
              className={`rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-black tracking-wide inline-flex items-center justify-center gap-1.5 border border-emerald-300/80 shadow-[0_4px_16px_rgba(16,185,129,0.42)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 whitespace-nowrap shrink-0 ${
                isMobile
                  ? 'min-h-[34px] px-3 py-1.5 text-[11px]'
                  : 'min-h-[36px] sm:min-h-[38px] px-3.5 sm:px-5 py-1.5 text-xs sm:text-sm'
              }`}
            >
              {downloadStarted ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>DOWNLOADING...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>DOWNLOAD NOW</span>
                </>
              )}
            </a>
          ) : (
            <button
              type="button"
              onClick={handlePendingClick}
              className={`rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 font-black tracking-wide inline-flex items-center justify-center gap-1.5 border border-amber-400/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 whitespace-nowrap shrink-0 ${
                isMobile
                  ? 'min-h-[34px] px-2.5 py-1.5 text-[11px]'
                  : 'min-h-[36px] sm:min-h-[38px] px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>COMING SOON</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
