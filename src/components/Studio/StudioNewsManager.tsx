import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CricketNewsSettings,
  CricketNewsSource,
  FetchedCricketNewsItem,
  NEWS_CATEGORIES,
  NewsCategory,
  NewsItem
} from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import {
  deleteNewsItemFromFirestore,
  saveNewsItemToFirestore,
  uploadImageAsset
} from '../../services/firebaseContentService';
import {
  buildApiUrl,
  deleteAdminNewsFromServer,
  fetchAdminCricketNewsFeed,
  fetchServerAdminNews,
  saveAdminNewsToServer,
  updateAdminCricketNewsSettings
} from '../../services/api';
import { ADMIN_EMAIL } from '../../firebase';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  Download,
  Edit3,
  FileText,
  Globe,
  Image as ImageIcon,
  Link2,
  LogIn,
  Newspaper,
  Pin,
  Plus,
  Radio,
  RefreshCw,
  Rss,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X
} from 'lucide-react';

interface StudioNewsManagerProps {
  adminPin: string;
  isAuthorized: boolean;
  broadcastNewsMarqueeEnabled?: boolean;
  isTogglingBroadcastMarquee?: boolean;
  onToggleBroadcastMarquee?: () => void;
}

const CATEGORIES: NewsCategory[] = NEWS_CATEGORIES;

const SOURCE_OPTIONS: Array<{ value: CricketNewsSource; label: string }> = [
  { value: 'all', label: 'All Cricket Sources (ESPNcricinfo + BBC + Google)' },
  { value: 'espncricinfo', label: 'ESPNcricinfo' },
  { value: 'bbc', label: 'BBC Sport Cricket' },
  { value: 'googlenews', label: 'Google News Cricket (Topic Search)' }
];

const QUICK_PLAYERS: Array<{ name: string; team: string }> = [
  { name: 'Virat Kohli', team: 'IND' },
  { name: 'Rohit Sharma', team: 'IND' },
  { name: 'Jasprit Bumrah', team: 'IND' },
  { name: 'Babar Azam', team: 'PAK' },
  { name: 'Mohammad Rizwan', team: 'PAK' },
  { name: 'Shaheen Shah Afridi', team: 'PAK' },
  { name: 'Pat Cummins', team: 'AUS' },
  { name: 'Ben Stokes', team: 'ENG' }
];

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

export const StudioNewsManager: React.FC<StudioNewsManagerProps> = ({
  adminPin,
  isAuthorized,
  broadcastNewsMarqueeEnabled = true,
  isTogglingBroadcastMarquee = false,
  onToggleBroadcastMarquee
}) => {
  const {
    news,
    players,
    firebaseUser,
    isFirebaseAdmin,
    authError,
    signInWithGoogle,
    upsertBackupNews,
    removeBackupNews
  } = useContent();

  const editorFormRef = useRef<HTMLFormElement | null>(null);

  // Add / Edit Article state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [summary, setSummary] = useState('');
  const [featuredImageUrl, setFeaturedImageUrl] = useState('');
  const [featuredImageMode, setFeaturedImageMode] = useState<'url' | 'upload'>('url');
  const [featuredPreviewFailed, setFeaturedPreviewFailed] = useState(false);

  const [showPlayerLookup, setShowPlayerLookup] = useState(false);
  const [playerLookupName, setPlayerLookupName] = useState('');
  const [playerLookupTeam, setPlayerLookupTeam] = useState('');

  const [date, setDate] = useState(todayIso);
  const [category, setCategory] = useState<NewsCategory>('Match Update');
  const [pinned, setPinned] = useState(false);
  const [isBreaking, setIsBreaking] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NewsItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Article filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'All' | NewsCategory>('All');

  // Cricket News Source & Fetcher state
  const [showRssPanel, setShowRssPanel] = useState(false);
  const [feedSettings, setFeedSettings] = useState<CricketNewsSettings>({
    autoSyncEnabled: true,
    source: 'all',
    query: '',
    maxItems: 6,
    preferPlayerImage: true,
    updatedAt: 0
  });
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isFetchingFeed, setIsFetchingFeed] = useState(false);
  const [fetchedStories, setFetchedStories] = useState<FetchedCricketNewsItem[]>([]);
  const [publishingStoryId, setPublishingStoryId] = useState<string | null>(null);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);
  const [storyImageChoice, setStoryImageChoice] = useState<Record<string, 'player' | 'article'>>({});

  useEffect(() => {
    if (!isAuthorized) return;
    let mounted = true;
    setIsLoadingSettings(true);
    fetchServerAdminNews()
      .then((res) => {
        if (!mounted || !res.settings) return;
        setFeedSettings(res.settings);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setIsLoadingSettings(false);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthorized]);

  useEffect(() => {
    setFeaturedPreviewFailed(false);
  }, [featuredImageUrl]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: news.length };
    CATEGORIES.forEach((cat) => {
      counts[cat] = 0;
    });
    news.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [news]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return news.filter((item) => {
      if (filterCategory !== 'All' && item.category !== filterCategory) return false;
      if (!q) return true;
      const haystack = `${item.title} ${item.body || ''} ${item.description || ''} ${item.category}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [news, searchQuery, filterCategory]);

  if (!isAuthorized) return null;

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setSummary('');
    setFeaturedImageUrl('');
    setFeaturedPreviewFailed(false);
    setPlayerLookupName('');
    setPlayerLookupTeam('');
    setDate(todayIso());
    setCategory('Match Update');
    setPinned(false);
    setIsBreaking(false);
  };

  const handleEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body || item.description || '');
    setSummary(item.description && item.body && item.description !== item.body ? item.description : '');
    setFeaturedImageUrl(item.featuredImageUrl || item.imageUrl || '');
    setFeaturedPreviewFailed(false);
    setDate(item.date || todayIso());
    setCategory(item.category || 'General');
    setPinned(Boolean(item.pinned));
    setIsBreaking(Boolean(item.isBreaking));
    setFeedback(null);
    editorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyPlayerPhotoLookup = (customName?: string, customTeam?: string) => {
    const pName = (customName ?? playerLookupName).trim();
    const pTeam = (customTeam ?? playerLookupTeam).trim().toUpperCase();
    if (!pName) {
      setFeedback({ text: 'Enter a player name first to attach their portrait.', type: 'error' });
      return;
    }

    const matchedCms = players.find(
      (p) =>
        p.name.toLowerCase() === pName.toLowerCase() ||
        (p.originalName && p.originalName.toLowerCase() === pName.toLowerCase())
    );
    if (matchedCms?.imageUrl) {
      setFeaturedImageUrl(matchedCms.imageUrl);
      setFeaturedImageMode('url');
      setPlayerLookupName(matchedCms.name);
      if (matchedCms.teamCode) setPlayerLookupTeam(matchedCms.teamCode);
      setFeedback({ text: `Featured Image set to ${matchedCms.name}'s CMS portrait.`, type: 'success' });
      return;
    }

    const params = new URLSearchParams({ name: pName });
    if (pTeam) params.set('team', pTeam);
    setFeaturedImageUrl(`/api/player/photo?${params.toString()}`);
    setFeaturedImageMode('url');
    setPlayerLookupName(pName);
    if (pTeam) setPlayerLookupTeam(pTeam);
    setFeedback({ text: `Featured Image linked to ${pName}'s player portrait.`, type: 'success' });
  };

  const handleUploadFeaturedImage = async (file?: File) => {
    if (!file) return;
    setIsUploadingImg(true);
    setFeedback(null);
    try {
      const res = await uploadImageAsset(file, 'news', editingId || `news_${Date.now()}`, adminPin, 1200);
      if (res.url.startsWith('data:') && isFirebaseAdmin) {
        throw new Error(
          res.storageError
            ? `Image upload failed (${res.storageError}). Please use an external Featured Image URL or retry.`
            : 'Image upload could not generate a hosted URL for Firestore.'
        );
      }
      setFeaturedImageUrl(res.url);
      setFeaturedImageMode('upload');
      setFeedback({
        text: res.storedInFirebase
          ? 'Featured Image uploaded to Firebase Storage and ready to save in Firestore.'
          : 'Featured Image uploaded to media server and ready to save.',
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Featured Image upload failed', type: 'error' });
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsSigningIn(false);
    }
  };

  const persistNewsItemEverywhere = async (item: NewsItem, isNew: boolean): Promise<{ savedToFirestore: boolean }> => {
    upsertBackupNews(item);
    await saveAdminNewsToServer(item, adminPin).catch(() => {});
    if (isFirebaseAdmin) {
      await saveNewsItemToFirestore(item, isNew);
      return { savedToFirestore: true };
    }
    return { savedToFirestore: false };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) {
      setFeedback({ text: 'Article Title and Body Content are both required.', type: 'error' });
      return;
    }

    const cleanImage = featuredImageUrl.trim();
    if (cleanImage.startsWith('data:')) {
      setFeedback({
        text: 'Raw data URLs cannot be saved to Firestore. Please upload the file or enter an https:// or /api/... Featured Image URL.',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const existing = editingId ? news.find((n) => n.id === editingId) : undefined;
    const itemId = editingId || `news_${Date.now()}`;
    const excerpt = buildExcerptFromBody(cleanBody, summary);
    const item: NewsItem = {
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
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      const { savedToFirestore } = await persistNewsItemEverywhere(item, !existing);
      setFeedback({
        text: savedToFirestore
          ? existing
            ? 'Article updated in Firestore and live on the website.'
            : 'Article published to Firestore and live on the website.'
          : existing
          ? 'Article updated on local server backup. Sign in with Google Admin to sync globally to Firestore.'
          : 'Article saved on local server backup. Sign in with Google Admin to sync globally to Firestore.',
        type: 'success'
      });
      resetForm();
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to save news article', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFeedSettings = async () => {
    setIsSavingSettings(true);
    setFeedback(null);
    try {
      const updated = await updateAdminCricketNewsSettings(feedSettings, adminPin);
      setFeedSettings(updated);
      setFeedback({
        text: updated.autoSyncEnabled
          ? 'Cricket News Auto-Feed settings saved.'
          : 'Auto-Feed disabled. Only manually published articles will appear on the site.',
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Failed to save Cricket News settings', type: 'error' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleFetchCricketFeed = async (refresh = true) => {
    setIsFetchingFeed(true);
    setFeedback(null);
    try {
      const res = await fetchAdminCricketNewsFeed(
        {
          source: feedSettings.source,
          query: feedSettings.query,
          limit: 12,
          preferPlayerImage: feedSettings.preferPlayerImage,
          refresh
        },
        adminPin
      );
      setFetchedStories(res.items);
      if (res.items.length === 0) {
        setFeedback({
          text: 'No cricket news matched this filter/source right now. Clear the filter and try again.',
          type: 'error'
        });
      } else {
        setFeedback({
          text: `Fetched ${res.items.length} cricket stories ready to publish or load into the editor.`,
          type: 'success'
        });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Cricket news fetch failed', type: 'error' });
    } finally {
      setIsFetchingFeed(false);
    }
  };

  const resolveStoryChosenImage = (story: FetchedCricketNewsItem): string => {
    const choice = storyImageChoice[story.id];
    if (choice === 'article' && story.articleImageUrl) return story.articleImageUrl;
    if (choice === 'player' && story.playerImageUrl) return story.playerImageUrl;
    return story.recommendedImageUrl || story.playerImageUrl || story.articleImageUrl || '';
  };

  const handlePublishFetchedStory = async (story: FetchedCricketNewsItem) => {
    setPublishingStoryId(story.id);
    setFeedback(null);
    try {
      const chosenImg = resolveStoryChosenImage(story);
      const item: NewsItem = {
        id: `news_${story.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        title: story.title,
        description: story.description,
        body: story.description,
        imageUrl: chosenImg,
        featuredImageUrl: chosenImg,
        date: story.date || todayIso(),
        category: story.suggestedCategory || 'Match Update',
        pinned: false,
        isBreaking: story.suggestedCategory === 'Breaking',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const existing = news.find((n) => n.id === item.id);
      const { savedToFirestore } = await persistNewsItemEverywhere(item, !existing);
      setFeedback({
        text: savedToFirestore
          ? `"${story.title}" published to Firestore.`
          : `"${story.title}" saved to server backup.`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Publish failed', type: 'error' });
    } finally {
      setPublishingStoryId(null);
    }
  };

  const handleLoadStoryIntoEditor = (story: FetchedCricketNewsItem) => {
    setEditingId(null);
    setTitle(story.title);
    setBody(story.description);
    setSummary('');
    setFeaturedImageUrl(resolveStoryChosenImage(story));
    setFeaturedImageMode('url');
    setPlayerLookupName(story.matchedPlayerName || '');
    setPlayerLookupTeam(story.matchedTeamCode || '');
    setDate(story.date || todayIso());
    setCategory(story.suggestedCategory || 'Match Update');
    setPinned(false);
    setIsBreaking(story.suggestedCategory === 'Breaking');
    setFeedback({
      text: 'Story loaded into the Article Editor. Customize title, body, or featured image and save.',
      type: 'success'
    });
    editorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleBulkPublishTop = async () => {
    if (fetchedStories.length === 0) return;
    setIsBulkPublishing(true);
    setFeedback(null);
    try {
      const top = fetchedStories.slice(0, 5);
      for (const story of top) {
        const chosenImg = resolveStoryChosenImage(story);
        const item: NewsItem = {
          id: `news_${story.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          title: story.title,
          description: story.description,
          body: story.description,
          imageUrl: chosenImg,
          featuredImageUrl: chosenImg,
          date: story.date || todayIso(),
          category: story.suggestedCategory || 'Match Update',
          pinned: false,
          isBreaking: story.suggestedCategory === 'Breaking',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        const existing = news.find((n) => n.id === item.id);
        await persistNewsItemEverywhere(item, !existing);
      }
      setFeedback({
        text: `Published top ${top.length} fetched stories.`,
        type: 'success'
      });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Bulk publish failed', type: 'error' });
    } finally {
      setIsBulkPublishing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      removeBackupNews(deleteTarget.id);
      await deleteAdminNewsFromServer(deleteTarget.id, adminPin).catch(() => {});
      if (isFirebaseAdmin) {
        await deleteNewsItemFromFirestore(deleteTarget.id);
      }
      if (editingId === deleteTarget.id) resetForm();
      setFeedback({
        text: isFirebaseAdmin
          ? `"${deleteTarget.title}" deleted from Firestore.`
          : `"${deleteTarget.title}" deleted locally.`,
        type: 'success'
      });
      setDeleteTarget(null);
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Delete failed', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const previewUrl = resolvePreviewUrl(featuredImageUrl);

  return (
    <div className="space-y-6">
      {/* Module Header & Firestore Cloud Sync Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0">
            <Newspaper className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-wider text-white">
              News Management
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Create, edit, and delete cricket news articles with full body content and featured images persisted in Firestore.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isFirebaseAdmin ? (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span>Firestore Connected ({firebaseUser?.email})</span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <CloudOff className="w-3.5 h-3.5" />
                <span>Firestore Sync Inactive ({ADMIN_EMAIL})</span>
              </span>
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handleGoogleSignIn}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSigningIn ? 'Signing in...' : 'Connect Firestore'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Broadcast Scrolling Marquee Independent Toggle */}
      {onToggleBroadcastMarquee && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                broadcastNewsMarqueeEnabled
                  ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Broadcast Scrolling News Marquee</span>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    broadcastNewsMarqueeEnabled ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {broadcastNewsMarqueeEnabled ? '· Active on Broadcast' : '· Hidden on Broadcast'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enable or disable the bottom scrolling sports news marquee on the live broadcast view without modifying or deleting news articles.
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
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-black uppercase transition-colors shrink-0 disabled:opacity-50 ${
              broadcastNewsMarqueeEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-400 text-white'
                : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <span
              className={`w-8 h-4 rounded-full relative transition-colors ${
                broadcastNewsMarqueeEnabled ? 'bg-emerald-950/60' : 'bg-slate-800'
              }`}
            >
              <span
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                  broadcastNewsMarqueeEnabled ? 'left-4' : 'left-0.5'
                }`}
              />
            </span>
            <span>
              {isTogglingBroadcastMarquee
                ? 'Saving...'
                : broadcastNewsMarqueeEnabled
                ? 'Marquee ON'
                : 'Marquee OFF'}
            </span>
          </button>
        </div>
      )}

      {authError && !isFirebaseAdmin && (
        <div className="p-3.5 rounded-xl text-xs bg-amber-950/40 border border-amber-700/60 text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-800 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Article Editor Form */}
      <form
        ref={editorFormRef}
        onSubmit={handleSave}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5"
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              {editingId ? 'Edit News Article' : 'Create News Article'}
            </h3>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {/* Title, Category, Date */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className="text-slate-300 font-semibold block mb-1.5">Article Title *</label>
            <input
              type="text"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Babar Azam leads match-winning chase in Lahore"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as NewsCategory)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-sky-500"
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
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Body Content */}
        <div className="space-y-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold">Body Content *</label>
              <span className="text-[11px] font-mono text-slate-500">
                {body.length.toLocaleString()} / 50,000
              </span>
            </div>
            <textarea
              rows={6}
              maxLength={50000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the full news article body content here..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white leading-relaxed focus:outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <label className="text-slate-400 font-medium block mb-1">
              Short Summary / Ticker Excerpt <span className="text-slate-500">(optional — auto-generated from body if left blank)</span>
            </label>
            <input
              type="text"
              maxLength={1200}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Optional short headline excerpt for news cards and breaking ticker..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Featured Image (URL Input or File Upload + Live Preview) */}
        <div className="bg-slate-950/75 border border-slate-800 rounded-2xl p-4 space-y-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <div>
                <span className="font-black uppercase tracking-wider text-white block">
                  Featured Image
                </span>
                <span className="text-[11px] text-slate-400">
                  Provide an image URL or upload an image file — persisted in Firestore as{' '}
                  <code className="text-sky-300 font-mono">featuredImageUrl</code>.
                </span>
              </div>
            </div>

            <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button
                type="button"
                onClick={() => setFeaturedImageMode('url')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                  featuredImageMode === 'url'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Image URL</span>
              </button>
              <button
                type="button"
                onClick={() => setFeaturedImageMode('upload')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
                  featuredImageMode === 'upload'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>File Upload</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2 space-y-3">
              {featuredImageMode === 'url' ? (
                <div className="space-y-1.5">
                  <label className="text-slate-300 font-semibold block">Featured Image URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      maxLength={2000}
                      value={featuredImageUrl}
                      onChange={(e) => setFeaturedImageUrl(e.target.value)}
                      placeholder="https://example.com/featured-image.jpg"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono focus:outline-none focus:border-sky-500"
                    />
                    {featuredImageUrl && (
                      <button
                        type="button"
                        onClick={() => setFeaturedImageUrl('')}
                        title="Clear Featured Image"
                        className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-slate-300 font-semibold block">Upload Featured Image File</label>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-sky-500 bg-slate-900/70 rounded-xl px-4 py-5 cursor-pointer transition-colors">
                    <Upload className={`w-5 h-5 text-sky-400 ${isUploadingImg ? 'animate-bounce' : ''}`} />
                    <div className="text-center">
                      <span className="text-xs font-bold text-white block">
                        {isUploadingImg ? 'Uploading Featured Image...' : 'Click to choose an image file'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        PNG, JPG, WEBP, or GIF — automatically optimized &amp; hosted
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      disabled={isUploadingImg}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleUploadFeaturedImage(f);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {featuredImageUrl && (
                    <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
                      <span className="text-[11px] text-slate-400 shrink-0">Uploaded URL:</span>
                      <input
                        type="text"
                        readOnly
                        value={featuredImageUrl}
                        className="flex-1 bg-transparent text-[11px] font-mono text-sky-300 focus:outline-none truncate"
                      />
                      <button
                        type="button"
                        onClick={() => setFeaturedImageUrl('')}
                        className="text-slate-400 hover:text-white"
                        title="Clear Featured Image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Optional Player Photo Quick-Attach */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowPlayerLookup((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 hover:text-amber-200"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Quick-attach a cricket player portrait as Featured Image</span>
                  {showPlayerLookup ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showPlayerLookup && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap gap-1">
                      {QUICK_PLAYERS.map((qp) => (
                        <button
                          key={qp.name}
                          type="button"
                          onClick={() => applyPlayerPhotoLookup(qp.name, qp.team)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-colors"
                        >
                          {qp.name}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={playerLookupName}
                        onChange={(e) => setPlayerLookupName(e.target.value)}
                        placeholder="Player Name (e.g. Virat Kohli)"
                        className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        maxLength={12}
                        value={playerLookupTeam}
                        onChange={(e) => setPlayerLookupTeam(e.target.value.toUpperCase())}
                        placeholder="Team (IND/PAK)"
                        className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => applyPlayerPhotoLookup()}
                        className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Use Portrait</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Featured Image Preview */}
            <div className="space-y-1.5">
              <span className="text-slate-300 font-semibold block">Featured Image Preview</span>
              <div className="aspect-video w-full rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center relative">
                {previewUrl && !featuredPreviewFailed ? (
                  <img
                    src={previewUrl}
                    alt={title || 'Featured image preview'}
                    referrerPolicy="no-referrer"
                    onError={() => setFeaturedPreviewFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                    <ImageIcon className="w-7 h-7 mb-1.5 text-slate-600" />
                    <span className="text-[11px] font-semibold">
                      {featuredPreviewFailed ? 'Could not load image preview' : 'No Featured Image selected'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pin to Top, Breaking Ticker & Submit */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-300">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <Pin className="w-3.5 h-3.5" />
              <span>Pin to top</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-rose-300">
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

          <button
            type="submit"
            disabled={isSaving || isUploadingImg}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-2 shadow-lg transition-colors disabled:opacity-50"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : editingId ? 'Update Article' : 'Publish Article'}</span>
          </button>
        </div>
      </form>

      {/* Published Articles List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-white">
              Published News Articles ({filteredArticles.length}
              {filteredArticles.length !== news.length ? ` of ${news.length}` : ''})
            </h4>
            <p className="text-[11px] text-slate-400">
              Edit any article to update its title, body content, or featured image in Firestore.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
                className="bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as 'All' | NewsCategory)}
              aria-label="Filter articles by category"
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500"
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

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Filter news articles by category"
          className="flex flex-wrap items-center gap-1.5 pb-1"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
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

        {filteredArticles.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400">
            {news.length === 0
              ? 'No news articles published yet. Create your first article above.'
              : 'No articles match your current search or category filter.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredArticles.map((item, idx) => {
              const articleImage = resolvePreviewUrl(item.featuredImageUrl || item.imageUrl);
              const articleBody = item.body || item.description;
              return (
                <div
                  key={`${item.id}_${idx}`}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    {articleImage ? (
                      <img
                        src={articleImage}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-24 h-16 rounded-lg object-cover border border-slate-800 shrink-0"
                      />
                    ) : (
                      <div className="w-24 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                        <Newspaper className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center flex-wrap gap-2 text-[11px]">
                        <span className="font-bold text-sky-300">{item.category}</span>
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-400 font-mono">{item.date}</span>
                        {item.pinned && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-amber-300 font-bold">Pinned</span>
                          </>
                        )}
                        {item.isBreaking && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-rose-400 font-black uppercase">Breaking</span>
                          </>
                        )}
                        {(item.featuredImageUrl || item.imageUrl) && (
                          <>
                            <span className="text-slate-600">·</span>
                            <span className="text-emerald-400 font-semibold">Featured Image</span>
                          </>
                        )}
                      </div>
                      <div className="text-sm font-black text-white truncate">{item.title}</div>
                      <p className="text-xs text-slate-400 line-clamp-2">{articleBody}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleEdit(item)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition-colors"
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
      </div>

      {/* Collapsible Cricket News Source & Auto-Fetch Feed Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowRssPanel((v) => !v)}
            className="flex items-center gap-2.5 text-left"
          >
            <Rss className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>Live Cricket News Feed &amp; RSS Importer</span>
                {showRssPanel ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Fetch stories from ESPNcricinfo, BBC Sport, or Google News to import into the editor or publish directly.
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isFetchingFeed}
              onClick={() => {
                setShowRssPanel(true);
                handleFetchCricketFeed(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetchingFeed ? 'animate-spin' : ''}`} />
              <span>{isFetchingFeed ? 'Fetching...' : 'Fetch Cricket News'}</span>
            </button>
          </div>
        </div>

        {showRssPanel && (
          <div className="space-y-4 pt-3 border-t border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="md:col-span-2">
                <label className="text-slate-300 font-semibold block mb-1">Cricket News Source</label>
                <select
                  value={feedSettings.source}
                  onChange={(e) =>
                    setFeedSettings((prev) => ({ ...prev, source: e.target.value as CricketNewsSource }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Team / Player Filter</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    maxLength={60}
                    value={feedSettings.query}
                    onChange={(e) => setFeedSettings((prev) => ({ ...prev, query: e.target.value }))}
                    placeholder="e.g. Pakistan, Kohli, IPL"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Main Site Feed Limit</label>
                <select
                  value={feedSettings.maxItems}
                  onChange={(e) =>
                    setFeedSettings((prev) => ({ ...prev, maxItems: Number(e.target.value) || 6 }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value={4}>4 News Cards</option>
                  <option value={6}>6 News Cards</option>
                  <option value={8}>8 News Cards</option>
                  <option value={12}>12 News Cards</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-5">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-300">
                  <input
                    type="checkbox"
                    checked={feedSettings.autoSyncEnabled}
                    onChange={(e) =>
                      setFeedSettings((prev) => ({ ...prev, autoSyncEnabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <Globe className="w-3.5 h-3.5" />
                  <span>Auto-Show Live Cricket Feed on Main Website</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-300">
                  <input
                    type="checkbox"
                    checked={feedSettings.preferPlayerImage}
                    onChange={(e) =>
                      setFeedSettings((prev) => ({ ...prev, preferPlayerImage: e.target.checked }))
                    }
                    className="w-4 h-4 accent-sky-500 rounded"
                  />
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Prioritize Matched Player Image</span>
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {fetchedStories.length > 0 && (
                  <button
                    type="button"
                    disabled={isBulkPublishing}
                    onClick={handleBulkPublishTop}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isBulkPublishing ? 'Publishing...' : 'Publish Top 5'}</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSavingSettings || isLoadingSettings}
                  onClick={handleSaveFeedSettings}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingSettings ? 'Saving...' : 'Save Feed Setting'}</span>
                </button>
              </div>
            </div>

            {fetchedStories.length > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold text-slate-200">
                    Fetched Cricket News ({fetchedStories.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFetchedStories([])}
                    className="text-slate-400 hover:text-white font-semibold"
                  >
                    Clear Preview
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {fetchedStories.map((story, storyIdx) => {
                    const chosenImg = resolveStoryChosenImage(story);
                    const hasBothImages = Boolean(story.playerImageUrl && story.articleImageUrl);
                    const currentChoice =
                      storyImageChoice[story.id] ||
                      (feedSettings.preferPlayerImage && story.playerImageUrl ? 'player' : 'article');

                    return (
                      <div
                        key={`${story.id}_${storyIdx}`}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex gap-3 items-start"
                      >
                        <div className="w-20 h-20 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {chosenImg ? (
                            <img
                              src={resolvePreviewUrl(chosenImg)}
                              alt={story.matchedPlayerName || story.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <Newspaper className="w-6 h-6 text-slate-600" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center flex-wrap gap-1.5 text-[10px]">
                            <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold">
                              {story.sourceName}
                            </span>
                            <span className="text-slate-500 font-mono">{story.date}</span>
                            {story.matchedPlayerName && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold">
                                {story.matchedPlayerName}
                                {story.matchedTeamCode ? ` (${story.matchedTeamCode})` : ''}
                              </span>
                            )}
                          </div>

                          <div className="text-xs font-black text-white line-clamp-2 leading-snug">
                            {story.title}
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-2">{story.description}</p>

                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={publishingStoryId === story.id}
                              onClick={() => handlePublishFetchedStory(story)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                              <Plus className="w-3 h-3" />
                              <span>{publishingStoryId === story.id ? 'Saving...' : 'Publish'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleLoadStoryIntoEditor(story)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3 text-sky-400" />
                              <span>Load in Editor</span>
                            </button>

                            {hasBothImages && (
                              <button
                                type="button"
                                onClick={() =>
                                  setStoryImageChoice((prev) => ({
                                    ...prev,
                                    [story.id]: currentChoice === 'player' ? 'article' : 'player'
                                  }))
                                }
                                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-semibold flex items-center gap-1"
                              >
                                <ImageIcon className="w-3 h-3 text-amber-400" />
                                <span>{currentChoice === 'player' ? 'Use Article Img' : 'Use Player Img'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Delete News Article?"
        itemName={deleteTarget?.title}
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
