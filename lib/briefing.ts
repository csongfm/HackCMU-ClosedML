import type { NewsCategory, NewsStory } from './news';

export type BriefingMinutes = 5 | 10 | 20;
export type BriefingTranscript = {
  minutes: BriefingMinutes;
  storiesIncluded: number;
  totalAvailable: number;
  chapters: { category: NewsCategory; stories: NewsStory[] }[];
  text: string;
};

const storyLimits: Record<BriefingMinutes, number> = { 5: 8, 10: 18, 20: 40 };

export function selectBriefingStories(stories: NewsStory[], minutes: BriefingMinutes): NewsStory[] {
  return stories.slice(0, storyLimits[minutes]);
}

function endSentence(value: string): string {
  const clean = value.trim();
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function naturalReason(reason: string): string {
  if (reason.startsWith('Mentions ')) return `it mentions ${reason.slice(9)}`;
  if (reason.startsWith('Your feedback favors ')) return `your feedback favors ${reason.slice(21)}`;
  if (reason.startsWith('From your ')) return `it came from ${reason.slice(10).toLowerCase()}`;
  return reason.charAt(0).toLowerCase() + reason.slice(1);
}

// RSS supplies headline metadata, not article bodies. Keep this compact and
// attributable so the UI never invents details that the publisher did not send.
export function createStorySummary(story: NewsStory): string {
  const why = story.reasons[0] ? ` It is in your feed because ${naturalReason(story.reasons[0])}.` : '';
  return `${endSentence(story.title)} Reported by ${story.source}.${why}`;
}

export function buildBriefingTranscript(stories: NewsStory[], minutes: BriefingMinutes): BriefingTranscript {
  const selected = selectBriefingStories(stories, minutes);
  const groups = new Map<NewsCategory, NewsStory[]>();
  for (const story of selected) groups.set(story.category, [...(groups.get(story.category) || []), story]);
  const chapters = [...groups].map(([category, chapterStories]) => ({ category, stories: chapterStories }));
  const passages = chapters.flatMap(({ category, stories: chapterStories }) => [
    `${category}.`,
    ...chapterStories.map((story) => createStorySummary(story)),
  ]);
  const intro = `Good morning. This is your personalized ${minutes}-minute Briefly transcript, covering ${selected.length} of today’s top stories for you.`;
  const outro = 'That is your Briefly rundown. Open any story in your feed for the publisher’s complete reporting.';
  return { minutes, storiesIncluded: selected.length, totalAvailable: stories.length, chapters, text: [intro, ...passages, outro].join('\n\n') };
}
