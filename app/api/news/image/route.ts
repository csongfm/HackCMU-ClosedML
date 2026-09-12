import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { cachedImageIsFresh, fetchStoryImage, validArticleUrl } from '@/lib/story-image';
import type { NewsFeed } from '@/lib/news';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return reply({ error: 'Sign in to view story images.' }, 401);
  const url = request.nextUrl.searchParams.get('url') || '';
  if (url.length > 4096 || !validArticleUrl(url)) return reply({ error: 'Invalid story.' }, 400);
  try {
    const db = await getDatabase();
    const feeds = db.collection<{ _id: string; feed: NewsFeed }>('newsFeeds');
    const cached = await feeds.findOne({ _id: user.id });
    const story = cached?.feed.stories.find((item) => item.url === url);
    if (!story || !cached || Date.now() - Date.parse(cached.feed.fetchedAt) > 86400000) return reply({ imageUrl: null }, 404);
    if (cachedImageIsFresh(story)) return reply({ imageUrl: story.imageUrl || null });
    const imageUrl = await fetchStoryImage(url, story.title);
    // Cache both hits and misses in this bounded feed, including old saved feeds.
    await feeds.updateOne({ _id: user.id, 'feed.fetchedAt': cached.feed.fetchedAt, 'feed.stories.url': url }, { $set: { 'feed.stories.$.imageUrl': imageUrl, 'feed.stories.$.imageCheckedAt': new Date().toISOString(), 'feed.stories.$.imageVersion': 2 } });
    return reply({ imageUrl });
  } catch { return reply({ imageUrl: null }, 503); }
}

