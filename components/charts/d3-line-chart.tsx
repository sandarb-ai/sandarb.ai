'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export interface LineSeries {
  key: string;
  name: string;
  color: string;
}

interface D3LineChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  series: LineSeries[];
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  xTickFormat?: (v: string) => string;
  /** Max number of x-axis ticks (e.g. 8–10 for time series to avoid overlap) */
  xTickCount?: number;
}

const defaultMargin = { top: 5, right: 10, left: 40, bottom: 24 };

export function D3LineChart({
  data,
  xKey,
  series,
  width,
  height = 280,
  margin = defaultMargin,
  xTickFormat = (v) => String(v).slice(0, 10),
  xTickCount,
}: D3LineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const w = width ?? svgRef.current.parentElement?.getBoundingClientRect().width ?? 400;
    const innerWidth = Math.max(0, w - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .attr('width', w)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scalePoint<string>()
      .domain(data.map((d) => String(d[xKey])))
      .range([0, innerWidth])
      .padding(0.1);

    const yMax = d3.max(
      series.flatMap((s) => data.map((d) => Number((d[s.key] as number) ?? 0)))
    ) ?? 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice();

    // Grid (vertical lines only; remove domain path to avoid double axis)
    const gridG = g
      .append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale).tickSize(-innerHeight).tickFormat(() => ''));
    gridG.select('.domain').remove();
    gridG.selectAll('line').attr('stroke', 'currentColor').attr('stroke-opacity', 0.1).attr('stroke-dasharray', '3 3');

    const xAxis = d3.axisBottom(xScale).tickFormat(xTickFormat).tickSizeOuter(0);
    if (xTickCount != null && xTickCount > 0 && data.length > xTickCount) {
      const step = Math.ceil(data.length / xTickCount);
      const tickValues = data
        .map((d) => String(d[xKey]))
        .filter((_, i) => i % step === 0 || i === data.length - 1);
      xAxis.tickValues(tickValues);
    }
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('font-size', 11)
      .attr('color', 'hsl(var(--muted-foreground))');

    g.append('g')
      .call(d3.axisLeft(yScale).tickSizeOuter(0))
      .attr('font-size', 11)
      .attr('color', 'hsl(var(--muted-foreground))');

    type PathDatum = Record<string, unknown> & { _y: number; _i: number };
    series.forEach((s) => {
      const pathData: PathDatum[] = data.map((d, i) => ({
        ...d,
        _y: Number(d[s.key]) ?? 0,
        _i: i,
      }));
      const pathGenerator = d3
        .line<PathDatum>()
        .defined((d) => d._y != null && !Number.isNaN(d._y))
        .x((d) => {
          const i = d._i ?? data.findIndex((row) => String(row[xKey]) === String(d[xKey]));
          const step = data.length > 1 ? innerWidth / (data.length - 1) : 0;
          return i * step;
        })
        .y((d) => yScale(d._y));

      g.append('path')
        .datum(pathData)
        .attr('fill', 'none')
        .attr('stroke', s.color)
        .attr('stroke-width', 2)
        .attr('d', pathGenerator);
    });

    // Legend
    const legend = g
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(0,${innerHeight + margin.bottom - 4})`);
    series.forEach((s, i) => {
      const leg = legend.append('g').attr('transform', `translate(${i * 80}, 0)`);
      leg.append('line').attr('x1', 0).attr('x2', 12).attr('y1', 0).attr('y2', 0).attr('stroke', s.color).attr('stroke-width', 2);
      leg.append('text').attr('x', 16).attr('y', 4).attr('font-size', 11).attr('fill', 'currentColor').text(s.name);
    });
  }, [data, xKey, series, width, height, margin, xTickFormat, xTickCount]);

  return <svg ref={svgRef} className="overflow-visible" />;
}
