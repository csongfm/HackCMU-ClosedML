import type { NewsStory } from './news';
export type BriefChart = {
  type: 'bar' | 'horizontal-bar' | 'line' | 'area' | 'pie' | 'donut';
  title: string;
  unit: string;
  points: {
    label: string;
    value: number;
    sourceId: number;
    evidence: string;
  }[];
};
export type BriefSection = {
  title: string;
  paragraphs: string[];
  sourceIds: number[];
  chart?: BriefChart;
};
export type BriefSource = {
  id: number;
  title: string;
  url: string;
  publisher: string;
  references?: { title: string; url: string }[];
};
export type InteractiveBrief = {
  sections: BriefSection[];
  sources: BriefSource[];
  text: string;
  estimatedMinutes: number;
};
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const clean = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const normalized = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\*\*|__/g, '')
    .replace(/,/g, '')
    .replace(/\bpercent\b/g, '%')
    .replace(/\b(?:usd|dollars?)\b/g, '$')
    .replace(/\s+/g, ' ')
    .trim();
export function validateBriefChart(
  raw: unknown,
  summaries: string[],
  allowed: number[],
): BriefChart | undefined {
  if (
    !record(raw) ||
    !['bar', 'horizontal-bar', 'line', 'area', 'pie', 'donut'].includes(
      String(raw.type),
    ) ||
    !clean(raw.title, 160) ||
    !clean(raw.unit, 60) ||
    !Array.isArray(raw.points) ||
    raw.points.length < 2 ||
    raw.points.length > 12
  )
    return;
  const points: BriefChart['points'] = [];
  for (const p of raw.points) {
    if (
      !record(p) ||
      !clean(p.label, 80) ||
      typeof p.value !== 'number' ||
      !Number.isFinite(p.value) ||
      Math.abs(p.value) > 1e15 ||
      !Number.isInteger(p.sourceId) ||
      !allowed.includes(p.sourceId as number) ||
      !clean(p.evidence, 600)
    )
      return;
    const evidence = normalized(p.evidence);
    const source = summaries[p.sourceId as number];
    const numbers = evidence.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    // Require an exact supporting excerpt, original numeric scale, label and unit.
    if (
      !source ||
      !normalized(source).includes(evidence) ||
      !numbers.includes(p.value) ||
      !evidence.includes(normalized(p.label)) ||
      !evidence.includes(normalized(raw.unit))
    )
      return;
    points.push({
      label: p.label,
      value: p.value,
      sourceId: p.sourceId as number,
      evidence: p.evidence,
    });
  }
  if (new Set(points.map((p) => p.label)).size !== points.length) return;
  if (raw.type === 'line' || raw.type === 'area') {
    if (
      points.some(
        (p) =>
          !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(p.label) ||
          !Number.isFinite(Date.parse(p.label)) ||
          new Date(p.label).toISOString().slice(0, p.label.length) !== p.label,
      )
    )
      return;
    points.sort((a, b) => Date.parse(a.label) - Date.parse(b.label));
  }
  if (
    ['area', 'bar', 'horizontal-bar'].includes(String(raw.type)) &&
    points.some((p) => p.value < 0)
  )
    return;
  if (raw.type === 'pie' || raw.type === 'donut') {
    if (
      normalized(raw.unit) !== '%' ||
      points.some((p) => p.value < 0) ||
      Math.abs(points.reduce((s, p) => s + p.value, 0) - 100) > 0.01
    )
      return;
  }
  return {
    type: raw.type as BriefChart['type'],
    title: raw.title,
    unit: raw.unit,
    points,
  };
}
export function parseInteractiveBrief(
  raw: unknown,
  stories: NewsStory[],
  summaries: Map<string, string>,
): InteractiveBrief {
  if (
    !record(raw) ||
    !Array.isArray(raw.sections) ||
    !raw.sections.length ||
    raw.sections.length > 40
  )
    throw new Error('Gemini returned an incomplete brief. Please try again.');
  const material = stories.map((s) => summaries.get(s.url) || '');
  const sections: BriefSection[] = [];
  for (const section of raw.sections) {
    if (
      !record(section) ||
      !clean(section.title, 160) ||
      !Array.isArray(section.paragraphs) ||
      !section.paragraphs.length ||
      section.paragraphs.length > 8 ||
      !section.paragraphs.every((p) => clean(p, 4000)) ||
      !Array.isArray(section.sourceIds) ||
      !section.sourceIds.length ||
      !section.sourceIds.every(
        (id) => Number.isInteger(id) && id >= 0 && id < stories.length,
      )
    )
      throw new Error('Gemini returned an incomplete brief. Please try again.');
    const sourceIds = [...new Set(section.sourceIds as number[])];
    sections.push({
      title: section.title,
      paragraphs: section.paragraphs as string[],
      sourceIds,
      chart: validateBriefChart(section.chart, material, sourceIds),
    });
  }
  // Preserve coverage if the model skipped a source; never fabricate filler.
  const covered = new Set(sections.flatMap((s) => s.sourceIds));
  stories.forEach((s, id) => {
    if (!covered.has(id))
      sections.push({
        title: s.title,
        paragraphs: [material[id]],
        sourceIds: [id],
      });
  });
  const text = sections
    .map((s) => [s.title, ...s.paragraphs].join('\n\n'))
    .join('\n\n');
  if (text.length > 50000)
    throw new Error('Gemini returned an oversized brief. Please try again.');
  return {
    sections,
    sources: stories.map((s, id) => ({
      id,
      title: s.title,
      url: s.url,
      publisher: s.source,
    })),
    text,
    estimatedMinutes: Math.max(1, Math.ceil(text.split(/\s+/).length / 150)),
  };
}

export function applyBriefCharts(
  brief: InteractiveBrief,
  raw: unknown,
  material: string[],
): number {
  if (!record(raw) || !Array.isArray(raw.charts)) return 0;
  let added = 0;
  for (const proposal of raw.charts.slice(0, 40)) {
    if (!record(proposal) || !Number.isInteger(proposal.sectionIndex)) continue;
    const section = brief.sections[proposal.sectionIndex as number];
    if (!section || section.chart) continue;
    const chart = validateBriefChart(proposal, material, section.sourceIds);
    if (chart) {
      section.chart = chart;
      added++;
    }
  }
  return added;
}
