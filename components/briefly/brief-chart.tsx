'use client';
import { useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { curveLinear } from '@visx/curve';
import { BarChart } from '@/components/bklit/brief-charts/bar-chart';
import { BarSquares } from '@/components/bklit/brief-charts/bar-squares';
import { PieCenter } from '@/components/bklit/brief-charts/pie-center';
import { Bar } from '@/components/bklit/brief-charts/bar';
import { BarXAxis } from '@/components/bklit/brief-charts/bar-x-axis';
import { LineChart } from '@/components/bklit/brief-charts/line-chart';
import { Line } from '@/components/bklit/brief-charts/line';
import { AreaChart } from '@/components/bklit/brief-charts/area-chart';
import { Area } from '@/components/bklit/brief-charts/area';
import { PieChart } from '@/components/bklit/brief-charts/pie-chart';
import { PieSlice } from '@/components/bklit/brief-charts/pie-slice';
import { useChartStable } from '@/components/bklit/brief-charts/chart-context';
import { Grid } from '@/components/bklit/brief-charts/grid';
import { XAxis } from '@/components/bklit/brief-charts/x-axis';
import { ChartTooltip } from '@/components/bklit/brief-charts/tooltip/chart-tooltip';
import type { BriefChart as Chart, BriefSource } from '@/lib/interactive-brief';
import styles from './interactive-brief.module.css';
const colors = [
  '#a77700',
  '#ffc42c',
  '#e19900',
  '#b87508',
  '#f5d487',
  '#ce9c55',
  '#79551c',
  '#956728',
  '#ffde70',
  '#d6b58a',
  '#e8ad38',
  '#ad884b',
];
function PeriodAxis() {
  const { data, xScale, xAccessor, innerHeight } = useChartStable();
  return (
    <g>
      {data
        .filter(
          (_, i) =>
            i === 0 ||
            i === data.length - 1 ||
            i === Math.floor(data.length / 2),
        )
        .map((p) => (
          <text
            key={String(p.label)}
            x={xScale(xAccessor(p))}
            y={innerHeight + 22}
            textAnchor="middle"
            fill="var(--chart-label)"
            fontSize={11}
          >
            {String(p.label)}
          </text>
        ))}
    </g>
  );
}
PeriodAxis.displayName = 'XAxis';
function YAxis() {
  const { yScale, orientation, innerHeight } = useChartStable();
  return (
    <g>
      {yScale.ticks(4).map((v) => (
        <text
          key={v}
          x={orientation === 'horizontal' ? yScale(v) : -8}
          y={orientation === 'horizontal' ? innerHeight + 18 : yScale(v)}
          textAnchor={orientation === 'horizontal' ? 'middle' : 'end'}
          dominantBaseline="middle"
          fill="var(--chart-label)"
          fontSize={10}
        >
          {Intl.NumberFormat('en', { notation: 'compact' }).format(v)}
        </text>
      ))}
    </g>
  );
}
YAxis.displayName = 'YAxis';
function BarYAxis() {
  const { barScale, bandWidth, data, barXAccessor } = useChartStable();
  if (!barScale || !bandWidth || !barXAccessor) return null;
  return (
    <g>
      {data.map((p) => {
        const label = barXAccessor(p);
        return (
          <text
            key={label}
            x={-8}
            y={(barScale(label) || 0) + bandWidth / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fill="var(--chart-line-primary)"
            fontSize={10}
          >
            {label.length > 27 ? label.slice(0, 25) + '...' : label}
            <title>{label}</title>
          </text>
        );
      })}
    </g>
  );
}
BarYAxis.displayName = 'BarYAxis';
export default function BriefChart({
  chart,
  sources,
}: {
  chart: Chart;
  sources: BriefSource[];
}) {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const data = chart.points.map((p) => ({
    ...p,
    date: new Date(
      (p.label.length === 4
        ? p.label + '-01-01'
        : p.label.length === 7
          ? p.label + '-01'
          : p.label) + 'T12:00:00',
    ),
  }));
  const duration = reduced ? 0 : 650;
  const tooltip = (
    <ChartTooltip
      showDatePill={false}
      content={({ point }) => (
        <span>
          {String(point.label)}:{' '}
          <strong>
            {Number(point.value).toLocaleString()} {chart.unit}
          </strong>
        </span>
      )}
    />
  );
  const ring = chart.type === 'pie' || chart.type === 'donut';
  const horizontal =
    chart.type === 'horizontal-bar' ||
    (chart.type === 'bar' &&
      (chart.points.length > 6 ||
        chart.points.some((p) => p.label.length > 12)));
  const useSquares = !horizontal && Math.min(...chart.points.map(p=>p.value)) > 0 && Math.min(...chart.points.map(p=>p.value))/Math.max(...chart.points.map(p=>p.value)) >= 0.2;
  const barHeight = horizontal
    ? Math.max(240, chart.points.length * 32 + 65)
    : undefined;
  return (
    <figure className={styles.figure} data-chart-type={chart.type}>
      <figcaption>
        <span className={styles.kicker}>THE NUMBERS - {chart.unit}</span>
        <h4>{chart.title}</h4>
      </figcaption>
      <div
        className={styles.plot}
        aria-hidden="true"
        style={barHeight ? { height: barHeight } : undefined}
      >
        {ring ? (
          <div className={styles.ring}>
            <PieChart
              data={chart.points.map((p, i) => ({ ...p, color: colors[i] }))}
              size={250}
              innerRadius={chart.type === 'donut' ? 76 : 0}
              hoveredIndex={hover}
              onHoverChange={setHover}
            >
              {chart.points.map((p, i) => (
                <PieSlice
                  key={p.label}
                  index={i}
                  animate={!reduced}
                  showGlow={!reduced}
                />
              ))}
              {chart.type === 'donut' && (
                <PieCenter defaultLabel="Total share" suffix="%" />
              )}
            </PieChart>
          </div>
        ) : chart.type === 'line' ? (
          <LineChart
            data={data}
            aspectRatio="auto"
            className={styles.canvas}
            animationDuration={duration}
          >
            <Grid />
            <YAxis />
            <Line
              dataKey="value"
              stroke="var(--chart-line-primary)"
              curve={curveLinear}
              animate={!reduced}
              fadeEdges={false}
              showMarkers
            />
            {chart.points.every((p) => p.label.length <= 7) ? (
              <PeriodAxis />
            ) : (
              <XAxis numTicks={3} />
            )}
            {tooltip}
          </LineChart>
        ) : chart.type === 'area' ? (
          <AreaChart
            data={data}
            aspectRatio="auto"
            className={styles.canvas}
            animationDuration={duration}
          >
            <Grid />
            <YAxis />
            <Area
              dataKey="value"
              fill="var(--chart-line-primary)"
              curve={curveLinear}
              animate={!reduced}
            />
            {chart.points.every((p) => p.label.length <= 7) ? (
              <PeriodAxis />
            ) : (
              <XAxis numTicks={3} />
            )}
            {tooltip}
          </AreaChart>
        ) : (
          <BarChart
            barWidth={useSquares ? Math.min(20,120/chart.points.length) : undefined}
            margin={
              horizontal
                ? { left: 145, right: 20, top: 20, bottom: 40 }
                : undefined
            }
            data={data}
            xDataKey="label"
            aspectRatio="auto"
            className={horizontal ? styles.horizontalCanvas : styles.canvas}
            animationDuration={duration}
            orientation={horizontal ? 'horizontal' : 'vertical'}
          >
            <Grid horizontal={!horizontal} />
            <YAxis />
            {!useSquares ? (
              <Bar
                animate={!reduced}
                dataKey="value"
                fill="var(--chart-line-primary)"
              />
            ) : (
              <BarSquares
                squareFit
                animate={!reduced}
                dataKey="value"
                fill="var(--chart-line-primary)"
                useGradient
                gradientStops={[
                  { offset: 0, color: '#d7ab38' },
                  { offset: 100, color: '#926900' },
                ]}
              />
            )}
            {horizontal ? <BarYAxis /> : <BarXAxis maxLabels={4} />} {tooltip}
          </BarChart>
        )}
      </div>
      {ring && (
        <div className={styles.legend}>
          {chart.points.map((p, i) => (
            <button
              type="button"
              key={p.label}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setHover(hover === i ? null : i)}
              aria-pressed={hover === i}
            >
              <span style={{ background: colors[i] }} />
              {p.label} <strong>{p.value}%</strong>
            </button>
          ))}
        </div>
      )}
      <details className={styles.details}>
        <summary>Explore values & sources</summary>
        <div className={styles.tableWrap}>
          <table>
            <caption>
              {chart.title} ({chart.unit})
            </caption>
            <thead>
              <tr>
                <th scope="col">Observation</th>
                <th scope="col">Value</th>
                <th scope="col">Evidence from reporting</th>
              </tr>
            </thead>
            <tbody>
              {chart.points.map((p) => (
                <tr key={p.label}>
                  <th scope="row">{p.label}</th>
                  <td>
                    {p.value.toLocaleString()} {chart.unit}
                  </td>
                  <td>
                    <q>{p.evidence}</q>{' '}
                    <a
                      href={sources.find((s) => s.id === p.sourceId)?.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read source
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className={styles.chartNote}>
        Figures from the source reporting. Research links are under Go deeper.
      </p>
    </figure>
  );
}
