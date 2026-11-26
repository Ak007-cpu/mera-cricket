import React from 'react';
import { BlogPost } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import { ThemeToggleButton } from '../Common/ThemeToggleButton';
import { ArticleRenderer } from './ArticleRenderer';
import { ArrowLeft, ArrowRight, BookOpen, Calendar, Newspaper } from 'lucide-react';

interface BlogListPageProps {
  siteName?: string;
  onSelectArticle: (slugOrId: string) => void;
  onBackToBroadcast: () => void;
  onOpenNews: () => void;
}

export const BlogListPage: React.FC<BlogListPageProps> = ({
  siteName = 'Live Cricket HD',
  onSelectArticle,
  onBackToBroadcast,
  onOpenNews
}) => {
  const { publishedBlogs } = useContent();

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-slate-100 flex flex-col">
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
            {siteName} Blog
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggleButton variant="broadcast" />
            <button
              type="button"
              onClick={onOpenNews}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <Newspaper className="w-4 h-4" />
              <span>News</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Cricket Analysis &amp; Stories
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            In-depth match previews, tactical breakdowns, and featured cricket editorials.
          </p>
        </div>

        {publishedBlogs.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-[#0a1329]/80 border border-slate-300 dark:border-slate-800 p-10 text-center space-y-3 shadow-sm dark:shadow-none">
            <BookOpen className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-200">No published articles yet</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Check back soon for match stories and tactical cricket columns.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {publishedBlogs.map((post, idx) => (
              <article
                key={post.id}
                className={`rounded-2xl bg-white dark:bg-[#0a1329]/80 border border-slate-300 dark:border-sky-400/20 hover:border-sky-500 dark:hover:border-sky-400/50 transition-colors overflow-hidden flex flex-col shadow-sm dark:shadow-none ${
                  idx === 0 ? 'md:col-span-2' : ''
                }`}
              >
                {post.coverImageUrl && (
                  <a
                    href={`?page=blog&article=${encodeURIComponent(post.slug || post.id)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onSelectArticle(post.slug || post.id);
                    }}
                    className={`block bg-slate-200 dark:bg-slate-950 overflow-hidden ${
                      idx === 0 ? 'h-56 sm:h-80' : 'h-48'
                    }`}
                  >
                    <img
                      src={post.coverImageUrl}
                      alt={post.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </a>
                )}

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span className="font-mono">{post.publishedAt || 'Latest'}</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight">
                      <a
                        href={`?page=blog&article=${encodeURIComponent(post.slug || post.id)}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onSelectArticle(post.slug || post.id);
                        }}
                        className="hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                      >
                        {post.title}
                      </a>
                    </h2>

                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-3">
                      {post.excerpt || post.content.replace(/[#*!\[\]()]/g, '').slice(0, 180)}
                    </p>
                  </div>

                  <div>
                    <a
                      href={`?page=blog&article=${encodeURIComponent(post.slug || post.id)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectArticle(post.slug || post.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 transition-colors min-h-[36px]"
                    >
                      <span>Read Full Article</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

interface BlogArticlePageProps {
  articleSlugOrId: string;
  siteName?: string;
  onBackToBlogList: () => void;
  onBackToBroadcast: () => void;
}

export const BlogArticlePage: React.FC<BlogArticlePageProps> = ({
  articleSlugOrId,
  siteName = 'Live Cricket HD',
  onBackToBlogList,
  onBackToBroadcast
}) => {
  const { publishedBlogs } = useContent();

  const post: BlogPost | undefined = publishedBlogs.find(
    (p) => p.slug === articleSlugOrId || p.id === articleSlugOrId
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#030712] text-slate-950 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-300 dark:border-sky-400/15 bg-white/95 dark:bg-[#050c1d]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToBlogList}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-sky-700 hover:text-slate-950 dark:text-sky-300 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Articles</span>
          </button>

          <span className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 truncate">
            {siteName}
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggleButton variant="broadcast" />
            <button
              type="button"
              onClick={onBackToBroadcast}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
            >
              <span>Live Score</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
        {!post ? (
          <div className="rounded-2xl bg-white dark:bg-[#0a1329]/80 border border-slate-300 dark:border-slate-800 p-8 text-center space-y-4 shadow-sm dark:shadow-none">
            <h1 className="text-xl font-black text-slate-950 dark:text-white">Article not found</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This article may have been unpublished or moved.
            </p>
            <button
              type="button"
              onClick={onBackToBlogList}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
            >
              Browse All Articles
            </button>
          </div>
        ) : (
          <article className="space-y-6">
            <div className="space-y-3 border-b border-slate-300 dark:border-slate-800 pb-6">
              <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                <span>{post.publishedAt || 'Published'}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-950 dark:text-white leading-tight tracking-tight">
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                  {post.excerpt}
                </p>
              )}
            </div>

            {post.coverImageUrl && (
              <div className="rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-slate-200 dark:bg-slate-950">
                <img
                  src={post.coverImageUrl}
                  alt={post.title}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-[460px] object-cover block"
                />
              </div>
            )}

            <div className="pt-2">
              <ArticleRenderer content={post.content} />
            </div>
          </article>
        )}
      </main>
    </div>
  );
};
