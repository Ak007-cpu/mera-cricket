import React, { useRef, useState } from 'react';
import { BlogPost, BlogPostStatus } from '../../types/cricket';
import { useContent } from '../../context/ContentContext';
import {
  deleteBlogPostFromFirestore,
  sanitizeFirestoreId,
  saveBlogPostToFirestore,
  uploadImageAsset
} from '../../services/firebaseContentService';
import { ArticleRenderer } from '../Public/ArticleRenderer';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  AlertTriangle,
  Bold,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  Heading2,
  Heading3,
  ImagePlus,
  List,
  Plus,
  Save,
  Trash2,
  Upload,
  X
} from 'lucide-react';

interface StudioBlogManagerProps {
  adminPin: string;
  isAuthorized: boolean;
}

export const StudioBlogManager: React.FC<StudioBlogManagerProps> = ({ adminPin, isAuthorized }) => {
  const { blogs, isFirebaseAdmin, upsertBackupBlog, removeBackupBlog } = useContent();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<BlogPostStatus>('published');
  const [previewMode, setPreviewMode] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  if (!isAuthorized) return null;

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setExcerpt('');
    setCoverImageUrl('');
    setContent('');
    setStatus('published');
    setPreviewMode(false);
  };

  const handleEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setTitle(post.title);
    setExcerpt(post.excerpt || '');
    setCoverImageUrl(post.coverImageUrl || '');
    setContent(post.content);
    setStatus(post.status);
    setPreviewMode(false);
    setFeedback(null);
  };

  const insertAtCursor = (snippet: string) => {
    const el = textareaRef.current;
    if (!el) {
      setContent((prev) => (prev ? `${prev}\n${snippet}` : snippet));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    setTimeout(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const wrapSelectionBold = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end) || 'Important Text';
    const next = `${content.slice(0, start)}**${selected}**${content.slice(end)}`;
    setContent(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + 2, start + 2 + selected.length);
    }, 0);
  };

  const handleUploadCover = async (file?: File) => {
    if (!file) return;
    setIsUploadingCover(true);
    setFeedback(null);
    try {
      const res = await uploadImageAsset(file, 'blogs', `cover_${Date.now()}`, adminPin, 1100);
      setCoverImageUrl(res.url);
      setFeedback({ text: 'Cover image upload ho gayi!', type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Cover upload failed', type: 'error' });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleUploadInlineImage = async (file?: File) => {
    if (!file) return;
    setIsUploadingInline(true);
    setFeedback(null);
    try {
      const res = await uploadImageAsset(file, 'blogs', `inline_${Date.now()}`, adminPin, 960);
      insertAtCursor(`\n![Match photo](${res.url})\n`);
      setFeedback({ text: 'Image article mein insert ho gayi!', type: 'success' });
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Inline image upload failed', type: 'error' });
    } finally {
      setIsUploadingInline(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setFeedback({ text: 'Blog title aur article content dono likhein.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const existing = editingId ? blogs.find((b) => b.id === editingId) : undefined;
    const id = editingId || `blog_${Date.now()}`;
    const slug = sanitizeFirestoreId(existing?.slug || title, id);
    const post: BlogPost = {
      id,
      slug,
      title: title.trim(),
      excerpt: excerpt.trim(),
      coverImageUrl: coverImageUrl.trim(),
      content: content.trim(),
      status,
      publishedAt: existing?.publishedAt || new Date().toISOString().slice(0, 10),
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      upsertBackupBlog(post);
      if (isFirebaseAdmin) {
        await saveBlogPostToFirestore(post, !existing);
        setFeedback({
          text:
            status === 'published'
              ? 'Blog article publish aur Firebase mein save ho gaya!'
              : 'Blog article Draft ke taur par save ho gaya!',
          type: 'success'
        });
      } else {
        setFeedback({
          text: 'Blog local backup mein save ho gaya. Sab users ko dikhane ke liye upar Google Admin Sign-In karein.',
          type: 'success'
        });
      }
      resetForm();
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Blog save failed', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      removeBackupBlog(deleteTarget.id);
      if (isFirebaseAdmin) {
        await deleteBlogPostFromFirestore(deleteTarget.id);
      }
      if (editingId === deleteTarget.id) resetForm();
      setFeedback({ text: `"${deleteTarget.title}" delete ho gaya.`, type: 'success' });
      setDeleteTarget(null);
    } catch (err: any) {
      setFeedback({ text: err?.message || 'Delete failed', type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <form
        onSubmit={handleSave}
        className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              {editingId ? 'Edit Blog Article' : 'Write New Blog Article'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode((p) => !p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border ${
                previewMode
                  ? 'bg-sky-600 text-white border-sky-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewMode ? 'Edit Text' : 'Live Preview'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Edit</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="md:col-span-2">
            <label className="text-slate-300 font-semibold block mb-1">Article Title *</label>
            <input
              type="text"
              maxLength={220}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Match Analysis: How Pace Bowlers Turned the Game"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Visibility Status</label>
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setStatus('published')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  status === 'published' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Published
              </button>
              <button
                type="button"
                onClick={() => setStatus('draft')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  status === 'draft' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                Draft
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 font-semibold block mb-1">Short Summary (Excerpt)</label>
            <input
              type="text"
              maxLength={500}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Blog list card par dikhne wala chhota intro..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold block mb-1">Cover Image URL ya Upload</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
              <label className="cursor-pointer px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold border border-slate-700 flex items-center gap-1.5 shrink-0">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>{isUploadingCover ? '...' : 'Upload'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploadingCover}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadCover(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Rich Formatting Toolbar */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => insertAtCursor('\n## Heading\n')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
              >
                <Heading2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Heading</span>
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('\n### Subheading\n')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
              >
                <Heading3 className="w-3.5 h-3.5 text-sky-400" />
                <span>Subheading</span>
              </button>
              <button
                type="button"
                onClick={wrapSelectionBold}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
              >
                <Bold className="w-3.5 h-3.5 text-amber-400" />
                <span>Bold</span>
              </button>
              <button
                type="button"
                onClick={() => insertAtCursor('\n- Key point\n')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
              >
                <List className="w-3.5 h-3.5 text-emerald-400" />
                <span>List</span>
              </button>
              <label className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1">
                <ImagePlus className="w-3.5 h-3.5 text-purple-400" />
                <span>{isUploadingInline ? 'Uploading...' : 'Insert Image'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  disabled={isUploadingInline}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadInlineImage(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <span className="text-[11px] text-slate-500">
              Supports ## Heading, **bold**, and ![caption](url) images
            </span>
          </div>

          {previewMode ? (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 min-h-[260px]">
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt={title || 'Cover preview'}
                  referrerPolicy="no-referrer"
                  className="w-full max-h-60 object-cover rounded-xl mb-4 border border-slate-800"
                />
              )}
              <h1 className="text-2xl font-black text-white mb-4">{title || 'Untitled Article'}</h1>
              <ArticleRenderer content={content || 'Article preview will appear here...'} />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              rows={11}
              maxLength={50000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`## Match Overview\nWrite your detailed cricket analysis here with **bold** highlights and inline images:\n\n![Action Moment](https://...)\n\n### Key Turning Points\n- Powerplay wicket changed momentum`}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white leading-relaxed font-sans focus:outline-none focus:border-amber-500"
            />
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="submit"
            disabled={isSaving || isUploadingCover || isUploadingInline}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-2 shadow-lg transition-colors disabled:opacity-50"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isSaving ? 'Saving...' : editingId ? 'Save Article' : 'Save & Publish Blog'}</span>
          </button>
        </div>
      </form>

      {/* Blog Articles List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
          All Blog Articles ({blogs.length})
        </h4>

        {blogs.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-950 border border-dashed border-slate-800 text-xs text-slate-400">
            Abhi koi blog article nahi hai. Upar se naya article likhein.
          </div>
        ) : (
          <div className="space-y-3">
            {blogs.map((post) => (
              <div
                key={post.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {post.coverImageUrl ? (
                    <img
                      src={post.coverImageUrl}
                      alt={post.title}
                      referrerPolicy="no-referrer"
                      className="w-20 h-14 rounded-lg object-cover border border-slate-800 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className={`font-black uppercase ${
                          post.status === 'published' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {post.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 font-mono">{post.publishedAt || 'Today'}</span>
                    </div>
                    <div className="text-sm font-black text-white truncate">{post.title}</div>
                    {post.excerpt && (
                      <p className="text-xs text-slate-400 line-clamp-1">{post.excerpt}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleEdit(post)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(post)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title="Are you sure?"
        itemName={deleteTarget?.title}
        isDeleting={isDeleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
