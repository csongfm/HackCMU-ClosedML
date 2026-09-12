import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { loadOrGenerateSummaries, GEMINI_SUMMARY_BATCH } from '@/lib/gemini-news';
import type { NewsFeed } from '@/lib/news';

export const runtime = 'nodejs';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return reply({ error: 'Sign in to generate summaries.' }, 401);
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return reply({ error: 'Invalid request origin.' }, 403);
  let urls: string[];
  try {
    const body = await request.json() as { urls?: unknown };
    if (!Array.isArray(body.urls) || !body.urls.every((url) => typeof url === 'string')) throw new Error();
    urls = [...new Set(body.urls)].slice(0, GEMINI_SUMMARY_BATCH + 1);
    if (!urls.length || urls.length > GEMINI_SUMMARY_BATCH || urls.some((url) => url.length > 4096)) throw new Error();
  } catch { return reply({ error: `Choose 1-${GEMINI_SUMMARY_BATCH} valid feed stories.` }, 400); }
  try {
    const db = await getDatabase();
    const cached = await db.collection<{ _id: string; feed: NewsFeed }>('newsFeeds').findOne({ _id: user.id });
    const age = cached ? Date.now() - Date.parse(cached.feed.fetchedAt) : Infinity;
    if (!cached || !Number.isFinite(age) || age >= 24 * 3600_000) return reply({ error: 'Refresh your news feed before generating summaries.' }, 409);
    const byUrl = new Map(cached.feed.stories.map((story) => [story.url, story]));
    const stories = urls.map((url) => byUrl.get(url));
    if (stories.some((story) => !story)) return reply({ error: 'A requested story is not in your current feed.' }, 409);
    const summaries = await loadOrGenerateSummaries(db, stories.filter((story) => story !== undefined));
    return reply({ summaries: urls.map((url) => ({ url, summary: summaries.get(url) })) });
  } catch (error) {
    const message = error instanceof Error && error.message.startsWith('Gemini ') ? error.message : 'Could not generate Gemini summaries. Please try again.';
    return reply({ error: message }, 503);
  }
}
