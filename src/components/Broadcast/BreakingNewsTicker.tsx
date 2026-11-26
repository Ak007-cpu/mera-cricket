import React from 'react';
import { NewsItem } from '../../types/cricket';
import { Radio } from 'lucide-react';

interface BreakingNewsTickerProps {
  items: NewsItem[];
  onOpenNews?: () => void;
}

export const BreakingNewsTicker: React.FC<BreakingNewsTickerProps> = ({ items, onOpenNews }) => {
  if (!items || items.length === 0) return null;

  const hasBreaking = items.some((i) => i.isBreaking);
  const tickerText = items
    .map((item) =>
      item.isBreaking
        ? `[BREAKING] ${item.title} — ${item.description}`
        : `${item.title} — ${item.description}`
    )
    .join('   •   ');

  return (
    <div className="max-w-7xl mx-auto w-full shrink-0 mt-1.5">
      <a
        href="?page=news"
        onClick={(e) => {
          if (onOpenNews) {
            e.preventDefault();
            onOpenNews();
          }
        }}
        className="flex items-center overflow-hidden rounded-xl bg-white/95 dark:bg-[#091229]/90 border border-slate-300 dark:border-sky-400/25 hover:border-sky-500 dark:hover:border-sky-400/50 transition-colors shadow-sm dark:shadow-none"
      >
        <div
          className={`px-3 py-1.5 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${
            hasBreaking ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>{hasBreaking ? 'Breaking' : 'Update'}</span>
        </div>

        <div className="relative flex-1 overflow-hidden py-1.5 px-3">
          <div className="flex w-max animate-ticker-marquee whitespace-nowrap text-xs font-medium text-slate-900 dark:text-slate-100">
            <span className="pr-12">{tickerText}</span>
            <span className="pr-12" aria-hidden="true">
              {tickerText}
            </span>
          </div>
        </div>
      </a>
    </div>
  );
};
