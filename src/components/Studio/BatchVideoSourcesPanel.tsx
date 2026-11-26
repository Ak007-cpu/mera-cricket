import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Film,
  Globe,
  Layers,
  Trash2,
  Upload,
  X,
  Youtube
} from 'lucide-react';
import {
  VideoSourceCategory,
  VideoSourceConfig,
  VideoSourceType
} from '../../types/cricket';
import {
  normalizeUrlForComparison,
  parseBatchVideoSourcesText,
  ParsedBatchVideoLine,
  SAMPLE_BATCH_TEMPLATE,
  VIDEO_SOURCE_CATEGORIES
} from '../../utils/videoSourceParser';
import { VideoSourceThumbnail } from './VideoSourceThumbnail';

interface BatchVideoSourcesPanelProps {
  existingSources: VideoSourceConfig[];
  isImporting: boolean;
  onImportSources: (
    sources: VideoSourceConfig[],
    options: { queueIntoLivePlaylist: boolean }
  ) => Promise<void>;
  onClose?: () => void;
}

export const BatchVideoSourcesPanel: React.FC<BatchVideoSourcesPanelProps> = ({
  existingSources,
  isImporting,
  onImportSources,
  onClose
}) => {
  const [rawText, setRawText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [defaultCategory, setDefaultCategory] = useState<VideoSourceCategory>('Main Feed');
  const [defaultDurationSec, setDefaultDurationSec] = useState<number>(300);
  const [defaultTypeMode, setDefaultTypeMode] = useState<'auto' | VideoSourceType>('auto');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [queueIntoLivePlaylist, setQueueIntoLivePlaylist] = useState(false);
  const [excludedKeys, setExcludedKeys] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const existingNormalizedUrls = useMemo(() => {
    const set = new Set<string>();
    for (const src of existingSources) {
      const k = normalizeUrlForComparison(src.url);
      if (k) set.add(k);
    }
    return set;
  }, [existingSources]);

  const parsedLines = useMemo(() => {
    if (!rawText.trim()) return [];
    return parseBatchVideoSourcesText(rawText, {
      defaultCategory,
      defaultDurationSec,
      defaultTypeMode,
      existingNormalizedUrls,
      skipDuplicates
    });
  }, [rawText, defaultCategory, defaultDurationSec, defaultTypeMode, existingNormalizedUrls, skipDuplicates]);

  const activeParsedLines = useMemo(
    () => parsedLines.filter((item) => !excludedKeys[item.key]),
    [parsedLines, excludedKeys]
  );

  const readyItems = useMemo(
    () => activeParsedLines.filter((item) => item.status === 'ready'),
    [activeParsedLines]
  );
  const duplicateCount = useMemo(
    () => activeParsedLines.filter((item) => item.status === 'duplicate').length,
    [activeParsedLines]
  );
  const invalidCount = useMemo(
    () => activeParsedLines.filter((item) => item.status === 'invalid').length,
    [activeParsedLines]
  );

  const handleLoadTextFile = async (file: File) => {
    setFileError(null);
    if (file.size > 1024 * 1024) {
      setFileError('Schedule text file 1MB se chhoti honi chahiye.');
      return;
    }
    try {
      const content = await file.text();
      if (!content.trim()) {
        setFileError('Selected file khali hai.');
        return;
      }
      setUploadedFileName(file.name);
      setExcludedKeys({});
      setRawText(content);
    } catch {
      setFileError('Text file read karne mein error aaya.');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      handleLoadTextFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleLoadTextFile(file);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_BATCH_TEMPLATE], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'broadcast_video_sources_template.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmImport = async () => {
    if (readyItems.length === 0 || isImporting) return;
    const baseTime = Date.now();
    const sourcesToCreate: VideoSourceConfig[] = readyItems.map((item, idx) => ({
      id: `src_${(baseTime + idx).toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: item.name,
      sourceType: item.sourceType,
      url: item.url,
      category: item.category,
      notes: item.notes,
      durationSec: item.durationSec,
      createdAt: baseTime + idx,
      updatedAt: baseTime + idx
    }));

    await onImportSources(sourcesToCreate, { queueIntoLivePlaylist });
    setRawText('');
    setUploadedFileName('');
    setExcludedKeys({});
    setFileError(null);
  };

  const renderTypePill = (type: VideoSourceType) => {
    if (type === 'youtube') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/35 text-[9px] font-black uppercase">
          <Youtube className="w-2.5 h-2.5" />
          <span>YT</span>
        </span>
      );
    }
    if (type === 'local_video') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/35 text-[9px] font-black uppercase">
          <Film className="w-2.5 h-2.5" />
          <span>MP4</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/35 text-[9px] font-black uppercase">
        <Globe className="w-2.5 h-2.5" />
        <span>URL</span>
      </span>
    );
  };

  return (
    <div className="rounded-xl bg-slate-950/95 border border-sky-500/40 p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
        <div>
          <div className="text-xs font-black uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Import Broadcast Schedule (.txt / .csv / .m3u)</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Text file upload karein ya multiple YouTube / Stream URLs paste karein (1 URL per line ya <code className="text-sky-300">Feed Name | URL | Category | Duration</code>).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1.5"
          >
            <Download className="w-3 h-3 text-sky-400" />
            <span>Sample .txt</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Close</span>
            </button>
          )}
        </div>
      </div>

      {/* File Dropzone + Default Batch Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`lg:col-span-5 rounded-xl border border-dashed p-3.5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            isDragging
              ? 'bg-sky-950/50 border-sky-400 text-sky-200'
              : 'bg-slate-900/70 hover:bg-slate-900 border-slate-700 hover:border-sky-500/60 text-slate-300'
          }`}
        >
          <Upload className="w-5 h-5 text-sky-400 mb-1.5" />
          <div className="text-xs font-black text-white">
            {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Upload Schedule Text File'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Drag &amp; drop or click to choose <code className="text-sky-300">.txt</code>, <code className="text-sky-300">.csv</code>, or <code className="text-sky-300">.m3u</code>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.m3u,.m3u8,text/plain,text/csv"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-900/70 border border-slate-800 rounded-xl p-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Default Type
            </label>
            <select
              value={defaultTypeMode}
              onChange={(e) => setDefaultTypeMode(e.target.value as 'auto' | VideoSourceType)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-400"
            >
              <option value="auto">Auto Detect URL</option>
              <option value="youtube">Force YouTube</option>
              <option value="embed">Force Stream / Embed</option>
              <option value="local_video">Force Local Video</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Default Category
            </label>
            <select
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value as VideoSourceCategory)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-sky-400"
            >
              {VIDEO_SOURCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Duration (Sec)
            </label>
            <input
              type="number"
              min={3}
              max={600}
              value={defaultDurationSec}
              onChange={(e) => setDefaultDurationSec(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs font-bold text-white text-center focus:outline-none focus:border-sky-400"
            />
          </div>

          <label className="col-span-2 sm:col-span-3 flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="accent-sky-500 rounded"
              />
              <span>Skip duplicate URLs already saved or repeated in file</span>
            </span>

            <span className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={queueIntoLivePlaylist}
                onChange={(e) => setQueueIntoLivePlaylist(e.target.checked)}
                className="accent-emerald-500 rounded"
              />
              <span>Also queue imported feeds into Broadcast TV Playlist</span>
            </span>
          </label>
        </div>
      </div>

      {/* Bulk Textarea Editor */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <label className="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-sky-400" />
            <span>Paste or Edit Stream URLs (Up to 250 lines)</span>
          </label>
          {rawText && (
            <button
              type="button"
              onClick={() => {
                setRawText('');
                setUploadedFileName('');
                setExcludedKeys({});
                setFileError(null);
              }}
              className="text-slate-400 hover:text-rose-300 font-bold"
            >
              Clear Text
            </button>
          )}
        </div>

        <textarea
          rows={5}
          value={rawText}
          onChange={(e) => {
            setRawText(e.target.value);
            setExcludedKeys({});
            if (fileError) setFileError(null);
          }}
          placeholder={`PAK vs SL HD Main | https://www.youtube.com/watch?v=...\nBackup Feed | http://localhost:8080/live.html | Backup Feed | 300\nhttps://youtu.be/...`}
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-sky-400 leading-relaxed"
        />
      </div>

      {fileError && (
        <div className="p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {/* Parsed Preview Queue */}
      {activeParsedLines.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                Ready: {readyItems.length}
              </span>
              {duplicateCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                  Duplicates Skipped: {duplicateCount}
                </span>
              )}
              {invalidCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300">
                  Invalid Lines: {invalidCount}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={readyItems.length === 0 || isImporting}
              onClick={handleConfirmImport}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black inline-flex items-center gap-1.5 shadow"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isImporting
                  ? 'Importing...'
                  : `Import ${readyItems.length} Valid Source${readyItems.length === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
            {activeParsedLines.map((item: ParsedBatchVideoLine) => (
              <div
                key={item.key}
                className={`rounded-xl border p-2.5 flex items-center justify-between gap-3 ${
                  item.status === 'ready'
                    ? 'bg-slate-900/90 border-slate-800'
                    : item.status === 'duplicate'
                    ? 'bg-amber-950/20 border-amber-500/35 opacity-80'
                    : 'bg-rose-950/25 border-rose-500/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {item.status !== 'invalid' ? (
                    <VideoSourceThumbnail
                      name={item.name}
                      url={item.url}
                      sourceType={item.sourceType}
                      durationSec={item.durationSec}
                      size="sm"
                    />
                  ) : (
                    <div className="w-20 aspect-video rounded-lg bg-rose-950/60 border border-rose-500/40 flex items-center justify-center shrink-0">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-500">
                        L{item.lineNumber}
                      </span>
                      {item.status !== 'invalid' && renderTypePill(item.sourceType)}
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[9px] font-bold">
                        {item.category}
                      </span>
                      {item.status === 'duplicate' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase">
                          Duplicate
                        </span>
                      )}
                      {item.status === 'invalid' && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black uppercase">
                          Invalid
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-white truncate">{item.name}</div>
                    {item.reason ? (
                      <div className="text-[11px] text-rose-300 truncate">{item.reason}</div>
                    ) : (
                      <div className="text-[11px] font-mono text-slate-400 truncate">
                        {item.url}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setExcludedKeys((prev) => ({ ...prev, [item.key]: true }))}
                  aria-label={`Remove line ${item.lineNumber}`}
                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
