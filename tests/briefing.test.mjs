import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBriefingTranscript, createStorySummary } from '../lib/briefing.ts';

const story = (index, category = 'Interests') => ({ title: `Story ${index}`, url: `https://news.google.com/${index}`, source: 'Example News', publishedAt: '2026-09-12T12:00:00.000Z', category, reasons: [`Mentions Topic ${index}`] });

test('quick summaries remain attributable to RSS metadata', () => {
  assert.equal(createStorySummary(story(1)), 'Story 1. Reported by Example News. It is in your feed because it mentions Topic 1.');
});

test('briefing lengths include progressively more ranked stories', () => {
  const stories = Array.from({ length: 40 }, (_, index) => story(index, index % 2 ? 'Sports' : 'Interests'));
  assert.equal(buildBriefingTranscript(stories, 5).storiesIncluded, 8);
  assert.equal(buildBriefingTranscript(stories, 10).storiesIncluded, 18);
  assert.equal(buildBriefingTranscript(stories, 20).storiesIncluded, 40);
});

test('transcript groups selected stories and stays within available results', () => {
  const result = buildBriefingTranscript([story(1), story(2, 'Sports')], 20);
  assert.equal(result.storiesIncluded, 2);
  assert.deepEqual(result.chapters.map((chapter) => chapter.category), ['Interests', 'Sports']);
  assert.match(result.text, /personalized 20-minute Briefly transcript/);
  assert.match(result.text, /publisher’s complete reporting/);
});
