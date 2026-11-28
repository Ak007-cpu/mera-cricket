import React, { useState } from 'react';
import { Calendar, CheckCircle2, Clock, Gamepad2, Info, Layers, Smartphone } from 'lucide-react';
import { SixProCricketConfig } from '../../types/cricket';
import { sanitizePublicApkUrl } from '../../utils/apkLinks';
import { buildApiUrl } from '../../services/api';
import gameIconArtwork from '../../assets/images/six_pro_cricket_icon_1795611190577.jpg';

const DEFAULT_RELEASE_BUILD_DATE = 'Nov 27, 2026';

interface AppInformationProps {
  sixProCricket?: SixProCricketConfig | null;
  version?: string;
  buildTimestamp?: number;
  siteName?: string;
  contactEmail?: string;
  className?: string;
}

function formatBuildDate(timestamp?: number): string {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp <= 0) {
    return DEFAULT_RELEASE_BUILD_DATE;
  }
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(timestamp));
  } catch {
    return DEFAULT_RELEASE_BUILD_DATE;
  }
}

export const AppInformation: React.FC<AppInformationProps> = ({
  sixProCricket,
  version,
  buildTimestamp,
  siteName = 'Live Cricket HD',
  contactEmail,
  className = ''
}) => {
  const [iconFailed, setIconFailed] = useState(false);

  const resolvedVersion = (version || '').trim() || '1.0.0';
  const buildDate = formatBuildDate(buildTimestamp);
  const sizeLabel = (sixProCricket?.sizeLabel || '').trim() || '12 MB';
  const hasVerifiedApk = sanitizePublicApkUrl(sixProCricket?.apkUrl, buildApiUrl).length > 0;

  return (
    <section
      aria-label="App Information"
      className={`rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3.5 space-y-3 text-xs ${className}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-500/45 bg-slate-950 shrink-0 flex items-center justify-center">
            {!iconFailed ? (
              <img
                src={gameIconArtwork}
                alt="Six Pro 3D Cricket icon"
                referrerPolicy="no-referrer"
                onError={() => setIconFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <Gamepad2 className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Info className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
              <span>App Information</span>
            </div>
            <h3 className="font-black text-slate-950 dark:text-white text-sm truncate">
              SIX PRO 3D CRICKET
            </h3>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide shrink-0 ${
            hasVerifiedApk
              ? 'bg-emerald-100 dark:bg-emerald-500/15 border-emerald-400/60 dark:border-emerald-400/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-100 dark:bg-amber-500/15 border-amber-400/60 dark:border-amber-400/40 text-amber-800 dark:text-amber-300'
          }`}
        >
          {hasVerifiedApk ? (
            <>
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>Latest Release</span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 shrink-0" />
              <span>Pending APK</span>
            </>
          )}
        </span>
      </div>

      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
        Six Pro 3D Cricket is a lightweight 3D stadium cricket game built for smooth Android gameplay,
        featuring responsive shot timing, power-hitting overs, and compact {sizeLabel} installation.
        Match your installed app against the version and build date below to verify you are running the latest release.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Layers className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Version</span>
          </div>
          <div className="font-score font-black text-slate-950 dark:text-white text-xs tabular-nums mt-0.5">
            v{resolvedVersion}
          </div>
        </div>

        <div className="rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-sky-600 dark:text-sky-400" />
            <span>Build Date</span>
          </div>
          <div className="font-bold text-slate-950 dark:text-white text-xs tabular-nums mt-0.5">
            {buildDate}
          </div>
        </div>

        <div className="rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Package Size</span>
          </div>
          <div className="font-score font-bold text-slate-950 dark:text-white text-xs tabular-nums mt-0.5">
            {sizeLabel} (Android APK)
          </div>
        </div>

        <div className="rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 px-2.5 py-2">
          <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
            Publisher
          </div>
          <div className="font-bold text-slate-950 dark:text-white text-xs truncate mt-0.5">
            {siteName}
          </div>
        </div>
      </div>

      {contactEmail && (
        <div className="pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between gap-2">
          <span>Support Contact:</span>
          <span className="text-sky-700 dark:text-sky-300 font-mono truncate">{contactEmail}</span>
        </div>
      )}
    </section>
  );
};
