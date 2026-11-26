import React, { useState } from 'react';
import { PushNotificationSettings, MatchPushNotification } from '../../types/cricket';
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
  X,
  Trash2,
  Sliders,
  Send,
  Flame
} from 'lucide-react';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PushNotificationSettings;
  onUpdateSettings: (newSettings: PushNotificationSettings) => void;
  history: MatchPushNotification[];
  onClearHistory: () => void;
  onTestNotification: (type: 'wicket' | 'fifty' | 'century' | 'five_wickets' | 'innings_break') => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  history,
  onClearHistory,
  onTestNotification
}) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [permissionState, setPermissionState] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  if (!isOpen) return null;

  const toggleSetting = (key: keyof PushNotificationSettings) => {
    onUpdateSettings({
      ...settings,
      [key]: !settings[key]
    });
  };

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermissionState(perm);
      if (perm === 'granted') {
        onUpdateSettings({ ...settings, browserNotifications: true });
        new Notification('Live Cricket HD', {
          body: 'Push notifications enabled for Wickets, Centuries, and Innings Breaks!'
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white uppercase tracking-wider">
                Match Push Alerts
              </h3>
              <p className="text-[11px] text-slate-400">Real-time alerts for key game moments</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950 px-4 pt-1">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Alert Preferences</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alert History ({history.length})</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Master Push Toggle */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">Enable Match Notifications</div>
                  <div className="text-[11px] text-slate-400">
                    Receive heads-up banners on live match events
                  </div>
                </div>
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

              {/* Event Subscriptions */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                  Alert Triggers
                </span>

                {/* Wicket Falls */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                      <AlertCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs">Wicket Falls</div>
                      <div className="text-[10px] text-slate-400">Instant alert when a batsman is dismissed</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.wickets}
                    onChange={() => toggleSetting('wickets')}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                {/* Centuries (100 runs) */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs">Centuries (100 Runs)</div>
                      <div className="text-[10px] text-slate-400">Celebration alert when any player reaches 100*</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.centuries}
                    onChange={() => toggleSetting('centuries')}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                {/* Innings Break */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs">Innings Break</div>
                      <div className="text-[10px] text-slate-400">Target score announcement & 2nd innings start</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.inningsBreak}
                    onChange={() => toggleSetting('inningsBreak')}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                {/* Fifties (50 runs) */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400">
                      <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs">Half-Centuries (50 Runs)</div>
                      <div className="text-[10px] text-slate-400">Player milestone alerts</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.fifties}
                    onChange={() => toggleSetting('fifties')}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                {/* 5-Wicket Hauls */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs">5-Wicket Hauls (5W)</div>
                      <div className="text-[10px] text-slate-400">Bowler five wicket milestone alerts</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.fiveWickets}
                    onChange={() => toggleSetting('fiveWickets')}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                {/* Boundaries */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-white text-xs">Boundaries (4s & 6s)</div>
                      <div className="text-[10px] text-slate-400">Alert on 4s and maximum sixes</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.boundaries}
                    onChange={() => toggleSetting('boundaries')}
                    disabled={!settings.enabled}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>
              </div>

              {/* Sound & Haptic Controls */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Delivery Methods
                </span>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-200">Stadium Audio Chimes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sound}
                    onChange={() => toggleSetting('sound')}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vibrate className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-200">Device Haptic Vibration</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.vibration}
                    onChange={() => toggleSetting('vibration')}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                </div>

                {/* Native Browser Notification Permission Button */}
                {typeof window !== 'undefined' && 'Notification' in window && (
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-slate-200">System Notification Shade</div>
                      <div className="text-[10px] text-slate-400">Alerts even when in another app tab</div>
                    </div>
                    {permissionState === 'granted' ? (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        Granted ✓
                      </span>
                    ) : (
                      <button
                        onClick={requestBrowserPermission}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-500 transition-colors"
                      >
                        Grant
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Instant Test Buttons */}
              <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-dashed border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Instant Push Notification Test
                </span>
                <p className="text-[11px] text-slate-400">
                  Tap to trigger a simulated notification banner on your phone:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  <button
                    onClick={() => onTestNotification('wicket')}
                    className="py-1.5 px-2 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold hover:bg-rose-600 hover:text-white transition-all text-center"
                  >
                    Test Wicket
                  </button>
                  <button
                    onClick={() => onTestNotification('fifty')}
                    className="py-1.5 px-2 rounded-xl bg-yellow-600/20 text-yellow-300 border border-yellow-500/30 text-[11px] font-bold hover:bg-yellow-600 hover:text-white transition-all text-center"
                  >
                    Test 50*
                  </button>
                  <button
                    onClick={() => onTestNotification('century')}
                    className="py-1.5 px-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold hover:bg-amber-600 hover:text-white transition-all text-center"
                  >
                    Test 100*
                  </button>
                  <button
                    onClick={() => onTestNotification('five_wickets')}
                    className="py-1.5 px-2 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold hover:bg-emerald-600 hover:text-white transition-all text-center"
                  >
                    Test 5W
                  </button>
                  <button
                    onClick={() => onTestNotification('innings_break')}
                    className="py-1.5 px-2 rounded-xl bg-blue-600/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold hover:bg-blue-600 hover:text-white transition-all text-center"
                  >
                    Test Break
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Recent Match Events ({history.length})</span>
                {history.length > 0 && (
                  <button
                    onClick={onClearHistory}
                    className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Clear All
                  </button>
                )}
              </div>

              {history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-black text-white uppercase tracking-tight flex items-center gap-1.5">
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

                      <p className="text-xs text-slate-300">{item.body}</p>

                      {item.matchScore && (
                        <div className="text-[10px] text-amber-400/90 font-mono">
                          {item.matchScore}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <Bell className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs">No alerts yet in this match session.</p>
                  <p className="text-[11px] text-slate-600">
                    Alerts will log here when wickets fall, centuries are scored, or innings change.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
