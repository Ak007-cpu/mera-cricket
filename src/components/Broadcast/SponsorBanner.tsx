import React, { useState, useEffect } from 'react';
import { SponsorBannerConfig } from '../../types/cricket';
import { getStoredSponsorMedia, MEDIA_UPDATED_EVENT } from '../../utils/mediaStorage';
import { ExternalLink, Megaphone } from 'lucide-react';

interface SponsorBannerProps {
  sponsor?: SponsorBannerConfig | null;
  compact?: boolean;
}

export const SponsorBanner: React.FC<SponsorBannerProps> = ({ sponsor, compact = false }) => {
  const [logoError, setLogoError] = useState(false);
  const [bannerError, setBannerError] = useState(false);
  const [, setMediaVersion] = useState(0);

  useEffect(() => {
    const handler = () => {
      setLogoError(false);
      setBannerError(false);
      setMediaVersion((v) => v + 1);
    };
    window.addEventListener(MEDIA_UPDATED_EVENT, handler);
    return () => window.removeEventListener(MEDIA_UPDATED_EVENT, handler);
  }, []);

  if (!sponsor || !sponsor.enabled) {
    return null;
  }

  const stored = getStoredSponsorMedia();
  const effectiveLogoUrl = (!logoError && sponsor.logoUrl) || stored.logoUrl || '';
  const effectiveBannerUrl = (!bannerError && sponsor.imageUrl) || stored.imageUrl || '';

  const hasLogo = Boolean(effectiveLogoUrl);
  const hasBannerImage = Boolean(effectiveBannerUrl);
  const hasLink = Boolean(sponsor.linkUrl && sponsor.linkUrl.trim());
  if (!hasLogo && !hasBannerImage && !hasLink && !sponsor.name?.trim()) {
    return null;
  }
  const displayName = sponsor.name?.trim() || 'Official Broadcast Partner';
  const displayTagline = sponsor.tagline?.trim() || 'Sponsor your brand across every live delivery';

  const content = compact ? (
    <div className="w-full rounded-xl border border-amber-400/60 dark:border-amber-400/35 bg-white/95 dark:bg-[#091227]/90 backdrop-blur-md px-2.5 py-1.5 shadow-md dark:shadow-lg overflow-hidden flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {hasLogo ? (
          <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 overflow-hidden">
            <img
              src={effectiveLogoUrl}
              alt={displayName}
              onError={() => setLogoError(true)}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : hasBannerImage ? (
          <div className="w-12 h-8 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-950">
            <img
              src={effectiveBannerUrl}
              alt={displayName}
              onError={() => setBannerError(true)}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400">
            <Megaphone className="w-4 h-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30 text-[8px] font-score font-bold uppercase tracking-wider shrink-0">
              Sponsor
            </span>
            <span className="text-xs font-black text-slate-950 dark:text-white truncate">{displayName}</span>
          </div>
          {displayTagline && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate leading-tight">
              {displayTagline}
            </div>
          )}
        </div>
      </div>

      {hasLink && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shrink-0">
          <span>Visit</span>
          <ExternalLink className="w-3 h-3" />
        </span>
      )}
    </div>
  ) : (
    <div className="w-full max-w-6xl mx-auto rounded-2xl border border-slate-300 dark:border-sky-400/25 bg-white/95 dark:bg-[#091227]/80 backdrop-blur-md p-3 sm:p-3.5 shadow-md dark:shadow-xl overflow-hidden group transition-all hover:border-sky-500 dark:hover:border-sky-400/50">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-5">
        {/* Left: Sponsor Logo & Info */}
        <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto">
          {hasLogo ? (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white p-1.5 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 shadow-sm dark:shadow-md overflow-hidden">
              <img
                src={effectiveLogoUrl}
                alt={displayName}
                onError={() => setLogoError(true)}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400">
              <Megaphone className="w-5 h-5" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 text-[9px] font-mono font-bold uppercase tracking-widest">
                Sponsored
              </span>
              <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 truncate">
                Broadcast Partner
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate">
              {displayName}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {displayTagline}
            </div>
          </div>
        </div>

        {/* Center/Right: Optional Wide Sponsor Creative Image */}
        {hasBannerImage && (
          <div className="w-full sm:w-auto sm:max-w-md lg:max-w-lg rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700/80 bg-slate-100 dark:bg-slate-950/60 shrink-0">
            <img
              src={effectiveBannerUrl}
              alt={`${displayName} Banner`}
              onError={() => setBannerError(true)}
              className="w-full h-16 sm:h-20 object-cover block"
            />
          </div>
        )}

        {/* Right CTA when link exists */}
        {hasLink && (
          <div className="w-full sm:w-auto flex justify-end shrink-0">
            <span className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md dark:shadow-lg shadow-amber-500/20 transition-colors">
              <span>Visit Sponsor</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (hasLink) {
    return (
      <a
        href={sponsor.linkUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block w-full focus:outline-none"
      >
        {content}
      </a>
    );
  }

  return content;
};
