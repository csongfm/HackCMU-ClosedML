import assert from 'node:assert/strict';
import test from 'node:test';
import { INTEREST_GROUPS, MAX_INTERESTS, MAX_STOCKS, hydrateProfile, normalizeProfile, parseTickers } from '../lib/preferences.ts';

const profile = { city: ' Pittsburgh ', topics: ['Technology'], team: '', tickers: ['AAPL'], briefingMinutes: 10 };

test('hydrates a pre-upgrade browser profile before rendering new lists', () => {
  const loaded = hydrateProfile({ ...profile, team: 'Steelers' });
  assert.deepEqual(loaded.teams, ['Steelers']);
  for (const key of ['locations', 'companies', 'people', 'excludedTopics']) assert.deepEqual(loaded[key], []);
  assert.deepEqual(loaded.topics, ['Technology']);
  assert.deepEqual(loaded.tickers, ['AAPL']);
  assert.equal(loaded.city, ' Pittsburgh ');
});

test('hydrates empty and null fields without crashing or resurrecting cleared teams', () => {
  for (const value of [undefined, null, {}, { teams: null, locations: null, topics: null }]) {
    const loaded = hydrateProfile(value);
    for (const key of ['teams', 'locations', 'companies', 'people', 'excludedTopics', 'topics', 'tickers']) assert.ok(Array.isArray(loaded[key]));
  }
  assert.deepEqual(hydrateProfile({ team: 'Steelers', teams: [] }).teams, []);
});

test('hydration preserves incomplete drafts and all new selections', () => {
  const draft = { city: '', topics: [], teams: ['Steelers', 'Lakers'], locations: ['London'], companies: ['Nintendo'], people: ['Lewis Hamilton'], excludedTopics: ['Spoilers'], tickers: ['NVDA'] };
  const loaded = hydrateProfile(draft);
  for (const [key, value] of Object.entries(draft)) assert.deepEqual(loaded[key], value);
  assert.deepEqual(hydrateProfile(loaded), loaded);
});

test('normalizes duplicate symbols, dollar prefixes, spaces and share classes', () => {
  assert.deepEqual(parseTickers('$nvda, AAPL nvda\nBRK.B, btc-usd'), ['NVDA', 'AAPL', 'BRK.B', 'BTC-USD']);
});

test('preserves more than three stocks and the entire 25-stock watchlist', () => {
  const tickers = Array.from({ length: MAX_STOCKS }, (_, i) => `T${i}`);
  assert.deepEqual(normalizeProfile({ ...profile, tickers }).tickers, tickers);
});

test('rejects excess stocks instead of silently dropping them', () => {
  assert.throws(() => normalizeProfile({ ...profile, tickers: Array.from({ length: MAX_STOCKS + 1 }, (_, i) => `T${i}`) }), /up to 25/);
});

test('preserves custom interests and all 20 selected interests', () => {
  const topics = [...INTEREST_GROUPS.flatMap((group) => group.topics).slice(0, MAX_INTERESTS - 1), 'Underwater robotics'];
  const saved = normalizeProfile({ ...profile, topics });
  assert.deepEqual(saved.topics, topics);
  assert.equal(saved.city, 'Pittsburgh');
});

test('deduplicates interests case-insensitively and keeps the first spelling', () => {
  assert.deepEqual(normalizeProfile({ ...profile, topics: ['Technology', ' technology ', 'Indie  games'] }).topics, ['Technology', 'Indie games']);
});

test('validates empty, malformed, oversized and excess interests', () => {
  for (const topics of [[], [123], ['A'.repeat(51)], Array.from({ length: 21 }, (_, i) => `Topic ${i}`)]) {
    assert.throws(() => normalizeProfile({ ...profile, topics }));
  }
  assert.throws(() => normalizeProfile(null));
  assert.throws(() => normalizeProfile({ ...profile, tickers: ['<script>'] }));
  assert.throws(() => normalizeProfile({ ...profile, city: '' }));
  assert.throws(() => normalizeProfile({ ...profile, team: {} }));
});

test('stocks remain optional and previous profiles still work', () => {
  assert.deepEqual(normalizeProfile({ ...profile, tickers: [] }).tickers, []);
  assert.deepEqual(normalizeProfile({ ...profile, tickers: ['AAPL', 'NVDA', 'TSLA'] }).tickers, ['AAPL', 'NVDA', 'TSLA']);
});

test('migrates a saved single team without losing it', () => {
  const saved = normalizeProfile({ ...profile, team: 'Pittsburgh Steelers' });
  assert.deepEqual(saved.teams, ['Pittsburgh Steelers']);
  assert.deepEqual(saved.locations, []);
  assert.deepEqual(saved.companies, []);
  assert.deepEqual(saved.people, []);
  assert.deepEqual(saved.excludedTopics, []);
  assert.equal(saved.country, '');
});

test('explicitly cleared teams do not resurrect the legacy team', () => {
  assert.deepEqual(normalizeProfile({ ...profile, team: 'Steelers', teams: [] }).teams, []);
});

test('round-trips multiple teams and all new personalization fields', () => {
  const saved = normalizeProfile({ ...profile, teams: ['Steelers', 'Lakers', 'steelers'], country: ' United States ', locations: ['London, UK', 'India'], companies: ['Nintendo', 'NASA'], people: ['Lewis Hamilton'], excludedTopics: ['Movie spoilers'] });
  assert.deepEqual(saved.teams, ['Steelers', 'Lakers']);
  assert.equal(saved.country, 'United States');
  assert.deepEqual(saved.locations, ['London, UK', 'India']);
  assert.deepEqual(saved.companies, ['Nintendo', 'NASA']);
  assert.deepEqual(saved.people, ['Lewis Hamilton']);
  assert.deepEqual(saved.excludedTopics, ['Movie spoilers']);
  assert.deepEqual(normalizeProfile(saved), saved);
});

test('rejects malformed and excessive follow lists without truncation', () => {
  for (const key of ['teams', 'locations', 'companies', 'people', 'excludedTopics']) {
    for (const value of ['not a list', [123], ['a'.repeat(101)], Array.from({ length: 16 }, (_, i) => `Entry ${i}`)]) {
      assert.throws(() => normalizeProfile({ ...profile, [key]: value }));
    }
  }
});
