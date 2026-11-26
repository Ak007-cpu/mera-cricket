import React, { useState, useEffect, useMemo } from 'react';
import { MatchState, BroadcastSettingsConfig, MonetizationConfig } from '../../types/cricket';
import { fetchActiveMatch, fetchMonetizationConfig, buildApiUrl } from '../../services/api';
import { useContent } from '../../context/ContentContext';
import { useAutoBallAnimation } from '../../hooks/useAutoBallAnimation';
import { useCricketAudio } from '../../hooks/useCricketAudio';
import { AutoBallAnimationOverlay } from '../Broadcast/AutoBallAnimationOverlay';
import { TargetChasePanel } from '../Broadcast/TargetChasePanel';
import { WinProbabilityBar } from '../Broadcast/WinProbabilityBar';
import { CompactRunRateGraph } from '../Broadcast/CompactRunRateGraph';
import { PlayerAvatar } from '../PlayerAvatar';
import { TeamFlag } from '../TeamFlag';
import { HoldScreenView } from '../Common/HoldScreenView';
import { TvScreenView } from '../Common/TvScreenView';

interface OBSOverlayProps {
  match?: MatchState | null;
  position?: 'bottom' | 'top';
  isDemoPreview?: boolean;
  animationsEnabled?: boolean;
  broadcastSettings?: BroadcastSettingsConfig;
}

export const OBSOverlay: React.FC<OBSOverlayProps> = ({
  match: initialMatch,
  position = 'bottom',
  isDemoPreview = false,
  animationsEnabled: animationsEnabledProp,
  broadcastSettings: broadcastSettingsProp
}) => {
  const { applyContentOverridesToMatch, mergeMonetization } = useContent();
  const hasParentMatch = initialMatch !== undefined;
  const [liveMatch, setLiveMatch] = useState<MatchState | null>(initialMatch || null);
  const [serverMonetization, setServerMonetization] = useState<MonetizationConfig | null>(null);

  useEffect(() => {
    if (hasParentMatch) {
      setLiveMatch(initialMatch || null);
    }
  }, [hasParentMatch, initialMatch]);

  // Ensure document transparency when mounted standalone
  useEffect(() => {
    if (isDemoPreview || typeof document === 'undefined') return;
    document.documentElement.classList.add('obs-transparent');
    return () => {
      document.documentElement.classList.remove('obs-transparent');
    };
  }, [isDemoPreview]);

  // Self-syncing for OBS browser source standalone loads (skipped in Admin Demo Preview)
  useEffect(() => {
    if (isDemoPreview) return;

    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchMatch = async () => {
      try {
        const res = await fetchActiveMatch();
        setLiveMatch(res.data || null);
      } catch (err) {
        console.warn('OBS fetch active match warning:', err);
      }
    };

    if (!hasParentMatch) {
      fetchMatch();
    }

    if (animationsEnabledProp === undefined || broadcastSettingsProp === undefined) {
      fetchMonetizationConfig().then((cfg) => {
        if (cfg) {
          setServerMonetization(cfg);
        }
      });
    }

    if (hasParentMatch && animationsEnabledProp !== undefined && broadcastSettingsProp !== undefined) return;

    try {
      const sseUrl = buildApiUrl('/api/match/stream');
      eventSource = new EventSource(sseUrl);

      eventSource.addEventListener('monetization', (event: MessageEvent) => {
        try {
          const parsedConfig = JSON.parse(event.data);
          if (parsedConfig) {
            setServerMonetization(parsedConfig);
          }
        } catch {}
      });

      eventSource.onmessage = (event) => {
        if (hasParentMatch) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.matchState !== undefined) {
            setLiveMatch(parsed.matchState || null);
          }
        } catch (e) {
          console.warn('OBS SSE parse error:', e);
        }
      };

      eventSource.onerror = () => {
        if (!hasParentMatch && !pollInterval) {
          pollInterval = setInterval(fetchMatch, 2500);
        }
      };
    } catch {
      if (!hasParentMatch) {
        pollInterval = setInterval(fetchMatch, 2500);
      }
    }

    return () => {
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isDemoPreview, hasParentMatch, animationsEnabledProp, broadcastSettingsProp]);

  const displayMatch = useMemo(
    () => applyContentOverridesToMatch(liveMatch),
    [liveMatch, applyContentOverridesToMatch]
  );

  const mergedMonetization = useMemo(
    () => mergeMonetization(serverMonetization),
    [mergeMonetization, serverMonetization]
  );

  const effectiveBroadcastSettings =
    broadcastSettingsProp || mergedMonetization?.broadcastSettings || null;
  const effectiveAnimationsEnabled =
    animationsEnabledProp !== undefined
      ? animationsEnabledProp
      : effectiveBroadcastSettings?.animationsEnabled ?? true;

  const obsPanels = effectiveBroadcastSettings?.obsPanels || {
    targetPanel: true,
    winProbabilityBar: true,
    runRateGraph: true
  };
  const winProbOverride = effectiveBroadcastSettings?.winProbabilityOverride || null;

  const { scoreAnimKey, activeBallEvent } = useAutoBallAnimation(
    displayMatch,
    effectiveAnimationsEnabled
  );

  const tvScreen = effectiveBroadcastSettings?.tvScreen;
  const isObsTvOverrideActive = Boolean(tvScreen?.obsEnabled && (tvScreen.enabled || !displayMatch));
  const isObsHoldOverrideActive = Boolean(
    effectiveBroadcastSettings?.holdScreen?.active && effectiveBroadcastSettings.holdScreen.obsEnabled
  );

  useCricketAudio({
    mode: 'obs',
    match: displayMatch,
    activeBallEvent,
    soundSettings: effectiveBroadcastSettings?.soundSettings,
    suppressForAdOrHold: isDemoPreview || isObsTvOverrideActive || isObsHoldOverrideActive
  });

  if (isObsTvOverrideActive) {
    return (
      <TvScreenView
        tvScreen={tvScreen}
        nextMatch={effectiveBroadcastSettings?.nextMatch}
        variant="obs"
      />
    );
  }

  if (isObsHoldOverrideActive && effectiveBroadcastSettings?.holdScreen) {
    return (
      <HoldScreenView
        holdScreen={effectiveBroadcastSettings.holdScreen}
        nextMatch={effectiveBroadcastSettings.nextMatch}
        variant="obs"
      />
    );
  }

  if (!displayMatch) {
    return <div className="w-full min-h-screen bg-transparent pointer-events-none" />;
  }

  const { battingTeam, bowlingTeam, striker, nonStriker, currentBowler, currentRunRate } = displayMatch;

  return (
    <div
      className={`w-full ${isDemoPreview ? 'min-h-[260px]' : 'min-h-screen'} bg-transparent pointer-events-none px-3 sm:px-8 pb-4 pt-3 flex flex-col ${
        position === 'bottom' ? 'justify-end' : 'justify-start'
      } select-none relative`}
    >
      {/* Auto Ball Animation Callout when positioned at bottom */}
      {position === 'bottom' && (
        <div className="mb-2.5">
          <AutoBallAnimationOverlay
            event={activeBallEvent}
            enabled={effectiveAnimationsEnabled}
            variant="obs"
          />
        </div>
      )}

      {/* Optional OBS Widgets Stack above Lower-Third Bar (Transparent outside cards) */}
      {!isDemoPreview && position === 'bottom' && (obsPanels.runRateGraph || obsPanels.targetPanel || obsPanels.winProbabilityBar) && (
        <div className="max-w-5xl mx-auto w-full space-y-2 mb-2">
          {obsPanels.runRateGraph && <CompactRunRateGraph match={displayMatch} variant="obs" />}
          {obsPanels.targetPanel && <TargetChasePanel match={displayMatch} variant="obs" />}
          {obsPanels.winProbabilityBar && (
            <WinProbabilityBar
              match={displayMatch}
              enabled={true}
              override={winProbOverride}
              variant="obs"
            />
          )}
        </div>
      )}

      {/* Slim TV Lower-Third Score Bar (Transparent outside bar, zero buttons, zero heavy blur) */}
      <div className="max-w-5xl mx-auto w-full bg-[#050c1d]/95 border border-sky-400/30 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] overflow-hidden">
        <div className="px-3.5 py-2 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
          {/* Team Flag, Score & Overs */}
          <div className="flex items-center gap-3 pr-3 lg:border-r border-slate-700/70 shrink-0">
            <TeamFlag
              teamName={battingTeam.name}
              teamCode={battingTeam.code}
              logoUrl={battingTeam.logoUrl}
              size="md"
              className="border-2 border-sky-400/70 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-sky-300">
                  {battingTeam.shortName || battingTeam.code}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  vs {bowlingTeam.shortName || bowlingTeam.code}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  key={scoreAnimKey}
                  className="text-2xl sm:text-3xl font-black text-white font-score tracking-tight leading-none animate-score-flip"
                >
                  {battingTeam.score.runs}/{battingTeam.score.wickets}
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-300 font-score">
                  {battingTeam.score.overs}.{battingTeam.score.balls} ov
                </span>
                <span className="hidden sm:inline text-[10px] font-score text-slate-400">
                  CRR {currentRunRate.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Striker */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 bg-slate-900/55 px-2.5 py-1.5 rounded-xl border border-amber-400/25">
            <PlayerAvatar
              playerId={striker.playerId}
              name={striker.name}
              teamCode={battingTeam.code}
              imageUrl={striker.imageUrl}
              size="xs"
              ringVariant="gold"
              showJerseyNumber={false}
              showStrikeBadge={false}
            />
            <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-white truncate">
                {striker.shortName || striker.name}*
              </span>
              <span className="font-score text-sm font-extrabold text-amber-300 shrink-0">
                {striker.runs}
                <span className="text-[10px] text-slate-400 font-normal ml-0.5">({striker.balls})</span>
              </span>
            </div>
          </div>

          {/* Non-Striker */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 bg-slate-900/45 px-2.5 py-1.5 rounded-xl border border-slate-700/50">
            <PlayerAvatar
              playerId={nonStriker.playerId}
              name={nonStriker.name}
              teamCode={battingTeam.code}
              imageUrl={nonStriker.imageUrl}
              size="xs"
              ringVariant="blue"
              showJerseyNumber={false}
              showStrikeBadge={false}
            />
            <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {nonStriker.shortName || nonStriker.name}
              </span>
              <span className="font-score text-sm font-bold text-slate-100 shrink-0">
                {nonStriker.runs}
                <span className="text-[10px] text-slate-400 font-normal ml-0.5">({nonStriker.balls})</span>
              </span>
            </div>
          </div>

          {/* Current Bowler */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1 bg-slate-900/55 px-2.5 py-1.5 rounded-xl border border-emerald-400/30">
            <PlayerAvatar
              playerId={currentBowler.playerId}
              name={currentBowler.name}
              teamCode={bowlingTeam.code}
              imageUrl={currentBowler.imageUrl}
              size="xs"
              ringVariant="green"
              showJerseyNumber={false}
              showStrikeBadge={false}
            />
            <div className="min-w-0 flex-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300 truncate">
                {currentBowler.shortName || currentBowler.name}
              </span>
              <span className="font-score text-sm font-extrabold text-white shrink-0">
                {currentBowler.wickets}/{currentBowler.runs}
                <span className="text-[10px] text-slate-400 font-normal ml-0.5">({currentBowler.overs})</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {!isDemoPreview && position === 'top' && (obsPanels.targetPanel || obsPanels.winProbabilityBar || obsPanels.runRateGraph) && (
        <div className="max-w-5xl mx-auto w-full space-y-2 mt-2">
          {obsPanels.targetPanel && <TargetChasePanel match={displayMatch} variant="obs" />}
          {obsPanels.winProbabilityBar && (
            <WinProbabilityBar
              match={displayMatch}
              enabled={true}
              override={winProbOverride}
              variant="obs"
            />
          )}
          {obsPanels.runRateGraph && <CompactRunRateGraph match={displayMatch} variant="obs" />}
        </div>
      )}

      {position === 'top' && (
        <div className="mt-2.5">
          <AutoBallAnimationOverlay
            event={activeBallEvent}
            enabled={effectiveAnimationsEnabled}
            variant="obs"
          />
        </div>
      )}
    </div>
  );
};
