import React, { useState, useEffect } from 'react';
import { MatchState, BallEvent } from '../../types/cricket';
import {
  voiceCommentaryService,
  CommentaryEntry,
  CommentarySettings,
  CommentatorRole
} from '../../services/voiceCommentaryService';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  Radio,
  UserCheck,
  Play,
  RotateCcw,
  MessageSquareText,
  Activity,
  Flame,
  Award
} from 'lucide-react';

interface CommentaryViewProps {
  recentBalls: BallEvent[];
  match?: MatchState | null;
  onOpenSettings?: () => void;
}

export const CommentaryView: React.FC<CommentaryViewProps> = ({
  recentBalls,
  match,
  onOpenSettings
}) => {
  const [settings, setSettings] = useState<CommentarySettings>(voiceCommentaryService.getSettings());
  const [history, setHistory] = useState<CommentaryEntry[]>(voiceCommentaryService.getHistory());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<CommentatorRole>('male');
  const [viewMode, setViewMode] = useState<'ai_commentary' | 'ball_by_ball'>('ai_commentary');

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

  const toggleMaster = () => {
    voiceCommentaryService.saveSettings({ enabled: !settings.enabled });
  };

  const toggleFemale = () => {
    voiceCommentaryService.saveSettings({ femaleVoiceEnabled: !settings.femaleVoiceEnabled });
  };

  const toggleMale = () => {
    voiceCommentaryService.saveSettings({ maleVoiceEnabled: !settings.maleVoiceEnabled });
  };

  const toggleAutoSwitch = () => {
    voiceCommentaryService.saveSettings({ autoSwitching: !settings.autoSwitching });
  };

  return (
    <div className="space-y-3.5">
      {/* Top AI Commentary Broadcast Center Card */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/60 rounded-2xl p-4 border border-indigo-900/40 shadow-xl space-y-3">
        {/* Header Title with Live Pulse */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 via-amber-500 to-indigo-500 flex items-center justify-center text-slate-950 shadow-md">
              <Mic className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-sm text-white tracking-tight">AI Live Commentary Box</h3>
                <span className="px-1.5 py-0.2 rounded bg-red-600 text-[9px] font-black uppercase text-white animate-pulse">
                  ON AIR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                {settings.language === 'urdu_english' ? 'Pakistani Urdu + English' : settings.language === 'english' ? 'English Sports' : 'Urdu Broadcast'} • ~7s cadence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMaster}
              className={`p-2 rounded-xl border transition-all ${
                settings.enabled
                  ? 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={settings.enabled ? 'Mute AI Commentary' : 'Enable AI Commentary'}
            >
              {settings.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
                title="Voice Configuration Settings"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Dual Commentators Visualizer Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Female Commentator Card */}
          <div
            className={`p-2.5 rounded-xl border transition-all relative overflow-hidden ${
              isSpeaking && currentSpeaker === 'female'
                ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
                : settings.femaleVoiceEnabled
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-slate-950/30 border-slate-800/40 opacity-50'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-rose-500 to-pink-600 flex items-center justify-center text-white font-black text-xs shadow">
                    AK
                  </div>
                  {isSpeaking && currentSpeaker === 'female' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-ping" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white leading-none">Ayesha Khan</h4>
                  <span className="text-[10px] text-rose-400 font-medium">Tactical Analyst</span>
                </div>
              </div>

              <button
                onClick={toggleFemale}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold transition-all ${
                  settings.femaleVoiceEnabled
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {settings.femaleVoiceEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Match situations & stats</span>
              <button
                onClick={() => voiceCommentaryService.testFemaleVoice()}
                className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-0.5"
              >
                <Play className="w-2.5 h-2.5" /> Test
              </button>
            </div>

            {/* Speaking audio wave indicator */}
            {isSpeaking && currentSpeaker === 'female' && (
              <div className="mt-1.5 flex items-center justify-center gap-0.5 h-3">
                <span className="w-0.5 h-full bg-rose-400 rounded-full animate-bounce" />
                <span className="w-0.5 h-2 bg-rose-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-0.5 h-3 bg-rose-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-0.5 h-1.5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-0.5 h-2.5 bg-rose-400 rounded-full animate-bounce [animation-delay:0.25s]" />
              </div>
            )}
          </div>

          {/* Male Commentator Card */}
          <div
            className={`p-2.5 rounded-xl border transition-all relative overflow-hidden ${
              isSpeaking && currentSpeaker === 'male'
                ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30'
                : settings.maleVoiceEnabled
                ? 'bg-slate-950/60 border-slate-800'
                : 'bg-slate-950/30 border-slate-800/40 opacity-50'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow">
                    TM
                  </div>
                  {isSpeaking && currentSpeaker === 'male' && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-ping" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white leading-none">Tariq Mehmood</h4>
                  <span className="text-[10px] text-blue-400 font-medium">Senior Commentator</span>
                </div>
              </div>

              <button
                onClick={toggleMale}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold transition-all ${
                  settings.maleVoiceEnabled
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {settings.maleVoiceEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>Boundaries & wickets</span>
              <button
                onClick={() => voiceCommentaryService.testMaleVoice()}
                className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5"
              >
                <Play className="w-2.5 h-2.5" /> Test
              </button>
            </div>

            {/* Speaking audio wave indicator */}
            {isSpeaking && currentSpeaker === 'male' && (
              <div className="mt-1.5 flex items-center justify-center gap-0.5 h-3">
                <span className="w-0.5 h-full bg-blue-400 rounded-full animate-bounce" />
                <span className="w-0.5 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-0.5 h-3 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-0.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-0.5 h-2.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.25s]" />
              </div>
            )}
          </div>
        </div>

        {/* Quick Voice Settings Strip */}
        <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-semibold">Voice Switching:</span>
            <button
              onClick={toggleAutoSwitch}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                settings.autoSwitching
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {settings.autoSwitching ? 'AUTO (Alternating)' : 'MANUAL'}
            </button>
          </div>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
            >
              <span>More Settings</span>
              <span>→</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs: AI Commentary Stream vs Ball-by-Ball Feed */}
      <div className="flex bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs">
        <button
          onClick={() => setViewMode('ai_commentary')}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewMode === 'ai_commentary'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Dual Voice Stream</span>
          {history.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          )}
        </button>

        <button
          onClick={() => setViewMode('ball_by_ball')}
          className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
            viewMode === 'ball_by_ball'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquareText className="w-3.5 h-3.5" />
          <span>Ball-by-Ball Logs</span>
        </button>
      </div>

      {/* Content 1: AI Dual Voice Stream Log */}
      {viewMode === 'ai_commentary' && (
        <div className="space-y-2.5">
          {history.length === 0 ? (
            <div className="bg-slate-900/60 rounded-2xl p-6 text-center border border-slate-800 space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-blue-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <h4 className="text-sm font-bold text-white">Connecting to Commentary Box</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Ayesha Khan and Tariq Mehmood will discuss strategy and react to live match events every ~7 seconds.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={() => voiceCommentaryService.testFemaleVoice()}
                  className="px-3 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/40 text-xs font-bold hover:bg-rose-600/30"
                >
                  Hear Ayesha
                </button>
                <button
                  onClick={() => voiceCommentaryService.testMaleVoice()}
                  className="px-3 py-1 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/40 text-xs font-bold hover:bg-blue-600/30"
                >
                  Hear Tariq
                </button>
              </div>
            </div>
          ) : (
            history.map((entry) => (
              <div
                key={entry.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  entry.speaker === 'female'
                    ? 'bg-gradient-to-r from-rose-950/30 to-slate-900 border-rose-900/40'
                    : 'bg-gradient-to-r from-blue-950/30 to-slate-900 border-blue-900/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white ${
                        entry.speaker === 'female'
                          ? 'bg-rose-600'
                          : 'bg-blue-600'
                      }`}
                    >
                      {entry.speaker === 'female' ? 'AK' : 'TM'}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white mr-1.5">{entry.speakerName}</span>
                      <span className={`text-[10px] font-medium ${
                        entry.speaker === 'female' ? 'text-rose-400' : 'text-blue-400'
                      }`}>
                        • {entry.roleTitle}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans pl-1">
                  "{entry.text}"
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Content 2: Standard Ball-by-Ball Logs */}
      {viewMode === 'ball_by_ball' && (
        <div className="space-y-2.5">
          {recentBalls.map((ball) => (
            <div
              key={ball.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                ball.isWicket
                  ? 'bg-rose-950/30 border-rose-800/60 shadow-lg shadow-rose-950/20'
                  : ball.isSix
                  ? 'bg-purple-950/30 border-purple-800/60 shadow-lg shadow-purple-950/20'
                  : ball.isFour
                  ? 'bg-blue-950/30 border-blue-800/60 shadow-lg shadow-blue-950/20'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 font-mono font-bold text-xs border border-slate-700">
                    {ball.ballNumber}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {ball.bowlerName} to {ball.batsmanName}
                  </span>
                </div>

                {/* Event Badge */}
                {ball.isWicket ? (
                  <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-extrabold text-[10px] tracking-wider uppercase">
                    Wicket
                  </span>
                ) : ball.isSix ? (
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white font-extrabold text-[10px] tracking-wider uppercase">
                    Six
                  </span>
                ) : ball.isFour ? (
                  <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-extrabold text-[10px] tracking-wider uppercase">
                    Four
                  </span>
                ) : (
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {ball.runs} {ball.runs === 1 ? 'run' : 'runs'}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans pl-1">
                {ball.commentary}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
