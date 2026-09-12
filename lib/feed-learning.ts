import type { NewsFeed, NewsStory } from './news';

export type FeedbackValue = 'more' | 'less';
export type FeedbackExample = { url: string; value: FeedbackValue; features: [string, number][] };
export type LearnedFeed = NewsFeed & {
  learning: { count: number; signals: string[]; selections: { url: string; value: FeedbackValue }[] };
};
export const MAX_FEEDBACK = 200;
const STOP_WORDS = new Set('a an and are as at be been but by for from has have how in into is it its new of on or that the their this to was were will with you your after over says said'.split(' '));

// Sparse, normalized text features keep training fast and prevent long titles
// from receiving more influence simply because they contain more words.
export function storyFeatures(story: NewsStory): [string, number][] {
  const words = [...new Set(story.title.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((word) => !STOP_WORDS.has(word)).slice(0, 60);
  const features: [string, number][] = words.map((word) => [`word:${word}`, 1]);
  features.push([`category:${story.category}`, 0.65], [`source:${story.source.slice(0, 120)}`, 0.45]);
  const norm = Math.sqrt(features.reduce((sum, [, value]) => sum + value * value, 0));
  return features.map(([key, value]) => [key, value / norm]);
}

// Refit bounded explicit feedback using SGD on binary cross entropy with L2
// regularization. Replaying makes changed votes and Undo remove prior influence.
export function trainModel(examples: FeedbackExample[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (let epoch = 0; epoch < 12; epoch++) {
    for (const example of examples.slice(-MAX_FEEDBACK)) {
      const score = example.features.reduce((sum, [key, value]) => sum + (weights.get(key) || 0) * value, 0);
      const prediction = 1 / (1 + Math.exp(-score));
      const error = (example.value === 'more' ? 1 : 0) - prediction;
      for (const [key, value] of example.features) {
        const weight = weights.get(key) || 0;
        weights.set(key, weight + 0.45 * (error * value - 0.015 * weight));
      }
    }
  }
  return weights;
}

export function rankFeed(feed: NewsFeed, examples: FeedbackExample[]): LearnedFeed {
  const weights = trainModel(examples);
  const ranked = feed.stories.map((story, index) => {
    const contributions = storyFeatures(story).map(([key, value]) => ({ key, score: (weights.get(key) || 0) * value }));
    const prediction = 1 / (1 + Math.exp(-contributions.reduce((sum, item) => sum + item.score, 0)));
    const strongest = contributions.filter((item) => item.key.startsWith('word:') && item.score > 0.025).sort((a, b) => b.score - a.score)[0];
    return { story: { ...story, reasons: strongest ? [`Your feedback favors ${strongest.key.slice(5)}`, ...story.reasons] : story.reasons },
      // Retain a modest freshness/diversity prior from the original curation.
      score: prediction + 0.06 * (1 - index / Math.max(1, feed.stories.length)) };
  });
  const signals = [...weights].filter(([key, value]) => key.startsWith('word:') && value > 0.1)
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key]) => key.slice(5));
  return { ...feed, stories: ranked.sort((a, b) => b.score - a.score).map(({ story }) => story),
    learning: { count: examples.length, signals, selections: examples.map(({ url, value }) => ({ url, value })) } };
}

export function parseFeedback(body: unknown): { action: FeedbackValue | 'clear' | 'reset'; url?: string } {
  if (!body || typeof body !== 'object') throw new Error('Provide valid feedback.');
  const { action, url } = body as Record<string, unknown>;
  if (action === 'reset') return { action };
  if (!['more', 'less', 'clear'].includes(String(action)) || typeof url !== 'string' || url.length > 4096) throw new Error('Choose a valid story and feedback action.');
  return { action: action as FeedbackValue | 'clear', url };
}
