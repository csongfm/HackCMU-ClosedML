import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeedback, rankFeed, storyFeatures, trainModel, MAX_FEEDBACK } from '../lib/feed-learning.ts';

const story = (title, id, category = 'Interests', source = 'Publisher') => ({ title, url: `https://news.google.com/rss/articles/${id}`, category, source, publishedAt: '2026-09-12T12:00:00Z', reasons: ['From your interests search'] });
const example = (item, value) => ({ url: item.url, value, features: storyFeatures(item) });
const robotics = story('Robotics laboratory develops autonomous robots', 'training');
const related = story('Autonomous robotics research advances robots', 'unseen');
const unrelated = story('Festival celebrates painting and sculpture', 'art');
const feed = { stories: [unrelated, related], fetchedAt: '2026-09-12T12:00:00Z', cached: true };

test('cold start preserves every story and original order without mutating the cached feed', () => {
  const snapshot = structuredClone(feed);
  const ranked = rankFeed(feed, []);
  assert.deepEqual(ranked.stories, feed.stories);
  assert.deepEqual(ranked.learning, { count: 0, signals: [], selections: [] });
  assert.deepEqual(feed, snapshot);
});

test('positive feedback promotes a previously unseen related headline', () => {
  const ranked = rankFeed(feed, [example(robotics, 'more')]);
  assert.equal(ranked.stories[0].url, related.url);
  assert.ok(ranked.stories[0].reasons[0].startsWith('Your feedback favors'));
  assert.ok(ranked.learning.signals.includes('robotics'));
});

test('negative feedback demotes related headlines without hiding stories', () => {
  const ranked = rankFeed({ ...feed, stories: [related, unrelated] }, [example(robotics, 'less')]);
  assert.equal(ranked.stories[0].url, unrelated.url);
  assert.equal(ranked.stories.length, 2);
});

test('replacing or removing a vote reverses its learned influence', () => {
  const more = rankFeed(feed, [example(robotics, 'more')]);
  const less = rankFeed(feed, [example(robotics, 'less')]);
  assert.notEqual(more.stories[0].url, less.stories[0].url);
  assert.deepEqual(rankFeed(feed, []).stories, feed.stories);
  assert.equal(less.learning.count, 1);
});

test('retraining after reload is deterministic and learns category and publisher features', () => {
  const examples = [example(robotics, 'more'), example(unrelated, 'less')];
  assert.deepEqual(rankFeed(feed, examples), rankFeed(feed, structuredClone(examples)));
  const weights = trainModel([example(robotics, 'more')]);
  assert.ok(weights.get('category:Interests') > 0);
  assert.ok(weights.get('source:Publisher') > 0);
});

test('features are normalized and training history is bounded', () => {
  const features = storyFeatures(story('Robots robots ROBOTS the and', 'repeat'));
  assert.equal(features.filter(([key]) => key === 'word:robots').length, 1);
  assert.ok(Math.abs(features.reduce((sum, [, value]) => sum + value ** 2, 0) - 1) < 1e-10);
  const recent = Array.from({ length: MAX_FEEDBACK }, () => example(unrelated, 'less'));
  assert.deepEqual(trainModel([example(robotics, 'more'), ...recent]), trainModel(recent));
  assert.ok([...trainModel(recent).values()].every(Number.isFinite));
});

test('feedback rejects malformed actions, oversized URLs, and missing values', () => {
  for (const body of [null, {}, { action: 'more' }, { action: 'delete', url: related.url }, { action: 'less', url: 'x'.repeat(4097) }]) assert.throws(() => parseFeedback(body));
  assert.deepEqual(parseFeedback({ action: 'reset' }), { action: 'reset' });
  assert.deepEqual(parseFeedback({ action: 'clear', url: related.url }), { action: 'clear', url: related.url });
});
