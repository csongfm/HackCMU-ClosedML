import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBriefChart,
  parseInteractiveBrief,
} from '../lib/interactive-brief.ts';
const summary =
  'Alpha: 40% and Beta: 60%. On 2026-01-01 sales were 10 units; on 2026-02-01 sales were 20 units.';
const pie = {
  type: 'donut',
  title: 'Share',
  unit: '%',
  points: [
    { label: 'Alpha', value: 40, sourceId: 0, evidence: 'Alpha: 40%' },
    { label: 'Beta', value: 60, sourceId: 0, evidence: 'Beta: 60%' },
  ],
};
test('accepts cited exhaustive shares and all comparison variants', () => {
  for (const type of ['pie', 'donut', 'bar', 'horizontal-bar'])
    assert.ok(validateBriefChart({ ...pie, type }, [summary], [0]));
});
test('rejects invented values, excerpts, units, labels, nonfinite numbers and unlinked sources', () => {
  for (const patch of [
    { value: 41 },
    { value: Infinity },
    { value: NaN },
    { sourceId: 1 },
    { label: 'Gamma' },
    { evidence: 'Alpha: 40% fabricated' },
  ])
    assert.equal(
      validateBriefChart(
        { ...pie, points: [{ ...pie.points[0], ...patch }, pie.points[1]] },
        [summary],
        [0],
      ),
      undefined,
    );
  assert.equal(
    validateBriefChart({ ...pie, unit: 'million' }, [summary], [0]),
    undefined,
  );
});
test('requires exhaustive shares, unique labels and valid dates', () => {
  assert.equal(
    validateBriefChart(
      { ...pie, points: [pie.points[0], pie.points[0]] },
      [summary],
      [0],
    ),
    undefined,
  );
  assert.equal(
    validateBriefChart({ ...pie, type: 'line' }, [summary], [0]),
    undefined,
  );
  const points = [
    {
      label: '2026-02-01',
      value: 20,
      sourceId: 0,
      evidence: '2026-02-01 sales were 20 units',
    },
    {
      label: '2026-01-01',
      value: 10,
      sourceId: 0,
      evidence: '2026-01-01 sales were 10 units',
    },
  ];
  for (const type of ['line', 'area'])
    assert.equal(
      validateBriefChart(
        { type, title: 'Sales', unit: 'units', points },
        [summary],
        [0],
      ).points[0].value,
      10,
    );
});
test('invalid charts retain narrative; missed stories retain source coverage', () => {
  const stories = [
    { title: 'One', url: 'https://example.com/1', source: 'Publisher' },
    { title: 'Two', url: 'https://example.com/2', source: 'Publisher' },
  ];
  const result = parseInteractiveBrief(
    {
      sections: [
        {
          title: 'A brief',
          paragraphs: ['What happened.'],
          sourceIds: [0],
          chart: { ...pie, unit: 'dollars' },
        },
      ],
    },
    stories,
    new Map(stories.map((s) => [s.url, summary])),
  );
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0].chart, undefined);
  assert.deepEqual(result.sections[1].sourceIds, [1]);
  assert.equal(result.sources[0].url, stories[0].url);
  assert.ok(result.text.includes('What happened.'));
});
test('rejects malformed sections and invalid source references', () => {
  assert.throws(() =>
    parseInteractiveBrief(
      { sections: [{ title: 'Test', paragraphs: ['Text'], sourceIds: [3] }] },
      [],
      new Map(),
    ),
  );
});

test('accepts percent spelling without requiring the percent symbol', () => {
  assert.ok(validateBriefChart({ ...pie, unit: 'percent' }, [summary], [0]));
});
test('does not confuse percentage points with percentage shares', () => {
  assert.equal(
    validateBriefChart({ ...pie, unit: 'percentage points' }, [summary], [0]),
    undefined,
  );
});

test('markdown emphasis in sourced research does not discard real observations', () => {
  const chart = {
    type: 'bar',
    title: 'Race times',
    unit: 'seconds',
    points: [
      {
        label: 'Alice',
        value: 43.39,
        sourceId: 0,
        evidence: 'Alice (Botswana): 43.39 seconds',
      },
      {
        label: 'Bob',
        value: 44.15,
        sourceId: 0,
        evidence: 'Bob (USA): 44.15 seconds',
      },
    ],
  };
  assert.ok(
    validateBriefChart(
      chart,
      ['**Alice** (Botswana): 43.39 seconds; **Bob** (USA): 44.15 seconds'],
      [0],
    ),
  );
});

test('chronological years and months support Bklit time-series charts', () => {
  for (const labels of [
    ['2023', '2024', '2025'],
    ['2025-01', '2025-02', '2025-03'],
  ]) {
    const points = labels.map((label, i) => ({
      label,
      value: 10 + i,
      sourceId: 0,
      evidence: label + ': ' + (10 + i) + ' million',
    }));
    for (const type of ['line', 'area'])
      assert.ok(
        validateBriefChart(
          { type, title: 'Annual revenue', unit: 'million', points },
          [points.map((p) => p.evidence).join('. ')],
          [0],
        ),
      );
  }
});
