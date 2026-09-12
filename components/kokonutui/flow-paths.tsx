'use client';
// Adapted from Kokonut UI Background Paths by Dorian Baffier (MIT).
// https://kokonutui.com/docs/backgrounds/background-paths
import { motion, useReducedMotion } from 'motion/react';

function flowingPath(index: number) {
  const points = Array.from({ length: 11 }, (_, i) => {
    const progress = i / 10;
    const eased = 1 - (1 - progress) ** 2;
    const amplitude = 150 * (1 - eased * 0.3);
    return { x: 2400 - 4800 * eased, y: 800 + (-1600 + index * 25) * eased
      + Math.sin(progress * Math.PI * 3 + index * 0.2) * amplitude * 0.7
      + Math.cos(progress * Math.PI * 4 + index * 0.2) * amplitude * 0.3 };
  });
  const coordinate = (value: number) => Number(value.toFixed(3));
  return points.map((point, i) => {
    if (!i) return 'M ' + coordinate(point.x) + ' ' + coordinate(point.y);
    const prev = points[i - 1];
    return 'C ' + coordinate(prev.x + (point.x - prev.x) * 0.4) + ' ' + coordinate(prev.y) + ', ' + coordinate(prev.x + (point.x - prev.x) * 0.6) + ' ' + coordinate(point.y) + ', ' + coordinate(point.x) + ' ' + coordinate(point.y);
  }).join(' ');
}
const paths = Array.from({ length: 16 }, (_, i) => flowingPath(i));
export function FlowPaths() {
  const reduced = useReducedMotion();
  return <div className="flow-paths" aria-hidden="true"><svg viewBox="-2400 -800 4800 1600" preserveAspectRatio="xMidYMid slice" fill="none">
    {paths.map((d, i) => <motion.path key={i} d={d} stroke="currentColor" strokeWidth={2.5} initial={false}
      animate={reduced ? { y: 0 } : { y: [0, -35, 0] }} transition={{ duration: 12 + i * 0.3, repeat: Infinity, ease: 'easeInOut' }} />)}
  </svg></div>;
}
