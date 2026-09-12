import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNewsQueries, mentions, parseNewsRss, curateStories, fetchNews } from '../lib/news.ts';
import { EMPTY_PROFILE } from '../lib/preferences.ts';

test('queries include every stock, team, and custom preference', () => {
  const profile = { ...EMPTY_PROFILE, city: 'Pittsburgh', country: 'India', topics: ['AI', 'Local news'], teams: Array.from({ length: 15 }, (_, i) => `Team ${i}`), tickers: Array.from({ length: 25 }, (_, i) => `STOCK${i}`), people: ['An Author'], companies: ['A University'], locations: ['London'] };
  const queries = buildNewsQueries(profile);
  const terms = queries.flatMap((query) => query.terms);
  for (const term of [...profile.teams, ...profile.tickers, ...profile.people, ...profile.companies, ...profile.locations, profile.country]) assert.ok(terms.includes(term), term);
  assert.ok(queries.every((query) => query.terms.length <= 5));
});

test('headline matching uses word boundaries and escapes special characters', () => {
  assert.equal(mentions('They said nothing', 'AI'), false);
  assert.equal(mentions('New AI breakthrough', 'AI'), true);
  assert.equal(mentions('BRK.B earnings', 'BRK.B'), true);
  assert.equal(mentions('BRKXB earnings', 'BRK.B'), false);
});

const query = { category: 'Interests', terms: ['Science'], query: 'Science' };
const rss = (link = 'https://news.google.com/rss/articles/test') => `<rss><channel><item><title><![CDATA[Science &amp; space - Publisher]]></title><link>${link}</link><pubDate>Sat, 12 Sep 2026 10:00:00 GMT</pubDate><source url="https://example.com">Publisher</source></item></channel></rss>`;
test('RSS yields clean attributed headlines and explanations', () => {
  const [story] = parseNewsRss(rss(), query);
  assert.equal(story.title, 'Science & space');
  assert.equal(story.source, 'Publisher');
  assert.deepEqual(story.reasons, ['Mentions Science']);
  assert.equal(story.publishedAt, '2026-09-12T10:00:00.000Z');
});

test('malformed XML, entities, oversized input, and unsafe links are rejected', () => {
  assert.throws(() => parseNewsRss('<rss>', query));
  assert.throws(() => parseNewsRss('<!DOCTYPE rss><rss/>', query));
  assert.throws(() => parseNewsRss('x'.repeat(2_000_001), query));
  assert.deepEqual(parseNewsRss(rss('javascript:alert(1)'), query), []);
  assert.deepEqual(parseNewsRss(rss('https://news.google.com.evil.test/story'), query), []);
});

test('curation removes duplicates, stale stories, and excluded headlines', () => {
  const now = Date.parse('2026-09-12T12:00:00Z');
  const story = parseNewsRss(rss(), query)[0];
  const result = curateStories([story, { ...story, url: `${story.url}2` }, { ...story, title: 'Celebrity gossip', url: `${story.url}3` }, { ...story, title: 'Old science', url: `${story.url}4`, publishedAt: '2026-09-01T12:00:00Z' }], ['celebrity gossip'], now);
  assert.equal(result.length, 1);
});

test('curation balances categories and bounds feed storage', () => {
  const base = parseNewsRss(rss(), query)[0];
  const many = Array.from({ length: 60 }, (_, i) => ({ ...base, title: `Story ${i}`, url: `${base.url}${i}` }));
  many.push({ ...base, title: 'Sports story', url: `${base.url}sports`, category: 'Sports' });
  const result = curateStories(many, [], Date.parse('2026-09-12T12:00:00Z'));
  assert.equal(result.length, 40);
  assert.equal(result[1].category, 'Sports');
});

test('provider outage is an error, not fake or empty news', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('Offline'); };
  try { await assert.rejects(fetchNews({ ...EMPTY_PROFILE, city: 'Pittsburgh', topics: ['Science'] }), /unavailable/); }
  finally { globalThis.fetch = original; }
});

test('discovery searches fetch real RSS candidates beyond 40 and still apply exclusions', async () => {
  const original = globalThis.fetch;
  const searches = [];
  const date = new Date().toUTCString();
  globalThis.fetch = async (url) => {
    searches.push(new URL(url).searchParams.get('q'));
    return new Response(`<rss><channel>${Array.from({length:65},(_,i)=>`<item><title>Science robotics ${i===64?'excluded':i}</title><link>https://news.google.com/rss/articles/${i}</link><pubDate>${date}</pubDate><source>Publisher</source></item>`).join('')}</channel></rss>`);
  };
  try {
    const feed=await fetchNews({...EMPTY_PROFILE,city:'Pittsburgh',topics:['Science'],excludedTopics:['excluded']},['robotics']);
    assert.ok(searches.includes('"robotics" when:3d'));
    assert.equal(feed.stories.length,64);
    assert.ok(feed.stories.every(story=>!story.title.includes('excluded')));
  } finally { globalThis.fetch=original; }
});
