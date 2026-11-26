import React, { useState, useEffect } from 'react';
import { MatchState, MatchTriggerDefinition, MatchPushNotification, PushNotificationSettings } from '../../types/cricket';
import { fetchMatchTriggers } from '../../services/api';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Vibrate,
  Sliders,
  Send,
  Trash2,
  Flame,
  ShieldAlert,
  Play,
  Zap
} from 'lucide-react';

interface AndroidNotificationsPanelProps {
  match: MatchState | null;
  settings: PushNotificationSettings;
  onUpdateSettings: (newSettings: PushNotificationSettings) => void;
  history: MatchPushNotification[];
  onClearHistory: () => void;
  onTestNotification: (
    type: 'wicket' | 'boundary' | 'four' | 'six' | 'fifty' | 'century' | 'five_wickets' | 'innings_break'
  ) => void;
}

export const AndroidNotificationsPanel: React.FC<AndroidNotificationsPanelProps> = ({
  match,
  settings,
  onUpdateSettings,
  history,
  onClearHistory,
  onTestNotification
}) => {
  const [activeSection, setActiveSection] = useState<'triggers' | 'history'>('triggers');
  const [triggers, setTriggers] = useState<MatchTriggerDefinition[]>([]);
  const [browserPerm, setBrowserPerm] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  useEffect(() => {
    loadTriggers();
  }, []);

  const loadTriggers = async () => {
    try {
      const list = await fetchMatchTriggers();
      setTriggers(list);
    } catch {
      // fallback
    }
  };

  const toggleSetting = (key: keyof PushNotificationSettings) => {
    onUpdateSettings({
      ...settings,
      [key]: !settings[key]
    });
  };

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPerm(perm);
      if (perm === 'granted') {
        onUpdateSettings({ ...settings, browserNotifications: true, matchEvents: true });
        try {
          localStorage.setItem('cricket_match_events_enabled', 'true');
        } catch {}
        new Notification('Live Cricket HD', {
          body: 'Push alerts enabled! You will be notified for Wickets, Centuries, and Innings Breaks.'
        });
      }
    }
  };

  const toggleMatchEvents = async () => {
    const nextVal = settings.matchEvents === false ? true : false;
    if (nextVal) {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          onUpdateSettings({ ...settings, matchEvents: true, browserNotifications: true });
          try {
            localStorage.setItem('cricket_match_events_enabled', 'true');
          } catch {}
          new Notification('🔔 Match Events Active', {
            body: 'Real-time alerts for wickets and milestones are active!'
          });
        } else {
          const perm = await Notification.requestPermission();
          setBrowserPerm(perm);
          if (perm === 'granted') {
            onUpdateSettings({ ...settings, matchEvents: true, browserNotifications: true });
            try {
              localStorage.setItem('cricket_match_events_enabled', 'true');
            } catch {}
            new Notification('🔔 Match Events Active', {
              body: 'Real-time alerts for wickets and milestones are active!'
            });
          }
        }
      }
    } else {
      onUpdateSettings({ ...settings, matchEvents: false });
      try {
        localStorage.setItem('cricket_match_events_enabled', 'false');
      } catch {}
    }
  };

  const getTriggerIcon = (cat: string) => {
    switch (cat) {
      case 'wicket':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'century':
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'fifty':
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      case 'five_wickets':
        return <Flame className="w-4 h-4 text-emerald-400" />;
      case 'innings_break':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'six':
        return <Sparkles className="w-4 h-4 text-purple-400" />;
      case 'four':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-emerald-400" />;
    }
  };

  const isTriggerChecked = (cat: string) => {
    if (cat === 'wicket') return settings.wickets;
    if (cat === 'century' || cat === 'double_century' || cat === 'one_fifty') return settings.centuries;
    if (cat === 'fifty') return settings.fifties;
    if (cat === 'thirty') return settings.thirties;
    if (cat === 'five_wickets' || cat === 'four_wickets') return settings.fiveWickets;
    if (cat === 'three_wickets') return settings.threeWickets;
    if (cat === 'maiden') return settings.maidens;
    if (cat === 'innings_break') return settings.inningsBreak;
    if (cat === 'match_result') return settings.matchResult;
    if (cat === 'match_starting') return settings.matchStarting;
    if (cat === 'new_match') return settings.newMatchListed;
    if (cat === 'tight_finish') return settings.tightFinish;
    if (cat === 'six' || cat === 'four') return settings.boundaries;
    return true;
  };

  const toggleCategory = (cat: string) => {
    if (cat === 'wicket') toggleSetting('wickets');
    else if (cat === 'century' || cat === 'double_century' || cat === 'one_fifty') toggleSetting('centuries');
    else if (cat === 'fifty') toggleSetting('fifties');
    else if (cat === 'thirty') toggleSetting('thirties');
    else if (cat === 'five_wickets' || cat === 'four_wickets') toggleSetting('fiveWickets');
    else if (cat === 'three_wickets') toggleSetting('threeWickets');
    else if (cat === 'maiden') toggleSetting('maidens');
    else if (cat === 'innings_break') toggleSetting('inningsBreak');
    else if (cat === 'match_result') toggleSetting('matchResult');
    else if (cat === 'match_starting') toggleSetting('matchStarting');
    else if (cat === 'new_match') toggleSetting('newMatchListed');
    else if (cat === 'tight_finish') toggleSetting('tightFinish');
    else if (cat === 'six' || cat === 'four') toggleSetting('boundaries');
  };

  return (
    <div className="space-y-4">
      {/* Panel Header */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                Notification Center
              </h3>
              <p className="text-[11px] text-slate-400">Personalize real-time match event alerts</p>
            </div>
          </div>

          {/* Master Enable Pill */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">Alerts:</span>
            <button
              onClick={() => toggleSetting('enabled')}
              className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                settings.enabled ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  settings.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Sub-tabs: Alert Triggers vs Alert History */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveSection('triggers')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'triggers'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Event Alerts</span>
          </button>

          <button
            onClick={() => setActiveSection('history')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeSection === 'history'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Match Log ({history.length})</span>
          </button>
        </div>
      </div>

      {activeSection === 'triggers' && (
        <div className="space-y-3.5">
          {/* Dedicated Match Events Notification Toggle Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-2 rounded-xl transition-all ${
                    settings.matchEvents !== false
                      ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Zap className={`w-4 h-4 ${settings.matchEvents !== false ? 'fill-amber-400' : ''}`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-black text-white uppercase tracking-wider">
                      Match Events Notification
                    </div>
                    <span className="text-[9px] font-mono font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/30">
                      Notification API
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Alerts for Wickets and Milestones (50*, 100*, 5W hauls)
                  </div>
                </div>
              </div>

              <button
                onClick={toggleMatchEvents}
                className={`w-11 h-6 rounded-full transition-all relative p-0.5 shrink-0 ${
                  settings.matchEvents !== false ? 'bg-amber-500 shadow-sm' : 'bg-slate-700'
                }`}
                title="Toggle Match Events"
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-all transform shadow-sm ${
                    settings.matchEvents !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                <span>Status:</span>
                {browserPerm === 'granted' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                ) : (
                  <button
                    onClick={requestBrowserPermission}
                    className="text-amber-400 font-bold hover:underline"
                  >
                    Grant Permission
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onTestNotification('wicket')}
                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30 hover:bg-rose-500/30 transition-all"
                >
                  Test Wicket
                </button>
                <button
                  onClick={() => onTestNotification('century')}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                >
                  Test 100*
                </button>
              </div>
            </div>
          </div>

          {/* Admin Defined Match Triggers List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Admin-Defined Match Triggers
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Syncs with Studio</span>
            </div>

            {triggers.length > 0 ? (
              triggers.map((trigger) => (
                <div
                  key={trigger.id}
                  onClick={() => settings.enabled && toggleCategory(trigger.category)}
                  className={`bg-slate-900 rounded-2xl p-3 border transition-all cursor-pointer flex items-center justify-between ${
                    !settings.enabled
                      ? 'border-slate-800 opacity-50'
                      : isTriggerChecked(trigger.category)
                      ? 'border-slate-700/80 bg-slate-900 hover:border-slate-600 shadow-sm'
                      : 'border-slate-800/80 bg-slate-950/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div
                      className="p-2 rounded-xl shrink-0"
                      style={{ backgroundColor: `${trigger.badgeColor}20` }}
                    >
                      {getTriggerIcon(trigger.category)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white text-xs truncate flex items-center gap-1.5">
                        <span className="truncate">{trigger.name}</span>
                        {trigger.priority === 'high' && (
                          <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1 rounded font-mono font-bold">
                            HIGH
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {trigger.titleTemplate}
                      </div>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={isTriggerChecked(trigger.category)}
                    onChange={() => toggleCategory(trigger.category)}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded shrink-0 cursor-pointer"
                  />
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 bg-slate-900 rounded-xl border border-slate-800">
                Loading match triggers from server...
              </div>
            )}
          </div>

          {/* Delivery Preferences (Sound & Vibration) */}
          <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 space-y-3">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Alert Delivery Methods
            </span>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-amber-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Stadium Audio Alerts</div>
                  <div className="text-[10px] text-slate-400">Play horn, siren, and fanfare chimes</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={() => toggleSetting('sound')}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2.5">
                <Vibrate className="w-4 h-4 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white">Haptic Vibration</div>
                  <div className="text-[10px] text-slate-400">Vibrate phone on wickets & milestones</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.vibration}
                onChange={() => toggleSetting('vibration')}
                className="w-4 h-4 accent-blue-600 rounded"
              />
            </div>

            {/* Native Browser Notification */}
            {typeof window !== 'undefined' && 'Notification' in window && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-semibold text-white">System Notification Shade</div>
                    <div className="text-[10px] text-slate-400">Receive alerts when phone is locked</div>
                  </div>
                </div>

                {browserPerm === 'granted' ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                    Granted ✓
                  </span>
                ) : (
                  <button
                    onClick={requestBrowserPermission}
                    className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-500 transition-colors"
                  >
                    Allow
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Alert Tester */}
          <div className="bg-slate-900/60 rounded-2xl p-4 border border-dashed border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Preview Push Alert Banners
            </span>
            <p className="text-[11px] text-slate-400">
              Tap any event below to experience the real-time notification banner:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
              <button
                onClick={() => onTestNotification('wicket')}
                className="py-2 px-2 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 text-xs font-bold hover:bg-rose-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Wicket Fall</span>
              </button>

              <button
                onClick={() => onTestNotification('four')}
                className="py-2 px-2 rounded-xl bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold hover:bg-cyan-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Boundary (4)</span>
              </button>

              <button
                onClick={() => onTestNotification('six')}
                className="py-2 px-2 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30 text-xs font-bold hover:bg-purple-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Maximum (6)</span>
              </button>

              <button
                onClick={() => onTestNotification('fifty')}
                className="py-2 px-2 rounded-xl bg-yellow-600/20 text-yellow-300 border border-yellow-500/30 text-xs font-bold hover:bg-yellow-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Fifty (50*)</span>
              </button>

              <button
                onClick={() => onTestNotification('century')}
                className="py-2 px-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Century (100*)</span>
              </button>

              <button
                onClick={() => onTestNotification('five_wickets')}
                className="py-2 px-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                <span>5W Haul</span>
              </button>

              <button
                onClick={() => onTestNotification('innings_break')}
                className="py-2 px-2 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all text-center flex flex-col items-center gap-1 shadow-sm"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Innings Break</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'history' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>Match Event Feed ({history.length})</span>
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Feed
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-900 rounded-2xl p-3 border border-slate-800 space-y-1 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white uppercase tracking-tight flex items-center gap-1.5">
                      {item.type === 'wicket' && (
                        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      )}
                      {item.type === 'century' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      )}
                      {item.type === 'innings_break' && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                      )}
                      {item.title}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {new Date(item.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200">{item.body}</p>

                  {item.matchScore && (
                    <div className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                      Match: {item.matchScore}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-14 text-slate-500 space-y-2 bg-slate-900 rounded-2xl border border-slate-800 p-6">
              <Bell className="w-8 h-8 mx-auto opacity-30 text-blue-400" />
              <p className="text-xs font-semibold text-slate-300">No match events logged yet.</p>
              <p className="text-[11px] text-slate-500">
                Live wickets, centuries (100*), and innings changes will record in this live feed automatically.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
