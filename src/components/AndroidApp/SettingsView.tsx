import React, { useState, useEffect } from 'react';
import { PushNotificationSettings } from '../../types/cricket';
import {
  voiceCommentaryService,
  CommentarySettings
} from '../../services/voiceCommentaryService';
import {
  Sliders,
  Bell,
  AlertCircle,
  Trophy,
  Flame,
  Clock,
  Sparkles,
  Volume2,
  VolumeX,
  Vibrate,
  ShieldCheck,
  RotateCcw,
  Globe,
  Server,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  Mic,
  Play,
  Zap
} from 'lucide-react';
import { getApiBaseUrl, setCustomApiBaseUrl, buildApiUrl } from '../../services/api';
import { nativeNotifications } from '../../services/nativeNotifications';

interface SettingsViewProps {
  settings: PushNotificationSettings;
  onUpdateSettings: (newSettings: PushNotificationSettings) => void;
  onResetDefaults?: () => void;
  onTestNotification?: (
    type:
      | 'wicket'
      | 'fifty'
      | 'century'
      | 'five_wickets'
      | 'innings_break'
      | 'boundary'
      | 'four'
      | 'six'
  ) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetDefaults,
  onTestNotification
}) => {
  const [browserPerm, setBrowserPerm] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [backendUrlInput, setBackendUrlInput] = useState<string>(() => getApiBaseUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // AI Voice Commentary Settings
  const [voiceSettings, setVoiceSettings] = useState<CommentarySettings>(() =>
    voiceCommentaryService.getSettings()
  );

  useEffect(() => {
    return voiceCommentaryService.subscribeSettings((s) => setVoiceSettings(s));
  }, []);

  const updateVoice = <K extends keyof CommentarySettings>(k: K, val: CommentarySettings[K]) => {
    voiceCommentaryService.saveSettings({ [k]: val });
  };

  const toggle = (key: keyof PushNotificationSettings) => {
    onUpdateSettings({
      ...settings,
      [key]: !settings[key]
    });
  };

  const requestBrowserPermission = async () => {
    const perm = await nativeNotifications.requestPermission();
    setBrowserPerm(perm);
    if (perm === 'granted') {
      onUpdateSettings({ ...settings, browserNotifications: true, matchEvents: true });
      try {
        localStorage.setItem('cricket_match_events_enabled', 'true');
      } catch {}
      nativeNotifications.scheduleLocalNotification({
        id: `perm_grant_${Date.now()}`,
        title: '🔔 Live Cricket HD Push Active',
        body: 'Push alerts enabled! You will be notified for Wickets, 50s, Centuries, and 5-Wicket Hauls.',
        data: { eventType: 'custom', targetScreen: 'home' }
      });
    }
  };

  const toggleMatchEvents = async () => {
    const nextVal = settings.matchEvents === false ? true : false;
    if (nextVal) {
      const perm = await nativeNotifications.requestPermission();
      setBrowserPerm(perm);
      if (perm === 'granted') {
        onUpdateSettings({ ...settings, matchEvents: true, browserNotifications: true, wickets: true, fifties: true, centuries: true });
        try {
          localStorage.setItem('cricket_match_events_enabled', 'true');
        } catch {}
        nativeNotifications.scheduleLocalNotification({
          id: `match_events_active_${Date.now()}`,
          title: '🔔 Match Events Push Active',
          body: 'Real-time alerts for wickets and milestones (50, 100 runs) are active!',
          data: { eventType: 'custom', targetScreen: 'home' }
        });
      }
    } else {
      onUpdateSettings({ ...settings, matchEvents: false });
      try {
        localStorage.setItem('cricket_match_events_enabled', 'false');
      } catch {}
    }
  };

  const handleSaveAndTestBackend = async () => {
    setTestStatus('testing');
    setStatusMessage('Pinging server endpoint...');
    setCustomApiBaseUrl(backendUrlInput);

    try {
      const url = buildApiUrl('/api/system/status');
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const json = await res.json();
      if (json.status === 'online') {
        setTestStatus('success');
        setStatusMessage(`Connected! Match ID: ${json.activeMatchId || 'ready'}, Server Online.`);
      } else {
        setTestStatus('success');
        setStatusMessage('Connected to server successfully!');
      }
    } catch (e: any) {
      setTestStatus('error');
      setStatusMessage(`Connection failed: ${e.message || 'Check URL and ensure server is running'}`);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Settings Header Card */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Notification Preferences</h3>
              <p className="text-[11px] text-slate-400">Control real-time alerts and delivery methods</p>
            </div>
          </div>

          {/* Master Enable Pill */}
          <button
            onClick={() => toggle('enabled')}
            className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
              settings.enabled ? 'bg-blue-600' : 'bg-slate-700'
            }`}
            title="Master Alert Toggle"
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Cloud Backend Server Configuration */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Cloud Backend (Render / HTTPS)
              </span>
              <span className="text-[10px] text-slate-400">Connect on 4G, 5G, or any Wi-Fi</span>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-bold">
            Cloud Ready
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-300 block">
            HTTPS Server Endpoint:
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://your-app.onrender.com"
              value={backendUrlInput}
              onChange={(e) => setBackendUrlInput(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleSaveAndTestBackend}
              disabled={testStatus === 'testing'}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 transition-colors disabled:opacity-50"
            >
              {testStatus === 'testing' ? 'Testing...' : 'Save & Test'}
            </button>
          </div>
          {statusMessage && (
            <div
              className={`p-2 rounded-lg text-[11px] flex items-center gap-1.5 ${
                testStatus === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-800 text-rose-300'
              }`}
            >
              {testStatus === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            Current Host: <code className="text-amber-300 font-mono">{getApiBaseUrl() || 'Auto (Origin)'}</code>
          </p>
        </div>
      </div>

      {/* Match Discovery & Schedule Alerts */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Match Discovery Alerts
          </span>
          <span className="text-[10px] text-blue-400 font-mono">CREX Schedule</span>
        </div>

        {/* New Match Listed */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">New Match Listed</div>
              <div className="text-[10px] text-slate-400">Alert when a new match is added to CREX</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.newMatchListed}
            onChange={() => toggle('newMatchListed')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Match Starting */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Match Starting Alert</div>
              <div className="text-[10px] text-slate-400">Alert when an upcoming match goes LIVE</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.matchStarting}
            onChange={() => toggle('matchStarting')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Match Status Updates */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Match Status Updates</div>
              <div className="text-[10px] text-slate-400">Toss, rain delays, and match progress</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.matchStatusUpdates}
            onChange={() => toggle('matchStatusUpdates')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Match Events Notification API Toggle Card */}
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
                Browser alert when a wicket falls or milestone (50*, 100*, 5W) is reached
              </div>
            </div>
          </div>
          <button
            onClick={toggleMatchEvents}
            className={`w-11 h-6 rounded-full transition-all relative p-0.5 shrink-0 ${
              settings.matchEvents !== false ? 'bg-amber-500 shadow-sm' : 'bg-slate-700'
            }`}
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
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Permission Needed
              </span>
            )}
          </div>
          {onTestNotification && (
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
          )}
        </div>
      </div>

      {/* Match Event Trigger Subscriptions */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Live Match Milestone Triggers
          </span>
          <span className="text-[10px] text-emerald-400 font-mono">Deduplicated Real-time</span>
        </div>

        {/* Wickets */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Wicket Falls</div>
              <div className="text-[10px] text-slate-400">Instant alert when a wicket is taken</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.wickets}
            onChange={() => toggle('wickets')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Centuries (100*) */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Centuries (100* Runs)</div>
              <div className="text-[10px] text-slate-400">Landmark hundred celebrations</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.centuries}
            onChange={() => toggle('centuries')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Half Centuries (50*) */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Half-Centuries (50* Runs)</div>
              <div className="text-[10px] text-slate-400">Player fifty milestone alerts</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.fifties}
            onChange={() => toggle('fifties')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* 30 Runs Milestones */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">30 Runs Milestones</div>
              <div className="text-[10px] text-slate-400">Quickfire thirty runs alerts</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.thirties}
            onChange={() => toggle('thirties')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Double Centuries (150* / 200*) */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Double Centuries (150* / 200*)</div>
              <div className="text-[10px] text-slate-400">Monumental 150+ and 200+ landmarks</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.doubleCenturies}
            onChange={() => toggle('doubleCenturies')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* 5-Wicket Hauls (5W) */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">5-Wicket Hauls (5W)</div>
              <div className="text-[10px] text-slate-400">Bowler 5-wicket masterclass alert</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.fiveWickets}
            onChange={() => toggle('fiveWickets')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* 3-Wicket / 4-Wicket Hauls */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">3-Wicket & 4-Wicket Spells</div>
              <div className="text-[10px] text-slate-400">Bowler key breakthroughs</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.threeWickets}
            onChange={() => toggle('threeWickets')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Maiden Overs */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-600/30 text-slate-300">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Maiden Overs Bowled</div>
              <div className="text-[10px] text-slate-400">6 consecutive dot balls bowled</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.maidenOvers}
            onChange={() => toggle('maidenOvers')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Boundaries (4s & 6s) */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Boundaries (4s & 6s)</div>
              <div className="text-[10px] text-slate-400">Big hits and maximum sixes</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.boundaries}
            onChange={() => toggle('boundaries')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Innings Break */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Innings Break & Target</div>
              <div className="text-[10px] text-slate-400">End of 1st innings target announcement</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.inningsBreak}
            onChange={() => toggle('inningsBreak')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {/* Official Match Result */}
        <div className="flex items-center justify-between py-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Official Match Result</div>
              <div className="text-[10px] text-slate-400">Victory announcement and final outcome</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.matchResult}
            onChange={() => toggle('matchResult')}
            disabled={!settings.enabled}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* AI Cricket Commentator Voices Panel (Ayesha Khan & Tariq Mehmood) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 rounded-2xl p-4 border border-indigo-900/40 shadow-lg space-y-3.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 text-slate-950">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">AI Cricket Commentators</span>
              <span className="text-[10px] text-slate-400">Two realistic voices • Urdu + English</span>
            </div>
          </div>

          <button
            onClick={() => updateVoice('enabled', !voiceSettings.enabled)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              voiceSettings.enabled
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            {voiceSettings.enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{voiceSettings.enabled ? 'Both Voices ON' : 'Both Voices OFF'}</span>
          </button>
        </div>

        {/* Language Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-300">Commentary Language</label>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <button
              onClick={() => updateVoice('language', 'urdu_english')}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                voiceSettings.language === 'urdu_english'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Urdu + English
            </button>
            <button
              onClick={() => updateVoice('language', 'english')}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                voiceSettings.language === 'english'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              English
            </button>
            <button
              onClick={() => updateVoice('language', 'urdu')}
              className={`py-1.5 px-2 rounded-lg font-bold border transition-all text-center ${
                voiceSettings.language === 'urdu'
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Urdu
            </button>
          </div>
        </div>

        {/* Automatic Voice Switching */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div>
            <div className="text-xs font-semibold text-white">Automatic Voice Switching</div>
            <div className="text-[10px] text-slate-400">Alternate naturally between Ayesha & Tariq</div>
          </div>
          <input
            type="checkbox"
            checked={voiceSettings.autoSwitching}
            onChange={(e) => updateVoice('autoSwitching', e.target.checked)}
            disabled={!voiceSettings.enabled}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>

        {/* Female Voice: Ayesha Khan */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white font-black text-[10px] flex items-center justify-center shadow">
                AK
              </span>
              <div>
                <span className="text-xs font-bold text-white block">Female Voice (Ayesha Khan)</span>
                <span className="text-[10px] text-rose-400">Match situations & player analysis</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => voiceCommentaryService.testFemaleVoice()}
                className="text-[10px] px-2 py-0.5 rounded bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600/30 flex items-center gap-1 font-bold"
              >
                <Play className="w-2.5 h-2.5" /> Test
              </button>
              <input
                type="checkbox"
                checked={voiceSettings.femaleVoiceEnabled}
                onChange={(e) => updateVoice('femaleVoiceEnabled', e.target.checked)}
                disabled={!voiceSettings.enabled}
                className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-400 w-14">Volume:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={voiceSettings.femaleVolume}
              onChange={(e) => updateVoice('femaleVolume', Number(e.target.value))}
              disabled={!voiceSettings.enabled || !voiceSettings.femaleVoiceEnabled}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg accent-rose-500 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-300 w-8 text-right">
              {voiceSettings.femaleVolume}%
            </span>
          </div>
        </div>

        {/* Male Voice: Tariq Mehmood */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-[10px] flex items-center justify-center shadow">
                TM
              </span>
              <div>
                <span className="text-xs font-bold text-white block">Male Voice (Tariq Mehmood)</span>
                <span className="text-[10px] text-blue-400">Deep, confident sports voice • 4s, 6s, wickets</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => voiceCommentaryService.testMaleVoice()}
                className="text-[10px] px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30 flex items-center gap-1 font-bold"
              >
                <Play className="w-2.5 h-2.5" /> Test
              </button>
              <input
                type="checkbox"
                checked={voiceSettings.maleVoiceEnabled}
                onChange={(e) => updateVoice('maleVoiceEnabled', e.target.checked)}
                disabled={!voiceSettings.enabled}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-400 w-14">Volume:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={voiceSettings.maleVolume}
              onChange={(e) => updateVoice('maleVolume', Number(e.target.value))}
              disabled={!voiceSettings.enabled || !voiceSettings.maleVoiceEnabled}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] font-mono text-slate-300 w-8 text-right">
              {voiceSettings.maleVolume}%
            </span>
          </div>
        </div>
      </div>

      {/* Delivery Audio & Vibration Controls */}
      <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block pb-2 border-b border-slate-800">
          Alert Feedback Methods
        </span>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-xs font-semibold text-white">Stadium Audio Fanfare</div>
              <div className="text-[10px] text-slate-400">Chimes, stadium siren, and trumpets</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={() => toggle('sound')}
            className="w-4 h-4 accent-blue-600 rounded"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
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
            onChange={() => toggle('vibration')}
            className="w-4 h-4 accent-blue-600 rounded"
          />
        </div>

        {/* Native Browser Notification */}
        {typeof window !== 'undefined' && 'Notification' in window && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-2.5">
              <Bell className="w-4 h-4 text-blue-400" />
              <div>
                <div className="text-xs font-semibold text-white">System Notification Shade</div>
                <div className="text-[10px] text-slate-400">Push to lock screen & notification panel</div>
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

      {/* Reset Defaults button */}
      {onResetDefaults && (
        <div className="text-center pt-1">
          <button
            onClick={onResetDefaults}
            className="text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-lg bg-slate-900 border border-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Settings</span>
          </button>
        </div>
      )}
    </div>
  );
};
