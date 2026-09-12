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

export async function GET(request: NextRequest) {
  const startedAt = new Date().toISOString();
  const user = await getSessionUser(request);
  if (!user) return reply({ error: 'Sign in to see your news.' }, 401);
  try {
    const db = await getDatabase();
    const examples = await readFeedback(db, user.id);
    const saved = await db.collection('profiles').findOne({ userId: user.id });
    if (!saved) return reply({ error: 'Save your interests first so we can build your feed.' }, 409);
    const profile = normalizeProfile(saved);
    const profileHash = createHash('sha256').update(JSON.stringify(profile)).digest('hex');
    // One bounded document per user; changes to preferences invalidate the cache.
    const feeds = db.collection<{ _id: string; profileHash: string; feed: NewsFeed; candidates?: NewsStory[] }>('newsFeeds');
    const cached = await feeds.findOne({ _id: user.id, profileHash });
    const age = cached ? Date.now() - Date.parse(cached.feed.fetchedAt) : Infinity;
    if (cached && age < 15 * 60_000 && !refreshDue(examples, cached.feed.fetchedAt)) return reply({ ...cached.feed, cached: true, ratings: ratingsFor(examples) });
    try {
      const candidates = await fetchNews(profile, discoveryKeywords(examples));
      candidates.stories = withCoverage(candidates.stories);
      const { ratings, ...feed } = rankFeed({ ...candidates, fetchedAt: startedAt }, examples);
      await feeds.updateOne({ _id: user.id }, { $set: { profileHash, feed, candidates: candidates.stories } }, { upsert: true });
      return reply({ ...feed, ratings });
    } catch {
      if (cached && age < 24 * 3600_000) return reply({ ...cached.feed, cached: true, ratings: ratingsFor(examples), warning: 'News sources are unavailable. Showing your previously saved feed; check the update time.' });
      return reply({ error: 'News sources are unavailable right now. Please try again shortly.' }, 503);
    }
  } catch {
    return reply({ error: 'Could not load your news. Check your connection and try again.' }, 500);
  }
}
