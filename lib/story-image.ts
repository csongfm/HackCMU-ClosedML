export function validArticleUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === 'https://news.google.com' && !url.username && !url.password && /^\/(rss\/)?articles\/[\w-]+$/.test(url.pathname);
  } catch { return false; }
}
function decode(value: string) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, (entity) => {
    const known: Record<string,string> = {'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'};
    if (known[entity]) return known[entity];
    const n = entity.startsWith('&#x') ? parseInt(entity.slice(3,-1),16) : Number(entity.slice(2,-1));
    return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
  });
}
const normalized = (value: string) => decode(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
// Allow punctuation and small headline edits, never a merely topical match.
export function headlineMatches(candidate: string, title: string): boolean {
  if (normalized(candidate) === normalized(title)) return true;
  const words = (text: string) => new Set(decode(text).toLowerCase().replace(/\b([a-z])\.(?=[a-z]\.)/g,'$1').match(/[\p{L}\p{N}]+/gu)?.filter(word => !['the','a','an','to','for','of','and','in','on','is'].includes(word)) || []);
  const a = words(candidate), b = words(title);
  const overlap = [...b].filter(word => a.has(word)).length;
  const numbers = (text: string) => (text.match(/\d+/g) || []).sort().join(',');
  return b.size >= 4 && overlap >= 4 && overlap / b.size >= .85 && overlap / Math.max(1,a.size) >= .65 && numbers(candidate) === numbers(title);
}
export function previewImage(html: string, title: string): string | null {
  if (!normalized(title)) return null;
  for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
    const attrs = new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((m) => [m[1].toLowerCase(), decode(m[3])]));
    if (!headlineMatches(attrs.get('title') || attrs.get('alt') || '', title)) continue;
    try {
      const url = new URL(attrs.get('data-src-hq') || attrs.get('src') || '', 'https://www.bing.com');
      if (url.origin !== 'https://www.bing.com' || url.username || url.password || url.pathname !== '/th' || !url.searchParams.get('id')?.startsWith('ON')) continue;
      url.searchParams.set('w','720'); url.searchParams.set('h','405');
      return url.href;
    } catch { /* Missing metadata omits the image. */ }
  }
  return null;
}
export async function fetchStoryImage(articleUrl: string, title: string): Promise<string | null> {
  if (!validArticleUrl(articleUrl) || !title || title.length > 600) return null;
  try {
    // Fixed news-search host, no arbitrary publisher fetches or redirects.
    // Only a public headline is sent; no account information or ratings.
    const query = new URLSearchParams({q: title, form:'QBNH', setlang:'en-US'});
    const response = await fetch(`https://www.bing.com/news/search?${query}`, { signal: AbortSignal.timeout(6000), redirect:'error', cache:'no-store' });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) { await response.body?.cancel(); return null; }
    const reader = response.body?.getReader();
    if (!reader) return null;
    const decoder = new TextDecoder(); let html = ''; let bytes = 0;
    try {
      while (true) {
        const {done,value} = await reader.read();
        if (done) return previewImage(html,title);
        bytes += value.byteLength;
        if (bytes > 2_000_000) return null;
        html += decoder.decode(value,{stream:true});
        const image = previewImage(html,title);
        if (image) return image;
      }
    } finally { await reader.cancel(); }
  } catch { return null; }
}

export function cachedImageIsFresh(story: {imageUrl?: string | null; imageVersion?: number; imageCheckedAt?: string}, now = Date.now()): boolean {
  return !!story.imageUrl || (story.imageVersion === 2 && !!story.imageCheckedAt && now - Date.parse(story.imageCheckedAt) < 5 * 60000);
}
