'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3BarChartProps {
  data: { name: string; value: number }[];
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  /** vertical = x categories, y values; horizontal = y categories, x values */
  layout?: 'vertical' | 'horizontal';
  fill?: string;
  /** Color per bar (overrides fill). Length can match data or use scale. */
  colors?: string[];
  xTickFormat?: (v: string) => string;
  /** Max number of x-axis ticks (e.g. 8–10 for time series to avoid overlap) */
  xTickCount?: number;
  /** Show value at end of bar (horizontal) or top (vertical) */
  showValueLabels?: boolean;
  /** Sort bars by value descending for clearer comparison */
  sortByValue?: boolean;
}

const defaultMarginVertical = { top: 5, right: 10, left: 40, bottom: 24 };
const defaultMarginHorizontal = { top: 5, right: 52, left: 88, bottom: 24 };

export function D3BarChart({
  data: rawData,
  width,
  height = 280,
  margin,
  layout = 'vertical',
  fill = 'hsl(var(--primary))',
  colors: colorsProp,
  xTickFormat = (v) => String(v).slice(0, 12),
  xTickCount,
  showValueLabels = false,
  sortByValue = false,
}: D3BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const defaultMargin = layout === 'horizontal' ? defaultMarginHorizontal : defaultMarginVertical;
  const margins = margin ?? defaultMargin;

  const data = sortByValue
    ? [...rawData].sort((a, b) => b.value - a.value)
    : rawData;

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const w = width ?? svgRef.current.parentElement?.getBoundingClientRect().width ?? 400;
    const innerWidth = Math.max(0, w - margins.left - margins.right);
    const innerHeight = Math.max(0, height - margins.top - margins.bottom);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .attr('width', w)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margins.left},${margins.top})`);

    const getFill = (d: { name: string; value: number }, i: number) => {
      if (colorsProp && colorsProp.length) {
        return colorsProp[i % colorsProp.length];
      }
      return fill;
    };

    if (layout === 'vertical') {
      const xScale = d3
        .scaleBand()
        .domain(data.map((d) => d.name))
        .range([0, innerWidth])
        .padding(0.2);
      const yMax = d3.max(data, (d) => d.value) ?? 1;
      const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice();

      const xAxis = d3.axisBottom(xScale).tickFormat(xTickFormat).tickSizeOuter(0);
      if (xTickCount != null && xTickCount > 0 && data.length > xTickCount) {
        const step = Math.ceil(data.length / xTickCount);
        const tickValues = data.map((d) => d.name).filter((_, i) => i % step === 0 || i === data.length - 1);
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

      g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('x', (d) => xScale(d.name) ?? 0)
        .attr('y', (d) => yScale(d.value))
        .attr('width', xScale.bandwidth())
        .attr('height', (d) => innerHeight - yScale(d.value))
        .attr('fill', (d, i) => getFill(d, i))
        .attr('rx', 4)
        .attr('ry', 4);

      if (showValueLabels) {
        g.selectAll('.bar-value')
          .data(data)
          .join('text')
          .attr('class', 'bar-value')
          .attr('x', (d) => (xScale(d.name) ?? 0) + xScale.bandwidth() / 2)
          .attr('y', (d) => yScale(d.value) - 4)
          .attr('text-anchor', 'middle')
          .attr('font-size', 10)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .text((d) => d.value);
      }
    } else {
      const yScale = d3
        .scaleBand()
        .domain(data.map((d) => d.name))
        .range([0, innerHeight])
        .padding(0.2);
      const xMax = d3.max(data, (d) => d.value) ?? 1;
      const xScale = d3.scaleLinear().domain([0, xMax]).range([0, innerWidth]).nice();

      g.append('g')
        .call(d3.axisLeft(yScale).tickSizeOuter(0))
        .attr('font-size', 11)
        .attr('color', 'hsl(var(--muted-foreground))');

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale).tickSizeOuter(0).ticks(6))
        .attr('font-size', 11)
        .attr('color', 'hsl(var(--muted-foreground))');

      g.selectAll('rect')
        .data(data)
        .join('rect')
        .attr('y', (d) => yScale(d.name) ?? 0)
        .attr('x', 0)
        .attr('width', (d) => xScale(d.value))
        .attr('height', yScale.bandwidth())
        .attr('fill', (d, i) => getFill(d, i))
        .attr('rx', 4)
        .attr('ry', 4);

      if (showValueLabels) {
        g.selectAll('.bar-value')
          .data(data)
          .join('text')
          .attr('class', 'bar-value')
          .attr('x', (d) => xScale(d.value) + 6)
          .attr('y', (d) => (yScale(d.name) ?? 0) + yScale.bandwidth() / 2)
          .attr('dominant-baseline', 'middle')
          .attr('font-size', 11)
          .attr('fill', 'hsl(var(--foreground))')
          .attr('font-weight', 500)
          .text((d) => d.value);
      }
    }
  }, [data, width, height, margins, layout, fill, colorsProp, xTickFormat, xTickCount, showValueLabels, sortByValue]);

  return <svg ref={svgRef} className="overflow-visible" />;
}
