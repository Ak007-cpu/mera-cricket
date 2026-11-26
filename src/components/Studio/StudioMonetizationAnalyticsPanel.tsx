import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Eye,
  Layers,
  FlaskConical,
  Settings2,
  RefreshCw,
  Activity
} from 'lucide-react';
import { MonetizationConfig } from '../../types/cricket';
const D3AdPerformanceChart = lazy(() =>
  import('./D3AdPerformanceChart').then((m) => ({ default: m.D3AdPerformanceChart }))
);
import { fetchMonetizationConfig } from '../../services/api';
import { useContent } from '../../context/ContentContext';
import {
  buildDailyMonetizationAnalytics,
  DailyMonetizationPoint,
  ManagedSlotKey,
  normalizePublisherId
} from '../../utils/adsense';

interface StudioMonetizationAnalyticsPanelProps {
  initialMonetization: MonetizationConfig | null;
  viewerBaseline?: number;
  onOpenMonetizationSettings?: () => void;
}

const FALLBACK_MONETIZATION_CONFIG: MonetizationConfig = {
  adsEnabled: true,
  adsensePublisherId: '',
  adsenseAutoAds: true,
  adsenseTestMode: false,
  adsenseHidePlaceholders: false,
  adsTxtCustomLines: '',
  slots: {
    topBanner: { enabled: true, slotId: '', adFormat: 'auto', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' },
    inContent: { enabled: true, slotId: '', adFormat: 'auto', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' },
    footerBanner: { enabled: true, slotId: '', adFormat: 'auto', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' },
    mobileBanner: { enabled: true, slotId: '', adFormat: 'horizontal', adSource: 'auto', imageUrl: '', linkUrl: '', title: '' }
  },
  sponsor: {
    enabled: false,
    name: '',
    tagline: '',
    logoUrl: '',
    imageUrl: '',
    linkUrl: ''
  },
  siteName: 'Live Cricket HD',
  contactEmail: '',
  updatedAt: 0
};

const SLOT_FILTER_OPTIONS: Array<{ id: 'all' | ManagedSlotKey; label: string }> = [
  { id: 'all', label: 'All Slots' },
  { id: 'topBanner', label: 'Top Banner' },
  { id: 'inContent', label: 'In-Content' },
  { id: 'footerBanner', label: 'Footer' },
  { id: 'mobileBanner', label: 'Mobile App' }
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number;
    dataKey?: string;
    color?: string;
    payload?: DailyMonetizationPoint;
  }>;
  label?: string;
  testMode?: boolean;
}

const AnalyticsTooltip: React.FC<CustomTooltipProps> = ({ active, payload, testMode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-xl bg-slate-950 border border-slate-700 px-3.5 py-2.5 shadow-xl text-xs space-y-1.5">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
        <span className="font-semibold text-white">{point.dateLabel}</span>
        <span className="font-mono text-[11px] text-slate-400">{point.dateKey}</span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-emerald-300 font-medium">
          {testMode ? 'Simulated Revenue' : 'Daily Revenue'}
        </span>
        <span className="font-mono tabular-nums font-bold text-emerald-400">
          ${point.revenue.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-sky-300 font-medium">Daily Impressions</span>
        <span className="font-mono tabular-nums font-bold text-sky-300">
          {point.impressions.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6 text-[11px] pt-0.5 border-t border-slate-800/80">
        <span className="text-slate-400">Effective eCPM</span>
        <span className="font-mono tabular-nums text-slate-200">${point.ecpm.toFixed(2)}</span>
      </div>
    </div>
  );
};

export const StudioMonetizationAnalyticsPanel: React.FC<StudioMonetizationAnalyticsPanelProps> = ({
  initialMonetization,
  viewerBaseline = 0,
  onOpenMonetizationSettings
}) => {
  const { mergeMonetization } = useContent();
  const [config, setConfig] = useState<MonetizationConfig>(
    () => initialMonetization || FALLBACK_MONETIZATION_CONFIG
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<'overview' | 'ad_performance'>('overview');
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [slotFilter, setSlotFilter] = useState<'all' | ManagedSlotKey>('all');

  const refreshLatestConfig = async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const latest = await fetchMonetizationConfig();
      setConfig(mergeMonetization(latest) || latest || FALLBACK_MONETIZATION_CONFIG);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setConfig(mergeMonetization(initialMonetization) || initialMonetization || FALLBACK_MONETIZATION_CONFIG);
  }, [initialMonetization, mergeMonetization]);

  useEffect(() => {
    refreshLatestConfig(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const report = useMemo(
    () =>
      buildDailyMonetizationAnalytics(config, {
        days,
        slotFilter,
        dailyTrafficBaseline: viewerBaseline
      }),
    [config, days, slotFilter, viewerBaseline]
  );

  const testMode = Boolean(config.adsenseTestMode);
  const cleanPubId = normalizePublisherId(config.adsensePublisherId || '');
  const hasAnyTrafficDelivery = report.activeSlotCount > 0 && Boolean(config.adsEnabled);

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="h-7 w-64 rounded bg-slate-800 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="h-16 rounded-xl bg-slate-800/70 animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-slate-800/60 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section Header + Sub-Tab Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-bold text-white text-sm uppercase tracking-wider">
                  Monetization Analytics
                </h2>
                {testMode && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                    <FlaskConical className="w-3 h-3" />
                    Test Mode Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {analyticsTab === 'ad_performance'
                  ? '30-day D3 fill rate and CPM trends across your configured AdSense placements.'
                  : `Daily AdSense revenue & impression curve modeled from your configured slots${cleanPubId ? ` (${cleanPubId})` : ''} and current audience volume.`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setAnalyticsTab('overview')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  analyticsTab === 'overview'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Revenue &amp; Impressions</span>
              </button>
              <button
                type="button"
                onClick={() => setAnalyticsTab('ad_performance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  analyticsTab === 'ad_performance'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Ad Performance</span>
              </button>
            </div>

            {analyticsTab === 'overview' && (
              <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                {([7, 14, 30] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setDays(range)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                      days === range
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {range}D
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => refreshLatestConfig(true)}
              disabled={isRefreshing}
              className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync Config</span>
            </button>

            {onOpenMonetizationSettings && (
              <button
                type="button"
                onClick={onOpenMonetizationSettings}
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Manage Slots</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {analyticsTab === 'ad_performance' ? (
        <Suspense
          fallback={
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-xs text-slate-400">
              Loading D3 Ad Performance chart...
            </div>
          }
        >
          <D3AdPerformanceChart
            config={config}
            onOpenMonetizationSettings={onOpenMonetizationSettings}
          />
        </Suspense>
      ) : (
        <>
          {/* Main Revenue & Impressions Recharts Surface */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">

        {/* 4-Column Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>{testMode ? 'Simulated' : 'Est.'} {days}D Revenue</span>
            </div>
            <div className="text-xl font-bold text-emerald-400 font-mono tabular-nums mt-1">
              ${report.totalRevenue.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span>{days}D Ad Impressions</span>
            </div>
            <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">
              {report.totalImpressions.toLocaleString()}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>Blended eCPM</span>
            </div>
            <div className="text-xl font-bold text-amber-300 font-mono tabular-nums mt-1">
              ${report.blendedEcpm.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Active AdSense / Total</span>
            </div>
            <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">
              {report.adsenseSlotCount} / {report.activeSlotCount}
              <span className="text-xs font-normal text-slate-400 ml-1">configured</span>
            </div>
          </div>
        </div>

        {/* Slot Filter Segmented Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
            {SLOT_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSlotFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  slotFilter === opt.id
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            {config.adsEnabled
              ? testMode
                ? 'Mode: Test Ad Verification (data-adtest="on")'
                : 'Mode: Live Production Projection'
              : 'Mode: Master Ads Disabled'}
          </div>
        </div>

        {/* Chart Area or Empty State */}
        {!hasAnyTrafficDelivery ? (
          <div className="h-72 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 flex flex-col items-center justify-center text-center px-6 space-y-3">
            <div className="text-sm font-bold text-white">
              {!config.adsEnabled
                ? 'Master Ads Switch is Currently OFF'
                : 'No Active Ad Slots Configured Yet'}
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              {!config.adsEnabled
                ? 'Turn Master Ads ON in AdSense & Ads settings to resume daily impression and revenue tracking.'
                : 'Configure your Google AdSense Publisher ID and at least one Slot ID (or custom banner) to visualize daily revenue and impression trends.'}
            </p>
            {onOpenMonetizationSettings && (
              <button
                type="button"
                onClick={onOpenMonetizationSettings}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                Configure AdSense Slots
              </button>
            )}
          </div>
        ) : (
          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={report.series}
                margin={{ top: 10, right: 16, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                />
                <YAxis
                  yAxisId="revenue"
                  stroke="#10b981"
                  tick={{ fill: '#34d399', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val: number) => `$${val.toFixed(val >= 10 ? 0 : 2)}`}
                />
                <YAxis
                  yAxisId="impressions"
                  orientation="right"
                  stroke="#38bdf8"
                  tick={{ fill: '#38bdf8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val: number) =>
                    val >= 1000 ? `${(val / 1000).toFixed(1)}k` : `${val}`
                  }
                />
                <Tooltip content={<AnalyticsTooltip testMode={testMode} />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                />
                <Line
                  yAxisId="revenue"
                  type="monotone"
                  dataKey="revenue"
                  name={testMode ? 'Simulated Revenue ($)' : 'Daily Revenue ($)'}
                  stroke={testMode ? '#fbbf24' : '#10b981'}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: testMode ? '#fbbf24' : '#10b981' }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  yAxisId="impressions"
                  type="monotone"
                  dataKey="impressions"
                  name="Daily Impressions"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#38bdf8' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Per-Slot Contribution Breakdown Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              Configured Slot Contribution ({days}D)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any row to isolate that slot in the chart above.
            </p>
          </div>
          {slotFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSlotFilter('all')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Show All Slots
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                <th className="py-2 pr-3 font-medium">Ad Slot</th>
                <th className="py-2 px-3 font-medium">Format</th>
                <th className="py-2 px-3 font-medium text-right">Est. Fill</th>
                <th className="py-2 px-3 font-medium text-right">{days}D Impressions</th>
                <th className="py-2 px-3 font-medium text-right">Est. eCPM</th>
                <th className="py-2 px-3 font-medium text-right">{days}D Revenue</th>
                <th className="py-2 pl-3 font-medium text-right">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {report.slotBreakdown.map((row) => {
                const isActiveFilter = slotFilter === row.key;
                return (
                  <tr
                    key={row.key}
                    onClick={() =>
                      setSlotFilter((prev) => (prev === row.key ? 'all' : row.key))
                    }
                    className={`h-10 cursor-pointer transition-colors ${
                      isActiveFilter ? 'bg-sky-950/35' : 'hover:bg-slate-800/45'
                    }`}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span className="font-semibold text-white">{row.label}</span>
                      <span className="text-slate-500 mx-1.5">·</span>
                      <span className="text-[11px] text-slate-400">{row.statusText}</span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      {row.formatLabel}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-200">
                      {row.estimatedFillRate}%
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums text-sky-300">
                      {row.periodImpressions.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-300">
                      {row.ecpm > 0 ? `$${row.ecpm.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-emerald-400">
                      ${row.periodRevenue.toFixed(2)}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-400">
                      {row.revenueSharePct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
