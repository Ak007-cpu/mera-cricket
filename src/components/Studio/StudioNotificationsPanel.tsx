import React, { useState, useEffect } from 'react';
import { MatchState, ActiveMatchConfig, MatchTriggerDefinition } from '../../types/cricket';
import {
  fetchMatchTriggers,
  updateMatchTriggers,
  sendPushBroadcast,
  triggerLiveEvent
} from '../../services/api';
import {
  Bell,
  Sliders,
  Send,
  Save,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  AlertCircle,
  Clock,
  Layers,
  Radio
} from 'lucide-react';

interface StudioNotificationsPanelProps {
  match: MatchState | null;
  config: ActiveMatchConfig | null;
  adminPin: string;
  isAuthorized: boolean;
  onRefresh: () => void;
}

export const StudioNotificationsPanel: React.FC<StudioNotificationsPanelProps> = ({
  match,
  config,
  adminPin,
  isAuthorized,
  onRefresh
}) => {
  const [triggers, setTriggers] = useState<MatchTriggerDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Custom Push Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState('MATCH DELAY ANNOUNCEMENT');
  const [broadcastMessage, setBroadcastMessage] = useState(
    'Play resumed after brief rain delay. Overs reduced to 18 overs per side!'
  );
  const [broadcastPriority, setBroadcastPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [broadcastSound, setBroadcastSound] = useState<'wicket' | 'century' | 'innings_break' | 'six' | 'four'>('innings_break');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);

  useEffect(() => {
    loadTriggers();
  }, [config?.activeMatchId]);

  const loadTriggers = async () => {
    setIsLoading(true);
    try {
      const list = await fetchMatchTriggers();
      setTriggers(list);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTrigger = (id: string) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabledGlobally: !t.enabledGlobally } : t))
    );
  };

  const handleUpdateTemplate = (id: string, field: 'titleTemplate' | 'descriptionTemplate', val: string) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  const handleUpdateSound = (id: string, sound: MatchTriggerDefinition['sound']) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, sound } : t))
    );
  };

  const handleUpdatePriority = (id: string, priority: MatchTriggerDefinition['priority']) => {
    setTriggers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, priority } : t))
    );
  };

  const handleSaveTriggers = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage('');
    try {
      await updateMatchTriggers(triggers, adminPin);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save triggers');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestTrigger = async (cat: string) => {
    try {
      await triggerLiveEvent(cat as any, adminPin);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setIsSendingBroadcast(true);
    setBroadcastSent(false);
    try {
      await sendPushBroadcast(broadcastTitle, broadcastMessage, broadcastPriority, broadcastSound, adminPin);
      setBroadcastSent(true);
      setTimeout(() => setBroadcastSent(false), 3000);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to dispatch broadcast');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold text-xs border border-amber-500/30 flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" /> TRIGGER ENGINE
            </span>
            <span className="text-xs text-slate-400">Push Notification Rules & Templates</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Admin Notification Triggers Manager
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Define, customize, and broadcast match event triggers (Wickets, 50s, 100s, Innings Breaks). Configured rules sync automatically to all connected user devices.
          </p>
        </div>

        <button
          onClick={handleSaveTriggers}
          disabled={!isAuthorized || isSaving}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Saving...' : 'Save & Publish Rules'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Triggers and notification rules saved to backend and broadcasted to all mobile apps!</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Triggers Definition Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-blue-400">
              <Sliders className="w-4 h-4" /> Match Event Triggers Configuration
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Variables available in templates: <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px]">&#123;&#123;player&#125;&#125;</code>, <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px]">&#123;&#123;bowler&#125;&#125;</code>, <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px]">&#123;&#123;score&#125;&#125;</code>, <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px]">&#123;&#123;balls&#125;&#125;</code>, <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px]">&#123;&#123;teamScore&#125;&#125;</code>, <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded text-[11px]">&#123;&#123;target&#125;&#125;</code>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {triggers.map((trigger) => (
            <div
              key={trigger.id}
              className={`p-4 rounded-xl border transition-all space-y-3 ${
                trigger.enabledGlobally
                  ? 'bg-slate-950/80 border-slate-700/80'
                  : 'bg-slate-950/40 border-slate-800 opacity-60'
              }`}
            >
              {/* Top row: Name, Category, Global Toggle, Test Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: trigger.badgeColor }}
                  />
                  <div>
                    <span className="font-bold text-white text-sm">{trigger.name}</span>
                    <span className="text-[11px] text-slate-400 ml-2 font-mono">[{trigger.category}]</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Test button */}
                  <button
                    onClick={() => handleTestTrigger(trigger.category)}
                    disabled={!isAuthorized}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition-all disabled:opacity-40"
                    title={`Fire test alert for ${trigger.name}`}
                  >
                    <Play className="w-3 h-3 text-amber-400" />
                    <span>Test Event</span>
                  </button>

                  {/* Global Toggle */}
                  <button
                    onClick={() => handleToggleTrigger(trigger.id)}
                    disabled={!isAuthorized}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      trigger.enabledGlobally
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {trigger.enabledGlobally ? 'ACTIVE' : 'DISABLED'}
                  </button>
                </div>
              </div>

              {/* Editable Templates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Alert Title Template:
                  </label>
                  <input
                    type="text"
                    value={trigger.titleTemplate}
                    onChange={(e) => handleUpdateTemplate(trigger.id, 'titleTemplate', e.target.value)}
                    disabled={!isAuthorized}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    Alert Description Template:
                  </label>
                  <input
                    type="text"
                    value={trigger.descriptionTemplate}
                    onChange={(e) =>
                      handleUpdateTemplate(trigger.id, 'descriptionTemplate', e.target.value)
                    }
                    disabled={!isAuthorized}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Sound & Priority Settings */}
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1 border-t border-slate-900">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Audio Chime:</span>
                  <select
                    value={trigger.sound}
                    onChange={(e) => handleUpdateSound(trigger.id, e.target.value as any)}
                    disabled={!isAuthorized}
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="wicket">Wicket Siren</option>
                    <option value="century">Century Fanfare</option>
                    <option value="innings_break">Innings Break Horn</option>
                    <option value="six">Six Double Chime</option>
                    <option value="four">Four High Beep</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-[11px]">Notification Priority:</span>
                  <select
                    value={trigger.priority}
                    onChange={(e) => handleUpdatePriority(trigger.id, e.target.value as any)}
                    disabled={!isAuthorized}
                    className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-300 text-xs focus:outline-none"
                  >
                    <option value="high">High (Heads-up + Loud Sound + Haptic)</option>
                    <option value="medium">Medium (Standard Banner + Chime)</option>
                    <option value="low">Low (Toast Only)</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instant Push Broadcast Composer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div>
          <h3 className="font-bold text-white text-sm uppercase tracking-wider flex items-center gap-2 text-emerald-400">
            <Send className="w-4 h-4" /> Instant Live Match Push Broadcast
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Send an instant custom announcement banner directly to all mobile users currently streaming the match.
          </p>
        </div>

        {broadcastSent && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Custom push broadcast delivered to all connected Android apps!</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Broadcast Title / Headline:
            </label>
            <input
              type="text"
              value={broadcastTitle}
              onChange={(e) => setBroadcastTitle(e.target.value)}
              disabled={!isAuthorized}
              placeholder="e.g. INJURY TIMEOUT, RAIN DELAY, PRESENTATION CEREMONY"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Announcement Message Body:
            </label>
            <textarea
              rows={2}
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              disabled={!isAuthorized}
              placeholder="Enter announcement text to display on mobile devices..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Audio:</span>
                <select
                  value={broadcastSound}
                  onChange={(e) => setBroadcastSound(e.target.value as any)}
                  disabled={!isAuthorized}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="innings_break">Stadium Horn</option>
                  <option value="century">Celebration Chime</option>
                  <option value="wicket">Buzzer Alert</option>
                  <option value="six">Six Chime</option>
                  <option value="four">Beep</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">Priority:</span>
                <select
                  value={broadcastPriority}
                  onChange={(e) => setBroadcastPriority(e.target.value as any)}
                  disabled={!isAuthorized}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                >
                  <option value="high">High (Banner + Sound + Vibrate)</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleSendBroadcast}
              disabled={!isAuthorized || isSendingBroadcast || !broadcastMessage.trim()}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingBroadcast ? 'Broadcasting...' : 'Broadcast Push Alert'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
