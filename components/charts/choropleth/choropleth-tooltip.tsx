'use client';
import { countryName } from '@/lib/countries';
import { useChoroplethInteraction, useChoroplethStable } from './choropleth-context';
export function ChoroplethTooltip() {
  const {hoveredFeatureIndex}=useChoroplethInteraction();
  const {features}=useChoroplethStable();
  const name=hoveredFeatureIndex===null ? '' : countryName(String(features[hoveredFeatureIndex]?.properties.name || ''));
  return <g aria-hidden="true" style={{pointerEvents:'none'}}>{name && <text x={16} y={24} fill="#fff9df" fontSize={13} fontWeight={600}>{name}</text>}</g>;
}
ChoroplethTooltip.displayName='ChoroplethTooltip';
