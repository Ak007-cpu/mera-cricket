import React, { useState, useEffect } from 'react';
import {
  voiceCommentaryService,
  CommentarySettings,
  CommentaryEntry,
  CommentatorRole
} from '../../services/voiceCommentaryService';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Volume1,
  Settings,
  Radio,
  Sparkles,
  Sliders,
  Check,
  ChevronDown,
  X,
  Play,
  RotateCcw
} from 'lucide-react';

interface AICommentaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AICommentaryPanel: React.FC<AICommentaryPanelProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<CommentarySettings>(voiceCommentaryService.getSettings());
  const [history, setHistory] = useState<CommentaryEntry[]>(voiceCommentaryService.getHistory());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<CommentatorRole>('male');
  const [activeTab, setActiveTab] = useState<'live' | 'settings'>('live');

  useEffect(() => {
    const unsubEntry = voiceCommentaryService.subscribe((entry, speaking) => {
      setHistory(voiceCommentaryService.getHistory());
      setIsSpeaking(speaking);
    });

    const unsubState = voiceCommentaryService.subscribeState((speaking, speaker) => {
      setIsSpeaking(speaking);
      setCurrentSpeaker(speaker);
    });

    const unsubSettings = voiceCommentaryService.subscribeSettings((newSettings) => {
      setSettings(newSettings);
    });

    return () => {
      unsubEntry();
      unsubState();
      unsubSettings();
    };
  }, []);

  const updateSetting = <K extends keyof CommentarySettings>(key: K, value: CommentarySettings[K]) => {
    voiceCommentaryService.saveSettings({ [key]: value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end max-w-md mx-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border-t border-slate-800 rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-slate-950 shadow-md">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white">AI Cricket Commentators</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {settings.language === 'urdu_english' ? 'Bilingual Urdu + English' : settings.language === 'english' ? 'English' : 'Urdu'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab(activeTab === 'live' ? 'settings' : 'live')}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
                activeTab === 'settings'
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[11px]">{activeTab === 'settings' ? 'Live Stream' : 'Voice Settings'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Master ON/OFF Header Banner */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-200">Both Voices Master:</span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              settings.enabled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-bold'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {settings.enabled ? 'ACTIVE (7s Commentary)' : 'MUTED'}
            </span>
          </div>

          <button
            onClick={() => updateSetting('enabled', !settings.enabled)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              settings.enabled
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {settings.enabled ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Audio ON</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Audio OFF</span>
              </>
            )}
          </button>
        </div>

        {/* Two Commentators Spotlight Cards */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 grid grid-cols-2 gap-2.5">
          {/* Female Commentator Card */}
          <div className={`p-2.5 rounded-xl border transition-all ${
            isSpeaking && currentSpeaker === 'female'
              ? 'bg-rose-950/30 border-rose-500/60 ring-2 ring-rose-500/30'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-black shadow">
                  AK
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>Ayesha Khan</span>
                    {isSpeaking && currentSpeaker === 'female' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block" />
                    )}
                  </div>
                  <div className="text-[9px] text-rose-400 font-mono">Female Voice</div>
                </div>
              </div>

              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                settings.femaleVoiceEnabled
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}>
                {settings.femaleVoiceEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Match situations, player analysis & tactical review
            </p>

            <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-800/60">
              <span className="text-[10px] font-mono text-slate-400">Vol: {settings.femaleVolume}%</span>
              <button
                onClick={() => voiceCommentaryService.testFemaleVoice()}
                className="text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-0.5 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40"
              >
                <Play className="w-2.5 h-2.5" /> Test
              </button>
            </div>
          </div>

          {/* Male Commentator Card */}
          <div className={`p-2.5 rounded-xl border transition-all ${
            isSpeaking && currentSpeaker === 'male'
              ? 'bg-amber-950/30 border-amber-500/60 ring-2 ring-amber-500/30'
              : 'bg-slate-950/60 border-slate-800'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 text-[10px] font-black shadow">
                  TM
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>Tariq Mehmood</span>
                    {isSpeaking && currentSpeaker === 'male' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                    )}
                  </div>
                  <div className="text-[9px] text-amber-400 font-mono">Male Voice</div>
                </div>
              </div>

              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                settings.maleVoiceEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}>
                {settings.maleVoiceEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Boundaries, sixes, wickets & high-energy moments
            </p>

            <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-slate-800/60">
              <span className="text-[10px] font-mono text-slate-400">Vol: {settings.maleVolume}%</span>
              <button
                onClick={() => voiceCommentaryService.testMaleVoice()}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-0.5 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40"
              >
                <Play className="w-2.5 h-2.5" /> Test
              </button>
            </div>
          </div>
        </div>

        {/* Tab Body: Live Commentary Feed vs Full Settings */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {activeTab === 'live' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                  Live Conversational Feed (Every 7s)
                </span>
                <span className="text-[10px] font-mono text-emerald-400">
                  {settings.autoSwitching ? 'Alternating Duo' : 'Single Speaker'}
                </span>
              </div>

              {history.length > 0 ? (
                <div className="space-y-2.5">
                  {history.slice(0, 15).map((comm) => (
                    <div
                      key={comm.id}
                      className={`p-3 rounded-2xl border transition-all ${
                        comm.speaker === 'female'
                          ? 'bg-rose-950/20 border-rose-900/40 ml-2'
                          : 'bg-amber-950/20 border-amber-900/40 mr-2'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${comm.speaker === 'female' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                          <span className="font-bold text-xs text-white">
                            {comm.speakerName}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">
                            ({comm.roleTitle})
                          </span>
                        </div>

                        <span className="text-[9px] font-mono text-slate-500">
                          {new Date(comm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {comm.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500 space-y-2">
                  <Radio className="w-8 h-8 mx-auto opacity-30 text-amber-400" />
                  <p className="text-xs text-slate-400">AI commentators will begin speaking automatically every 7 seconds.</p>
                </div>
              )}
            </div>
          ) : (
            /* Voice Settings Panel Options */
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5" /> Commentator Voice Configuration
              </h4>

              {/* 1. Toggle Female Voice */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white">Female Cricket Commentator</div>
                  <div className="text-[10px] text-slate-400">Natural, energetic analysis voice (Ayesha Khan)</div>
                </div>
                <button
                  onClick={() => updateSetting('femaleVoiceEnabled', !settings.femaleVoiceEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.femaleVoiceEnabled ? 'bg-rose-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.femaleVoiceEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 2. Toggle Male Voice */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white">Male Cricket Commentator</div>
                  <div className="text-[10px] text-slate-400">Deep, confident sports voice (Tariq Mehmood)</div>
                </div>
                <button
                  onClick={() => updateSetting('maleVoiceEnabled', !settings.maleVoiceEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.maleVoiceEnabled ? 'bg-amber-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.maleVoiceEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 3. Automatic Voice Switching */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-white">Automatic Voice Switching</div>
                  <div className="text-[10px] text-slate-400">Naturally alternates between female and male commentators</div>
                </div>
                <button
                  onClick={() => updateSetting('autoSwitching', !settings.autoSwitching)}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                    settings.autoSwitching ? 'bg-blue-600' : 'bg-slate-800'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    settings.autoSwitching ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* 4. Female Voice Volume */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">Female Voice Volume</span>
                  <span className="font-mono text-rose-400 font-bold">{settings.femaleVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.femaleVolume}
                  onChange={(e) => updateSetting('femaleVolume', Number(e.target.value))}
                  className="w-full accent-rose-500 cursor-pointer"
                />
              </div>

              {/* 5. Male Voice Volume */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">Male Voice Volume</span>
                  <span className="font-mono text-amber-400 font-bold">{settings.maleVolume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.maleVolume}
                  onChange={(e) => updateSetting('maleVolume', Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              {/* 6. Commentary Language Selection */}
              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-2.5">
                <div className="font-bold text-xs text-white">Commentary Language</div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    { id: 'urdu_english' as const, label: 'Urdu + English', desc: 'Pakistani Urdu + Terms' },
                    { id: 'english' as const, label: 'English', desc: 'Global Broadcast' },
                    { id: 'urdu' as const, label: 'Pure Urdu', desc: 'National Urdu' }
                  ].map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => updateSetting('language', lang.id)}
                      className={`p-2 rounded-xl border text-center transition-all ${
                        settings.language === lang.id
                          ? 'bg-blue-600 text-white border-blue-400 font-bold shadow'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold">{lang.label}</div>
                      <div className="text-[9px] opacity-70 mt-0.5">{lang.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
