'use client';

import { type SubmitEvent as FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  LoaderCircle,
  LogOut,
  MapPin,
  Radio,
  Sparkles,
} from 'lucide-react';

import { motion } from 'motion/react';
import { FlowShell, Brand, FlowHero } from '@/components/briefly/design';
import { LocationMap } from '@/components/bklit/location-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InterestPicker } from './interest-picker';
import { FollowList } from './follow-list';
import { EMPTY_PROFILE, FOLLOW_LIMITS, MAX_INTERESTS, MAX_STOCKS, hydrateProfile, normalizeProfile, parseTickers, validateTickers, type ListenerProfile as Profile } from '@/lib/preferences';


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
        signal: AbortSignal.timeout(20000),
      });
      const data = (await response.json()) as { user?: Account; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || 'Unable to continue.');
      // Restore the current account's saved preferences on every sign-in.
      setProfile(EMPTY_PROFILE);
      setTickersText('');
      setSaved(false);
      setAuthFields({ name: '', email: '', password: '' });
      setAccount(data.user);
      const me = await fetch('/api/auth/me', { signal: AbortSignal.timeout(15000), cache: 'no-store' });
      if (!me.ok) throw new Error('Signed in, but your saved profile could not be loaded. Refresh to try again.');
      const current = await me.json() as { profile?: Profile };
      if (current.profile) {
        const loaded = hydrateProfile(current.profile);
        setProfile(loaded);
        setTickersText(loaded.tickers.join(', '));
      }
    } catch (error) {
      setMessage(error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? 'The request timed out. If you were creating an account, try signing in before submitting again. Otherwise, check the database connection and retry.'
        : error instanceof Error ? error.message : 'Unable to continue.');
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

  return <FlowShell>
    <header className="flow-nav" id="top"><Brand /><span className="nav-note">YOUR DAILY DOSE OF WHAT MATTERS</span>
      {account ? <div className="flex items-center gap-3"><Link className="nav-link" href="/feed">My feed <ArrowRight size={15} /></Link><Button variant="ghost" onClick={signOut} aria-label="Sign out"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></Button></div> : <a className="nav-link" href="#account">Tune in <ArrowRight size={15} /></a>}
    </header>
    <div className="flow-container"><FlowHero />
      <div className="section-rule"><span>01 / {account ? 'MAKE IT PERSONAL' : 'FIND YOUR FREQUENCY'}</span><span>NEWS THAT GETS YOU</span></div>
      <div className="onboarding-grid">
        <motion.section id="account" className="account-surface" initial={{ opacity: 1, y: 15 }} animate={{ opacity: 1, y: 0 }}>
          {checkingSession ? <output className="flex min-h-60 items-center gap-3"><LoaderCircle className="size-5 animate-spin" />Loading your profile...</output>
          : sessionError ? <div className="space-y-4"><h2 className="display-small">LET&apos;S RECONNECT.</h2><p role="alert">{sessionError}</p><Button onClick={() => { setSessionError(''); setCheckingSession(true); setSessionAttempt((attempt) => attempt + 1); }}>Retry loading profile</Button></div>
          : account ? <ProfileForm profile={profile} tickersText={tickersText} busy={busy} saved={saved} message={message}
            onProfileChange={(value) => { setSaved(false); setMessage(''); setProfile(value); }}
            onTickersChange={(value) => { setSaved(false); setMessage(''); setTickersText(value); }} onToggleTopic={toggleTopic} onSubmit={saveProfile} />
          : <AccountForm mode={authMode} fields={authFields} busy={busy} message={message} onModeChange={(mode) => { setAuthMode(mode); setMessage(''); }} onFieldsChange={setAuthFields} onSubmit={submitAccount} />}
        </motion.section>
        <BriefingPreview profile={profile} tickers={displayTickers} />
      </div>
    </div>
  </FlowShell>;
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
      <div className="mb-7"><p className="eyebrow">YOUR NEXT GOOD HABIT</p><h2 className="display-small mt-3">{mode === 'register' ? 'COME ON IN.' : 'WELCOME BACK.'}</h2><p className="mt-3 text-sm leading-6">A few favorites. A fresh perspective. A feed that feels like you.</p></div>
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
        <h2 className="display-small">SET YOUR FREQUENCY.</h2>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Give us the basics. You can change these preferences anytime.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-7" noValidate>
        <LocationMap country={profile.country} disabled={busy} onSelect={(country) => onProfileChange({ ...profile, country })} />
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
  const topics = [profile.city || 'YOUR NEIGHBORHOOD', profile.topics[0] || 'YOUR CURIOSITIES', profile.teams[0] || 'YOUR HOME TEAM', tickers.length ? tickers.join(' / ') : 'YOUR WATCHLIST'];
  return <aside className="frequency-preview" aria-label="Your preferences preview">
    <div className="preview-topline"><span className="eyebrow">THE WORLD, REMIXED FOR YOU</span><ArrowRight size={20} /></div>
    <div className="record-art" aria-hidden="true"><div className="record-rings" /><div className="record-center"><Radio size={28}/><span>YOUR<br />DAILY<br />SIGNAL.</span></div><span className="record-label">BRIEFLY / PERSONAL FREQUENCY / VOL. 01</span></div>
    <div className="preview-list">{topics.map((topic, index) => <div key={index}><span>0{index+1}</span><strong>{topic}</strong><ArrowRight size={14}/></div>)}</div>
    <p className="preview-note">Built around your interests. Fine-tuned by your feedback.<br />Audio briefings are on the horizon.</p>
  </aside>;
}
