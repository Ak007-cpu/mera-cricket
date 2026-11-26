import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
    __ytApiLoadingPromise?: Promise<any>;
  }
}

export function extractYouTubeVideoId(rawUrl: string): string | null {
  const input = (rawUrl || '').trim();
  if (!input) return null;

  // Bare 11-character YouTube ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }

  // Extract first http(s) URL if user pasted mobile share text like "Watch Live https://youtu.be/..."
  const embeddedUrlMatch = input.match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = embeddedUrlMatch ? embeddedUrlMatch[0].replace(/[),.;!?]+$/, '') : input;

  try {
    const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    const url = new URL(normalized);
    const host = url.hostname.replace(/^(www\.|m\.|music\.)/i, '').toLowerCase();

    if (host === 'youtu.be') {
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[0] === 'shorts' || parts[0] === 'live' ? parts[1] : parts[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube-nocookie.com')
    ) {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      // Handle attribution_link ?u=/watch?v=...
      const uParam = url.searchParams.get('u');
      if (uParam) {
        const nestedMatch = decodeURIComponent(uParam).match(
          /(?:v=|\/shorts\/|\/live\/|\/embed\/)([a-zA-Z0-9_-]{11})/
        );
        if (nestedMatch?.[1]) return nestedMatch[1];
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const markerIdx = parts.findIndex((p) =>
        ['embed', 'shorts', 'live', 'v'].includes(p.toLowerCase())
      );
      if (markerIdx >= 0 && parts[markerIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[markerIdx + 1])) {
        return parts[markerIdx + 1];
      }
    }
  } catch {
    // Regex fallback
    const match = candidate.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function isYouTubeChannelLiveUrl(rawUrl: string): boolean {
  const input = (rawUrl || '').trim();
  return /(?:youtube\.com\/(?:@[^/\s]+|c\/[^/\s]+|channel\/[^/\s]+|user\/[^/\s]+)\/live)\b/i.test(input);
}

function loadYouTubeIframeApi(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (window.__ytApiLoadingPromise) {
    return window.__ytApiLoadingPromise;
  }

  window.__ytApiLoadingPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('YouTube IFrame API load timeout'));
    }, 8000);

    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      if (typeof prevCallback === 'function') {
        try {
          prevCallback();
        } catch {}
      }
      resolve(window.YT);
    };

    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => {
        clearTimeout(timeout);
        window.__ytApiLoadingPromise = undefined;
        reject(new Error('Failed to load YouTube IFrame API'));
      };
      document.head.appendChild(tag);
    }
  });

  return window.__ytApiLoadingPromise;
}

interface HoldYouTubePlayerProps {
  videoUrls: string[];
  loop: boolean;
  onFallback: () => void;
  compact?: boolean;
  fillContainer?: boolean;
  autoAdvanceOnEnd?: boolean;
  onVideoEnded?: () => void;
}

export const HoldYouTubePlayer: React.FC<HoldYouTubePlayerProps> = ({
  videoUrls,
  loop,
  onFallback,
  compact = false,
  fillContainer = false,
  autoAdvanceOnEnd = true,
  onVideoEnded
}) => {
  const videoIds = useMemo(
    () =>
      (videoUrls || [])
        .map(extractYouTubeVideoId)
        .filter((id): id is string => Boolean(id)),
    [videoUrls]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const currentIdxRef = useRef(0);
  const failedCountRef = useRef(0);
  const loopRef = useRef(loop);
  const onFallbackRef = useRef(onFallback);
  const autoAdvanceRef = useRef(autoAdvanceOnEnd);
  const onVideoEndedRef = useRef(onVideoEnded);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [useDirectIframe, setUseDirectIframe] = useState(false);

  loopRef.current = loop;
  onFallbackRef.current = onFallback;
  autoAdvanceRef.current = autoAdvanceOnEnd;
  onVideoEndedRef.current = onVideoEnded;

  const playlistKey = videoIds.join(',');

  useEffect(() => {
    if (videoIds.length === 0) {
      onFallbackRef.current();
      return;
    }

    let cancelled = false;
    currentIdxRef.current = 0;
    failedCountRef.current = 0;
    setCurrentIdx(0);
    setIsMuted(true);
    setIsReady(false);
    setUseDirectIframe(false);

    const mountPlayer = async () => {
      try {
        const YT = await loadYouTubeIframeApi();
        if (cancelled || !containerRef.current) return;

        // Destroy previous instance cleanly
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          try {
            playerRef.current.destroy();
          } catch {}
          playerRef.current = null;
        }

        const mountEl = document.createElement('div');
        mountEl.className = 'w-full h-full';
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(mountEl);

        playerRef.current = new YT.Player(mountEl, {
          width: '100%',
          height: '100%',
          videoId: videoIds[0],
          playerVars: {
            autoplay: 1,
            mute: 1,
            playsinline: 1,
            controls: fillContainer ? 1 : 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            enablejsapi: 1,
            origin: typeof window !== 'undefined' ? window.location.origin : undefined
          },
          events: {
            onReady: (ev: any) => {
              if (cancelled) return;
              setIsReady(true);
              try {
                ev.target.mute();
                ev.target.playVideo();
              } catch {}
            },
            onStateChange: (ev: any) => {
              if (cancelled) return;
              // Playing resets consecutive error count
              if (ev.data === YT.PlayerState.PLAYING) {
                failedCountRef.current = 0;
              }
              // Video ended -> notify parent or play next in playlist or loop or fall back cleanly
              if (ev.data === YT.PlayerState.ENDED) {
                if (onVideoEndedRef.current) {
                  onVideoEndedRef.current();
                  return;
                }
                if (!autoAdvanceRef.current) {
                  return;
                }
                const nextIdx = currentIdxRef.current + 1;
                if (nextIdx < videoIds.length) {
                  currentIdxRef.current = nextIdx;
                  setCurrentIdx(nextIdx);
                  ev.target.loadVideoById(videoIds[nextIdx]);
                } else if (loopRef.current) {
                  currentIdxRef.current = 0;
                  setCurrentIdx(0);
                  ev.target.loadVideoById(videoIds[0]);
                } else {
                  onFallbackRef.current();
                }
              }
            },
            onError: (ev: any) => {
              if (cancelled) return;
              const errCode = Number(ev?.data);
              failedCountRef.current += 1;
              if (failedCountRef.current >= videoIds.length) {
                // On single/live TV playback or JS API config errors (e.g., 153/150/101/5),
                // switch to direct responsive embed iframe rather than hiding the live TV screen.
                if (fillContainer || (errCode !== 100 && errCode !== 2)) {
                  try {
                    if (playerRef.current && typeof playerRef.current.destroy === 'function') {
                      playerRef.current.destroy();
                    }
                  } catch {}
                  playerRef.current = null;
                  setUseDirectIframe(true);
                  setIsReady(true);
                  return;
                }
                onFallbackRef.current();
                return;
              }
              const nextIdx = (currentIdxRef.current + 1) % videoIds.length;
              currentIdxRef.current = nextIdx;
              setCurrentIdx(nextIdx);
              try {
                ev.target.loadVideoById(videoIds[nextIdx]);
              } catch {
                setUseDirectIframe(true);
                setIsReady(true);
              }
            }
          }
        });
      } catch {
        // If YouTube JS IFrame API is blocked/timed out, render direct responsive embed iframe
        if (!cancelled) {
          setUseDirectIframe(true);
          setIsReady(true);
        }
      }
    };

    mountPlayer();

    return () => {
      cancelled = true;
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [playlistKey]);

  const handleToggleSound = () => {
    if (useDirectIframe) {
      setIsMuted((prev) => !prev);
      return;
    }
    const p = playerRef.current;
    if (!p) return;
    try {
      if (isMuted) {
        p.unMute();
        p.setVolume(100);
        p.playVideo();
        setIsMuted(false);
      } else {
        p.mute();
        setIsMuted(true);
      }
    } catch {}
  };

  if (videoIds.length === 0) {
    return null;
  }

  const activeVideoId = videoIds[currentIdx] || videoIds[0];

  return (
    <div
      className={
        fillContainer
          ? 'relative w-full h-full min-h-full overflow-hidden bg-black'
          : `relative w-full ${
              compact ? 'max-w-[360px]' : 'max-w-5xl'
            } aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-white/15 shadow-[0_16px_44px_rgba(0,0,0,0.65)]`
      }
    >
      {/* YouTube Official IFrame Mount Target or Direct IFrame Fallback */}
      {useDirectIframe ? (
        <iframe
          key={`${activeVideoId}_${isMuted ? 'm' : 'u'}`}
          src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1&mute=${isMuted ? 1 : 0}&playsinline=1&controls=${fillContainer ? 1 : 0}&rel=0&modestbranding=1${loop ? `&loop=1&playlist=${activeVideoId}` : ''}`}
          title="YouTube Broadcast Player"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="block w-full h-full border-0"
        />
      ) : (
        <div ref={containerRef} className="w-full h-full [&_iframe]:block [&_iframe]:w-full [&_iframe]:h-full" />
      )}

      {/* Subtle Loading Shimmer until YT Ready */}
      {!isReady && !useDirectIframe && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060d1f] text-xs font-score text-slate-300">
          Loading video...
        </div>
      )}

      {/* Multi-Video Playlist Counter */}
      {videoIds.length > 1 && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/15 font-score text-[11px] font-bold text-slate-100">
          {currentIdx + 1} / {videoIds.length}
        </div>
      )}

      {/* Touch-Friendly Sound Unmute / Mute Button */}
      <button
        type="button"
        onClick={handleToggleSound}
        aria-label={isMuted ? 'Sound ON karein' : 'Sound Mute karein'}
        className="absolute bottom-2.5 right-2.5 z-20 min-h-[44px] px-3.5 rounded-full bg-black/75 hover:bg-black/90 active:scale-95 backdrop-blur-md border border-white/25 text-white font-score font-bold text-xs flex items-center gap-1.5 shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {isMuted ? (
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
    </div>
  );
};
