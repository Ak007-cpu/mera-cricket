import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Radio, Save, Trash2, Type as TypeIcon } from 'lucide-react';
import { AiNewsStudioState, BroadcastTickerMode } from '../../types/cricket';
import {
  buildApiUrl,
  fetchAiNewsStudioState,
  updateAiNewsStudioConfig
} from '../../services/api';

interface StudioScrollingTickerCardProps {
  adminPin: string;
  isAuthorized: boolean;
  onOpenAiNewsStudioTab?: () => void;
  onStatusMessage: (msg: { text: string; type: 'success' | 'error' } | null) => void;
}

export const StudioScrollingTickerCard: React.FC<StudioScrollingTickerCardProps> = ({
  adminPin,
  isAuthorized,
  onOpenAiNewsStudioTab,
  onStatusMessage
}) => {
  const [studioState, setStudioState] = useState<AiNewsStudioState | null>(null);
  const [tickerEnabled, setTickerEnabled] = useState(true);
  const [tickerMode, setTickerMode] = useState<BroadcastTickerMode>('auto');
  const [manualText, setManualText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    const applyState = (st: AiNewsStudioState) => {
      setStudioState(st);
      setTickerEnabled(st.config.broadcastTickerEnabled ?? true);
      setTickerMode(st.config.broadcastTickerMode || 'auto');
      setManualText(st.config.broadcastTickerManualText || '');
    };

    fetchAiNewsStudioState().then((st) => {
      if (mounted && st) applyState(st);
    });

    let es: EventSource | null = null;
    try {
      es = new EventSource(buildApiUrl('/api/match/stream?view=broadcast'));
      es.addEventListener('ai_news_studio', (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data) as AiNewsStudioState;
          if (mounted && parsed?.config) applyState(parsed);
        } catch {}
      });
    } catch {}

    return () => {
      mounted = false;
      if (es) {
        try {
          es.close();
        } catch {}
      }
    };
  }, []);

  if (!isAuthorized) return null;

  const breakingCount = (studioState?.bulletins || []).filter((b) => b.isBreaking).length;
  const totalBulletins = studioState?.bulletins?.length || 0;

  const handleToggleVisibility = async () => {
    const next = !tickerEnabled;
    setTickerEnabled(next);
    setIsSaving(true);
    try {
      const updated = await updateAiNewsStudioConfig(
        { broadcastTickerEnabled: next },
        adminPin
      );
      setStudioState(updated);
      onStatusMessage({
        text: `Scrolling News Ticker ${next ? 'visible' : 'hidden'} on BroadcastView.`,
        type: 'success'
      });
    } catch (err: any) {
      setTickerEnabled(!next);
      onStatusMessage({
        text: err?.message || 'Failed to update ticker visibility',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTextAndMode = async () => {
    setIsSaving(true);
    try {
      const updated = await updateAiNewsStudioConfig(
        {
          broadcastTickerEnabled: tickerEnabled,
          broadcastTickerMode: tickerMode,
          broadcastTickerManualText: manualText
        },
        adminPin
      );
      setStudioState(updated);
      onStatusMessage({
        text: 'BroadcastView Scrolling News Ticker updated live.',
        type: 'success'
      });
    } catch (err: any) {
      onStatusMessage({
        text: err?.message || 'Failed to update Scrolling News Ticker',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2">
            <TypeIcon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>BroadcastView Scrolling News Ticker</span>
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
            Synced with AI News Studio ({breakingCount} breaking / {totalBulletins} verified bulletins).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onOpenAiNewsStudioTab && (
            <button
              type="button"
              onClick={onOpenAiNewsStudioTab}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Full AI News Studio</span>
            </button>
          )}

          <button
            type="button"
            role="switch"
            aria-checked={tickerEnabled}
            disabled={isSaving}
            onClick={handleToggleVisibility}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border transition-all whitespace-nowrap shrink-0 disabled:opacity-60 ${
              tickerEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {tickerEnabled ? (
              <Eye className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{tickerEnabled ? 'Ticker ON' : 'Ticker OFF'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
        <div className="lg:col-span-4 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
            Ticker Feed Source
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'auto', label: 'AI Breaking' },
                { id: 'manual', label: 'Manual' },
                { id: 'combined', label: 'Combined' }
              ] as Array<{ id: BroadcastTickerMode; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTickerMode(opt.id)}
                className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                  tickerMode === opt.id
                    ? 'bg-emerald-500/20 border-emerald-400 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Manual Ticker Text Override
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                {manualText.length}/800
              </span>
              {manualText && (
                <button
                  type="button"
                  onClick={() => setManualText('')}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              dir="auto"
              maxLength={800}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Type custom breaking text (separate items with | )..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveTextAndMode}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-black inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>{isSaving ? 'Saving...' : 'Save Ticker'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
