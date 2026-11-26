import React, { useMemo } from 'react';
import { MonetizationConfig } from '../../types/cricket';
import { estimateAdSlotsPerformance, ManagedSlotKey } from '../../utils/adsense';
import { BarChart3 } from 'lucide-react';

interface AdSenseSlotStatsPanelProps {
  config: MonetizationConfig;
  selectedSlot?: ManagedSlotKey | null;
  onSelectSlot?: (slotKey: ManagedSlotKey) => void;
}

export const AdSenseSlotStatsPanel: React.FC<AdSenseSlotStatsPanelProps> = ({
  config,
  selectedSlot = null,
  onSelectSlot
}) => {
  const stats = useMemo(() => estimateAdSlotsPerformance(config), [config]);
  const testMode = Boolean(config.adsenseTestMode);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
      {/* Header + 4-column flat metric strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              Slot Fill Rate &amp; Performance Estimates
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Calculated from your live Monetization Config (AdSense unit setup, ad formats, fallback banners, and placement fold).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 lg:gap-6 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-800/80">
          <div>
            <div className="text-[11px] text-slate-400">Active Slots</div>
            <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
              {stats.configuredCount}/4
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Active Avg Fill</div>
            <div
              className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                stats.activeAvgFillRate >= 90
                  ? 'text-emerald-400'
                  : stats.activeAvgFillRate > 0
                  ? 'text-amber-300'
                  : 'text-slate-400'
              }`}
            >
              {stats.activeAvgFillRate}%
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Site Coverage</div>
            <div className="text-base font-bold text-sky-300 font-mono tabular-nums mt-0.5">
              {stats.averageFillRate}%
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Delivery Mode</div>
            <div
              className={`text-sm font-bold mt-0.5 ${
                stats.readinessLabel === 'Production Ready'
                  ? 'text-emerald-400'
                  : stats.readinessLabel === 'Test Mode' || stats.readinessLabel === 'Direct Banners Only'
                  ? 'text-amber-300'
                  : 'text-slate-400'
              }`}
            >
              {stats.readinessLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Performance Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
              <th className="py-2 pr-3 font-medium">Slot &amp; Placement</th>
              <th className="py-2 px-3 font-medium">Format / Source</th>
              <th className="py-2 px-3 font-medium text-right">Est. Fill Rate</th>
              <th className="py-2 px-3 font-medium text-right">Est. Viewability</th>
              <th className="py-2 pl-3 font-medium text-right">Config Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-xs">
            {stats.rows.map((row) => {
              const isSelected = selectedSlot === row.key;
              const fillBarColor = !row.isConfigured
                ? 'bg-slate-700'
                : row.mode === 'adsense' && testMode
                ? 'bg-amber-400'
                : row.mode === 'custom_image' || row.mode === 'custom_promo'
                ? 'bg-sky-400'
                : 'bg-emerald-500';

              const statusColor = !row.isConfigured
                ? row.mode === 'placeholder'
                  ? 'text-amber-300'
                  : 'text-slate-500'
                : row.mode === 'adsense' && testMode
                ? 'text-amber-300'
                : row.mode === 'adsense'
                ? 'text-emerald-400'
                : 'text-sky-300';

              return (
                <tr
                  key={row.key}
                  onClick={() => onSelectSlot?.(row.key)}
                  className={`h-10 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-950/35'
                      : 'hover:bg-slate-800/45'
                  }`}
                >
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{row.label}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-[11px] text-slate-400">{row.placementZone}</span>
                    </div>
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="font-mono text-[11px] text-slate-300">
                      {row.formatLabel}
                    </span>
                    {row.usesTopFallback && (
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        (Inherits Top)
                      </span>
                    )}
                    {row.mode === 'adsense' && row.hasCustomFallback && (
                      <span className="text-[11px] text-slate-400 ml-1.5">
                        + Fallback
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2.5">
                      <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                        <div
                          className={`h-full rounded-full transition-all ${fillBarColor}`}
                          style={{ width: `${row.estimatedFillRate}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-white w-10 text-right">
                        {row.estimatedFillRate}%
                      </span>
                    </div>
                  </td>

                  <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-300">
                    {row.estViewability > 0 ? `${row.estViewability}%` : '—'}
                  </td>

                  <td className={`py-2 pl-3 whitespace-nowrap text-right font-semibold ${statusColor}`}>
                    {row.statusText}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stats.configuredCount === 0 && (
        <div className="text-xs text-slate-400 border-t border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-2">
          <span>
            No active ad units configured yet. Enter a Publisher ID and Slot ID (or upload a custom banner) below to unlock live fill estimates.
          </span>
          <button
            type="button"
            onClick={() => onSelectSlot?.('topBanner')}
            className="text-sky-400 hover:text-sky-300 font-semibold whitespace-nowrap"
          >
            Configure Top Banner
          </button>
        </div>
      )}
    </div>
  );
};
