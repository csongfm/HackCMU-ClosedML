import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { normalizeProfile } from '@/lib/preferences';
import type { NewsFeed, NewsStory } from '@/lib/news';
import { parseFeedback, ratingsFor, refreshDue, storyFeatures } from '@/lib/feed-learning';
import { saveFeedback } from '@/lib/feed-learning-store';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return reply({ error: 'Sign in to rate stories.' }, 401);
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return reply({ error: 'Invalid request origin.' }, 403);
  let input: ReturnType<typeof parseFeedback>;
  try { input = parseFeedback(await request.json()); }
  catch { return reply({ error: 'Choose a valid story and feedback action.' }, 400); }
  try {
    const db = await getDatabase();
    const profile = await db.collection('profiles').findOne({ userId: user.id });
    if (!profile) return reply({ error: 'Save your preferences first.' }, 409);
    const profileHash = createHash('sha256').update(JSON.stringify(normalizeProfile(profile))).digest('hex');
    const cached = await db.collection<{ _id: string; profileHash: string; feed: NewsFeed; candidates?: NewsStory[] }>('newsFeeds').findOne({ _id: user.id, profileHash });
    if (!cached) return reply({ error: 'Your preferences changed. Refresh the feed before rating stories.' }, 409);
    const age = Date.now() - Date.parse(cached.feed.fetchedAt);
    if (!Number.isFinite(age) || age >= 24 * 3600_000) return reply({ error: 'This saved feed has expired. Refresh before rating stories.' }, 409);
    const story = cached.feed.stories.find((item) => item.url === input.url);
    if (!story) return reply({ error: 'This story is no longer in your saved feed. Refresh and try again.' }, 409);
    const example = input.action === 'rate' && input.rating
      ? { url: story.url, rating: input.rating, ratedAt: new Date().toISOString(), features: storyFeatures(story, cached.candidates || cached.feed.stories, Date.parse(cached.feed.fetchedAt)) } : undefined;
    const examples = await saveFeedback(db, user.id, input.url, example);
    return reply({ ratings: ratingsFor(examples), refreshDue: refreshDue(examples, cached.feed.fetchedAt) });
  } catch {
    return reply({ error: 'Could not save feedback. Please try again.' }, 503);
  }
}
