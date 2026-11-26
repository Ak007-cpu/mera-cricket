import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Edit3,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  LogIn,
  Newspaper,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { NEWS_CATEGORIES, NewsCategory, NewsItem } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import {
  deleteNewsItemFromFirestore,
  saveNewsItemToFirestore,
  subscribeNewsItems,
  uploadImageAsset
} from '../../services/firebaseContentService';
import {
  buildApiUrl,
  deleteAdminNewsFromServer,
  saveAdminNewsToServer
} from '../../services/api';
import { ADMIN_EMAIL } from '../../firebase';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface StudioFirestoreNewsSectionProps {
  adminPin: string;
  isAuthorized: boolean;
  onOpenFullNewsTab?: () => void;
  broadcastNewsMarqueeEnabled?: boolean;
  isTogglingBroadcastMarquee?: boolean;
  onToggleBroadcastMarquee?: () => void;
}

const CATEGORIES: NewsCategory[] = NEWS_CATEGORIES;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildExcerptFromBody(bodyText: string, customSummary?: string): string {
  const custom = (customSummary || '').trim();
  if (custom) return custom.slice(0, 1200);
  const normalized = bodyText.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 320) return normalized;
  return `${normalized.slice(0, 317).trim()}...`;
}

function resolvePreviewUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/')) return buildApiUrl(trimmed);
  return trimmed;
}

export const StudioFirestoreNewsSection: React.FC<StudioFirestoreNewsSectionProps> = ({
  adminPin,
  isAuthorized,
  onOpenFullNewsTab,
  broadcastNewsMarqueeEnabled = true,
  isTogglingBroadcastMarquee = false,
  onToggleBroadcastMarquee
}) => {
  const {
    firebaseUser,
    isFirebaseAdmin,
    authError,
    signInWithGoogle,
    upsertBackupNews,
    removeBackupNews
  } = useContent();

  // Direct Firestore subscription state for active news articles
  const [firestoreArticles, setFirestoreArticles] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [subGeneration, setSubGeneration] = useState(0);

  // Filter / search state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'All' | NewsCategory>('All');

  // Form modal state (Create New / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsItem | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [previewFailed, setPreviewFailed] = useState(false);
  const [date, setDate] = useState(todayIso);
  const [category, setCategory] = useState<NewsCategory>('Match Update');
  const [pinned, setPinned] = useState(false);
  const [isBreaking, setIsBreaking] = useState(false);

  // Mutation / feedback state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setFetchError(null);
    const unsubscribe = subscribeNewsItems(
      (items) => {
        setFirestoreArticles(items);
        setIsLoading(false);
        setFetchError(null);
      },
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unable to fetch active news articles from Firestore.';
        setFetchError(msg);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [subGeneration]);

  useEffect(() => {
    setPreviewFailed(false);
  }, [featuredImageUrl]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: firestoreArticles.length };
    CATEGORIES.forEach((cat) => {
      counts[cat] = 0;
    });
    firestoreArticles.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [firestoreArticles]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return firestoreArticles.filter((item) => {
      if (filterCategory !== 'All' && item.category !== filterCategory) return false;
      if (!q) return true;
      const haystack = `${item.title} ${item.description || ''} ${item.body || ''} ${item.category}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [firestoreArticles, searchQuery, filterCategory]);

  if (!isAuthorized) return null;

  const openCreateForm = () => {
    setEditingArticle(null);
    setTitle('');
    setBody('');
    setSummary('');
    setFeaturedImageUrl('');
    setImageInputMode('url');
    setPreviewFailed(false);
    setDate(todayIso());
    setCategory('Match Update');
    setPinned(false);
    setIsBreaking(false);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (article: NewsItem) => {
    setEditingArticle(article);
    setTitle(article.title || '');
    setBody(article.body || article.description || '');
    setSummary(
      article.description && article.body && article.description !== article.body
        ? article.description
        : ''
    );
    setFeaturedImageUrl(article.featuredImageUrl || article.imageUrl || '');
    setImageInputMode('url');
    setPreviewFailed(false);
    setDate(article.date || todayIso());
    setCategory(article.category || 'General');
    setPinned(Boolean(article.pinned));
    setIsBreaking(Boolean(article.isBreaking));
    setFormError(null);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving || isUploadingImg) return;
    setIsFormOpen(false);
    setEditingArticle(null);
    setFormError(null);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleUploadImage = async (file?: File) => {
    if (!file) return;
    setIsUploadingImg(true);
    setFormError(null);
    try {
      const targetId = editingArticle?.id || `news_${Date.now()}`;
      const res = await uploadImageAsset(file, 'news', targetId, adminPin, 1200);
      if (res.url.startsWith('data:') && isFirebaseAdmin) {
        throw new Error(
          res.storageError
            ? `Upload failed (${res.storageError}). Please use an external image URL or retry.`
            : 'Could not generate a hosted image URL for Firestore.'
        );
      }
      setFeaturedImageUrl(res.url);
      setImageInputMode('upload');
    } catch (err: any) {
      setFormError(err?.message || 'Image upload failed');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleSubmitArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setFormError('Article Title and Body Content are both required.');
      return;
    }

    const cleanImage = featuredImageUrl.trim();
    if (cleanImage.startsWith('data:')) {
      setFormError('Raw data URLs cannot be stored in Firestore. Upload the file or provide an https:// URL.');
      return;
    }

    if (!isFirebaseAdmin) {
      setFormError(`Sign in with Google Admin (${ADMIN_EMAIL}) before saving articles to Firestore.`);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const isNew = !editingArticle;
    const itemId = editingArticle?.id || `news_${Date.now()}`;
    const excerpt = buildExcerptFromBody(cleanBody, summary);

    const payload: NewsItem = {
      id: itemId,
      title: cleanTitle,
      description: excerpt,
      body: cleanBody,
      imageUrl: cleanImage,
      featuredImageUrl: cleanImage,
      date: date || todayIso(),
      category,
      pinned,
      isBreaking,
      createdAt: editingArticle?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      await saveNewsItemToFirestore(payload, isNew);
      upsertBackupNews(payload);
      await saveAdminNewsToServer(payload, adminPin).catch(() => {});

      setFeedback({
        text: isNew
          ? `"${cleanTitle}" added to Firestore.`
          : `"${cleanTitle}" updated in Firestore.`,
        type: 'success'
      });
      setIsFormOpen(false);
      setEditingArticle(null);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save news article to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!isFirebaseAdmin) {
      setFeedback({
        text: `Sign in with Google Admin (${ADMIN_EMAIL}) to delete articles from Firestore.`,
        type: 'error'
      });
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteNewsItemFromFirestore(deleteTarget.id);
      removeBackupNews(deleteTarget.id);
      await deleteAdminNewsFromServer(deleteTarget.id, adminPin).catch(() => {});
      setFeedback({
        text: `"${deleteTarget.title}" deleted from Firestore.`,
        type: 'success'
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setFeedback({
        text: err?.message || 'Failed to delete article from Firestore.',
        type: 'error'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const modalPreviewUrl = resolvePreviewUrl(featuredImageUrl);

  return (
    <section
      aria-labelledby="studio-firestore-news-heading"
      className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <Newspaper className="w-4 h-4 text-rose-400 shrink-0" />
            <h3
              id="studio-firestore-news-heading"
              className="font-black text-white text-sm uppercase tracking-wider"
            >
              Active News Articles (Firestore)
            </h3>
            <span className="text-xs font-mono tabular-nums text-slate-400">
              {isLoading ? 'Syncing...' : `${firestoreArticles.length} active`}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Live articles fetched from Firestore. Create, edit, or remove breaking stories and match updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFirebaseAdmin ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>{firebaseUser?.email}</span>
            </span>
          ) : (
            <button
              type="button"
              disabled={isSigningIn}
              onClick={handleGoogleSignIn}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSigningIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isSigningIn ? 'Signing in...' : 'Connect Firestore Admin'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setSubGeneration((g) => g + 1)}
            title="Refresh Firestore articles"
            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {onOpenFullNewsTab && (
            <button
              type="button"
              onClick={onOpenFullNewsTab}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
            >
              RSS Importer
            </button>
          )}

          <button
            type="button"
            onClick={openCreateForm}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5 shadow transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create New</span>
          </button>
        </div>
      </div>

      {/* Broadcast Scrolling Marquee Switch */}
      {onToggleBroadcastMarquee && (
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Radio
              className={`w-4 h-4 mt-0.5 shrink-0 ${
                broadcastNewsMarqueeEnabled ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <div>
              <div className="text-xs font-bold text-white">
                Broadcast Scrolling Marquee{' '}
                <span className={broadcastNewsMarqueeEnabled ? 'text-emerald-400' : 'text-slate-400'}>
                  · {broadcastNewsMarqueeEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Show or hide the bottom scrolling news marquee on the live broadcast view independent of news content.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={broadcastNewsMarqueeEnabled}
            aria-label="Toggle broadcast scrolling news marquee"
            disabled={isTogglingBroadcastMarquee}
            onClick={onToggleBroadcastMarquee}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-black uppercase transition-colors shrink-0 disabled:opacity-50 ${
              broadcastNewsMarqueeEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <span
              className={`w-7 h-3.5 rounded-full relative transition-colors ${
                broadcastNewsMarqueeEnabled ? 'bg-emerald-950/60' : 'bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-transform ${
                  broadcastNewsMarqueeEnabled ? 'left-4' : 'left-0.5'
                }`}
              />
            </span>
            <span>
              {isTogglingBroadcastMarquee
                ? 'Saving...'
                : broadcastNewsMarqueeEnabled
                ? 'ON'
                : 'OFF'}
            </span>
          </button>
        </div>
      )}

      {/* Auth / Feedback Notices */}
      {authError && !isFirebaseAdmin && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs flex items-center gap-2">
          <CloudOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Dismiss notification"
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter Firestore articles by title or text..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as 'All' | NewsCategory)}
            aria-label="Filter by news category"
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
          >
            <option value="All">All Categories ({categoryCounts.All})</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts[cat] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Filter Buttons */}
      <div
        role="tablist"
        aria-label="Filter Firestore articles by category"
        className="flex flex-wrap items-center gap-1.5 text-xs"
      >
        {(['All', ...CATEGORIES] as Array<'All' | NewsCategory>).map((cat) => {
          const active = filterCategory === cat;
          const count = categoryCounts[cat] || 0;
          return (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                active
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{cat}</span>
              <span className={`font-mono tabular-nums text-[11px] ${active ? 'text-sky-100' : 'text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Articles List States: Loading / Error / Empty / Data */}
      {isLoading ? (
        <div className="py-10 px-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
          <span>Loading active news articles from Firestore...</span>
        </div>
      ) : fetchError ? (
        <div className="p-5 rounded-xl bg-rose-950/30 border border-rose-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5 text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Could not load Firestore news articles</div>
              <p className="text-rose-300/80 mt-0.5">{fetchError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSubGeneration((g) => g + 1)}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      ) : filteredArticles.length === 0 ? (
        <div className="py-8 px-4 rounded-xl bg-slate-950/70 border border-dashed border-slate-800 text-center space-y-2.5">
          <p className="text-xs text-slate-400">
            {firestoreArticles.length === 0
              ? 'No active news articles found in Firestore yet.'
              : 'No Firestore articles match your current search or category filter.'}
          </p>
          {firestoreArticles.length === 0 && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Article</span>
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950/75 divide-y divide-slate-800/80 max-h-[460px] overflow-y-auto">
          {filteredArticles.map((article, idx) => {
            const thumb = resolvePreviewUrl(article.featuredImageUrl || article.imageUrl);
            const snippet = article.description || article.body || '';
            return (
              <div
                key={`${article.id}_${idx}`}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-900/50 transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={article.title}
                      referrerPolicy="no-referrer"
                      className="w-20 h-14 rounded-lg object-cover border border-slate-800 shrink-0 bg-slate-900"
                    />
                  ) : (
                    <div className="w-20 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                      <Newspaper className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center flex-wrap gap-1.5 text-[11px]">
                      <span className="font-bold text-sky-300">{article.category}</span>
                      <span className="text-slate-600">·</span>
                      <span className="font-mono tabular-nums text-slate-400">{article.date}</span>
                      {article.pinned && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="font-bold text-amber-300">Pinned</span>
                        </>
                      )}
                      {article.isBreaking && (
                        <>
                          <span className="text-slate-600">·</span>
                          <span className="font-black uppercase text-rose-400">Breaking</span>
                        </>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-white truncate">{article.title}</h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{snippet}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => openEditForm(article)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(article)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create New / Edit News Article Modal Form */}
      {isFormOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="firestore-news-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto"
        >
          <form
            onSubmit={handleSubmitArticle}
            className="w-full max-w-2xl my-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <h3
                  id="firestore-news-form-title"
                  className="text-sm font-black uppercase tracking-wider text-white"
                >
                  {editingArticle ? 'Edit News Article' : 'Create New Article'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving || isUploadingImg}
                aria-label="Close article form"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {!isFirebaseAdmin && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/60 text-amber-200 flex flex-wrap items-center justify-between gap-2">
                  <span>Sign in as {ADMIN_EMAIL} to persist changes to Firestore.</span>
                  <button
                    type="button"
                    disabled={isSigningIn}
                    onClick={handleGoogleSignIn}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
                  >
                    {isSigningIn ? 'Signing in...' : 'Connect Google Admin'}
                  </button>
                </div>
              )}

              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-700/60 text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1.5">
                    Article Title *
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Pakistan seal series victory in dramatic chase"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NewsCategory)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1.5">Publish Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono tabular-nums focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-semibold">Body Content *</label>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {body.length.toLocaleString()} / 50,000
                  </span>
                </div>
                <textarea
                  rows={5}
                  maxLength={50000}
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write the full article body content..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white leading-relaxed focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-medium block mb-1">
                  Short Summary <span className="text-slate-500">(optional — auto-generated from body if blank)</span>
                </label>
                <input
                  type="text"
                  maxLength={1200}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Short headline summary for news ticker and cards..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Featured Image Input + Preview */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                    <span>Featured Image</span>
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('url')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                        imageInputMode === 'url' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Link2 className="w-3 h-3" />
                      <span>URL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 ${
                        imageInputMode === 'upload' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3 h-3" />
                      <span>Upload</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div className="sm:col-span-2">
                    {imageInputMode === 'url' ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          maxLength={2000}
                          value={featuredImageUrl}
                          onChange={(e) => setFeaturedImageUrl(e.target.value)}
                          placeholder="https://example.com/article-cover.jpg"
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-sky-500"
                        />
                        {featuredImageUrl && (
                          <button
                            type="button"
                            onClick={() => setFeaturedImageUrl('')}
                            aria-label="Clear image URL"
                            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 border border-dashed border-slate-700 hover:border-sky-500 rounded-xl px-3 py-3 cursor-pointer bg-slate-900/70">
                        <Upload className="w-4 h-4 text-sky-400" />
                        <span className="font-semibold text-slate-200">
                          {isUploadingImg ? 'Uploading image...' : 'Choose PNG / JPG / WEBP'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          disabled={isUploadingImg}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadImage(f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="aspect-video rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center">
                    {modalPreviewUrl && !previewFailed ? (
                      <img
                        src={modalPreviewUrl}
                        alt={title || 'Featured preview'}
                        referrerPolicy="no-referrer"
                        onError={() => setPreviewFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-[11px] text-slate-500">No Preview</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-amber-300">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <Pin className="w-3.5 h-3.5" />
                  <span>Pin to Top</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-rose-300">
                  <input
                    type="checkbox"
                    checked={isBreaking}
                    onChange={(e) => setIsBreaking(e.target.checked)}
                    className="w-4 h-4 accent-rose-500 rounded"
                  />
                  <Radio className="w-3.5 h-3.5" />
                  <span>Breaking Ticker</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-800 bg-slate-950/60">
              <button
                type="button"
                onClick={closeForm}
                disabled={isSaving || isUploadingImg}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploadingImg}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : editingArticle ? (
                  <Save className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Saving...' : editingArticle ? 'Save Changes' : 'Publish Article'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete News Article?"
        itemName={deleteTarget?.title}
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};
