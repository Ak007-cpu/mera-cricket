import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Film, Globe, Play, Youtube } from 'lucide-react';
import { VideoSourceType } from '../../types/cricket';
import { buildApiUrl } from '../../services/api';
import { extractYouTubeVideoId } from '../Common/HoldYouTubePlayer';

interface VideoSourceThumbnailProps {
  name: string;
  url: string;
  sourceType: VideoSourceType;
  durationSec?: number;
  isOnAir?: boolean;
  isPreviewOpen?: boolean;
  size?: 'sm' | 'md';
  onTogglePreview?: () => void;
}

// In-memory cache of captured video frame data URLs keyed by resolved video URL
const videoFrameThumbCache = new Map<string, string>();

function formatDurationLabel(seconds?: number): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (!total) return '';
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function resolveMediaUrl(rawUrl: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return buildApiUrl(trimmed);
  return trimmed;
}

function parseStreamDescriptor(rawUrl: string): {
  hostname: string;
  pathLabel: string;
  extLabel: string;
  isPublicDomain: boolean;
} {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { hostname: 'Stream URL', pathLabel: '', extLabel: 'STREAM', isPublicDomain: false };
  }
  if (trimmed.startsWith('/')) {
    const clean = trimmed.split(/[?#]/)[0];
    const file = clean.split('/').filter(Boolean).pop() || clean;
    const ext = file.includes('.') ? file.split('.').pop()?.toUpperCase() || 'LOCAL' : 'LOCAL';
    return {
      hostname: 'Local Server',
      pathLabel: file,
      extLabel: ext.slice(0, 6),
      isPublicDomain: false
    };
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`);
    const hostname = parsed.hostname.replace(/^www\./i, '');
    const portSuffix = parsed.port ? `:${parsed.port}` : '';
    const lastSeg = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const extMatch = lastSeg.match(/\.([a-z0-9]{2,5})$/i);
    const isIpOrLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);

    return {
      hostname: `${hostname}${portSuffix}`,
      pathLabel: lastSeg || parsed.pathname,
      extLabel: extMatch ? extMatch[1].toUpperCase() : 'LIVE',
      isPublicDomain: !isIpOrLocal && hostname.includes('.')
    };
  } catch {
    return {
      hostname: 'Stream Feed',
      pathLabel: trimmed.slice(0, 28),
      extLabel: 'URL',
      isPublicDomain: false
    };
  }
}

export const VideoSourceThumbnail: React.FC<VideoSourceThumbnailProps> = ({
  name,
  url,
  sourceType,
  durationSec,
  isOnAir = false,
  isPreviewOpen = false,
  size = 'md',
  onTogglePreview
}) => {
  const youtubeId = useMemo(() => extractYouTubeVideoId(url), [url]);
  const resolvedUrl = useMemo(() => resolveMediaUrl(url), [url]);
  const descriptor = useMemo(() => parseStreamDescriptor(url), [url]);
  const durationLabel = useMemo(() => formatDurationLabel(durationSec), [durationSec]);

  const [ytQualityIndex, setYtQualityIndex] = useState(0);
  const [ytFailed, setYtFailed] = useState(false);

  const [capturedFrame, setCapturedFrame] = useState<string | null>(() =>
    resolvedUrl ? videoFrameThumbCache.get(resolvedUrl) || null : null
  );
  const [videoElementFailed, setVideoElementFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  useEffect(() => {
    setYtQualityIndex(0);
    setYtFailed(false);
    setFaviconFailed(false);
    setVideoElementFailed(false);
    setCapturedFrame(resolvedUrl ? videoFrameThumbCache.get(resolvedUrl) || null : null);
  }, [resolvedUrl, youtubeId]);

  // Extract a crisp video thumbnail frame onto an offscreen canvas for local/direct video URLs
  useEffect(() => {
    if (youtubeId || sourceType !== 'local_video' || !resolvedUrl) return;
    if (videoFrameThumbCache.has(resolvedUrl)) {
      setCapturedFrame(videoFrameThumbCache.get(resolvedUrl) || null);
      return;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';

    const cleanup = () => {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      try {
        video.removeAttribute('src');
        video.load();
      } catch {}
    };

    const captureFrame = () => {
      if (cancelled) return;
      try {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 180;
        if (w <= 0 || h <= 0) return;
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.max(90, Math.round((320 * h) / w));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          videoFrameThumbCache.set(resolvedUrl, dataUrl);
          if (!cancelled) {
            setCapturedFrame(dataUrl);
          }
        }
      } catch {
        // Cross-origin without CORS headers: direct <video> fallback handles rendering cleanly
      } finally {
        cleanup();
      }
    };

    const timeoutId = setTimeout(cleanup, 7000);

    video.onloadedmetadata = () => {
      if (cancelled) return;
      const targetTime =
        Number.isFinite(video.duration) && video.duration > 1.5
          ? Math.min(1.2, video.duration * 0.15)
          : 0.1;
      try {
        video.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    };

    video.onseeked = captureFrame;
    video.onloadeddata = () => {
      if (video.currentTime === 0) {
        captureFrame();
      }
    };
    video.onerror = () => {
      cleanup();
    };

    video.src = resolvedUrl;

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      cleanup();
    };
  }, [youtubeId, sourceType, resolvedUrl]);

  const ytCandidates = youtubeId
    ? [
        `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
      ]
    : [];

  const sizeClass =
    size === 'sm' ? 'w-20 aspect-video rounded-lg' : 'w-28 sm:w-32 aspect-video rounded-xl';

  const renderVisual = () => {
    // 1. YouTube Thumbnail Preview
    if (youtubeId && !ytFailed && ytCandidates[ytQualityIndex]) {
      return (
        <img
          src={ytCandidates[ytQualityIndex]}
          alt={`${name || 'YouTube'} thumbnail`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (ytQualityIndex + 1 < ytCandidates.length) {
              setYtQualityIndex((i) => i + 1);
            } else {
              setYtFailed(true);
            }
          }}
          className="w-full h-full object-cover"
        />
      );
    }

    // 2. Local / Direct Video Thumbnail Preview (Captured Canvas Frame or Metadata Video Poster)
    if (sourceType === 'local_video' && capturedFrame) {
      return (
        <img
          src={capturedFrame}
          alt={`${name || 'Local video'} frame`}
          className="w-full h-full object-cover"
        />
      );
    }

    if (sourceType === 'local_video' && resolvedUrl && !videoElementFailed) {
      return (
        <video
          src={`${resolvedUrl}#t=0.5`}
          preload="metadata"
          muted
          playsInline
          onError={() => setVideoElementFailed(true)}
          className="w-full h-full object-cover pointer-events-none bg-slate-950"
        />
      );
    }

    // 3. Generated Broadcast Poster Preview (Embed / External Stream / Offline Fallback)
    const accentClasses =
      sourceType === 'youtube'
        ? 'from-rose-950 via-slate-950 to-slate-900 text-rose-300'
        : sourceType === 'local_video'
        ? 'from-indigo-950 via-slate-950 to-slate-900 text-indigo-300'
        : 'from-cyan-950 via-slate-950 to-slate-900 text-cyan-300';

    const TypeIcon =
      sourceType === 'youtube' ? Youtube : sourceType === 'local_video' ? Film : Globe;

    return (
      <div
        className={`w-full h-full bg-gradient-to-br ${accentClasses} flex flex-col items-center justify-center p-1.5 text-center relative`}
      >
        <div className="flex items-center gap-1 max-w-full">
          {descriptor.isPublicDomain && !faviconFailed ? (
            <img
              src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(
                descriptor.hostname.split(':')[0]
              )}&sz=32`}
              alt=""
              onError={() => setFaviconFailed(true)}
              className="w-3.5 h-3.5 rounded-xs shrink-0"
            />
          ) : (
            <TypeIcon className="w-3.5 h-3.5 shrink-0 opacity-90" />
          )}
          <span className="text-[9px] font-black uppercase tracking-wider truncate text-white/90">
            {descriptor.extLabel}
          </span>
        </div>
        <span className="text-[9px] font-mono text-slate-300/85 truncate max-w-full mt-0.5 px-1">
          {descriptor.hostname}
        </span>
      </div>
    );
  };

  const innerContent = (
    <>
      {renderVisual()}

      {/* Top-left subtle type/live indicator */}
      <span
        className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider leading-none shadow ${
          isOnAir
            ? 'bg-emerald-500 text-slate-950'
            : sourceType === 'youtube'
            ? 'bg-rose-600/90 text-white'
            : sourceType === 'local_video'
            ? 'bg-indigo-600/90 text-white'
            : 'bg-cyan-600/90 text-white'
        }`}
      >
        {isOnAir ? 'LIVE' : sourceType === 'youtube' ? 'YT' : sourceType === 'local_video' ? 'MP4' : 'URL'}
      </span>

      {/* Bottom-right duration badge */}
      {durationLabel && size === 'md' && (
        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono tabular-nums text-[9px] font-bold leading-none">
          {durationLabel}
        </span>
      )}

      {/* Hover / Active Preview Cue when clickable */}
      {onTogglePreview && (
        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            isPreviewOpen
              ? 'bg-indigo-950/60 opacity-100'
              : 'bg-black/45 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
          }`}
        >
          <span className="w-7 h-7 rounded-full bg-black/75 border border-white/30 text-white flex items-center justify-center shadow">
            {isPreviewOpen ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : sourceType === 'embed' ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 ml-0.5" />
            )}
          </span>
        </span>
      )}
    </>
  );

  if (onTogglePreview) {
    return (
      <button
        type="button"
        onClick={onTogglePreview}
        aria-label={isPreviewOpen ? `Hide preview for ${name}` : `Preview ${name}`}
        title={isPreviewOpen ? 'Hide live preview' : 'Click to toggle live player preview'}
        className={`group relative ${sizeClass} overflow-hidden bg-slate-900 border shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
          isOnAir
            ? 'border-emerald-400/80'
            : isPreviewOpen
            ? 'border-indigo-400'
            : 'border-slate-700 hover:border-slate-500'
        }`}
      >
        {innerContent}
      </button>
    );
  }

  return (
    <div
      className={`relative ${sizeClass} overflow-hidden bg-slate-900 border border-slate-700 shrink-0`}
    >
      {innerContent}
    </div>
  );
};
