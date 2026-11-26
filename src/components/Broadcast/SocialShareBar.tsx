import React, { useMemo, useState } from 'react';
import { Check, Copy, Eye, Share2, X } from 'lucide-react';
import { MatchState } from '../../types/cricket';

interface SocialShareBarProps {
  match: MatchState;
  className?: string;
}

export function buildMatchShareMessage(match: MatchState, shareUrl: string): string {
  const { battingTeam, bowlingTeam, striker, nonStriker, currentBowler } = match;
  const batCode = battingTeam.shortName || battingTeam.code || battingTeam.name;
  const bowlCode = bowlingTeam.shortName || bowlingTeam.code || bowlingTeam.name;

  const lines: string[] = [
    `${battingTeam.name} vs ${bowlingTeam.name} (${match.matchType})`,
    `${batCode}: ${battingTeam.score.runs}/${battingTeam.score.wickets} (${battingTeam.score.overs}.${battingTeam.score.balls} ov) | CRR ${match.currentRunRate.toFixed(2)}`
  ];

  if (bowlingTeam.score.runs > 0 || bowlingTeam.score.wickets > 0) {
    lines.push(
      `${bowlCode}: ${bowlingTeam.score.runs}/${bowlingTeam.score.wickets} (${bowlingTeam.score.overs}.${bowlingTeam.score.balls} ov)`
    );
  }

  if (match.statusText?.trim()) {
    lines.push(`Status: ${match.statusText.trim()}`);
  }

  if (match.target && match.target > 0 && match.gameState !== 'completed') {
    const chasePart =
      match.requiredRuns !== undefined && match.remainingBalls !== undefined
        ? `Need ${match.requiredRuns} off ${match.remainingBalls} balls`
        : '';
    lines.push(`Target: ${match.target}${chasePart ? ` (${chasePart})` : ''}`);
  }

  if (match.gameState !== 'completed') {
    const batters: string[] = [];
    if (striker?.name) batters.push(`${striker.name} ${striker.runs}*(${striker.balls})`);
    if (nonStriker?.name) batters.push(`${nonStriker.name} ${nonStriker.runs}(${nonStriker.balls})`);
    if (batters.length > 0) {
      lines.push(`Bat: ${batters.join(' | ')}`);
    }
    if (currentBowler?.name) {
      lines.push(
        `Bowl: ${currentBowler.name} ${currentBowler.wickets}/${currentBowler.runs} (${currentBowler.overs} ov)`
      );
    }
  }

  if (shareUrl) {
    lines.push(shareUrl);
  }

  return lines.join('\n');
}

export const SocialShareBar: React.FC<SocialShareBarProps> = ({ match, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}`;
  }, []);

  const shareMessage = useMemo(() => buildMatchShareMessage(match, shareUrl), [match, shareUrl]);

  const twitterHref = useMemo(
    () => `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`,
    [shareMessage]
  );

  const whatsappHref = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
    [shareMessage]
  );

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        const area = document.createElement('textarea');
        area.value = shareMessage;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Unable to copy share text:', err);
    }
  };

  return (
    <div className={`relative flex items-center flex-wrap gap-2 ${className}`}>
      {showPreview && (
        <div
          role="dialog"
          aria-label="Share message preview"
          className="absolute bottom-full right-0 mb-2 z-50 w-[min(92vw,360px)] rounded-xl bg-white dark:bg-[#0a1329]/95 backdrop-blur-md border border-slate-300 dark:border-sky-400/30 p-3.5 shadow-2xl text-left"
        >
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 dark:border-sky-400/15">
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-300">Share Message Preview</span>
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              aria-label="Close message preview"
              className="p-1 rounded-md text-slate-500 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-200 select-text">
            {shareMessage}
          </pre>
        </div>
      )}

      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 mr-0.5">
        <Share2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
        <span>Share Score</span>
      </span>

      <a
        href={twitterHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share live scorecard on Twitter"
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 hover:border-sky-400 dark:bg-[#0d1936] dark:hover:bg-sky-500/20 dark:text-sky-200 dark:hover:text-white dark:border-sky-400/30 dark:hover:border-sky-400/70 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span>Twitter</span>
      </a>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share live scorecard on WhatsApp"
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 hover:border-emerald-400 dark:bg-[#0b2320] dark:hover:bg-emerald-500/20 dark:text-emerald-200 dark:hover:text-white dark:border-emerald-400/35 dark:hover:border-emerald-400/75 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12.031 2C6.506 2 2.022 6.484 2.02 12.008c0 1.766.462 3.49 1.339 5.01L2 22l5.102-1.337a9.975 9.975 0 0 0 4.928 1.298h.004c5.523 0 10.008-4.485 10.01-10.01C22.046 6.487 17.557 2 12.031 2Zm5.828 14.23c-.248.698-1.434 1.33-1.994 1.414-.507.075-1.15.107-1.856-.117-.428-.136-.978-.318-1.685-.623-2.963-1.279-4.897-4.264-5.045-4.46-.147-.197-1.204-1.602-1.204-3.056 0-1.454.762-2.169 1.032-2.464.27-.295.59-.369.786-.369.197 0 .394.002.566.01.182.009.425-.069.664.506.246.591.836 2.044.91 2.192.074.148.123.32.025.517-.098.197-.147.32-.295.492-.148.172-.31.385-.443.517-.148.147-.302.307-.13.602.172.295.764 1.261 1.641 2.043 1.128 1.005 2.08 1.317 2.375 1.464.295.148.467.123.64-.074.172-.197.738-.86.935-1.155.197-.295.393-.246.663-.148.271.099 1.723.812 2.018.96.295.147.492.221.566.344.074.123.074.714-.174 1.413Z" />
        </svg>
        <span>WhatsApp</span>
      </a>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy formatted live score"
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 dark:hover:text-white dark:border-slate-700/80 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            <span>Copy</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={() => setShowPreview((prev) => !prev)}
        aria-expanded={showPreview}
        aria-label="Preview share message"
        className={`inline-flex items-center justify-center gap-1 min-h-[40px] sm:min-h-[34px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
          showPreview
            ? 'bg-sky-100 text-sky-900 border-sky-400 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-400/50'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-950 border-slate-300 dark:bg-slate-900/70 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-200 dark:border-slate-800'
        }`}
      >
        <Eye className="w-3.5 h-3.5" />
        <span>Preview</span>
      </button>
    </div>
  );
};
