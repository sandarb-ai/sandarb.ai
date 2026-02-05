'use client';

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3PieChartProps {
  data: { name: string; value: number }[];
  width?: number;
  height?: number;
  outerRadius?: number;
  /** Donut hole: set > 0 for donut; center label shows when single slice or showTotalInCenter */
  innerRadius?: number;
  colors: string[];
  labelFormat?: (name: string, percent: number) => string;
  /** When true, show total count in center (useful for single-slice / 100% approved) */
  showTotalInCenter?: boolean;
  /** Show legend below the pie (status: count) */
  showLegend?: boolean;
}

export function D3PieChart({
  data,
  width = 220,
  height = 220,
  outerRadius = 70,
  innerRadius = 0,
  colors,
  labelFormat = (name, percent) => `${name} ${(percent * 100).toFixed(0)}%`,
  showTotalInCenter = false,
  showLegend = false,
}: D3PieChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data.length || !svgRef.current) return;

    const cx = width / 2;
    const cy = height / 2 - (showLegend ? 12 : 0);
    const radius = Math.min(outerRadius, width / 2 - 10, height / 2 - 24);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const pie = d3
      .pie<{ name: string; value: number }>()
      .value((d) => d.value)
      .sort(null);
    const arc = d3
      .arc<d3.PieArcDatum<{ name: string; value: number }>>()
      .innerRadius(innerRadius)
      .outerRadius(radius);

    const arcs = pie(data);
    const colorScale = d3.scaleOrdinal<string>().domain(data.map((d) => d.name)).range(colors);
    const total = data.reduce((s, d) => s + d.value, 0);
    const singleSlice = arcs.length === 1;

    const g = svg.attr('width', width).attr('height', height).append('g').attr('transform', `translate(${cx},${cy})`);

    g.selectAll('path')
      .data(arcs)
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => colorScale(d.data.name))
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', 1.5);

    const labelArc = d3
      .arc<d3.PieArcDatum<{ name: string; value: number }>>()
      .innerRadius(radius * 0.65)
      .outerRadius(radius);

    if (!singleSlice) {
      g.selectAll('text.slice')
        .data(arcs)
        .join('text')
        .attr('class', 'slice')
        .attr('transform', (d) => {
          const pos = labelArc.centroid(d);
          return `translate(${pos[0]},${pos[1]})`;
        })
        .attr('text-anchor', 'middle')
        .attr('font-size', 11)
        .attr('fill', 'hsl(var(--foreground))')
        .text((d) => labelFormat(d.data.name, (d.endAngle - d.startAngle) / (2 * Math.PI)));
    }

    if ((singleSlice || showTotalInCenter) && total > 0) {
      const centerG = svg.append('g').attr('transform', `translate(${cx},${cy})`);
      centerG
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', singleSlice ? 14 : 12)
        .attr('font-weight', 600)
        .attr('fill', 'hsl(var(--foreground))')
        .text(singleSlice ? `${data[0].name}\n${total}` : String(total));
    }

    if (showLegend && data.length > 0) {
      const legendY = cy + radius + 16;
      const legendG = svg.append('g').attr('transform', `translate(${cx},${legendY})`);
      const items = data.map((d, i) => ({ ...d, color: colorScale(d.name) }));
      const itemWidth = 80;
      const totalLegendWidth = items.length * itemWidth;
      const startX = -totalLegendWidth / 2 + itemWidth / 2;
      items.forEach((item, i) => {
        const gItem = legendG.append('g').attr('transform', `translate(${startX + i * itemWidth},0)`);
        gItem.append('rect').attr('x', -36).attr('y', -6).attr('width', 10).attr('height', 10).attr('rx', 2).attr('fill', item.color);
        gItem
          .append('text')
          .attr('x', -22)
          .attr('y', 2)
          .attr('font-size', 10)
          .attr('fill', 'hsl(var(--muted-foreground))')
          .text(`${item.name}: ${item.value}`);
      });
    }
  }, [data, width, height, outerRadius, innerRadius, colors, labelFormat, showTotalInCenter, showLegend]);

  return <svg ref={svgRef} className="overflow-visible" />;
}
