'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Brain, LoaderCircle, RefreshCw, SlidersHorizontal, ThumbsUp, ThumbsDown, Undo2 } from 'lucide-react';
import { motion } from 'motion/react';
import { FlowShell, Brand, FlowHero } from '@/components/briefly/design';
import { FeedbackGauge } from '@/components/bklit/feedback-gauge';
import { Button } from '@/components/ui/button';
import type { LearnedFeed, FeedbackValue } from '@/lib/feed-learning';

export default function FeedPage() {
  const [feed, setFeed] = useState<LearnedFeed | null>(null);
  const [teaching, setTeaching] = useState(false);
  const [lesson, setLesson] = useState('');
  const actionInFlight = useRef(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [category, setCategory] = useState('All');
  async function teach(action: FeedbackValue | 'clear' | 'reset', url?: string) {
    if (actionInFlight.current || busy) return;
    actionInFlight.current = true;
    setTeaching(true); setError(''); setLesson('');
    try {
      const response = await fetch('/api/news/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save feedback.');
      const previous = feed?.stories.map((story) => story.url) || [];
      const moved = data.stories.filter((story: { url: string }, index: number) => previous[index] !== story.url).length;
      setFeed(data);
      setLesson(action === 'reset' ? 'Learning reset. Your original feed order is restored.' : action === 'clear'
        ? 'Feedback removed. Your feed has been recalculated.'
        : `Feedback saved. ${moved ? `${moved} stories changed position.` : 'Your model updated; this lineup stayed in the same order.'} Future headlines will use this feedback too.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save feedback.'); }
    finally { actionInFlight.current = false; setTeaching(false); }
  }
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

  return <FlowShell>
    <header className="flow-nav" id="top"><Brand /><span className="nav-note">YOUR WORLD. YOUR WAVELENGTH.</span><Link href="/" className="nav-link"><SlidersHorizontal size={15} />Tune your feed</Link></header>
    <div className="flow-container"><FlowHero feed />
      <div className="feed-toolbar">
        <div><h2 className="text-xl font-semibold">For you</h2><p className="mt-1 text-sm text-muted-foreground">{feed ? `${feed.stories.length} stories · Updated ${new Date(feed.fetchedAt).toLocaleString()}${feed.cached ? ' · Saved feed' : ''}` : 'Finding recent stories across your preferences'}</p></div>
        <Button variant="outline" disabled={busy || teaching} onClick={() => { setBusy(true); setError(''); setLesson(''); setNeedsProfile(false); void load(); }}><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />{busy ? 'Finding stories' : 'Refresh'}</Button>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}{needsProfile && <Link href="/" className="ml-2 font-semibold underline">Go to account & preferences</Link>}</div>}
      {feed?.warning && <output className="mb-5 block rounded-xl border border-border bg-muted p-4 text-sm">{feed.warning}</output>}
      {busy && !feed && <output className="flex items-center gap-3 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Gathering your headlines. This can take up to 20 seconds.</output>}
      {feed && <>
        <section aria-labelledby="teach-title" className="learning-panel"><FeedbackGauge count={feed.learning?.count || 0} /><div className="learning-copy">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl"><h2 id="teach-title" className="flex items-center gap-2 text-lg font-semibold"><Brain className="size-5 text-primary" aria-hidden="true" />Teach my feed</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Give a story a thumbs up or down. Briefly learns which headline topics, categories, and publishers you prefer and reorders your feed right away.</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Your interests still guide discovery. Less like this lowers similar stories; it does not block them. Learning uses your latest 200 rated stories.</p>
            </div>
            <Button variant="ghost" size="sm" disabled={busy || teaching || !feed.learning?.count} onClick={() => void teach('reset')}><Undo2 className="size-4" aria-hidden="true" />Reset learning</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-card px-3 py-1.5 font-medium">{feed.learning?.count || 0} stories rated</span>
            {feed.learning?.signals.map((signal) => <span key={signal} className="rounded-full bg-secondary px-3 py-1.5 text-secondary-foreground">Learning: {signal}</span>)}
          </div>
          <output aria-live="polite" className="mt-3 block min-h-5 text-sm font-medium text-primary">{teaching ? 'Learning from your feedback…' : lesson || (feed.learning?.count ? 'Your saved feedback is shaping this feed.' : 'Start with a story below. Every rating helps shape your next visit.')}</output>
        </div></section>
        <div className="feed-categories" aria-label="Filter stories">{categories.map((item) => <Button key={item} variant={category === item ? 'default' : 'outline'} size="sm" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div>
        {!stories.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><h3 className="font-semibold">No recent matches yet</h3><p className="mt-2 text-sm text-muted-foreground">Try broader interests or fewer exclusions in your preferences.</p></div>}
        <div className="story-grid">{stories.map((story, index) => <motion.article layout="position" initial={{ opacity: 1, y: 12 }} animate={{ opacity: 1, y: 0 }} key={story.url} className="story-card">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="story-number">{String(index + 1).padStart(2, '0')}</span><span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{story.category}</span><time dateTime={story.publishedAt} className="text-muted-foreground">{new Date(story.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
          <h3 className="mb-5 mt-4 text-xl font-semibold leading-snug tracking-tight"><a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{story.title}<ArrowUpRight className="ml-1 inline size-4" aria-label="Opens in a new tab" /></a></h3>
          <div className="mt-auto"><p className="text-sm font-medium">{story.source}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Why this story: {story.reasons.slice(0, 3).join(' · ')}</p></div>
          <fieldset className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4" aria-label={`Feedback on ${story.title}`}>
            <Button size="sm" variant={feed.learning?.selections.some((item) => item.url === story.url && item.value === 'more') ? 'default' : 'outline'} aria-pressed={feed.learning?.selections.some((item) => item.url === story.url && item.value === 'more') || false} disabled={busy || teaching} onClick={() => void teach('more', story.url)}><ThumbsUp className="size-3.5" aria-hidden="true" />More like this</Button>
            <Button size="sm" variant={feed.learning?.selections.some((item) => item.url === story.url && item.value === 'less') ? 'default' : 'outline'} aria-pressed={feed.learning?.selections.some((item) => item.url === story.url && item.value === 'less') || false} disabled={busy || teaching} onClick={() => void teach('less', story.url)}><ThumbsDown className="size-3.5" aria-hidden="true" />Less like this</Button>
            {feed.learning?.selections.some((item) => item.url === story.url) && <Button size="sm" variant="ghost" disabled={busy || teaching} onClick={() => void teach('clear', story.url)} aria-label={`Undo feedback on ${story.title}`}><Undo2 className="size-3.5" aria-hidden="true" />Undo</Button>}
          </fieldset>
        </motion.article>)}</div>
        <p className="mt-7 text-xs leading-5 text-muted-foreground">Headlines via Google News RSS · English-language edition · Refresh checks for new stories every 15 minutes. Exclusions match headline text, not the full article. Search matches may be imperfect.</p>
      </>}
    </div>
  </FlowShell>;
}
