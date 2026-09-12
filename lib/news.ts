import { XMLParser } from 'fast-xml-parser';
import { SyntaxValidator } from 'fast-xml-validator';
import type { ListenerProfile } from './preferences';

export type NewsCategory = 'Interests' | 'Sports' | 'Markets' | 'Places' | 'Following';
export type NewsQuery = { category: NewsCategory; terms: string[]; query: string };
export type NewsStory = { title: string; url: string; source: string; publishedAt: string; category: NewsCategory; reasons: string[]; coverageSources?: number; imageUrl?: string | null; imageCheckedAt?: string; imageVersion?: number };
export type NewsFeed = { stories: NewsStory[]; fetchedAt: string; cached: boolean; warning?: string };

const stockNames: Record<string, string> = { AAPL: 'Apple', NVDA: 'Nvidia', MSFT: 'Microsoft', AMZN: 'Amazon', TSLA: 'Tesla', GOOGL: 'Google', GOOG: 'Google', META: 'Meta', 'BRK.B': 'Berkshire Hathaway' };
const quote = (value: string) => `"${value.replace(/[^\p{L}\p{N}\s.,&-]/gu, ' ').trim()}"`;

// Every saved selection participates, including watchlists larger than three.
// Batch OR searches to bound requests while leaving room for each category.
export function buildNewsQueries(profile: ListenerProfile, learnedKeywords: string[] = []): NewsQuery[] {
  const groups: [NewsCategory, string[]][] = [
    ['Places', [profile.city, profile.country, ...profile.locations].filter(Boolean)],
    ['Sports', profile.teams],
    ['Markets', profile.tickers.map((ticker) => stockNames[ticker] || ticker)],
    ['Following', [...profile.companies, ...profile.people]],
    ['Interests', profile.topics.map((topic) => topic === 'Local news' ? profile.city : topic)],
  ];
  const queries = groups.flatMap(([category, values]) => {
    const terms = [...new Set(values)];
    const queries: NewsQuery[] = [];
    for (let i = 0; i < terms.length; i += 5) {
      const batch = terms.slice(i, i + 5);
      queries.push({ category, terms: batch, query: `(${batch.map(quote).join(' OR ')})${category === 'Markets' ? ' stock' : ''} when:3d` });
    }
    return queries;
  });
  // Add bounded discovery searches; saved interests/exclusions remain in force.
  for (const term of [...new Set(learnedKeywords)].slice(0, 3)) {
    if (/^[\p{L}\p{N}]{2,40}$/u.test(term)) queries.push({ category: 'Interests', terms: [term], query: `${quote(term)} when:3d` });
  }
  return queries;
}

function plain(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, (entity) => {
    const known: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    if (known[entity]) return known[entity];
    const code = entity.startsWith('&#x') ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

export function mentions(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

export function parseNewsRss(xml: string, query: NewsQuery): NewsStory[] {
  if (xml.length > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Invalid news response.');
  SyntaxValidator.validate(xml);
  const parsed = new XMLParser({ ignoreAttributes: true, processEntities: false, parseTagValue: false }).parse(xml);
  if (!parsed?.rss?.channel) throw new Error('Expected an RSS news feed.');
  const raw = parsed.rss.channel.item;
  return (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(0, 100).flatMap((item): NewsStory[] => {
    const source = plain(item.source) || 'News publisher';
    let title = plain(item.title);
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -source.length - 3);
    const published = Date.parse(item.pubDate);
    const url = plain(item.link);
    // Keep links on the known aggregator; no untrusted protocols or hosts.
    try { if (new URL(url).origin !== 'https://news.google.com') return []; } catch { return []; }
    if (!title || title.length > 600 || !Number.isFinite(published)) return [];
    const matches = query.terms.filter((term) => mentions(title, term));
    return [{ title, url, source, publishedAt: new Date(published).toISOString(), category: query.category,
      reasons: matches.length ? matches.map((term) => `Mentions ${term}`) : [`From your ${query.category.toLowerCase()} search`] }];
  });
}

export function curateStories(stories: NewsStory[], excludedTopics: string[], now = Date.now(), limit = 40): NewsStory[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const groups = new Map<NewsCategory, NewsStory[]>();
  for (const story of [...stories].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))) {
    const age = now - Date.parse(story.publishedAt);
    const titleKey = story.title.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    if (!Number.isFinite(age) || age < -3600_000 || age > 72 * 3600_000 || seenUrls.has(story.url) || seenTitles.has(titleKey) || excludedTopics.some((term) => mentions(story.title, term))) continue;
    seenUrls.add(story.url); seenTitles.add(titleKey);
    const group = groups.get(story.category) || [];
    group.push(story); groups.set(story.category, group);
  }
  // Round-robin prevents one broad interest from taking over the feed.
  const result: NewsStory[] = [];
  while (result.length < limit) {
    let added = false;
    for (const group of groups.values()) {
      const story = group.shift();
      if (story && result.length < limit) { result.push(story); added = true; }
    }
    if (!added) break;
  }
  return result;
}

export async function fetchNews(profile: ListenerProfile, learnedKeywords: string[] = []): Promise<NewsFeed> {
  const queries = buildNewsQueries(profile, learnedKeywords);
  const stories: NewsStory[] = [];
  let failed = 0;
  let cursor = 0;
  const deadline = AbortSignal.timeout(20_000);
  await Promise.all(Array.from({ length: Math.min(5, queries.length) }, async () => {
    while (cursor < queries.length) {
      const query = queries[cursor++];
      try {
        const params = new URLSearchParams({ q: query.query, hl: 'en-US', gl: 'US', ceid: 'US:en' });
        const response = await fetch(`https://news.google.com/rss/search?${params}`, { cache: 'no-store', signal: AbortSignal.any([deadline, AbortSignal.timeout(6000)]) });
        if (!response.ok) throw new Error('News provider unavailable.');
        // Bound downloaded bytes as well as parsed size.
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Empty response.');
        const decoder = new TextDecoder();
        let xml = ''; let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 2_000_000) throw new Error('News response too large.');
            xml += decoder.decode(value, { stream: true });
          }
          xml += decoder.decode();
        } finally { await reader.cancel(); }
        stories.push(...parseNewsRss(xml, query));
      } catch { failed++; }
    }
  }));
  if (failed === queries.length) throw new Error('News sources are unavailable right now. Please try again shortly.');
  return { stories: curateStories(stories, profile.excludedTopics, Date.now(), 160), fetchedAt: new Date().toISOString(), cached: false,
    ...(failed ? { warning: 'Some searches were unavailable. This feed may not cover all your preferences yet.' } : {}) };
}
