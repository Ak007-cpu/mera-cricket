import React, { useState } from 'react';
import { NewsCategory, NewsItem } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import { buildApiUrl } from '../../services/api';
import { ThemeToggleButton } from '../Common/ThemeToggleButton';
import { ArrowLeft, BookOpen, Newspaper, Pin, Radio, X } from 'lucide-react';

interface NewsPageProps {
  siteName?: string;
  onBackToBroadcast: () => void;
  onOpenBlog: () => void;
}

const FILTER_OPTIONS: Array<'All' | NewsCategory> = [
  'All',
  'International',
  'Domestic',
  'ICC',
  'Breaking',
  'Match Update',
  'Transfer',
  'General'
];

function resolveFeaturedImage(item: NewsItem): string {
  const raw = (item.featuredImageUrl || item.imageUrl || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/')) return buildApiUrl(raw);
  return raw;
}

export const NewsPage: React.FC<NewsPageProps> = ({ siteName = 'Live Cricket HD', onBackToBroadcast, onOpenBlog }) => {
  const { news } = useContent();
  const [filter, setFilter] = useState<'All' | NewsCategory>('All');
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);

  const filteredNews = filter === 'All' ? news : news.filter((item) => item.category === filter);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-300 dark:border-sky-400/15 bg-white/95 dark:bg-[#050c1d]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToBroadcast}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-sky-700 hover:text-slate-950 dark:text-sky-300 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Live Broadcast</span>
          </button>

          <span className="text-sm sm:text-base font-black text-slate-950 dark:text-white truncate">
            {siteName} News
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggleButton variant="broadcast" />
            <button
              type="button"
              onClick={onOpenBlog}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <BookOpen className="w-4 h-4" />
              <span>Blog</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
              Latest Cricket News &amp; Live Updates
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Match updates, breaking headlines, team transfers, and verified announcements.
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 overflow-x-auto max-w-full shadow-xs dark:shadow-none">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  filter === opt
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {filteredNews.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0a1329]/80 border border-slate-300 dark:border-slate-800 p-10 text-center space-y-3 shadow-sm dark:shadow-none">
            <Newspaper className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-200">No updates published yet</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Stay tuned for live cricket breaking updates and match highlights.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {filteredNews.map((item, idx) => {
              const featuredImg = resolveFeaturedImage(item);
              const fullBody = item.body || item.description;
              const isLongBody = fullBody.length > 260;

              return (
                <article
                  key={item.id}
                  onClick={() => setSelectedArticle(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedArticle(item);
                    }
                  }}
                  className={`group cursor-pointer rounded-2xl bg-white dark:bg-[#0a1329]/80 border overflow-hidden flex flex-col shadow-sm dark:shadow-none transition-colors hover:border-sky-400 dark:hover:border-sky-400/50 text-left ${
                    idx === 0 && item.pinned
                      ? 'md:col-span-2 border-amber-500/60 dark:border-amber-400/40'
                      : 'border-slate-300 dark:border-sky-400/20'
                  }`}
                >
                  {featuredImg && (
                    <div className={`${idx === 0 && item.pinned ? 'h-56 sm:h-72' : 'h-48'} bg-slate-200 dark:bg-slate-950 overflow-hidden`}>
                      <img
                        src={featuredImg}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}

                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-bold text-sky-700 dark:text-sky-300">{item.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.date}</span>
                        {item.pinned && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                              <Pin className="w-3 h-3" /> Pinned
                            </span>
                          </>
                        )}
                        {item.isBreaking && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                              <Radio className="w-3 h-3" /> Breaking
                            </span>
                          </>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-xl font-black text-slate-950 dark:text-white leading-snug group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                        {item.title}
                      </h2>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-4">
                        {item.description || fullBody}
                      </p>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-400">
                      <span>{isLongBody ? 'Read Full Article →' : 'View Story →'}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Full Article Modal */}
      {selectedArticle && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="bg-white dark:bg-[#0a1329] border border-slate-300 dark:border-slate-700 rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {resolveFeaturedImage(selectedArticle) && (
              <div className="h-56 sm:h-72 bg-slate-200 dark:bg-slate-950 relative overflow-hidden">
                <img
                  src={resolveFeaturedImage(selectedArticle)}
                  alt={selectedArticle.title}
                  referrerPolicy="no-referrer"
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

            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-extrabold text-sky-700 dark:text-sky-300">{selectedArticle.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">{selectedArticle.date}</span>
                  {selectedArticle.pinned && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    </>
                  )}
                  {selectedArticle.isBreaking && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                        <Radio className="w-3 h-3" /> Breaking
                      </span>
                    </>
                  )}
                </div>

                {!resolveFeaturedImage(selectedArticle) && (
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

              <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-snug">
                {selectedArticle.title}
              </h2>

              <div className="text-sm sm:text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {selectedArticle.body || selectedArticle.description}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedArticle(null)}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-200 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
