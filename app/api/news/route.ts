import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { normalizeProfile } from '@/lib/preferences';
import { fetchNews, type NewsStory, type NewsFeed } from '@/lib/news';
import { discoveryKeywords, rankFeed, ratingsFor, refreshDue, withCoverage } from '@/lib/feed-learning';
import { readFeedback } from '@/lib/feed-learning-store';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

class NewsRequestTimeoutError extends Error {}

async function withNewsDeadline<T>(task: Promise<T>, milliseconds = 35_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([task, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new NewsRequestTimeoutError()), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function GET(request: NextRequest) {
  const startedAt = new Date().toISOString();
  const user = await getSessionUser(request);
  if (!user) return reply({ error: 'Sign in to see your news.' }, 401);
  try {
    return await withNewsDeadline((async () => {
      const db = await getDatabase();
      const [examples, saved] = await Promise.all([
        readFeedback(db, user.id),
        db.collection('profiles').findOne({ userId: user.id }),
      ]);
      if (!saved) return reply({ error: 'Save your interests first so we can build your feed.' }, 409);
      const profile = normalizeProfile(saved);
      const profileHash = createHash('sha256').update(JSON.stringify(profile)).digest('hex');
      // One bounded document per user; changes to preferences invalidate the cache.
      const feeds = db.collection<{ _id: string; profileHash: string; feed: NewsFeed }>('newsFeeds');
      const cached = await feeds.findOne({ _id: user.id, profileHash });
      const age = cached ? Date.now() - Date.parse(cached.feed.fetchedAt) : Infinity;
      if (cached && age < 15 * 60_000) return reply(rankFeed({ ...cached.feed, cached: true }, examples));
      try {
        const feed = await fetchNews(profile);
        await feeds.updateOne({ _id: user.id }, { $set: { profileHash, feed } }, { upsert: true });
        return reply(rankFeed(feed, examples));
      } catch {
        if (cached && age < 24 * 3600_000) return reply(rankFeed({ ...cached.feed, cached: true, warning: 'News sources are unavailable. Showing your previously saved feed; check the update time.' }, examples));
        return reply({ error: 'News sources are unavailable right now. Please try again shortly.' }, 503);
      }
    })());
  } catch (error) {
    if (error instanceof NewsRequestTimeoutError) return reply({ error: 'News loading timed out. Please retry; your saved preferences are safe.' }, 504);
    return reply({ error: 'Could not load your news. Check your connection and try again.' }, 500);
  }
}
