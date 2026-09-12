'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Clock3,
  Headphones,
  LoaderCircle,
  LogOut,
  MapPin,
  Radio,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InterestPicker } from './interest-picker';
import { FollowList } from './follow-list';
import { EMPTY_PROFILE, FOLLOW_LIMITS, MAX_INTERESTS, MAX_STOCKS, hydrateProfile, normalizeProfile, parseTickers, validateTickers, type ListenerProfile as Profile } from '@/lib/preferences';

const WAVEFORM = [22, 38, 56, 30, 68, 44, 82, 52, 72, 34, 60, 88, 42, 64, 28, 50, 74, 38, 58, 24];

type Account = { id: string; name: string; email: string };

export function OnboardingExperience() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');
  const [authFields, setAuthFields] = useState({ name: '', email: '', password: '' });
  const [profileState, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const profile = hydrateProfile(profileState);
  const [tickersText, setTickersText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [sessionAttempt, setSessionAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let active = true;
    async function loadSession() {
      try {
        const response = await fetch('/api/auth/me', { signal: controller.signal, cache: 'no-store' });
        if (response.status === 401) return;
        if (!response.ok) throw new Error('Could not reach your profile database. Check MongoDB Atlas network access, then retry.');
        const data = (await response.json()) as { user: Account; profile?: Profile };
        if (!active) return;
        setAccount(data.user);
        if (data.profile) {
          const loaded = hydrateProfile(data.profile);
          setProfile(loaded);
          setTickersText(loaded.tickers.join(', '));
        }
      } catch (error) {
        if (active) setSessionError(controller.signal.aborted ? 'Profile loading timed out. Check your database connection and retry.' : error instanceof Error ? error.message : 'Could not load your profile. Please retry.');
      } finally {
        clearTimeout(timeout);
        if (active) setCheckingSession(false);
      }
    }
    void loadSession();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [sessionAttempt]);

  const displayTickers = useMemo(
    () => parseTickers(tickersText),
    [tickersText],
  );

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authFields),
      });
      const data = (await response.json()) as { user?: Account; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || 'Unable to continue.');
      // Restore the current account's saved preferences on every sign-in.
      setProfile(EMPTY_PROFILE);
      setTickersText('');
      setSaved(false);
      setAuthFields({ name: '', email: '', password: '' });
      setAccount(data.user);
      const me = await fetch('/api/auth/me');
      if (!me.ok) throw new Error('Signed in, but your saved profile could not be loaded. Refresh to try again.');
      const current = await me.json() as { profile?: Profile };
      if (current.profile) {
        const loaded = hydrateProfile(current.profile);
        setProfile(loaded);
        setTickersText(loaded.tickers.join(', '));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to continue.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!profile.city.trim() || profile.topics.length === 0) {
      setMessage('Add your city and choose at least one topic.');
      return;
    }

    setBusy(true);
    try {
      const payload = normalizeProfile({ ...profile, tickers: displayTickers });
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { profile?: Profile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || 'Could not save your profile.');
      const loaded = hydrateProfile(data.profile);
      setProfile(loaded);
      setTickersText(loaded.tickers.join(', '));
      setSaved(true);
      setMessage('Preferences saved. Your briefing profile is ready.');
      router.push('/feed');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      setAccount(null);
      setProfile(EMPTY_PROFILE);
      setTickersText('');
      setSaved(false);
      setMessage('');
    } catch { setMessage('Could not sign out. Please try again.'); }
  }

  function toggleTopic(topic: string) {
    setSaved(false);
    setMessage('');
    setProfile((value) => {
      const current = hydrateProfile(value);
      return {
      ...current,
      topics: current.topics.some((item) => item.toLowerCase() === topic.toLowerCase())
        ? current.topics.filter((item) => item.toLowerCase() !== topic.toLowerCase())
        : current.topics.length < MAX_INTERESTS ? [...current.topics, topic] : current.topics,
      };
    });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_14%,oklch(0.78_0.13_185/0.18),transparent_31%),radial-gradient(circle_at_8%_90%,oklch(0.75_0.16_55/0.10),transparent_27%)]" />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-2.5" aria-label="Briefly">
          <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Radio className="size-4" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-[-0.03em]">Briefly</span>
        </div>
        {account ? (
          <div className="flex items-center gap-2">
          <Link href="/feed" className="rounded-lg px-3 py-2 text-sm font-medium text-primary">My feed</Link>
          <Button variant="ghost" onClick={signOut} className="gap-2 text-muted-foreground">
            <span className="hidden sm:inline">{account.email}</span>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="size-4" aria-hidden="true" />
            <span>10 minutes. Just for you.</span>
          </div>
        )}
      </header>

      <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-5 pb-12 pt-5 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)] lg:items-center lg:gap-16 lg:px-10 lg:pb-16 lg:pt-8">
        <section className="max-w-2xl">
          {checkingSession ? (
            <div className="flex min-h-[470px] items-center gap-3 text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> Loading your profile…
            </div>
          ) : sessionError ? (
            <div className="space-y-4 py-16">
              <h1 className="text-2xl font-semibold">Your profile couldn't load</h1>
              <p role="alert" className="text-muted-foreground">{sessionError}</p>
              <Button onClick={() => { setSessionError(''); setCheckingSession(true); setSessionAttempt((attempt) => attempt + 1); }}>Retry loading profile</Button>
            </div>
          ) : account ? (
            <ProfileForm
              profile={profile}
              tickersText={tickersText}
              busy={busy}
              saved={saved}
              message={message}
              onProfileChange={(value) => { setSaved(false); setMessage(''); setProfile(value); }}
              onTickersChange={(value) => { setSaved(false); setMessage(''); setTickersText(value); }}
              onToggleTopic={toggleTopic}
              onSubmit={saveProfile}
            />
          ) : (
            <AccountForm
              mode={authMode}
              fields={authFields}
              busy={busy}
              message={message}
              onModeChange={(mode) => { setAuthMode(mode); setMessage(''); }}
              onFieldsChange={setAuthFields}
              onSubmit={submitAccount}
            />
          )}
        </section>

        <BriefingPreview profile={profile} tickers={displayTickers} />
      </div>
    </main>
  );
}

function AccountForm({ mode, fields, busy, message, onModeChange, onFieldsChange, onSubmit }: {
  mode: 'register' | 'login';
  fields: { name: string; email: string; password: string };
  busy: boolean;
  message: string;
  onModeChange: (mode: 'register' | 'login') => void;
  onFieldsChange: (value: { name: string; email: string; password: string }) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="mb-8">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="size-4" aria-hidden="true" /> Your signal, not the noise
        </div>
        <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-[3.6rem]">
          Your news. One focused listen.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
          Create an account, tell us what matters, and get a personal audio rundown for your commute.
        </p>
      </div>

      <div className="mb-6 flex w-fit rounded-xl bg-muted p-1" role="tablist" aria-label="Account action">
        {(['register', 'login'] as const).map((item) => (
          <Button
            key={item}
            type="button"
            variant={mode === item ? 'default' : 'ghost'}
            role="tab"
            aria-selected={mode === item}
            onClick={() => onModeChange(item)}
            className="h-9 rounded-lg px-4"
          >
            {item === 'register' ? 'Create account' : 'Sign in'}
          </Button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="max-w-lg space-y-5">
        {mode === 'register' && (
          <div className="space-y-2.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" autoComplete="name" required placeholder="Alex Morgan" value={fields.name} onChange={(event) => onFieldsChange({ ...fields, name: event.target.value })} className="h-12 rounded-xl bg-card text-base shadow-sm" />
          </div>
        )}
        <div className="space-y-2.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={fields.email} onChange={(event) => onFieldsChange({ ...fields, email: event.target.value })} className="h-12 rounded-xl bg-card text-base shadow-sm" />
        </div>
        <div className="space-y-2.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={8} required placeholder="At least 8 characters" value={fields.password} onChange={(event) => onFieldsChange({ ...fields, password: event.target.value })} className="h-12 rounded-xl bg-card text-base shadow-sm" />
        </div>
        <Button type="submit" size="lg" disabled={busy} className="h-12 w-full rounded-xl text-base sm:w-auto sm:min-w-56">
          {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          {mode === 'register' ? 'Create my account' : 'Sign in'}
          {!busy && <ArrowRight className="size-4" aria-hidden="true" />}
        </Button>
        {message && <p role="alert" className="text-sm font-medium text-destructive">{message}</p>}
      </form>
    </>
  );
}

function ProfileForm({ profile, tickersText, busy, saved, message, onProfileChange, onTickersChange, onToggleTopic, onSubmit }: {
  profile: Profile;
  tickersText: string;
  busy: boolean;
  saved: boolean;
  message: string;
  onProfileChange: (profile: Profile) => void;
  onTickersChange: (value: string) => void;
  onToggleTopic: (topic: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="mb-8">
        <div className="mb-5 flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="size-4" aria-hidden="true" /> Your signal, not the noise</div>
        <h1 className="max-w-xl text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-5xl lg:text-[3.6rem]">What should make your briefing?</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Give us the basics. You can change these preferences anytime.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-7" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2.5">
            <Label htmlFor="city">Your city</Label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id="city" autoComplete="address-level2" placeholder="Pittsburgh, PA" value={profile.city} onChange={(event) => onProfileChange({ ...profile, city: event.target.value })} className="h-12 rounded-xl bg-card pl-10 text-base shadow-sm" />
            </div>
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="country">Country <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="country" autoComplete="country-name" maxLength={100} placeholder="United States" value={profile.country} onChange={(event) => onProfileChange({ ...profile, country: event.target.value })} className="h-12 rounded-xl bg-card text-base shadow-sm" />
          </div>
        </div>
        <FollowList id="teams" label="Sports teams" hint="Follow teams from any league. Add one at a time." placeholder="e.g. Pittsburgh Steelers or FC Barcelona" items={profile.teams} limit={FOLLOW_LIMITS.teams} onChange={(teams) => onProfileChange({ ...profile, teams })} />
        <InterestPicker selected={profile.topics} onToggle={onToggleTopic} />
        <div className="space-y-2.5">
          <Label htmlFor="tickers">Stocks you follow <span className="font-normal text-muted-foreground">(up to {MAX_STOCKS}, optional)</span></Label>
          <Input id="tickers" maxLength={500} placeholder="NVDA, AAPL, TSLA, MSFT, AMZN, BRK.B" value={tickersText} onChange={(event) => onTickersChange(event.target.value)} aria-describedby="tickers-help" aria-invalid={Boolean(validateTickers(parseTickers(tickersText)))} className="h-12 rounded-xl bg-card text-base uppercase shadow-sm placeholder:normal-case" />
          <p id="tickers-help" className={`text-sm ${validateTickers(parseTickers(tickersText)) ? 'text-destructive' : 'text-muted-foreground'}`}>
            {validateTickers(parseTickers(tickersText)) || `${parseTickers(tickersText).length}/${MAX_STOCKS} stocks. Separate symbols with commas or spaces; duplicates are removed.`}
          </p>
          {parseTickers(tickersText).length > 0 && <div className="flex flex-wrap gap-2" aria-label="Stock watchlist">
            {parseTickers(tickersText).map((ticker) => <span key={ticker} className="max-w-full break-all rounded-md bg-secondary px-2.5 py-1 text-sm font-medium">{ticker}</span>)}
          </div>}
        </div>
        <details className="rounded-xl border border-border bg-card/60 p-4">
          <summary className="cursor-pointer py-1 text-base font-semibold focus-visible:outline-2 focus-visible:outline-primary">Fine-tune your briefing <span className="text-sm font-normal text-muted-foreground">(optional)</span></summary>
          <p className="mt-2 text-sm text-muted-foreground">Follow specific places, organizations, and people, or tell us what to leave out.</p>
          <div className="mt-5 space-y-6">
            <FollowList id="locations" label="Other places you follow" hint="Cities, regions, or countries beyond home." placeholder="e.g. London, UK" items={profile.locations} limit={FOLLOW_LIMITS.locations} onChange={(locations) => onProfileChange({ ...profile, locations })} />
            <FollowList id="companies" label="Companies & organizations" hint="Follow employers, brands, universities, or research labs." placeholder="e.g. Nintendo or Carnegie Mellon University" items={profile.companies} limit={FOLLOW_LIMITS.companies} onChange={(companies) => onProfileChange({ ...profile, companies })} />
            <FollowList id="people" label="People you follow" hint="Athletes, artists, authors, founders, or other public figures." placeholder="e.g. Lewis Hamilton or Taylor Swift" items={profile.people} limit={FOLLOW_LIMITS.people} onChange={(people) => onProfileChange({ ...profile, people })} />
            <FollowList id="excluded-topics" label="Topics to skip" hint="Tell us which subjects you would rather leave out." placeholder="e.g. celebrity gossip or movie spoilers" items={profile.excludedTopics} limit={FOLLOW_LIMITS.excludedTopics} onChange={(excludedTopics) => onProfileChange({ ...profile, excludedTopics })} />
          </div>
        </details>
        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
          <Button type="submit" size="lg" disabled={busy} className="h-12 rounded-xl px-5 text-base sm:min-w-56">
            {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : saved ? <Check className="size-4" aria-hidden="true" /> : null}
            {saved ? 'Open my news feed' : 'Save & build my feed'}
            {!busy && !saved && <ArrowRight className="size-4" aria-hidden="true" />}
          </Button>
          <p className="text-sm text-muted-foreground">Securely saved to your account.</p>
        </div>
        {message && <p aria-live="polite" className={`text-sm font-medium ${saved ? 'text-primary' : 'text-destructive'}`}>{message}</p>}
      </form>
    </>
  );
}

function BriefingPreview({ profile, tickers }: { profile: Profile; tickers: string[] }) {
  return (
    <aside className="mx-auto w-full max-w-lg lg:mx-0" aria-label="Briefing preview">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#071a1f] p-5 text-white shadow-[0_28px_80px_oklch(0.2_0.04_205/0.24)] sm:p-7">
        <div className="absolute right-0 top-0 size-52 translate-x-1/3 -translate-y-1/3 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm text-white/55">Tomorrow morning</p><h2 className="mt-1 text-xl font-medium tracking-tight">Your Daily Briefing</h2></div>
            <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80"><Headphones className="size-3.5" aria-hidden="true" /> 10:00</span>
          </div>
          <div className="my-9 flex h-24 items-center justify-center gap-1" aria-hidden="true">
            {WAVEFORM.map((height, index) => <span key={`${height}-${index}`} className="w-1.5 rounded-full bg-teal-300" style={{ height: `${height}%`, opacity: 0.42 + (index % 4) * 0.16 }} />)}
          </div>
          <div className="space-y-1.5">
            <PreviewRow number="01" title={profile.city ? `What’s happening in ${profile.city}` : 'News from your city'} active />
            <PreviewRow number="02" title={profile.topics.length ? profile.topics.slice(0, 2).join(' + ') : 'Your top interests'} />
            <PreviewRow number="03" title={profile.teams.length ? profile.teams.join(' + ') : 'Your sports teams'} />
            <PreviewRow number="04" title={tickers.length ? `Market watch: ${tickers.join(', ')}` : 'Companies you follow'} />
            {(profile.locations.length > 0 || profile.country) && <PreviewRow number="05" title={[profile.country, ...profile.locations].filter(Boolean).join(' · ')} />}
            {(profile.companies.length > 0 || profile.people.length > 0) && <PreviewRow number="06" title={[...profile.companies, ...profile.people].join(' · ')} />}
          </div>
          {profile.excludedTopics.length > 0 && <p className="mt-4 text-sm text-white/60">Skipping: {profile.excludedTopics.join(', ')}</p>}
          <div className="mt-7 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/50"><span>6 stories · personalized daily</span><span>Voice by ElevenLabs</span></div>
        </div>
      </div>
    </aside>
  );
}

function PreviewRow({ number, title, active = false }: { number: string; title: string; active?: boolean }) {
  return <div className={`flex items-center gap-4 rounded-xl px-3 py-3 ${active ? 'bg-white/10' : ''}`}><span className={`text-xs tabular-nums ${active ? 'text-teal-300' : 'text-white/35'}`}>{number}</span><span className={`min-w-0 flex-1 truncate text-sm ${active ? 'text-white' : 'text-white/68'}`}>{title}</span><span className={`size-1.5 rounded-full ${active ? 'bg-teal-300' : 'bg-white/20'}`} aria-hidden="true" /></div>;
}
