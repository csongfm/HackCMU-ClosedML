'use client';

// Location-picker adaptation of @bklit/stat-card-choropleth-01 (MIT).
import { useEffect, useState } from 'react';
import { Minus, Plus, RotateCcw, MapPin } from 'lucide-react';
import type { FeatureCollection, Geometry } from 'geojson';
import { ChoroplethChart } from '@/components/charts/choropleth/choropleth-chart';
import { ChoroplethFeature } from '@/components/charts/choropleth/choropleth-feature';
import { ChoroplethTooltip } from '@/components/charts/choropleth/choropleth-tooltip';
import { useChoroplethZoom, type ChoroplethFeatureProperties } from '@/components/charts/choropleth/choropleth-context';
import { countryName, sameCountry } from '@/lib/countries';
import styles from './location-map.module.css';

type WorldData=FeatureCollection<Geometry,ChoroplethFeatureProperties>;
let cachedWorld:WorldData | null=null;
function MapControls({disabled}:{disabled:boolean}) {
  const {zoom}=useChoroplethZoom();
  return <div className={styles.controls} aria-label="Map controls">
    <button type="button" disabled={disabled || !zoom || zoom.transformMatrix.scaleX>=8} onClick={()=>zoom?.scale({scaleX:1.5,scaleY:1.5})} aria-label="Zoom in"><Plus size={16}/></button>
    <button type="button" disabled={disabled || !zoom || zoom.transformMatrix.scaleX<=1} onClick={()=>zoom?.scale({scaleX:1/1.5,scaleY:1/1.5})} aria-label="Zoom out"><Minus size={16}/></button>
    <button type="button" disabled={disabled || !zoom} onClick={()=>zoom?.reset()} aria-label="Reset map view"><RotateCcw size={15}/></button>
  </div>;
}
export function LocationMap({country,onSelect,disabled=false}:{country:string;onSelect:(country:string)=>void;disabled?:boolean}) {
  const [world,setWorld]=useState<WorldData|null>(cachedWorld);
  const [error,setError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(cachedWorld)return;
    const controller=new AbortController();
    void fetch('/maps/world-countries.json',{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])})
      .then(response=>{if(!response.ok)throw new Error('Map unavailable');return response.json();})
      .then((data:WorldData)=>{if(!controller.signal.aborted){cachedWorld=data;setWorld(data);}})
      .catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[attempt]);
  const countries=world ? [...new Set(world.features.map(f=>countryName(String(f.properties.name || ''))))].sort() : [];
  const selected=countries.find(name=>sameCountry(name,country)) || '';
  return <section className={styles.card} aria-labelledby="location-map-title">
    <div className={styles.header}><span className={styles.eyebrow}>YOUR HOME BASE</span><h3 id="location-map-title"><MapPin size={20}/>Where&apos;s home?</h3>
      <p>Choose your country on the map, then add your city below.</p></div>
    {world ? <>
      <div className={styles.canvas}>
        <ChoroplethChart data={world} aspectRatio="1.65 / 1" zoomEnabled={!disabled} zoomMin={1} zoomMax={8} animationDuration={0}>
          <ChoroplethFeature selectedCountry={country} onSelect={onSelect} disabled={disabled}/>
          <ChoroplethTooltip/>
          <MapControls disabled={disabled}/>
        </ChoroplethChart>
      </div>
      <div className={styles.selection}><label htmlFor="map-country">Home country</label>
        <select id="map-country" value={selected} disabled={disabled} onChange={event=>{if(event.target.value)onSelect(event.target.value);}}>
          <option value="">{country || 'Choose a country'}</option>{countries.map(name=><option key={name} value={name}>{name}</option>)}
        </select>
        <span>Drag to explore. Use + to reach smaller countries.</span>
      </div>
    </> : <div className={styles.loading}>{error ? <><p>The map couldn&apos;t load. You can still enter your location below.</p><button type="button" onClick={()=>{setError(false);setAttempt(value=>value+1);}}>Retry map</button></> : <output>Loading your world...</output>}</div>}
  </section>;
}
