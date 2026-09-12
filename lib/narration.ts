export const NARRATION_SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

export function chunkNarrationText(text: string, maxCharacters = 2400): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentences = normalized.match(/[^.!?]+[.!?]?/g) ?? [normalized];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    if (!current) {
      current = trimmed;
      continue;
    }
    if ((current + ' ' + trimmed).length <= maxCharacters) {
      current = `${current} ${trimmed}`;
      continue;
    }
    chunks.push(current);
    current = trimmed;
  }

  if (current) chunks.push(current);
  return chunks;
}
