'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Clock3, FileText, LoaderCircle, Pause, Play, RefreshCw, SlidersHorizontal, Star, X } from 'lucide-react';
import { motion } from 'motion/react';
import { FlowShell, Brand, FlowHero } from '@/components/briefly/design';
import { Button } from '@/components/ui/button';
import type { LearnedFeed, StarRating } from '@/lib/feed-learning';
import type { BriefingMinutes } from '@/lib/briefing';
import { chunkNarrationText, NARRATION_SPEEDS } from '@/lib/narration';

export default function FeedPage() {
  const [feed, setFeed] = useState<LearnedFeed | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const actionInFlight = useRef(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  const [category, setCategory] = useState('All');
  const [briefingMinutes, setBriefingMinutes] = useState<BriefingMinutes>(10);
  const [showTranscript, setShowTranscript] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const summariesRef = useRef<Record<string, string>>({});
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [summaryRequests, setSummaryRequests] = useState<Record<string, boolean>>({});
  const [summaryError, setSummaryError] = useState('');
  const [transcript, setTranscript] = useState<{ text: string; storiesIncluded: number; totalAvailable: number; cached: boolean } | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [narrationSpeed, setNarrationSpeed] = useState<number>(1);
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationError, setNarrationError] = useState('');
  const [isNarrating, setIsNarrating] = useState(false);
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null);
  const narrationQueueRef = useRef<string[]>([]);
  const narrationIndexRef = useRef(0);

  useEffect(() => {
    const currentAudio = narrationAudioRef.current;
    if (currentAudio) currentAudio.playbackRate = narrationSpeed;
  }, [narrationSpeed]);

  useEffect(() => () => {
    narrationQueueRef.current.forEach((url) => URL.revokeObjectURL(url));
    narrationAudioRef.current?.pause();
  }, []);

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
      const requestSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(40_000)])
        : AbortSignal.timeout(40_000);
      const response = await fetch('/api/news', { cache: 'no-store', signal: requestSignal });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 409) { setNeedsProfile(true); setFeed(null); }
        throw new Error(data.error || 'Could not load your feed.');
      }
      setFeed(data);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof DOMException && cause.name === 'TimeoutError'
        ? 'News loading timed out. Press Refresh to try again.'
        : cause instanceof Error ? cause.message : 'Could not load your feed.');
    } finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  // load only updates state after the network response; abort protects unmounts.
  // oxlint-disable-next-line react/react-compiler
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  const categories = ['All', ...new Set(feed?.stories.map((story) => story.category) || [])];
  const stories = feed?.stories.filter((story) => category === 'All' || story.category === category) || [];
  const transcriptStoryLimit = { 5: 8, 10: 18, 20: 40 }[briefingMinutes];
  const transcriptReady = Boolean(feed?.stories.slice(0, transcriptStoryLimit).every((story) => summaries[story.url]));

  // Generate only the top eight automatically. Remaining stories are opt-in.
  // oxlint-disable-next-line react/react-compiler
  useEffect(() => {
    if (!feed?.stories.length) return;
    const controller = new AbortController();
    async function generate() {
      const missing = feed!.stories.slice(0, 8).filter((story) => !summariesRef.current[story.url]);
      if (!missing.length) return;
      setSummariesLoading(true); setSummaryError('');
      const batches = Array.from({ length: Math.ceil(missing.length / 8) }, (_, index) => missing.slice(index * 8, index * 8 + 8));
      try {
        for (let index = 0; index < batches.length; index += 2) {
          await Promise.all(batches.slice(index, index + 2).map(async (batch) => {
            const response = await fetch('/api/news/summaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: batch.map((story) => story.url) }), signal: controller.signal });
            const data = await response.json() as { summaries?: { url: string; summary: string }[]; error?: string };
            if (!response.ok || !data.summaries) throw new Error(data.error || 'Could not generate Gemini summaries.');
            setSummaries((current) => {
              const next = { ...current, ...Object.fromEntries(data.summaries!.map((item) => [item.url, item.summary])) };
              summariesRef.current = next;
              return next;
            });
          }));
        }
      } catch (cause) {
        if (!controller.signal.aborted) setSummaryError(cause instanceof Error ? cause.message : 'Could not generate Gemini summaries.');
      } finally { if (!controller.signal.aborted) setSummariesLoading(false); }
    }
    void generate();
    return () => controller.abort();
  }, [feed]);

  async function generateOneSummary(url: string) {
    if (summaryRequests[url] || summaries[url]) return;
    setSummaryRequests((current) => ({ ...current, [url]: true })); setSummaryError('');
    try {
      const response = await fetch('/api/news/summaries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: [url] }) });
      const data = await response.json() as { summaries?: { url: string; summary: string }[]; error?: string };
      if (!response.ok || !data.summaries?.[0]) throw new Error(data.error || 'Could not generate this Gemini summary.');
      setSummaries((current) => {
        const next = { ...current, [url]: data.summaries![0].summary };
        summariesRef.current = next;
        return next;
      });
    } catch (cause) { setSummaryError(cause instanceof Error ? cause.message : 'Could not generate this Gemini summary.'); }
    finally { setSummaryRequests((current) => ({ ...current, [url]: false })); }
  }

  async function viewTranscript() {
    setShowTranscript(true); setTranscriptLoading(true); setTranscriptError(''); setTranscript(null);
    try {
      const response = await fetch('/api/news/transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ minutes: briefingMinutes }) });
      const data = await response.json() as { text?: string; storiesIncluded?: number; totalAvailable?: number; cached?: boolean; error?: string };
      if (!response.ok || !data.text || typeof data.storiesIncluded !== 'number' || typeof data.totalAvailable !== 'number') throw new Error(data.error || 'Could not generate your transcript.');
      setTranscript({ text: data.text, storiesIncluded: data.storiesIncluded, totalAvailable: data.totalAvailable, cached: Boolean(data.cached) });
    } catch (cause) { setTranscriptError(cause instanceof Error ? cause.message : 'Could not generate your transcript.'); }
    finally { setTranscriptLoading(false); }
  }

  async function playNarration() {
    if (!transcript?.text) return;

    const currentAudio = narrationAudioRef.current;
    if (currentAudio && isNarrating) {
      currentAudio.pause();
      setIsNarrating(false);
      return;
    }

    setNarrationError('');
    setNarrationLoading(true);

    try {
      const chunks = chunkNarrationText(transcript.text, 2800);
      if (!chunks.length) throw new Error('This transcript is empty.');

      for (const oldUrl of narrationQueueRef.current) URL.revokeObjectURL(oldUrl);
      narrationQueueRef.current = [];

      const generatedUrls: string[] = [];
      for (const chunk of chunks) {
        const response = await fetch('/api/voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: chunk, speed: narrationSpeed }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || 'Audio generation failed.');
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        generatedUrls.push(objectUrl);
      }

      narrationQueueRef.current = generatedUrls;
      narrationIndexRef.current = 0;
      const startQueue = (index: number) => {
        const currentUrl = narrationQueueRef.current[index];
        if (!currentUrl) {
          setIsNarrating(false);
          return;
        }

        const audio = new Audio(currentUrl);
        narrationAudioRef.current = audio;
        audio.playbackRate = narrationSpeed;
        audio.onended = () => {
          const nextIndex = index + 1;
          if (nextIndex < narrationQueueRef.current.length) {
            narrationIndexRef.current = nextIndex;
            startQueue(nextIndex);
            return;
          }
          narrationIndexRef.current = 0;
          setIsNarrating(false);
        };
        audio.onerror = () => {
          setNarrationError('The narration could not be played in this browser.');
          setIsNarrating(false);
        };
        void audio.play();
        setIsNarrating(true);
      };
      startQueue(0);
    } catch (cause) {
      setNarrationError(cause instanceof Error ? cause.message : 'The narration could not be played.');
      setIsNarrating(false);
    } finally {
      setNarrationLoading(false);
    }
  }

  return <FlowShell>
    <header className="flow-nav" id="top"><Brand /><span className="nav-note">YOUR WORLD. YOUR WAVELENGTH.</span><Link href="/" className="nav-link"><SlidersHorizontal size={15} />Tune your feed</Link></header>
    <div className="flow-container"><FlowHero feed />
      <section className="briefing-builder" aria-labelledby="briefing-title">
        <div className="briefing-builder-copy"><span className="eyebrow"><Clock3 size={14} />DAILY BRIEFING</span><h2 id="briefing-title">HOW MUCH TIME DO YOU HAVE?</h2><p>Choose a full-length rundown at about 150 spoken words per minute, then preview the transcript. Audio comes next.</p></div>
        <div className="briefing-actions">
          <fieldset className="duration-picker"><legend className="sr-only">Briefing length</legend>{([5, 10, 20] as const).map((minutes) => <button key={minutes} type="button" aria-pressed={briefingMinutes === minutes} className={briefingMinutes === minutes ? 'active' : ''} onClick={() => { setBriefingMinutes(minutes); setShowTranscript(false); setTranscript(null); setTranscriptError(''); }}><strong>{minutes}</strong><span>MIN</span></button>)}</fieldset>
          <Button onClick={() => void viewTranscript()} disabled={!feed?.stories.length || transcriptLoading || (!transcriptReady && summariesLoading)}><FileText className="size-4" aria-hidden="true" />{transcriptLoading ? 'Writing with Gemini…' : !transcriptReady && summariesLoading ? 'Preparing summaries…' : 'View transcript'}</Button>
        </div>
      </section>
      {showTranscript && feed && <section id="briefing-transcript" className="transcript-panel" aria-labelledby="transcript-title">
        <div className="transcript-heading"><div><span className="eyebrow">GEMINI TRANSCRIPT</span><h2 id="transcript-title">YOUR {briefingMinutes}-MINUTE BRIEF</h2><p>{transcript ? `${transcript.storiesIncluded} of ${transcript.totalAvailable} stories selected from your ranked feed${transcript.cached ? ' · saved transcript' : ''}.` : 'Researching and writing your personalized rundown.'}</p></div><Button variant="ghost" size="icon" onClick={() => setShowTranscript(false)} aria-label="Close transcript"><X aria-hidden="true" /></Button></div>
        {transcriptLoading && <output className="flex items-center gap-3 py-10"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Gemini is writing your transcript. Longer briefings can take about a minute.</output>}
        {transcriptError && <p role="alert" className="py-8 font-medium">{transcriptError}</p>}
        {narrationError && <p role="alert" className="py-3 font-medium text-amber-600">{narrationError}</p>}
        {transcript && <div className="flex flex-col gap-4 border-b border-border pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button type="button" variant={isNarrating ? 'secondary' : 'default'} onClick={() => void playNarration()} disabled={narrationLoading || !transcript.text}>
                {narrationLoading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : isNarrating ? <Pause className="size-4" aria-hidden="true" /> : <Play className="size-4" aria-hidden="true" />}
                {narrationLoading ? 'Generating audio…' : isNarrating ? 'Pause narration' : 'Listen to transcript'}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Speed
              <select className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" value={narrationSpeed} onChange={(event) => setNarrationSpeed(Number(event.target.value))} aria-label="Playback speed">
                {NARRATION_SPEEDS.map((speed) => <option key={speed} value={speed}>{speed}x</option>)}
              </select>
            </label>
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Audio playback speed adapts to your time goal.</p>
        </div>}
        {transcript && <div className="transcript-copy">{transcript.text.split(/\n{2,}/).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>)}</div>}
        <p className="transcript-note">Generated by Gemini from your current news summaries. Check the linked publisher articles for complete context. Transcript audio is generated on demand.</p>
      </section>}
      <div className="feed-toolbar">
        <div><h2 className="text-xl font-semibold">For you</h2><p className="mt-1 text-sm text-muted-foreground">{feed ? `${feed.stories.length} stories · Updated ${new Date(feed.fetchedAt).toLocaleString()}${feed.cached ? ' · Saved feed' : ''}` : 'Finding recent stories across your preferences'}</p></div>
        <Button variant="outline" disabled={busy || savingRating} onClick={() => { setBusy(true); setError(''); setNeedsProfile(false); void load(); }}><RefreshCw className={`size-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />{busy ? 'Finding stories' : 'Refresh'}</Button>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}{needsProfile && <Link href="/" className="ml-2 font-semibold underline">Go to account & preferences</Link>}</div>}
      {feed?.warning && <output className="mb-5 block rounded-xl border border-border bg-muted p-4 text-sm">{feed.warning}</output>}
      {summaryError && <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">{summaryError}</p>}
      {busy && !feed && <output className="flex items-center gap-3 py-16 text-muted-foreground"><LoaderCircle className="size-5 animate-spin" aria-hidden="true" />Gathering your headlines. This can take up to 35 seconds.</output>}
      {feed && <>
        <div className="feed-categories" aria-label="Filter stories">{categories.map((item) => <Button key={item} variant={category === item ? 'default' : 'outline'} size="sm" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}</div>
        {!stories.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center"><h3 className="font-semibold">No recent matches yet</h3><p className="mt-2 text-sm text-muted-foreground">Try broader interests or fewer exclusions in your preferences.</p></div>}
        <div className="story-grid">{stories.map((story, index) => <motion.article layout="position" initial={{ opacity: 1, y: 12 }} animate={{ opacity: 1, y: 0 }} key={story.url} className="story-card">
          <div className="flex items-center justify-between gap-3 text-xs"><span className="story-number">{String(index + 1).padStart(2, '0')}</span><span className="rounded-full bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">{story.category}</span><time dateTime={story.publishedAt} className="text-muted-foreground">{new Date(story.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
          <h3 className="mb-5 mt-4 text-xl font-semibold leading-snug tracking-tight"><a href={story.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">{story.title}<ArrowUpRight className="ml-1 inline size-4" aria-label="Opens in a new tab" /></a></h3>
          <div className="story-summary"><span>GEMINI DEEP SUMMARY</span>{summaries[story.url] ? <p>{summaries[story.url]}</p> : summaryRequests[story.url] || (summariesLoading && feed.stories.slice(0, 8).some((item) => item.url === story.url)) ? <p className="flex items-center gap-2"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Researching this story…</p> : <Button type="button" size="sm" variant="outline" onClick={() => void generateOneSummary(story.url)}>Generate summary</Button>}</div>
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
