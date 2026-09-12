export const MAX_INTERESTS = 20;
export const MAX_STOCKS = 25;
export const FOLLOW_LIMITS = { teams: 15, locations: 5, companies: 15, people: 15, excludedTopics: 10 } as const;
export const INTEREST_GROUPS = [
  { name: 'Technology & business', topics: ['Technology', 'Artificial intelligence', 'Startups', 'Software development', 'Cybersecurity', 'Gadgets', 'Business', 'Entrepreneurship'] },
  { name: 'Money & markets', topics: ['Stock market', 'Personal finance', 'Economics', 'Cryptocurrency', 'Real estate', 'Venture capital'] },
  { name: 'Sports', topics: ['Sports', 'NFL', 'NBA', 'Soccer', 'MLB', 'NHL', 'Formula 1', 'College sports', 'Tennis', 'Golf'] },
  { name: 'Science & the world', topics: ['World', 'Local news', 'Politics', 'Science', 'Space', 'Climate', 'Energy', 'Education'] },
  { name: 'Culture & entertainment', topics: ['Culture', 'Music', 'Film & TV', 'Gaming', 'Esports', 'Books', 'Art & design', 'Fashion'] },
  { name: 'Life & hobbies', topics: ['Health', 'Fitness', 'Food & cooking', 'Travel', 'Outdoors', 'Photography', 'Cars', 'Productivity'] },
  { name: 'Your community & daily life', topics: ['Weather', 'Traffic & transit', 'Local events', 'Public safety', 'Housing', 'Schools & universities', 'Local government', 'Consumer alerts'] },
  { name: 'Work, family & more', topics: ['Careers & jobs', 'Workplace trends', 'Parenting', 'Pets & animals', 'Agriculture', 'Aviation', 'Architecture', 'History', 'Cricket', 'Rugby', 'Cycling', 'Combat sports'] },
] as const;

export type ListenerProfile = {
  city: string;
  topics: string[];
  country: string;
  teams: string[];
  locations: string[];
  companies: string[];
  people: string[];
  excludedTopics: string[];
  tickers: string[];
  briefingMinutes: number;
};

export const EMPTY_PROFILE: ListenerProfile = { city: '', country: '', topics: [], teams: [], locations: [], companies: [], people: [], excludedTopics: [], tickers: [], briefingMinutes: 10 };

// Hydrate old API responses and React state retained by Fast Refresh. Unlike
// save validation, this also accepts incomplete drafts without losing their data.
export function hydrateProfile(value: unknown): ListenerProfile {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  const list = (key: string): string[] => Array.isArray(input[key])
    ? input[key].filter((item): item is string => typeof item === 'string') : [];
  return {
    city: typeof input.city === 'string' ? input.city : '',
    country: typeof input.country === 'string' ? input.country : '',
    topics: list('topics'),
    teams: input.teams == null && typeof input.team === 'string' && input.team.trim()
      ? [input.team.trim()] : list('teams'),
    locations: list('locations'),
    companies: list('companies'),
    people: list('people'),
    excludedTopics: list('excludedTopics'),
    tickers: list('tickers'),
    briefingMinutes: 10,
  };
}

export function uniqueInterests(values: string[]): string[] {
  const result = new Map<string, string>();
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, ' ');
    if (value && !result.has(value.toLowerCase())) result.set(value.toLowerCase(), value);
  }
  return [...result.values()];
}

export function parseTickers(value: string): string[] {
  return [...new Set(value.split(/[,\s]+/).map((item) => item.trim().replace(/^\$/, '').toUpperCase()).filter(Boolean))];
}

export function validateTickers(tickers: string[]): string | null {
  if (tickers.length > MAX_STOCKS) return `You can follow up to ${MAX_STOCKS} stocks. Remove a few before saving.`;
  if (tickers.some((ticker) => !/^[A-Z0-9][A-Z0-9.\-^=]{0,14}$/.test(ticker))) {
    return 'Use ticker symbols such as AAPL, NVDA, or BRK.B, separated by commas or spaces.';
  }
  return null;
}

export function normalizeProfile(body: unknown): ListenerProfile {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Provide a valid profile.');
  const input = body as Record<string, unknown>;
  if (typeof input.city !== 'string' || (input.team !== undefined && typeof input.team !== 'string')) throw new Error('Provide a city and a valid team name.');
  if (!Array.isArray(input.topics) || !input.topics.every((value) => typeof value === 'string')) throw new Error('Choose valid interests.');
  if (!Array.isArray(input.tickers) || !input.tickers.every((value) => typeof value === 'string')) throw new Error('Provide a list of ticker symbols.');
  const topics = uniqueInterests(input.topics);
  if (topics.length === 0 || topics.length > MAX_INTERESTS || topics.some((value) => value.length > 50)) throw new Error(`Choose 1–${MAX_INTERESTS} interests, each 50 characters or fewer.`);
  const tickers = parseTickers(input.tickers.join(','));
  const stockError = validateTickers(tickers);
  if (stockError) throw new Error(stockError);
  const city = input.city.trim();
  if (!city || city.length > 120) throw new Error('Add a city of up to 120 characters.');
  if (input.country !== undefined && typeof input.country !== 'string') throw new Error('Provide a valid country.');
  const country = typeof input.country === 'string' ? input.country.trim() : '';
  if (country.length > 100) throw new Error('Country must be 100 characters or fewer.');
  function readList(key: keyof typeof FOLLOW_LIMITS, value: unknown = input[key]): string[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error(`Provide a valid list for ${key}.`);
    const items = uniqueInterests(value);
    if (items.length > FOLLOW_LIMITS[key] || items.some((item) => item.length > 100)) throw new Error(`Use up to ${FOLLOW_LIMITS[key]} entries for ${key}, each 100 characters or fewer.`);
    return items;
  }
  // Old accounts used one team. Explicit teams: [] must remain empty after removal.
  const teams = readList('teams', input.teams === undefined && typeof input.team === 'string' ? [input.team] : input.teams);
  return { city, country, topics, teams, locations: readList('locations'), companies: readList('companies'), people: readList('people'), excludedTopics: readList('excludedTopics'), tickers, briefingMinutes: 10 };
}
