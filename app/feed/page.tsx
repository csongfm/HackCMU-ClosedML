'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LoaderCircle, RefreshCw, SlidersHorizontal, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { FlowShell, Brand, FlowHero } from '@/components/briefly/design';
import { StoryImage } from '@/components/briefly/story-image';
import { Button } from '@/components/ui/button';
import type { LearnedFeed, StarRating } from '@/lib/feed-learning';

export default function FeedPage() {
  const [feed, setFeed] = useState<LearnedFeed | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const actionInFlight = useRef(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [category, setCategory] = useState('All');
  async function rate(url: string, rating?: StarRating) {
    if (actionInFlight.current || busy) return;
    actionInFlight.current = true;
    setSavingRating(true); setError('');
    try {
      const response = await fetch('/api/news/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: rating ? 'rate' : 'clear', url, rating }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your rating.');
      setFeed((current) => current ? { ...current, ratings: data.ratings } : current);
      // Keep cards steady until a completed batch fetches new news.
      if (data.refreshDue) await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your rating.'); }
    finally { actionInFlight.current = false; setSavingRating(false); }
  }
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/news', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) { setNeedsProfile(true); setFeed(null); }
        throw new Error(data.error || 'Could not load your feed.');
      }
      setFeed(data);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Could not load your feed.');
    } finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  // load only updates state after the network response; abort protects unmounts.
  // oxlint-disable-next-line react/react-compiler
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const categories = ['All', ...new Set(feed?.stories.map((story) => story.category) || [])];
  const stories = feed?.stories.filter((story) => category === 'All' || story.category === category) || [];

  return <FlowShell>
    <header className="flow-nav" id="top"><Brand /><span className="nav-note">YOUR WORLD. YOUR WAVELENGTH.</span><Link href="/" className="nav-link"><SlidersHorizontal size={15} />Tune your feed</Link></header>
    <div className="flow-container"><FlowHero feed />
      <div className="feed-toolbar">
        <div><h2 className="text-xl font-semibold">For you</h2><p className="mt-1 text-sm text-muted-foreground">{feed ? `${feed.stories.length} stories · Updated ${new Date(feed.fetchedAt).toLocaleString()}${feed.cached ? ' · Saved feed' : ''}` : 'Finding recent stories across your preferences'}</p></div>
        <Button variant="outline" disabled={busy || savingRating} onClick={() => { setBusy(true); setError(''); setNeedsProfile(false); void load(); }}><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />{busy ? 'Finding stories' : 'Refresh'}</Button>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}{needsProfile && <Link href="/" className="ml-2 font-semibold underline">Go to account & preferences</Link>}</div>}
      {feed?.warning && <output className="mb-5 block rounded-xl border border-border bg-muted p-4 text-sm">{feed.warning}</output>}
      {busy && !feed && <output className="flex items-center gap-3 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Gathering your headlines. This can take up to 20 seconds.</output>}
      {feed && <>
        <div className="feed-categories" aria-label="Filter stories">{categories.map((item) => <Button key={item} variant={category === item ? 'default' : 'outline'} size="sm" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div>
        {!stories.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><h3 className="font-semibold">No recent matches yet</h3><p className="mt-2 text-sm text-muted-foreground">Try broader interests or fewer exclusions in your preferences.</p></div>}
        <div className="story-grid">{stories.map((story, index) => <motion.article layout="position" initial={{ opacity: 1, y: 12 }} animate={{ opacity: 1, y: 0 }} key={story.url} className="story-card">
          <StoryImage story={story} />
          <div className="flex items-center justify-between gap-3 text-xs"><span className="story-number">{String(index + 1).padStart(2, '0')}</span><span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{story.category}</span><time dateTime={story.publishedAt} className="text-muted-foreground">{new Date(story.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
          <h3 className="mb-5 mt-4 text-xl font-semibold leading-snug tracking-tight"><a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{story.title}<ArrowUpRight className="ml-1 inline size-4" aria-label="Opens in a new tab" /></a></h3>
          <div className="mt-auto"><p className="text-sm font-medium">{story.source}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Why this story: {story.reasons.slice(0, 3).join(' · ')}</p></div>
          <fieldset className="story-rating" aria-label={`Rate ${story.title}`} disabled={busy || savingRating}>
            <legend className="sr-only">Your rating</legend>
            <span className="rating-label">Your take</span>
            <div className="rating-stars">
              {([1, 2, 3, 4, 5] as const).map((value) => {
                const selected = feed.ratings?.find((item) => item.url === story.url)?.rating || 0;
                return <button key={value} type="button" className="rating-star" aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
                  aria-pressed={selected === value} onClick={() => void rate(story.url, value)}>
                  <Star size={21} fill={value <= selected ? 'currentColor' : 'none'} aria-hidden="true" />
                </button>;
              })}
            </div>
            {feed.ratings?.some((item) => item.url === story.url) && <button type="button" className="rating-clear" onClick={() => void rate(story.url)} aria-label={`Clear rating for ${story.title}`}>Clear</button>}
          </fieldset>
        </motion.article>)}</div>
        <p className="mt-7 text-xs leading-5 text-muted-foreground">Headlines via Google News RSS · English-language edition · New headlines arrive as you read and rate. Exclusions match headline text, not the full article. Search matches may be imperfect.</p>
      </>}
    </div>
  </FlowShell>;
}
