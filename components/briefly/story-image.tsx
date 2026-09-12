'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { NewsStory } from '@/lib/news';
import styles from './story-image.module.css';

let active = 0;
const waiting: (() => void)[] = [];
async function loadPreview(url: string, signal: AbortSignal) {
  if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    if (signal.aborted) return null;
    const response = await fetch(`/api/news/image?${new URLSearchParams({ url })}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) });
    if (!response.ok) return null;
    return (await response.json()).imageUrl as string | null;
  } finally { active--; waiting.shift()?.(); }
}
export function StoryImage({ story }: { story: NewsStory }) {
  const container = useRef<HTMLElement>(null);
  const [imageUrl, setImageUrl] = useState(story.imageUrl);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (story.imageUrl) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadPreview(story.url, controller.signal).then((url) => {
        if (!controller.signal.aborted) setImageUrl(url);
      }).catch(() => { if (!controller.signal.aborted) setImageUrl(null); });
    }, { rootMargin: '250px' });
    if (container.current) observer.observe(container.current);
    return () => { controller.abort(); observer.disconnect(); };
  }, [story.url, story.imageUrl]);
  const available = imageUrl && !failed;
  const words = story.title.toLowerCase();
  const topic = /\b(ai|technology|robot|robots|robotics|chip|chips|software|computer|cyber|anthropic)\b/.test(words) ? 'technology'
    : story.category === 'Sports' ? 'sports' : story.category === 'Places' || /\b(city|urban|housing|buildings)\b/.test(words) ? 'city' : 'news';
  return <figure ref={container} className={styles.frame}>
    <Image unoptimized src={available ? imageUrl : `/images/news/${topic}.jpg`} alt={available ? `Preview for: ${story.title}` : `Illustrative ${topic} photograph`} width={720} height={405} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => { if (available) setFailed(true); }} />
    {!available && <figcaption className={styles.caption}>Illustrative photo</figcaption>}
  </figure>;
}
