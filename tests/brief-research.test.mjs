import test from 'node:test';
import assert from 'node:assert/strict';
import {
  researchBriefStory,
  selectChartResearchStories,
} from '../lib/gemini-news.ts';
import { applyBriefCharts } from '../lib/interactive-brief.ts';
test('prioritizes data-bearing stories and bounds research to four', () => {
  const stories = [
    'Local opinion',
    'Race results and records',
    'Stock prices and revenue',
    'Game points and stats',
    'Inflation rates',
    'Market growth',
    'Political commentary',
  ].map((title) => ({ title }));
  const chosen = selectChartResearchStories(stories);
  assert.equal(chosen.length, 4);
  assert.ok(!chosen.some((s) => /opinion|commentary/.test(s.title)));
});
test('research uses live search and refuses ungrounded model output', async () => {
  const previous = global.fetch;
  const key = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only';
  let grounded = false;
  global.fetch = async (_url, options) => {
    assert.ok(JSON.parse(options.body).tools[0].google_search);
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [{ text: 'Alice: 10 seconds. Bob: 12 seconds.' }],
            },
            groundingMetadata: {
              groundingChunks: grounded
                ? [
                    {
                      web: {
                        uri: 'https://example.com/report',
                        title: 'Duplicate report',
                      },
                    },
                    {
                      web: {
                        uri: 'https://example.com/report',
                        title: 'Report',
                      },
                    },
                  ]
                : [],
            },
          },
        ],
      }),
      { status: 200 },
    );
  };
  try {
    assert.equal(await researchBriefStory({ title: 'Race results' }), null);
    grounded = true;
    assert.equal(
      (await researchBriefStory({ title: 'Race results' })).references.length,
      1,
    );
  } finally {
    global.fetch = previous;
    if (key === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = key;
  }
});
test('dedicated chart pass fills an omitted chart and rejects unsupported data', () => {
  const brief = {
    sections: [{ title: 'Race', paragraphs: ['Results'], sourceIds: [0] }],
  };
  const proposal = {
    sectionIndex: 0,
    type: 'bar',
    title: 'Race times',
    unit: 'seconds',
    points: [
      { label: 'Alice', value: 10, sourceId: 0, evidence: 'Alice: 10 seconds' },
      { label: 'Bob', value: 12, sourceId: 0, evidence: 'Bob: 12 seconds' },
    ],
  };
  assert.equal(
    applyBriefCharts(brief, { charts: [proposal] }, [
      'Alice: 10 seconds. Bob: 12 seconds.',
    ]),
    1,
  );
  assert.equal(brief.sections[0].chart.points.length, 2);
  assert.equal(
    applyBriefCharts(
      { sections: [{ sourceIds: [0] }] },
      { charts: [proposal] },
      ['No figures available.'],
    ),
    0,
  );
});
