import React, { useEffect, useMemo, useState } from 'react';
import { CricketNewsSettings, FetchedCricketNewsItem, NewsCategory } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import { buildApiUrl, fetchPublicCricketNewsFeed } from '../../services/api';
import { ArrowRight, ExternalLink, Newspaper, Pin, Radio, User, X } from 'lucide-react';

interface BroadcastCricketNewsSectionProps {
  onOpenNews?: () => void;
  isDemoPreview?: boolean;
}

interface DisplayNewsCard {
  id: string;
  title: string;
  description: string;
  body: string;
  imageUrl: string;
  date: string;
  category: NewsCategory;
  pinned: boolean;
  isBreaking: boolean;
  sourceLabel: string;
  playerName?: string;
  teamCode?: string;
  articleUrl?: string;
  isAdminPublished: boolean;
}

function resolveDisplayImageUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/')) {
    return buildApiUrl(trimmed);
  }
  return trimmed;
}

export const BroadcastCricketNewsSection: React.FC<BroadcastCricketNewsSectionProps> = ({
  onOpenNews,
  isDemoPreview = false
}) => {
  const { news } = useContent();
  const [feedItems, setFeedItems] = useState<FetchedCricketNewsItem[]>([]);
  const [feedSettings, setFeedSettings] = useState<CricketNewsSettings | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [selectedArticle, setSelectedArticle] = useState<DisplayNewsCard | null>(null);

  useEffect(() => {
    if (isDemoPreview) return;
    let mounted = true;

    const loadFeed = () => {
      fetchPublicCricketNewsFeed()
        .then((res) => {
          if (!mounted) return;
          setFeedSettings(res.settings);
          setFeedItems(res.enabled ? res.items : []);
        })
        .catch(() => {});
    };

    loadFeed();
    const timer = setInterval(loadFeed, 180_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [isDemoPreview]);

  const cards = useMemo<DisplayNewsCard[]>(() => {
    const adminCards: DisplayNewsCard[] = news.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      body: item.body || item.description,
      imageUrl: resolveDisplayImageUrl(item.featuredImageUrl || item.imageUrl),
      date: item.date,
      category: item.category,
      pinned: item.pinned,
      isBreaking: item.isBreaking,
      sourceLabel: 'Official Desk',
      isAdminPublished: true
    }));

    const seenTitles = new Set(
      adminCards.map((c) => c.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48))
    );
    const seenIds = new Set(adminCards.map((c) => c.id));

    const autoCards: DisplayNewsCard[] = [];
    for (const f of feedItems) {
      const normTitle = f.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
      if (!normTitle || seenTitles.has(normTitle) || seenIds.has(f.id)) continue;
      seenTitles.add(normTitle);
      seenIds.add(f.id);
      autoCards.push({
        id: f.id,
        title: f.title,
        description: f.description,
        body: f.description,
        imageUrl: resolveDisplayImageUrl(f.recommendedImageUrl || f.playerImageUrl || f.articleImageUrl),
        date: f.date,
        category: f.suggestedCategory,
        pinned: false,
        isBreaking: f.suggestedCategory === 'Breaking',
        sourceLabel: f.sourceName,
        playerName: f.matchedPlayerName,
        teamCode: f.matchedTeamCode,
        articleUrl: f.articleUrl,
        isAdminPublished: false
      });
    }

    const maxFeedLimit = feedSettings?.maxItems || 6;
    return [...adminCards, ...autoCards].slice(0, Math.max(6, adminCards.length + maxFeedLimit));
  }, [news, feedItems, feedSettings?.maxItems]);

  const markImageFailed = (id: string) => {
    setFailedImages((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  return (
    <section
      aria-label="Cricket News & Player Updates"
      className="bg-white/95 dark:bg-[#0a1329]/90 backdrop-blur-md border border-slate-300 dark:border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-md dark:shadow-xl space-y-4"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-500/15 border border-sky-300 dark:border-sky-400/40 flex items-center justify-center shrink-0">
            <Newspaper className="w-4 h-4 text-sky-700 dark:text-sky-300" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-950 dark:text-white truncate">
              Cricket News &amp; Player Updates
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 truncate">
              Verified match stories, breaking updates, and cricket headlines with player portraits
            </p>
          </div>
        </div>

        {onOpenNews && (
          <a
            href="?page=news"
            onClick={(e) => {
              e.preventDefault();
              onOpenNews();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/15 hover:bg-sky-100 dark:hover:bg-sky-500/25 border border-sky-300 dark:border-sky-400/40 text-xs font-bold text-sky-900 dark:text-sky-200 transition-colors shrink-0"
          >
            <span>All News</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* News Cards Grid */}
      {cards.length === 0 ? (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-dashed border-slate-300 dark:border-slate-800 p-6 text-center space-y-1.5">
          <Newspaper className="w-7 h-7 text-slate-400 dark:text-slate-600 mx-auto" />
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
            Abhi koi Cricket News publish nahi hui hai
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Studio Admin &rarr; News Management tab se custom articles add karein ya Cricket News Source se auto-fetch ON karein.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {cards.map((card, cardIdx) => {
            const hasImage = Boolean(card.imageUrl && !failedImages[card.id]);
            return (
              <article
                key={`${card.id}_${cardIdx}`}
                onClick={() => setSelectedArticle(card)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedArticle(card);
                  }
                }}
                className={`group cursor-pointer rounded-xl border p-3.5 transition-colors flex gap-3.5 items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  card.pinned
                    ? 'bg-amber-50/70 dark:bg-amber-500/5 border-amber-400/70 dark:border-amber-400/40 hover:border-amber-500 dark:hover:border-amber-300/70'
                    : 'bg-slate-50/80 dark:bg-slate-950/65 border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500/50'
                }`}
              >
                {/* Player / News Portrait Frame */}
                <div className="w-20 h-24 sm:w-22 sm:h-24 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-700/80 shrink-0 relative flex items-center justify-center">
                  {hasImage ? (
                    <img
                      src={card.imageUrl}
                      alt={card.playerName || card.title}
                      referrerPolicy="no-referrer"
                      onError={() => markImageFailed(card.id)}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 p-2">
                      <User className="w-6 h-6" />
                      <span className="text-[9px] font-bold uppercase mt-1">Cricket</span>
                    </div>
                  )}
                </div>

                {/* Story Body */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center flex-wrap gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <span className="font-extrabold text-sky-700 dark:text-sky-300">
                      {card.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[10px]">{card.date}</span>
                    {card.pinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-300 font-bold">
                          <Pin className="w-3 h-3" /> Pinned
                        </span>
                      </>
                    )}
                    {card.isBreaking && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-black uppercase">
                          <Radio className="w-3 h-3" /> Breaking
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="text-sm font-black text-slate-950 dark:text-white leading-snug line-clamp-2 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                    {card.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                    {card.description}
                  </p>

                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                    <span className="truncate">
                      {card.playerName ? `${card.playerName}${card.teamCode ? ` (${card.teamCode})` : ''}` : card.sourceLabel}
                    </span>
                    <span className="text-sky-700 dark:text-sky-400 shrink-0 font-bold">
                      Read &rarr;
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Clean Article Reader Modal */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="bg-white dark:bg-[#0a1329] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedArticle.imageUrl && !failedImages[selectedArticle.id] && (
              <div className="h-56 sm:h-64 bg-slate-200 dark:bg-slate-950 relative overflow-hidden">
                <img
                  src={selectedArticle.imageUrl}
                  alt={selectedArticle.playerName || selectedArticle.title}
                  referrerPolicy="no-referrer"
                  onError={() => markImageFailed(selectedArticle.id)}
                  className="w-full h-full object-cover object-top"
                />
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  aria-label="Close article"
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/75 text-white flex items-center justify-center hover:bg-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-extrabold text-sky-700 dark:text-sky-300">
                    {selectedArticle.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{selectedArticle.date}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedArticle.playerName || selectedArticle.sourceLabel}</span>
                </div>
                {(!selectedArticle.imageUrl || failedImages[selectedArticle.id]) && (
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    aria-label="Close article"
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <h3 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white leading-snug">
                {selectedArticle.title}
              </h3>

              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedArticle.body || selectedArticle.description}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                {selectedArticle.articleUrl ? (
                  <a
                    href={selectedArticle.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-300 hover:underline"
                  >
                    <span>Read Full Story on {selectedArticle.sourceLabel}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Published via {selectedArticle.sourceLabel}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  {onOpenNews && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArticle(null);
                        onOpenNews();
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
                    >
                      Open News Page
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(null)}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
