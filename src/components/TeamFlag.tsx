import React, { useState, useEffect } from 'react';
import { getTeamFlagUrl, NATIONAL_TEAM_MAP, getTeamBadgeSvg } from '../utils/teamFlags';
import { getStoredTeamFlag, MEDIA_UPDATED_EVENT } from '../utils/mediaStorage';

interface TeamFlagProps {
  teamName: string;
  teamCode?: string;
  logoUrl?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'rounded' | 'rect';
  alt?: string;
}

export const TeamFlag: React.FC<TeamFlagProps> = ({
  teamName,
  teamCode,
  logoUrl,
  className = '',
  size = 'md',
  shape = 'circle',
  alt
}) => {
  const [errorCount, setErrorCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [mediaVersion, setMediaVersion] = useState(0);

  useEffect(() => {
    const handler = () => setMediaVersion((v) => v + 1);
    window.addEventListener(MEDIA_UPDATED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(MEDIA_UPDATED_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  // Reset error state when teamName, logoUrl, or stored media changes
  useEffect(() => {
    setErrorCount(0);
    setLoaded(false);
  }, [teamName, teamCode, logoUrl, mediaVersion]);

  const identifier = (teamCode || teamName || 'CRX').trim();
  const upper = identifier.toUpperCase();
  const storedFlag = getStoredTeamFlag(teamName, teamCode);

  // Determine size classes
  const sizeClasses = {
    xs: 'w-5 h-5 min-w-[20px]',
    sm: 'w-7 h-7 min-w-[28px]',
    md: 'w-10 h-10 min-w-[40px]',
    lg: 'w-14 h-14 min-w-[56px]',
    xl: 'w-16 h-16 min-w-[64px]'
  };

  const shapeClasses = {
    circle: 'rounded-full overflow-hidden object-cover',
    rounded: 'rounded-xl overflow-hidden object-cover',
    rect: 'rounded-md overflow-hidden object-cover'
  };

  // Resolve source URL progressively
  const getSourceUrl = (): string => {
    if (errorCount === 0) {
      if (logoUrl && logoUrl.startsWith('/api/player/uploaded/')) {
        return logoUrl;
      }
      if (storedFlag) {
        return storedFlag;
      }
      if (
        logoUrl &&
        !logoUrl.includes('images.icc-cricket.com/image/upload/t_ratio21_9-size40/prd/assets/flags/')
      ) {
        return logoUrl;
      }
      return getTeamFlagUrl(identifier);
    }

    if (errorCount === 1) {
      if (storedFlag) {
        return storedFlag;
      }
      const national = NATIONAL_TEAM_MAP[upper];
      if (national) {
        return `https://flagcdn.com/w320/${national.iso}.png`;
      }
      return `/api/team/flag/${encodeURIComponent(upper.slice(0, 4))}`;
    }

    // Third fallback: SVG badge
    return getTeamBadgeSvg(identifier);
  };

  const currentSrc = getSourceUrl();
  const code = (teamCode || teamName || 'CR').slice(0, 3).toUpperCase();

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 bg-slate-950 border border-slate-700/80 shadow-md ${sizeClasses[size]} ${shapeClasses[shape]} ${className}`}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800 text-slate-300 font-bold font-mono text-[10px] animate-pulse">
          {code}
        </div>
      )}
      <img
        src={currentSrc}
        alt={alt || `${teamName} Flag`}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (errorCount < 2) {
            setErrorCount((prev) => prev + 1);
          } else {
            setLoaded(true); // Stop loading pulse on final SVG fallback
          }
        }}
        loading="lazy"
      />
    </div>
  );
};
