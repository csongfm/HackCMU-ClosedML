import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords, extractGeminiText, parseGeminiSummaryOutput } from '../lib/gemini-news.ts';

const longSummary = (subject) => `${subject} reports a significant development that affects the people and organizations involved. The available details establish what changed and when the update became public. It also explains the immediate context surrounding the announcement without adding unsupported claims. Readers can understand why the story matters now and what remains uncertain. The publisher's complete report provides any additional details that are not present in this concise overview.`;

test('extracts text from a Gemini generateContent response', () => {
  assert.equal(extractGeminiText({ candidates: [{ content: { parts: [{ text: '{"summaries":[]}' }] } }] }), '{"summaries":[]}');
  assert.throws(() => extractGeminiText({ candidates: [] }), /no text/);
});

test('accepts one valid Gemini summary for every requested story', () => {
  const value = { summaries: [
    { id: 0, summary: longSummary('The first story') },
    { id: 1, summary: longSummary('The second story') },
  ] };
  assert.deepEqual(parseGeminiSummaryOutput(value, 2).map((item) => item.id), [0, 1]);
});

test('counts transcript and summary words consistently', () => {
  assert.equal(countWords(' one\n two   three '), 3);
  assert.equal(countWords('   '), 0);
});

test('rejects missing, duplicate, short, or unexpected Gemini summaries', () => {
  assert.throws(() => parseGeminiSummaryOutput({ summaries: [{ id: 0, summary: 'Too short' }] }, 1));
  assert.throws(() => parseGeminiSummaryOutput({ summaries: [{ id: 0, summary: longSummary('The first story') }, { id: 0, summary: longSummary('The duplicate story') }] }, 2));
  assert.throws(() => parseGeminiSummaryOutput({ summaries: [{ id: 2, summary: longSummary('The unexpected story') }] }, 1));
});
