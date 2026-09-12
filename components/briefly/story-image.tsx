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
    const response = await fetch(
      `/api/news/image?${new URLSearchParams({ url })}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) },
    );
    if (!response.ok) return null;
    return (await response.json()).imageUrl as string | null;
  } finally {
    active--;
    waiting.shift()?.();
  }
}
export function StoryImage({ story }: { story: NewsStory }) {
  return <ResolvedStoryImage key={story.url} story={story} />;
}
function ResolvedStoryImage({ story }: { story: NewsStory }) {
  const container = useRef<HTMLDivElement>(null);
  const [imageUrl, setImageUrl] = useState(story.imageUrl);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (story.imageUrl) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void loadPreview(story.url, controller.signal)
          .then((url) => {
            if (!controller.signal.aborted) setImageUrl(url);
          })
          .catch(() => {
            if (!controller.signal.aborted) setImageUrl(null);
          });
      },
      { rootMargin: '250px' },
    );
    if (container.current) observer.observe(container.current);
    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [story.url, story.imageUrl]);
  const available = imageUrl && !failed;
  return (
    <div
      ref={container}
      className={available && loaded ? styles.frame : styles.probe}
    >
      {available && (
        <Image
          unoptimized
          src={imageUrl}
          alt={'Preview for: ' + story.title}
          width={720}
          height={405}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(event) => {
            if (
              event.currentTarget.naturalWidth < 80 ||
              event.currentTarget.naturalHeight < 50
            )
              setFailed(true);
            else setLoaded(true);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
