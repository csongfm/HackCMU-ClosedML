import type { NewsFeed, NewsStory } from './news';

export type StarRating = 1 | 2 | 3 | 4 | 5;
export type FeedbackExample = { url: string; rating: StarRating; ratedAt: string; features: [string, number][] };
export type LearnedFeed = NewsFeed & { ratings: { url: string; rating: StarRating }[] };
export const MAX_FEEDBACK = 200;
export const REFRESH_AFTER_RATINGS = 5;
const MAX_PAIRS = 1200;
const STOP_WORDS = new Set('a an and are as at be been but by for from has have how in into is it its new of on or that the their this to was were will with you your after over says said about amid can could would should more most than not who what when why all out up'.split(' '));
const priors = new Map([['recency', 2.5], ['keyword', 0.3], ['popularity', 0.15]]);
const sigmoid = (score: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, score))));

export function extractKeywords(title: string): string[] {
  return [...new Set((title.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])
    .filter((word) => !STOP_WORDS.has(word) && !/^\d+$/.test(word)))].slice(0, 40);
}

// Sharp early decay: 1 at publication, ~0.59 at 1 hour, ~0.24 at 24 hours.
export function recencyScore(publishedAt: string, now = Date.now()): number {
  const age = (now - Date.parse(publishedAt)) / 3600_000;
  return Number.isFinite(age) ? 1 / (1 + Math.log1p(Math.max(0, age))) : 0;
}

// Coverage proxy, NOT readership: independent publishers sharing >=3 keywords
// and >=50% of combined headline vocabulary. Duplicate URLs never add sources.
export function withCoverage(stories: NewsStory[]): NewsStory[] {
  const tokens = stories.map((story) => new Set(extractKeywords(story.title)));
  return stories.map((story, i) => {
    const sources = new Set([story.source.toLowerCase()]);
    tokens.forEach((other, j) => {
      const overlap = [...tokens[i]].filter((word) => other.has(word)).length;
      if (overlap >= 3 && overlap / (tokens[i].size + other.size - overlap) >= 0.5 && (i === j || story.url !== stories[j].url)) sources.add(stories[j].source.toLowerCase());
    });
    return { ...story, coverageSources: Math.max(story.coverageSources || 1, sources.size) };
  });
}

export function storyFeatures(story: NewsStory, corpus: NewsStory[] = [story], now = Date.now()): [string, number][] {
  const keywords = extractKeywords(story.title);
  const documents = corpus.map((item) => new Set(extractKeywords(item.title)));
  const weighted = keywords.map((word): [string, number] => [word,
    1 + Math.log((documents.length + 1) / (1 + documents.filter((doc) => doc.has(word)).length))]);
  const norm = Math.sqrt(weighted.reduce((sum, [, value]) => sum + value * value, 0)) || 1;
  const salience = weighted.reduce((sum, [, value]) => sum + value, 0) / Math.max(1, keywords.length);
  return [
    ['recency', recencyScore(story.publishedAt, now)],
    ['keyword', keywords.length ? salience / (1 + salience) : 0],
    ['popularity', Math.min(1, Math.log1p(Math.max(0, (story.coverageSources || 1) - 1)) / Math.log(10))],
    ...weighted.map(([word, value]): [string, number] => [`word:${word}`, value / norm]),
    [`category:${story.category}`, 0.35], [`source:${story.source.toLowerCase().slice(0, 120)}`, 0.2],
  ];
}

export type PreferencePair = { features: [string, number][]; label: 0 | 1; importance: number };
export function preferencePairs(examples: FeedbackExample[]): PreferencePair[] {
  const recent = examples.slice(-MAX_FEEDBACK);
  const pairs: PreferencePair[] = [];
  for (let distance = 1; distance < recent.length && pairs.length < MAX_PAIRS; distance++) {
    for (let i = recent.length - 1; i >= distance && pairs.length < MAX_PAIRS; i--) {
      const a = recent[i], b = recent[i - distance];
      if (a.rating === b.rating || a.url === b.url) continue;
      const difference = new Map(a.features);
      for (const [key, value] of b.features) difference.set(key, (difference.get(key) || 0) - value);
      // Legacy ratings have no dense snapshots; absence is not a zero score.
      const aKeys = new Set(a.features.map(([key]) => key)), bKeys = new Set(b.features.map(([key]) => key));
      pairs.push({ features: [...difference].filter(([key, value]) => value !== 0 && (!priors.has(key) || (aKeys.has(key) && bKeys.has(key)))), label: a.rating > b.rating ? 1 : 0,
        importance: Math.abs(a.rating - b.rating) / 4 });
    }
  }
  return pairs;
}

// P(A > B) = sigmoid(w · (xA - xB)). Full-batch cross entropy with L2 toward
// freshness-first priors. Equal ratings provide no pairwise preference.
export function trainModel(examples: FeedbackExample[]): Map<string, number> {
  const weights = new Map(priors);
  const pairs = preferencePairs(examples);
  const total = pairs.reduce((sum, pair) => sum + pair.importance, 0);
  if (!total) return weights;
  for (let epoch = 0; epoch < 100; epoch++) {
    const gradient = new Map<string, number>();
    for (const pair of pairs) {
      const score = pair.features.reduce((sum, [key, value]) => sum + (weights.get(key) || 0) * value, 0);
      const error = (pair.label - sigmoid(score)) * pair.importance;
      for (const [key, value] of pair.features) gradient.set(key, (gradient.get(key) || 0) + error * value / total);
    }
    for (const key of new Set([...weights.keys(), ...gradient.keys()])) {
      const weight = weights.get(key) || 0;
      weights.set(key, weight + 0.7 * ((gradient.get(key) || 0) - 0.025 * (weight - (priors.get(key) || 0))));
    }
  }
  return weights;
}

export function discoveryKeywords(examples: FeedbackExample[]): string[] {
  if (examples.length < REFRESH_AFTER_RATINGS) return [];
  return [...trainModel(examples)].filter(([key, weight]) => key.startsWith('word:') && weight > 0.15)
    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key]) => key.slice(5));
}
export function ratingsFor(examples: FeedbackExample[]) {
  return examples.map(({ url, rating }) => ({ url, rating }));
}
export function refreshDue(examples: FeedbackExample[], fetchedAt: string): boolean {
  return new Set(examples.filter((item) => Date.parse(item.ratedAt) > Date.parse(fetchedAt)).map((item) => item.url)).size >= REFRESH_AFTER_RATINGS;
}
export function rankFeed(feed: NewsFeed, examples: FeedbackExample[], now = Date.now()): LearnedFeed {
  const weights = trainModel(examples);
  const candidates = withCoverage(feed.stories);
  const rated = new Set(examples.map((item) => item.url));
  const scored = candidates.map((story) => ({ story, score: storyFeatures(story, candidates, now)
    .reduce((sum, [key, value]) => sum + (weights.get(key) || 0) * value, 0) }));
  // Prefer unseen stories on refresh; keep rated stories as a fallback.
  scored.sort((a, b) => Number(rated.has(a.story.url)) - Number(rated.has(b.story.url)) || b.score - a.score);
  return { ...feed, stories: scored.slice(0, 40).map(({ story }) => story), ratings: ratingsFor(examples) };
}
export function parseFeedback(body: unknown): { action: 'rate' | 'clear'; url: string; rating?: StarRating } {
  if (!body || typeof body !== 'object') throw new Error('Provide a valid rating.');
  const { action, url, rating } = body as Record<string, unknown>;
  if (!['rate', 'clear'].includes(String(action)) || typeof url !== 'string' || !url || url.length > 4096) throw new Error('Choose a valid story.');
  if (action === 'clear') return { action, url };
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose one to five stars.');
  return { action: 'rate', url, rating: rating as StarRating };
}

// Migrate saved likes/dislikes without inventing timestamps or dense features.
export function normalizeFeedback(examples: unknown[]): FeedbackExample[] {
  return examples.flatMap((raw): FeedbackExample[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const rating = item.rating ?? (item.value === 'more' ? 5 : item.value === 'less' ? 1 : 0);
    if (typeof item.url !== 'string' || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5 || !Array.isArray(item.features)) return [];
    const features = item.features.filter((entry): entry is [string, number] => Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'number' && Number.isFinite(entry[1]));
    return [{ url: item.url, rating: rating as StarRating, ratedAt: typeof item.ratedAt === 'string' ? item.ratedAt : '', features }];
  }).slice(-MAX_FEEDBACK);
}
