import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { readFeedback } from '@/lib/feed-learning-store';
import { rankFeed } from '@/lib/feed-learning';
import { selectBriefingStories, type BriefingMinutes } from '@/lib/briefing';
import {
  generateGeminiInteractiveBrief,
  loadOrGenerateSummaries,
} from '@/lib/gemini-news';
import {
  parseInteractiveBrief,
  type InteractiveBrief,
} from '@/lib/interactive-brief';
import type { NewsFeed } from '@/lib/news';

export const runtime = 'nodejs';
type TranscriptDocument = InteractiveBrief & {
  _id: string;
  userId: string;
  minutes: BriefingMinutes;
  text: string;
  storiesIncluded: number;
  totalAvailable: number;
  createdAt: Date;
};
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return reply({ error: 'Sign in to generate a transcript.' }, 401);
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== request.nextUrl.origin
  )
    return reply({ error: 'Invalid request origin.' }, 403);
  let minutes: BriefingMinutes;
  try {
    const value = ((await request.json()) as { minutes?: unknown }).minutes;
    if (value !== 5 && value !== 10 && value !== 20) throw new Error();
    minutes = value;
  } catch {
    return reply({ error: 'Choose a 5, 10, or 20-minute briefing.' }, 400);
  }
  try {
    const db = await getDatabase();
    const cached = await db
      .collection<{ _id: string; feed: NewsFeed }>('newsFeeds')
      .findOne({ _id: user.id });
    const age = cached
      ? Date.now() - Date.parse(cached.feed.fetchedAt)
      : Infinity;
    if (!cached || !Number.isFinite(age) || age >= 24 * 3600_000)
      return reply(
        { error: 'Refresh your news feed before generating a transcript.' },
        409,
      );
    const ranked = rankFeed(cached.feed, await readFeedback(db, user.id));
    const stories = selectBriefingStories(ranked.stories, minutes);
    if (!stories.length)
      return reply({ error: 'There are no stories to summarize yet.' }, 409);
    const summaries = await loadOrGenerateSummaries(db, stories);
    const cacheId = createHash('sha256')
      .update(
        `text-brief-v1\n${user.id}\n${minutes}\n${stories.map((story) => `${story.url}:${summaries.get(story.url)}`).join('\n')}`,
      )
      .digest('hex');
    const collection = db.collection<TranscriptDocument>(
      'geminiBriefingTranscripts',
    );
    const prior = await collection.findOne({ _id: cacheId });
    if (prior)
      return reply({
        minutes,
        sections: prior.sections,
        sources: prior.sources,
        estimatedMinutes: prior.estimatedMinutes,
        text: prior.text,
        storiesIncluded: prior.storiesIncluded,
        totalAvailable: prior.totalAvailable,
        cached: true,
      });
    const brief = parseInteractiveBrief(
      await generateGeminiInteractiveBrief(stories, summaries, minutes),
      stories,
      summaries,
    );
    const { text } = brief;
    const document: TranscriptDocument = {
      ...brief,
      _id: cacheId,
      userId: user.id,
      minutes,
      text,
      storiesIncluded: stories.length,
      totalAvailable: ranked.stories.length,
      createdAt: new Date(),
    };
    await collection.replaceOne({ _id: cacheId }, document, { upsert: true });
    return reply({
      ...brief,
      minutes,
      text,
      storiesIncluded: stories.length,
      totalAvailable: ranked.stories.length,
      cached: false,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith('Gemini ')
        ? error.message
        : 'Could not generate your Gemini transcript. Please try again.';
    return reply({ error: message }, 503);
  }
}
