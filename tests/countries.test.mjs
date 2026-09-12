import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {countryName,sameCountry} from '../lib/countries.ts';
test('saved aliases highlight the corresponding mapped country',()=>{
 assert.ok(sameCountry('USA','United States of America'));
 assert.ok(sameCountry('uk','United Kingdom'));
 assert.ok(sameCountry(' INDIA ','India'));
 assert.equal(sameCountry('India','Indonesia'),false);
 assert.equal(countryName('Bosnia and Herz.'),'Bosnia and Herzegovina');
});
test('map ships with real country geometry and preserves locations absent from the map',()=>{
 const world=JSON.parse(fs.readFileSync(new URL('../public/maps/world-countries.json',import.meta.url),'utf8'));
 assert.equal(world.type,'FeatureCollection');assert.ok(world.features.length>150);
 for(const country of ['India','United States','United Kingdom','Canada'])assert.ok(world.features.some(f=>sameCountry(f.properties.name,country)));
 assert.ok(world.features.every(f=>['Polygon','MultiPolygon'].includes(f.geometry.type)));
 assert.equal(countryName('Vatican City'),'Vatican City');
});
