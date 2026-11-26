import React, { useEffect, useMemo, useState } from 'react';
import { HoldScreenConfig, NextMatchNoticeConfig } from '../../types/cricket';
import { NoMatchAnimation } from './NoMatchAnimation';
import { HoldYouTubePlayer, extractYouTubeVideoId } from './HoldYouTubePlayer';

interface HoldScreenViewProps {
  holdScreen: HoldScreenConfig;
  nextMatch?: NextMatchNoticeConfig | null;
  variant: 'mobile' | 'broadcast' | 'obs';
}

function formatNextLine(nextMatch?: NextMatchNoticeConfig | null): string {
  if (!nextMatch) return '';
  const name = (nextMatch.matchName || '').trim();
  const time = (nextMatch.matchTime || '').trim();
  if (!name && !time) return '';
  const combined = name && time ? `${name}, ${time}` : name || time;
  return /^next\s*:/i.test(combined) ? combined : `Next: ${combined}`;
}

export const HoldScreenView: React.FC<HoldScreenViewProps> = ({
  holdScreen,
  nextMatch,
  variant
}) => {
  const [videoFallbackTriggered, setVideoFallbackTriggered] = useState(false);

  const validVideoIds = useMemo(
    () =>
      (holdScreen.videoUrls || [])
        .map(extractYouTubeVideoId)
        .filter((id): id is string => Boolean(id)),
    [holdScreen.videoUrls]
  );

  // Reset video fallback whenever admin changes playlist, loop, or toggles Video ON
  const videoSignature = `${holdScreen.videoEnabled}-${holdScreen.videoLoop}-${validVideoIds.join(',')}`;
  useEffect(() => {
    setVideoFallbackTriggered(false);
  }, [videoSignature]);

  const reason = holdScreen.reason || 'Break';
  const nextLine = formatNextLine(nextMatch);
  const hasSponsorBanner = Boolean(holdScreen.sponsorEnabled && holdScreen.sponsorImageUrl?.trim());
  const replaceWithSponsor = hasSponsorBanner && holdScreen.sponsorMode === 'replace_video';
  const showSponsorBelow = hasSponsorBanner && holdScreen.sponsorMode !== 'replace_video';
  const shouldPlayVideo =
    !replaceWithSponsor &&
    holdScreen.videoEnabled &&
    validVideoIds.length > 0 &&
    !videoFallbackTriggered;

  // OBS OVERLAY HOLD MODE: Transparent-friendly broadcast lower-third/banner (no heavy backdrop or embeds)
  if (variant === 'obs') {
    return (
      <div className="w-full min-h-screen bg-transparent pointer-events-none flex flex-col items-center justify-end px-6 pb-8 select-none">
        <div className="w-full max-w-2xl rounded-2xl bg-[#040b18]/92 border border-sky-400/40 px-6 py-4 shadow-[0_14px_40px_rgba(0,0,0,0.75)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] shrink-0" />
            <div className="min-w-0">
              <div className="font-score text-lg sm:text-xl font-black uppercase tracking-wider text-white truncate">
                {reason}
              </div>
              {nextLine && (
                <div className="font-cricket text-xs font-semibold text-amber-300 truncate">
                  {nextLine}
                </div>
              )}
            </div>
          </div>

          {hasSponsorBanner && (
            <img
              src={holdScreen.sponsorImageUrl}
              alt="Broadcast Sponsor"
              className="h-11 max-w-[160px] object-contain rounded-lg border border-white/15 bg-black/30 px-2 shrink-0"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </div>
    );
  }

  const isMobile = variant === 'mobile';

  const renderSponsorCard = () => {
    if (!hasSponsorBanner) return null;
    const cardInner = (
      <div
        className={`w-full overflow-hidden rounded-2xl border border-slate-300 dark:border-white/15 bg-white dark:bg-white/[0.04] backdrop-blur-md shadow-md dark:shadow-xl flex items-center justify-center ${
          replaceWithSponsor
            ? isMobile
              ? 'max-w-[360px] h-[196px]'
              : 'max-w-xl h-[260px] sm:h-[300px]'
            : isMobile
            ? 'max-w-[360px] h-[68px]'
            : 'max-w-lg h-[92px] sm:h-[112px]'
        }`}
      >
        <img
          src={holdScreen.sponsorImageUrl}
          alt="Sponsor"
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
        />
      </div>
    );

    if (holdScreen.sponsorLinkUrl?.trim()) {
      return (
        <a
          href={holdScreen.sponsorLinkUrl.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full flex justify-center hover:opacity-95 active:scale-[0.99] transition"
        >
          {cardInner}
        </a>
      );
    }

    return <div className="w-full flex justify-center">{cardInner}</div>;
  };

  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center select-none ${
        isMobile ? 'gap-2.5 px-2 py-1' : 'gap-4 px-4 py-4'
      }`}
    >
      {/* Prominent Hold Reason Pill */}
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white dark:bg-white/[0.08] border border-amber-500/70 dark:border-amber-400/50 shadow-sm dark:shadow-[0_0_24px_rgba(251,191,36,0.2)]">
        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 shadow-[0_0_10px_#fbbf24] animate-live-dot" />
        <span className="font-score text-xs sm:text-sm font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
          {reason}
        </span>
      </div>

      {/* Main Media: Sponsor Replacement OR Official YouTube Playlist OR Bat-Ball Animation */}
      {replaceWithSponsor ? (
        <div className="w-full flex flex-col items-center gap-2.5">
          {renderSponsorCard()}
          {nextLine && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-white/[0.06] border border-sky-600/35 dark:border-sky-400/35 text-xs sm:text-sm font-score font-bold text-amber-800 dark:text-amber-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
              <span>{nextLine}</span>
            </div>
          )}
        </div>
      ) : shouldPlayVideo ? (
        <div className="w-full flex flex-col items-center gap-2.5">
          <HoldYouTubePlayer
            videoUrls={holdScreen.videoUrls}
            loop={holdScreen.videoLoop !== false}
            onFallback={() => setVideoFallbackTriggered(true)}
            compact={isMobile}
          />
          {nextLine && (
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-white/[0.06] border border-sky-600/35 dark:border-sky-400/35 text-xs sm:text-sm font-score font-bold text-amber-800 dark:text-amber-300 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
              <span>{nextLine}</span>
            </div>
          )}
        </div>
      ) : (
        <NoMatchAnimation
          nextMatch={nextMatch}
          compact={isMobile}
          title={reason}
          subtitle="Match jald dobara shuru hoga"
        />
      )}

      {/* Optional Sponsor Banner below Video or Animation */}
      {showSponsorBelow && renderSponsorCard()}
    </div>
  );
};
