import React, { useState, useEffect, useMemo, useRef } from 'react';
import { resolvePlayerProfile } from '../data/playersRegistry';
import { useOptionalContent } from '../context/ContentContext';
import {
  getStoredPlayerPhoto,
  isImageUrlLoaded,
  markImageUrlLoaded,
  MEDIA_UPDATED_EVENT
} from '../utils/mediaStorage';

export type PlayerAvatarRingVariant = 'gold' | 'green' | 'blue' | 'default';

interface PlayerAvatarProps {
  playerId?: string;
  name: string;
  teamCode?: string;
  jerseyNumber?: number;
  imageUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnStrike?: boolean;
  ringVariant?: PlayerAvatarRingVariant;
  className?: string;
  showJerseyNumber?: boolean;
  showStrikeBadge?: boolean;
}

// Temporary cooldown map (15s) for URLs that failed due to transient network errors
const failedUrlCooldown = new Map<string, number>();

function isBrokenPlaceholderUrl(url?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  return (
    trimmed.includes('images.icc-cricket.com/image/upload/t_player-headshot-portrait/prd/assets/players/generic/male/') ||
    trimmed.includes('icc-cricket.com')
  );
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  playerId,
  name,
  teamCode = 'CRX',
  jerseyNumber,
  imageUrl: directImageUrl,
  size = 'md',
  isOnStrike = false,
  ringVariant,
  className = '',
  showJerseyNumber = false,
  showStrikeBadge = false
}) => {
  const contentCtx = useOptionalContent();
  const [mediaVersion, setMediaVersion] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [candidateIdx, setCandidateIdx] = useState(0);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = () => setMediaVersion((v) => v + 1);
    window.addEventListener(MEDIA_UPDATED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(MEDIA_UPDATED_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const profile = resolvePlayerProfile(playerId, name, teamCode);
  const cloudOverride = contentCtx?.findManagedPlayerOverride(playerId, name, teamCode);
  const storedPhoto = getStoredPlayerPhoto(name, teamCode);
  const proxyUrl = `/api/player/photo?name=${encodeURIComponent(name)}&team=${encodeURIComponent(teamCode || 'CRX')}`;

  // Strict priority: 1) Admin Cloud (Firestore/Storage) -> 2) Local Cache -> 3) Direct Prop -> 4) Registry -> 5) Server Proxy
  const candidates = useMemo(() => {
    const rawOrder = [
      cloudOverride?.imageUrl,
      storedPhoto,
      directImageUrl,
      profile?.imageUrl,
      proxyUrl
    ];
    const now = Date.now();
    const seen = new Set<string>();
    const list: string[] = [];

    for (const raw of rawOrder) {
      if (!raw || isBrokenPlaceholderUrl(raw)) continue;
      const clean = raw.trim();
      if (seen.has(clean)) continue;
      const cooldownUntil = failedUrlCooldown.get(clean);
      if (cooldownUntil && cooldownUntil > now) continue;
      seen.add(clean);
      list.push(clean);
    }

    // Always keep proxyUrl as final fallback even if in cooldown
    if (!seen.has(proxyUrl)) {
      list.push(proxyUrl);
    }
    return list;
  }, [
    cloudOverride?.imageUrl,
    storedPhoto,
    directImageUrl,
    profile?.imageUrl,
    proxyUrl,
    mediaVersion,
    retryTick
  ]);

  const primaryCandidate = candidates[0] || '';
  const identityKey = `${name}|${teamCode}|${primaryCandidate}`;
  const prevIdentityRef = useRef<string>(identityKey);

  const activeUrl = candidates[candidateIdx] || '';
  const [loadedUrl, setLoadedUrl] = useState<string>(() =>
    activeUrl && isImageUrlLoaded(activeUrl) ? activeUrl : ''
  );

  // Only reset candidate index when player identity or top-priority Admin URL genuinely changes
  useEffect(() => {
    if (prevIdentityRef.current !== identityKey) {
      prevIdentityRef.current = identityKey;
      retryCountRef.current = 0;
      setCandidateIdx(0);
      if (primaryCandidate && isImageUrlLoaded(primaryCandidate)) {
        setLoadedUrl(primaryCandidate);
      }
    }
  }, [identityKey, primaryCandidate]);

  const isCurrentLoaded =
    Boolean(activeUrl) && (loadedUrl === activeUrl || isImageUrlLoaded(activeUrl));

  const handleImageLoad = () => {
    if (!activeUrl) return;
    markImageUrlLoaded(activeUrl);
    setLoadedUrl(activeUrl);
    if (candidateIdx === 0) {
      retryCountRef.current = 0;
    }
  };

  const handleImageError = () => {
    if (activeUrl) {
      failedUrlCooldown.set(activeUrl, Date.now() + 15_000);
    }
    if (candidateIdx + 1 < candidates.length) {
      setCandidateIdx((idx) => idx + 1);
    }

    // Auto-retry primary/admin photo silently after brief backoff if network glitched
    if (retryCountRef.current < 2) {
      retryCountRef.current += 1;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        if (primaryCandidate) {
          failedUrlCooldown.delete(primaryCandidate);
        }
        setCandidateIdx(0);
        setRetryTick((t) => t + 1);
      }, 4000);
    }
  };

  const num = jerseyNumber || profile?.jerseyNumber;
  const team = (teamCode || profile?.teamCode || 'CRX').toUpperCase();

  const sizeStyles = {
    xs: 'w-8 h-8 text-[10px]',
    sm: 'w-11 h-11 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-[72px] h-[72px] text-lg',
    xl: 'w-22 h-22 text-2xl'
  };

  const getInitials = (n: string) => {
    const cleaned = n
      .replace(/\s*\(c\s*&\s*wk\)/gi, '')
      .replace(/\s*\(c\)/gi, '')
      .replace(/\s*\(wk\)/gi, '')
      .replace(/[*#]/g, '')
      .trim();
    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return cleaned.slice(0, 2).toUpperCase() || 'CR';
  };

  const initials = getInitials(name);

  // Resolve outer glow ring style
  const effectiveRing: PlayerAvatarRingVariant = ringVariant || (isOnStrike ? 'gold' : 'default');
  const ringStyles: Record<PlayerAvatarRingVariant, string> = {
    gold: 'border-2 border-amber-400 ring-2 ring-amber-400/35 shadow-[0_0_20px_rgba(251,191,36,0.35)]',
    green: 'border-2 border-emerald-400 ring-2 ring-emerald-400/35 shadow-[0_0_20px_rgba(52,211,153,0.35)]',
    blue: 'border-2 border-sky-400/80 ring-2 ring-sky-400/20 shadow-[0_0_16px_rgba(56,189,248,0.22)]',
    default: 'border-2 border-slate-600/80 ring-1 ring-slate-500/20'
  };

  const getTeamGradient = (t: string) => {
    switch (t) {
      case 'WI':
      case 'WEST INDIES':
        return 'from-[#4c0519] via-[#0f172a] to-[#030712]';
      case 'BAN':
      case 'BANGLADESH':
        return 'from-[#064e3b] via-[#0f172a] to-[#030712]';
      case 'IND':
      case 'INDIA':
        return 'from-[#0c4a6e] via-[#0f172a] to-[#030712]';
      case 'AUS':
      case 'AUSTRALIA':
        return 'from-[#713f12] via-[#0f172a] to-[#030712]';
      case 'PAK':
      case 'PAKISTAN':
        return 'from-[#14532d] via-[#0f172a] to-[#030712]';
      case 'ENG':
      case 'ENGLAND':
        return 'from-[#1e3a8a] via-[#0f172a] to-[#030712]';
      case 'SA':
      case 'RSA':
        return 'from-[#065f46] via-[#0f172a] to-[#030712]';
      case 'NZ':
      case 'NEW ZEALAND':
        return 'from-[#1e293b] via-[#0f172a] to-[#030712]';
      default:
        return 'from-[#0f172a] via-[#0a1329] to-[#030712]';
    }
  };

  const gradientClass = getTeamGradient(team);

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      <div
        className={`${sizeStyles[size]} rounded-full overflow-hidden ${ringStyles[effectiveRing]} bg-gradient-to-br ${gradientClass} relative flex items-center justify-center`}
      >
        {/* Always show initials underneath while image loads or if loading fails */}
        <div
          aria-hidden={isCurrentLoaded}
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#091224] to-[#030712] text-slate-200 font-score font-extrabold tracking-wider"
        >
          {initials}
        </div>
        {activeUrl && (
          <img
            src={activeUrl}
            alt={name}
            referrerPolicy="no-referrer"
            decoding="async"
            className={`relative z-10 w-full h-full object-cover object-top transition-opacity duration-150 ${
              isCurrentLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
      </div>

      {/* Optional Jersey Number Badge */}
      {showJerseyNumber && num && (
        <div className="absolute -bottom-1 -right-1 bg-sky-600 border border-sky-300/60 text-[10px] font-score font-black text-white px-1.5 py-0.2 rounded-full shadow-md leading-tight">
          {num}
        </div>
      )}

      {/* Optional On Strike Indicator */}
      {showStrikeBadge && isOnStrike && (
        <div
          title="On Strike"
          className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#050b18] shadow-md"
        />
      )}
    </div>
  );
};
