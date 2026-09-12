/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG country paths need button semantics; HTML buttons cannot render geographic paths. */
'use client';

// Adapted from Bklit UI's choropleth feature layer (MIT).
// Selection paths stay mounted while hovering to preserve keyboard focus.
import { useRef, useState } from 'react';
import { countryName, sameCountry } from '@/lib/countries';
import { useChoroplethStable, useChoroplethInteraction } from './choropleth-context';

export function ChoroplethFeature({ selectedCountry, onSelect, disabled = false }: {
  selectedCountry: string; onSelect: (name: string) => void; disabled?: boolean;
}) {
  const { features, featurePaths } = useChoroplethStable();
  const { hoveredFeatureIndex, setHoveredFeatureIndex } = useChoroplethInteraction();
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const pointerStart = useRef<{x:number;y:number} | null>(null);
  const selectedIndex = features.findIndex(f=>sameCountry(String(f.properties.name || ''),selectedCountry));
  const tabIndex = focusIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
  return <g className="choropleth-features">
    {features.map((feature,index)=>{
      const name=countryName(String(feature.properties.name || ''));
      if (!featurePaths[index] || !name) return null;
      const selected=sameCountry(name,selectedCountry);
      return <path key={feature.id ?? name} d={featurePaths[index] || ''} role="button" aria-label={`Select ${name}`} aria-pressed={selected}
        aria-disabled={disabled} tabIndex={!disabled && index===tabIndex ? 0 : -1}
        fill={selected ? '#a77700' : hoveredFeatureIndex===index ? '#d7ab38' : '#eee3c5'} stroke="#b9a574" strokeWidth={selected ? 1.5 : .55} vectorEffect="non-scaling-stroke"
        style={{cursor:disabled?'default':'pointer',outline:'none'}}
        onMouseEnter={()=>setHoveredFeatureIndex(index)} onMouseLeave={()=>setHoveredFeatureIndex(null)}
        onFocus={()=>{setFocusIndex(index);setHoveredFeatureIndex(index);}} onBlur={()=>setHoveredFeatureIndex(null)}
        onPointerDown={event=>{pointerStart.current={x:event.clientX,y:event.clientY};}}
        onClick={event=>{
          const start=pointerStart.current;pointerStart.current=null;
          if (disabled || (start && Math.hypot(event.clientX-start.x,event.clientY-start.y)>6)) return;
          onSelect(name);
        }}
        onKeyDown={event=>{
          if(disabled)return;
          if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(name);}
          if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
            event.preventDefault();
            const paths=Array.from(event.currentTarget.parentElement?.querySelectorAll<SVGPathElement>('[role="button"]') || []);
            const current=paths.indexOf(event.currentTarget), direction=['ArrowLeft','ArrowUp'].includes(event.key)?-1:1;
            paths[(current+direction+paths.length)%paths.length]?.focus();
          }
        }}><title>{name}{selected?' — selected':''}</title></path>;
    })}
  </g>;
}
ChoroplethFeature.displayName='ChoroplethFeature';
