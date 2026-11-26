import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TvPlaylistItem, TvScreenConfig, NextMatchNoticeConfig } from '../../types/cricket';
import { buildApiUrl } from '../../services/api';
import { NoMatchAnimation } from './NoMatchAnimation';
import { HoldYouTubePlayer, extractYouTubeVideoId } from './HoldYouTubePlayer';
import { LiveSportsNewsChannel } from './LiveSportsNewsChannel';
import { Volume2, VolumeX, ExternalLink } from 'lucide-react';

interface TvScreenViewProps {
  tvScreen?: TvScreenConfig | null;
  nextMatch?: NextMatchNoticeConfig | null;
  variant: 'broadcast' | 'mobile' | 'obs';
  embedded?: boolean;
  hasLiveMatch?: boolean;
  onAdPlaybackChange?: (isAdPlaying: boolean) => void;
}

type PlaybackMode = 'idle' | 'ad' | 'gap';

function resolveMediaUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) {
    return buildApiUrl(trimmed);
  }
  return trimmed;
}

function sanitizeHttpLink(rawLink?: string): string {
  const trimmed = (rawLink || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function resolveSafeEmbedUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    console.warn('[TvScreenView] Blocked unsafe embed URL scheme:', { rawUrl: trimmed });
    return '';
  }
  if (/(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmed)) {
    const ytId = extractYouTubeVideoId(trimmed);
    if (!ytId) {
      console.warn('[TvScreenView] Malformed YouTube embed URL:', { rawUrl: trimmed });
      return '';
    }
    return `https://www.youtube.com/embed/${ytId}`;
  }
  if (trimmed.startsWith('/')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isLiveNewsChannelItem(item?: TvPlaylistItem | null): boolean {
  if (!item) return false;
  if (item.mediaType === 'news_feed') return true;
  return /(?:[?&]view=news-tv|live-sports-news|cricket-news-tv)/i.test(item.url || '');
}

export const TvScreenView: React.FC<TvScreenViewProps> = ({
  tvScreen,
  nextMatch,
  variant,
  embedded = false,
  hasLiveMatch = false,
  onAdPlaybackChange
}) => {
  const isMobile = variant === 'mobile';
  const isObs = variant === 'obs';

  const playlist = useMemo<TvPlaylistItem[]>(() => {
    const raw = tvScreen?.playlist || [];
    return raw.filter((item) => Boolean(item && item.url && item.url.trim().length > 0));
  }, [tvScreen?.playlist]);

  const playbackStopped = Boolean(tvScreen?.playbackStopped);
  const loopEnabled = tvScreen?.loop ?? true;
  const batBallBetweenAds = Boolean(tvScreen?.batBallBetweenAds);
  const batBallGapSec = Math.max(2, Math.min(60, Number(tvScreen?.batBallGapSec) || 5));

  const [mode, setMode] = useState<PlaybackMode>(() =>
    playlist.length > 0 && !playbackStopped ? 'ad' : 'idle'
  );
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [playNonceCounter, setPlayNonceCounter] = useState<number>(0);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(true);
  const hasUserUnmutedRef = useRef<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedIdsRef = useRef<Set<string>>(new Set());
  const pendingNextIdxRef = useRef<number>(0);
  const prevStopRef = useRef<boolean>(playbackStopped);
  const lastHandledPlayNowRef = useRef<string>('');

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // React to Admin "Stop" / "Resume" toggles
  useEffect(() => {
    const wasStopped = prevStopRef.current;
    prevStopRef.current = playbackStopped;

    if (playbackStopped) {
      clearTimers();
      setMode('idle');
      return;
    }

    if (wasStopped && !playbackStopped && playlist.length > 0) {
      failedIdsRef.current.clear();
      setCurrentIdx(0);
      setPlayNonceCounter((c) => c + 1);
      setMode('ad');
    }
  }, [playbackStopped, playlist.length, clearTimers]);

  // React to Admin "Play Now" / Dashboard Toggle selection on a specific item
  useEffect(() => {
    const itemId = (tvScreen?.playNowItemId || '').trim();
    const nonce = Number(tvScreen?.playNowNonce || 0);
    if (!itemId) return;

    const token = `${itemId}:${nonce}`;
    if (lastHandledPlayNowRef.current === token) return;

    const idx = playlist.findIndex((p) => p.id === itemId);
    if (idx >= 0 && !playbackStopped) {
      lastHandledPlayNowRef.current = token;
      clearTimers();
      failedIdsRef.current.clear();
      setCurrentIdx(idx);
      setPlayNonceCounter((c) => c + 1);
      setMode('ad');
    }
  }, [tvScreen?.playNowItemId, tvScreen?.playNowNonce, playlist, playbackStopped, clearTimers]);

  // Clear failed item cache whenever playlist items change so newly pasted/edited links always play
  const playlistSignature = useMemo(
    () => playlist.map((item) => `${item.id}:${item.mediaType}:${item.url}`).join('|'),
    [playlist]
  );

  useEffect(() => {
    failedIdsRef.current.clear();
  }, [playlistSignature]);

  // Sync when playlist transitions from empty -> populated or currentIdx goes out of range
  useEffect(() => {
    if (playbackStopped) return;
    if (playlist.length === 0) {
      clearTimers();
      setMode('idle');
      setCurrentIdx(0);
      return;
    }
    if (currentIdx >= playlist.length) {
      setCurrentIdx(0);
    }
    if (mode === 'idle' && failedIdsRef.current.size < playlist.length) {
      // Auto-start playback when items are added while active & not stopped
      if (tvScreen?.playNowItemId || playlist.length > 0) {
        setMode('ad');
      }
    }
  }, [playlist, playlistSignature, playbackStopped, currentIdx, mode, tvScreen?.playNowItemId, clearTimers]);

  const currentItem: TvPlaylistItem | null =
    mode === 'ad' && playlist.length > 0 ? playlist[currentIdx % playlist.length] || null : null;

  const advanceToNext = useCallback(
    (fromError = false) => {
      clearTimers();
      if (playbackStopped || playlist.length === 0) {
        setMode('idle');
        return;
      }

      if (failedIdsRef.current.size >= playlist.length) {
        setMode('idle');
        return;
      }

      // Find next non-failed item after currentIdx
      let nextIdx = -1;
      for (let i = currentIdx + 1; i < playlist.length; i++) {
        if (!failedIdsRef.current.has(playlist[i].id)) {
          nextIdx = i;
          break;
        }
      }

      if (nextIdx >= 0) {
        if (batBallBetweenAds && !fromError) {
          pendingNextIdxRef.current = nextIdx;
          setMode('gap');
        } else {
          setCurrentIdx(nextIdx);
          setPlayNonceCounter((c) => c + 1);
          setMode('ad');
        }
        return;
      }

      // End of playlist pass
      if (loopEnabled) {
        let firstValid = -1;
        for (let i = 0; i < playlist.length; i++) {
          if (!failedIdsRef.current.has(playlist[i].id)) {
            firstValid = i;
            break;
          }
        }
        if (firstValid < 0) {
          setMode('idle');
          return;
        }
        if (batBallBetweenAds && !fromError) {
          pendingNextIdxRef.current = firstValid;
          setMode('gap');
        } else {
          setCurrentIdx(firstValid);
          setPlayNonceCounter((c) => c + 1);
          setMode('ad');
        }
      } else {
        setMode('idle');
      }
    },
    [clearTimers, playbackStopped, playlist, currentIdx, batBallBetweenAds, loopEnabled]
  );

  const handleCurrentItemError = useCallback(() => {
    if (currentItem) {
      failedIdsRef.current.add(currentItem.id);
    }
    advanceToNext(true);
  }, [currentItem, advanceToNext]);

  // Ad / Recorded Media duration timer
  useEffect(() => {
    clearTimers();
    if (mode !== 'ad' || !currentItem || playbackStopped) return;

    // Keep user's explicit unmute preference across loops; otherwise start muted for autoplay compliance
    if (currentItem.mediaType === 'video') {
      setIsVideoMuted(!hasUserUnmutedRef.current);
    }

    // Validate YouTube item immediately
    if (currentItem.mediaType === 'youtube' && !extractYouTubeVideoId(currentItem.url)) {
      handleCurrentItemError();
      return;
    }

    // Keep pinned dashboard-selected URL or single live stream steady without periodic reload/rotation
    const isPinnedToggleStream = !loopEnabled && Boolean((tvScreen?.playNowItemId || '').trim());
    const isSingleSteadyStream =
      playlist.length === 1 &&
      loopEnabled &&
      !batBallBetweenAds &&
      (currentItem.mediaType === 'youtube' ||
        currentItem.mediaType === 'embed' ||
        currentItem.mediaType === 'news_feed');

    if (isPinnedToggleStream || isSingleSteadyStream) {
      return clearTimers;
    }

    const durationMs = Math.max(3, Math.min(600, Number(currentItem.durationSec) || 10)) * 1000;
    timerRef.current = setTimeout(() => {
      advanceToNext(false);
    }, durationMs);

    return clearTimers;
  }, [mode, currentItem, playNonceCounter, playbackStopped, playlist.length, loopEnabled, batBallBetweenAds, tvScreen?.playNowItemId, clearTimers, advanceToNext, handleCurrentItemError]);

  // Gap ("Bat-Ball between ads") timer
  useEffect(() => {
    if (mode !== 'gap' || playbackStopped) return;
    clearTimers();
    timerRef.current = setTimeout(() => {
      const targetIdx = pendingNextIdxRef.current < playlist.length ? pendingNextIdxRef.current : 0;
      setCurrentIdx(targetIdx);
      setPlayNonceCounter((c) => c + 1);
      setMode('ad');
    }, batBallGapSec * 1000);

    return clearTimers;
  }, [mode, batBallGapSec, playbackStopped, playlist.length, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const handleToggleHtml5Sound = () => {
    const nextMuted = !isVideoMuted;
    hasUserUnmutedRef.current = !nextMuted;
    setIsVideoMuted(nextMuted);
    const v = videoRef.current;
    if (v) {
      v.muted = nextMuted;
      if (!nextMuted) {
        v.volume = 1;
        v.play().catch(() => {});
      }
    }
  };

  const handleVideoLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v || !currentItem || currentItem.mediaType !== 'video' || playbackStopped) return;
    // If browser blocks unmuted autoplay after user unmuted, gracefully fall back to muted play
    if (!v.muted) {
      v.play().catch(() => {
        v.muted = true;
        hasUserUnmutedRef.current = false;
        setIsVideoMuted(true);
        v.play().catch(() => {});
      });
    }
    const isPinnedToggleStream = !loopEnabled && Boolean((tvScreen?.playNowItemId || '').trim());
    if (isPinnedToggleStream) return;
    const naturalSec = Number(v.duration);
    const configuredSec = Math.max(3, Math.min(600, Number(currentItem.durationSec) || 10));
    if (Number.isFinite(naturalSec) && naturalSec > configuredSec) {
      const safeCapSec = Math.min(600, Math.ceil(naturalSec) + 2);
      clearTimers();
      timerRef.current = setTimeout(() => {
        advanceToNext(false);
      }, safeCapSec * 1000);
    }
  };

  const sponsorName = (tvScreen?.sponsorName || '').trim();
  const sponsorLink = sanitizeHttpLink(tvScreen?.sponsorLink);
  const showingAd = mode === 'ad' && Boolean(currentItem) && !playbackStopped;
  const isNewsChannel = isLiveNewsChannelItem(currentItem);

  useEffect(() => {
    onAdPlaybackChange?.(showingAd && !isNewsChannel);
  }, [showingAd, isNewsChannel, onAdPlaybackChange]);

  useEffect(() => {
    return () => {
      onAdPlaybackChange?.(false);
    };
  }, [onAdPlaybackChange]);

  const frameBody = (
    <div
      className={`w-full ${
        embedded
          ? 'flex flex-col justify-between'
          : `${isObs ? 'max-w-md' : isMobile ? 'max-w-[360px]' : 'max-w-[1440px]'} mx-auto flex flex-col items-center`
      }`}
    >
      {/* TV Screen Outer Bezel with Subtle Studio Glow */}
      <div
        className={`relative w-full ${
          embedded ? 'flex flex-col rounded-2xl p-[5px]' : 'rounded-2xl sm:rounded-3xl p-[5px] sm:p-[8px]'
        } bg-gradient-to-b from-[#161e2e] via-[#070b14] to-[#03050a] border border-white/15 shadow-[0_0_52px_rgba(56,189,248,0.18),0_22px_54px_rgba(0,0,0,0.88)]`}
      >
        {/* Inner Display Panel */}
        <div
          className={`relative w-full overflow-hidden rounded-xl sm:rounded-2xl bg-[#040916] border border-white/10 ${
            embedded
              ? 'w-full aspect-video min-h-[280px] sm:min-h-[400px] lg:min-h-[500px] xl:min-h-[570px] flex items-center justify-center'
              : showingAd
              ? isMobile
                ? 'aspect-video min-h-[220px]'
                : isObs
                ? 'aspect-video max-h-[340px]'
                : 'aspect-video min-h-[320px] sm:min-h-[460px] lg:min-h-[620px]'
              : isMobile
              ? 'min-h-[220px] aspect-video flex items-center justify-center'
              : 'min-h-[320px] sm:min-h-[460px] lg:min-h-[580px] aspect-video flex items-center justify-center'
          }`}
        >
          {showingAd && currentItem ? (
            <div
              key={`${currentItem.id}_${playNonceCounter}`}
              className="absolute inset-0 w-full h-full bg-black flex items-center justify-center"
            >
              {isNewsChannel ? (
                <div className="pointer-events-auto w-full h-full">
                  <LiveSportsNewsChannel
                    compact={embedded || isMobile}
                    auto-scroll={isObs ? 'slow' : 'normal'}
                  />
                </div>
              ) : (
                <>
                  {currentItem.mediaType === 'image' && (
                    <img
                      src={resolveMediaUrl(currentItem.url)}
                      alt={currentItem.title || 'Sponsored Broadcast'}
                      className="w-full h-full object-contain bg-black"
                      referrerPolicy="no-referrer"
                      onError={handleCurrentItemError}
                    />
                  )}

                  {currentItem.mediaType === 'video' && (
                    <>
                      <video
                        ref={videoRef}
                        src={resolveMediaUrl(currentItem.url)}
                        autoPlay
                        loop={!loopEnabled && Boolean((tvScreen?.playNowItemId || '').trim())}
                        muted={isVideoMuted}
                        playsInline
                        preload="auto"
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onEnded={() => {
                          if (!loopEnabled && Boolean((tvScreen?.playNowItemId || '').trim())) return;
                          advanceToNext(false);
                        }}
                        onError={handleCurrentItemError}
                        className="w-full h-full object-contain bg-black"
                      />
                      <button
                        type="button"
                        onClick={handleToggleHtml5Sound}
                        aria-label={isVideoMuted ? 'Sound ON karein' : 'Sound Mute karein'}
                        className="pointer-events-auto absolute bottom-2.5 right-2.5 z-20 min-h-[44px] px-3.5 rounded-full bg-black/75 hover:bg-black/90 active:scale-95 backdrop-blur-md border border-white/25 text-white font-score font-bold text-xs flex items-center gap-1.5 shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                      >
                        {isVideoMuted ? (
                          <>
                            <VolumeX className="w-4 h-4 text-amber-300" />
                            <span>Sound ON</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-4 h-4 text-emerald-400" />
                            <span>Muted</span>
                          </>
                        )}
                      </button>
                    </>
                  )}

                  {currentItem.mediaType === 'youtube' && (
                    <div className="pointer-events-auto w-full h-full">
                      <HoldYouTubePlayer
                        videoUrls={[currentItem.url]}
                        loop={false}
                        autoAdvanceOnEnd={false}
                        onVideoEnded={() => advanceToNext(false)}
                        onFallback={handleCurrentItemError}
                        fillContainer
                        compact={isMobile}
                      />
                    </div>
                  )}

                  {currentItem.mediaType === 'embed' && (() => {
                    const safeEmbedUrl = resolveSafeEmbedUrl(currentItem.url);
                    if (!safeEmbedUrl) return null;
                    return (
                      <iframe
                        src={safeEmbedUrl}
                        title={currentItem.title || 'Live Match Stream'}
                        className="pointer-events-auto w-full h-full border-0 bg-black"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    );
                  })()}
                </>
              )}

              {/* Playlist Indicator Badge */}
              {!isNewsChannel && playlist.length > 1 && (
                <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 font-score text-[11px] font-bold text-slate-100">
                  {currentIdx + 1} / {playlist.length}
                </div>
              )}

              {/* Subtle Title Overlay when provided */}
              {!isNewsChannel && currentItem.title?.trim() && (
                <div className="pointer-events-none absolute bottom-2.5 left-2.5 z-10 max-w-[65%] px-2.5 py-1 rounded-lg bg-black/65 backdrop-blur-md border border-white/10 text-[11px] font-bold text-slate-100 truncate">
                  {currentItem.title.trim()}
                </div>
              )}
            </div>
          ) : (
            <NoMatchAnimation
              compact={isMobile || embedded}
              forceDarkPanel
              title={hasLiveMatch ? 'Broadcast TV Standby' : 'No Live Match Right Now'}
              subtitle={
                hasLiveMatch
                  ? 'Agla ad ya live update chalne wala hai'
                  : 'Aane wale match ka intezar karein'
              }
              nextMatch={nextMatch}
            />
          )}
        </div>

        {/* Bottom TV Bezel Indicator, Channel Quick-Switch & Optional Sponsor Row */}
        <div className="mt-1.5 px-2 flex items-center justify-between gap-2 min-h-[18px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  showingAd ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-sky-400 shadow-[0_0_6px_#38bdf8]'
                }`}
              />
              <span className="font-score text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {showingAd ? 'ON AIR' : 'STANDBY'}
              </span>
            </div>

            {!isObs && playlist.length > 0 && !playbackStopped && (
              <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto">
                {playlist.slice(0, 4).map((slotItem, idx) => {
                  const isActiveCh = mode === 'ad' && currentIdx % playlist.length === idx;
                  const shortTitle = (slotItem.title || '').trim();
                  return (
                    <button
                      key={slotItem.id}
                      type="button"
                      onClick={() => {
                        clearTimers();
                        failedIdsRef.current.clear();
                        setCurrentIdx(idx);
                        setPlayNonceCounter((c) => c + 1);
                        setMode('ad');
                      }}
                      title={shortTitle || `Playback URL ${idx + 1}`}
                      className={`px-2 py-0.5 rounded text-[10px] font-score font-bold tracking-wide border transition-colors max-w-[130px] truncate ${
                        isActiveCh
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                          : 'bg-slate-900/90 hover:bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {shortTitle ? `${idx + 1} • ${shortTitle}` : `URL ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {sponsorName && (
            <div className="min-w-0">
              {sponsorLink ? (
                <a
                  href={sponsorLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 truncate"
                >
                  <span className="truncate">Sponsored by {sponsorName}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              ) : (
                <span className="text-[11px] font-bold text-amber-300 truncate block">
                  Sponsored by {sponsorName}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sleek Minimal TV Stand Neck & Base */}
      {!isObs && !embedded && (
        <div aria-hidden="true" className="flex flex-col items-center pointer-events-none">
          <div className="w-16 sm:w-20 h-3 sm:h-4 bg-gradient-to-b from-[#0b101b] to-[#111827] border-x border-white/10" />
          <div className="w-36 sm:w-48 h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-transparent via-slate-600/70 to-transparent shadow-[0_4px_14px_rgba(56,189,248,0.2)]" />
        </div>
      )}
    </div>
  );

  if (isObs) {
    return (
      <div className="w-full min-h-screen bg-transparent flex items-center justify-center p-4 pointer-events-none select-none">
        {frameBody}
      </div>
    );
  }

  if (embedded) {
    return <div className="w-full h-full flex flex-col">{frameBody}</div>;
  }

  return <div className="w-full flex items-center justify-center px-1">{frameBody}</div>;
};
