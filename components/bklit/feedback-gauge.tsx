'use client';
// Arc notch geometry adapted from Bklit UI Gauge (MIT).
// https://bklit.com/docs/components/gauge-chart
import { motion, useReducedMotion } from 'motion/react';
export function FeedbackGauge({ count }: { count: number }) {
  const reduced = useReducedMotion();
  const totalNotches = 40;
  const activeNotches = Math.round(Math.min(200, Math.max(0, count)) / 200 * totalNotches);
  const notchAngle = 270 * 0.75 / totalNotches;
  const gapAngle = 270 * 0.25 / (totalNotches - 1);
  return <figure className="feedback-gauge" aria-label={count + ' of 200 feedback history slots used'}>
    <svg viewBox="0 0 200 190" aria-hidden="true">
      {Array.from({ length: totalNotches }, (_, i) => {
        const radians = (135 + i * (notchAngle + gapAngle) + notchAngle / 2) * Math.PI / 180;
        const half = notchAngle * 0.8 * Math.PI / 180 / 2;
        const points = [[radians - half, 84], [radians + half, 84], [radians + half, 68], [radians - half, 68]].map(([angle, radius]) => (100 + Math.cos(angle) * radius).toFixed(3) + ',' + (100 + Math.sin(angle) * radius).toFixed(3)).join(' ');
        return <motion.polygon key={i} points={points} fill="currentColor" initial={false} animate={{ opacity: i < activeNotches ? 1 : 0.2 }} transition={{ duration: reduced ? 0 : 0.4 }} />;
      })}
    </svg>
    <figcaption><strong>{count}</strong><span>STORIES RATED</span></figcaption>
  </figure>;
}
