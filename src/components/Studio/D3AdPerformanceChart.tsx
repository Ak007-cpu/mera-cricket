import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MonetizationConfig } from '../../types/cricket';
import {
  build30DayAdPerformanceData,
  buildDynamicFloorRecommendations,
  DailySlotPerformancePoint,
  ManagedSlotKey,
  PricingStrategy
} from '../../utils/adsense';
import {
  Activity,
  Check,
  Copy,
  DollarSign,
  Percent,
  SlidersHorizontal,
  TrendingUp
} from 'lucide-react';

interface D3AdPerformanceChartProps {
  config: MonetizationConfig;
  onOpenMonetizationSettings?: () => void;
}

type ChartViewMode = 'dual' | 'compare';
type CompareMetric = 'fillRate' | 'cpm';

const SLOT_FILTER_OPTIONS: Array<{ id: 'all' | ManagedSlotKey; label: string }> = [
  { id: 'all', label: 'All Active Slots' },
  { id: 'topBanner', label: 'Top Banner' },
  { id: 'inContent', label: 'In-Content' },
  { id: 'footerBanner', label: 'Footer' },
  { id: 'mobileBanner', label: 'Mobile App' }
];

const SLOT_COLORS: Record<ManagedSlotKey, { label: string; color: string }> = {
  topBanner: { label: 'Top Banner', color: '#38bdf8' },
  inContent: { label: 'In-Content', color: '#10b981' },
  footerBanner: { label: 'Footer Banner', color: '#a78bfa' },
  mobileBanner: { label: 'Mobile App', color: '#fbbf24' }
};

export const D3AdPerformanceChart: React.FC<D3AdPerformanceChartProps> = ({
  config,
  onOpenMonetizationSettings
}) => {
  const [slotFilter, setSlotFilter] = useState<'all' | ManagedSlotKey>('all');
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('dual');
  const [compareMetric, setCompareMetric] = useState<CompareMetric>('fillRate');
  const [pricingStrategy, setPricingStrategy] = useState<PricingStrategy>('balanced');
  const [stagedFloors, setStagedFloors] = useState<Partial<Record<ManagedSlotKey, number>>>({});
  const [copiedFloors, setCopiedFloors] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number>(760);
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: DailySlotPerformancePoint;
    x: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const report = useMemo(
    () => build30DayAdPerformanceData(config, slotFilter),
    [config, slotFilter]
  );

  const dynamicPricing = useMemo(
    () => buildDynamicFloorRecommendations(config, pricingStrategy, report),
    [config, pricingStrategy, report]
  );

  const focusedSlotFloor = useMemo(() => {
    if (chartViewMode !== 'dual' || slotFilter === 'all') return null;
    const match = dynamicPricing.recommendations.find((r) => r.key === slotFilter);
    return match && match.eligible && match.recommendedFloor > 0 ? match : null;
  }, [chartViewMode, slotFilter, dynamicPricing]);

  const testMode = Boolean(config.adsenseTestMode);
  const hasActiveDelivery = report.activeSlotCount > 0 && Boolean(config.adsEnabled);

  // Responsive container measurement via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setContainerWidth(next);
    };
    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, [hasActiveDelivery]);

  // Render D3 SVG chart
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !hasActiveDelivery || report.points.length === 0) return;

    const width = containerWidth;
    const height = 310;
    const margin = {
      top: 18,
      right: chartViewMode === 'dual' ? 54 : 24,
      bottom: 32,
      left: 48
    };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    const fillGrad = defs
      .append('linearGradient')
      .attr('id', 'd3FillRateAreaGrad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    fillGrad
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#38bdf8')
      .attr('stop-opacity', 0.28);
    fillGrad
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#38bdf8')
      .attr('stop-opacity', 0.02);

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const points = report.points;
    const xExtent = d3.extent(points, (d) => d.date) as [Date, Date];
    const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

    // X Axis
    const tickCount = width < 520 ? 5 : 8;
    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(tickCount)
      .tickFormat((d) => d3.timeFormat('%b %d')(d));

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);
    xAxisGroup.select('.domain').attr('stroke', '#334155');
    xAxisGroup.selectAll('line').attr('stroke', '#334155');
    xAxisGroup
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .style('font-size', '11px')
      .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

    if (chartViewMode === 'dual') {
      const yFillScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
      const maxCpm = Math.max(1.5, (d3.max(points, (d) => d.cpm) || 2) * 1.2);
      const yCpmScale = d3.scaleLinear().domain([0, maxCpm]).nice().range([innerHeight, 0]);

      // Horizontal Gridlines
      g.append('g')
        .selectAll('line')
        .data(yFillScale.ticks(5))
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yFillScale(d))
        .attr('y2', (d) => yFillScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-dasharray', '3 3');

      // Left Y Axis (Fill Rate %)
      const yLeftAxis = d3
        .axisLeft(yFillScale)
        .ticks(5)
        .tickFormat((d) => `${d}%`);
      const yLeftGroup = g.append('g').call(yLeftAxis);
      yLeftGroup.select('.domain').attr('stroke', '#334155');
      yLeftGroup.selectAll('line').remove();
      yLeftGroup
        .selectAll('text')
        .attr('fill', '#38bdf8')
        .style('font-size', '11px')
        .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      // Right Y Axis (CPM $)
      const yRightAxis = d3
        .axisRight(yCpmScale)
        .ticks(5)
        .tickFormat((d) => `$${Number(d).toFixed(2)}`);
      const yRightGroup = g
        .append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .call(yRightAxis);
      yRightGroup.select('.domain').attr('stroke', '#334155');
      yRightGroup.selectAll('line').remove();
      yRightGroup
        .selectAll('text')
        .attr('fill', testMode ? '#fbbf24' : '#34d399')
        .style('font-size', '11px')
        .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      // Area under Fill Rate
      const fillArea = d3
        .area<DailySlotPerformancePoint>()
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yFillScale(d.fillRate))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('fill', 'url(#d3FillRateAreaGrad)')
        .attr('d', fillArea);

      // Fill Rate Line
      const fillLine = d3
        .line<DailySlotPerformancePoint>()
        .x((d) => xScale(d.date))
        .y((d) => yFillScale(d.fillRate))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2.4)
        .attr('d', fillLine);

      // CPM Line
      const cpmLine = d3
        .line<DailySlotPerformancePoint>()
        .x((d) => xScale(d.date))
        .y((d) => yCpmScale(d.cpm))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', testMode ? '#fbbf24' : '#10b981')
        .attr('stroke-width', 2.4)
        .attr('d', cpmLine);

      // End markers
      g.selectAll('.fill-dot')
        .data(points)
        .join('circle')
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yFillScale(d.fillRate))
        .attr('r', 2.5)
        .attr('fill', '#38bdf8');

      g.selectAll('.cpm-dot')
        .data(points)
        .join('circle')
        .attr('cx', (d) => xScale(d.date))
        .attr('cy', (d) => yCpmScale(d.cpm))
        .attr('r', 2.5)
        .attr('fill', testMode ? '#fbbf24' : '#10b981');

      // Dynamic Pricing Floor Reference Line when focusing a single AdSense slot
      if (focusedSlotFloor) {
        const floorY = yCpmScale(focusedSlotFloor.recommendedFloor);
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', floorY)
          .attr('y2', floorY)
          .attr('stroke', '#a78bfa')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '6 4');

        g.append('text')
          .attr('x', innerWidth - 6)
          .attr('y', Math.max(12, floorY - 6))
          .attr('text-anchor', 'end')
          .attr('fill', '#c4b5fd')
          .style('font-size', '10px')
          .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
          .style('font-weight', '600')
          .text(`Rec. Floor $${focusedSlotFloor.recommendedFloor.toFixed(2)}`);
      }
    } else {
      // Compare All 4 Slots Mode
      const slotKeys: ManagedSlotKey[] = ['topBanner', 'inContent', 'footerBanner', 'mobileBanner'];
      const yScale =
        compareMetric === 'fillRate'
          ? d3.scaleLinear().domain([0, 100]).range([innerHeight, 0])
          : d3
              .scaleLinear()
              .domain([
                0,
                Math.max(
                  1.5,
                  (d3.max(points, (p) =>
                    d3.max(slotKeys, (k) => p.bySlot[k].cpm)
                  ) || 2) * 1.18
                )
              ])
              .nice()
              .range([innerHeight, 0]);

      g.append('g')
        .selectAll('line')
        .data(yScale.ticks(5))
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-dasharray', '3 3');

      const yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((d) =>
          compareMetric === 'fillRate' ? `${d}%` : `$${Number(d).toFixed(2)}`
        );
      const yGroup = g.append('g').call(yAxis);
      yGroup.select('.domain').attr('stroke', '#334155');
      yGroup.selectAll('line').remove();
      yGroup
        .selectAll('text')
        .attr('fill', '#cbd5e1')
        .style('font-size', '11px')
        .style('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace');

      slotKeys.forEach((slotKey) => {
        const lineGen = d3
          .line<DailySlotPerformancePoint>()
          .x((d) => xScale(d.date))
          .y((d) =>
            yScale(
              compareMetric === 'fillRate'
                ? d.bySlot[slotKey].fillRate
                : d.bySlot[slotKey].cpm
            )
          )
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(points)
          .attr('fill', 'none')
          .attr('stroke', SLOT_COLORS[slotKey].color)
          .attr('stroke-width', 2.2)
          .attr('stroke-opacity', 0.92)
          .attr('d', lineGen);
      });
    }

    // Hover Crosshair Layer
    const focusLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 3')
      .style('opacity', 0);

    const bisectDate = d3.bisector<DailySlotPerformancePoint, Date>((d) => d.date).left;

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove touchmove', (event: MouseEvent | TouchEvent) => {
        const [mx] = d3.pointer(event);
        const hoveredDate = xScale.invert(mx);
        const idx = bisectDate(points, hoveredDate, 1);
        const d0 = points[idx - 1];
        const d1 = points[idx];
        const chosen =
          d1 && hoveredDate.getTime() - d0.date.getTime() > d1.date.getTime() - hoveredDate.getTime()
            ? d1
            : d0;

        if (!chosen) return;
        const px = xScale(chosen.date);
        focusLine.attr('x1', px).attr('x2', px).style('opacity', 1);
        setHoveredPoint({ point: chosen, x: px + margin.left });
      })
      .on('mouseleave', () => {
        focusLine.style('opacity', 0);
        setHoveredPoint(null);
      });
  }, [containerWidth, report, chartViewMode, compareMetric, hasActiveDelivery, testMode, focusedSlotFloor]);

  const handleCopyFloorPlan = () => {
    const payload = {
      strategy: dynamicPricing.strategy,
      generatedAt: new Date().toISOString(),
      slots: dynamicPricing.recommendations
        .filter((r) => r.eligible)
        .map((r) => ({
          slot: r.key,
          slotId: config.slots[r.key]?.slotId || '',
          format: r.formatLabel,
          recommendedFloorUsd: r.recommendedFloor,
          projectedFillRatePct: r.projectedFillRate,
          estimatedNetLiftPct: r.projectedLiftPct
        }))
    };
    navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    setCopiedFloors(true);
    setTimeout(() => setCopiedFloors(false), 2000);
  };

  const handleApplyAllStaged = () => {
    const next: Partial<Record<ManagedSlotKey, number>> = {};
    dynamicPricing.recommendations.forEach((r) => {
      if (r.eligible) {
        next[r.key] = r.recommendedFloor;
      }
    });
    setStagedFloors(next);
  };

  return (
    <div className="space-y-5">
      {/* Main D3 Performance Surface */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
        {/* 4-Column 30-Day KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-sky-400" />
              <span>30D Avg Fill Rate</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-sky-300 font-mono tabular-nums">
                {report.avgFillRate30d}%
              </span>
              {report.fillRateDeltaPct !== 0 && (
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    report.fillRateDeltaPct > 0 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {report.fillRateDeltaPct > 0 ? '+' : ''}
                  {report.fillRateDeltaPct}%
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>30D Avg CPM</span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-xl font-bold font-mono tabular-nums ${
                  testMode ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                ${report.avgCpm30d.toFixed(2)}
              </span>
              {report.cpmDelta !== 0 && (
                <span
                  className={`text-[11px] font-mono tabular-nums ${
                    report.cpmDelta > 0 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {report.cpmDelta > 0 ? '+' : ''}${report.cpmDelta.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>30D Peak CPM</span>
            </div>
            <div className="text-xl font-bold text-white font-mono tabular-nums mt-1">
              ${report.peakCpm30d.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              <span>Engine</span>
            </div>
            <div className="text-sm font-bold text-slate-200 mt-1.5">
              D3 30-Day Trend ({report.activeSlotCount}/4 Slots)
            </div>
          </div>
        </div>

        {/* Chart Controls Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1 self-start">
            <button
              type="button"
              onClick={() => setChartViewMode('dual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                chartViewMode === 'dual'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fill Rate vs CPM
            </button>
            <button
              type="button"
              onClick={() => setChartViewMode('compare')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                chartViewMode === 'compare'
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Compare All 4 Slots
            </button>
          </div>

          {chartViewMode === 'dual' ? (
            <div className="inline-flex flex-wrap rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
              {SLOT_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSlotFilter(opt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    slotFilter === opt.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1 self-start">
              <button
                type="button"
                onClick={() => setCompareMetric('fillRate')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  compareMetric === 'fillRate'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Metric: Fill Rate (%)
              </button>
              <button
                type="button"
                onClick={() => setCompareMetric('cpm')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  compareMetric === 'cpm'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Metric: CPM ($)
              </button>
            </div>
          )}
        </div>

        {/* D3 SVG Canvas or Empty State */}
        {!hasActiveDelivery ? (
          <div className="h-72 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 flex flex-col items-center justify-center text-center px-6 space-y-3">
            <div className="text-sm font-bold text-white">
              {!config.adsEnabled
                ? 'Master Ads Switch is OFF'
                : 'No Configured Ad Slots for 30-Day Trend'}
            </div>
            <p className="text-xs text-slate-400 max-w-md">
              Enable ads and configure at least one AdSense Slot ID or custom banner to inspect 30-day fill rates and CPM trends.
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
          <div className="space-y-3">
            <div ref={containerRef} className="relative w-full select-none">
              <svg ref={svgRef} className="w-full h-[310px] overflow-visible" />

              {hoveredPoint && (
                <div
                  className="pointer-events-none absolute top-2 z-10 rounded-xl bg-slate-950/95 border border-slate-700 px-3 py-2 shadow-xl text-xs space-y-1 min-w-[185px]"
                  style={{
                    left:
                      hoveredPoint.x > containerWidth * 0.62
                        ? Math.max(8, hoveredPoint.x - 198)
                        : Math.min(containerWidth - 198, hoveredPoint.x + 12)
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1">
                    <span className="font-semibold text-white">
                      {hoveredPoint.point.dateLabel}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {hoveredPoint.point.dateKey}
                    </span>
                  </div>
                  {chartViewMode === 'dual' ? (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sky-300">Fill Rate</span>
                        <span className="font-mono tabular-nums font-bold text-sky-300">
                          {hoveredPoint.point.fillRate}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className={testMode ? 'text-amber-300' : 'text-emerald-300'}>
                          {testMode ? 'Sim. CPM' : 'CPM'}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-bold ${
                            testMode ? 'text-amber-300' : 'text-emerald-400'
                          }`}
                        >
                          ${hoveredPoint.point.cpm.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    (['topBanner', 'inContent', 'footerBanner', 'mobileBanner'] as ManagedSlotKey[]).map(
                      (k) => (
                        <div key={k} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: SLOT_COLORS[k].color }}
                            />
                            <span>{SLOT_COLORS[k].label}</span>
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-white">
                            {compareMetric === 'fillRate'
                              ? `${hoveredPoint.point.bySlot[k].fillRate}%`
                              : `$${hoveredPoint.point.bySlot[k].cpm.toFixed(2)}`}
                          </span>
                        </div>
                      )
                    )
                  )}
                </div>
              )}
            </div>

            {/* Clean Legend Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
              {chartViewMode === 'dual' ? (
                <div className="flex flex-wrap items-center gap-5">
                  <span className="flex items-center gap-2 text-sky-300 font-medium">
                    <span className="w-3 h-0.5 bg-sky-400 inline-block" />
                    <span>Fill Rate (%) — Left Axis</span>
                  </span>
                  <span
                    className={`flex items-center gap-2 font-medium ${
                      testMode ? 'text-amber-300' : 'text-emerald-300'
                    }`}
                  >
                    <span
                      className={`w-3 h-0.5 inline-block ${
                        testMode ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                    />
                    <span>{testMode ? 'Simulated CPM ($)' : 'CPM ($)'} — Right Axis</span>
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  {(['topBanner', 'inContent', 'footerBanner', 'mobileBanner'] as ManagedSlotKey[]).map(
                    (k) => (
                      <span key={k} className="flex items-center gap-1.5 text-slate-300">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: SLOT_COLORS[k].color }}
                        />
                        <span>{SLOT_COLORS[k].label}</span>
                      </span>
                    )
                  )}
                </div>
              )}
              <span className="text-[11px] font-mono text-slate-400">
                Hover chart for daily 30-day breakdown
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Pricing Floor Recommendations */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm uppercase tracking-wider">
                Dynamic Pricing — Recommended Floor Settings
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Uses 30-day historical CPM percentiles, 14-day auction momentum, and fill cushion to recommend optimal AdSense eCPM floor targets.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl bg-slate-950 p-1 border border-slate-800 gap-1">
              {(
                [
                  { id: 'conservative', label: 'Conservative' },
                  { id: 'balanced', label: 'Balanced' },
                  { id: 'aggressive', label: 'Aggressive' }
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPricingStrategy(opt.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    pricingStrategy === opt.id
                      ? 'bg-violet-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {dynamicPricing.eligibleCount > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleApplyAllStaged}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors whitespace-nowrap"
                >
                  Stage All Floors
                </button>
                <button
                  type="button"
                  onClick={handleCopyFloorPlan}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  {copiedFloors ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedFloors ? 'Copied JSON' : 'Copy Rules'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dynamic Pricing Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-slate-800/80 pb-3.5">
          <div>
            <div className="text-[11px] text-slate-400">Blended Recommended Floor</div>
            <div className="text-lg font-bold text-violet-300 font-mono tabular-nums mt-0.5">
              {dynamicPricing.eligibleCount > 0
                ? `$${dynamicPricing.blendedRecommendedFloor.toFixed(2)}`
                : '—'}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Est. Net Yield Lift</div>
            <div
              className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${
                dynamicPricing.estimatedNetLiftPct > 0
                  ? 'text-emerald-400'
                  : 'text-slate-400'
              }`}
            >
              {dynamicPricing.eligibleCount > 0
                ? `${dynamicPricing.estimatedNetLiftPct > 0 ? '+' : ''}${dynamicPricing.estimatedNetLiftPct}%`
                : '—'}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-slate-400">Eligible AdSense Units</div>
            <div className="text-lg font-bold text-white font-mono tabular-nums mt-0.5">
              {dynamicPricing.eligibleCount}/4
              <span className="text-xs font-normal text-slate-400 ml-1.5">
                ({pricingStrategy})
              </span>
            </div>
          </div>
        </div>

        {/* Floor Recommendations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                <th className="py-2 pr-3 font-medium">Ad Slot</th>
                <th className="py-2 px-3 font-medium text-right">30D CPM Range</th>
                <th className="py-2 px-3 font-medium text-right">14D Trend</th>
                <th className="py-2 px-3 font-medium text-right">Recommended Floor</th>
                <th className="py-2 px-3 font-medium text-right">Est. Fill / Lift</th>
                <th className="py-2 px-3 font-medium">Recommendation</th>
                <th className="py-2 pl-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {dynamicPricing.recommendations.map((rec) => {
                const isStaged =
                  rec.eligible && stagedFloors[rec.key] === rec.recommendedFloor;
                const isFocusedInChart =
                  chartViewMode === 'dual' && slotFilter === rec.key;
                return (
                  <tr
                    key={rec.key}
                    className={`transition-colors ${
                      isFocusedInChart ? 'bg-violet-950/25' : 'hover:bg-slate-800/35'
                    }`}
                  >
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setChartViewMode('dual');
                          setSlotFilter(rec.key);
                        }}
                        className="text-left group"
                      >
                        <div className="font-semibold text-white group-hover:text-violet-300 transition-colors">
                          {rec.label}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">
                          {rec.formatLabel}
                        </div>
                      </button>
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-300">
                      {rec.eligible
                        ? `$${rec.lowCpm30d.toFixed(2)} – $${rec.peakCpm30d.toFixed(2)}`
                        : '—'}
                    </td>

                    <td
                      className={`py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums font-semibold ${
                        !rec.eligible
                          ? 'text-slate-500'
                          : rec.trend14dPct >= 0
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {rec.eligible
                        ? `${rec.trend14dPct >= 0 ? '+' : ''}${rec.trend14dPct}%`
                        : '—'}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums font-bold text-violet-300">
                      {rec.eligible ? `$${rec.recommendedFloor.toFixed(2)}` : '—'}
                    </td>

                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono tabular-nums">
                      {rec.eligible ? (
                        <span className="text-slate-200">
                          {rec.projectedFillRate}%{' '}
                          <span className="text-emerald-400 font-semibold">
                            ({rec.projectedLiftPct >= 0 ? '+' : ''}
                            {rec.projectedLiftPct}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 min-w-[230px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-bold shrink-0 ${
                            rec.actionTag === 'Raise Floor'
                              ? 'text-emerald-400'
                              : rec.actionTag === 'Ease Floor'
                              ? 'text-amber-300'
                              : rec.actionTag === 'Inactive'
                              ? 'text-slate-500'
                              : 'text-violet-300'
                          }`}
                        >
                          {rec.actionTag}
                        </span>
                        <span className="text-slate-600">·</span>
                        <span className="text-[11px] text-slate-400 leading-snug">
                          {rec.rationale}
                        </span>
                      </div>
                    </td>

                    <td className="py-2.5 pl-3 whitespace-nowrap text-right">
                      {rec.eligible ? (
                        <button
                          type="button"
                          onClick={() => {
                            setStagedFloors((prev) => ({
                              ...prev,
                              [rec.key]: rec.recommendedFloor
                            }));
                            setChartViewMode('dual');
                            setSlotFilter(rec.key);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            isStaged
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
                              : 'bg-slate-950 text-violet-300 border-violet-500/40 hover:bg-violet-600 hover:text-white'
                          }`}
                        >
                          {isStaged ? 'Staged ✓' : 'Apply Floor'}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 30-Day Slot Fill & CPM Comparison Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider">
              30-Day Ad Slot Fill &amp; CPM Summary
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any slot row to focus the D3 30-day trend curve on that placement.
            </p>
          </div>
          {slotFilter !== 'all' && chartViewMode === 'dual' && (
            <button
              type="button"
              onClick={() => setSlotFilter('all')}
              className="text-xs font-semibold text-sky-400 hover:text-sky-300"
            >
              Reset to All Slots
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold text-slate-400">
                <th className="py-2 pr-3 font-medium">Ad Slot</th>
                <th className="py-2 px-3 font-medium">Format</th>
                <th className="py-2 px-3 font-medium text-right">30D Avg Fill</th>
                <th className="py-2 px-3 font-medium text-right">30D Avg CPM</th>
                <th className="py-2 px-3 font-medium text-right">30D Peak CPM</th>
                <th className="py-2 pl-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {report.slotSummaries.map((row) => {
                const isSelected = chartViewMode === 'dual' && slotFilter === row.key;
                return (
                  <tr
                    key={row.key}
                    onClick={() => {
                      setChartViewMode('dual');
                      setSlotFilter((prev) => (prev === row.key ? 'all' : row.key));
                    }}
                    className={`h-10 cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-950/35' : 'hover:bg-slate-800/45'
                    }`}
                  >
                    <td className="py-2 pr-3 whitespace-nowrap font-semibold text-white">
                      {row.label}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                      {row.formatLabel}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden hidden sm:block">
                          <div
                            className="h-full rounded-full bg-sky-400"
                            style={{ width: `${row.avgFillRate}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums font-semibold text-sky-300">
                          {row.avgFillRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums font-semibold text-emerald-400">
                      {row.avgCpm > 0 ? `$${row.avgCpm.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono tabular-nums text-slate-200">
                      {row.peakCpm > 0 ? `$${row.peakCpm.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap text-right text-slate-400">
                      {row.statusText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
