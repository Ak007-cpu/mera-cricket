import React, { useState } from 'react';
import { AdSlotConfig, MonetizationConfig } from '../../types/cricket';
import { getEffectiveSlotMode, normalizePublisherId } from '../../utils/adsense';
import {
  Monitor,
  Smartphone,
  Columns2,
  EyeOff,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  LayoutTemplate,
  FlaskConical
} from 'lucide-react';

export type PreviewSlotKey = 'topBanner' | 'inContent' | 'footerBanner' | 'mobileBanner';

interface AdSensePlacementPreviewProps {
  config: MonetizationConfig;
  selectedSlot?: PreviewSlotKey | null;
  onSelectSlot?: (slotKey: PreviewSlotKey) => void;
  onToggleTestMode?: () => void;
}

type ViewportMode = 'both' | 'desktop' | 'mobile';

const FORMAT_PREVIEW_HEIGHT: Record<string, string> = {
  auto: 'min-h-[56px]',
  horizontal: 'h-12',
  rectangle: 'h-24 max-w-[260px] mx-auto',
  vertical: 'h-28 max-w-[160px] mx-auto'
};

interface DummyAdBoxProps {
  slotKey: PreviewSlotKey;
  label: string;
  slot?: AdSlotConfig;
  publisherId: string;
  adsEnabled: boolean;
  testMode: boolean;
  hidePlaceholders: boolean;
  compact?: boolean;
  isFallbackFromTop?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const DummyAdContainer: React.FC<DummyAdBoxProps> = ({
  label,
  slot,
  publisherId,
  adsEnabled,
  testMode,
  hidePlaceholders,
  compact = false,
  isFallbackFromTop = false,
  isSelected = false,
  onSelect
}) => {
  const mode = getEffectiveSlotMode(slot, publisherId, adsEnabled);
  const format = slot?.adFormat || (compact ? 'horizontal' : 'auto');
  const heightClass = compact ? 'h-12' : FORMAT_PREVIEW_HEIGHT[format] || 'min-h-[56px]';
  const selectionRing = isSelected
    ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-950'
    : 'hover:border-sky-500/70';

  if (mode === 'disabled') {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border border-dashed border-slate-800 bg-slate-900/40 px-3 py-1.5 flex items-center justify-between text-left transition-all ${selectionRing}`}
      >
        <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
          <EyeOff className="w-3 h-3 text-slate-600" />
          <span>{label}</span>
        </span>
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          {!adsEnabled ? 'Master Ads OFF' : 'Slot Disabled'}
        </span>
      </button>
    );
  }

  if (mode === 'custom_image' && slot?.imageUrl?.trim()) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg overflow-hidden border border-amber-500/50 bg-slate-900 relative text-left transition-all ${
          compact ? 'h-12' : 'h-14'
        } ${selectionRing}`}
      >
        <img
          src={slot.imageUrl}
          alt={slot.title || label}
          className="w-full h-full object-cover opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/35 to-transparent px-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase shrink-0">
              AD
            </span>
            <span className="text-[11px] font-bold text-white truncate">
              {slot.title || label}
            </span>
          </div>
          <span className="text-[9px] font-mono text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-amber-500/30 shrink-0">
            Custom Banner
          </span>
        </div>
      </button>
    );
  }

  if (mode === 'custom_promo' && slot?.title?.trim()) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border border-amber-500/50 bg-slate-900 px-3 py-2 flex items-center justify-between gap-2 text-left transition-all ${selectionRing}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold uppercase shrink-0">
            AD
          </span>
          <span className="text-[11px] font-bold text-white truncate">{slot.title}</span>
        </div>
        <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1 shrink-0">
          <span>Promo</span>
          <ExternalLink className="w-3 h-3" />
        </span>
      </button>
    );
  }

  if (mode === 'adsense') {
    if (testMode) {
      return (
        <button
          type="button"
          onClick={onSelect}
          className={`w-full rounded-lg border-2 border-dashed border-amber-400/80 bg-amber-950/35 overflow-hidden text-left transition-all ${selectionRing}`}
        >
          <div className="px-2.5 py-1 bg-amber-950/85 border-b border-amber-500/40 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono font-bold text-amber-200 flex items-center gap-1.5">
              <FlaskConical className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                Test Ad
              </span>
              <span className="text-amber-200/90">data-adtest=&quot;on&quot;</span>
            </span>
            <span className="text-[9px] font-mono text-amber-200/90 tabular-nums shrink-0">
              {isFallbackFromTop ? 'Uses Top Slot · ' : ''}
              {format.toUpperCase()}
            </span>
          </div>

          <div
            className={`${heightClass} w-full px-3 py-2 flex flex-col items-center justify-center gap-0.5 bg-amber-500/10`}
          >
            <div className="text-[11px] font-bold text-amber-100 flex items-center gap-1.5">
              <span>Test Ad Placeholder — {label}</span>
            </div>
            <div className="text-[10px] font-mono text-amber-200/80 tabular-nums truncate max-w-full">
              {publisherId} · slot {slot?.slotId}
            </div>
          </div>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border border-emerald-500/50 bg-emerald-950/20 overflow-hidden text-left transition-all ${selectionRing}`}
      >
        <div className="px-2.5 py-0.5 bg-emerald-950/60 border-b border-emerald-500/25 flex items-center justify-between gap-2">
          <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Live Production Ad</span>
          </span>
          <span className="text-[9px] font-mono text-emerald-200/90 tabular-nums">
            {isFallbackFromTop ? 'Uses Top Slot · ' : ''}
            {format.toUpperCase()}
          </span>
        </div>

        <div
          className={`${heightClass} w-full px-3 py-2 flex flex-col items-center justify-center gap-0.5 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_70%)]`}
        >
          <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
            <span>Google AdSense Live Container</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 text-[9px] font-mono uppercase">
              {label}
            </span>
          </div>
          <div className="text-[10px] font-mono text-slate-300 tabular-nums truncate max-w-full">
            {publisherId} · slot {slot?.slotId}
          </div>
        </div>
      </button>
    );
  }

  // Unconfigured / Placeholder
  if (hidePlaceholders) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border border-dashed border-slate-800 bg-slate-900/30 px-3 py-1 flex items-center justify-between text-left transition-all ${selectionRing}`}
      >
        <span className="text-[10px] font-mono text-slate-500">{label}</span>
        <span className="text-[10px] font-mono text-slate-500">
          Collapsed (Placeholder Hidden)
        </span>
      </button>
    );
  }

  if (testMode) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={`w-full rounded-lg border-2 border-dashed border-amber-400/65 bg-amber-950/30 px-3 py-2 flex items-center justify-between gap-2 text-left transition-all ${selectionRing}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-mono font-black uppercase shrink-0">
            Test Ad
          </span>
          <span className="text-[11px] font-semibold text-amber-100 truncate">
            Test Placeholder ({label})
          </span>
        </div>
        <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1 shrink-0">
          <AlertCircle className="w-3 h-3" />
          <span>Add Slot ID</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border border-dashed border-slate-600 bg-slate-900/70 px-3 py-2 flex items-center justify-between gap-2 text-left transition-all ${selectionRing}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-mono font-bold uppercase shrink-0">
          AD
        </span>
        <span className="text-[11px] font-semibold text-slate-300 truncate">
          Ad Space ({label})
        </span>
      </div>
      <span className="text-[10px] font-mono text-amber-300 flex items-center gap-1 shrink-0">
        <AlertCircle className="w-3 h-3" />
        <span>No Slot ID</span>
      </span>
    </button>
  );
};

export const AdSensePlacementPreview: React.FC<AdSensePlacementPreviewProps> = ({
  config,
  selectedSlot = null,
  onSelectSlot,
  onToggleTestMode
}) => {
  const [viewportMode, setViewportMode] = useState<ViewportMode>('both');

  const cleanPubId = normalizePublisherId(config.adsensePublisherId || '');
  const masterAdsEnabled = Boolean(config.adsEnabled);
  const mobileFeatureEnabled =
    masterAdsEnabled && (config.broadcastSettings?.mobileApp?.adsEnabled !== false);
  const testMode = Boolean(config.adsenseTestMode);
  const hidePlaceholders = Boolean(config.adsenseHidePlaceholders);

  // Mirror AndroidAppView mobileAdSlotConfig fallback logic
  const mob = config.slots?.mobileBanner;
  const top = config.slots?.topBanner;
  const mobileHasOwnConfig = Boolean(
    mob && (mob.imageUrl?.trim() || mob.slotId?.trim() || (mob.title?.trim() && mob.linkUrl?.trim()))
  );
  const effectiveMobileSlot = mobileHasOwnConfig
    ? mob
    : mob?.enabled === false
    ? mob
    : top || mob;
  const isMobileFallbackFromTop = Boolean(!mobileHasOwnConfig && mob?.enabled !== false && top?.slotId?.trim());

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Header & Viewport Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              Live Placement Visual Preview (Dummy Ad Containers)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Website aur Mobile App par AdSense slots kahan aur kaise dikhenge — kisi bhi dummy ad par click karke uski settings par jump karein.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          {onToggleTestMode ? (
            <button
              type="button"
              role="switch"
              aria-checked={testMode}
              onClick={onToggleTestMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                testMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-amber-400/50 hover:text-amber-200'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>{testMode ? 'Test Mode: ON' : 'Test Mode: OFF'}</span>
            </button>
          ) : (
            <span
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap ${
                testMode
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/45'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/35'
              }`}
            >
              {testMode ? (
                <>
                  <FlaskConical className="w-3.5 h-3.5" />
                  <span>Test Ad Mode</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Production Mode</span>
                </>
              )}
            </span>
          )}

          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            {(
              [
                { id: 'both', label: 'Both', icon: Columns2 },
                { id: 'desktop', label: 'Website', icon: Monitor },
                { id: 'mobile', label: 'Mobile App', icon: Smartphone }
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const active = viewportMode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewportMode(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    active ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview Canvas */}
      <div
        className={`grid gap-4 items-start ${
          viewportMode === 'both' ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        {/* Desktop Broadcast Wireframe */}
        {(viewportMode === 'both' || viewportMode === 'desktop') && (
          <div
            className={`${
              viewportMode === 'both' ? 'xl:col-span-8' : 'w-full'
            } bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-2 border-b border-slate-800/80">
              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Monitor className="w-3.5 h-3.5 text-sky-400" />
                <span>Website Broadcast Layout Preview</span>
              </span>
              <span className="tabular-nums">
                {config.siteName || 'Live Cricket HD'} · 3 Web Slots
              </span>
            </div>

            {/* Wireframe Header */}
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[11px] font-bold text-slate-200">
                  {config.siteName || 'Live Cricket HD'}
                </span>
                <span className="text-[10px] font-mono text-slate-500">LIVE SCOREBOARD</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-4 w-12 rounded bg-slate-800" />
                <span className="h-4 w-14 rounded bg-emerald-500/20 border border-emerald-500/30" />
              </div>
            </div>

            {/* Slot 1: Top Banner */}
            <DummyAdContainer
              slotKey="topBanner"
              label="1. Top Banner"
              slot={config.slots.topBanner}
              publisherId={cleanPubId}
              adsEnabled={masterAdsEnabled}
              testMode={testMode}
              hidePlaceholders={hidePlaceholders}
              isSelected={selectedSlot === 'topBanner'}
              onSelect={() => onSelectSlot?.('topBanner')}
            />

            {/* Wireframe Match Score + Players + TV Stage */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-7 rounded-lg bg-slate-900/90 border border-slate-800/90 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-sky-300">IND 186/3 (17.4 ov)</span>
                  <span className="text-[10px] font-mono text-slate-500">CRR 10.52</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="h-7 rounded bg-slate-800/70 border border-slate-800 px-2 flex items-center text-[10px] text-slate-400">
                    Striker Scorecard
                  </div>
                  <div className="h-7 rounded bg-slate-800/70 border border-slate-800 px-2 flex items-center text-[10px] text-slate-400">
                    Bowler Figures
                  </div>
                </div>
              </div>
              <div className="col-span-12 sm:col-span-5 rounded-lg bg-slate-900/90 border border-slate-800/90 p-2.5 flex items-center justify-center text-[10px] font-mono text-slate-500">
                Live Pitch / Broadcast TV Stage
              </div>
            </div>

            {/* Slot 2: In-Content Ad */}
            <DummyAdContainer
              slotKey="inContent"
              label="2. In-Content Ad"
              slot={config.slots.inContent}
              publisherId={cleanPubId}
              adsEnabled={masterAdsEnabled}
              testMode={testMode}
              hidePlaceholders={hidePlaceholders}
              isSelected={selectedSlot === 'inContent'}
              onSelect={() => onSelectSlot?.('inContent')}
            />

            {/* Wireframe Win Prob + Fan Poll + Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="h-10 rounded-lg bg-slate-900/80 border border-slate-800/90 px-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Win Probability &amp; Fan Poll</span>
                <span>Analytics</span>
              </div>
              <div className="h-10 rounded-lg bg-slate-900/80 border border-slate-800/90 px-2.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Highlights &amp; Player Stats</span>
                <span>Table</span>
              </div>
            </div>

            {/* Slot 3: Footer Banner */}
            <DummyAdContainer
              slotKey="footerBanner"
              label="3. Footer Banner"
              slot={config.slots.footerBanner}
              publisherId={cleanPubId}
              adsEnabled={masterAdsEnabled}
              testMode={testMode}
              hidePlaceholders={hidePlaceholders}
              isSelected={selectedSlot === 'footerBanner'}
              onSelect={() => onSelectSlot?.('footerBanner')}
            />

            {/* Wireframe Bottom Ticker */}
            <div className="rounded-lg bg-slate-900 border border-slate-800 px-3 py-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>Live Match &amp; Breaking News Ticker</span>
              <span>Privacy · Terms · Contact</span>
            </div>
          </div>
        )}

        {/* Mobile App (?view=android) Wireframe */}
        {(viewportMode === 'both' || viewportMode === 'mobile') && (
          <div
            className={`${
              viewportMode === 'both' ? 'xl:col-span-4' : 'max-w-sm mx-auto w-full'
            } bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5`}
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-2 border-b border-slate-800/80">
              <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mobile App (?view=android)</span>
              </span>
              <span
                className={`text-[10px] font-bold ${
                  mobileFeatureEnabled ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {mobileFeatureEnabled ? 'Mobile Ads ON' : 'Mobile Ads OFF'}
              </span>
            </div>

            <div className="max-w-[300px] mx-auto rounded-2xl border-2 border-slate-800 bg-slate-950 p-2.5 space-y-2">
              {/* Mobile Top Bar */}
              <div className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white truncate">
                  {config.broadcastSettings?.mobileApp?.brandBadge?.trim() ||
                    config.siteName ||
                    'LIVE CRICKET TV'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-rose-600/20 text-rose-300 text-[9px] font-mono">
                  LIVE
                </span>
              </div>

              {/* Breaking Ticker */}
              <div className="rounded-md bg-slate-900/70 border border-slate-800/80 px-2 py-1 text-[9px] font-mono text-slate-500">
                Breaking News / Notice Ticker
              </div>

              {/* Hero Score + Players */}
              <div className="rounded-lg bg-slate-900/90 border border-slate-800 p-2.5 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-black text-white tabular-nums">IND 186/3</span>
                  <span className="text-[10px] font-mono text-sky-300">17.4 ov</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[9px] text-slate-400">
                  <div className="rounded bg-slate-800/70 px-1.5 py-1">Striker / Non-Striker</div>
                  <div className="rounded bg-slate-800/70 px-1.5 py-1">Current Over Balls</div>
                </div>
                <div className="h-6 rounded bg-slate-800/50 border border-slate-800 flex items-center justify-center text-[9px] font-mono text-slate-500">
                  Poll · Scorecard · News · Blog
                </div>
              </div>

              {/* Slot 4: Mobile App Ad */}
              <DummyAdContainer
                slotKey="mobileBanner"
                label="4. Mobile App Ad"
                slot={effectiveMobileSlot}
                publisherId={cleanPubId}
                adsEnabled={mobileFeatureEnabled}
                testMode={testMode}
                hidePlaceholders={hidePlaceholders}
                compact
                isFallbackFromTop={isMobileFallbackFromTop}
                isSelected={selectedSlot === 'mobileBanner'}
                onSelect={() => onSelectSlot?.('mobileBanner')}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
