import React, { useState, useEffect, useMemo } from 'react';
import { AiNewsStudioState, MatchState, MonetizationConfig } from '../../types/cricket';
import { fetchActiveMatch, fetchMonetizationConfig, fetchAiNewsStudioState, buildApiUrl } from '../../services/api';
import { useContent } from '../../context/ContentContext';
import { useAutoBallAnimation } from '../../hooks/useAutoBallAnimation';
import { useCricketAudio } from '../../hooks/useCricketAudio';
import { useSecretAdminGesture } from '../../hooks/useSecretAdminGesture';
import { AutoBallAnimationOverlay } from './AutoBallAnimationOverlay';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { TargetChasePanel } from './TargetChasePanel';
import { LiveAnimatedMatchCard } from './LiveAnimatedMatchCard';
import { BroadcastCricketNewsSection } from './BroadcastCricketNewsSection';
import { AdSlot } from './AdSlot';
import { SponsorBanner } from './SponsorBanner';
import { SocialShareBar } from './SocialShareBar';
import { MatchTicker } from './MatchTicker';
import { ScrollingNewsTicker } from './ScrollingNewsTicker';
import { MatchSummaryModal, detectSummaryPhase } from './MatchSummaryModal';
import { AppDownloadButton } from './AppDownloadButton';
import { SixProCricketBanner } from './SixProCricketBanner';
import { HoldScreenView } from '../Common/HoldScreenView';
import { TvScreenView } from '../Common/TvScreenView';
import { AiNewsStudioTV } from './AiNewsStudioTV';
import { AudioSoundWave } from './AudioSoundWave';
import { BroadcastScorecardDrawer } from './BroadcastScorecardDrawer';
import { LegalPageType } from '../Legal/LegalPages';
import { useTheme } from '../../context/ThemeContext';
import { ThemeToggleButton } from '../Common/ThemeToggleButton';
import { Trophy, Crown, Sparkles, PartyPopper, Award, Newspaper, BookOpen, Volume2, VolumeX, Mic, MicOff, ClipboardList, Smartphone } from 'lucide-react';

export type YouTubeUrlFormat =
  | 'watch'
  | 'short'
  | 'shorts'
  | 'live'
  | 'embed'
  | 'v'
  | 'attribution'
  | 'id'
  | 'invalid';

export interface ParsedYouTubeUrlResult {
  embedUrl: string | null;
  videoId: string | null;
  format: YouTubeUrlFormat;
  reason?: string;
}

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Robust YouTube URL parser for BroadcastView:
 * Converts watch, short (youtu.be), shorts, live, embed, v, attribution, and bare ID formats
 * into canonical `https://www.youtube.com/embed/<VIDEO_ID>` URLs and logs malformed inputs.
 */
export function parseYouTubeEmbedUrl(
  rawUrl: string,
  context = 'BroadcastView'
): ParsedYouTubeUrlResult {
  if (typeof rawUrl !== 'string') {
    console.warn(`[BroadcastView] Malformed YouTube URL (${context}): non-string input`, { rawUrl });
    return { embedUrl: null, videoId: null, format: 'invalid', reason: 'Non-string URL input' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    console.warn(`[BroadcastView] Malformed YouTube URL (${context}): empty input`);
    return { embedUrl: null, videoId: null, format: 'invalid', reason: 'Empty URL input' };
  }

  if (/^(javascript|vbscript|data):/i.test(trimmed)) {
    console.warn(`[BroadcastView] Blocked unsafe URL scheme (${context}):`, { rawUrl: trimmed });
    return { embedUrl: null, videoId: null, format: 'invalid', reason: 'Unsafe URL scheme' };
  }

  if (YOUTUBE_VIDEO_ID_RE.test(trimmed)) {
    return {
      embedUrl: `https://www.youtube.com/embed/${trimmed}`,
      videoId: trimmed,
      format: 'id'
    };
  }

  // Extract first http(s) URL if mobile share text surrounds the link
  const embeddedMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = embeddedMatch ? embeddedMatch[0].replace(/[),.;!?]+$/, '') : trimmed;
  const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch (err) {
    const regexMatch = candidate.match(
      /(?:youtube\.com|youtu\.be|youtube-nocookie\.com).{0,80}?(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([a-zA-Z0-9_-]{11})/i
    );
    if (regexMatch?.[1] && YOUTUBE_VIDEO_ID_RE.test(regexMatch[1])) {
      const videoId = regexMatch[1];
      return {
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        videoId,
        format: 'watch'
      };
    }
    console.warn(`[BroadcastView] Malformed YouTube URL parse failure (${context}):`, {
      rawUrl: trimmed,
      error: err instanceof Error ? err.message : String(err)
    });
    return { embedUrl: null, videoId: null, format: 'invalid', reason: 'URL parse failure' };
  }

  const host = parsed.hostname.replace(/^(www\.|m\.|music\.)/i, '').toLowerCase();
  const isYouTubeHost =
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtube-nocookie.com' ||
    host.endsWith('.youtube-nocookie.com');

  if (!isYouTubeHost) {
    console.warn(`[BroadcastView] Malformed or non-YouTube host (${context}):`, {
      rawUrl: trimmed,
      hostname: parsed.hostname
    });
    return { embedUrl: null, videoId: null, format: 'invalid', reason: 'Not a YouTube hostname' };
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  let videoId: string | null = null;
  let format: YouTubeUrlFormat = 'invalid';

  if (host === 'youtu.be') {
    const candidateId =
      parts[0] === 'shorts' || parts[0] === 'live' ? parts[1] : parts[0];
    if (candidateId && YOUTUBE_VIDEO_ID_RE.test(candidateId)) {
      videoId = candidateId;
      format = parts[0] === 'shorts' ? 'shorts' : parts[0] === 'live' ? 'live' : 'short';
    }
  } else {
    const vParam = parsed.searchParams.get('v');
    if (vParam && YOUTUBE_VIDEO_ID_RE.test(vParam)) {
      videoId = vParam;
      format = 'watch';
    }

    if (!videoId) {
      const uParam = parsed.searchParams.get('u');
      if (uParam) {
        try {
          const decodedU = decodeURIComponent(uParam);
          const nestedMatch = decodedU.match(
            /(?:[?&]v=|\/shorts\/|\/live\/|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/
          );
          if (nestedMatch?.[1] && YOUTUBE_VIDEO_ID_RE.test(nestedMatch[1])) {
            videoId = nestedMatch[1];
            format = 'attribution';
          }
        } catch (decodeErr) {
          console.warn(`[BroadcastView] Failed to decode YouTube attribution param (${context}):`, {
            rawUrl: trimmed,
            error: decodeErr instanceof Error ? decodeErr.message : String(decodeErr)
          });
        }
      }
    }

    if (!videoId) {
      const markerIdx = parts.findIndex((p) =>
        ['embed', 'shorts', 'live', 'v'].includes(p.toLowerCase())
      );
      if (markerIdx >= 0 && parts[markerIdx + 1] && YOUTUBE_VIDEO_ID_RE.test(parts[markerIdx + 1])) {
        videoId = parts[markerIdx + 1];
        const marker = parts[markerIdx].toLowerCase();
        format =
          marker === 'embed'
            ? 'embed'
            : marker === 'shorts'
            ? 'shorts'
            : marker === 'live'
            ? 'live'
            : 'v';
      }
    }
  }

  if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId)) {
    const isChannelLive = /\/(?:@[^/]+|c\/[^/]+|channel\/[^/]+|user\/[^/]+)\/live$/i.test(
      parsed.pathname
    );
    const reason = isChannelLive
      ? 'Channel /live URL lacks a direct 11-character video ID for embedding'
      : 'Missing or invalid 11-character YouTube video ID';
    console.warn(`[BroadcastView] Malformed YouTube URL (${context}): ${reason}`, {
      rawUrl: trimmed,
      pathname: parsed.pathname,
      search: parsed.search
    });
    return { embedUrl: null, videoId: null, format: 'invalid', reason };
  }

  return {
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    videoId,
    format
  };
}

interface TeamVisualTheme {
  accentHex: string;
  accentTextHex: string;
  accentLightTextHex: string;
  accentSoftRgba: string;
  accentBorderRgba: string;
  accentGlowRgba: string;
  ambientGlowRgba: string;
  secondaryHex: string;
}

function hexToRgbTuple(hex?: string): [number, number, number] | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return [
    parseInt(cleaned.slice(0, 2), 16),
    parseInt(cleaned.slice(2, 4), 16),
    parseInt(cleaned.slice(4, 6), 16)
  ];
}

function getTeamVisualTheme(
  teamCode?: string,
  teamName?: string,
  fallbackPrimary?: string,
  fallbackSecondary?: string
): TeamVisualTheme {
  const key = `${teamCode || ''} ${teamName || ''}`.trim().toUpperCase();

  if (/\bPAK\b|PAKISTAN/.test(key)) {
    return {
      accentHex: '#10b981',
      accentTextHex: '#6ee7b7',
      accentLightTextHex: '#047857',
      accentSoftRgba: 'rgba(16, 185, 129, 0.22)',
      accentBorderRgba: 'rgba(52, 211, 153, 0.65)',
      accentGlowRgba: 'rgba(16, 185, 129, 0.28)',
      ambientGlowRgba: 'rgba(16, 185, 129, 0.14)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\bSL\b|SRI\s*LANKA/.test(key)) {
    return {
      accentHex: '#3b82f6',
      accentTextHex: '#93c5fd',
      accentLightTextHex: '#1d4ed8',
      accentSoftRgba: 'rgba(37, 99, 235, 0.24)',
      accentBorderRgba: 'rgba(96, 165, 250, 0.65)',
      accentGlowRgba: 'rgba(250, 204, 21, 0.24)',
      ambientGlowRgba: 'rgba(59, 130, 246, 0.15)',
      secondaryHex: '#facc15'
    };
  }
  if (/\bIND\b|\bINDIA\b/.test(key)) {
    return {
      accentHex: '#0ea5e9',
      accentTextHex: '#7dd3fc',
      accentLightTextHex: '#0369a1',
      accentSoftRgba: 'rgba(14, 165, 233, 0.22)',
      accentBorderRgba: 'rgba(56, 189, 248, 0.65)',
      accentGlowRgba: 'rgba(14, 165, 233, 0.28)',
      ambientGlowRgba: 'rgba(14, 165, 233, 0.15)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\bAUS\b|AUSTRALIA/.test(key)) {
    return {
      accentHex: '#eab308',
      accentTextHex: '#fde047',
      accentLightTextHex: '#a16207',
      accentSoftRgba: 'rgba(234, 179, 8, 0.20)',
      accentBorderRgba: 'rgba(250, 204, 21, 0.65)',
      accentGlowRgba: 'rgba(234, 179, 8, 0.26)',
      ambientGlowRgba: 'rgba(234, 179, 8, 0.13)',
      secondaryHex: '#10b981'
    };
  }
  if (/\bENG\b|ENGLAND/.test(key)) {
    return {
      accentHex: '#2563eb',
      accentTextHex: '#93c5fd',
      accentLightTextHex: '#1d4ed8',
      accentSoftRgba: 'rgba(37, 99, 235, 0.24)',
      accentBorderRgba: 'rgba(96, 165, 250, 0.60)',
      accentGlowRgba: 'rgba(37, 99, 235, 0.28)',
      ambientGlowRgba: 'rgba(37, 99, 235, 0.14)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\b(SA|RSA)\b|SOUTH\s*AFRICA/.test(key)) {
    return {
      accentHex: '#16a34a',
      accentTextHex: '#86efac',
      accentLightTextHex: '#15803d',
      accentSoftRgba: 'rgba(22, 163, 74, 0.22)',
      accentBorderRgba: 'rgba(74, 222, 128, 0.60)',
      accentGlowRgba: 'rgba(22, 163, 74, 0.26)',
      ambientGlowRgba: 'rgba(22, 163, 74, 0.13)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\bWI\b|WEST\s*INDIES/.test(key)) {
    return {
      accentHex: '#e11d48',
      accentTextHex: '#fda4af',
      accentLightTextHex: '#be123c',
      accentSoftRgba: 'rgba(225, 29, 72, 0.22)',
      accentBorderRgba: 'rgba(251, 113, 133, 0.60)',
      accentGlowRgba: 'rgba(225, 29, 72, 0.26)',
      ambientGlowRgba: 'rgba(225, 29, 72, 0.13)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\bBAN\b|BANGLADESH/.test(key)) {
    return {
      accentHex: '#059669',
      accentTextHex: '#6ee7b7',
      accentLightTextHex: '#047857',
      accentSoftRgba: 'rgba(5, 150, 105, 0.22)',
      accentBorderRgba: 'rgba(52, 211, 153, 0.60)',
      accentGlowRgba: 'rgba(5, 150, 105, 0.26)',
      ambientGlowRgba: 'rgba(5, 150, 105, 0.13)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\bNZ\b|NEW\s*ZEALAND/.test(key)) {
    return {
      accentHex: '#cbd5e1',
      accentTextHex: '#f1f5f9',
      accentLightTextHex: '#334155',
      accentSoftRgba: 'rgba(148, 163, 184, 0.18)',
      accentBorderRgba: 'rgba(203, 213, 225, 0.55)',
      accentGlowRgba: 'rgba(203, 213, 225, 0.20)',
      ambientGlowRgba: 'rgba(148, 163, 184, 0.12)',
      secondaryHex: '#fbbf24'
    };
  }
  if (/\bAFG\b|AFGHANISTAN/.test(key)) {
    return {
      accentHex: '#3b82f6',
      accentTextHex: '#93c5fd',
      accentLightTextHex: '#1d4ed8',
      accentSoftRgba: 'rgba(59, 130, 246, 0.22)',
      accentBorderRgba: 'rgba(96, 165, 250, 0.60)',
      accentGlowRgba: 'rgba(59, 130, 246, 0.26)',
      ambientGlowRgba: 'rgba(59, 130, 246, 0.14)',
      secondaryHex: '#fbbf24'
    };
  }

  const rgb = hexToRgbTuple(fallbackPrimary);
  if (rgb) {
    const [r, g, b] = rgb;
    return {
      accentHex: fallbackPrimary!,
      accentTextHex: fallbackPrimary!,
      accentLightTextHex: `rgb(${Math.round(r * 0.58)}, ${Math.round(g * 0.58)}, ${Math.round(b * 0.58)})`,
      accentSoftRgba: `rgba(${r}, ${g}, ${b}, 0.20)`,
      accentBorderRgba: `rgba(${r}, ${g}, ${b}, 0.58)`,
      accentGlowRgba: `rgba(${r}, ${g}, ${b}, 0.24)`,
      ambientGlowRgba: `rgba(${r}, ${g}, ${b}, 0.13)`,
      secondaryHex: fallbackSecondary || '#fbbf24'
    };
  }

  return {
    accentHex: '#38bdf8',
    accentTextHex: '#7dd3fc',
    accentLightTextHex: '#0369a1',
    accentSoftRgba: 'rgba(56, 189, 248, 0.20)',
    accentBorderRgba: 'rgba(56, 189, 248, 0.55)',
    accentGlowRgba: 'rgba(56, 189, 248, 0.24)',
    ambientGlowRgba: 'rgba(56, 189, 248, 0.13)',
    secondaryHex: '#fbbf24'
  };
}

interface BroadcastViewProps {
  match?: MatchState | null;
  monetization?: MonetizationConfig | null;
  isLoading?: boolean;
  isDemoPreview?: boolean;
  ignoreHoldScreen?: boolean;
  hideAppDownload?: boolean;
  animationsEnabled?: boolean;
  testAudioEnabled?: boolean;
  onOpenLegalPage?: (page: LegalPageType) => void;
  onOpenNews?: () => void;
  onOpenBlog?: () => void;
  onSecretAdminTrigger?: () => void;
  onSwitchToMobile?: () => void;
}

export const BroadcastView: React.FC<BroadcastViewProps> = ({
  match: initialMatch,
  monetization: initialMonetization,
  isLoading: externalIsLoading,
  isDemoPreview = false,
  ignoreHoldScreen = false,
  hideAppDownload = false,
  animationsEnabled: animationsEnabledProp,
  testAudioEnabled = false,
  onOpenLegalPage,
  onOpenNews,
  onOpenBlog,
  onSecretAdminTrigger,
  onSwitchToMobile
}) => {
  const { isDark } = useTheme();
  const { breakingNews, applyContentOverridesToMatch, mergeMonetization } = useContent();
  const hasParentMatch = initialMatch !== undefined;
  const [liveMatch, setLiveMatch] = useState<MatchState | null>(initialMatch || null);
  const [monetization, setMonetization] = useState<MonetizationConfig | null>(initialMonetization || null);
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(externalIsLoading !== undefined ? externalIsLoading : !hasParentMatch);
  const [dismissedSummaryKey, setDismissedSummaryKey] = useState<string | null>(null);
  const [reopenedSummaryKey, setReopenedSummaryKey] = useState<string | null>(null);
  const [isTvAdPlaying, setIsTvAdPlaying] = useState<boolean>(false);
  const [isScorecardDrawerOpen, setIsScorecardDrawerOpen] = useState<boolean>(false);
  const [aiNewsState, setAiNewsState] = useState<AiNewsStudioState | null>(null);
  const aiNewsConfig = aiNewsState?.config || null;
  const secretGestureProps = useSecretAdminGesture(onSecretAdminTrigger, isDemoPreview);

  useEffect(() => {
    if (initialMonetization) {
      setMonetization(initialMonetization);
    }
  }, [initialMonetization]);

  useEffect(() => {
    if (hasParentMatch) {
      setLiveMatch(initialMatch || null);
      if (externalIsLoading === undefined) {
        setIsLoading(false);
      }
    }
  }, [hasParentMatch, initialMatch, externalIsLoading]);

  // Connect directly to centralized live match data source (skipped in Admin Demo Preview)
  useEffect(() => {
    if (isDemoPreview) {
      setIsLiveConnected(true);
      return;
    }

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchLatestMatch = async () => {
      try {
        const res = await fetchActiveMatch();
        setLiveMatch(res.data || null);
        setIsLiveConnected(true);
      } catch (err) {
        console.warn('Broadcast live fetch warning:', err);
        setIsLiveConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    if (!hasParentMatch) {
      fetchLatestMatch();
    }

    if (!initialMonetization) {
      fetchMonetizationConfig().then((cfg) => {
        if (cfg) setMonetization(cfg);
      });
    }

    if (hasParentMatch) {
      return;
    }

    try {
      const sseUrl = buildApiUrl('/api/match/stream');
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setIsLiveConnected(true);
      };

      eventSource.addEventListener('monetization', (event: MessageEvent) => {
        try {
          const parsedConfig = JSON.parse(event.data);
          if (parsedConfig && typeof parsedConfig === 'object') {
            setMonetization(parsedConfig);
          }
        } catch {}
      });

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.matchState !== undefined) {
            setLiveMatch(parsed.matchState || null);
            setIsLiveConnected(true);
            setIsLoading(false);
          }
        } catch (e) {
          console.warn('Broadcast SSE parse warning:', e);
        }
      };

      eventSource.onerror = () => {
        setIsLiveConnected(false);
        if (!pollInterval) {
          pollInterval = setInterval(fetchLatestMatch, 2500);
        }
      };
    } catch {
      pollInterval = setInterval(fetchLatestMatch, 2500);
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isDemoPreview, hasParentMatch, initialMonetization]);

  // Keep AI News Studio state synchronized for live/news mode switching & ScrollingNewsTicker
  useEffect(() => {
    if (isDemoPreview) return;
    let mounted = true;
    fetchAiNewsStudioState().then((st) => {
      if (mounted && st) setAiNewsState(st);
    });
    let es: EventSource | null = null;
    try {
      es = new EventSource(buildApiUrl('/api/match/stream?view=broadcast'));
      es.addEventListener('ai_news_studio', (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data) as AiNewsStudioState;
          if (mounted && parsed?.config) setAiNewsState(parsed);
        } catch {}
      });
    } catch {}
    return () => {
      mounted = false;
      if (es) {
        try {
          es.close();
        } catch {}
      }
    };
  }, [isDemoPreview]);

  const effectiveLoading = externalIsLoading !== undefined ? externalIsLoading : isLoading;

  const displayMatch = useMemo(
    () => applyContentOverridesToMatch(liveMatch),
    [liveMatch, applyContentOverridesToMatch]
  );

  const effectiveMonetization = useMemo(
    () => mergeMonetization(monetization),
    [monetization, mergeMonetization]
  );

  const effectiveAnimationsEnabled =
    animationsEnabledProp !== undefined
      ? animationsEnabledProp
      : effectiveMonetization?.broadcastSettings?.animationsEnabled ?? true;

  const rawHoldScreen = effectiveMonetization?.broadcastSettings?.holdScreen;
  const rawTvScreen = effectiveMonetization?.broadcastSettings?.tvScreen;

  // Normalize Hold Screen YouTube URLs into standard embed URLs before rendering HoldScreenView
  const holdScreen = useMemo(() => {
    if (!rawHoldScreen) return rawHoldScreen;
    const rawUrls = Array.isArray(rawHoldScreen.videoUrls) ? rawHoldScreen.videoUrls : [];
    const normalizedUrls = rawUrls
      .map((u, idx) => parseYouTubeEmbedUrl(u, `holdScreen.videoUrls[${idx}]`).embedUrl)
      .filter((u): u is string => Boolean(u));
    return {
      ...rawHoldScreen,
      videoUrls: normalizedUrls
    };
  }, [rawHoldScreen]);

  // Normalize TV Screen playlist YouTube/embed URLs into standard embed URLs before rendering TvScreenView
  const tvScreen = useMemo(() => {
    if (!rawTvScreen) return rawTvScreen;
    const rawPlaylist = Array.isArray(rawTvScreen.playlist) ? rawTvScreen.playlist : [];
    const normalizedPlaylist = rawPlaylist
      .map((item) => {
        if (!item || typeof item.url !== 'string') {
          console.warn('[BroadcastView] Skipping malformed TV playlist entry:', item);
          return null;
        }
        const trimmedUrl = item.url.trim();
        if (!trimmedUrl) {
          console.warn('[BroadcastView] Skipping empty TV playlist URL:', { id: item.id, title: item.title });
          return null;
        }
        const isYouTubeCandidate =
          item.mediaType === 'youtube' ||
          /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(trimmedUrl);

        if (isYouTubeCandidate) {
          const parsedYt = parseYouTubeEmbedUrl(trimmedUrl, `tvScreen.playlist[${item.id}]`);
          if (!parsedYt.embedUrl) {
            return null;
          }
          return {
            ...item,
            mediaType: 'youtube' as const,
            url: parsedYt.embedUrl
          };
        }

        if (item.mediaType === 'embed' && /^(javascript|vbscript|data):/i.test(trimmedUrl)) {
          console.warn('[BroadcastView] Blocked unsafe embed URL in tvScreen.playlist:', {
            id: item.id,
            url: trimmedUrl
          });
          return null;
        }

        return {
          ...item,
          url: trimmedUrl
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return {
      ...rawTvScreen,
      playlist: normalizedPlaylist
    };
  }, [rawTvScreen]);

  const tvFullScreenTakeover = Boolean(
    !ignoreHoldScreen && tvScreen?.enabled && tvScreen?.fullScreenTakeover
  );

  const { scoreAnimKey, activeBallEvent } = useAutoBallAnimation(
    displayMatch,
    effectiveAnimationsEnabled
  );

  const {
    isSoundOn,
    isMuted,
    isCrowdActive,
    adminSoundEnabled,
    effectsVolume,
    crowdVolume,
    prefersReducedMotion,
    femaleVoiceEnabled,
    isVoiceSpeaking,
    toggleViewerSound,
    toggleFemaleVoice,
    setEffectsVolume,
    setCrowdVolume
  } = useCricketAudio({
    mode: isDemoPreview ? 'test' : 'broadcast',
    match: displayMatch,
    activeBallEvent,
    soundSettings: effectiveMonetization?.broadcastSettings?.soundSettings,
    suppressForAdOrHold: Boolean(
      !displayMatch || (!ignoreHoldScreen && (holdScreen?.active || tvFullScreenTakeover || isTvAdPlaying))
    ),
    testAudioEnabled
  });

  const replayOrLiveAnimationsEnabled =
    effectiveAnimationsEnabled || Boolean(activeBallEvent?.isReplay);

  // Evaluation of Finalized Match Result & Winner (must run before early returns)
  const matchResultInfo = useMemo(() => {
    if (!displayMatch) return null;

    const { battingTeam, bowlingTeam } = displayMatch;
    const isFinalized =
      displayMatch.gameState === 'completed' ||
      Boolean(
        displayMatch.statusText &&
          /(won by|win by|won the|beat |defeated|champion|match tied|tied)/i.test(displayMatch.statusText)
      );

    if (!isFinalized) return null;

    const statusLower = (displayMatch.statusText || '').toLowerCase();
    const batTeamNameLower = (battingTeam.name || '').toLowerCase();
    const batTeamCodeLower = (battingTeam.code || '').toLowerCase();
    const batTeamShortLower = (battingTeam.shortName || '').toLowerCase();

    const bowlTeamNameLower = (bowlingTeam.name || '').toLowerCase();
    const bowlTeamCodeLower = (bowlingTeam.code || '').toLowerCase();
    const bowlTeamShortLower = (bowlingTeam.shortName || '').toLowerCase();

    const isTied = statusLower.includes('tied') || statusLower.includes('match tie');

    const batWins =
      !isTied &&
      (statusLower.includes(batTeamNameLower) ||
        (batTeamCodeLower && statusLower.includes(batTeamCodeLower)) ||
        (batTeamShortLower && statusLower.includes(batTeamShortLower)) ||
        Boolean(displayMatch.target && battingTeam.score.runs >= displayMatch.target));

    const bowlWins =
      !isTied &&
      !batWins &&
      (statusLower.includes(bowlTeamNameLower) ||
        (bowlTeamCodeLower && statusLower.includes(bowlTeamCodeLower)) ||
        (bowlTeamShortLower && statusLower.includes(bowlTeamShortLower)) ||
        Boolean(
          displayMatch.currentInnings === 2 &&
            displayMatch.target &&
            battingTeam.score.runs < displayMatch.target &&
            (battingTeam.score.wickets >= 10 || battingTeam.score.overs >= (displayMatch.dlsDetails?.revisedOvers || 20))
        ));

    let winnerTeam: 'batting' | 'bowling' | 'tie' = 'tie';
    if (batWins) winnerTeam = 'batting';
    else if (bowlWins) winnerTeam = 'bowling';
    else if (isTied) winnerTeam = 'tie';
    else {
      if (battingTeam.score.runs > bowlingTeam.score.runs) winnerTeam = 'batting';
      else if (bowlingTeam.score.runs > battingTeam.score.runs) winnerTeam = 'bowling';
    }

    const winningTeamData = winnerTeam === 'batting' ? battingTeam : winnerTeam === 'bowling' ? bowlingTeam : null;

    return {
      isFinalized: true,
      isTied,
      winnerTeam,
      winningTeamData,
      winnerText: displayMatch.statusText || (winnerTeam === 'batting' ? `${battingTeam.name} Won` : `${bowlingTeam.name} Won`)
    };
  }, [displayMatch]);

  if (effectiveLoading && !displayMatch) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-[#030712] flex flex-col justify-between text-slate-950 dark:text-white px-4 py-5 sm:px-8 sm:py-6">
        <div
          aria-hidden="true"
          {...secretGestureProps}
          className="fixed top-0 left-0 w-14 h-14 z-30"
        />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className={`absolute -top-1/3 -left-1/4 w-[140%] h-[90%] rounded-full blur-3xl ${
              effectiveAnimationsEnabled ? 'animate-broadcast-ambient' : 'opacity-60'
            }`}
            style={{
              background: isDark
                ? 'radial-gradient(ellipse at 35% 30%, rgba(56, 189, 248, 0.14) 0%, rgba(15, 23, 42, 0.22) 45%, transparent 72%)'
                : 'radial-gradient(ellipse at 35% 30%, rgba(14, 165, 233, 0.12) 0%, rgba(226, 232, 240, 0.32) 45%, transparent 72%)'
            }}
          />
        </div>
        {!isDemoPreview && (
          <header className="relative z-20 max-w-[1440px] mx-auto w-full flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-300 dark:border-slate-800/80 pb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse shrink-0" />
              <span className="font-score font-black text-sm tracking-wider uppercase text-slate-950 dark:text-white truncate">
                {effectiveMonetization?.siteName || 'Live Cricket HD'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ThemeToggleButton variant="broadcast" />
              {!hideAppDownload && (
                <AppDownloadButton
                  variant="compact"
                  config={effectiveMonetization?.broadcastSettings?.appDownload}
                  siteName={effectiveMonetization?.siteName}
                  onOpenMobileApp={onSwitchToMobile}
                />
              )}
              {onSwitchToMobile && (
                <button
                  type="button"
                  onClick={onSwitchToMobile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Mobile Mode</span>
                </button>
              )}
            </div>
          </header>
        )}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <div className="text-center space-y-5 max-w-md bg-white/95 dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl p-8 shadow-xl dark:shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-slate-900 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-300 dark:border-slate-700">
              <Trophy className="w-8 h-8 animate-pulse text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">Loading Live Broadcast</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Checking live match broadcast stream and latest scores.
            </p>
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-sm font-score text-slate-900 dark:text-slate-200">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-ping" />
              <span>CONNECTING TO BROADCAST...</span>
            </div>
          </div>
        </div>
        <footer className="relative z-10 max-w-[1440px] mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-300 dark:border-slate-800 pt-4">
          <span>{effectiveMonetization?.siteName || 'Live Cricket HD'} Broadcast</span>
          <nav className="flex items-center flex-wrap gap-4 font-medium text-slate-700 dark:text-slate-400">
            <a
              href="?page=news"
              onClick={(e) => {
                if (onOpenNews) {
                  e.preventDefault();
                  onOpenNews();
                }
              }}
              className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              News
            </a>
            <a
              href="?page=blog"
              onClick={(e) => {
                if (onOpenBlog) {
                  e.preventDefault();
                  onOpenBlog();
                }
              }}
              className="hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              Blog
            </a>
            <a
              href="?page=privacy"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('privacy');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="?page=terms"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('terms');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Terms
            </a>
            <a
              href="?page=contact"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('contact');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Contact
            </a>
          </nav>
        </footer>
      </div>
    );
  }

  // Admin-Controlled HOLD SCREEN overrides live scoreboard while background sync continues seamlessly
  if (!ignoreHoldScreen && holdScreen?.active) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-[#030712] flex flex-col justify-between text-slate-950 dark:text-white px-4 pt-5 pb-20 sm:px-8 sm:pt-6 sm:pb-24">
        <div
          aria-hidden="true"
          {...secretGestureProps}
          className="fixed top-0 left-0 w-14 h-14 z-30"
        />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className={`absolute -top-1/3 -left-1/4 w-[140%] h-[90%] rounded-full blur-3xl ${
              effectiveAnimationsEnabled ? 'animate-broadcast-ambient' : 'opacity-60'
            }`}
            style={{
              background: isDark
                ? 'radial-gradient(ellipse at 35% 30%, rgba(56, 189, 248, 0.14) 0%, rgba(15, 23, 42, 0.22) 45%, transparent 72%)'
                : 'radial-gradient(ellipse at 35% 30%, rgba(14, 165, 233, 0.12) 0%, rgba(226, 232, 240, 0.32) 45%, transparent 72%)'
            }}
          />
        </div>
        {!isDemoPreview && (
          <header className="relative z-20 max-w-[1440px] mx-auto w-full flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-300 dark:border-slate-800/80 pb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse shrink-0" />
              <span className="font-score font-black text-sm tracking-wider uppercase text-slate-950 dark:text-white truncate">
                {effectiveMonetization?.siteName || 'Live Cricket HD'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ThemeToggleButton variant="broadcast" />
              {!hideAppDownload && (
                <AppDownloadButton
                  variant="compact"
                  config={effectiveMonetization?.broadcastSettings?.appDownload}
                  siteName={effectiveMonetization?.siteName}
                  onOpenMobileApp={onSwitchToMobile}
                />
              )}
              {onSwitchToMobile && (
                <button
                  type="button"
                  onClick={onSwitchToMobile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Mobile Mode</span>
                </button>
              )}
            </div>
          </header>
        )}
        <div className="relative z-10 flex-1 flex items-center justify-center">
          <HoldScreenView
            holdScreen={holdScreen}
            nextMatch={effectiveMonetization?.broadcastSettings?.nextMatch}
            variant="broadcast"
          />
        </div>
        {!isDemoPreview && !hideAppDownload && (
          <>
            <SixProCricketBanner config={effectiveMonetization?.broadcastSettings?.sixProCricket} />
            <AppDownloadButton
              config={effectiveMonetization?.broadcastSettings?.appDownload}
              siteName={effectiveMonetization?.siteName}
              onOpenMobileApp={onSwitchToMobile}
            />
          </>
        )}
        <footer className="relative z-10 max-w-[1440px] mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-300 dark:border-slate-800 pt-4">
          <span>{effectiveMonetization?.siteName || 'Live Cricket HD'} Broadcast</span>
          <nav className="flex items-center flex-wrap gap-4 font-medium text-slate-700 dark:text-slate-400">
            <a
              href="?page=news"
              onClick={(e) => {
                if (onOpenNews) {
                  e.preventDefault();
                  onOpenNews();
                }
              }}
              className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              News
            </a>
            <a
              href="?page=blog"
              onClick={(e) => {
                if (onOpenBlog) {
                  e.preventDefault();
                  onOpenBlog();
                }
              }}
              className="hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              Blog
            </a>
            <a
              href="?page=privacy"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('privacy');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="?page=terms"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('terms');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Terms
            </a>
            <a
              href="?page=contact"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('contact');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Contact
            </a>
          </nav>
        </footer>
      </div>
    );
  }

  const hasLiveCricketMatch = Boolean(displayMatch && displayMatch.gameState !== 'scheduled');
  const aiNewsAutoSwitch = Boolean(
    (aiNewsConfig?.enabled ?? true) && (aiNewsConfig?.autoSwitchOnNoMatch ?? true)
  );
  const hasManualTvPlaylist = Boolean(
    tvScreen?.enabled && !tvScreen?.playbackStopped && (tvScreen?.playlist?.length || 0) > 0
  );

  if (
    !displayMatch ||
    (!hasLiveCricketMatch && aiNewsAutoSwitch && !hasManualTvPlaylist && !isDemoPreview) ||
    tvFullScreenTakeover
  ) {
    const showAiNewsStudio =
      !tvFullScreenTakeover && !hasLiveCricketMatch && aiNewsAutoSwitch && !hasManualTvPlaylist && !isDemoPreview;

    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-[#030712] flex flex-col justify-between text-slate-950 dark:text-white px-4 pt-4 pb-20 sm:px-6 sm:pt-5 sm:pb-24">
        <div
          aria-hidden="true"
          {...secretGestureProps}
          className="fixed top-0 left-0 w-14 h-14 z-30"
        />
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div
            className={`absolute -top-1/3 -left-1/4 w-[140%] h-[90%] rounded-full blur-3xl ${
              effectiveAnimationsEnabled ? 'animate-broadcast-ambient' : 'opacity-60'
            }`}
            style={{
              background: isDark
                ? 'radial-gradient(ellipse at 35% 30%, rgba(16, 185, 129, 0.14) 0%, rgba(15, 23, 42, 0.22) 45%, transparent 72%)'
                : 'radial-gradient(ellipse at 35% 30%, rgba(14, 165, 233, 0.12) 0%, rgba(226, 232, 240, 0.32) 45%, transparent 72%)'
            }}
          />
        </div>
        {!isDemoPreview && (
          <header className="relative z-20 max-w-[1440px] mx-auto w-full flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-300 dark:border-slate-800/80 pb-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.85)] shrink-0" />
              <span className="font-score font-black text-sm tracking-wider uppercase text-slate-950 dark:text-white truncate">
                {showAiNewsStudio
                  ? aiNewsConfig?.companyName || 'DATA VAULT SPORTS HD'
                  : effectiveMonetization?.siteName || 'Live Cricket HD'}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ThemeToggleButton variant="broadcast" />
              {!hideAppDownload && (
                <AppDownloadButton
                  variant="compact"
                  config={effectiveMonetization?.broadcastSettings?.appDownload}
                  siteName={effectiveMonetization?.siteName}
                  onOpenMobileApp={onSwitchToMobile}
                />
              )}
              {onSwitchToMobile && (
                <button
                  type="button"
                  onClick={onSwitchToMobile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Mobile Mode</span>
                </button>
              )}
              <a
                href="?page=news"
                onClick={(e) => {
                  if (onOpenNews) {
                    e.preventDefault();
                    onOpenNews();
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 hover:text-amber-700 dark:hover:text-amber-300 text-slate-900 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>News</span>
              </a>
              <a
                href="?page=blog"
                onClick={(e) => {
                  if (onOpenBlog) {
                    e.preventDefault();
                    onOpenBlog();
                  }
                }}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-900/80 hover:text-amber-700 dark:hover:text-amber-300 text-slate-900 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Blog</span>
              </a>
            </div>
          </header>
        )}
        <div className="relative z-10 flex-1 flex items-center justify-center py-3">
          {showAiNewsStudio ? (
            <AiNewsStudioTV
              nextMatch={effectiveMonetization?.broadcastSettings?.nextMatch}
            />
          ) : (
            <TvScreenView
              tvScreen={tvScreen}
              nextMatch={effectiveMonetization?.broadcastSettings?.nextMatch}
              variant="broadcast"
              hasLiveMatch={hasLiveCricketMatch}
            />
          )}
        </div>
        {!showAiNewsStudio && (
          <div className="relative z-10 w-full pb-2 shrink-0">
            <ScrollingNewsTicker studioState={aiNewsState} onOpenNews={onOpenNews} />
          </div>
        )}
        {!isDemoPreview && !hideAppDownload && (
          <>
            <SixProCricketBanner config={effectiveMonetization?.broadcastSettings?.sixProCricket} />
            <AppDownloadButton
              config={effectiveMonetization?.broadcastSettings?.appDownload}
              siteName={effectiveMonetization?.siteName}
              onOpenMobileApp={onSwitchToMobile}
            />
          </>
        )}
        <footer className="relative z-10 max-w-[1440px] mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-300 dark:border-slate-800 pt-4">
          <span>{effectiveMonetization?.siteName || 'Live Cricket HD'} Broadcast</span>
          <nav className="flex items-center flex-wrap gap-4 font-medium text-slate-700 dark:text-slate-400">
            <a
              href="?page=news"
              onClick={(e) => {
                if (onOpenNews) {
                  e.preventDefault();
                  onOpenNews();
                }
              }}
              className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
            >
              News
            </a>
            <a
              href="?page=blog"
              onClick={(e) => {
                if (onOpenBlog) {
                  e.preventDefault();
                  onOpenBlog();
                }
              }}
              className="hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
            >
              Blog
            </a>
            <a
              href="?page=privacy"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('privacy');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Privacy Policy
            </a>
            <a
              href="?page=terms"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('terms');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Terms
            </a>
            <a
              href="?page=contact"
              onClick={(e) => {
                if (onOpenLegalPage) {
                  e.preventDefault();
                  onOpenLegalPage('contact');
                }
              }}
              className="hover:text-slate-950 dark:hover:text-white transition-colors"
            >
              Contact
            </a>
          </nav>
        </footer>
      </div>
    );
  }

  const { battingTeam, bowlingTeam, striker, nonStriker, currentBowler, currentPartnership, recentBalls } = displayMatch;
  const isChasing = displayMatch.currentInnings === 2 || (displayMatch.target !== undefined && displayMatch.target > 0);
  const isCompleted = displayMatch.gameState === 'completed';
  const hasDls =
    (displayMatch.statusText && displayMatch.statusText.toUpperCase().includes('DLS')) ||
    (displayMatch.title && displayMatch.title.toUpperCase().includes('DLS'));

  const isBattingWinner = matchResultInfo?.winnerTeam === 'batting';
  const isBattingRunnerUp = matchResultInfo?.winnerTeam === 'bowling';
  const isBowlingWinner = matchResultInfo?.winnerTeam === 'bowling';
  const isBowlingRunnerUp = matchResultInfo?.winnerTeam === 'batting';

  // Ads ONLY show when Admin explicitly enables them in Monetization panel
  const adsEnabled = Boolean(effectiveMonetization?.adsEnabled);
  const sponsorEnabled = Boolean(
    effectiveMonetization?.sponsor?.enabled &&
      (effectiveMonetization.sponsor.logoUrl ||
        effectiveMonetization.sponsor.imageUrl ||
        effectiveMonetization.sponsor.linkUrl ||
        effectiveMonetization.sponsor.name?.trim())
  );
  const canFitSingleScreen = !adsEnabled && !sponsorEnabled && !matchResultInfo;
  const teamTheme = getTeamVisualTheme(
    battingTeam.code || battingTeam.shortName,
    battingTeam.name,
    battingTeam.primaryColor,
    battingTeam.secondaryColor
  );
  const bowlingTheme = getTeamVisualTheme(
    bowlingTeam.code || bowlingTeam.shortName,
    bowlingTeam.name,
    bowlingTeam.primaryColor,
    bowlingTeam.secondaryColor
  );

  const summaryPhase = detectSummaryPhase(displayMatch);
  const summaryPhaseKey =
    summaryPhase && displayMatch
      ? `${displayMatch.matchId}_${summaryPhase}_${displayMatch.currentInnings}`
      : null;
  const isSummaryModalOpen = Boolean(
    summaryPhase &&
      summaryPhaseKey &&
      (reopenedSummaryKey === summaryPhaseKey || dismissedSummaryKey !== summaryPhaseKey)
  );

  const battingAccentText = isDark ? teamTheme.accentTextHex : teamTheme.accentLightTextHex;
  const battingDividerColor = isDark
    ? teamTheme.accentHex
    : teamTheme.accentHex === '#cbd5e1'
    ? '#475569'
    : teamTheme.accentLightTextHex;

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-white px-3 pt-1.5 pb-20 sm:px-5 sm:pt-2 sm:pb-24 lg:px-6 lg:pt-1.5 lg:pb-20 flex flex-col justify-between select-none">
      {/* Hidden Top-Left Secret Admin Gesture Hotspot (Long-Press / 5x Tap) */}
      <div
        aria-hidden="true"
        {...secretGestureProps}
        className="fixed top-0 left-0 w-14 h-14 z-30"
      />
      {/* Subtle OBS-Safe Slow Ambient Navy Gradient Glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div
          className={`absolute -top-1/3 -left-1/4 w-[145%] h-[92%] rounded-full blur-3xl ${
            effectiveAnimationsEnabled ? 'animate-broadcast-ambient' : 'opacity-60'
          }`}
          style={{
            background: isDark
              ? `radial-gradient(ellipse at 32% 28%, ${teamTheme.ambientGlowRgba} 0%, rgba(15, 23, 42, 0.28) 46%, transparent 74%)`
              : `radial-gradient(ellipse at 32% 28%, ${teamTheme.ambientGlowRgba} 0%, rgba(226, 232, 240, 0.35) 46%, transparent 74%)`
          }}
        />
      </div>

      {/* Auto Ball Animation Overlay (Diffs live updates automatically; respects Admin Ball Animation switch & manual highlight replays) */}
      <AutoBallAnimationOverlay
        event={activeBallEvent}
        enabled={replayOrLiveAnimationsEnabled}
        variant="broadcast"
      />

      {/* Match / Innings Summary Modal Overlay */}
      {summaryPhase && (
        <MatchSummaryModal
          match={displayMatch}
          phase={summaryPhase}
          isOpen={isSummaryModalOpen}
          onClose={() => {
            setReopenedSummaryKey(null);
            setDismissedSummaryKey(summaryPhaseKey);
          }}
        />
      )}

      {/* Optional Admin Global Announcement Banner */}
      {effectiveMonetization?.broadcastSettings?.announcement?.enabled &&
        effectiveMonetization.broadcastSettings.announcement.text?.trim() && (
          <div className="relative z-10 max-w-[1520px] mx-auto w-full pt-1 shrink-0">
            {effectiveMonetization.broadcastSettings.announcement.linkUrl?.trim() ? (
              <a
                href={effectiveMonetization.broadcastSettings.announcement.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-amber-400 dark:border-amber-400/45 bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-500/15 dark:via-slate-900/95 dark:to-sky-500/15 px-4 py-1.5 text-center text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100 hover:border-amber-500 dark:hover:border-amber-300/80 transition-colors shadow-xs"
              >
                <span className="text-amber-700 dark:text-amber-300 uppercase tracking-wider mr-2 font-score text-[11px]">
                  Notice
                </span>
                <span>{effectiveMonetization.broadcastSettings.announcement.text}</span>
              </a>
            ) : (
              <div className="rounded-xl border border-amber-400 dark:border-amber-400/45 bg-gradient-to-r from-amber-50 via-white to-sky-50 dark:from-amber-500/15 dark:via-slate-900/95 dark:to-sky-500/15 px-4 py-1.5 text-center text-xs sm:text-sm font-bold text-amber-950 dark:text-amber-100 shadow-xs">
                <span className="text-amber-700 dark:text-amber-300 uppercase tracking-wider mr-2 font-score text-[11px]">
                  Notice
                </span>
                <span>{effectiveMonetization.broadcastSettings.announcement.text}</span>
              </div>
            )}
          </div>
        )}

      {/* Optional Top Ad Slot (Hidden unless Admin turns Ads ON) */}
      {adsEnabled && (
        <div className="relative z-10 pt-2 shrink-0">
          <AdSlot
            placement="top"
            adsEnabled={adsEnabled}
            publisherId={effectiveMonetization?.adsensePublisherId}
            slotConfig={effectiveMonetization?.slots?.topBanner}
            adTestMode={effectiveMonetization?.adsenseTestMode}
            hidePlaceholder={effectiveMonetization?.adsenseHidePlaceholders}
          />
        </div>
      )}

      {/* Main Broadcast Stage: Live Score Cards -> Voice ON & Player Details -> Wide Live TV/Ground Screen -> Partnership & Overs */}
      <main className="relative z-10 max-w-[1520px] mx-auto w-full flex-1 flex flex-col justify-start gap-1.5 sm:gap-2 py-1 min-h-0">
        {/* Compact Match Title & Status Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="font-score font-bold text-xs uppercase tracking-wider"
              style={{ color: battingAccentText }}
            >
              {displayMatch.matchType}
            </span>
            <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">•</span>
            <h1 className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-slate-950 dark:text-white uppercase leading-tight">
              {battingTeam.name}{' '}
              <span className="text-slate-500 dark:text-slate-400 font-semibold mx-1">vs</span>{' '}
              {bowlingTeam.name}
            </h1>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {displayMatch.statusText && (
              <span className="text-sm sm:text-base font-bold text-amber-700 dark:text-amber-300 tracking-wide">
                {displayMatch.statusText}
              </span>
            )}
            {hasDls && (
              <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-sm font-score font-bold uppercase shadow-xs">
                DLS: {displayMatch.target} ({displayMatch.dlsDetails?.revisedOvers || '?'} ov)
              </span>
            )}
            {summaryPhase && summaryPhaseKey && (
              <button
                type="button"
                onClick={() => setReopenedSummaryKey(summaryPhaseKey)}
                className="px-3.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-500/15 hover:bg-amber-200 dark:hover:bg-amber-500/25 border border-amber-400 dark:border-amber-400/50 text-amber-900 dark:text-amber-200 text-sm font-bold inline-flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{summaryPhase === 'match_completed' ? 'Match Summary' : 'Innings Summary'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Winner Celebration Banner (Only when match result is finalized) */}
        {matchResultInfo && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:bg-none dark:bg-[#0a1329]/95 border-2 border-amber-500 dark:border-amber-400 p-5 sm:p-6 shadow-xl dark:shadow-2xl dark:shadow-amber-500/15 text-center">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent animate-shimmer pointer-events-none" />
            <div className="absolute top-3 left-4 text-amber-600 dark:text-amber-400 animate-float-sparkle pointer-events-none">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="absolute top-3 right-4 text-amber-500 dark:text-amber-300 animate-float-sparkle pointer-events-none">
              <PartyPopper className="w-5 h-5" />
            </div>
            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              {matchResultInfo.winningTeamData && (
                <div className="relative">
                  <TeamFlag
                    teamName={matchResultInfo.winningTeamData.name}
                    teamCode={matchResultInfo.winningTeamData.code}
                    logoUrl={matchResultInfo.winningTeamData.logoUrl}
                    size="lg"
                    className="border-2 border-amber-500 dark:border-amber-400 shadow-lg"
                  />
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center border border-slate-950">
                    <Crown className="w-3.5 h-3.5 fill-slate-950" />
                  </div>
                </div>
              )}
              <div className="text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 text-sm font-black text-amber-700 dark:text-amber-300 uppercase tracking-widest">
                  <Award className="w-4 h-4" />
                  <span>OFFICIAL MATCH WINNER</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white uppercase tracking-tight">
                  {matchResultInfo.winningTeamData?.name || matchResultInfo.winnerText}
                </h2>
                <p className="text-sm sm:text-base font-semibold text-amber-800 dark:text-amber-300">{matchResultInfo.winnerText}</p>
              </div>
            </div>
          </div>
        )}

        {/* TIER 1 (TOP): Batting & Bowling Team Score Cards Adjusted Above the Live Screen */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch">
          {/* Primary Batting Team Hero Score Card (e.g., Pakistan) — Dynamic Team Color Theme */}
          <div
            className="lg:col-span-7 score rounded-2xl p-2 sm:px-3.5 sm:py-2 backdrop-blur-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            style={{
              background: isDark
                ? `linear-gradient(135deg, ${teamTheme.accentSoftRgba} 0%, rgba(10, 19, 41, 0.94) 55%, rgba(6, 12, 28, 0.98) 100%)`
                : `linear-gradient(135deg, ${teamTheme.accentSoftRgba} 0%, rgba(255, 255, 255, 0.96) 55%, rgba(248, 250, 252, 0.99) 100%)`,
              border: `1.5px solid ${
                isBattingWinner
                  ? isDark
                    ? '#fbbf24'
                    : '#d97706'
                  : isDark
                  ? teamTheme.accentBorderRgba
                  : battingDividerColor
              }`,
              boxShadow: isDark
                ? isBattingWinner
                  ? '0 10px 28px rgba(2, 6, 23, 0.75), 0 0 20px rgba(251, 191, 36, 0.2)'
                  : `0 10px 28px rgba(2, 6, 23, 0.75), 0 0 20px ${teamTheme.accentGlowRgba}`
                : isBattingWinner
                ? '0 8px 20px rgba(15, 23, 42, 0.09), 0 0 0 1px rgba(217, 119, 6, 0.25)'
                : '0 8px 20px rgba(15, 23, 42, 0.07)'
            }}
          >
            {/* Left Team Identity */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div
                className="rounded-full p-[2px] border-2 shadow-lg shrink-0"
                style={{
                  borderColor: isBattingWinner
                    ? isDark
                      ? '#fbbf24'
                      : '#d97706'
                    : isDark
                    ? teamTheme.accentHex
                    : battingDividerColor
                }}
              >
                <TeamFlag
                  teamName={battingTeam.name}
                  teamCode={battingTeam.code}
                  logoUrl={battingTeam.logoUrl}
                  size="md"
                  className="border-0"
                />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isBattingWinner ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      <Crown className="w-3 h-3 fill-amber-600 dark:fill-amber-300" /> WINNER
                    </span>
                  ) : isBattingRunnerUp ? (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      RUNNER-UP
                    </span>
                  ) : (
                    <span
                      className="text-[11px] font-black uppercase tracking-widest"
                      style={{ color: battingAccentText }}
                    >
                      BATTING NOW
                    </span>
                  )}
                  <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">•</span>
                  <span className="text-[11px] font-score font-bold text-slate-700 dark:text-slate-200">
                    {battingTeam.shortName || battingTeam.code}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg lg:text-xl font-black text-slate-950 dark:text-white tracking-tight truncate leading-tight">
                  {battingTeam.name}
                </h2>
              </div>
            </div>

            {/* Bright Focal Score + Compact Overs & Run Rates */}
            <div className="text-left sm:text-right shrink-0">
              <div
                key={scoreAnimKey}
                className="font-score text-2xl sm:text-3xl xl:text-[2.25rem] font-black text-slate-950 dark:text-white tracking-tight leading-none dark:drop-shadow-[0_3px_14px_rgba(255,255,255,0.18)] animate-score-flip"
              >
                {battingTeam.score.runs}
                <span className="mx-0.5" style={{ color: battingDividerColor }}>
                  /
                </span>
                {battingTeam.score.wickets}
              </div>

              <div className="mt-1 flex flex-wrap items-center sm:justify-end gap-x-2.5 gap-y-0.5 font-score">
                <span className="text-[11px] sm:text-xs font-extrabold text-amber-700 dark:text-amber-300 tracking-wider uppercase">
                  OVERS {battingTeam.score.overs}.{battingTeam.score.balls}
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200">
                  CRR <strong className="text-slate-950 dark:text-white">{displayMatch.currentRunRate.toFixed(2)}</strong>
                </span>
                {isChasing && displayMatch.requiredRunRate !== undefined && displayMatch.requiredRunRate > 0 && (
                  <span className="text-[11px] sm:text-xs font-bold text-amber-800 dark:text-amber-200">
                    RRR <strong className="text-amber-700 dark:text-amber-300">{displayMatch.requiredRunRate.toFixed(2)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Secondary Bowling / Opposition Team Card (e.g., Sri Lanka) + Toss Strip */}
          <div
            className={`lg:col-span-5 score rounded-2xl px-3 py-2 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shadow-md dark:shadow-xl ${
              isBowlingWinner
                ? 'bg-amber-50/95 dark:bg-[#0a1329]/95 border-2 border-amber-500 dark:border-amber-400'
                : 'bg-white/95 dark:bg-[#081124]/92 border border-slate-300 dark:border-slate-700/80'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamFlag
                teamName={bowlingTeam.name}
                teamCode={bowlingTeam.code}
                logoUrl={bowlingTeam.logoUrl}
                size="md"
                className="border border-slate-300 dark:border-slate-600 shrink-0"
              />
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    {isBowlingWinner ? 'WINNER' : isBowlingRunnerUp ? 'RUNNER-UP' : 'BOWLING'}
                  </span>
                  <span className="text-slate-400 dark:text-slate-600" aria-hidden="true">•</span>
                  <span className="text-[11px] font-score font-bold text-slate-700 dark:text-slate-300">
                    {bowlingTeam.shortName || bowlingTeam.code}
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate leading-tight">
                  {bowlingTeam.name}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[200px] sm:max-w-[260px]">
                  {displayMatch.toss || 'Match in progress'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-right">
                {bowlingTeam.score.runs > 0 ? (
                  <div className="font-score text-base sm:text-lg font-black text-slate-950 dark:text-white leading-none">
                    {bowlingTeam.score.runs}/{bowlingTeam.score.wickets}{' '}
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      ({bowlingTeam.score.overs}.{bowlingTeam.score.balls})
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Yet to Bat</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsScorecardDrawerOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-slate-800/90 hover:bg-sky-100 dark:hover:bg-slate-700 border border-sky-300 dark:border-slate-600/70 text-xs font-bold text-sky-900 dark:text-sky-200 transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                <span>Full Card</span>
              </button>
            </div>
          </div>
        </section>

        {/* TIER 1.5 (FIXED UNDER DARK SCORE CARD): Audio & Voice ON Bar + 2nd Innings Target Strip */}
        {!isDemoPreview && (
          <section
            aria-label="Broadcast Audio and Commentary Voice Bar"
            className="bg-white/95 dark:bg-[#0a1329]/92 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-sm dark:shadow-lg flex flex-wrap items-center justify-between gap-2"
          >
            <div
              role="group"
              aria-label="Broadcast and OBS Audio Controls"
              className="flex flex-wrap items-center gap-2.5 sm:gap-3"
            >
              <button
                type="button"
                onClick={toggleViewerSound}
                aria-pressed={!isMuted}
                aria-label={isMuted ? 'Unmute broadcast sound' : 'Mute broadcast sound'}
                title={
                  !adminSoundEnabled
                    ? 'Audio disabled by Studio Admin'
                    : isSoundOn
                    ? 'Audio ON (Synced with OBS — Click to Mute)'
                    : 'Audio Muted (Click to Unmute)'
                }
                className={`inline-flex items-center gap-1.5 font-sans text-xs font-bold px-2.5 py-1 rounded-lg border transition-colors ${
                  isSoundOn
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25'
                    : 'bg-slate-100 dark:bg-slate-800/85 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {isSoundOn ? (
                  <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                )}
                <span>{isMuted ? 'Muted' : 'Audio ON'}</span>
              </button>

              <AudioSoundWave
                isSoundOn={isSoundOn}
                isCrowdActive={isCrowdActive}
                crowdVolume={crowdVolume}
                reducedMotion={prefersReducedMotion}
              />

              <span className="h-4 w-px bg-slate-300 dark:bg-slate-700/80 hidden sm:inline-block" aria-hidden="true" />

              <label className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="text-sky-700 dark:text-sky-300">Effects</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={effectsVolume}
                  onChange={(e) => setEffectsVolume(Number(e.target.value))}
                  aria-label="Match event sound effects volume"
                  className="w-14 sm:w-16 h-1.5 accent-sky-600 dark:accent-sky-400 cursor-pointer"
                />
                <span className="font-score text-[11px] text-slate-600 dark:text-slate-400 w-8 text-right tabular-nums">
                  {effectsVolume}%
                </span>
              </label>

              <label className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="text-emerald-700 dark:text-emerald-300">Crowd</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={crowdVolume}
                  onChange={(e) => setCrowdVolume(Number(e.target.value))}
                  aria-label="Crowd ambience volume"
                  className="w-14 sm:w-16 h-1.5 accent-emerald-600 dark:accent-emerald-400 cursor-pointer"
                />
                <span className="font-score text-[11px] text-slate-600 dark:text-slate-400 w-8 text-right tabular-nums">
                  {crowdVolume}%
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={toggleFemaleVoice}
              aria-pressed={femaleVoiceEnabled}
              title={femaleVoiceEnabled ? 'Female Commentary Voice ON' : 'Female Commentary Voice OFF'}
              className={`inline-flex items-center gap-1.5 font-sans text-xs font-bold px-3 py-1 rounded-lg border transition-colors ${
                femaleVoiceEnabled
                  ? isVoiceSpeaking
                    ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 dark:border-amber-400/70 text-amber-900 dark:text-amber-200 animate-pulse'
                    : 'bg-sky-50 dark:bg-sky-500/15 border-sky-300 dark:border-sky-400/50 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-500/25'
                  : 'bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-200'
              }`}
            >
              {femaleVoiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
              <span>Voice {femaleVoiceEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </section>
        )}

        {/* 2nd Innings Automatic Target Panel */}
        <TargetChasePanel match={displayMatch} variant="broadcast" />

        {/* TIER 2 (FIXED UNDER DARK SCORE CARD & VOICE ON, ABOVE SCREEN): Compact HD Player Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {/* Striker Card (Gold Glow) */}
          <div className="bg-white/95 dark:bg-[#0a1329]/92 backdrop-blur-md border-2 border-amber-400 dark:border-amber-400/60 shadow-md dark:shadow-[0_0_24px_rgba(251,191,36,0.16)] rounded-2xl p-2 sm:px-3 sm:py-1.5 flex items-center gap-2.5 relative">
            <PlayerAvatar
              playerId={striker.playerId}
              name={striker.name}
              teamCode={battingTeam.code}
              jerseyNumber={striker.jerseyNumber}
              imageUrl={striker.imageUrl}
              size="md"
              ringVariant="gold"
              isOnStrike={true}
              showJerseyNumber={false}
              showStrikeBadge={false}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                  Striker ★
                </span>
                <span className="text-[11px] font-score text-slate-600 dark:text-slate-300">
                  SR <strong className="text-slate-950 dark:text-white">{striker.strikeRate.toFixed(1)}</strong>
                </span>
              </div>
              <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate leading-tight">
                {striker.name}
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-0.5 flex-wrap">
                <div className="font-score text-xl sm:text-2xl font-black text-amber-700 dark:text-amber-300 leading-none">
                  {striker.runs}
                  <span className="text-amber-600 dark:text-amber-400">*</span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold ml-1">({striker.balls}b)</span>
                </div>
                <div className="text-xs font-score text-slate-600 dark:text-slate-300">
                  4s <strong className="text-slate-950 dark:text-white">{striker.fours}</strong> • 6s{' '}
                  <strong className="text-slate-950 dark:text-white">{striker.sixes}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Non-Striker Card (Clean High-Contrast Neutral) */}
          <div className="bg-white/95 dark:bg-[#0a1329]/88 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 shadow-md dark:shadow-xl rounded-2xl p-2 sm:px-3 sm:py-1.5 flex items-center gap-2.5">
            <PlayerAvatar
              playerId={nonStriker.playerId}
              name={nonStriker.name}
              teamCode={battingTeam.code}
              jerseyNumber={nonStriker.jerseyNumber}
              imageUrl={nonStriker.imageUrl}
              size="md"
              ringVariant="default"
              isOnStrike={false}
              showJerseyNumber={false}
              showStrikeBadge={false}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Non-Striker
                </span>
                <span className="text-[11px] font-score text-slate-600 dark:text-slate-300">
                  SR <strong className="text-slate-950 dark:text-white">{nonStriker.strikeRate.toFixed(1)}</strong>
                </span>
              </div>
              <div className="text-sm sm:text-base font-bold text-slate-950 dark:text-white truncate leading-tight">
                {nonStriker.name}
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-0.5 flex-wrap">
                <div className="font-score text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-none">
                  {nonStriker.runs}
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold ml-1">({nonStriker.balls}b)</span>
                </div>
                <div className="text-xs font-score text-slate-600 dark:text-slate-300">
                  4s <strong className="text-slate-950 dark:text-white">{nonStriker.fours}</strong> • 6s{' '}
                  <strong className="text-slate-950 dark:text-white">{nonStriker.sixes}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Bowler Card (Green Glow) */}
          <div className="bg-white/95 dark:bg-[#0a1329]/92 backdrop-blur-md border-2 border-emerald-500 dark:border-emerald-400/55 shadow-md dark:shadow-[0_0_24px_rgba(52,211,153,0.16)] rounded-2xl p-2 sm:px-3 sm:py-1.5 flex items-center gap-2.5">
            <PlayerAvatar
              playerId={currentBowler.playerId}
              name={currentBowler.name}
              teamCode={bowlingTeam.code}
              jerseyNumber={currentBowler.jerseyNumber}
              imageUrl={currentBowler.imageUrl}
              size="md"
              ringVariant="green"
              showJerseyNumber={false}
              showStrikeBadge={false}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  Bowler
                </span>
                <span className="text-[11px] font-score text-slate-600 dark:text-slate-300">
                  ECON <strong className="text-emerald-700 dark:text-emerald-300">{currentBowler.economy.toFixed(2)}</strong>
                </span>
              </div>
              <div className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate leading-tight">
                {currentBowler.name}
              </div>
              <div className="flex items-baseline justify-between gap-2 pt-0.5 flex-wrap">
                <div className="font-score text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 leading-none">
                  {currentBowler.wickets}
                  <span className="text-slate-500 dark:text-slate-400 mx-0.5">/</span>
                  {currentBowler.runs}
                </div>
                <div className="text-xs font-score text-slate-600 dark:text-slate-300">
                  OV <strong className="text-slate-950 dark:text-white">{currentBowler.overs}</strong> • M{' '}
                  <strong className="text-slate-950 dark:text-white">{currentBowler.maidens || 0}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TIER 3 (BELOW SCORE & PLAYERS): Wide Broadcast TV / Live Ground Screen */}
        <section className="w-full max-w-[1220px] mx-auto">
          {(!ignoreHoldScreen && tvScreen?.enabled) || displayMatch.gameState === 'scheduled' ? (
            <div className="bg-white/95 dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl p-1.5 shadow-md dark:shadow-xl flex flex-col justify-between">
              <TvScreenView
                tvScreen={tvScreen}
                nextMatch={effectiveMonetization?.broadcastSettings?.nextMatch}
                variant="broadcast"
                embedded
                hasLiveMatch={displayMatch.gameState !== 'scheduled'}
                onAdPlaybackChange={setIsTvAdPlaying}
              />
            </div>
          ) : (
            <LiveAnimatedMatchCard
              match={displayMatch}
              activeBallEvent={activeBallEvent}
              animationsEnabled={replayOrLiveAnimationsEnabled}
              battingColor={teamTheme.accentHex}
              bowlingColor={bowlingTheme.accentHex}
              compact={canFitSingleScreen}
              topTv={true}
              isVoiceSpeaking={isVoiceSpeaking}
            />
          )}
        </section>

        {/* TIER 4: Compact Partnership & This Over Deliveries */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* Partnership Card */}
          <div className="lg:col-span-4 bg-white/95 dark:bg-[#0a1329]/88 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3 shadow-md dark:shadow-xl">
            <div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
                Partnership
              </span>
              <div className="font-score text-xl sm:text-2xl font-black text-slate-950 dark:text-white mt-0.5 leading-none">
                {currentPartnership?.runs || 0}{' '}
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  ({currentPartnership?.balls || 0}b)
                </span>
              </div>
            </div>
            <div className="text-right text-xs sm:text-[13px] font-score text-slate-700 dark:text-slate-200 space-y-0.5">
              <div>
                {striker.shortName || striker.name}:{' '}
                <strong className="text-amber-700 dark:text-amber-300">{currentPartnership?.player1Runs ?? striker.runs}</strong>
              </div>
              <div>
                {nonStriker.shortName || nonStriker.name}:{' '}
                <strong className="text-slate-950 dark:text-white">{currentPartnership?.player2Runs ?? nonStriker.runs}</strong>
              </div>
            </div>
          </div>

          {/* Over Deliveries Strip: dot=grey, 1-3=high-contrast chip, 4=blue, 6=gold, wicket=red */}
          <div className="lg:col-span-8 bg-white/95 dark:bg-[#0a1329]/88 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-md dark:shadow-xl">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              This Over
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {recentBalls && recentBalls.length > 0 ? (
                recentBalls.slice(0, 8).map((b, i) => {
                  const isWide = b.isExtra && b.extraType === 'wide';
                  const isNoBall = b.isExtra && b.extraType === 'no-ball';
                  const chipLabel = b.isWicket
                    ? 'W'
                    : isWide
                    ? b.runs > 1
                      ? `${b.runs}wd`
                      : 'wd'
                    : isNoBall
                    ? b.runs > 1
                      ? `${b.runs}nb`
                      : 'nb'
                    : b.runs === 0
                    ? '•'
                    : b.runs;

                  let ballStyle =
                    'bg-slate-200 text-slate-900 border border-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500'; // dot = grey
                  if (b.isWicket) {
                    ballStyle = 'bg-rose-600 text-white border border-rose-300 shadow-[0_0_10px_rgba(225,29,72,0.5)]'; // wicket = red
                  } else if (b.isSix) {
                    ballStyle = 'bg-amber-400 text-slate-950 border border-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.5)]'; // 6 = gold
                  } else if (b.isFour) {
                    ballStyle = 'bg-blue-600 text-white border border-blue-300 shadow-[0_0_10px_rgba(37,99,235,0.5)]'; // 4 = blue
                  } else if (isWide || isNoBall) {
                    ballStyle =
                      'bg-amber-100 text-amber-900 border border-amber-400 dark:bg-slate-800 dark:text-amber-200 dark:border-amber-400/60';
                  } else if (b.runs >= 1 && b.runs <= 3) {
                    ballStyle =
                      'bg-slate-900 text-white border border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white'; // 1-3 = high contrast
                  }

                  return (
                    <span
                      key={b.id || i}
                      title={`${b.batsmanName} vs ${b.bowlerName}: ${b.commentary || b.runs + ' runs'}`}
                      className={`min-w-8 h-8 px-1.5 rounded-full flex items-center justify-center font-score font-black text-xs ${ballStyle}`}
                    >
                      {chipLabel}
                    </span>
                  );
                })
              ) : (
                <span className="text-xs text-slate-600 dark:text-slate-300 font-score">Awaiting first delivery</span>
              )}
            </div>
          </div>
        </section>

        {/* Optional In-Content Ad Slot (Hidden unless Admin turns Ads ON) */}
        {adsEnabled && (
          <AdSlot
            placement="in-content"
            adsEnabled={adsEnabled}
            publisherId={effectiveMonetization?.adsensePublisherId}
            slotConfig={effectiveMonetization?.slots?.inContent}
            adTestMode={effectiveMonetization?.adsenseTestMode}
            hidePlaceholder={effectiveMonetization?.adsenseHidePlaceholders}
          />
        )}

        {/* Optional Admin-Configured Sponsor Banner */}
        {sponsorEnabled && <SponsorBanner sponsor={effectiveMonetization?.sponsor} />}

        {/* Cricket News & Player Updates Section (Managed in Admin Panel -> News) */}
        <BroadcastCricketNewsSection onOpenNews={onOpenNews} isDemoPreview={isDemoPreview} />

        {/* Optional Footer Ad Slot (Hidden unless Admin turns Ads ON) */}
        {adsEnabled && (
          <AdSlot
            placement="footer"
            adsEnabled={adsEnabled}
            publisherId={effectiveMonetization?.adsensePublisherId}
            slotConfig={effectiveMonetization?.slots?.footerBanner}
            adTestMode={effectiveMonetization?.adsenseTestMode}
            hidePlaceholder={effectiveMonetization?.adsenseHidePlaceholders}
          />
        )}
      </main>

      {/* Bottom Broadcast Match & AI Studio Scrolling Breaking News Ticker */}
      <div className="relative z-10 max-w-[1520px] mx-auto w-full pb-2 shrink-0 space-y-1.5">
        <MatchTicker match={displayMatch} newsItems={breakingNews} onOpenNews={onOpenNews} />
        <ScrollingNewsTicker studioState={aiNewsState} onOpenNews={onOpenNews} />
      </div>

      {/* Official SIX PRO 3D CRICKET Android APK Download Banner */}
      {!isDemoPreview && !hideAppDownload && (
        <SixProCricketBanner config={effectiveMonetization?.broadcastSettings?.sixProCricket} />
      )}

      {/* Compact Android App Download Button (Hidden inside App, Admin & OBS Overlay) */}
      {!isDemoPreview && !hideAppDownload && (
        <AppDownloadButton
          config={effectiveMonetization?.broadcastSettings?.appDownload}
          siteName={effectiveMonetization?.siteName}
          onOpenMobileApp={onSwitchToMobile}
        />
      )}

      {/* Slim Footer Broadcast Bar, Social Sharing, News/Blog & Legal Links */}
      <footer className="relative z-10 max-w-[1520px] mx-auto w-full flex flex-col lg:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 border-t border-slate-300 dark:border-slate-800 pt-2.5 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap justify-center lg:justify-start">
          <span className="text-slate-900 dark:text-slate-200 font-semibold">{effectiveMonetization?.siteName || 'Live Cricket HD'} Broadcast</span>
          <span className="hidden sm:inline text-slate-400 dark:text-slate-600">•</span>
          <span className="font-score text-slate-600 dark:text-slate-400">MATCH #{displayMatch.matchId || 'LIVE'}</span>
        </div>

        <SocialShareBar match={displayMatch} />

        <nav className="flex items-center flex-wrap justify-center gap-5 font-medium text-slate-700 dark:text-slate-300">
          <a
            href="?page=news"
            onClick={(e) => {
              if (onOpenNews) {
                e.preventDefault();
                onOpenNews();
              }
            }}
            className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
          >
            News
          </a>
          <a
            href="?page=blog"
            onClick={(e) => {
              if (onOpenBlog) {
                e.preventDefault();
                onOpenBlog();
              }
            }}
            className="hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
          >
            Blog
          </a>
          <a
            href="?page=privacy"
            onClick={(e) => {
              if (onOpenLegalPage) {
                e.preventDefault();
                onOpenLegalPage('privacy');
              }
            }}
            className="hover:text-slate-950 dark:hover:text-white transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="?page=terms"
            onClick={(e) => {
              if (onOpenLegalPage) {
                e.preventDefault();
                onOpenLegalPage('terms');
              }
            }}
            className="hover:text-slate-950 dark:hover:text-white transition-colors"
          >
            Terms
          </a>
          <a
            href="?page=contact"
            onClick={(e) => {
              if (onOpenLegalPage) {
                e.preventDefault();
                onOpenLegalPage('contact');
              }
            }}
            className="hover:text-slate-950 dark:hover:text-white transition-colors"
          >
            Contact
          </a>
        </nav>
      </footer>

      {/* Expandable Full Scorecard & Playing XI Slide-Over Drawer */}
      <BroadcastScorecardDrawer
        match={displayMatch}
        isOpen={isScorecardDrawerOpen}
        onClose={() => setIsScorecardDrawerOpen(false)}
      />
    </div>
  );
};
