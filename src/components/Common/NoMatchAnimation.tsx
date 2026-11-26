import React from 'react';
import { NextMatchNoticeConfig } from '../../types/cricket';

interface NoMatchAnimationProps {
  nextMatch?: NextMatchNoticeConfig | null;
  compact?: boolean;
  title?: string;
  subtitle?: string;
  forceDarkPanel?: boolean;
}

function formatNextMatchLine(nextMatch?: NextMatchNoticeConfig | null): string {
  if (!nextMatch) return '';
  const name = (nextMatch.matchName || '').trim();
  const time = (nextMatch.matchTime || '').trim();
  if (!name && !time) return '';
  const combined = name && time ? `${name}, ${time}` : name || time;
  return /^next\s*:/i.test(combined) ? combined : `Next: ${combined}`;
}

export const NoMatchAnimation: React.FC<NoMatchAnimationProps> = ({
  nextMatch,
  compact = false,
  title = 'No Live Match Right Now',
  subtitle = 'Aane wale match ka intezar karein',
  forceDarkPanel = false
}) => {
  const nextLine = formatNextMatchLine(nextMatch);

  return (
    <div
      className={`relative flex flex-col items-center justify-center text-center select-none ${
        compact ? 'py-2 px-4' : 'py-8 px-6'
      }`}
    >
      {/* Subtle Stadium-Light Ambient Glow behind Bat & Ball */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[240px] rounded-full blur-3xl animate-stadium-glow"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(56, 189, 248, 0.22) 0%, rgba(16, 185, 129, 0.14) 42%, rgba(251, 191, 36, 0.08) 65%, transparent 80%)'
        }}
      />

      {/* Pure GPU Bat & Ball Loop Stage (Static crisp mark when reduced-motion is ON) */}
      <div
        aria-hidden="true"
        className={`relative w-[260px] h-[196px] overflow-visible shrink-0 ${
          compact ? 'scale-95 sm:scale-100' : 'scale-105 sm:scale-110'
        }`}
      >
        {/* Subtle Stadium Horizon Arc */}
        <div
          className="absolute inset-x-4 bottom-4 h-12 rounded-[100%] border-t border-white/10"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(16, 185, 129, 0.16) 0%, transparent 72%)'
          }}
        />

        {/* Cricket Bat (pivots cleanly at top grip) */}
        <div
          className="absolute left-[116px] top-[34px] w-[28px] h-[118px] animate-nomatch-bat"
          style={{ transform: 'rotate(-14deg)' }}
        >
          <svg
            viewBox="0 0 36 140"
            className="w-full h-full drop-shadow-[0_10px_18px_rgba(0,0,0,0.65)]"
            fill="none"
          >
            <defs>
              <linearGradient id="nomatchBatWillow" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f3d5a5" />
                <stop offset="55%" stopColor="#d9a86c" />
                <stop offset="100%" stopColor="#b07d44" />
              </linearGradient>
              <linearGradient id="nomatchBatGrip" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            {/* Rubber Grip & Handle */}
            <rect x="14.5" y="4" width="7" height="36" rx="3.5" fill="url(#nomatchBatGrip)" />
            <rect x="14" y="10" width="8" height="3" rx="1" fill="#fbbf24" opacity="0.9" />
            <rect x="14" y="20" width="8" height="2.5" rx="1" fill="#34d399" opacity="0.85" />
            {/* Shoulders & Willow Blade */}
            <path
              d="M14.5 39 L8 49 C6.5 51.5 6 54.5 6 58 L6 126 C6 132 11 136 18 136 C25 136 30 132 30 126 L30 58 C30 54.5 29.5 51.5 28 49 L21.5 39 Z"
              fill="url(#nomatchBatWillow)"
              stroke="#784b20"
              strokeWidth="1.2"
            />
            {/* Center Spine Highlight */}
            <path
              d="M18 44 L18 130"
              stroke="#fff3d6"
              strokeWidth="1.4"
              strokeLinecap="round"
              opacity="0.55"
            />
          </svg>
        </div>

        {/* Impact Flash Ring + "TAK!" Micro Callout */}
        <div
          className="absolute left-[112px] top-[108px] w-9 h-9 rounded-full opacity-0 animate-nomatch-flash pointer-events-none flex items-center justify-center"
          style={{
            background:
              'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(251,191,36,0.75) 38%, rgba(56,189,248,0.35) 68%, transparent 78%)'
          }}
        >
          <span className="-translate-y-6 font-score text-[10px] font-black tracking-widest text-amber-200 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)]">
            TAK!
          </span>
        </div>

        {/* 3-Color Impact Burst (Blue, Gold, Green) */}
        <span className="absolute left-[127px] top-[123px] w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8] opacity-0 animate-nomatch-burst-blue pointer-events-none" />
        <span className="absolute left-[127px] top-[123px] w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_#fbbf24] opacity-0 animate-nomatch-burst-gold pointer-events-none" />
        <span className="absolute left-[127px] top-[123px] w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] opacity-0 animate-nomatch-burst-green pointer-events-none" />

        {/* Cricket Ball (Default resting position for reduced-motion; animated in 3-shot loop otherwise) */}
        <div
          className="absolute left-[122px] top-[118px] w-4 h-4 rounded-full animate-nomatch-ball shadow-[0_0_14px_rgba(244,63,94,0.85)]"
          style={{
            transform: 'translate3d(24px, -10px, 0)',
            background: 'radial-gradient(circle at 32% 30%, #fb7185 0%, #e11d48 52%, #881337 100%)',
            border: '1px solid rgba(255,255,255,0.45)'
          }}
        >
          {/* Crisp stitched seam */}
          <span className="absolute inset-y-0.5 left-1/2 -translate-x-1/2 w-[1.5px] border-l border-dashed border-amber-100/90 rotate-12" />
        </div>
      </div>

      {/* Clean No-Match Copy */}
      <div className="relative z-10 mt-1 space-y-1.5 max-w-sm">
        <h2
          className={`font-cricket text-xl sm:text-2xl font-black tracking-tight ${
            forceDarkPanel ? 'text-white' : 'text-slate-950 dark:text-white'
          }`}
        >
          {title}
        </h2>
        <p
          className={`text-sm font-medium ${
            forceDarkPanel ? 'text-slate-300' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {subtitle}
        </p>

        {nextLine && (
          <div className="pt-2 flex justify-center">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-score font-bold ${
                forceDarkPanel
                  ? 'bg-white/[0.06] border border-sky-400/35 text-amber-300 shadow-[0_0_18px_rgba(56,189,248,0.12)]'
                  : 'bg-white dark:bg-white/[0.06] border border-sky-600/35 dark:border-sky-400/35 text-amber-800 dark:text-amber-300 shadow-sm dark:shadow-[0_0_18px_rgba(56,189,248,0.12)]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
              <span>{nextLine}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
