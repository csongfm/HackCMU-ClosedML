'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle, Radio, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NewsFeed } from '@/lib/news';

export default function FeedPage() {
  const [feed, setFeed] = useState<NewsFeed | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [category, setCategory] = useState('All');
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/news', { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) { setNeedsProfile(true); setFeed(null); }
        throw new Error(data.error || 'Could not load your feed.');
      }
      setFeed(data); setCategory('All');
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Could not load your feed.');
    } finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  // load only updates state after the network response; abort protects unmounts.
  // oxlint-disable-next-line react/react-compiler
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const categories = ['All', ...new Set(feed?.stories.map((story) => story.category) || [])];
  const stories = feed?.stories.filter((story) => category === 'All' || story.category === category) || [];

  return <main className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
      <Link href="/feed" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight"><span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground"><Radio className="size-4" aria-hidden="true" /></span>Briefly</Link>
      <Link href="/" className="flex items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground"><SlidersHorizontal className="size-4" aria-hidden="true" />Edit preferences</Link>
    </header>
    <div className="mx-auto max-w-6xl px-5 pb-16 pt-6 sm:px-8">
      <section className="rounded-3xl bg-[#071a1f] p-7 text-white sm:p-10">
        <p className="text-sm font-medium text-teal-300">YOUR DAILY SIGNAL</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">A world of news.<br />Your kind of stories.</h1>
        <p className="mt-4 max-w-xl leading-7 text-white/65">Recent headlines selected using your interests, places, teams, and watchlist. Open a story to read the original reporting.</p>
        <p className="mt-6 text-xs text-white/50">Personalized feed · Audio briefing is the next step</p>
      </section>
      <div className="mb-5 mt-9 flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-xl font-semibold">For you</h2><p className="mt-1 text-sm text-muted-foreground">{feed ? `${feed.stories.length} stories · Updated ${new Date(feed.fetchedAt).toLocaleString()}${feed.cached ? ' · Saved feed' : ''}` : 'Finding recent stories across your preferences'}</p></div>
        <Button variant="outline" disabled={busy} onClick={() => { setBusy(true); setError(''); setNeedsProfile(false); void load(); }}><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />{busy ? 'Finding stories' : 'Refresh'}</Button>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}{needsProfile && <Link href="/" className="ml-2 font-semibold underline">Go to account & preferences</Link>}</div>}
      {feed?.warning && <output className="mb-5 block rounded-xl border border-border bg-muted p-4 text-sm">{feed.warning}</output>}
      {busy && !feed && <output className="flex items-center gap-3 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Gathering your headlines. This can take up to 20 seconds.</output>}
      {feed && <>
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filter stories">{categories.map((item) => <Button key={item} variant={category === item ? 'default' : 'outline'} size="sm" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div>
        {!stories.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><h3 className="font-semibold">No recent matches yet</h3><p className="mt-2 text-sm text-muted-foreground">Try broader interests or fewer exclusions in your preferences.</p></div>}
        <div className="grid gap-4 md:grid-cols-2">{stories.map((story) => <article key={story.url} className="flex flex-col rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{story.category}</span><time dateTime={story.publishedAt} className="text-muted-foreground">{new Date(story.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
          <h3 className="mb-5 mt-4 text-xl font-semibold leading-snug tracking-tight"><a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{story.title}<ArrowUpRight className="ml-1 inline size-4" aria-label="Opens in a new tab" /></a></h3>
          <div className="mt-auto"><p className="text-sm font-medium">{story.source}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Why this story: {story.reasons.slice(0, 3).join(' · ')}</p></div>
        </article>)}</div>
        <p className="mt-7 text-xs leading-5 text-muted-foreground">Headlines via Google News RSS · English-language edition · Refresh checks for new stories every 15 minutes. Exclusions match headline text, not the full article. Search matches may be imperfect.</p>
      </>}
    </div>
  </main>;
}
